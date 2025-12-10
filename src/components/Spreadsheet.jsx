import { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react'
import Cell from './Cell'
import DeviceManagerModal from './DeviceManagerModal'
import FloatingControls from './FloatingControls'
import ImagePreview from './ImagePreview'
import { useConnection } from '../hooks/useConnection'

const COLUMNS = [
    'Images',
    'Parent name',
    'Variant name',
    'Quantity',
    'Reorder level',
    'Category',
    'Track Quantity',
    'Pricing type',
    'Cost price',
    'Selling Price'
]

const INITIAL_ROWS = 100
const DEFAULT_COL_WIDTH = 100
const MIN_COL_WIDTH = 40
const ROW_HEADER_WIDTH = 32

function createInitialCell(row, col) {
    if (col === 0) return { rawValue: [], displayValue: [], type: 'image', style: {} }
    return { rawValue: '', displayValue: '', type: 'text', style: {} }
}

function createInitialData(rows, cols) {
    const data = {}
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            data[`${r}-${c}`] = createInitialCell(r, c)
        }
    }
    return data
}

const Spreadsheet = memo(function Spreadsheet({ theme, onToggleTheme, installPrompt, onInstall }) {
    // 1. STATE
    const [data, setData] = useState(() => {
        try {
            const saved = localStorage.getItem('spreadsheet_data_v2')
            if (saved) return JSON.parse(saved)
            return createInitialData(INITIAL_ROWS, COLUMNS.length)
        } catch {
            return createInitialData(INITIAL_ROWS, COLUMNS.length)
        }
    })

    // History
    const [history, setHistory] = useState([])
    const pushHistory = useCallback((currentData) => {
        setHistory(prev => {
            const newHist = [...prev, currentData]
            if (newHist.length > 50) newHist.shift()
            return newHist
        })
    }, [])

    const [columnWidths, setColumnWidths] = useState(() => {
        try {
            const saved = localStorage.getItem('spreadsheet_widths')
            return saved ? JSON.parse(saved) :
                COLUMNS.reduce((acc, _, i) => ({ ...acc, [i]: i === 0 ? 80 : DEFAULT_COL_WIDTH }), {})
        } catch {
            return COLUMNS.reduce((acc, _, i) => ({ ...acc, [i]: i === 0 ? 80 : DEFAULT_COL_WIDTH }), {})
        }
    })

    // Selection
    const [selectedCell, setSelectedCell] = useState(null)
    const selectedCellRef = useRef(selectedCell)
    const [selectionRange, setSelectionRange] = useState(null)
    const [editingCell, setEditingCell] = useState(null)
    const [isSelecting, setIsSelecting] = useState(false)

    // UI
    const [resizingCol, setResizingCol] = useState(null)
    const [resizeStartX, setResizeStartX] = useState(0)
    const [resizeStartWidth, setResizeStartWidth] = useState(0)
    const [isDeviceManagerOpen, setIsDeviceManagerOpen] = useState(false)
    const [previewImage, setPreviewImage] = useState(null)
    const [connectedDevices, setConnectedDevices] = useState([])

    // Fill handle drag state
    const [isFilling, setIsFilling] = useState(false)
    const [fillStartCell, setFillStartCell] = useState(null)

    const containerRef = useRef(null)
    const dataRef = useRef(data)

    // Hooks
    const { peerId, sendData, connections } = useConnection('provider')

    const numRows = INITIAL_ROWS
    const numCols = COLUMNS.length

    // Ref Sync & Connection State
    useEffect(() => { selectedCellRef.current = selectedCell }, [selectedCell])
    useEffect(() => { dataRef.current = data }, [data])
    useEffect(() => { setConnectedDevices(connections.map(c => c.peer)) }, [connections])

    // Persistence
    useEffect(() => { localStorage.setItem('spreadsheet_data_v2', JSON.stringify(data)) }, [data])
    useEffect(() => { localStorage.setItem('spreadsheet_widths', JSON.stringify(columnWidths)) }, [columnWidths])

    // Broadcast Active Cell
    useEffect(() => {
        if (selectedCell && selectedCell.col === 0) {
            // Broadcast active cell to all connected devices
            sendData({ 
                type: 'SET_ACTIVE_CELL', 
                payload: { row: selectedCell.row, col: selectedCell.col } 
            })
        }
    }, [selectedCell, sendData])

    // 2. LOGIC
    const updateCell = useCallback((row, col, value) => {
        setData(prev => {
            pushHistory(prev)
            const key = `${row}-${col}`
            const cell = prev[key] || createInitialCell(row, col)
            const type = isNaN(Number(value)) || value === '' ? 'text' : 'number'
            return {
                ...prev,
                [key]: { ...cell, rawValue: value, displayValue: value, type }
            }
        })
    }, [pushHistory])

    // 3. EVENT HANDLERS
    // -- Connection --
    useEffect(() => {
        const handleData = (event) => {
            const { type, payload } = event.detail.data || {}
            
            if (type === 'IMAGE_DATA') {
                const { row, col, image } = payload
                setData(prev => {
                    const key = `${row}-${col}`
                    const currentCell = prev[key] || createInitialCell(row, col)
                    const currentImages = Array.isArray(currentCell.rawValue) ? currentCell.rawValue : []
                    if (currentImages.length >= 4) return prev
                    const newImages = [...currentImages, image]
                    return {
                        ...prev,
                        [key]: { ...currentCell, rawValue: newImages, displayValue: newImages }
                    }
                })
            }

            if (type === 'GREET') {
                // If we have a selected image cell, send it immediately to the new device
                if (selectedCellRef.current && selectedCellRef.current.col === 0) {
                     sendData({ 
                        type: 'SET_ACTIVE_CELL', 
                        payload: { row: selectedCellRef.current.row, col: selectedCellRef.current.col } 
                    }, event.detail.peerId)
                }
            }
        }
        window.addEventListener('peer-data', handleData)
        return () => window.removeEventListener('peer-data', handleData)
    }, [sendData])

    // -- Keyboard --
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (editingCell) return
            if (isDeviceManagerOpen || previewImage) return
            if (!selectedCell) return
            // Ctrl+A: Select All
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault()
                setSelectedCell({ row: 0, col: 0 })
                setSelectionRange({
                    startRow: 0,
                    startCol: 0,
                    endRow: numRows - 1,
                    endCol: numCols - 1
                })
                return
            }

            if (e.ctrlKey || e.metaKey || e.altKey) return

            const isImageCol = selectedCell.col === 0

            if (e.key.length === 1 && !isImageCol) {
                setEditingCell(selectedCell)
                updateCell(selectedCell.row, selectedCell.col, e.key)
                e.preventDefault()
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault()
                
                // Bulk delete support
                let r1 = selectedCell.row, c1 = selectedCell.col
                let r2 = selectedCell.row, c2 = selectedCell.col

                if (selectionRange) {
                    r1 = Math.min(selectionRange.startRow, selectionRange.endRow)
                    r2 = Math.max(selectionRange.startRow, selectionRange.endRow)
                    c1 = Math.min(selectionRange.startCol, selectionRange.endCol)
                    c2 = Math.max(selectionRange.startCol, selectionRange.endCol)
                }

                setData(prev => {
                    pushHistory(prev)
                    const newData = { ...prev }
                    for (let r = r1; r <= r2; r++) {
                        for (let c = c1; c <= c2; c++) {
                            const key = `${r}-${c}`
                            const cell = newData[key] || createInitialCell(r, c)
                            // Reset value based on type (empty array for images, empty string for text)
                            const isImg = c === 0
                            newData[key] = { 
                                ...cell, 
                                rawValue: isImg ? [] : '', 
                                displayValue: isImg ? [] : '' 
                            }
                        }
                    }
                    return newData
                })
            } else if (e.key === 'Enter') {
                e.preventDefault()
                const nextRow = Math.min(numRows - 1, selectedCell.row + 1)
                setSelectedCell({ row: nextRow, col: selectedCell.col })
                setSelectionRange(null)
            } else if (e.key === 'Tab') {
                e.preventDefault()
                const nextCol = Math.min(numCols - 1, selectedCell.col + 1)
                setSelectedCell({ row: selectedCell.row, col: nextCol })
                setSelectionRange(null)
            } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault()
                let { row, col } = selectedCell
                if (e.key === 'ArrowUp') row = Math.max(0, row - 1)
                if (e.key === 'ArrowDown') row = Math.min(numRows - 1, row + 1)
                if (e.key === 'ArrowLeft') col = Math.max(0, col - 1)
                if (e.key === 'ArrowRight') col = Math.min(numCols - 1, col + 1)

                if (e.shiftKey) {
                    setSelectionRange(prev => {
                        const startRow = prev ? prev.startRow : selectedCell.row
                        const startCol = prev ? prev.startCol : selectedCell.col
                        return { startRow, startCol, endRow: row, endCol: col }
                    })
                } else {
                    setSelectedCell({ row, col })
                    setSelectionRange(null)
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedCell, selectionRange, editingCell, isDeviceManagerOpen, previewImage, updateCell, numRows, numCols])

    // -- Clipboard: Copy/Paste --
    useEffect(() => {
        const handleCopy = (e) => {
            if (editingCell) return
            if (!selectedCell) return

            // Determine range
            let r1 = selectedCell.row, c1 = selectedCell.col
            let r2 = selectedCell.row, c2 = selectedCell.col

            if (selectionRange) {
                r1 = Math.min(selectionRange.startRow, selectionRange.endRow)
                r2 = Math.max(selectionRange.startRow, selectionRange.endRow)
                c1 = Math.min(selectionRange.startCol, selectionRange.endCol)
                c2 = Math.max(selectionRange.startCol, selectionRange.endCol)
            }

            // Build TSV string
            let text = ''
            for (let r = r1; r <= r2; r++) {
                const rowVals = []
                for (let c = c1; c <= c2; c++) {
                    const cell = dataRef.current[`${r}-${c}`]
                    let val = cell ? cell.rawValue : ''
                    
                    // If image array, serialize it so we can paste it back later
                    if (Array.isArray(val)) {
                        val = JSON.stringify(val)
                    }
                    rowVals.push(val)
                }
                text += rowVals.join('\t') + (r < r2 ? '\n' : '')
            }

            e.clipboardData.setData('text/plain', text)
            e.preventDefault()
        }

        const handlePaste = (e) => {
            if (editingCell) return
            if (!selectedCell) return
            e.preventDefault()

            const text = e.clipboardData.getData('text/plain')
            if (!text) return

            const rows = text.split(/\r\n|\n|\r/)
            if (rows.length === 0) return

            const startRow = selectedCell.row
            const startCol = selectedCell.col

            let maxRowOffset = 0
            let maxColOffset = 0

            setData(prev => {
                pushHistory(prev)
                const newData = { ...prev }

                rows.forEach((rowStr, i) => {
                    const r = startRow + i
                    if (r >= numRows) return
                    if (i > maxRowOffset) maxRowOffset = i
                    
                    const cols = rowStr.split('\t')
                    cols.forEach((val, j) => {
                        const c = startCol + j
                        if (c >= numCols) return
                        if (j > maxColOffset) maxColOffset = j
                        
                        const key = `${r}-${c}`
                        const cell = newData[key] || createInitialCell(r, c)

                        if (c === 0) {
                            // Image Column Paste Logic
                            try {
                                // Try parsing as JSON array (from our own copy)
                                const parsed = JSON.parse(val)
                                if (Array.isArray(parsed)) {
                                    newData[key] = { ...cell, rawValue: parsed, displayValue: parsed, type: 'image' }
                                    return
                                }
                            } catch (err) {
                                // Not JSON, might be raw url?
                            }
                            
                            // Check for direct data URL
                            if (typeof val === 'string' && (val.startsWith('data:image') || val.startsWith('http'))) {
                                const newArr = [val]
                                newData[key] = { ...cell, rawValue: newArr, displayValue: newArr, type: 'image' }
                            }
                            // Ignore plain text in image column
                        } else {
                            // Normal Text/Number Column
                            const type = isNaN(Number(val)) || val === '' ? 'text' : 'number'
                            newData[key] = {
                                ...cell,
                                rawValue: val,
                                displayValue: val,
                                type
                            }
                        }
                    })
                })
                return newData
            })

            // Highlight pasted range
            setSelectionRange({
                startRow: startRow,
                startCol: startCol,
                endRow: Math.min(numRows - 1, startRow + maxRowOffset),
                endCol: Math.min(numCols - 1, startCol + maxColOffset)
            })
        }

        document.addEventListener('copy', handleCopy)
        document.addEventListener('paste', handlePaste)
        return () => {
            document.removeEventListener('copy', handleCopy)
            document.removeEventListener('paste', handlePaste)
        }
    }, [selectedCell, selectionRange, editingCell, numRows, numCols, pushHistory]) // Removed 'data' dependency

    // -- Mouse Interactions --
    const handleCellClick = useCallback((row, col, e) => {
        if (editingCell?.row !== row || editingCell?.col !== col) setEditingCell(null)
        if (e.shiftKey && selectedCell) {
            setSelectionRange({
                startRow: selectedCell.row,
                startCol: selectedCell.col,
                endRow: row,
                endCol: col
            })
        } else {
            setSelectedCell({ row, col })
            setSelectionRange(null)
        }
    }, [editingCell, selectedCell])

    const handleCellDoubleClick = useCallback((row, col) => {
        if (col === 0) return 
        setEditingCell({ row, col })
    }, [])

    const handleCellMouseDown = useCallback((row, col, e) => {
        if (e.button !== 0) return
        if (e.target.closest('.remove-image-btn')) return

        setIsSelecting(true)
        setSelectedCell({ row, col })
        setEditingCell(null)
        setSelectionRange({ startRow: row, startCol: col, endRow: row, endCol: col })
    }, [])

    const handleCellMouseEnter = useCallback((row, col) => {
        if (isSelecting || isFilling) {
            setSelectionRange(prev => {
                if (!prev) return null
                return { ...prev, endRow: row, endCol: col }
            })
        }
    }, [isSelecting, isFilling])

    useEffect(() => {
        const handleMouseUp = () => {
            if (isFilling && fillStartCell && selectionRange) {
                const sourceCell = data[`${fillStartCell.row}-${fillStartCell.col}`]
                const sourceValue = sourceCell?.rawValue
                
                // Allow filling if source has value
                const hasValue = Array.isArray(sourceValue) ? sourceValue.length > 0 : (sourceValue !== '' && sourceValue !== null && sourceValue !== undefined)

                if (hasValue) {
                    setData(prev => {
                        pushHistory(prev)
                        const newData = { ...prev }
                        const { startRow, endRow, startCol, endCol } = selectionRange
                        const minR = Math.min(startRow, endRow), maxR = Math.max(startRow, endRow)
                        const minC = Math.min(startCol, endCol), maxC = Math.max(startCol, endCol)

                        for (let r = minR; r <= maxR; r++) {
                            for (let c = minC; c <= maxC; c++) {
                                const key = `${r}-${c}`
                                const cell = newData[key] || createInitialCell(r, c)
                                
                                let newType = cell.type
                                if (c === 0) newType = 'image'
                                else newType = isNaN(Number(sourceValue)) ? 'text' : 'number'

                                newData[key] = {
                                    ...cell,
                                    rawValue: sourceValue,
                                    displayValue: sourceValue,
                                    type: newType
                                }
                            }
                        }
                        return newData
                    })
                }
            }
            setIsSelecting(false)
            setIsFilling(false)
            setFillStartCell(null)
        }
        window.addEventListener('mouseup', handleMouseUp)
        return () => window.removeEventListener('mouseup', handleMouseUp)
    }, [isFilling, fillStartCell, selectionRange, data, pushHistory])

    // -- Column Resize --
    const handleResizeStart = useCallback((colIndex, e) => {
        e.preventDefault()
        e.stopPropagation()
        setResizingCol(colIndex)
        setResizeStartX(e.clientX)
        setResizeStartWidth(columnWidths[colIndex] || (colIndex === 0 ? 80 : DEFAULT_COL_WIDTH))
        document.body.style.cursor = 'col-resize'
    }, [columnWidths])

    const handleResizeMove = useCallback((e) => {
        if (resizingCol === null) return
        const diff = e.clientX - resizeStartX
        const newWidth = Math.max(MIN_COL_WIDTH, resizeStartWidth + diff)
        setColumnWidths(prev => ({ ...prev, [resizingCol]: newWidth }))
    }, [resizingCol, resizeStartX, resizeStartWidth])

    const handleResizeEnd = useCallback(() => {
        setResizingCol(null)
        document.body.style.cursor = ''
    }, [])

    useEffect(() => {
        if (resizingCol !== null) {
            window.addEventListener('mousemove', handleResizeMove)
            window.addEventListener('mouseup', handleResizeEnd)
            return () => {
                window.removeEventListener('mousemove', handleResizeMove)
                window.removeEventListener('mouseup', handleResizeEnd)
            }
        }
    }, [resizingCol, handleResizeMove, handleResizeEnd])


    // -- Image Logic --
    const handleImageRemove = useCallback((row, col, index) => {
        setData(prev => {
            pushHistory(prev)
            const key = `${row}-${col}`
            const cell = prev[key]
            const images = [...(cell.rawValue || [])]
            images.splice(index, 1)
            return { ...prev, [key]: { ...cell, rawValue: images, displayValue: images } }
        })
    }, [pushHistory])

    const handleFillHandleMouseDown = useCallback((row, col, e) => {
        e.preventDefault()
        setIsFilling(true)
        setFillStartCell({ row, col })
        setSelectionRange({ startRow: row, startCol: col, endRow: row, endCol: col })
    }, [])

    // -- Render --
    const gridTemplateColumns = useMemo(() => {
        const colWidths = COLUMNS.map((_, i) => `${columnWidths[i] || (i === 0 ? 80 : DEFAULT_COL_WIDTH)}px`).join(' ')
        return `${ROW_HEADER_WIDTH}px ${colWidths}`
    }, [columnWidths])

    const rows = useMemo(() => {
        const result = []
        for (let r = 0; r < numRows; r++) {
            // Calculate sticky position for Row Number (Left: 0)
            const rowHeaderStyle = {
                position: 'sticky',
                left: 0,
                zIndex: 20
            }

            const isActiveRow = selectedCell?.row === r

            result.push(
                <div key={r} className="contents">
                    <div
                        className={`justify-center text-text-secondary border-r border-border-color cursor-default w-8 border-b px-0.5 text-[10px] flex items-center select-none h-full min-h-[40px] ${isActiveRow ? 'bg-blue-50 text-blue-600 font-semibold' : 'bg-bg-secondary'}`}
                        style={rowHeaderStyle}
                        onClick={() => {
                            setSelectedCell({ row: r, col: 0 })
                            setSelectionRange({ startRow: r, startCol: 0, endRow: r, endCol: numCols - 1 })
                        }}
                    >
                        {r + 1}
                    </div>
                    {COLUMNS.map((_, c) => {
                        const key = `${r}-${c}`
                        const cell = data[key] || createInitialCell(r, c)
                        const isSelected = selectedCell?.row === r && selectedCell?.col === c
                        const isEditing = editingCell?.row === r && editingCell?.col === c

                        // Range Check
                        let inRange = false
                        if (selectionRange) {
                            const { startRow, endRow, startCol, endCol } = selectionRange
                            const minR = Math.min(startRow, endRow), maxR = Math.max(startRow, endRow)
                            const minC = Math.min(startCol, endCol), maxC = Math.max(startCol, endCol)
                            inRange = r >= minR && r <= maxR && c >= minC && c <= maxC
                        }

                        const cellWidth = columnWidths[c] || (c === 0 ? 80 : DEFAULT_COL_WIDTH)

                        // Calculate sticky position for Image Column (Col 0)
                        // Sticky Left = Width of Row Header
                        const stickyStyle = c === 0 ? {
                            position: 'sticky',
                            left: `${ROW_HEADER_WIDTH}px`,
                            zIndex: 20
                        } : {}

                        return (
                            <Cell
                                key={key}
                                row={r}
                                col={c}
                                value={cell.rawValue}
                                displayValue={cell.displayValue}
                                type={c === 0 ? 'image' : 'text'}
                                isSelected={isSelected}
                                isEditing={isEditing}
                                inRange={inRange}
                                cellWidth={cellWidth}
                                onClick={handleCellClick}
                                onDoubleClick={handleCellDoubleClick}
                                onChange={updateCell}
                                onMouseDown={handleCellMouseDown}
                                onMouseEnter={handleCellMouseEnter}
                                onImageRemove={handleImageRemove}
                                onImagePreview={setPreviewImage}
                                onFillHandleMouseDown={handleFillHandleMouseDown}
                                style={stickyStyle}
                            />
                        )
                    })}
                </div>
            )
        }
        return result
    }, [numRows, data, selectedCell, editingCell, selectionRange, columnWidths, handleCellClick, handleCellDoubleClick, updateCell, handleCellMouseDown, handleCellMouseEnter, handleImageRemove, handleFillHandleMouseDown])

    return (
        <div className="flex-1 overflow-auto bg-bg-primary relative scrollbar-thin scrollbar-thumb-border-color scrollbar-track-transparent" ref={containerRef}>
            <div className="grid relative" style={{ gridTemplateColumns }}>
                {/* Header Row */}
                <div className="contents">
                    {/* Top Left Corner (Row Nums Header) */}
                    <div className="border-r border-b border-border-color px-0.5 text-[10px] h-10 flex items-center bg-bg-secondary font-semibold justify-center text-text-secondary cursor-default select-none"
                        style={{ position: 'sticky', top: 0, left: 0, zIndex: 40 }}
                    ></div>
                    
                    {/* Column Headers */}
                    {COLUMNS.map((col, i) => {
                         // Sticky style for the first header cell (Images) to stick left as well
                        const stickyHeaderStyle = {
                            position: 'sticky',
                            top: 0,
                            zIndex: 30, // Normal headers
                        }

                        if (i === 0) {
                            stickyHeaderStyle.left = `${ROW_HEADER_WIDTH}px`;
                            stickyHeaderStyle.zIndex = 40; // Higher z-index for intersection
                        }

                        return (
                            <div key={i} 
                                className="border-r border-b border-border-color px-0.5 text-[10px] h-10 flex items-center bg-bg-secondary font-semibold justify-center text-text-secondary cursor-default select-none group"
                                style={stickyHeaderStyle}
                            >
                                {col}
                                <div
                                    className={`absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize z-50 ${resizingCol === i ? 'bg-accent-color' : 'hover:bg-accent-color'}`}
                                    onMouseDown={(e) => handleResizeStart(i, e)}
                                />
                            </div>
                        )
                    })}
                </div>
                {/* Body */}
                {rows}
            </div>

            <FloatingControls 
                onOpenDevices={() => setIsDeviceManagerOpen(true)}
                theme={theme}
                onToggleTheme={onToggleTheme}
                connectedCount={connectedDevices.length}
                installPrompt={installPrompt}
                onInstall={onInstall}
            />

            <DeviceManagerModal
                isOpen={isDeviceManagerOpen}
                onClose={() => setIsDeviceManagerOpen(false)}
                peerId={peerId}
                connections={connections}
            />

            {previewImage && <ImagePreview src={previewImage} onClose={() => setPreviewImage(null)} />}
        </div>
    )
})

export default Spreadsheet
