import { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react'
import Cell from './Cell'
import CodePopup from './CodePopup'
import ImagePreview from './ImagePreview'
import { usePeer } from '../hooks/usePeer'
import { evaluateFormula, isFormula, keyToLabel } from '../utils/formulas'

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

// Data Model: { rawValue, displayValue, type, style }
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

    // Check if oldData uses string values (legacy)
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

// Extract trailing number from a string for auto-increment
function parseValueForIncrement(value) {
    if (!value || typeof value !== 'string') return null
    const match = value.match(/^(.*?)(\d+)$/)
    if (match) {
        return { prefix: match[1], number: parseInt(match[2], 10), digits: match[2].length }
    }
    return null
}

// Generate incremented value
function incrementValue(value, offset) {
    const parsed = parseValueForIncrement(value)
    if (parsed) {
        const newNum = parsed.number + offset
        return parsed.prefix + String(newNum).padStart(parsed.digits, '0')
    }
    return value
}

const Spreadsheet = memo(function Spreadsheet() {
    // Persistent State
    const [data, setData] = useState(() => {
        try {
            const saved = localStorage.getItem('spreadsheet_data_v2')
            if (saved) return JSON.parse(saved)

            const legacy = localStorage.getItem('spreadsheet_data')
            if (legacy) {
                return migrateData(JSON.parse(legacy))
            }
            return createInitialData(INITIAL_ROWS, COLUMNS.length)
        } catch {
            return createInitialData(INITIAL_ROWS, COLUMNS.length)
        }
    })

    // Undo/Redo Stacks
    const [history, setHistory] = useState([])
    const [redoStack, setRedoStack] = useState([])

    // Helper to push history
    const pushHistory = useCallback((currentData) => {
        setHistory(prev => {
            const newHist = [...prev, currentData]
            if (newHist.length > 50) newHist.shift() // Limit 50
            return newHist
        })
        setRedoStack([]) // Clear redo on new action
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
    const [selectionRange, setSelectionRange] = useState(null)
    const [editingCell, setEditingCell] = useState(null)
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState(null)
    const [dragEnd, setDragEnd] = useState(null)
    const [isSelecting, setIsSelecting] = useState(false)
    const [clipboard, setClipboard] = useState(null)
    const [resizingCol, setResizingCol] = useState(null)
    const [resizeStartX, setResizeStartX] = useState(0)
    const [resizeStartWidth, setResizeStartWidth] = useState(0)

    // Image Pairing State
    const [showCodePopup, setShowCodePopup] = useState(false)
    const [previewImage, setPreviewImage] = useState(null)
    const [assignedDevices, setAssignedDevices] = useState({})

    const containerRef = useRef(null)
    const { peerId, connections, sendData } = usePeer('provider')

    const numRows = INITIAL_ROWS
    const numCols = COLUMNS.length

    // Persistence Effects
    useEffect(() => {
        localStorage.setItem('spreadsheet_data_v2', JSON.stringify(data))
    }, [data])

    useEffect(() => {
        localStorage.setItem('spreadsheet_widths', JSON.stringify(columnWidths))
    }, [columnWidths])

    // Recalculate Formulas Helper
    const recalculateAll = useCallback((currentData) => {
        const newData = { ...currentData }
        let changed = false

        for (let pass = 0; pass < 2; pass++) {
            Object.keys(newData).forEach(key => {
                const cell = newData[key]
                if (cell.type === 'text' && isFormula(cell.rawValue)) { // Wait, I set type='formula' in handleCellChange? No, type='text' but checked isFormula?
                    // Let's ensure types are consistent.
                    // If formula, strict type should be 'formula' or 'text' logic?
                    // My previous code set type: isFunc ? 'formula' : ...
                    // So checking type === 'formula' is better.
                }

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

    // Handle incoming image data
    useEffect(() => {
        const handleData = (event) => {
            const { type, payload } = event.detail.data

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
        }

        window.addEventListener('peer-data', handleData)
        return () => window.removeEventListener('peer-data', handleData)
    }, [])

    // Get current selection bounds
    const getSelectionBounds = useCallback(() => {
        if (selectionRange) {
            return {
                minRow: Math.min(selectionRange.startRow, selectionRange.endRow),
                maxRow: Math.max(selectionRange.startRow, selectionRange.endRow),
                minCol: Math.min(selectionRange.startCol, selectionRange.endCol),
                maxCol: Math.max(selectionRange.startCol, selectionRange.endCol)
            }
        }
        if (selectedCell) {
            return {
                minRow: selectedCell.row,
                maxRow: selectedCell.row,
                minCol: selectedCell.col,
                maxCol: selectedCell.col
            }
        }
        return null
    }, [selectionRange, selectedCell])

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
        setColumnWidths(prev => ({
            ...prev,
            [resizingCol]: newWidth
        }))
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
        if (editingCell && (editingCell.row !== row || editingCell.col !== col)) {
            setEditingCell(null)
        }

        if (e?.shiftKey && selectedCell) {
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

    const handleRowClick = useCallback((row) => {
        setSelectedCell({ row, col: 0 })
        setSelectionRange({
            startRow: row,
            startCol: 0,
            endRow: row,
            endCol: numCols - 1
        })
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
        const { row, col } = selectedCell

        const cell = data[`${row}-${col}`]
        const currentCount = cell ? (cell.rawValue?.length || 0) : 0

        sendData({
            type: 'ASSIGN_CELL',
            payload: { row, col, currentCount }
        }, targetPeerId)

        setAssignedDevices(prev => ({
            ...prev,
            [targetPeerId]: { row, col }
        }))

        setShowCodePopup(false)
    }, [selectedCell, sendData, data])

    const handleImageRemove = useCallback((row, col, index) => {
        setData(prev => {
            pushHistory(prev)
            const key = `${row}-${col}`
            const cell = prev[key]
            const images = [...(cell.rawValue || [])]
            images.splice(index, 1)

            return {
                ...prev,
                [key]: { ...cell, rawValue: images, displayValue: images }
            }
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
        setSelectionRange({
            startRow: row,
            startCol: col,
            endRow: row,
            endCol: col
        })
    }, [])

    const handleCellMouseEnter = useCallback((row, col) => {
        if (isSelecting && selectionRange) {
            setSelectionRange(prev => ({
                ...prev,
                endRow: row,
                endCol: col
            }))
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

            newTaskData[key] = {
                ...cell,
                rawValue: rawInput,
                displayValue: isFunc ? rawInput : rawInput,
                type: type
            }

            return recalculateAll(newTaskData)
        })
    }, [pushHistory, recalculateAll])

    const handleCellBlur = useCallback(() => {
        setEditingCell(null)
    }, [])

    // --- Clipboard ---
    const handleCopy = useCallback(() => {
        const bounds = getSelectionBounds()
        if (!bounds) return

        const { minRow, maxRow, minCol, maxCol } = bounds
        const copiedData = []

        for (let r = minRow; r <= maxRow; r++) {
            const rowData = []
            for (let c = minCol; c <= maxCol; c++) {
                const cell = data[`${r}-${c}`]
                const val = cell ? cell.rawValue : ''
                rowData.push(Array.isArray(val) ? '[Images]' : val)
            }
            copiedData.push(rowData)
        }

        setClipboard({
            data: copiedData,
            rows: maxRow - minRow + 1,
            cols: maxCol - minCol + 1
        })

        const text = copiedData.map(row => row.join('\t')).join('\n')
        navigator.clipboard.writeText(text).catch(() => { })
    }, [data, getSelectionBounds])

    const handlePaste = useCallback(async () => {
        if (!selectedCell) return

        let pasteData = null
        try {
            const text = await navigator.clipboard.readText()
            if (text) {
                const rows = text.split('\n').filter(r => r.length > 0)
                pasteData = rows.map(row => row.split('\t'))
            }
        } catch {
            if (clipboard) pasteData = clipboard.data
        }

        if (!pasteData || pasteData.length === 0) return

        const startRow = selectedCell.row
        const startCol = selectedCell.col

        setData(prev => {
            pushHistory(prev)
            const newData = { ...prev }
            for (let r = 0; r < pasteData.length; r++) {
                for (let c = 0; c < pasteData[r].length; c++) {
                    const targetRow = startRow + r
                    const targetCol = startCol + c

                    if (targetRow < numRows && targetCol < numCols) {
                        if (targetCol === 0) continue
                        const key = `${targetRow}-${targetCol}`
                        const pastedVal = pasteData[r][c]
                        newData[key] = {
                            ...(newData[key] || createInitialCell(targetRow, targetCol)),
                            rawValue: pastedVal,
                            displayValue: pastedVal,
                            type: isNaN(Number(pastedVal)) ? 'string' : 'number'
                        }
                    }
                }
            }
            return recalculateAll(newData)
        })

        setSelectionRange({
            startRow: startRow,
            startCol: startCol,
            endRow: Math.min(startRow + pasteData.length - 1, numRows - 1),
            endCol: Math.min(startCol + pasteData[0].length - 1, numCols - 1)
        })
    }, [selectedCell, clipboard, numRows, numCols, pushHistory, recalculateAll])

    const handleUndo = useCallback(() => {
        if (history.length === 0) return
        const previous = history[history.length - 1]
        setRedoStack(prev => [...prev, data])
        setData(previous)
        setHistory(prev => prev.slice(0, -1))
    }, [history, data])

    const handleRedo = useCallback(() => {
        if (redoStack.length === 0) return
        const next = redoStack[redoStack.length - 1]
        setHistory(prev => [...prev, data])
        setData(next)
        setRedoStack(prev => prev.slice(0, -1))
    }, [redoStack, data])

    const handleKeyDown = useCallback((e) => {
        // Undo/Redo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault()
            e.shiftKey ? handleRedo() : handleUndo()
            return
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault()
            handleRedo()
            return
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            e.preventDefault()
            handleCopy()
            return
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            e.preventDefault()
            handlePaste()
            return
        }

        // Select All
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault()
            setSelectedCell({ row: 0, col: 0 })
            setSelectionRange({ startRow: 0, startCol: 0, endRow: numRows - 1, endCol: numCols - 1 })
            return
        }

        if (!selectedCell) return
        const { row, col } = selectedCell

        if (editingCell && e.key === 'Escape') {
            setEditingCell(null)
            return
        }
        if (editingCell) {
            if (e.key === 'Enter') {
                e.preventDefault()
                setEditingCell(null)
                if (e.shiftKey) {
                    if (row > 0) setSelectedCell({ row: row - 1, col });
                } else {
                    if (row < numRows - 1) setSelectedCell({ row: row + 1, col });
                }
                setSelectionRange(null)
            }
            return
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault()
            const bounds = getSelectionBounds()
            if (bounds) {
                setData(prev => {
                    pushHistory(prev)
                    const newData = { ...prev }
                    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                        for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                            const key = `${r}-${c}`
                            const cell = newData[key]
                            if (c === 0) {
                                newData[key] = { ...cell, rawValue: [], displayValue: [] }
                            } else {
                                newData[key] = { ...cell, rawValue: '', displayValue: '', type: 'text' }
                            }
                        }
                    }
                    return recalculateAll(newData)
                })
            }
            return
        }

        const extendSelection = (direction) => {
            const range = selectionRange || { startRow: row, startCol: col, endRow: row, endCol: col };
            let newEndRow = range.endRow;
            let newEndCol = range.endCol;

            if (direction === 'UP') newEndRow = Math.max(0, newEndRow - 1);
            if (direction === 'DOWN') newEndRow = Math.min(numRows - 1, newEndRow + 1);
            if (direction === 'LEFT') newEndCol = Math.max(0, newEndCol - 1);
            if (direction === 'RIGHT') newEndCol = Math.min(numCols - 1, newEndCol + 1);

            setSelectionRange({
                startRow: range.startRow,
                startCol: range.startCol,
                endRow: newEndRow,
                endCol: newEndCol
            });
        };

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault()
                if (e.shiftKey) {
                    extendSelection('UP');
                } else {
                    if (row > 0) setSelectedCell({ row: row - 1, col }); setSelectionRange(null);
                }
                break;
            case 'ArrowDown':
                e.preventDefault()
                if (e.shiftKey) {
                    extendSelection('DOWN');
                } else {
                    if (row < numRows - 1) setSelectedCell({ row: row + 1, col }); setSelectionRange(null);
                }
                break;
            case 'ArrowLeft':
                e.preventDefault()
                if (e.shiftKey) {
                    extendSelection('LEFT');
                } else {
                    if (col > 0) setSelectedCell({ row, col: col - 1 }); setSelectionRange(null);
                }
                break;
            case 'ArrowRight':
                e.preventDefault()
                if (e.shiftKey) {
                    extendSelection('RIGHT');
                } else {
                    if (col < numCols - 1) setSelectedCell({ row, col: col + 1 }); setSelectionRange(null);
                }
                break;
            case 'Enter':
                e.preventDefault()
                if (col !== 0) {
                    setEditingCell({ row, col })
                }
                break
            default:
                if (col !== 0 && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                    setEditingCell({ row, col })
                    handleCellChange(row, col, e.key)
                }
        }
    }, [selectedCell, editingCell, numRows, numCols, handleCellChange, handleCopy, handlePaste, getSelectionBounds, handleUndo, handleRedo, pushHistory, recalculateAll, data, history, redoStack, selectionRange])


    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    const handleFillStart = useCallback((row, col, e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
        setDragStart({ row, col })
        setDragEnd({ row, col })
    }, [])

    const handleMouseMove = useCallback((e) => {
        if (!isDragging || !dragStart) return
        const container = containerRef.current
        if (!container) return
        const cells = container.querySelectorAll('.cell')
        let closestCell = null
        let closestDist = Infinity
        cells.forEach(cell => {
            const rect = cell.getBoundingClientRect()
            const centerX = rect.left + rect.width / 2
            const centerY = rect.top + rect.height / 2
            const dist = Math.sqrt((e.clientX - centerX) ** 2 + (e.clientY - centerY) ** 2)
            if (dist < closestDist) {
                closestDist = dist
                closestCell = cell
            }
        })
        if (closestCell) {
            const row = parseInt(closestCell.dataset.row)
            const col = parseInt(closestCell.dataset.col)
            setDragEnd({ row, col })
        }
    }, [isDragging, dragStart])

    const handleMouseUp = useCallback(() => {
        if (!isDragging || !dragStart || !dragEnd) {
            setIsDragging(false)
            return
        }

        setData(prev => {
            pushHistory(prev)

            const sourceKey = `${dragStart.row}-${dragStart.col}`
            const sourceCell = prev[sourceKey]

            if (dragStart.col === 0) return prev // No dragging images

            const minRow = Math.min(dragStart.row, dragEnd.row)
            const maxRow = Math.max(dragStart.row, dragEnd.row)
            const minCol = Math.min(dragStart.col, dragEnd.col)
            const maxCol = Math.max(dragStart.col, dragEnd.col)

            const newData = { ...prev }
            const isVertical = dragStart.col === dragEnd.col && dragStart.row !== dragEnd.row
            const isHorizontal = dragStart.row === dragEnd.row && dragStart.col !== dragEnd.col

            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    if (c === 0) continue
                    if (r !== dragStart.row || c !== dragStart.col) {
                        let offset
                        if (isVertical) offset = r - dragStart.row
                        else if (isHorizontal) offset = c - dragStart.col
                        else offset = r - dragStart.row + c - dragStart.col

                        let newRaw = sourceCell.rawValue
                        if (!isFormula(newRaw)) {
                            newRaw = incrementValue(sourceCell.rawValue, offset)
                        }

                        newData[`${r}-${c}`] = {
                            ...createInitialCell(r, c),
                            rawValue: newRaw,
                            displayValue: newRaw, // recalc will fix
                            type: isNaN(Number(newRaw)) ? 'string' : 'number'
                        }
                    }
                }
            }
            return recalculateAll(newData)
        })

        setIsDragging(false)
        setDragStart(null)
        setDragEnd(null)
    }, [isDragging, dragStart, dragEnd, pushHistory, recalculateAll])

    const isInDragRange = useCallback((row, col) => {
        if (!isDragging || !dragStart || !dragEnd) return false
        const minRow = Math.min(dragStart.row, dragEnd.row)
        const maxRow = Math.max(dragStart.row, dragEnd.row)
        const minCol = Math.min(dragStart.col, dragEnd.col)
        const maxCol = Math.max(dragStart.col, dragEnd.col)
        return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
    }, [isDragging, dragStart, dragEnd])

    const isInSelectionRange = useCallback((row, col) => {
        if (!selectionRange) return false
        const minRow = Math.min(selectionRange.startRow, selectionRange.endRow)
        const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow)
        const minCol = Math.min(selectionRange.startCol, selectionRange.endCol)
        const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol)
        return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
    }, [selectionRange])

    // Updated Overflow Logic for Objects
    const shouldHideOverflow = useCallback((row, col) => {
        if (col >= numCols - 1) return false
        const key = `${row}-${col + 1}`
        const rightCell = data[key]
        const rightVal = rightCell ? rightCell.displayValue : ''

        if (rightVal && String(rightVal).length > 0) return true
        if (selectedCell?.row === row && selectedCell?.col === col + 1) return true
        if (editingCell?.row === row && editingCell?.col === col + 1) return true
        return false
    }, [data, selectedCell, editingCell, numCols])

    const gridTemplateColumns = useMemo(() => {
        const colWidths = COLUMNS.map((_, i) => `${columnWidths[i] || (i === 0 ? 100 : DEFAULT_COL_WIDTH)}px`).join(' ')
        return `50px ${colWidths}`
    }, [columnWidths])

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
            return () => {
                window.removeEventListener('mousemove', handleMouseMove)
                window.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [isDragging, handleMouseMove, handleMouseUp])

    const rows = useMemo(() => {
        const result = []
        for (let r = 0; r < numRows; r++) {
            result.push(
                <div key={r} className="data-row">
                    <div
                        className="row-number"
                        onClick={() => handleRowClick(r)}
                        style={{ cursor: 'pointer' }}
                    >
                        {r + 1}
                    </div>
                    {COLUMNS.map((_, c) => {
                        const key = `${r}-${c}`
                        const cell = data[key] || createInitialCell(r, c)
                        const val = isFormula(cell.rawValue) && !editingCell ? cell.displayValue : cell.rawValue
                        const showValue = (editingCell?.row === r && editingCell?.col === c) ? cell.rawValue : cell.displayValue

                        const isSelected = selectedCell?.row === r && selectedCell?.col === c
                        const isEditing = editingCell?.row === r && editingCell?.col === c
                        const inDragRange = isInDragRange(r, c)
                        const inSelectionRange = isInSelectionRange(r, c)
                        const hideOverflow = shouldHideOverflow(r, c)
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
                                inRange={inDragRange || inSelectionRange}
                                hideOverflow={hideOverflow}
                                cellWidth={cellWidth}
                                onClick={handleCellClick}
                                onDoubleClick={handleCellDoubleClick}
                                onChange={handleCellChange}
                                onBlur={handleCellBlur}
                                onFillStart={handleFillStart}
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
    }, [numRows, data, selectedCell, editingCell, columnWidths, isInDragRange, isInSelectionRange, shouldHideOverflow, handleCellClick, handleCellDoubleClick, handleCellChange, handleCellBlur, handleFillStart, handleCellMouseDown, handleCellMouseEnter, handleRowClick, handleImageRemove, handleImagePreview, handlePairRequest])

    return (
        <>
            <div className="spreadsheet-container" ref={containerRef}>
                <div className="spreadsheet" style={{ gridTemplateColumns }}>
                    <div className="header-row">
                        <div className="header-cell"></div>
                        {COLUMNS.map((col, i) => (
                            <div key={i} className="header-cell" style={{ position: 'relative' }}>
                                <span className="header-cell-text">{col}</span>
                                <div
                                    className={`resize-handle ${resizingCol === i ? 'resizing' : ''}`}
                                    onMouseDown={(e) => handleResizeStart(i, e)}
                                />
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
                    connections={connections}
                    onAssign={handleAssignDevice}
                    currentCell={selectedCell}
                />
            )}

            {previewImage && (
                <ImagePreview
                    src={previewImage}
                    onClose={() => setPreviewImage(null)}
                />
            )}
        </>
    )
})

export default Spreadsheet
