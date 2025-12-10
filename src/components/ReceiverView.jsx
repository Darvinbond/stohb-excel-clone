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

            {step === 'waiting' && (
                <div className="flex flex-col items-center justify-center flex-1">
                    <h1 className="text-3xl font-bold mb-4">Connected!</h1>
                    <div className="w-10 h-10 border-4 border-[#333] border-t-white rounded-full animate-spin"></div>
                </div>
            )}

            {step === 'camera' && (
                <div className="flex-1 relative bg-black">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute bottom-10 w-full flex justify-center">
                        <button className="w-[72px] h-[72px] rounded-full bg-white border-4 border-black/10" onClick={takePicture} />
                    </div>
                </div>
            )}
        </div>
    )
}

export default ReceiverView
