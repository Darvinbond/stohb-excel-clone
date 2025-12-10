import { memo } from 'react'

const CodePopup = memo(function CodePopup({ code, onClose, onAssign, currentCell, connectedDevices = [] }) {
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={e => e.stopPropagation()}>
        <h3>📱 Pair Device</h3>

        <div className="code-display">
          {code || 'Loading...'}
        </div>

        <p className="instruction">
          Enter this code on your phone's camera app
        </p>

        {currentCell && (
          <div className="cell-info">
            📍 Target: Row {currentCell.row + 1}, Images Column
          </div>
        )}

        {connectedDevices.length > 0 ? (
          <div className="connected-section">
            <p className="connected-label">✅ Connected Devices:</p>
            {connectedDevices.map((id, i) => (
              <div key={i} className="device-item">
                <span>📱 {id}</span>
                <button onClick={() => onAssign(id)}>Assign</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="status-indicator">
            <span className="dot"></span> Waiting for device...
          </div>
        )}

        <button className="close-btn" onClick={onClose}>Close</button>
      </div>

      <style>{`
        .popup-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        .popup-content {
          background: var(--bg-primary, white);
          padding: 32px;
          border-radius: 16px;
          width: 90%;
          max-width: 400px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          border: 1px solid var(--border-color, #ddd);
        }
        h3 { margin: 0 0 24px 0; font-size: 24px; }
        .code-display {
          font-size: 48px;
          font-weight: 800;
          letter-spacing: 6px;
          margin: 24px 0;
          font-family: 'SF Mono', 'Monaco', monospace;
          color: var(--text-primary, #000);
          background: var(--bg-secondary, #f5f5f5);
          padding: 20px;
          border-radius: 12px;
          user-select: all;
        }
        .instruction {
          color: var(--text-secondary, #666);
          margin-bottom: 16px;
        }
        .cell-info {
            background: #e0f2fe;
            color: #0369a1;
            padding: 10px 16px;
            border-radius: 8px;
            margin-bottom: 16px;
            font-weight: 500;
        }
        .connected-section {
            background: #dcfce7;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 24px;
        }
        .connected-label {
            margin: 0 0 12px 0;
            color: #166534;
            font-weight: 600;
        }
        .device-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px;
            background: white;
            border-radius: 6px;
            margin-top: 8px;
        }
        .device-item button {
            background: #22c55e;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
        }
        .status-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            color: #f59e0b;
            margin-bottom: 24px;
            font-weight: 500;
        }
        .dot {
            width: 10px; height: 10px; background: #f59e0b; border-radius: 50%;
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }
        .close-btn {
          width: 100%;
          padding: 14px;
          background: var(--text-primary, #000);
          color: var(--bg-primary, white);
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
})

export default CodePopup
