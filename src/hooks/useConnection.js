import { useState, useEffect, useCallback, useRef } from 'react'
import Peer from 'peerjs'

function generateShortId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export function useConnection(mode = 'provider') {
    const [peerId, setPeerId] = useState('')
    const [connections, setConnections] = useState([])
    const [isConnected, setIsConnected] = useState(false)
    const [connectionError, setConnectionError] = useState(null)
    const peerRef = useRef(null)
    const connectionsRef = useRef([])

    useEffect(() => {
        const myId = generateShortId()
        const peer = new Peer(myId, {
            debug: 3, // MAXIMUM DEBUG LEVEL
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        })

        peerRef.current = peer

        peer.on('open', (id) => {
            console.log('✅ [PeerJS] Connect to Server open, ID:', id)
            setPeerId(id)
            setIsConnected(true)
        })

        peer.on('connection', (conn) => {
            console.log('📥 [PeerJS] Incoming connection request from:', conn.peer)
            setupConnection(conn, 'incoming')
        })

        peer.on('error', (err) => {
            console.error('❌ [PeerJS] FATAL ERROR:', err)
            console.error('Error Type:', err.type)
            setConnectionError(`Error: ${err.type}`)
        })

        peer.on('disconnected', () => {
            console.warn('⚠️ [PeerJS] Disconnected from signaling server')
            setIsConnected(false)
        })

        return () => {
            peer.destroy()
        }
    }, [])

    const setupConnection = useCallback((conn, direction = 'unknown') => {
        console.log(`🔧 [PeerJS] Setting up ${direction} connection to ${conn.peer}...`)

        // Attach deep WebRTC debugging when the underlying connection is available
        // PeerJS creates this asynchronously, so we check or wait for it.
        // We can hook into the 'open' event, but debugging ICE needs early access.
        // Unfortunately standard PeerJS API hides the PC until it's created.

        conn.on('open', () => {
            console.log(`✅ [PeerJS] DataChannel OPEN for ${conn.peer}`)
            connectionsRef.current = [...connectionsRef.current, conn]
            setConnections([...connectionsRef.current])
            setConnectionError(null)

            // Try to access internal PC for stats (if implementation allows)
            if (conn.peerConnection) {
                conn.peerConnection.oniceconnectionstatechange = () => {
                    console.log(`🧊 [WebRTC ICE] State change (${conn.peer}):`, conn.peerConnection.iceConnectionState)
                }
            }
        })

        conn.on('data', (data) => {
            console.log(`📨 [PeerJS] DATA from ${conn.peer}:`, data)
            window.dispatchEvent(new CustomEvent('peer-data', {
                detail: { data, peerId: conn.peer }
            }))
        })

        conn.on('close', () => {
            console.warn(`🔌 [PeerJS] Connection CLOSED with ${conn.peer}`)
            connectionsRef.current = connectionsRef.current.filter(c => c.peer !== conn.peer)
            setConnections([...connectionsRef.current])
        })

        conn.on('error', (err) => {
            console.error(`❌ [PeerJS] Connection ERROR with ${conn.peer}:`, err)
            setConnectionError(`Connection Failed: ${err}`)
        })

        // Debugging ICE state specifically if possible immediately
        if (conn.peerConnection) {
            console.log("Existing PC found, attaching listeners")
            conn.peerConnection.oniceconnectionstatechange = () => {
                console.log(`🧊 [WebRTC ICE] State change (${conn.peer}):`, conn.peerConnection.iceConnectionState)
            }
            conn.peerConnection.onicecandidate = (event) => {
                console.log(`❄️ [WebRTC ICE] New Candidate:`, event.candidate ? event.candidate.candidate : '(End of candidates)')
            }
        }
    }, [])

    const connectToPeer = useCallback((targetId) => {
        if (!peerRef.current) return

        console.log(`📤 [PeerJS] Initiating connection to: ${targetId}`)
        setConnectionError(null)

        try {
            const conn = peerRef.current.connect(targetId, {
                reliable: true,
                serialization: 'json'
            })
            setupConnection(conn, 'outgoing')

            // Log if it hangs
            setTimeout(() => {
                if (!conn.open) {
                    console.warn(`⚠️ [PeerJS] Connection to ${targetId} is taking longer than 5s...`)
                    // Check ICE state if possible
                    if (conn.peerConnection) {
                        console.warn(`⚠️ [PeerJS] ICE State is: ${conn.peerConnection.iceConnectionState}`)
                    }
                }
            }, 5000)

        } catch (e) {
            console.error("❌ Exception during connect:", e)
            setConnectionError("Failed to initiate connection.")
        }
    }, [setupConnection])

    const sendData = useCallback((data, targetPeerId = null) => {
        const targets = targetPeerId
            ? connectionsRef.current.filter(c => c.peer === targetPeerId)
            : connectionsRef.current

        targets.forEach(conn => {
            if (conn.open) {
                // console.log(`📤 [PeerJS] Sending data to ${conn.peer}`) // Reduce spam
                conn.send(data)
            } else {
                console.warn(`⚠️ [PeerJS] Cannot send, connection to ${conn.peer} is NOT OPEN`)
            }
        })
    }, [])

    return {
        peerId,
        isConnected,
        connectToPeer,
        sendData,
        connections,
        connectionError
    }
}
