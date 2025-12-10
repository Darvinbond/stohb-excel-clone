import { useState, useRef, useEffect } from 'react'
import { useConnection } from '../hooks/useConnection'

const ReceiverView = () => {
    const [providerCode, setProviderCode] = useState('')
    const [step, setStep] = useState('connect')
    const [targetCell, setTargetCell] = useState(null) // { row, col }
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
            setStep('camera') // Go straight to camera
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

    // Listen for active cell updates
    useEffect(() => {
        const handleData = (event) => {
            const { type, payload } = event.detail.data || {}
            if (type === 'SET_ACTIVE_CELL') {
                setTargetCell(payload)
            }
        }
        window.addEventListener('peer-data', handleData)
        return () => window.removeEventListener('peer-data', handleData)
    }, [])

    // Start camera when entering camera step
    useEffect(() => {
        if (step === 'camera') {
            startCamera()
        }
    }, [step])

    const takePicture = () => {
        if (!videoRef.current || !canvasRef.current || !targetCell) {
            alert("Please select an image cell on the spreadsheet first!")
            return
        }

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
                row: targetCell.row,
                col: targetCell.col,
                image: imageData
            }
        })
        
        // Visual feedback
        const btn = document.getElementById('shutter-btn')
        if(btn) {
            btn.style.transform = 'scale(0.9)'
            setTimeout(() => btn.style.transform = 'scale(1)', 100)
        }
    }

    return (
        <div className="bg-[#0a0a0a] text-white h-screen flex flex-col font-sans">
            <div className="p-4 flex justify-between items-center bg-[#111] border-b border-[#222]">
                <h1 className="m-0 text-lg font-bold">📷 Stohb Cam</h1>
                <div onClick={() => setShowHelp(!showHelp)} className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center font-bold cursor-pointer">?</div>
            </div>

            {step === 'connect' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    {showHelp ? (
                        <div className="max-w-md">
                            <h3 className="text-xl font-bold mb-4">How to Connect</h3>
                            <ol className="text-left space-y-2 mb-6">
                                <li>Open <b>Stohb Sheet</b> on Laptop.</li>
                                <li>Click the <b>+</b> button on any Image cell.</li>
                                <li>Enter the <b>Code</b> below.</li>
                            </ol>
                            <button className="w-full py-3 bg-white text-black font-semibold rounded-xl" onClick={() => setShowHelp(false)}>Got it</button>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold mb-2">Pair Device</h2>
                            <p className="text-gray-400 mb-6">Enter code from Spreadsheet</p>

                            <input
                                type="text"
                                value={providerCode}
                                onChange={(e) => setProviderCode(e.target.value.toUpperCase())}
                                placeholder="CODE"
                                maxLength={6}
                                className={`text-[32px] p-4 w-full max-w-[280px] text-center uppercase bg-[#1a1a1a] border-2 ${connectionError ? 'border-red-500' : 'border-[#333]'} text-white rounded-2xl mb-6`}
                                autoCapitalize="characters"
                                disabled={isBusy}
                            />

                            {connectionError && <p className="text-red-400 mb-5">⚠️ {connectionError}</p>}

                            <button
                                className={`w-full max-w-[280px] p-4 text-lg font-bold rounded-2xl border-none ${isBusy ? 'bg-[#333] text-white' : 'bg-white text-black'} cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                                onClick={handleConnect}
                                disabled={providerCode.length < 4 || isBusy}
                            >
                                {isBusy ? 'Connecting...' : 'Connect'}
                            </button>

                            <div className="mt-6 flex items-center gap-2 text-sm">
                                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                {isConnected ? 'Server Connected' : 'Connecting to Cloud...'}
                            </div>
                        </>
                    )}
                </div>
            )}

            {step === 'camera' && (
                <div className="flex-1 relative bg-black flex flex-col">
                    <div className="relative flex-1 overflow-hidden">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" />
                        
                        {/* Target Indicator */}
                        <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
                            <div className={`px-4 py-2 rounded-full backdrop-blur-md text-sm font-medium transition-colors ${targetCell ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'}`}>
                                {targetCell ? `Ready for Row ${targetCell.row + 1}` : 'Select a cell on PC'}
                            </div>
                        </div>
                    </div>
                    
                    <div className="h-[120px] bg-black flex items-center justify-center shrink-0">
                        <button
                            id="shutter-btn"
                            className={`w-[72px] h-[72px] rounded-full border-4 transition-all duration-200 ${targetCell ? 'bg-white border-white/20 cursor-pointer active:scale-90' : 'bg-gray-500 border-gray-600 cursor-not-allowed opacity-50'}`}
                            onClick={takePicture}
                            disabled={!targetCell}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

export default ReceiverView
