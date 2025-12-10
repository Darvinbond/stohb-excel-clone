import { memo } from 'react'

const ImagePreview = memo(function ImagePreview({ src, onClose }) {
    if (!src) return null

    return (
        <div className="fixed inset-0 bg-black/85 z-[2000] flex items-center justify-center animate-[fadeIn_0.15s_ease-out]" onClick={onClose}>
            <div className="relative max-w-[90vw] max-h-[90vh]">
                <img src={src} alt="Preview" className="max-w-full max-h-[90vh] rounded shadow-[0_12px_24px_rgba(0,0,0,0.4)]" />
                <button className="absolute -top-10 -right-10 bg-transparent border-none text-white text-[32px] cursor-pointer" onClick={onClose}>&times;</button>
            </div>
        </div>
    )
})

export default ImagePreview
