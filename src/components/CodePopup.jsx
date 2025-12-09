import { memo } from 'react'

const CodePopup = memo(function CodePopup({
    code,
    onClose,
    connections,
    onAssign,
    currentCell
}) {
    const copyCode = () => {
        navigator.clipboard.writeText(code)
    }

    return (
        <div className="code-popup-overlay" onClick={onClose}>
            <div className="code-popup" onClick={e => e.stopPropagation()}>
                <div className="popup-header">
                    <h3>Pair Device</h3>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="code-display">
                    <div className="code-box">{code}</div>
                    <button className="icon-btn" onClick={copyCode} title="Copy Code">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                    </button>
                </div>

                <div className="devices-list">
                    <h4>Connected Devices ({connections.length})</h4>
                    {connections.length === 0 ? (
                        <div className="empty-state">No devices connected</div>
                    ) : (
                        <ul>
                            {connections.map((conn, i) => (
                                <li key={i} className="device-item">
                                    <span className="device-name">Device {i + 1}</span>
                                    <button
                                        className="assign-btn"
                                        onClick={() => onAssign(conn.peer)}
                                    >
                                        Assign to this cell
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="popup-footer">
                    <p>
                        1. Open this app on another device<br />
                        2. Select "Receiver Mode"<br />
                        3. Enter the code above
                    </p>
                </div>
            </div>

            <style>{`
        .code-popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .code-popup {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 20px;
          width: 320px;
          box-shadow: var(--shadow-md);
          color: var(--text-primary);
        }
        .popup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .popup-header h3 {
          margin: 0;
          font-size: 16px;
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: var(--text-secondary);
        }
        .code-display {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .code-box {
          flex: 1;
          background: var(--bg-secondary);
          padding: 12px;
          border-radius: 8px;
          font-family: monospace;
          font-size: 24px;
          text-align: center;
          letter-spacing: 2px;
          border: 1px solid var(--border-color);
          color: var(--text-primary);
        }
        .icon-btn {
          padding: 0 12px;
          background: var(--bg-header);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon-btn svg {
          width: 20px;
          height: 20px;
          color: var(--text-primary);
        }
        .devices-list h4 {
          font-size: 12px;
          color: var(--text-secondary);
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .device-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px;
          background: var(--bg-cell);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          margin-bottom: 8px;
        }
        .assign-btn {
          background: var(--text-header);
          color: var(--bg-primary);
          border: none;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
        }
        .empty-state {
          text-align: center;
          color: var(--text-secondary);
          padding: 20px;
          font-size: 13px;
        }
        .popup-footer {
          margin-top: 10px;
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.6;
        }
      `}</style>
        </div>
    )
})

export default CodePopup
