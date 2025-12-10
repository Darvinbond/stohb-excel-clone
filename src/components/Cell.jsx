import { useState, useRef, useEffect, memo } from 'react'

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
    onImageDrop,
    onImagePreview,
    onFillHandleMouseDown,
    style: customStyle = {}
}) {
    const inputRef = useRef(null)
    const [inputValue, setInputValue] = useState(value)
    const [isDraggingOver, setIsDraggingOver] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)

    // Sync local state only when entering edit mode or when value changes while NOT editing
    // This prevents external prop updates (like re-renders) from overwriting local typing
    useEffect(() => {
        if (isEditing) {
            setInputValue(value)
            // Focus logic
            if (inputRef.current) {
                // We need a small timeout to allow the render to complete if switching modes
                setTimeout(() => {
                    if (inputRef.current) {
                        inputRef.current.focus()
                        const len = inputRef.current.value.length
                        inputRef.current.setSelectionRange(len, len)
                    }
                }, 0)
            }
        }
    }, [isEditing])

    let className = 'border-r border-b border-border-color px-0.5 text-[11px] flex items-center whitespace-nowrap overflow-hidden relative select-none text-text-primary cursor-cell bg-bg-primary'
    
    if (type === 'image' && value && value.length > 0) {
        className += ' h-auto min-h-[48px]'
    } else {
        className += ' min-h-[20px] h-full'
    }

    if (isSelected) {
        className += ' shadow-[inset_0_0_0_2px_var(--selection-border)] z-10 !bg-selection-color'
    }

    if (isEditing) {
        className += ' p-0 z-20 shadow-[0_0_0_2px_var(--selection-border)]'
    }

    if (inRange) {
        className += ' !bg-selection-color'
    }

    if (type === 'image') {
        className += ' p-0 justify-center'
    }

    const style = {
        width: cellWidth,
        ...customStyle
    }

    if (isEditing && type !== 'image') {
        return (
            <div className={className} style={style}>
                <input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onBlur={() => {
                        if (inputValue !== value) {
                            onChange(row, col, inputValue)
                        }
                        onClick(-1, -1)
                    }}
                    onKeyDown={(e) => {
                        e.stopPropagation()
                        if (e.key === 'Enter') {
                            if (inputValue !== value) {
                                onChange(row, col, inputValue)
                            }
                            onClick(-1, -1) // Stop editing
                        } else if (e.key === 'Escape') {
                            setInputValue(value) // Revert
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
        const bgClass = isDraggingOver ? 'bg-green-100 !bg-green-100 ring-2 ring-green-500 z-50' : ''
        
        return (
            <div
                className={`${className} ${bgClass}`}
                style={style}
                onClick={(e) => onClick(row, col, e)}
                onMouseDown={(e) => onMouseDown(row, col, e)}
                onMouseEnter={() => onMouseEnter(row, col)}
                onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!isDraggingOver) setIsDraggingOver(true)
                }}
                onDragLeave={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    // Only disable highlight if we are actually leaving the cell container,
                    // not just entering a child element (like an existing image)
                    if (e.currentTarget.contains(e.relatedTarget)) return
                    setIsDraggingOver(false)
                }}
                onDrop={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDraggingOver(false)
                    
                    if (onImageDrop) {
                        setIsProcessing(true)
                        try {
                            await onImageDrop(row, col, e)
                        } finally {
                            setIsProcessing(false)
                        }
                    }
                }}
            >
                <div className="w-full h-full flex items-center justify-start p-0.5 pointer-events-auto relative overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border-color">
                    {isProcessing ? (
                         <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-50 rounded text-white text-[9px] font-bold">
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mb-1"></div>
                            Processing...
                         </div>
                    ) : null}

                    {images.length > 0 ? (
                        <div className="flex gap-1 h-full items-center min-w-min px-1">
                            {images.map((img, i) => (
                                <div
                                    key={i}
                                    className="h-12 aspect-square relative border border-border-color rounded-md overflow-hidden group/image cursor-pointer shadow-sm hover:scale-95 transition-transform shrink-0"
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
                        isSelected && !isProcessing && <div className="w-full h-full flex items-center justify-center pointer-events-none"><span className="text-text-tertiary text-[9px] opacity-50 font-medium tracking-wide">READY</span></div>
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
                    className="absolute -bottom-[2px] -right-[2px] w-2 h-2 bg-selection-border cursor-crosshair z-30 border border-bg-primary"
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
