import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

console.log("Socket.io server starting on port 9000...");

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join", (roomId) => {
        socket.join(roomId);
        console.log(`${socket.id} joined ${roomId}`);
    });

    socket.on("app-data", (data) => {
        const { target, payload } = data;
        if (target) {
            // Send to specific room (target = shortId)
            io.to(target).emit("app-data", { sender: socket.id, payload });
            console.log(`Relayed data from ${socket.id} to ${target}`);
        } else {
            socket.broadcast.emit("app-data", { sender: socket.id, payload });
        }
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

const PORT = 9000;
httpServer.listen(PORT, () => {
    console.log(`Socket.io server running on port ${PORT}`);
});
