import { useState, useRef, useEffect } from 'react'
import { useConnection } from '../hooks/useConnection'

const ReceiverView = () => {
    const [providerCode, setProviderCode] = useState('')
    const [step, setStep] = useState('connect')
    const [assignedCell, setAssignedCell] = useState(null)
    const [isBusy, setIsBusy] = useState(false)
    const [showHelp, setShowHelp] = useState(false)
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const connectAttemptedRef = useRef(false) // Prevent double submits

    const { peerId, connectToPeer, sendData, isConnected, connections, connectionError } = useConnection('receiver')

    // Watch for successful connection
    useEffect(() => {
        if (connections.length > 0 && step === 'connect') {
            setIsBusy(false)
            setStep('waiting')
            // Send GREET
            setTimeout(() => sendData({ type: 'GREET' }), 500)
        }
    }, [connections, step, sendData])

    // Watch for errors
    useEffect(() => {
        if (connectionError) {
            setIsBusy(false)
            connectAttemptedRef.current = false
        }
    }, [connectionError])

    const handleConnect = () => {
        if (providerCode.length >= 4 && !connectAttemptedRef.current) {
            setIsBusy(true)
            connectAttemptedRef.current = true
            connectToPeer(providerCode.toUpperCase())

            // Timeout reset
            setTimeout(() => {
                if (step === 'connect' && connections.length === 0) {
                    setIsBusy(false)
                    connectAttemptedRef.current = false
                }
            }, 8000)
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
            alert("Please allow Camera access.")
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
                <div onClick={() => setShowHelp(!showHelp)} className="help-icon">?</div>
            </div>

            {step === 'connect' && (
                <div className="connect-card">
                    {showHelp ? (
                        <div className="help-content">
                            <h3>How to Connect</h3>
                            <ol>
                                <li>Open <b>Stohb Sheet</b> on Laptop.</li>
                                <li>Click the <b>+</b> button on any Image cell.</li>
                                <li>Enter the <b>Code</b> below.</li>
                            </ol>
                            <button className="close-help-btn" onClick={() => setShowHelp(false)}>Got it</button>
                        </div>
                    ) : (
                        <>
                            <h2>Pair Device</h2>
                            <p className="subtext">Enter code from Spreadsheet</p>

                            <input
                                type="text"
                                value={providerCode}
                                onChange={(e) => setProviderCode(e.target.value.toUpperCase())}
                                placeholder="CODE"
                                maxLength={6}
                                className={`code-input ${connectionError ? 'error-border' : ''}`}
                                autoCapitalize="characters"
                                disabled={isBusy}
                            />

                            {connectionError && <p className="error-msg">⚠️ {connectionError}</p>}

                            <button
                                className={`connect-btn ${isBusy ? 'loading' : ''}`}
                                onClick={handleConnect}
                                disabled={providerCode.length < 4 || isBusy}
                            >
                                {isBusy ? 'Connecting...' : 'Connect'}
                            </button>

                            <div className="status-footer">
                                <span className={`dot ${isConnected ? 'green' : 'red'}`}></span>
                                {isConnected ? 'Server Connected' : 'Connecting to Cloud...'}
                            </div>
                        </>
                    )}
                </div>
            )}

            {step === 'waiting' && <div className="waiting-screen"><h1>Connected!</h1><div className="spinner"></div></div>}

            {step === 'camera' && (
                <div className="camera-interface">
                    <video ref={videoRef} autoPlay playsInline className="camera-feed" />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div className="camera-controls">
                        <button className="shutter-btn" onClick={takePicture} />
                    </div>
                </div>
            )}

            <style>{`
                .receiver-container { background: #0a0a0a; color: white; height: 100vh; display: flex; flex-direction: column; font-family: -apple-system, sans-serif; }
                .header { padding: 16px; display: flex; justify-content: space-between; align-items: center; background: #111; border-bottom: 1px solid #222; }
                .header h1 { margin: 0; font-size: 18px; font-weight: 700; }
                .help-icon { width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-weight: bold; cursor: pointer; }
                .connect-card { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; text-align: center; }
                .code-input { font-size: 32px; padding: 16px; width: 100%; max-width: 280px; text-align: center; text-transform: uppercase; background: #1a1a1a; border: 2px solid #333; color: white; border-radius: 16px; margin-bottom: 24px; }
                .connect-btn { width: 100%; max-width: 280px; padding: 16px; font-size: 18px; font-weight: 700; border-radius: 16px; border: none; background: white; color: black; cursor: pointer; }
                .connect-btn.loading { background: #333; color: white; }
                .camera-interface { flex: 1; position: relative; background: black; }
                .camera-feed { width: 100%; height: 100%; object-fit: cover; }
                .camera-controls { position: absolute; bottom: 40px; width: 100%; display: flex; justify-content: center; }
                .shutter-btn { width: 72px; height: 72px; border-radius: 50%; background: white; border: 4px solid rgba(0,0,0,0.1); }
                .error-msg { color: #f87171; margin-bottom: 20px; }
                 .wait-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; }
                 .spinner { width: 40px; height: 40px; border: 4px solid #333; border-top-color: white; border-radius: 50%; animation: spin 1s infinite linear; }
                 @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}

export default ReceiverView
