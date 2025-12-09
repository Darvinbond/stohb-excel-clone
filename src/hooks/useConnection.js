import { useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'

// Use a simple 6-char ID logic for display, but map to socket.id OR just use socket.id?
// Socket.io IDs are long. Short codes are better for typing.
// Let's generate a random short ID and JOIN A ROOM with that ID.
// Then others connect to that Room ID.

function generateShortId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export function useConnection(mode = 'provider') {
    const [connectionId, setConnectionId] = useState('')
    const [isConnected, setIsConnected] = useState(false)
    const socketRef = useRef(null)
    const myShortId = useRef(generateShortId()) // Stable ID for this session

    useEffect(() => {
        // Connect to current path (Vite proxy handles /socket.io)
        const socket = io('/', {
            path: '/socket.io',
            transports: ['websocket', 'polling'] // force WS if possible
        })

        socketRef.current = socket

        socket.on('connect', () => {
            console.log('Socket connected:', socket.id)
            setIsConnected(true)

            // Join a room with our short ID so others can find us
            socket.emit('join', myShortId.current)
            setConnectionId(myShortId.current)
        })

        socket.on('app-data', (msg) => {
            // msg: { sender, payload }
            // Dispath same event as before for compatibility
            window.dispatchEvent(new CustomEvent('peer-data', {
                detail: { data: msg.payload, peerId: msg.sender }
            }))
        })

        socket.on('disconnect', () => {
            setIsConnected(false)
        })

        return () => {
            socket.disconnect()
        }
    }, [])

    const connectToPeer = useCallback((targetShortId) => {
        // In Socket.io via Rooms, we don't "connect" P2P.
        // We just start sending messages to that Room ID.
        // We can verify if it exists, but for now let's just assume valid.
        console.log("Setting target to:", targetShortId)
        // We don't really need to do anything explicit unless we want to join THEIR room.
        // But usually Provider has the ID, Receiver joins it?
        // Wait, UI flow: Provider (Spreadsheet) shows code. Receiver (Phone) inputs code.
        // So Phone sends data to Provider's Room.
        // Receiver joins its OWN room (auto). Receiver targets Provider Room.
    }, [])

    const sendData = useCallback((data, targetShortId = null) => {
        if (socketRef.current) {
            // If we have a target (the short code entered), send to that room
            // If connection architecture implies we hold the target ID in state, we should pass it.
            // ReceiverView has "providerCode".

            socketRef.current.emit('app-data', {
                target: targetShortId,
                payload: data
            })
        }
    }, [])

    // For compatibility with existing UI which uses "connections" array
    // We can fake it or ignore it.
    const connections = []

    return {
        peerId: connectionId, // expose short ID as "peerId"
        isConnected,
        connectToPeer,
        sendData,
        connections
    }
}
