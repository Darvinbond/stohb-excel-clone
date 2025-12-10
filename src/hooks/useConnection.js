import { useState, useEffect, useCallback, useRef } from 'react'
import Peer from 'peerjs'

function generateShortId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export function useConnection(mode = 'provider') {
    const [peerId, setPeerId] = useState('')
    const [connections, setConnections] = useState([])
    const [isConnected, setIsConnected] = useState(false)
    const [connectionError, setConnectionError] = useState(null) // NEW: Error state
    const peerRef = useRef(null)
    const connectionsRef = useRef([])

    useEffect(() => {
        const myId = generateShortId()
        const peer = new Peer(myId, {
            debug: 1
        })

        peerRef.current = peer

        peer.on('open', (id) => {
            console.log('✅ PeerJS connected, my ID:', id)
            setPeerId(id)
            setIsConnected(true)
        })

        peer.on('connection', (conn) => {
            console.log('📥 Incoming connection from:', conn.peer)
            setupConnection(conn)
        })

        peer.on('error', (err) => {
            console.error('❌ Peer error:', err.type, err)
            setConnectionError(`Connection Error: ${err.type}`)
            if (err.type === 'peer-unavailable') {
                setConnectionError('Device not found. Check the code.')
            }
        })

        peer.on('disconnected', () => {
            console.log('⚠️ Disconnected from cloud')
            setIsConnected(false)
            peer.reconnect()
        })

        return () => {
            peer.destroy()
        }
    }, [])

    const setupConnection = useCallback((conn) => {
        conn.on('open', () => {
            console.log('🔗 Connection established with:', conn.peer)
            connectionsRef.current = [...connectionsRef.current, conn]
            setConnections([...connectionsRef.current])
            setConnectionError(null) // Clear error on success
        })

        conn.on('data', (data) => {
            console.log('📨 Data received from', conn.peer, ':', data)
            window.dispatchEvent(new CustomEvent('peer-data', {
                detail: { data, peerId: conn.peer }
            }))
        })

        conn.on('close', () => {
            console.log('🔌 Connection closed:', conn.peer)
            connectionsRef.current = connectionsRef.current.filter(c => c.peer !== conn.peer)
            setConnections([...connectionsRef.current])
        })

        conn.on('error', (err) => {
            console.error('Connection level error:', err)
            setConnectionError('Connection failed. Please retry.')
        })
    }, [])

    const connectToPeer = useCallback((targetId) => {
        if (!peerRef.current) return

        console.log('📤 Connecting to:', targetId)
        setConnectionError(null) // Reset error before trying

        try {
            const conn = peerRef.current.connect(targetId, {
                reliable: true
            })
            setupConnection(conn)

            // Timeout failsafe
            setTimeout(() => {
                if (!conn.open) {
                    // This is heuristic, but helpful for UI feedback if it hangs
                    // We don't set error here to avoid race conditions, but UI can use a local timeout.
                }
            }, 5000)

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
        isConnected, // Connected to Cloud
        connectToPeer,
        sendData,
        connections, // Connected Peers
        connectionError // Expose error
    }
}
