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

    const className = `
        border-r border-b border-border-color px-1 text-[13px] h-6 flex items-center bg-bg-primary
        whitespace-nowrap overflow-hidden relative select-none text-text-primary cursor-cell
        ${isSelected ? 'shadow-[inset_0_0_0_1px_var(--selection-border)] z-[5]' : ''}
        ${isEditing ? 'p-0 overflow-visible z-[20] shadow-[0_0_0_2px_var(--accent-color)]' : ''}
        ${inRange ? 'bg-selection-color' : ''}
        ${type === 'image' ? 'p-0 justify-center' : ''}
    `.trim().replace(/\s+/g, ' ')

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
                    onBlur={() => onClick(-1, -1)}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="w-full h-full border-none outline-none font-inherit text-inherit px-1 bg-bg-primary text-text-primary"
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
                <div className="w-full h-full flex items-center justify-center">
                    {images.length > 0 ? (
                        <div className="flex gap-0.5 h-full items-center">
                            {images.map((img, i) => (
                                <div
                                    key={i}
                                    className="h-[90%] aspect-square relative border border-border-color rounded-sm overflow-hidden"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onImagePreview(img)
                                    }}
                                >
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                    {isSelected && (
                                        <button
                                            className="absolute top-0 right-0 bg-black/50 text-white text-[10px] border-none px-0.5 cursor-pointer leading-none"
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
            <div className="overflow-hidden whitespace-nowrap w-full pointer-events-none">
                {displayValue}
            </div>
            {/* Fill handle if selected */}
            {isSelected && !inRange && (
                <div className="absolute -bottom-[3px] -right-[3px] w-1.5 h-1.5 bg-black cursor-crosshair z-30" />
            )}
        </div>
    )
})

export default Cell
