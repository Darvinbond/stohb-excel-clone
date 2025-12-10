import { memo } from 'react'
import Cell from './Cell'

const EMPTY_ARRAY = []
const EMPTY_OBJ = {}
const IMAGE_STICKY_STYLE = {
    position: 'sticky',
    left: '32px', // ROW_HEADER_WIDTH
    zIndex: 20,
    backgroundColor: 'var(--bg-primary)'
}
const ROW_HEADER_STYLE = {
    position: 'sticky',
    left: 0,
    zIndex: 20
}

function createInitialCell(row, colId, type = 'text') {
    if (type === 'image') return { rawValue: EMPTY_ARRAY, displayValue: EMPTY_ARRAY, type: 'image', style: EMPTY_OBJ }
    return { rawValue: '', displayValue: '', type: 'text', style: EMPTY_OBJ }
}

const Row = memo(function Row({
    row,
    columns,
    data,
    columnWidths,
    selectedColId,
    editingColId,
    rangeSelection, // { minC, maxC } or null
    onCellClick,
    onCellDoubleClick,
    onCellChange,
    onCellMouseDown,
    onCellMouseEnter,
    onImageRemove,
    onImagePreview,
    onFillHandleMouseDown,
    onHeaderClick
}) {
    const isActiveRow = selectedColId !== null

    // Determine if any cell in this row is in the selection range
    // rangeSelection is { minC, maxC } relative to column indices
    
    return (
        <div className="contents">
            {/* Row Header */}
            <div
                className={`justify-center text-text-secondary border-r border-border-color cursor-default w-8 border-b px-0.5 text-[10px] flex items-center select-none h-full min-h-[20px] ${isActiveRow ? 'bg-blue-50 text-blue-600 font-semibold' : 'bg-bg-secondary'}`}
                style={ROW_HEADER_STYLE}
                onClick={() => onHeaderClick(row)}
            >
                {row + 1}
            </div>

            {/* Cells */}
            {columns.map((col, cIdx) => {
                const key = `${row}-${col.id}`
                const cell = data[key] || createInitialCell(row, col.id, col.type)
                
                const isSelected = selectedColId === col.id
                const isEditing = editingColId === col.id
                
                let inRange = false
                if (rangeSelection) {
                    inRange = cIdx >= rangeSelection.minC && cIdx <= rangeSelection.maxC
                }

                const cellWidth = columnWidths[col.id] || 100 // DEFAULT_COL_WIDTH
                const stickyStyle = col.id === 'images' ? IMAGE_STICKY_STYLE : EMPTY_OBJ

                return (
                    <Cell
                        key={key}
                        row={row}
                        col={col.id}
                        value={cell.rawValue}
                        displayValue={cell.displayValue}
                        type={col.type}
                        isSelected={isSelected}
                        isEditing={isEditing}
                        inRange={inRange}
                        cellWidth={cellWidth}
                        onClick={onCellClick}
                        onDoubleClick={onCellDoubleClick}
                        onChange={onCellChange}
                        onMouseDown={onCellMouseDown}
                        onMouseEnter={onCellMouseEnter}
                        onImageRemove={onImageRemove}
                        onImagePreview={onImagePreview}
                        onFillHandleMouseDown={onFillHandleMouseDown}
                        style={stickyStyle}
                    />
                )
            })}
        </div>
    )
})

export default Row