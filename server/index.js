const { PeerServer } = require('peer');

const port = 9000;

const peerServer = PeerServer({
    port: port,
    path: '/myapp',
    proxied: true, // Useful if behind proxy, harmless if not
    allow_discovery: true,
});

console.log(`Local PeerServer running on port ${port}, path: /myapp`);

peerServer.on('connection', (client) => {
    console.log(`Client connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
    console.log(`Client disconnected: ${client.getId()}`);
});
