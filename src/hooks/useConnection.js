import { useState, useEffect, useCallback, useRef } from 'react'
import Peer from 'peerjs'

// Simple 6-char ID
function generateShortId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export function useConnection(mode = 'provider') {
    const [peerId, setPeerId] = useState('')
    const [connections, setConnections] = useState([])
    const [isConnected, setIsConnected] = useState(false)
    const peerRef = useRef(null)
    const connectionsRef = useRef([])

    useEffect(() => {
        // PeerJS with DEFAULT cloud (0.peerjs.com) - NO BACKEND NEEDED
        const myId = generateShortId()
        const peer = new Peer(myId, {
            debug: 2 // Show logs for debugging
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
            // Don't crash on non-fatal errors
            if (err.type === 'peer-unavailable') {
                alert('Could not find that device. Check the code and try again.')
            }
        })

        peer.on('disconnected', () => {
            console.log('⚠️ Disconnected from signaling server, attempting reconnect...')
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
            setIsConnected(true)
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
            console.error('Connection error:', err)
        })
    }, [])

    const connectToPeer = useCallback((targetId) => {
        if (!peerRef.current) {
            console.error('Peer not initialized')
            return
        }

        console.log('📤 Connecting to:', targetId)
        const conn = peerRef.current.connect(targetId, {
            reliable: true
        })

        setupConnection(conn)
    }, [setupConnection])

    const sendData = useCallback((data, targetPeerId = null) => {
        const targets = targetPeerId
            ? connectionsRef.current.filter(c => c.peer === targetPeerId)
            : connectionsRef.current

        if (targets.length === 0) {
            console.warn('⚠️ No connections to send data to')
            return
        }

        targets.forEach(conn => {
            if (conn.open) {
                console.log('📤 Sending data to', conn.peer)
                conn.send(data)
            } else {
                console.warn('Connection not open:', conn.peer)
            }
        })
    }, [])

    return {
        peerId,
        isConnected,
        connectToPeer,
        sendData,
        connections
    }
}
