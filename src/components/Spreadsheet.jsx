import { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react'
import Cell from './Cell'
import CodePopup from './CodePopup'
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
const DEFAULT_COL_WIDTH = 100 // Smaller default
const MIN_COL_WIDTH = 40

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

// Simplified migration - just load data, ignore old formulas/complexity
function migrateData(oldData) {
    if (!oldData) return createInitialData(INITIAL_ROWS, COLUMNS.length)
    return oldData // Assume mostly compatible or just raw values
}

const Spreadsheet = memo(function Spreadsheet() {
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
    const selectedCellRef = useRef(selectedCell) // Ref for event listeners
    const [selectionRange, setSelectionRange] = useState(null)
    const [editingCell, setEditingCell] = useState(null)
    const [isSelecting, setIsSelecting] = useState(false)

    // UI
    const [resizingCol, setResizingCol] = useState(null)
    const [resizeStartX, setResizeStartX] = useState(0)
    const [resizeStartWidth, setResizeStartWidth] = useState(0)
    const [showCodePopup, setShowCodePopup] = useState(false)
    const [previewImage, setPreviewImage] = useState(null)
    const [connectedDevices, setConnectedDevices] = useState([])

    const containerRef = useRef(null)

    // Hooks
    const { peerId, sendData, connections } = useConnection('provider')

    const numRows = INITIAL_ROWS
    const numCols = COLUMNS.length

    // Ref Sync
    useEffect(() => { selectedCellRef.current = selectedCell }, [selectedCell])
    useEffect(() => { setConnectedDevices(connections.map(c => c.peer)) }, [connections])

    // Persistence
    useEffect(() => { localStorage.setItem('spreadsheet_data_v2', JSON.stringify(data)) }, [data])
    useEffect(() => { localStorage.setItem('spreadsheet_widths', JSON.stringify(columnWidths)) }, [columnWidths])

    // 2. LOGIC (No Formulas)
    const updateCell = useCallback((row, col, value) => {
        setData(prev => {
            pushHistory(prev)
            const key = `${row}-${col}`
            const cell = prev[key] || createInitialCell(row, col)
            // Direct update, no formula check
            // Check if input is numeric
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
            const senderId = event.detail.peerId

            if (type === 'IMAGE_DATA') {
                const { row, col, image } = payload
                setData(prev => {
                    const key = `${row}-${col}`
                    const currentCell = prev[key] || createInitialCell(row, col)
                    const currentImages = Array.isArray(currentCell.rawValue) ? currentCell.rawValue : []
                    // Limit 4
                    if (currentImages.length >= 4) return prev
                    const newImages = [...currentImages, image]
                    return {
                        ...prev,
                        [key]: { ...currentCell, rawValue: newImages, displayValue: newImages }
                    }
                })
            }

            if (type === 'GREET') {
                // Auto-assign to current selected
                if (selectedCellRef.current) {
                    const { row, col } = selectedCellRef.current
                    if (col === 0) { // Only assign if on Image column
                        sendData({ type: 'ASSIGN_CELL', payload: { row, col, currentCount: 0 } }, senderId)
                    }
                }
            }
        }
        window.addEventListener('peer-data', handleData)
        return () => window.removeEventListener('peer-data', handleData)
    }, [sendData])

    // -- Keyboard: Type to Overwrite --
    useEffect(() => {
        const handleKeyDown = (e) => {
            // If editing, let default input behavior happen
            if (editingCell) return

            // If popups open, ignore
            if (showCodePopup || previewImage) return

            // If no cell selected, ignore
            if (!selectedCell) return

            // Ignore special keys (Ctrl, Alt, Meta)
            if (e.ctrlKey || e.metaKey || e.altKey) return

            // Key must be a printable character (length 1)
            // Also handle Backspace/Delete to clear
            if (e.key.length === 1) {
                // Focus cell and start editing with this key
                setEditingCell(selectedCell)
                // We pass the key to the Cell component via state or update immediately?
                // Updating immediately is better UX -> Overwrite
                updateCell(selectedCell.row, selectedCell.col, e.key)
                e.preventDefault()
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                updateCell(selectedCell.row, selectedCell.col, '')
            } else if (e.key === 'Enter') {
                // Move down
                e.preventDefault()
                const nextRow = Math.min(numRows - 1, selectedCell.row + 1)
                setSelectedCell({ row: nextRow, col: selectedCell.col })
                setSelectionRange(null)
            } else if (e.key === 'Tab') {
                // Move right
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
                    // Extend selection
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
    }, [selectedCell, editingCell, showCodePopup, previewImage, updateCell, numRows, numCols])

    // -- Clipboard: Copy/Paste --
    useEffect(() => {
        const handleCopy = (e) => {
            if (editingCell) return // Let native copy work in input
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
                    const cell = data[`${r}-${c}`]
                    // If image, maybe skip or put placeholder? Text only for now.
                    rowVals.push(cell ? cell.displayValue : '')
                }
                text += rowVals.join('\t') + (r < r2 ? '\n' : '')
            }

            e.clipboardData.setData('text/plain', text)
            e.preventDefault()
        }

        const handlePaste = (e) => {
            if (editingCell) return // Let native paste work
            if (!selectedCell) return
            e.preventDefault()

            const text = e.clipboardData.getData('text/plain')
            if (!text) return

            const rows = text.split(/\r\n|\n|\r/)
            if (rows.length === 0) return

            // Paste starting at selected cell
            const startRow = selectedCell.row
            const startCol = selectedCell.col

            setData(prev => {
                pushHistory(prev)
                const newData = { ...prev }

                rows.forEach((rowStr, i) => {
                    const r = startRow + i
                    if (r >= numRows) return
                    const cols = rowStr.split('\t')
                    cols.forEach((val, j) => {
                        const c = startCol + j
                        if (c >= numCols) return
                        const key = `${r}-${c}`
                        const cell = newData[key] || createInitialCell(r, c)

                        // Don't paste text into Image column? Or reset it?
                        if (c === 0) return // Skip image column for text paste usually

                        newData[key] = {
                            ...cell,
                            rawValue: val,
                            displayValue: val,
                            type: isNaN(Number(val)) ? 'text' : 'number'
                        }
                    })
                })
                return newData
            })
        }

        document.addEventListener('copy', handleCopy)
        document.addEventListener('paste', handlePaste)
        return () => {
            document.removeEventListener('copy', handleCopy)
            document.removeEventListener('paste', handlePaste)
        }
    }, [selectedCell, selectionRange, editingCell, data, numRows, numCols, pushHistory])


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
        if (col === 0) return // Cannot edit image cell text
        setEditingCell({ row, col })
        // Use timeout to allow input to render then focus is handled in Cell
    }, [])

    // Drag selection
    const handleCellMouseDown = useCallback((row, col, e) => {
        if (e.button !== 0) return // Left click only
        // Ignore specific UI elements
        if (e.target.closest('.pair-btn') || e.target.closest('.remove-image-btn')) return

        setIsSelecting(true)
        setSelectedCell({ row, col })
        setEditingCell(null) // Stop editing
        setSelectionRange({ startRow: row, startCol: col, endRow: row, endCol: col })
    }, [])

    const handleCellMouseEnter = useCallback((row, col) => {
        if (isSelecting) {
            setSelectionRange(prev => {
                if (!prev) return null
                return { ...prev, endRow: row, endCol: col }
            })
        }
    }, [isSelecting])

    useEffect(() => {
        const stopSelecting = () => setIsSelecting(false)
        window.addEventListener('mouseup', stopSelecting)
        return () => window.removeEventListener('mouseup', stopSelecting)
    }, [])

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

    const handlePairRequest = useCallback((row, col) => {
        setSelectedCell({ row, col })
        setShowCodePopup(true)
    }, [])


    // -- Render --
    const gridTemplateColumns = useMemo(() => {
        const colWidths = COLUMNS.map((_, i) => `${columnWidths[i] || (i === 0 ? 80 : DEFAULT_COL_WIDTH)}px`).join(' ')
        return `40px ${colWidths}` // Row header width 40px
    }, [columnWidths])

    const rows = useMemo(() => {
        const result = []
        for (let r = 0; r < numRows; r++) {
            result.push(
                <div key={r} className="data-row">
                    <div className="row-number" onClick={() => {
                        setSelectedCell({ row: r, col: 0 })
                        setSelectionRange({ startRow: r, startCol: 0, endRow: r, endCol: numCols - 1 })
                    }}>{r + 1}</div>
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

                        // Determine value
                        // If editing, Cell component uses input with current value
                        // If type override happened, data is already updated

                        const cellWidth = columnWidths[c] || (c === 0 ? 80 : DEFAULT_COL_WIDTH)

                        return (
                            <Cell
                                key={key}
                                row={r}
                                col={c}
                                value={cell.rawValue} // Pass raw for editing
                                displayValue={cell.displayValue} // Pass display for viewing
                                type={c === 0 ? 'image' : 'text'} // Simplified type
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
                                onPairRequest={handlePairRequest}
                                onImagePreview={setPreviewImage}
                            />
                        )
                    })}
                </div>
            )
        }
        return result
    }, [numRows, data, selectedCell, editingCell, selectionRange, columnWidths, handleCellClick, handleCellDoubleClick, updateCell, handleCellMouseDown, handleCellMouseEnter, handleImageRemove, handlePairRequest])

    return (
        <div className="spreadsheet-container" ref={containerRef}>
            <div className="spreadsheet" style={{ gridTemplateColumns }}>
                {/* Header */}
                <div className="header-row">
                    <div className="header-cell"></div>
                    {COLUMNS.map((col, i) => (
                        <div key={i} className="header-cell">
                            {col}
                            <div className={`resize-handle ${resizingCol === i ? 'resizing' : ''}`} onMouseDown={(e) => handleResizeStart(i, e)} />
                        </div>
                    ))}
                </div>
                {/* Body */}
                {rows}
            </div>

            {showCodePopup && (
                <CodePopup
                    code={peerId}
                    onClose={() => setShowCodePopup(false)}
                    onAssign={(id) => {
                        if (selectedCell) sendData({ type: 'ASSIGN_CELL', payload: { row: selectedCell.row, col: selectedCell.col, currentCount: 0 } }, id)
                        setShowCodePopup(false)
                    }}
                    currentCell={selectedCell}
                    connectedDevices={connectedDevices}
                />
            )}

            {previewImage && <ImagePreview src={previewImage} onClose={() => setPreviewImage(null)} />}
        </div>
    )
})

export default Spreadsheet
