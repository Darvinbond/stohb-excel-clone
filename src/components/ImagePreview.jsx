import { memo } from 'react'

const ImagePreview = memo(function ImagePreview({ src, onClose }) {
    if (!src) return null

    return (
        <div className="preview-overlay" onClick={onClose}>
            <div className="preview-container">
                <img src={src} alt="Preview" className="preview-image" />
                <button className="close-preview" onClick={onClose}>&times;</button>
            </div>
            <style>{`
        .preview-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.85);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.15s ease-out;
        }
        .preview-container {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
        }
        .preview-image {
          max-width: 100%;
          max-height: 90vh;
          border-radius: 4px;
          box-shadow: 0 12px 24px rgba(0,0,0,0.4);
        }
        .close-preview {
          position: absolute;
          top: -40px;
          right: -40px;
          background: none;
          border: none;
          color: white;
          font-size: 32px;
          cursor: pointer;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
        </div>
    )
})

export default ImagePreview
