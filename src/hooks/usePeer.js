import { useState, useEffect, useCallback, useRef } from 'react'
import Peer from 'peerjs'

// Simple ID generator
function generateShortId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export function usePeer(mode = 'provider') {
    const [peerId, setPeerId] = useState('')
    const [connections, setConnections] = useState([])
    const [isConnected, setIsConnected] = useState(false)
    const peerRef = useRef(null)

    useEffect(() => {
        // Use Public PeerJS Cloud (default)
        // This ensures it works on Vercel/Production (HTTPS).
        // No arguments = connect to 0.peerjs.com

        const peer = new Peer(generateShortId(), {
            debug: 1
        })

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
                window.dispatchEvent(new CustomEvent('peer-data', { detail: { data, peerId: conn.peer } }))
            })

            conn.on('close', () => {
                setConnections(prev => prev.filter(c => c.peer !== conn.peer))
            })

            conn.on('error', (err) => console.error("Conn error:", err))
        })

        peer.on('error', (err) => {
            console.error('Peer error:', err)
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
            // Just log, don't alert blocking UI
        })
    }, [])

    const sendData = useCallback((data, targetPeerId = null) => {
        if (targetPeerId) {
            const conn = connections.find(c => c.peer === targetPeerId)
            if (conn && conn.open) {
                conn.send(data)
            }
        } else {
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
