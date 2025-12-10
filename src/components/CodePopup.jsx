import { memo } from 'react'

const CodePopup = memo(function CodePopup({ code, onClose, onAssign, currentCell, connectedDevices = [] }) {
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={e => e.stopPropagation()}>
        <div className="popup-header">
          <h3>📱 Pair Device</h3>
          <button className="icon-close" onClick={onClose}>&times;</button>
        </div>

        <div className="steps-container">
          <div className="step">
            <span className="step-num">1</span>
            <span>Open app on Phone</span>
          </div>
          <div className="step">
            <span className="step-num">2</span>
            <span>Enter this code:</span>
          </div>
        </div>

        <div className="code-display">
          {code || <span className="loading-dots">...</span>}
        </div>

        {connectedDevices.length > 0 ? (
          <div className="connected-section">
            <div className="connected-header">
              <span className="pulse-dot"></span>
              <span>Device Found!</span>
            </div>
            {connectedDevices.map((id, i) => (
              <div key={i} className="device-item">
                <span>📱 Device {id.substring(0, 4)}</span>
                <button className="assign-btn" onClick={() => onAssign(id)}>Connect</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="waiting-status">
            <div className="spinner-small"></div>
            Listening for connection...
          </div>
        )}

        <button className="close-btn" onClick={onClose}>Cancel</button>
      </div>

      <style>{`
        .popup-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        .popup-content {
          background: white;
          padding: 24px;
          border-radius: 20px;
          width: 90%;
          max-width: 360px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          text-align: center;
          font-family: -apple-system, sans-serif;
        }
        
        .popup-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .popup-header h3 { margin: 0; font-size: 20px; font-weight: 700; }
        .icon-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; }
        
        .steps-container { display: flex; justify-content: center; gap: 20px; margin-bottom: 16px; color: #666; font-size: 14px; }
        .step { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .step-num { background: #eee; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; }
        
        .code-display {
          font-size: 42px;
          font-weight: 800;
          letter-spacing: 4px;
          margin: 10px 0 24px;
          font-family: 'SF Mono', monospace;
          color: #111;
          background: #f3f4f6;
          padding: 16px;
          border-radius: 12px;
          user-select: all;
          border: 2px dashed #ddd;
        }
        
        .waiting-status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            color: #666;
            margin-bottom: 20px;
            font-size: 14px;
        }
        .spinner-small { width: 16px; height: 16px; border: 2px solid #ddd; border-top-color: #666; border-radius: 50%; animation: spin 1s infinite linear; }
        
        .connected-section { background: #ecfdf5; padding: 16px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #a7f3d0; }
        .connected-header { display: flex; align-items: center; gap: 8px; color: #059669; font-weight: bold; margin-bottom: 12px; justify-content: center; }
        .pulse-dot { width: 8px; height: 8px; background: #059669; border-radius: 50%; animation: pulse 1.5s infinite; }
        .device-item { display: flex; justify-content: space-between; align-items: center; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .assign-btn { background: #10b981; color: white; border: none; padding: 6px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; }
        
        .close-btn { width: 100%; padding: 14px; background: #f3f4f6; color: #4b5563; border: none; border-radius: 12px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .close-btn:hover { background: #e5e7eb; }
      `}</style>
    </div>
  )
})

export default CodePopup
