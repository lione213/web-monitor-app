const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const peers = {};

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  socket.on('create-pair', () => {
    const code = uuidv4().slice(0, 6);
    peers[code] = socket.id;
    socket.emit('pair-created', code);
  });

  socket.on('join-pair', (code) => {
    const peerId = peers[code];
    if (peerId) {
      socket.to(peerId).emit('viewer-joined', socket.id);
    } else {
      socket.emit('error', 'Invalid pair code');
    }
  });

  socket.on('signal', ({ to, data }) => {
    if (to) io.to(to).emit('signal', { from: socket.id, data });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));