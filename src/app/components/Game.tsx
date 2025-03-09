"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, GameState } from '../types';
import { createDeck, shuffleDeck, isValidCombination, findAllCombinations } from '../utils/gameUtils';
import GameBoard from './GameBoard';
import GameInfo from './GameInfo';
import Tutorial from './Tutorial';
import Notification from './Notification';
import { useSocket } from '../context/SocketContext';
import MultiplayerLobby from './MultiplayerLobby';
import ScoreBoard from './ScoreBoard';
import MultiplayerToggle from './MultiplayerToggle';

const INITIAL_CARD_COUNT = 12;
const MAX_BOARD_SIZE = 21;

const Game: React.FC = () => {
  const [state, setState] = useState<GameState>({
    deck: [],
    board: [],
    selectedCards: [],
    foundCombinations: [],
    score: 0,
    gameStarted: false,
    gameEnded: false,
    startTime: null,
    endTime: null,
    hintUsed: false,
  });

  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);

  const [hintCards, setHintCards] = useState<string[]>([]);

  // Socket context for multiplayer
  const {
    isMultiplayer,
    roomId, 
    isHost,
    gameState: multiplayerGameState,
    startGame: startMultiplayerGame,
    selectCard: selectMultiplayerCard,
    combinationFound: sendCombinationFound,
    addCards: sendAddCards,
    showHint: sendShowHint,
    hintCardIds 
  } = useSocket();

  // Use socket hint cards in multiplayer mode
  useEffect(() => {
    if (isMultiplayer && hintCardIds.length > 0) {
      setHintCards(hintCardIds);
    }
  }, [isMultiplayer, hintCardIds]);

  // Initialize the game
  const initGame = useCallback(() => {
    const deck = shuffleDeck(createDeck());
    const initialBoard = deck.slice(0, INITIAL_CARD_COUNT);
    const remainingDeck = deck.slice(INITIAL_CARD_COUNT);

    setState({
      deck: remainingDeck,
      board: initialBoard,
      selectedCards: [],
      foundCombinations: [],
      score: 0,
      gameStarted: false,
      gameEnded: false,
      startTime: null,
      endTime: null,
      hintUsed: false,
    });

    setNotification(null);
    setHintCards([]);
  }, []);

  // Initialize the game when the component mounts
  useEffect(() => {
    initGame();
  }, [initGame]);

  // Sync with multiplayer game state if available
  useEffect(() => {
    if (isMultiplayer && multiplayerGameState) {
      // To avoid double processing combinations, we need to be careful
      // when updating state from the server
      setState((prev) => {
        // If this update is a combination found by another player
        if (multiplayerGameState.foundCombinations.length > prev.foundCombinations.length) {
          console.log('Received new combinations from server - updating state directly');
          
          // We don't want any validation to happen here - just accept the server's state
          return {
            ...multiplayerGameState,
            gameStarted: true
          };
        }
        
        // For other updates, merge the states
        return {
          ...prev,
          ...multiplayerGameState,
          gameStarted: true
        };
      });
    }
  }, [isMultiplayer, multiplayerGameState]);

  // Start the game
  const startGame = () => {
    // For multiplayer, only host can start the game
    if (isMultiplayer) {
      if (isHost) {
        const initialGameState = {
          ...state,
          gameStarted: true,
          startTime: Date.now(),
        };
        
        setState(initialGameState);
        startMultiplayerGame(initialGameState);
        
        setNotification({
          message: 'Game started! Find combinations by selecting three cards.',
          type: 'info',
        });
      }
    } else {
      // Single player mode
      setState(prev => ({
        ...prev,
        gameStarted: true,
        startTime: Date.now(),
      }));
      
      setNotification({
        message: 'Game started! Find valid combinations by selecting three cards.',
        type: 'info',
      });
    }
  };

  // Handle card selection
  const handleCardClick = (clickedCard: Card) => {
    if (state.gameEnded) return;
    
    // Start the game on first card click if not already started
    if (!state.gameStarted) {
      startGame();
    }

    // Clear hint highlighting when user selects a card
    setHintCards([]);

    setState(prev => {
      const isSelected = prev.selectedCards.some(card => card.id === clickedCard.id);
      let newSelectedCards: Card[];

      if (isSelected) {
        // Deselect if already selected
        newSelectedCards = prev.selectedCards.filter(card => card.id !== clickedCard.id);
      } else {
        // Select the card
        newSelectedCards = [...prev.selectedCards, clickedCard];
      }

      // Update the board to reflect selection state
      const newBoard = prev.board.map(card => 
        card.id === clickedCard.id 
          ? { ...card, selected: !card.selected } 
          : card
      );

      // In multiplayer mode, send card selection to server
      // But only send selections, not valid combinations (those are handled separately)
      if (isMultiplayer && newSelectedCards.length < 3) {
        selectMultiplayerCard(clickedCard.id, newBoard);
      }

      if (newSelectedCards.length === 3) {
        // Check if the selected cards form a valid combination
        const validationResult = isValidCombination(newSelectedCards);
        
        if (validationResult.isValid) {
          // Process the valid combination locally first
          const updatedState = handleValidCombination(prev, newSelectedCards, newBoard);
          
          // If the state was actually updated (not a duplicate combination)
          // and we're in multiplayer mode, notify other players
          if (isMultiplayer && updatedState !== prev) {
            // Only send combination once from here, removed from handleValidCombination
            console.log('Sending combination to server');
            sendCombinationFound(updatedState);
          }
          
          return updatedState;
        } else {
          // Invalid combination - provide feedback with detailed error message and deselect
          setTimeout(() => {
            setNotification({
              message: validationResult.errorMessage,
              type: 'error',
            });
          }, 100);

          return {
            ...prev,
            selectedCards: [],
            board: newBoard.map(card => ({ ...card, selected: false })),
          };
        }
      }

      return {
        ...prev,
        selectedCards: newSelectedCards,
        board: newBoard,
      };
    });
  };

  // Handle a valid combination being found
  const handleValidCombination = (
    prevState: GameState, 
    selectedCards: Card[], 
    currentBoard: Card[]
  ): GameState => {
    // Add a simple debounce to prevent double calls
    const selectedIds = selectedCards.map(card => card.id).sort().join(',');
    const foundCombinationsIds = prevState.foundCombinations.map(combo => 
      combo.map(card => card.id).sort().join(',')
    );
    
    // If this exact combination was just processed, don't process it again
    if (foundCombinationsIds.includes(selectedIds)) {
      console.log('Skipping duplicate handleValidCombination call', { selectedCards });
      return prevState;
    }
    
    console.log('handleValidCombination', { selectedCards, currentBoard });
    
    // Remove selected cards from the board
    let newBoard = currentBoard.filter(card => 
      !selectedCards.some(selected => selected.id === card.id)
    );
    
    // Get new cards from the deck if available
    const newCards: Card[] = [];
    const newDeck = [...prevState.deck];
    
    // Only draw up to INITIAL_CARD_COUNT unless we've already added more
    const targetBoardSize = Math.max(INITIAL_CARD_COUNT, prevState.board.length - 3);
    
    while (newBoard.length < targetBoardSize && newDeck.length > 0) {
      const newCard = newDeck.shift()!;
      newCards.push({ ...newCard, selected: false });
      newBoard = [...newBoard, { ...newCard, selected: false }];
    }

    // Show success notification
    setNotification({
      message: 'You found a valid combination!',
      type: 'success',
    });

    // Check for game end conditions
    const allCombinations = findAllCombinations(newBoard);
    const isGameOver = newDeck.length === 0 && allCombinations.length === 0;

    const updatedGameState = isGameOver 
      ? {
          ...prevState,
          board: newBoard,
          deck: newDeck,
          selectedCards: [],
          foundCombinations: [...prevState.foundCombinations, selectedCards],
          score: prevState.score + 1,
          gameEnded: true,
          endTime: Date.now(),
        }
      : {
          ...prevState,
          board: newBoard,
          deck: newDeck,
          selectedCards: [],
          foundCombinations: [...prevState.foundCombinations, selectedCards],
          score: prevState.score + 1,
        };

    return updatedGameState;
  };

  // Add three more cards to the board
  const handleAddCards = () => {
    setState(prev => {
      if (prev.deck.length === 0 || prev.board.length >= MAX_BOARD_SIZE) {
        setNotification({
          message: prev.deck.length === 0 
            ? 'No more cards in the deck!' 
            : 'Maximum board size reached!',
          type: 'warning',
        });
        return prev;
      }

      const newCards = prev.deck.slice(0, 3);
      const newDeck = prev.deck.slice(3);
      const newBoard = [...prev.board, ...newCards.map(card => ({ ...card, selected: false }))];

      setNotification({
        message: 'Added three more cards to the board.',
        type: 'info',
      });

      // Check if there are any valid combinations with the new cards
      if (findAllCombinations(newBoard).length === 0 && newDeck.length === 0) {
        const updatedGameState = {
          ...prev,
          board: newBoard,
          deck: newDeck,
          gameEnded: true,
          endTime: Date.now(),
        };
        
        // Update multiplayer state
        if (isMultiplayer) {
          sendAddCards(updatedGameState);
        }
        
        return updatedGameState;
      }

      const updatedGameState = {
        ...prev,
        board: newBoard,
        deck: newDeck,
      };
      
      // Update multiplayer state
      if (isMultiplayer) {
        sendAddCards(updatedGameState);
      }
      
      return updatedGameState;
    });
  };

  // Provide a hint by highlighting a valid combination
  const handleShowHint = () => {
    const allCombinations = findAllCombinations(state.board);
    
    if (allCombinations.length === 0) {
      setNotification({
        message: 'No valid combinations available! Try adding more cards.',
        type: 'warning',
      });
      return;
    }

    // Get the first valid combination as a hint
    const hintCombination = allCombinations[0];
    const hintCardIds = hintCombination.map(card => card.id);
    
    setHintCards(hintCardIds);
    
    setState(prev => ({
      ...prev,
      hintUsed: true,
    }));

    // In multiplayer, share hint with all players
    if (isMultiplayer) {
      sendShowHint(hintCardIds);
    }

    setNotification({
      message: 'Hint: Look for a valid combination with these highlighted cards!',
      type: 'info',
    });
  };

  // Check if there are any valid combinations in the current board
  useEffect(() => {
    if (state.gameStarted && !state.gameEnded && state.board.length > 0) {
      const allCombinations = findAllCombinations(state.board);
      
      if (allCombinations.length === 0 && state.deck.length === 0) {
        // No valid combinations available and no cards left in deck - game over
        setState(prev => ({
          ...prev,
          gameEnded: true,
          endTime: Date.now(),
        }));
        
        setNotification({
          message: 'Game Over! No more valid combinations possible.',
          type: 'info',
        });
      }
    }
  }, [state.board, state.deck.length, state.gameStarted, state.gameEnded]);

  // Multiplayer lobby handler
  const handleMultiplayerGameStart = () => {
    startGame();
  };

  // Render multiplayer lobby if in multiplayer mode and game not started
  if (isMultiplayer && !state.gameStarted) {
    // Using roomId in conditional render for multiplayer lobby
    const showLobby = !roomId || (roomId && !state.gameStarted);
    
    return (
      <div className="flex flex-col items-center max-w-4xl mx-auto p-4">
        <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center">NShapes</h1>
        <MultiplayerToggle />
        {showLobby && <MultiplayerLobby onStartGame={handleMultiplayerGameStart} />}
        <div className="mt-8">
          <Tutorial />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center max-w-4xl mx-auto p-4">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center">NShapes</h1>
      
      {!state.gameStarted && !isMultiplayer && <MultiplayerToggle />}
      
      <GameInfo 
        score={state.score}
        startTime={state.startTime}
        endTime={state.endTime}
        gameStarted={state.gameStarted}
        gameEnded={state.gameEnded}
        cardsRemaining={state.deck.length}
        onNewGame={() => {
          initGame();
          // Add slight delay before starting game
          setTimeout(() => {
            startGame();
          }, 500);
        }}
        onShowHint={handleShowHint}
        onAddCards={handleAddCards}
        foundCombinationsCount={state.foundCombinations.length}
        hintAvailable={state.gameStarted && !state.gameEnded}
        canAddCards={state.gameStarted && !state.gameEnded && state.deck.length > 0 && state.board.length < MAX_BOARD_SIZE}
      />
      
      {isMultiplayer && <ScoreBoard />}
      
      {!state.gameStarted && !state.gameEnded && !isMultiplayer && (
        <div className="my-6 text-center">
          <p className="mb-4">Welcome to the game of NShapes! Select three cards that form a valid combination.</p>
          <button
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-lg"
            onClick={startGame}
          >
            Start Game
          </button>
        </div>
      )}
      
      <div className="my-6 w-full">
        <GameBoard 
          cards={state.board.map(card => ({
            ...card,
            selected: card.selected,
            isHint: hintCards.includes(card.id)
          }))}
          onCardClick={handleCardClick}
          disabled={state.gameEnded}
        />
      </div>
      
      <Tutorial />
      
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default Game; 