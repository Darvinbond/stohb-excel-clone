import { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react'
import Row from './Row'
import Cell from './Cell'
import DeviceManagerModal from './DeviceManagerModal'
import FloatingControls from './FloatingControls'
import ImagePreview from './ImagePreview'
import { useConnection } from '../hooks/useConnection'

const INITIAL_COLUMNS = [
    { id: 'images', name: 'Images', type: 'image', locked: true },
    { id: 'parent_name', name: 'Parent name', type: 'text', locked: true },
    { id: 'variant_name', name: 'Variant name', type: 'text', locked: true },
    { id: 'quantity', name: 'Quantity', type: 'text', locked: true },
    { id: 'reorder_level', name: 'Reorder level', type: 'text', locked: true },
    { id: 'category', name: 'Category', type: 'text', locked: true },
    { id: 'track_quantity', name: 'Track Quantity', type: 'text', locked: true },
    { id: 'pricing_type', name: 'Pricing type', type: 'text', locked: true },
    { id: 'cost_price', name: 'Cost price', type: 'text', locked: true },
    { id: 'selling_price', name: 'Selling Price', type: 'text', locked: true }
]

const INITIAL_ROWS = 100
const DEFAULT_COL_WIDTH = 100
const MIN_COL_WIDTH = 40
const ROW_HEADER_WIDTH = 32

const EMPTY_STYLE = {}
const IMAGE_STICKY_STYLE = {
    position: 'sticky',
    left: `${ROW_HEADER_WIDTH}px`,
    zIndex: 20,
    backgroundColor: 'var(--bg-primary)'
}
const ROW_HEADER_STYLE = {
    position: 'sticky',
    left: 0,
    zIndex: 20
}

const EMPTY_ARRAY = []
const EMPTY_OBJ = {}

function createInitialCell(row, colId, type = 'text') {
    if (type === 'image') return { rawValue: EMPTY_ARRAY, displayValue: EMPTY_ARRAY, type: 'image', style: EMPTY_OBJ }
    return { rawValue: '', displayValue: '', type: 'text', style: EMPTY_OBJ }
}

function createInitialData(rows, columns) {
    const data = {}
    for (let r = 0; r < rows; r++) {
        columns.forEach(col => {
            data[`${r}-${col.id}`] = createInitialCell(r, col.id, col.type)
        })
    }
    return data
}

// Helper to migrate old integer-based column keys to string IDs if necessary
// (Not fully implementing complex migration for this task, assuming fresh start or simple compat)
function getCellKey(row, colId) {
    return `${row}-${colId}`
}

const Spreadsheet = memo(function Spreadsheet({ theme, onToggleTheme, installPrompt, onInstall }) {
    // 1. STATE
    
    // Columns State
    const [columns, setColumns] = useState(() => {
        try {
            const saved = localStorage.getItem('spreadsheet_columns')
            return saved ? JSON.parse(saved) : INITIAL_COLUMNS
        } catch {
            return INITIAL_COLUMNS
        }
    })

    // Data State
    const [data, setData] = useState(() => {
        try {
            const saved = localStorage.getItem('spreadsheet_data_v3') // v3 for new structure
            if (saved) return JSON.parse(saved)
            
            // Fallback: try v2 and migrate (basic mapping by index)
            const oldV2 = localStorage.getItem('spreadsheet_data_v2')
            if (oldV2) {
                const oldData = JSON.parse(oldV2)
                const newData = {}
                // This is a rough migration assuming columns haven't changed order in v2
                // Ideally we'd just start fresh or do a proper migration script
                // For this task, let's just initialize fresh if structure mismatch is likely
                // or map old "0-0" to "0-images", "0-1" to "0-parent_name", etc.
                for (let key in oldData) {
                    const [r, cIdx] = key.split('-')
                    const col = INITIAL_COLUMNS[parseInt(cIdx)]
                    if (col) {
                        newData[`${r}-${col.id}`] = oldData[key]
                    }
                }
                return newData
            }

            return createInitialData(INITIAL_ROWS, INITIAL_COLUMNS)
        } catch {
            return createInitialData(INITIAL_ROWS, INITIAL_COLUMNS)
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
            const saved = localStorage.getItem('spreadsheet_widths_v2')
            return saved ? JSON.parse(saved) :
                INITIAL_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.id === 'images' ? 80 : DEFAULT_COL_WIDTH }), {})
        } catch {
            return INITIAL_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.id === 'images' ? 80 : DEFAULT_COL_WIDTH }), {})
        }
    })

    // Selection
    const [selectedCell, setSelectedCell] = useState(null) // { row, colId }
    const selectedCellRef = useRef(selectedCell)
    const [selectionRange, setSelectionRange] = useState(null) // { startRow, startColIndex, endRow, endColIndex }
    const [editingCell, setEditingCell] = useState(null)
    // isSelecting converted to Ref for synchronous updates
    const isSelectingRef = useRef(false)
    const [editingHeader, setEditingHeader] = useState(null) // { colId } for renaming

    // UI
    const [resizingCol, setResizingCol] = useState(null)
    const [resizeStartX, setResizeStartX] = useState(0)
    const [resizeStartWidth, setResizeStartWidth] = useState(0)
    const [isDeviceManagerOpen, setIsDeviceManagerOpen] = useState(false)
    const [previewImage, setPreviewImage] = useState(null)
    const [connectedDevices, setConnectedDevices] = useState([])

    // Fill handle drag state
    // isFilling converted to Ref for synchronous updates
    const isFillingRef = useRef(false)
    const [fillStartCell, setFillStartCell] = useState(null)

    const containerRef = useRef(null)
    const dataRef = useRef(data)
    
    // Performance optimization: Ref to hold transient state for stable callbacks
    const stateRef = useRef({
        selectedCell,
        selectionRange,
        editingCell,
        fillStartCell,
        columns,
        data
    })

    useEffect(() => {
        stateRef.current = {
            selectedCell,
            selectionRange,
            editingCell,
            fillStartCell,
            columns,
            data
        }
    }, [selectedCell, selectionRange, editingCell, fillStartCell, columns, data])

    // Hooks
    const { peerId, sendData, connections } = useConnection('provider')

    const numRows = INITIAL_ROWS
    
    // Derived for easy access
    const colIds = useMemo(() => columns.map(c => c.id), [columns])

    // Ref Sync & Connection State
    useEffect(() => { selectedCellRef.current = selectedCell }, [selectedCell])
    useEffect(() => { dataRef.current = data }, [data])
    useEffect(() => { setConnectedDevices(connections.map(c => c.peer)) }, [connections])

    // Persistence
    useEffect(() => { localStorage.setItem('spreadsheet_columns', JSON.stringify(columns)) }, [columns])
    useEffect(() => { localStorage.setItem('spreadsheet_data_v3', JSON.stringify(data)) }, [data])
    useEffect(() => { localStorage.setItem('spreadsheet_widths_v2', JSON.stringify(columnWidths)) }, [columnWidths])

    // Broadcast Active Cell
    useEffect(() => {
        if (selectedCell && selectedCell.colId === 'images') {
            const colIndex = columns.findIndex(c => c.id === 'images')
            sendData({ 
                type: 'SET_ACTIVE_CELL', 
                payload: { row: selectedCell.row, col: colIndex } // Sending index for backward compat with phone
            })
        }
    }, [selectedCell, sendData, columns])

    // 2. LOGIC
    const updateCell = useCallback((row, colId, value) => {
        setData(prev => {
            pushHistory(prev)
            const key = getCellKey(row, colId)
            const cell = prev[key] || createInitialCell(row, colId)
            const type = isNaN(Number(value)) || value === '' ? 'text' : 'number'
            return {
                ...prev,
                [key]: { ...cell, rawValue: value, displayValue: value, type }
            }
        })
    }, [pushHistory])

    const handleAddColumn = useCallback(() => {
        const newId = `col_${Date.now()}`
        const newCol = { id: newId, name: 'New Column', type: 'text', locked: false }
        setColumns(prev => [...prev, newCol])
        setColumnWidths(prev => ({ ...prev, [newId]: DEFAULT_COL_WIDTH }))
    }, [])

    const handleRemoveColumn = useCallback((colId) => {
        if (confirm('Delete this column and all its data?')) {
            setColumns(prev => prev.filter(c => c.id !== colId))
            setColumnWidths(prev => {
                const next = { ...prev }
                delete next[colId]
                return next
            })
            // Optionally clean up data for this column to save space, but not strictly necessary for functionality
        }
    }, [])

    const handleRenameColumn = useCallback((colId, newName) => {
        setColumns(prev => prev.map(c => c.id === colId ? { ...c, name: newName } : c))
        setEditingHeader(null)
    }, [])

    // 3. EVENT HANDLERS
    // -- Connection --
    useEffect(() => {
        const handleData = (event) => {
            const { type, payload } = event.detail.data || {}
            
            if (type === 'IMAGE_DATA') {
                const { row, col, image } = payload
                const currentColumns = stateRef.current.columns
                
                // Safety check for bounds
                if (!currentColumns[col]) return

                const colId = currentColumns[col].id
                
                // Enforce type safety: only allow images in image columns
                if (currentColumns[col].type !== 'image') return

                setData(prev => {
                    const key = getCellKey(row, colId)
                    const currentCell = prev[key] || createInitialCell(row, colId, 'image')
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
                if (selectedCellRef.current && selectedCellRef.current.colId === 'images') {
                     const currentColumns = stateRef.current.columns
                     const colIndex = currentColumns.findIndex(c => c.id === 'images')
                     
                     if (colIndex !== -1) {
                        sendData({
                            type: 'SET_ACTIVE_CELL',
                            payload: { row: selectedCellRef.current.row, col: colIndex }
                        }, event.detail.peerId)
                     }
                }
            }
        }
        window.addEventListener('peer-data', handleData)
        return () => window.removeEventListener('peer-data', handleData)
    }, [sendData])

    // -- Keyboard --
    useEffect(() => {
        const handleKeyDown = (e) => {
                const { editingCell, selectedCell, selectionRange, columns, data } = stateRef.current
                // We use stateRef for most things, but editingHeader/isDeviceManagerOpen/previewImage are UI toggles usually kept in state
                // Let's grab them from stateRef too if we put them there, otherwise they are deps
                
                if (editingCell || editingHeader) return
            if (isDeviceManagerOpen || previewImage) return
            if (!selectedCell) return

            // Ctrl+A: Select All
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault()
                setSelectedCell({ row: 0, colId: columns[0].id })
                setSelectionRange({
                    startRow: 0,
                    startColIndex: 0,
                    endRow: numRows - 1,
                    endColIndex: columns.length - 1
                })
                return
            }

            if (e.ctrlKey || e.metaKey || e.altKey) return

            const isImageCol = selectedCell.colId === 'images'

            if (e.key.length === 1 && !isImageCol) {
                setEditingCell(selectedCell)
                updateCell(selectedCell.row, selectedCell.colId, e.key)
                e.preventDefault()
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault()
                
                // Bulk delete support
                let r1 = selectedCell.row, cIdx1 = columns.findIndex(c => c.id === selectedCell.colId)
                let r2 = selectedCell.row, cIdx2 = cIdx1

                if (selectionRange) {
                    r1 = Math.min(selectionRange.startRow, selectionRange.endRow)
                    r2 = Math.max(selectionRange.startRow, selectionRange.endRow)
                    cIdx1 = Math.min(selectionRange.startColIndex, selectionRange.endColIndex)
                    cIdx2 = Math.max(selectionRange.startColIndex, selectionRange.endColIndex)
                }

                setData(prev => {
                    pushHistory(prev)
                    const newData = { ...prev }
                    for (let r = r1; r <= r2; r++) {
                        for (let c = cIdx1; c <= cIdx2; c++) {
                            const colId = columns[c].id
                            const key = getCellKey(r, colId)
                            const cell = newData[key] || createInitialCell(r, colId)
                            // Reset value based on type
                            const isImg = colId === 'images'
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
                setSelectedCell({ row: nextRow, colId: selectedCell.colId })
                setSelectionRange(null)
            } else if (e.key === 'Tab') {
                e.preventDefault()
                const currIdx = columns.findIndex(c => c.id === selectedCell.colId)
                const nextIdx = Math.min(columns.length - 1, currIdx + 1)
                setSelectedCell({ row: selectedCell.row, colId: columns[nextIdx].id })
                setSelectionRange(null)
            } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault()
                let { row, colId } = selectedCell
                let colIdx = columns.findIndex(c => c.id === colId)

                if (e.key === 'ArrowUp') row = Math.max(0, row - 1)
                if (e.key === 'ArrowDown') row = Math.min(numRows - 1, row + 1)
                if (e.key === 'ArrowLeft') colIdx = Math.max(0, colIdx - 1)
                if (e.key === 'ArrowRight') colIdx = Math.min(columns.length - 1, colIdx + 1)

                const newColId = columns[colIdx].id

                if (e.shiftKey) {
                    const startIdx = selectionRange ? selectionRange.startColIndex : columns.findIndex(c => c.id === selectedCell.colId)
                    const startR = selectionRange ? selectionRange.startRow : selectedCell.row
                    
                    setSelectionRange({
                        startRow: startR,
                        startColIndex: startIdx,
                        endRow: row,
                        endColIndex: colIdx
                    })
                } else {
                    setSelectedCell({ row, colId: newColId })
                    setSelectionRange(null)
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [editingHeader, isDeviceManagerOpen, previewImage, updateCell, numRows, pushHistory]) // Reduced deps

    // -- Clipboard: Copy/Paste --
    useEffect(() => {
        const handleCopy = (e) => {
            const { editingCell, selectedCell, selectionRange, columns } = stateRef.current
            
            if (editingCell || editingHeader) return
            if (!selectedCell) return

            // Determine range
            let r1 = selectedCell.row, cIdx1 = columns.findIndex(c => c.id === selectedCell.colId)
            let r2 = selectedCell.row, cIdx2 = cIdx1

            if (selectionRange) {
                r1 = Math.min(selectionRange.startRow, selectionRange.endRow)
                r2 = Math.max(selectionRange.startRow, selectionRange.endRow)
                cIdx1 = Math.min(selectionRange.startColIndex, selectionRange.endColIndex)
                cIdx2 = Math.max(selectionRange.startColIndex, selectionRange.endColIndex)
            }

            // Build TSV string
            let text = ''
            for (let r = r1; r <= r2; r++) {
                const rowVals = []
                for (let c = cIdx1; c <= cIdx2; c++) {
                    const colId = columns[c].id
                    const cell = dataRef.current[getCellKey(r, colId)]
                    let val = cell ? cell.rawValue : ''
                    
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
            const { editingCell, selectedCell, columns } = stateRef.current
            
            if (editingCell || editingHeader) return
            if (!selectedCell) return
            e.preventDefault()

            const text = e.clipboardData.getData('text/plain')
            if (!text) return

            const rows = text.split(/\r\n|\n|\r/)
            if (rows.length === 0) return

            const startRow = selectedCell.row
            const startColIdx = columns.findIndex(c => c.id === selectedCell.colId)

            let maxRowOffset = 0
            let maxColOffset = 0

            setData(prev => {
                pushHistory(prev)
                const newData = { ...prev }

                rows.forEach((rowStr, i) => {
                    const r = startRow + i
                    if (r >= numRows) return
                    if (i > maxRowOffset) maxRowOffset = i
                    
                    const cellValues = rowStr.split('\t')
                    cellValues.forEach((val, j) => {
                        const cIdx = startColIdx + j
                        if (cIdx >= columns.length) return
                        if (j > maxColOffset) maxColOffset = j
                        
                        const colId = columns[cIdx].id
                        const key = getCellKey(r, colId)
                        const cell = newData[key] || createInitialCell(r, colId)

                        if (colId === 'images') {
                            try {
                                const parsed = JSON.parse(val)
                                if (Array.isArray(parsed)) {
                                    newData[key] = { ...cell, rawValue: parsed, displayValue: parsed, type: 'image' }
                                    return
                                }
                            } catch (err) {}
                            
                            if (typeof val === 'string' && (val.startsWith('data:image') || val.startsWith('http'))) {
                                const newArr = [val]
                                newData[key] = { ...cell, rawValue: newArr, displayValue: newArr, type: 'image' }
                            }
                        } else {
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

            setSelectionRange({
                startRow: startRow,
                startColIndex: startColIdx,
                endRow: Math.min(numRows - 1, startRow + maxRowOffset),
                endColIndex: Math.min(columns.length - 1, startColIdx + maxColOffset)
            })
        }

        document.addEventListener('copy', handleCopy)
        document.addEventListener('paste', handlePaste)
        return () => {
            document.removeEventListener('copy', handleCopy)
            document.removeEventListener('paste', handlePaste)
        }
    }, [editingHeader, numRows, pushHistory]) // Reduced deps

    // -- Mouse Interactions --
    const handleCellClick = useCallback((row, colId, e) => {
        const { editingCell, selectedCell, columns } = stateRef.current
        
        if (editingCell?.row !== row || editingCell?.colId !== colId) setEditingCell(null)
        
        if (e.shiftKey && selectedCell) {
            const colIdx = columns.findIndex(c => c.id === colId)
            const startColIdx = columns.findIndex(c => c.id === selectedCell.colId)
            setSelectionRange({
                startRow: selectedCell.row,
                startColIndex: startColIdx,
                endRow: row,
                endColIndex: colIdx
            })
        } else {
            setSelectedCell({ row, colId })
            setSelectionRange(null)
        }
    }, [])

    const handleCellDoubleClick = useCallback((row, colId) => {
        if (colId === 'images') return
        setEditingCell({ row, colId })
    }, [])

    const handleCellMouseDown = useCallback((row, colId, e) => {
        if (e.button !== 0) return
        if (e.target.closest('.remove-image-btn')) return

        const { columns } = stateRef.current
        const colIdx = columns.findIndex(c => c.id === colId)

        isSelectingRef.current = true
        setSelectedCell({ row, colId })
        // CRITICAL FIX: Do NOT call setEditingCell(null) here.
        // Let the blur event on the input handle the save and close sequence naturally.
        // Calling it here unmounts the input before it can save the data.
        
        setSelectionRange({
            startRow: row,
            startColIndex: colIdx,
            endRow: row,
            endColIndex: colIdx
        })
    }, [])

    const handleCellMouseEnter = useCallback((row, colId) => {
        // Use refs for immediate state access
        const isSelecting = isSelectingRef.current
        const isFilling = isFillingRef.current
        const { columns } = stateRef.current
        
        if (isSelecting || isFilling) {
            const colIdx = columns.findIndex(c => c.id === colId)
            setSelectionRange(prev => {
                if (!prev) return null
                return { ...prev, endRow: row, endColIndex: colIdx }
            })
        }
    }, [])

    useEffect(() => {
        const handleMouseUp = () => {
            const isFilling = isFillingRef.current
            const { fillStartCell, selectionRange, data, columns } = stateRef.current
            
            if (isFilling && fillStartCell && selectionRange) {
                const sourceCell = data[getCellKey(fillStartCell.row, fillStartCell.colId)]
                const sourceValue = sourceCell?.rawValue
                
                const hasValue = Array.isArray(sourceValue) ? sourceValue.length > 0 : (sourceValue !== '' && sourceValue !== null && sourceValue !== undefined)

                if (hasValue) {
                    setData(prev => {
                        pushHistory(prev)
                        const newData = { ...prev }
                        const { startRow, endRow, startColIndex, endColIndex } = selectionRange
                        const minR = Math.min(startRow, endRow), maxR = Math.max(startRow, endRow)
                        const minC = Math.min(startColIndex, endColIndex), maxC = Math.max(startColIndex, endColIndex)

                        for (let r = minR; r <= maxR; r++) {
                            for (let c = minC; c <= maxC; c++) {
                                const colId = columns[c].id
                                const key = getCellKey(r, colId)
                                const cell = newData[key] || createInitialCell(r, colId)
                                
                                let newType = cell.type
                                if (colId === 'images') newType = 'image'
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
            
            isSelectingRef.current = false
            isFillingRef.current = false
            setFillStartCell(null)
        }
        window.addEventListener('mouseup', handleMouseUp)
        return () => window.removeEventListener('mouseup', handleMouseUp)
    }, [pushHistory])

    // -- Column Resize --
    const handleResizeStart = useCallback((colId, e) => {
        e.preventDefault()
        e.stopPropagation()
        setResizingCol(colId)
        setResizeStartX(e.clientX)
        setResizeStartWidth(columnWidths[colId] || DEFAULT_COL_WIDTH)
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
    const handleImageRemove = useCallback((row, colId, index) => {
        setData(prev => {
            // Note: We use functional update here so we don't need 'data' dependency
            // but we need pushHistory which is stable
            pushHistory(prev)
            const key = getCellKey(row, colId)
            const cell = prev[key]
            const images = [...(cell.rawValue || [])]
            images.splice(index, 1)
            return { ...prev, [key]: { ...cell, rawValue: images, displayValue: images } }
        })
    }, [pushHistory])

    const handleFillHandleMouseDown = useCallback((row, colId, e) => {
        e.preventDefault()
        const { columns } = stateRef.current
        const colIdx = columns.findIndex(c => c.id === colId)
        
        isFillingRef.current = true
        setFillStartCell({ row, colId })
        setSelectionRange({ startRow: row, startColIndex: colIdx, endRow: row, endColIndex: colIdx })
    }, [])

    const handleRowHeaderClick = useCallback((row) => {
        setSelectedCell({ row: row, colId: columns[0].id })
        setSelectionRange({ startRow: row, startColIndex: 0, endRow: row, endColIndex: columns.length - 1 })
    }, [columns])

    // -- Render --
    const gridTemplateColumns = useMemo(() => {
        const colWidths = columns.map(c => `${columnWidths[c.id] || DEFAULT_COL_WIDTH}px`).join(' ')
        return `${ROW_HEADER_WIDTH}px ${colWidths}`
    }, [columns, columnWidths])

    const rows = useMemo(() => {
        const result = []
        for (let r = 0; r < numRows; r++) {
            const isRowSelected = selectedCell?.row === r
            const selectedColId = isRowSelected ? selectedCell.colId : null
            
            const isRowEditing = editingCell?.row === r
            const editingColId = isRowEditing ? editingCell.colId : null

            let rangeSelection = null
            if (selectionRange) {
                 const { startRow, endRow, startColIndex, endColIndex } = selectionRange
                 const minR = Math.min(startRow, endRow)
                 const maxR = Math.max(startRow, endRow)
                 
                 if (r >= minR && r <= maxR) {
                     rangeSelection = {
                        minC: Math.min(startColIndex, endColIndex),
                        maxC: Math.max(startColIndex, endColIndex)
                     }
                 }
            }

            result.push(
                <Row
                    key={r}
                    row={r}
                    columns={columns}
                    data={data}
                    columnWidths={columnWidths}
                    selectedColId={selectedColId}
                    editingColId={editingColId}
                    rangeSelection={rangeSelection}
                    onCellClick={handleCellClick}
                    onCellDoubleClick={handleCellDoubleClick}
                    onCellChange={updateCell}
                    onCellMouseDown={handleCellMouseDown}
                    onCellMouseEnter={handleCellMouseEnter}
                    onImageRemove={handleImageRemove}
                    onImagePreview={setPreviewImage}
                    onFillHandleMouseDown={handleFillHandleMouseDown}
                    onHeaderClick={handleRowHeaderClick}
                />
            )
        }
        return result
    }, [numRows, data, selectedCell, editingCell, selectionRange, columnWidths, columns, handleCellClick, handleCellDoubleClick, updateCell, handleCellMouseDown, handleCellMouseEnter, handleImageRemove, handleFillHandleMouseDown, handleRowHeaderClick])

    return (
        <div className="flex-1 overflow-auto bg-bg-primary relative scrollbar-thin scrollbar-thumb-border-color scrollbar-track-transparent" ref={containerRef}>
            <div className="grid relative" style={{ gridTemplateColumns }}>
                {/* Header Row */}
                <div className="contents">
                    {/* Top Left Corner */}
                    <div className="border-r border-b border-border-color px-0.5 text-[10px] h-10 flex items-center bg-bg-secondary font-semibold justify-center text-text-secondary cursor-default select-none"
                        style={{ position: 'sticky', top: 0, left: 0, zIndex: 40 }}
                    ></div>
                    
                    {/* Column Headers */}
                    {columns.map((col, i) => {
                        const stickyHeaderStyle = {
                            position: 'sticky',
                            top: 0,
                            zIndex: 30,
                        }

                        if (col.id === 'images') {
                            stickyHeaderStyle.left = `${ROW_HEADER_WIDTH}px`;
                            stickyHeaderStyle.zIndex = 40;
                        }

                        return (
                            <div key={col.id} 
                                className="border-r border-b border-border-color px-2 text-[11px] h-10 flex items-center bg-bg-secondary font-semibold text-text-secondary cursor-default select-none group relative justify-between"
                                style={stickyHeaderStyle}
                            >
                                {editingHeader?.colId === col.id ? (
                                    <input 
                                        autoFocus
                                        className="bg-white border border-blue-500 rounded px-1 py-0.5 text-[11px] w-full outline-none"
                                        defaultValue={col.name}
                                        onBlur={(e) => handleRenameColumn(col.id, e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRenameColumn(col.id, e.currentTarget.value)
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div 
                                        className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                                        onDoubleClick={() => !col.locked && setEditingHeader({ colId: col.id })}
                                    >
                                        {col.name}
                                    </div>
                                )}

                                {!col.locked && (
                                    <button 
                                        className="opacity-0 group-hover:opacity-100 ml-1 hover:text-red-500 transition-opacity p-1"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleRemoveColumn(col.id)
                                        }}
                                        title="Delete Column"
                                    >
                                        &times;
                                    </button>
                                )}

                                {/* Add Button on Last Column */}
                                {i === columns.length - 1 && (
                                    <button
                                        className="absolute -right-10 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-border-color text-text-primary rounded-full flex items-center justify-center shadow-sm hover:bg-bg-secondary transition-all z-50 cursor-pointer text-sm"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleAddColumn()
                                        }}
                                        title="Add Column"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M8 3v10M3 8h10" />
                                        </svg>
                                    </button>
                                )}

                                <div
                                    className={`absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize z-50 ${resizingCol === col.id ? 'bg-accent-color' : 'hover:bg-accent-color'}`}
                                    onMouseDown={(e) => handleResizeStart(col.id, e)}
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
