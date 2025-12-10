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
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        })

        peerRef.current = peer

        peer.on('open', (id) => {
            console.log('✅ [PeerJS] ID:', id)
            setPeerId(id)
            setIsConnected(true)
        })

        peer.on('connection', (conn) => {
            // DEDUPLICATION: Check if we already have a connection from this peer
            const existing = connectionsRef.current.find(c => c.peer === conn.peer)
            if (existing) {
                if (existing.open) {
                    console.warn(`⚠️ [PeerJS] Rejecting duplicate connection from ${conn.peer}`)
                    conn.close()
                    return
                } else {
                    // Replace dead connection
                    console.log(`♻️ [PeerJS] Replacing stale connection from ${conn.peer}`)
                    connectionsRef.current = connectionsRef.current.filter(c => c.peer !== conn.peer)
                }
            }

            console.log('📥 [PeerJS] Incoming connection:', conn.peer)
            setupConnection(conn, 'incoming')
        })

        peer.on('error', (err) => {
            console.error('❌ [PeerJS] Error:', err.type)
            setConnectionError(`Error: ${err.type}`)
        })

        return () => {
            peer.destroy()
        }
    }, [])

    const setupConnection = useCallback((conn, direction = 'unknown') => {
        conn.on('open', () => {
            console.log(`✅ [PeerJS] Connected to ${conn.peer} (${direction})`)

            // Add to list, ensuring uniqueness
            connectionsRef.current = [
                ...connectionsRef.current.filter(c => c.peer !== conn.peer),
                conn
            ]
            setConnections([...connectionsRef.current])
            setConnectionError(null)
        })

        conn.on('data', (data) => {
            window.dispatchEvent(new CustomEvent('peer-data', {
                detail: { data, peerId: conn.peer }
            }))
        })

        conn.on('close', () => {
            console.log(`🔌 [PeerJS] Closed: ${conn.peer}`)
            connectionsRef.current = connectionsRef.current.filter(c => c.peer !== conn.peer)
            setConnections([...connectionsRef.current])
        })

        conn.on('error', (err) => {
            console.error(`❌ Connection Error (${conn.peer}):`, err)
        })

    }, [])

    const connectToPeer = useCallback((targetId) => {
        if (!peerRef.current) return

        // DEDUPLICATION: Don't connect if already connected
        const existing = connectionsRef.current.find(c => c.peer === targetId)
        if (existing && existing.open) {
            console.log(`⚠️ Already connected to ${targetId}`)
            return
        }

        console.log(`📤 [PeerJS] Connecting to: ${targetId}`)
        setConnectionError(null)

        try {
            const conn = peerRef.current.connect(targetId, {
                reliable: true
            })
            setupConnection(conn, 'outgoing')
        } catch (e) {
            console.error("Connect exception:", e)
            setConnectionError("Failed to initiate connection.")
        }
    }, [setupConnection])

    const sendData = useCallback((data, targetPeerId = null) => {
        const targets = targetPeerId
            ? connectionsRef.current.filter(c => c.peer === targetPeerId)
            : connectionsRef.current

        targets.forEach(conn => {
            if (conn.open) {
                conn.send(data)
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
