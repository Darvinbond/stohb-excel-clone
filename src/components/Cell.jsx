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
    onImagePreview,
    onFillHandleMouseDown,
    style: customStyle = {}
}) {
    const inputRef = useRef(null)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            // Move cursor to end of text
            const len = inputRef.current.value.length
            inputRef.current.setSelectionRange(len, len)
        }
    }, [isEditing])

    const className = `
        border-r border-b border-border-color px-0.5 text-[11px] flex items-center
        whitespace-nowrap overflow-hidden relative select-none text-text-primary cursor-cell
        bg-bg-primary
        ${type === 'image' && value && value.length > 0 ? 'h-auto min-h-[100px]' : 'h-10'}
        ${isSelected ? 'shadow-[inset_0_0_0_2px_#0ea5e9] z-10 !bg-selection-color' : ''}
        ${isEditing ? 'p-0 z-20 shadow-[0_0_0_2px_#0ea5e9]' : ''}
        ${inRange ? '!bg-selection-color' : ''}
        ${type === 'image' ? 'p-0 justify-center' : ''}
    `.trim().replace(/\s+/g, ' ')

    const style = {
        width: cellWidth,
        ...customStyle
    }

    if (isEditing && type !== 'image') {
        return (
            <div className={className} style={style}>
                <input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => onChange(row, col, e.target.value)}
                    onBlur={() => onClick(-1, -1)}
                    onKeyDown={(e) => {
                        e.stopPropagation()
                        if (e.key === 'Enter') {
                            onClick(-1, -1) // Stop editing
                        } else if (e.key === 'Escape') {
                            onClick(-1, -1) // Cancel editing
                        }
                    }}
                    className="w-full h-full border-none outline-none px-0.5 bg-bg-primary text-text-primary text-[11px]"
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
                <div className="w-full h-full flex items-center justify-center p-0.5">
                    {images.length > 0 ? (
                        <div className="flex gap-1 h-full items-center">
                            {images.map((img, i) => (
                                <div
                                    key={i}
                                    className="h-full aspect-square relative border border-border-color rounded-md overflow-hidden group/image cursor-pointer shadow-sm hover:scale-105 transition-transform"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onImagePreview(img)
                                    }}
                                >
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                    {isSelected && (
                                        <button
                                            className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] border-none flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity z-10 rounded-bl-md"
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
                        isSelected && <span className="text-text-tertiary text-[9px] opacity-50 font-medium tracking-wide">READY</span>
                    )}
                </div>
            </div>
        )
    }

    // Text Cell
    return (
        <div
            className={className}
            style={{ ...style, maxWidth: cellWidth }}
            onClick={(e) => onClick(row, col, e)}
            onDoubleClick={() => onDoubleClick(row, col)}
            onMouseDown={(e) => onMouseDown(row, col, e)}
            onMouseEnter={() => onMouseEnter(row, col)}
        >
            <span className="block overflow-hidden text-ellipsis whitespace-nowrap w-full pointer-events-none">
                {displayValue}
            </span>
            {/* Fill handle if selected */}
            {isSelected && (
                <div
                    className="absolute -bottom-[2px] -right-[2px] w-2 h-2 bg-[#1a73e8] cursor-crosshair z-30 border border-white"
                    onMouseDown={(e) => {
                        e.stopPropagation()
                        onFillHandleMouseDown?.(row, col, e)
                    }}
                />
            )}
        </div>
    )
})

export default Cell
