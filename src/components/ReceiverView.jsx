import { useState, useRef, useEffect } from 'react'
import { useConnection } from '../hooks/useConnection'

const ReceiverView = () => {
    const [providerCode, setProviderCode] = useState('')
    const [step, setStep] = useState('connect')
    const [assignedCell, setAssignedCell] = useState(null)
    const [error, setError] = useState('')
    const videoRef = useRef(null)
    const canvasRef = useRef(null)

    const { peerId, connectToPeer, sendData, isConnected, connections } = useConnection('receiver')

    // Watch for successful connection
    useEffect(() => {
        if (connections.length > 0 && step === 'connect') {
            console.log('Connection established, sending GREET')
            setStep('waiting')
            // Send GREET after connection is established
            setTimeout(() => {
                sendData({ type: 'GREET' })
            }, 500)
        }
    }, [connections, step, sendData])

    const handleConnect = () => {
        if (providerCode.length >= 4) {
            setError('')
            console.log('Attempting to connect to:', providerCode)
            connectToPeer(providerCode.toUpperCase())
        }
    }

    // Listen for assignments
    useEffect(() => {
        const handleData = (event) => {
            const { type, payload } = event.detail.data || {}
            console.log('Receiver got:', type, payload)

            if (type === 'ASSIGN_CELL') {
                setAssignedCell(payload)
                setStep('camera')
                startCamera()
            }
        }
        window.addEventListener('peer-data', handleData)
        return () => window.removeEventListener('peer-data', handleData)
    }, [])

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
            setError("Camera access denied. Please allow camera access.")
        }
    }

    const takePicture = () => {
        if (!videoRef.current || !canvasRef.current || !assignedCell) return

        const video = videoRef.current
        const canvas = canvasRef.current

        const MAX_SIZE = 800
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
        const imageData = canvas.toDataURL('image/jpeg', 0.5)

        console.log('Sending image, size:', imageData.length)

        sendData({
            type: 'IMAGE_DATA',
            payload: {
                row: assignedCell.row,
                col: assignedCell.col,
                image: imageData
            }
        })

        setAssignedCell(prev => ({
            ...prev,
            currentCount: (prev.currentCount || 0) + 1
        }))
    }

    return (
        <div className="receiver-container">
            <div className="header">
                <h1>📷 Stohb Cam</h1>
                <div className="status-badge" style={{ background: connections.length > 0 ? '#4ade80' : '#f87171' }}>
                    {connections.length > 0 ? '🟢 Connected' : '🔴 Not Connected'}
                </div>
            </div>

            {step === 'connect' && (
                <div className="connect-card">
                    <h2>Pair Device</h2>
                    <p>Enter the code from the spreadsheet</p>
                    <input
                        type="text"
                        value={providerCode}
                        onChange={(e) => setProviderCode(e.target.value.toUpperCase())}
                        placeholder="ENTER CODE"
                        maxLength={6}
                        className="code-input"
                        autoCapitalize="characters"
                    />
                    {error && <p className="error">{error}</p>}
                    <button
                        className="connect-btn"
                        onClick={handleConnect}
                        disabled={providerCode.length < 4}
                    >
                        Connect
                    </button>
                    <p className="hint">Your ID: {peerId || '...'}</p>
                </div>
            )}

            {step === 'waiting' && (
                <div className="waiting-screen">
                    <div className="spinner"></div>
                    <h2>✅ Connected!</h2>
                    <p>Waiting for cell assignment...</p>
                    <small>Click an Image cell on the spreadsheet</small>
                </div>
            )}

            {step === 'camera' && (
                <div className="camera-interface">
                    <video ref={videoRef} autoPlay playsInline className="camera-feed" />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div className="camera-overlay">
                        <div className="counter-pill">
                            📸 {assignedCell?.currentCount || 0} / 4
                        </div>
                    </div>
                    <div className="camera-controls">
                        <button
                            className="shutter-btn"
                            onClick={takePicture}
                            disabled={(assignedCell?.currentCount || 0) >= 4}
                        />
                    </div>
                </div>
            )}

            <style>{`
                .receiver-container { background: #111; color: white; height: 100vh; display: flex; flex-direction: column; font-family: -apple-system, sans-serif; }
                .header { padding: 16px; display: flex; justify-content: space-between; align-items: center; background: #1a1a1a; }
                .header h1 { margin: 0; font-size: 20px; }
                .status-badge { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
                .connect-card, .waiting-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; text-align: center; }
                .code-input { font-size: 32px; padding: 16px; margin: 24px 0; text-align: center; text-transform: uppercase; width: 240px; border-radius: 12px; border: 2px solid #333; background: #222; color: white; letter-spacing: 8px; }
                .connect-btn { padding: 16px 48px; font-size: 18px; background: white; color: black; border: none; border-radius: 30px; font-weight: bold; cursor: pointer; }
                .connect-btn:disabled { opacity: 0.5; }
                .error { color: #f87171; margin: 8px 0; }
                .hint { margin-top: 24px; color: #666; font-size: 12px; }
                .spinner { width: 48px; height: 48px; border: 4px solid #333; border-top-color: #4ade80; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 24px; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .camera-interface { flex: 1; position: relative; background: black; }
                .camera-feed { width: 100%; height: 100%; object-fit: cover; }
                .camera-overlay { position: absolute; top: 20px; right: 20px; }
                .counter-pill { background: rgba(0,0,0,0.7); padding: 8px 16px; border-radius: 20px; font-weight: bold; }
                .camera-controls { position: absolute; bottom: 40px; width: 100%; display: flex; justify-content: center; }
                .shutter-btn { width: 80px; height: 80px; border-radius: 50%; background: white; border: 6px solid rgba(255,255,255,0.3); cursor: pointer; transition: transform 0.1s; }
                .shutter-btn:active { transform: scale(0.9); }
                .shutter-btn:disabled { opacity: 0.5; }
            `}</style>
        </div>
    )
}

export default ReceiverView
