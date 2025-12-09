import { memo, useRef, useEffect, useState } from 'react'

const Cell = memo(function Cell({
    row,
    col,
    value,
    type, // "text", "number", "formula", "image"
    isSelected,
    isEditing,
    inRange,
    hideOverflow,
    cellWidth,
    onClick,
    onDoubleClick,
    onChange,
    onBlur,
    onFillStart,
    onMouseDown,
    onMouseEnter,
    onImageRemove,
    onImagePreview,
    onPairRequest
}) {
    const inputRef = useRef(null)
    const contentRef = useRef(null)
    const [hasOverflow, setHasOverflow] = useState(false)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            // Only select all if it's the first focus or specific action? 
            // Standard Excel: F2 -> cursor at end. Double click -> select word/all. Typing -> replace.
            // Here we just focus.
        }
    }, [isEditing])

    // Check if content overflows the cell (only for text cells)
    useEffect(() => {
        if ((type === 'text' || type === 'formula') && contentRef.current && value && !isEditing) {
            const scrollWidth = contentRef.current.scrollWidth
            const clientWidth = cellWidth - 20
            setHasOverflow(scrollWidth > clientWidth)
        } else {
            setHasOverflow(false)
        }
    }, [value, cellWidth, isEditing, type])

    const handleClick = (e) => {
        onClick(row, col, e)
    }

    const handleDoubleClick = (e) => {
        e.stopPropagation()
        onDoubleClick(row, col)
    }

    const handleChange = (e) => {
        onChange(row, col, e.target.value)
    }

    const handleBlur = () => {
        onBlur()
    }

    const handleFillMouseDown = (e) => {
        onFillStart(row, col, e)
    }

    const handleMouseDown = (e) => {
        if (onMouseDown) {
            onMouseDown(row, col, e)
        }
    }

    const handleMouseEnter = () => {
        if (onMouseEnter) {
            onMouseEnter(row, col)
        }
    }

    const handleRemoveImage = (e, index) => {
        e.stopPropagation()
        onImageRemove(row, col, index)
    }

    const handleThumbnailClick = (e, img) => {
        e.stopPropagation()
        onImagePreview(img)
    }

    const handlePairClick = (e) => {
        e.stopPropagation()
        onPairRequest(row, col)
    }

    const className = [
        'cell',
        isSelected && 'selected',
        inRange && 'in-range',
        hideOverflow && 'hide-overflow',
        type === 'number' && 'is-number'
    ].filter(Boolean).join(' ')

    const contentClassName = [
        'cell-content',
        hasOverflow && !hideOverflow && !isSelected && !isEditing && 'has-overflow'
    ].filter(Boolean).join(' ')

    // --- Render Image Cell ---
    if (type === 'image') {
        const images = Array.isArray(value) ? value : []

        return (
            <div
                className={className}
                data-row={row}
                data-col={col}
                onClick={handleClick}
                onMouseDown={handleMouseDown}
                onMouseEnter={handleMouseEnter}
                onDoubleClick={handleDoubleClick}
                style={{ cursor: 'pointer', padding: 0 }}
            >
                <div className="image-cell-content">
                    {images.length > 0 && (
                        <div className="image-grid">
                            {images.map((img, i) => (
                                <div key={i} className="thumbnail-wrapper" onClick={(e) => handleThumbnailClick(e, img)}>
                                    <img src={img} alt={`thumb-${i}`} className="thumbnail" />
                                    {isSelected && (
                                        <button
                                            className="remove-image-btn"
                                            onClick={(e) => handleRemoveImage(e, i)}
                                        >
                                            &times;
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {(isSelected || images.length === 0) && (
                        <button className="pair-btn" onClick={handlePairClick} title="Pair device">
                            +
                        </button>
                    )}
                </div>

                {isSelected && (
                    <div
                        className="fill-handle"
                        onMouseDown={handleFillMouseDown}
                    />
                )}

                <style>{`
          .image-cell-content {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            padding: 4px;
            gap: 4px;
            overflow-x: auto;
            overflow-y: hidden;
          }
          .image-grid {
            display: flex;
            gap: 4px;
            height: 100%;
            align-items: center;
          }
          .thumbnail-wrapper {
            position: relative;
            height: 32px;
            width: 32px;
            flex-shrink: 0;
            cursor: zoom-in;
          }
          .thumbnail {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 4px;
            border: 1px solid var(--border-color);
            transition: transform 0.1s;
          }
          .thumbnail-wrapper:hover .thumbnail {
             border-color: var(--border-selected);
          }
          .remove-image-btn {
            position: absolute;
            top: -6px;
            right: -6px;
            width: 14px;
            height: 14px;
            background: #ef4444;
            color: white;
            border: 1px solid white;
            border-radius: 50%;
            font-size: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10;
            opacity: 0;
            transition: opacity 0.2s;
          }
          .thumbnail-wrapper:hover .remove-image-btn {
            opacity: 1;
          }
          .pair-btn {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 1px dashed var(--text-secondary);
            background: transparent;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 14px;
            flex-shrink: 0;
          }
          .pair-btn:hover {
            background: var(--bg-cell-hover);
            border-color: var(--text-primary);
            color: var(--text-primary);
          }
        `}</style>
            </div>
        )
    }

    // --- Render Text Cell ---
    return (
        <div
            className={className}
            data-row={row}
            data-col={col}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
            onMouseEnter={handleMouseEnter}
        >
            {isEditing ? (
                <input
                    ref={inputRef}
                    className="cell-input"
                    type="text"
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={(e) => {
                        // Stop propagation for arrow keys if we want to allow cursor movement INSIDE input
                        // But Excel usually navigates unless F2 mode. 
                        // Here we simple: Left/Right inside input works, Up/Down might submit?
                        // For now let event bubble to Spreadsheet for Enter/Arrows unless we stop it?
                        // Actually Spreadsheet handleKeyDown is on window, so we must stopProp if we want input control.
                        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopPropagation()
                    }}
                />
            ) : (
                <div ref={contentRef} className={contentClassName}>
                    {value}
                </div>
            )}
            {isSelected && !isEditing && (
                <div
                    className="fill-handle"
                    onMouseDown={handleFillMouseDown}
                />
            )}
        </div>
    )
})

export default Cell
