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

const Spreadsheet = memo(function Spreadsheet({ theme, onToggleTheme }) {
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

    // Hooks
    const { peerId, sendData, connections } = useConnection('provider')

    const numRows = INITIAL_ROWS
    const numCols = COLUMNS.length

    // Ref Sync & Connection State
    useEffect(() => { selectedCellRef.current = selectedCell }, [selectedCell])
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
            if (e.ctrlKey || e.metaKey || e.altKey) return

            const isImageCol = selectedCell.col === 0

            if (e.key.length === 1 && !isImageCol) {
                setEditingCell(selectedCell)
                updateCell(selectedCell.row, selectedCell.col, e.key)
                e.preventDefault()
            } else if ((e.key === 'Backspace' || e.key === 'Delete') && !isImageCol) {
                updateCell(selectedCell.row, selectedCell.col, '')
                e.preventDefault()
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
    }, [selectedCell, editingCell, isDeviceManagerOpen, previewImage, updateCell, numRows, numCols])

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
                const sourceValue = data[`${fillStartCell.row}-${fillStartCell.col}`]?.rawValue || ''
                if (sourceValue && fillStartCell.col !== 0) {
                    setData(prev => {
                        pushHistory(prev)
                        const newData = { ...prev }
                        const { startRow, endRow, startCol, endCol } = selectionRange
                        const minR = Math.min(startRow, endRow), maxR = Math.max(startRow, endRow)
                        const minC = Math.min(startCol, endCol), maxC = Math.max(startCol, endCol)

                        for (let r = minR; r <= maxR; r++) {
                            for (let c = minC; c <= maxC; c++) {
                                if (c === 0) continue
                                const key = `${r}-${c}`
                                const cell = newData[key] || createInitialCell(r, c)
                                newData[key] = {
                                    ...cell,
                                    rawValue: sourceValue,
                                    displayValue: sourceValue,
                                    type: isNaN(Number(sourceValue)) ? 'text' : 'number'
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

            result.push(
                <div key={r} className="contents">
                    <div
                        className="bg-bg-secondary justify-center text-text-secondary border-r border-border-color cursor-default w-8 border-b px-0.5 text-[10px] h-5 flex items-center select-none"
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
                    <div className="border-r border-b border-border-color px-0.5 text-[10px] h-5 flex items-center bg-bg-secondary font-semibold justify-center text-text-secondary cursor-default select-none"
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
                                className="border-r border-b border-border-color px-0.5 text-[10px] h-5 flex items-center bg-bg-secondary font-semibold justify-center text-text-secondary cursor-default select-none group"
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
