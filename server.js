const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

// Setup environment
const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Game rooms storage
const gameRooms = new Map();

// Debug helper
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Start the server after Next.js is ready
app.prepare().then(() => {
  log('Next.js app prepared');
  
  // Create HTTP server
  const server = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Create Socket.io server
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    transports: ['websocket', 'polling']
  });

  log('Socket.io server created');

  // Socket.io connection handling
  io.on('connection', (socket) => {
    log(`New client connected: ${socket.id}`);

    // Create new game room
    socket.on('create-room', () => {
      const roomId = uuidv4().substring(0, 8); // Using first 8 chars for a shorter ID
      
      gameRooms.set(roomId, {
        id: roomId,
        players: [{ id: socket.id, score: 0, name: `Player 1` }],
        gameState: null,
        isPlaying: false,
        hostId: socket.id
      });
      
      socket.join(roomId);
      socket.emit('room-created', { roomId, playerId: socket.id, isHost: true });
      log(`Room created: ${roomId} by player ${socket.id}`);
    });

    // Join existing room
    socket.on('join-room', ({ roomId }) => {
      log(`Player ${socket.id} trying to join room: ${roomId}`);
      
      const room = gameRooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      // Add player to the room
      const playerNumber = room.players.length + 1;
      room.players.push({ 
        id: socket.id, 
        score: 0, 
        name: `Player ${playerNumber}` 
      });
      
      socket.join(roomId);
      socket.emit('room-joined', { 
        roomId, 
        playerId: socket.id,
        isHost: false,
        players: room.players,
        gameState: room.gameState,
        isPlaying: room.isPlaying
      });
      
      // Broadcast to other players that someone joined
      socket.to(roomId).emit('player-joined', { 
        players: room.players,
        newPlayer: { id: socket.id, name: `Player ${playerNumber}` }
      });
      
      log(`Player ${socket.id} joined room: ${roomId}`);
    });

    // Start the game
    socket.on('start-game', ({ roomId, initialGameState }) => {
      const room = gameRooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      if (room.hostId !== socket.id) {
        socket.emit('error', { message: 'Only host can start the game' });
        return;
      }
      
      room.gameState = initialGameState;
      room.isPlaying = true;
      
      // Broadcast game start event to all players in the room
      io.to(roomId).emit('game-started', { gameState: initialGameState });
      log(`Game started in room: ${roomId}`);
    });

    // Handle player card selection
    socket.on('select-card', ({ roomId, cardId, playerId, updatedBoard }) => {
      const room = gameRooms.get(roomId);
      
      if (!room || !room.isPlaying) return;
      
      // Update board state for all players
      room.gameState = {
        ...room.gameState,
        board: updatedBoard
      };
      
      // Broadcast the card selection to all other players
      socket.to(roomId).emit('card-selected', { 
        cardId, 
        playerId,
        updatedBoard
      });
    });

    // Handle valid combination found
    socket.on('combination-found', ({ roomId, playerId, updatedGameState }) => {
      const room = gameRooms.get(roomId);
      
      if (!room || !room.isPlaying) return;
      
      // Update the game state
      room.gameState = updatedGameState;
      
      // Update player score
      const playerIndex = room.players.findIndex(p => p.id === playerId);
      if (playerIndex >= 0) {
        room.players[playerIndex].score += 1;
      }
      
      // Broadcast the updated game state and scores to all players
      io.to(roomId).emit('game-state-updated', { 
        gameState: updatedGameState, 
        players: room.players 
      });
      
      log(`Player ${playerId} found a combination in room ${roomId}`);
    });

    // Handle adding cards
    socket.on('add-cards', ({ roomId, updatedGameState }) => {
      const room = gameRooms.get(roomId);
      
      if (!room || !room.isPlaying) return;
      
      // Update the game state
      room.gameState = updatedGameState;
      
      // Broadcast the updated game state to all players
      io.to(roomId).emit('game-state-updated', { 
        gameState: updatedGameState,
        players: room.players 
      });
    });

    // Handle hint request
    socket.on('show-hint', ({ roomId, hintCards }) => {
      io.to(roomId).emit('hint-shown', { hintCards });
    });

    // Handle game end
    socket.on('game-ended', ({ roomId, finalGameState }) => {
      const room = gameRooms.get(roomId);
      
      if (!room) return;
      
      room.gameState = finalGameState;
      room.isPlaying = false;
      
      io.to(roomId).emit('game-over', { 
        gameState: finalGameState, 
        players: room.players,
        winner: room.players.reduce((prev, current) => 
          (prev.score > current.score) ? prev : current)
      });
    });

    // Handle player disconnect
    socket.on('disconnect', () => {
      log(`Client disconnected: ${socket.id}`);
      
      // Find all rooms that this player is in
      for (const [roomId, room] of gameRooms.entries()) {
        const playerIndex = room.players.findIndex(player => player.id === socket.id);
        
        if (playerIndex >= 0) {
          // Remove player from the room
          room.players.splice(playerIndex, 1);
          log(`Removed player ${socket.id} from room ${roomId}`);
          
          // If the host disconnected, assign a new host or close the room
          if (room.hostId === socket.id) {
            if (room.players.length > 0) {
              room.hostId = room.players[0].id;
              io.to(roomId).emit('host-changed', { newHostId: room.hostId });
              log(`New host assigned in room ${roomId}: ${room.hostId}`);
            } else {
              // No players left, remove the room
              gameRooms.delete(roomId);
              log(`Room ${roomId} deleted - no players left`);
              continue;
            }
          }
          
          // Notify others that a player has left
          io.to(roomId).emit('player-left', { 
            playerId: socket.id, 
            players: room.players 
          });
        }
      }
    });
  });

  // Start the server
  server.listen(port, hostname, (err) => {
    if (err) throw err;
    log(`> Ready on http://${hostname}:${port}`);
    log('Socket.io server is running');
  });
}); 