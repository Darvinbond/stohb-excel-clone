import { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react'
import Cell from './Cell'
import CodePopup from './CodePopup'
import ImagePreview from './ImagePreview'
import { useConnection } from '../hooks/useConnection'
import { evaluateFormula, isFormula } from '../utils/formulas'

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
const DEFAULT_COL_WIDTH = 120
const MIN_COL_WIDTH = 50

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

function migrateData(oldData) {
    if (!oldData) return createInitialData(INITIAL_ROWS, COLUMNS.length)
    const firstKey = Object.keys(oldData)[0]
    if (firstKey && typeof oldData[firstKey] !== 'object' && !Array.isArray(oldData[firstKey])) {
        const newData = {}
        Object.keys(oldData).forEach(key => {
            const val = oldData[key]
            if (key.endsWith('-0') || Array.isArray(val)) {
                newData[key] = { rawValue: val || [], displayValue: val || [], type: 'image', style: {} }
            } else {
                newData[key] = { rawValue: val || '', displayValue: val || '', type: 'text', style: {} }
            }
        })
        return newData
    }
    return oldData
}

const Spreadsheet = memo(function Spreadsheet() {
    const [data, setData] = useState(() => {
        try {
            const saved = localStorage.getItem('spreadsheet_data_v2')
            if (saved) return JSON.parse(saved)
            const legacy = localStorage.getItem('spreadsheet_data')
            if (legacy) return migrateData(JSON.parse(legacy))
            return createInitialData(INITIAL_ROWS, COLUMNS.length)
        } catch {
            return createInitialData(INITIAL_ROWS, COLUMNS.length)
        }
    })

    const [history, setHistory] = useState([])
    const [redoStack, setRedoStack] = useState([])

    // ... history logic ...
    const pushHistory = useCallback((currentData) => {
        setHistory(prev => {
            const newHist = [...prev, currentData]
            if (newHist.length > 50) newHist.shift()
            return newHist
        })
        setRedoStack([])
    }, [])

    const [columnWidths, setColumnWidths] = useState(() => {
        try {
            const saved = localStorage.getItem('spreadsheet_widths')
            return saved ? JSON.parse(saved) :
                COLUMNS.reduce((acc, _, i) => ({ ...acc, [i]: i === 0 ? 100 : DEFAULT_COL_WIDTH }), {})
        } catch {
            return COLUMNS.reduce((acc, _, i) => ({ ...acc, [i]: i === 0 ? 100 : DEFAULT_COL_WIDTH }), {})
        }
    })

    const [selectedCell, setSelectedCell] = useState(null)
    const selectedCellRef = useRef(selectedCell) // Ref to track latest selectedCell

    useEffect(() => {
        selectedCellRef.current = selectedCell
    }, [selectedCell])

    const [selectionRange, setSelectionRange] = useState(null)
    const [editingCell, setEditingCell] = useState(null)
    const [isSelecting, setIsSelecting] = useState(false)
    const [resizingCol, setResizingCol] = useState(null)
    const [resizeStartX, setResizeStartX] = useState(0)
    const [resizeStartWidth, setResizeStartWidth] = useState(0)

    const [showCodePopup, setShowCodePopup] = useState(false)
    const [previewImage, setPreviewImage] = useState(null)

    const containerRef = useRef(null)
    const { peerId, sendData } = useConnection('provider')

    const numRows = INITIAL_ROWS
    const numCols = COLUMNS.length

    useEffect(() => {
        localStorage.setItem('spreadsheet_data_v2', JSON.stringify(data))
    }, [data])

    useEffect(() => {
        localStorage.setItem('spreadsheet_widths', JSON.stringify(columnWidths))
    }, [columnWidths])

    // Recalc function
    const recalculateAll = useCallback((currentData) => {
        const newData = { ...currentData }
        let changed = false
        for (let pass = 0; pass < 2; pass++) {
            Object.keys(newData).forEach(key => {
                const cell = newData[key]
                if (cell.type === 'formula') {
                    const getValue = (k) => {
                        const c = newData[k]
                        return c ? (c.displayValue || c.rawValue) : 0
                    }
                    const result = evaluateFormula(cell.rawValue, getValue)
                    if (result !== cell.displayValue) {
                        newData[key] = { ...cell, displayValue: result }
                        changed = true
                    }
                }
            })
        }
        return changed ? newData : currentData
    }, [])

    // Data Listener
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
                    const newData = {
                        ...prev,
                        [key]: { ...currentCell, rawValue: newImages, displayValue: newImages }
                    }
                    return newData
                })
            }

            if (type === 'GREET') {
                // Sender tells us "I am here"
                // We respond with ASSIGN if we have a cell selected (and popup presumably open)
                const senderId = event.detail.peerId
                const target = selectedCellRef.current
                if (senderId && target) {
                    console.log("Auto-assigning device:", senderId, target)
                    sendData({
                        type: 'ASSIGN_CELL',
                        payload: { row: target.row, col: target.col, currentCount: 0 }
                    }, senderId)
                }
            }
        }

        window.addEventListener('peer-data', handleData)
        return () => window.removeEventListener('peer-data', handleData)
    }, [sendData]) // sendData is stable

    // ... Standard Handlers ...
    const handleResizeStart = useCallback((colIndex, e) => {
        e.preventDefault()
        e.stopPropagation()
        setResizingCol(colIndex)
        setResizeStartX(e.clientX)
        setResizeStartWidth(columnWidths[colIndex] || DEFAULT_COL_WIDTH)
        document.body.classList.add('col-resizing')
    }, [columnWidths])

    const handleResizeMove = useCallback((e) => {
        if (resizingCol === null) return
        const diff = e.clientX - resizeStartX
        const newWidth = Math.max(MIN_COL_WIDTH, resizeStartWidth + diff)
        setColumnWidths(prev => ({ ...prev, [resizingCol]: newWidth }))
    }, [resizingCol, resizeStartX, resizeStartWidth])

    const handleResizeEnd = useCallback(() => {
        setResizingCol(null)
        document.body.classList.remove('col-resizing')
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

    const handleCellClick = useCallback((row, col, e) => {
        if (editingCell && (editingCell.row !== row || editingCell.col !== col)) setEditingCell(null)
        if (e?.shiftKey && selectedCell) {
            setSelectionRange({ startRow: selectedCell.row, startCol: selectedCell.col, endRow: row, endCol: col })
        } else {
            setSelectedCell({ row, col })
            setSelectionRange(null)
        }
    }, [editingCell, selectedCell])

    const handleRowClick = useCallback((row) => {
        setSelectedCell({ row, col: 0 })
        setSelectionRange({ startRow: row, startCol: 0, endRow: row, endCol: numCols - 1 })
    }, [numCols])

    const handlePairRequest = useCallback((row, col) => {
        setSelectedCell({ row, col })
        setShowCodePopup(true)
    }, [])

    const handleImagePreview = useCallback((img) => {
        setPreviewImage(img)
    }, [])

    const handleAssignDevice = useCallback((targetPeerId) => {
        if (!selectedCell) return
        if (targetPeerId) {
            const { row, col } = selectedCell
            // Just send manual assign if needed, but auto-assign via GREET covers most cases
            sendData({ type: 'ASSIGN_CELL', payload: { row, col, currentCount: 0 } }, targetPeerId)
            setShowCodePopup(false)
        }
    }, [selectedCell, sendData])

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

    const handleCellMouseDown = useCallback((row, col, e) => {
        if (e.button !== 0) return
        if (e.target.classList.contains('fill-handle')) return
        if (e.target.closest('.remove-image-btn')) return
        if (e.target.closest('.pair-btn')) return
        if (e.target.closest('.thumbnail-wrapper')) return
        setIsSelecting(true)
        setSelectedCell({ row, col })
        setSelectionRange({ startRow: row, startCol: col, endRow: row, endCol: col })
    }, [])

    const handleCellMouseEnter = useCallback((row, col) => {
        if (isSelecting && selectionRange) {
            setSelectionRange(prev => ({ ...prev, endRow: row, endCol: col }))
        }
    }, [isSelecting, selectionRange])

    useEffect(() => {
        const handleMouseUp = () => setIsSelecting(false)
        window.addEventListener('mouseup', handleMouseUp)
        return () => window.removeEventListener('mouseup', handleMouseUp)
    }, [])

    const handleCellDoubleClick = useCallback((row, col) => {
        if (col === 0) return
        setEditingCell({ row, col })
        setSelectedCell({ row, col })
        setSelectionRange(null)
    }, [])

    const handleCellChange = useCallback((row, col, rawInput) => {
        setData(prev => {
            pushHistory(prev)
            const key = `${row}-${col}`
            const cell = prev[key] || createInitialCell(row, col)
            const isFunc = isFormula(rawInput)
            let newTaskData = { ...prev }
            const type = isFunc ? 'formula' : (isNaN(Number(rawInput)) ? 'string' : 'number')
            newTaskData[key] = { ...cell, rawValue: rawInput, displayValue: isFunc ? rawInput : rawInput, type: type }
            return recalculateAll(newTaskData)
        })
    }, [pushHistory, recalculateAll])

    const handleCellBlur = useCallback(() => {
        setEditingCell(null)
    }, [])

    const gridTemplateColumns = useMemo(() => {
        const colWidths = COLUMNS.map((_, i) => `${columnWidths[i] || (i === 0 ? 100 : DEFAULT_COL_WIDTH)}px`).join(' ')
        return `50px ${colWidths}`
    }, [columnWidths])

    const rows = useMemo(() => {
        const result = []
        for (let r = 0; r < numRows; r++) {
            result.push(
                <div key={r} className="data-row">
                    <div className="row-number" onClick={() => handleRowClick(r)} style={{ cursor: 'pointer' }}>{r + 1}</div>
                    {COLUMNS.map((_, c) => {
                        const key = `${r}-${c}`
                        const cell = data[key] || createInitialCell(r, c)
                        const showValue = (editingCell?.row === r && editingCell?.col === c) ? cell.rawValue : cell.displayValue
                        const isSelected = selectedCell?.row === r && selectedCell?.col === c
                        const isEditing = editingCell?.row === r && editingCell?.col === c
                        const cellWidth = columnWidths[c] || (c === 0 ? 100 : DEFAULT_COL_WIDTH)

                        return (
                            <Cell
                                key={key}
                                row={r}
                                col={c}
                                value={showValue}
                                type={c === 0 ? 'image' : cell.type}
                                isSelected={isSelected}
                                isEditing={isEditing}
                                inRange={false}
                                hideOverflow={false}
                                cellWidth={cellWidth}
                                onClick={handleCellClick}
                                onDoubleClick={handleCellDoubleClick}
                                onChange={handleCellChange}
                                onBlur={handleCellBlur}
                                onFillStart={() => { }}
                                onMouseDown={handleCellMouseDown}
                                onMouseEnter={handleCellMouseEnter}
                                onImageRemove={handleImageRemove}
                                onImagePreview={handleImagePreview}
                                onPairRequest={handlePairRequest}
                            />
                        )
                    })}
                </div>
            )
        }
        return result
    }, [numRows, data, selectedCell, editingCell, columnWidths, handleCellClick, handleCellDoubleClick, handleCellChange, handleCellBlur, handleCellMouseDown, handleCellMouseEnter, handleRowClick, handleImageRemove, handleImagePreview, handlePairRequest])

    return (
        <>
            <div className="spreadsheet-container" ref={containerRef}>
                <div className="spreadsheet" style={{ gridTemplateColumns }}>
                    <div className="header-row">
                        <div className="header-cell"></div>
                        {COLUMNS.map((col, i) => (
                            <div key={i} className="header-cell" style={{ position: 'relative' }}>
                                <span className="header-cell-text">{col}</span>
                                <div className={`resize-handle ${resizingCol === i ? 'resizing' : ''}`} onMouseDown={(e) => handleResizeStart(i, e)} />
                            </div>
                        ))}
                    </div>
                    {rows}
                </div>
            </div>

            {showCodePopup && (
                <CodePopup
                    code={peerId}
                    onClose={() => setShowCodePopup(false)}
                    onAssign={handleAssignDevice}
                    currentCell={selectedCell}
                />
            )}

            {previewImage && <ImagePreview src={previewImage} onClose={() => setPreviewImage(null)} />}
        </>
    )
})

export default Spreadsheet
