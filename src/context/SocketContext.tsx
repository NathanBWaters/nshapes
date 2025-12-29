import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, Card } from '@/types';

// Define socket context types
interface Player {
  id: string;
  name: string;
  score: number;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  roomId: string | null;
  playerId: string | null;
  isHost: boolean;
  players: Player[];
  gameState: GameState | null;
  createRoom: () => void;
  joinRoom: (roomId: string) => void;
  startGame: (initialGameState: GameState) => void;
  selectCard: (cardId: string, updatedBoard: Card[]) => void;
  combinationFound: (updatedGameState: GameState) => void;
  addCards: (updatedGameState: GameState) => void;
  showHint: (hintCards: string[]) => void;
  gameEnded: (finalGameState: GameState) => void;
  isMultiplayer: boolean;
  setIsMultiplayer: (value: boolean) => void;
  toggleMultiplayer: (value: boolean) => void;
  errorMessage: string | null;
  hintCardIds: string[];
}

// Create the context
const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Socket context provider component
export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hintCardIds, setHintCardIds] = useState<string[]>([]);

  // Initialize Socket.io connection
  useEffect(() => {
    if (isMultiplayer && !socket) {
      // Connect to the Socket.io server with fixed configuration
      try {
        console.log('Attempting to connect to Socket.io server...');
        
        const newSocket = io('http://localhost:3000', {
            transports: ['websocket', 'polling'],
            upgrade: true,  // Ensures upgrade from polling to WebSockets
            forceNew: true, // Ensures a fresh connection each time
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
            timeout: 20000,  // Increase timeout further
        });
          

        // Set up socket event handlers
        newSocket.on('connect', () => {
          console.log('Connected to Socket.io server with ID:', newSocket.id);
          setIsConnected(true);
          setErrorMessage(null);
        });

        newSocket.on('disconnect', () => {
          console.log('Disconnected from Socket.io server');
          setIsConnected(false);
        });

        newSocket.on('connect_error', (error) => {
          console.error('Socket connection error:', error.message);
          setErrorMessage(`Connection error: ${error.message}. Check if server is running.`);
        });

        // Room events
        newSocket.on('room-created', ({ roomId, playerId, isHost }) => {
          setRoomId(roomId);
          setPlayerId(playerId);
          setIsHost(isHost);
          setPlayers([{ id: playerId, name: 'Player 1', score: 0 }]);
        });

        newSocket.on('room-joined', ({ roomId, playerId, isHost, players, gameState, isPlaying }) => {
          setRoomId(roomId);
          setPlayerId(playerId);
          setIsHost(isHost);
          setPlayers(players);
          if (gameState && isPlaying) {
            setGameState(gameState);
          }
        });

        newSocket.on('player-joined', ({ players }) => {
          setPlayers(players);
          // Show notification about new player joined
          setErrorMessage(null);
        });

        newSocket.on('player-left', ({ players }) => {
          setPlayers(players);
          // Show notification about player left
          setErrorMessage(null);
        });

        newSocket.on('host-changed', ({ newHostId }) => {
          if (playerId === newHostId) {
            setIsHost(true);
            setErrorMessage('You are now the host');
          }
        });

        // Game events
        newSocket.on('game-started', ({ gameState }) => {
          setGameState(gameState);
          setErrorMessage(null);
        });

        newSocket.on('card-selected', ({ updatedBoard }) => {
          setGameState((prevState) => {
            if (!prevState) return null;
            return {
              ...prevState,
              board: updatedBoard
            };
          });
        });

        newSocket.on('game-state-updated', ({ gameState, players }) => {
          setGameState(gameState);
          setPlayers(players);
        });

        newSocket.on('hint-shown', ({ hintCards }) => {
          setHintCardIds(hintCards);
        });

        newSocket.on('game-over', ({ gameState, players }) => {
          setGameState(gameState);
          setPlayers(players);
          // Show game over notification
        });

        newSocket.on('error', ({ message }) => {
          setErrorMessage(message);
        });

        setSocket(newSocket);

        // Clean up on unmount
        return () => {
        //   console.log('Cleaning up socket connection');
        //   newSocket.disconnect();
        };
      } catch (error) {
        console.error('Failed to initialize socket connection:', error);
        setErrorMessage('Failed to initialize socket connection. Check browser console for details.');
      }
    }

    // Clean up when switching to single player
    if (!isMultiplayer && socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setRoomId(null);
      setPlayerId(null);
      setIsHost(false);
      setPlayers([]);
    }
  }, [isMultiplayer, socket]);

  // Socket event handler functions
  const createRoom = () => {
    if (socket && isConnected) {
      socket.emit('create-room');
    }
  };

  const joinRoom = (roomId: string) => {
    if (socket && isConnected) {
      socket.emit('join-room', { roomId });
    }
  };

  const startGame = (initialGameState: GameState) => {
    if (socket && isConnected && roomId) {
      socket.emit('start-game', { roomId, initialGameState });
    }
  };

  const selectCard = (cardId: string, updatedBoard: Card[]) => {
    if (socket && isConnected && roomId && playerId) {
      socket.emit('select-card', { roomId, cardId, playerId, updatedBoard });
    }
  };

  const combinationFound = (updatedGameState: GameState) => {
    if (socket && isConnected && roomId && playerId) {
      console.log('combination-found', { roomId, playerId, updatedGameState });
      socket.emit('combination-found', { roomId, playerId, updatedGameState });
    }
  };

  const addCards = (updatedGameState: GameState) => {
    if (socket && isConnected && roomId) {
      socket.emit('add-cards', { roomId, updatedGameState });
    }
  };

  const showHint = (hintCards: string[]) => {
    if (socket && isConnected && roomId) {
      socket.emit('show-hint', { roomId, hintCards });
    }
  };

  const gameEnded = (finalGameState: GameState) => {
    if (socket && isConnected && roomId) {
      socket.emit('game-ended', { roomId, finalGameState });
    }
  };

  const contextValue: SocketContextType = {
    socket,
    isConnected,
    roomId,
    playerId,
    isHost,
    players,
    gameState,
    createRoom,
    joinRoom,
    startGame,
    selectCard,
    combinationFound,
    addCards,
    showHint,
    gameEnded,
    isMultiplayer,
    setIsMultiplayer,
    toggleMultiplayer: setIsMultiplayer,
    errorMessage,
    hintCardIds
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

// Custom hook to use the socket context
export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}; 