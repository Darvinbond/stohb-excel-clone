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
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
                    {showHelp ? (
                        <div className="max-w-xs w-full bg-[#1a1a1a] p-6 rounded-2xl border border-[#333]">
                            <h3 className="text-lg font-bold mb-4 text-white">How to Connect</h3>
                            <ol className="text-left space-y-3 mb-6 text-sm text-gray-400 list-decimal list-inside">
                                <li>Open <span className="text-white font-medium">Stohb Sheet</span> on Laptop.</li>
                                <li>Click the <span className="text-white font-medium">Devices</span> button.</li>
                                <li>Enter the <span className="text-white font-medium">Pairing Code</span> shown.</li>
                            </ol>
                            <button
                                className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-100 transition-colors text-sm"
                                onClick={() => setShowHelp(false)}
                            >
                                Got it
                            </button>
                        </div>
                    ) : (
                        <div className="w-full max-w-xs flex flex-col items-center">
                            <h2 className="text-2xl font-bold mb-2 tracking-tight">Pair Device</h2>
                            <p className="text-gray-500 mb-8 text-sm">Enter the code displayed on your spreadsheet</p>

                            <div className="relative w-full mb-4 group">
                                <input
                                    type="text"
                                    value={providerCode}
                                    onChange={(e) => setProviderCode(e.target.value.toUpperCase())}
                                    placeholder="CODE"
                                    maxLength={6}
                                    className={`w-full text-3xl font-mono tracking-[0.2em] p-4 text-center uppercase bg-[#0a0a0a] border ${connectionError ? 'border-red-500/50 focus:border-red-500' : 'border-[#333] focus:border-white'} text-white rounded-xl transition-all outline-none placeholder:text-[#333]`}
                                    autoCapitalize="characters"
                                    disabled={isBusy}
                                />
                            </div>

                            {connectionError && (
                                <div className="flex items-center gap-2 text-red-400 text-xs mb-4 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    {connectionError}
                                </div>
                            )}

                            <button
                                className={`w-full py-4 text-sm font-medium rounded-xl border transition-all active:scale-[0.98] ${
                                    isBusy
                                        ? 'bg-[#222] border-[#333] text-gray-500 cursor-wait'
                                        : 'bg-white text-black border-transparent hover:bg-gray-100 shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                onClick={handleConnect}
                                disabled={providerCode.length < 4 || isBusy}
                            >
                                {isBusy ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Connecting...
                                    </span>
                                ) : 'Connect Device'}
                            </button>

                            <div className="mt-8 flex items-center gap-2 text-[10px] text-gray-600 font-medium uppercase tracking-wider">
                                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></span>
                                {isConnected ? 'Server Connected' : 'Connecting to Cloud...'}
                            </div>
                        </div>
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
