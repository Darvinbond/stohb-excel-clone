import { useRef, useEffect, memo } from 'react'

const Cell = memo(function Cell({
    row,
    col,
    value,
    displayValue,
    type,
    isSelected,
    isEditing,
    inRange,
    cellWidth,
    onClick,
    onDoubleClick,
    onChange,
    onMouseDown,
    onMouseEnter,
    onImageRemove,
    onPairRequest,
    onImagePreview
}) {
    const inputRef = useRef(null)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            // Cursor at end depends on interaction
            // If type-to-overwrite, value is 1 char so cursor at end is natural
            // If double-click, we want cursor at end? Logic is usually browser default or explicit selection
            // We set value in SpreadSheet logic, so here we just focus
        }
    }, [isEditing])

    const className = `cell 
        ${isSelected ? 'selected' : ''} 
        ${isEditing ? 'editing' : ''} 
        ${inRange ? 'in-range' : ''}
        ${type === 'image' ? 'image-type' : ''}
    `.replace(/\s+/g, ' ')

    const style = {
        width: cellWidth,
    }

    if (isEditing && type !== 'image') {
        return (
            <div className={className} style={style}>
                <input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => onChange(row, col, e.target.value)}
                    onBlur={() => onClick(-1, -1)} // Hacky way to stop editing, or parent handles blur?
                    // Parent handles blur actually via click away, but we need to capture Keys
                    onKeyDown={(e) => e.stopPropagation()} // Stop Spreadsheet global listener
                />
            </div>
        )
    }

    // Image Cell
    if (type === 'image') {
        const images = Array.isArray(value) ? value : []
        return (
            <div
                className={className}
                style={style}
                onClick={(e) => onClick(row, col, e)}
                onMouseDown={(e) => onMouseDown(row, col, e)}
                onMouseEnter={() => onMouseEnter(row, col)}
            >
                <div className="image-cell-content">
                    {images.length > 0 ? (
                        <div className="image-grid">
                            {images.map((img, i) => (
                                <div key={i} className="thumbnail-wrapper" onClick={(e) => {
                                    e.stopPropagation()
                                    onImagePreview(img)
                                }}>
                                    <img src={img} alt="" className="thumbnail" />
                                    {isSelected && (
                                        <button
                                            className="remove-image-btn"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onImageRemove(row, col, i)
                                            }}
                                        >
                                            &times;
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        isSelected && (
                            <button
                                className="pair-btn" // Class for ignoring in selection logic
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onPairRequest(row, col)
                                }}
                                style={{
                                    border: 'none', background: 'black', color: 'white',
                                    borderRadius: '50%', width: '16px', height: '16px',
                                    fontSize: '12px', cursor: 'pointer', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center'
                                }}
                            >
                                +
                            </button>
                        )
                    )}
                </div>
            </div>
        )
    }

    // Text Cell
    return (
        <div
            className={className}
            style={style}
            onClick={(e) => onClick(row, col, e)}
            onDoubleClick={() => onDoubleClick(row, col)}
            onMouseDown={(e) => onMouseDown(row, col, e)}
            onMouseEnter={() => onMouseEnter(row, col)}
        >
            <div className="cell-content">
                {displayValue}
            </div>
            {/* Fill handle if selected */}
            {isSelected && !inRange && <div className="fill-handle" style={{
                position: 'absolute', bottom: '-3px', right: '-3px', width: '6px', height: '6px',
                background: 'black', cursor: 'crosshair', zIndex: 30
            }} />}
        </div>
    )
})

export default Cell
