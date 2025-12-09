import { useState, useRef, useEffect, useCallback } from 'react'
import { usePeer } from '../hooks/usePeer'

const ReceiverView = () => {
    const [providerCode, setProviderCode] = useState('')
    const [step, setStep] = useState('connect') // connect, waiting, camera
    const [assignedCell, setAssignedCell] = useState(null)
    const videoRef = useRef(null)
    const canvasRef = useRef(null)

    const { peerId, connectToPeer, sendData, isConnected } = usePeer('receiver')

    useEffect(() => {
        if (isConnected && step === 'connect') {
            setStep('waiting')
        }
    }, [isConnected, step])

    // Listen for assignment messages
    useEffect(() => {
        const handleData = (event) => {
            const { type, payload } = event.detail.data
            console.log('Received:', type, payload)

            if (type === 'ASSIGN_CELL') {
                setAssignedCell(payload) // { row, col, currentCount }
                setStep('camera')
                startCamera()
            } else if (type === 'UNASSIGN') {
                setAssignedCell(null)
                setStep('waiting')
                stopCamera()
            }
        }

        window.addEventListener('peer-data', handleData)
        return () => window.removeEventListener('peer-data', handleData)
    }, [])

    const handleConnect = () => {
        if (providerCode.length >= 4) {
            // Accept shorter codes if custom logic used, but simple local ID is usually random.
            // But we are using generateShortId() which is 6 chars.
            connectToPeer(providerCode.toUpperCase())
        }
    }

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            })
            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }
        } catch (err) {
            console.error("Camera error:", err)
            alert("Could not access camera.")
        }
    }

    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop())
        }
    }

    const takePicture = () => {
        if (!videoRef.current || !canvasRef.current) return

        if (assignedCell && assignedCell.currentCount >= 4) {
            alert("Maximum 4 images allowed.")
            return
        }

        const video = videoRef.current
        const canvas = canvasRef.current

        // Resize logic: Max 1024px
        const MAX_SIZE = 1024
        let width = video.videoWidth
        let height = video.videoHeight

        if (width > height) {
            if (width > MAX_SIZE) {
                height *= MAX_SIZE / width
                width = MAX_SIZE
            }
        } else {
            if (height > MAX_SIZE) {
                width *= MAX_SIZE / height
                height = MAX_SIZE
            }
        }

        canvas.width = width
        canvas.height = height

        const context = canvas.getContext('2d')
        context.drawImage(video, 0, 0, width, height)

        // Convert to base64 with moderate quality
        const imageData = canvas.toDataURL('image/jpeg', 0.6)

        // Send to provider
        sendData({
            type: 'IMAGE_DATA',
            payload: {
                row: assignedCell.row,
                col: assignedCell.col,
                image: imageData
            }
        })

        // Optimistic update
        setAssignedCell(prev => ({
            ...prev,
            currentCount: prev.currentCount + 1
        }))
    }

    return (
        <div className="receiver-container">
            <div className="header">
                <h1>Stohb Cam</h1>
                <div className="status-badge" style={{ background: isConnected ? '#4ade80' : '#f87171' }}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                </div>
            </div>

            {step === 'connect' && (
                <div className="connect-card">
                    <h2>Pair Device</h2>
                    <p>Enter the code from the spreadsheet to connect.</p>
                    <input
                        type="text"
                        value={providerCode}
                        onChange={(e) => setProviderCode(e.target.value.toUpperCase())}
                        placeholder="Ex: X7Y9Z2"
                        maxLength={6}
                        className="code-input"
                    />
                    <button
                        className="connect-btn"
                        onClick={handleConnect}
                        disabled={providerCode.length < 4}
                    >
                        Connect
                    </button>
                    <p className="hint">Ensure both devices are on the same WiFi.</p>
                </div>
            )}

            {step === 'waiting' && (
                <div className="waiting-screen">
                    <div className="pulse-ring"></div>
                    <h2>Connected!</h2>
                    <p>Waiting for assignment...</p>
                    <small>Click an "Image" cell on the spreadsheet to assign this device.</small>
                </div>
            )}

            {step === 'camera' && (
                <div className="camera-interface">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="camera-feed"
                    />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    <div className="camera-overlay">
                        <div className="counter-pill">
                            {assignedCell?.currentCount || 0} / 4
                        </div>
                    </div>

                    <div className="camera-controls">
                        <button
                            className="shutter-btn"
                            onClick={takePicture}
                            disabled={assignedCell?.currentCount >= 4}
                        />
                    </div>
                </div>
            )}

            <style>{`
        .receiver-container {
          height: 100vh;
          background: #000;
          color: white;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, sans-serif;
        }
        .header {
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 10;
        }
        .status-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          color: black;
        }
        .connect-card, .waiting-screen {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 24px;
          text-align: center;
        }
        .code-input {
          background: #333;
          border: 1px solid #444;
          color: white;
          font-size: 24px;
          padding: 12px;
          border-radius: 8px;
          text-align: center;
          letter-spacing: 4px;
          margin: 24px 0;
          width: 100%;
          max-width: 300px;
          text-transform: uppercase;
        }
        .connect-btn {
          background: white;
          color: black;
          border: none;
          padding: 12px 32px;
          border-radius: 24px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        }
        .connect-btn:disabled {
          opacity: 0.5;
        }
        .hint {
          color: #888;
          font-size: 12px;
          margin-top: 16px;
        }
        .camera-interface {
          flex: 1;
          position: relative;
          background: #000;
          overflow: hidden;
        }
        .camera-feed {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .camera-controls {
          position: absolute;
          bottom: 40px;
          left: 0;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .shutter-btn {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: white;
          border: 4px solid rgba(0,0,0,0.2);
          cursor: pointer;
          transition: transform 0.1s;
        }
        .shutter-btn:active {
          transform: scale(0.95);
        }
        .shutter-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .camera-overlay {
          position: absolute;
          top: 20px;
          right: 20px;
        }
        .counter-pill {
          background: rgba(0,0,0,0.6);
          padding: 6px 12px;
          border-radius: 16px;
          font-weight: 600;
        }
      `}</style>
        </div>
    )
}

export default ReceiverView
