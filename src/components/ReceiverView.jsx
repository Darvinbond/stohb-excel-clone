import { useState, useRef, useEffect } from 'react'
import { useConnection } from '../hooks/useConnection'

const ReceiverView = () => {
    const [providerCode, setProviderCode] = useState('')
    const [step, setStep] = useState('connect')
    const [assignedCell, setAssignedCell] = useState(null)
    const videoRef = useRef(null)
    const canvasRef = useRef(null)

    const { peerId, sendData, isConnected } = useConnection('receiver')

    // On connect (valid code entered)
    const handleConnect = () => {
        if (providerCode.length >= 6) {
            setStep('waiting')
            // Send GREET to trigger assignment
            sendData({ type: 'GREET' }, providerCode)
        }
    }

    // Listen for assignments
    useEffect(() => {
        const handleData = (event) => {
            const { type, payload } = event.detail.data || {}
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
            // Error handling already covered by HTTPS
        }
    }

    const takePicture = () => {
        if (!videoRef.current || !canvasRef.current) return
        const video = videoRef.current
        const canvas = canvasRef.current

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
        const imageData = canvas.toDataURL('image/jpeg', 0.6)

        // Send to provider
        sendData({
            type: 'IMAGE_DATA',
            payload: {
                row: assignedCell.row,
                col: assignedCell.col,
                image: imageData
            }
        }, providerCode)

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
                    {isConnected ? 'Online' : 'Offline'}
                </div>
            </div>

            {step === 'connect' && (
                <div className="connect-card">
                    <h2>Pair Device</h2>
                    <input
                        type="text"
                        value={providerCode}
                        onChange={(e) => setProviderCode(e.target.value.toUpperCase())}
                        placeholder="ENTER CODE"
                        maxLength={6}
                        className="code-input"
                    />
                    <button
                        className="connect-btn"
                        onClick={handleConnect}
                        disabled={providerCode.length < 6}
                    >
                        Connect
                    </button>
                    <p className="hint">Ensure Code matches Spreadsheet</p>
                </div>
            )}

            {step === 'waiting' && (
                <div className="waiting-screen">
                    <div className="pulse-ring"></div>
                    <h2>Connected</h2>
                    <p>Waiting for assignment...</p>
                </div>
            )}

            {step === 'camera' && (
                <div className="camera-interface">
                    <video ref={videoRef} autoPlay playsInline className="camera-feed" />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div className="camera-controls">
                        <button className="shutter-btn" onClick={takePicture} disabled={assignedCell?.currentCount >= 4} />
                    </div>
                </div>
            )}

            <style>{`
                .receiver-container { background: black; color: white; height: 100vh; display: flex; flex-direction: column; }
                .header { padding: 16px; display: flex; justify-content: space-between; }
                .status-badge { padding: 4px 8px; border-radius: 4px; color: black; font-weight: bold; }
                .connect-card, .waiting-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
                .code-input { font-size: 24px; padding: 12px; margin: 20px; text-align: center; text-transform: uppercase; width: 200px; }
                .connect-btn { padding: 12px 30px; font-size: 18px; background: white; border: none; border-radius: 30px; }
                .camera-interface { flex: 1; position: relative; }
                .camera-feed { width: 100%; height: 100%; object-fit: cover; }
                .camera-controls { position: absolute; bottom: 40px; width: 100%; display: flex; justify-content: center; }
                .shutter-btn { width: 70px; height: 70px; border-radius: 50%; background: white; border: 4px solid #ccc; }
                .hint { margin-top: 10px; color: #888; }
            `}</style>
        </div>
    )
}

export default ReceiverView
