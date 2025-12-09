import { memo } from 'react'

const CodePopup = memo(function CodePopup({ code, onClose, onAssign, currentCell }) {
  // connections prop removed as we don't track list in socket hook easily

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={e => e.stopPropagation()}>
        <h3>Pair Device</h3>

        <div className="code-display">
          {code || '...'}
        </div>

        <p className="instruction">
          Enter this code on the "Stohb Cam" receiver device.
        </p>

        {currentCell && (
          <div className="cell-info">
            Target Cell: <strong>{currentCell.row + 1} - {currentCell.col}</strong>
          </div>
        )}

        <div className="status-indicator">
          <span className="dot"></span> Listening for connection...
        </div>

        <button className="close-btn" onClick={onClose}>Close</button>
      </div>

      <style>{`
        .popup-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        .popup-content {
          background: var(--bg-primary);
          padding: 32px;
          border-radius: 16px;
          width: 90%;
          max-width: 400px;
          text-align: center;
          box-shadow: var(--shadow-md);
          border: 1px solid var(--border-color);
        }
        .code-display {
          font-size: 48px;
          font-weight: 800;
          letter-spacing: 4px;
          margin: 24px 0;
          font-family: monospace;
          color: var(--text-primary);
          background: var(--bg-secondary);
          padding: 16px;
          border-radius: 8px;
          user-select: all;
        }
        .instruction {
          color: var(--text-secondary);
          margin-bottom: 24px;
        }
        .cell-info {
            background: var(--bg-cell-selected);
            color: var(--text-primary);
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 16px;
            display: inline-block;
        }
        .status-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            color: #4ade80;
            margin-bottom: 24px;
            font-weight: 500;
        }
        .dot {
            width: 8px; height: 8px; background: #4ade80; border-radius: 50%;
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .close-btn {
          width: 100%;
          padding: 12px;
          background: var(--text-primary);
          color: var(--bg-primary);
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
})

export default CodePopup
