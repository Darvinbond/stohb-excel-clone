import { useState, useEffect, useCallback, useRef } from 'react'
import Peer from 'peerjs'

// Simple ID generator for the shorter code
function generateShortId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export function usePeer(mode = 'provider') {
    const [peerId, setPeerId] = useState('')
    const [connections, setConnections] = useState([]) // Array of data connections
    const [isConnected, setIsConnected] = useState(false)
    const peerRef = useRef(null)

    useEffect(() => {
        // Initialize Peer
        const peer = new Peer(generateShortId())
        peerRef.current = peer

        peer.on('open', (id) => {
            console.log('My peer ID is: ' + id)
            setPeerId(id)
        })

        peer.on('connection', (conn) => {
            console.log('Incoming connection from:', conn.peer)

            conn.on('open', () => {
                setConnections(prev => [...prev, conn])
                setIsConnected(true)
            })

            conn.on('data', (data) => {
                // Handle incoming data (images, status updates, etc)
                // This will need to be passed up via callback or event
                window.dispatchEvent(new CustomEvent('peer-data', { detail: { data, peerId: conn.peer } }))
            })

            conn.on('close', () => {
                setConnections(prev => prev.filter(c => c.peer !== conn.peer))
            })
        })

        return () => {
            peer.destroy()
        }
    }, [])

    const connectToPeer = useCallback((targetId) => {
        if (!peerRef.current) return

        const conn = peerRef.current.connect(targetId)

        conn.on('open', () => {
            setConnections(prev => [...prev, conn])
            setIsConnected(true)
        })

        conn.on('data', (data) => {
            window.dispatchEvent(new CustomEvent('peer-data', { detail: { data, peerId: conn.peer } }))
        })

        conn.on('error', (err) => {
            console.error('Connection error:', err)
        })
    }, [])

    const sendData = useCallback((data, targetPeerId = null) => {
        if (targetPeerId) {
            // Send to specific peer
            const conn = connections.find(c => c.peer === targetPeerId)
            if (conn && conn.open) {
                conn.send(data)
            }
        } else {
            // Broadcast to all
            connections.forEach(conn => {
                if (conn.open) {
                    conn.send(data)
                }
            })
        }
    }, [connections])

    return {
        peerId,
        isConnected,
        connectToPeer,
        sendData,
        connections
    }
}
