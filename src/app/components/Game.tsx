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
// Add Roguelike constants
const STARTING_TIME_MS = 3 * 60 * 1000; // 3 minutes in milliseconds
const MAX_LEVELS = 9;

// Calculate target score based on level
const getTargetScore = (level: number): number => {
  // Level 1: 5 points, Level 9: 50 points, with linear progression
  return Math.floor(5 + (level - 1) * (45 / (MAX_LEVELS - 1)));
};

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
    // Roguelike properties
    level: 1,
    targetScore: getTargetScore(1),
    remainingTime: STARTING_TIME_MS,
    levelCompleted: false,
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
      // Roguelike properties
      level: 1,
      targetScore: getTargetScore(1),
      remainingTime: STARTING_TIME_MS,
      levelCompleted: false,
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
          level: 1,
          targetScore: getTargetScore(1),
          remainingTime: STARTING_TIME_MS,
          levelCompleted: false,
        };
        
        setState(initialGameState);
        startMultiplayerGame(initialGameState);
        
        setNotification({
          message: `Level 1 started! Target: ${getTargetScore(1)} points. You have 3 minutes!`,
          type: 'info',
        });
      }
    } else {
      // Single player mode
      setState(prev => ({
        ...prev,
        gameStarted: true,
        startTime: Date.now(),
        level: 1,
        targetScore: getTargetScore(1),
        remainingTime: STARTING_TIME_MS,
        levelCompleted: false,
      }));
      
      setNotification({
        message: `Level 1 started! Target: ${getTargetScore(1)} points. You have 3 minutes!`,
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
    const isGameOver = (newDeck.length === 0 && allCombinations.length === 0) || prevState.remainingTime <= 0;
    
    // Update score - In Roguelike mode, each valid combination gives 1 point
    const newScore = prevState.score + 1;
    
    // Check if level is completed with this combination
    const levelCompleted = newScore >= prevState.targetScore;
    
    // If game is in final level and level is completed, or no more combinations and cards, end game
    const isFinalLevelComplete = levelCompleted && prevState.level === MAX_LEVELS;
    const shouldEndGame = isGameOver || isFinalLevelComplete;

    const updatedGameState = shouldEndGame 
      ? {
          ...prevState,
          board: newBoard,
          deck: newDeck,
          selectedCards: [],
          foundCombinations: [...prevState.foundCombinations, selectedCards],
          score: newScore,
          gameEnded: true,
          endTime: Date.now(),
          levelCompleted: levelCompleted,
        }
      : {
          ...prevState,
          board: newBoard,
          deck: newDeck,
          selectedCards: [],
          foundCombinations: [...prevState.foundCombinations, selectedCards],
          score: newScore,
          levelCompleted: levelCompleted,
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

  const updateTimer = useCallback(() => {
    if (state.gameStarted && !state.gameEnded) {
      setState(prevState => {
        // If no time left, end the game
        if (prevState.remainingTime <= 0) {
          setNotification({
            message: `Time's up! Game over at level ${prevState.level}!`,
            type: 'error',
          });
          return {
            ...prevState,
            gameEnded: true,
            endTime: Date.now(),
          };
        }
        
        // Check if level completed
        if (prevState.score >= prevState.targetScore && !prevState.levelCompleted) {
          if (prevState.level === MAX_LEVELS) {
            // Player won the game
            setNotification({
              message: `Congratulations! You completed all ${MAX_LEVELS} levels!`,
              type: 'success',
            });
            return {
              ...prevState,
              gameEnded: true,
              endTime: Date.now(),
              levelCompleted: true,
            };
          } else {
            // Level completed but not the final level
            setNotification({
              message: `Level ${prevState.level} completed! Starting level ${prevState.level + 1}!`,
              type: 'success',
            });
            return {
              ...prevState,
              levelCompleted: true,
            };
          }
        }
        
        // Normal time update
        return {
          ...prevState,
          remainingTime: Math.max(0, prevState.remainingTime - 1000),
        };
      });
    }
  }, [state.gameStarted, state.gameEnded, state.score, state.targetScore, state.level]);
  
  const progressToNextLevel = useCallback(() => {
    if (state.levelCompleted && !state.gameEnded) {
      const nextLevel = state.level + 1;
      setState(prevState => ({
        ...prevState,
        level: nextLevel,
        targetScore: getTargetScore(nextLevel),
        remainingTime: STARTING_TIME_MS,
        levelCompleted: false,
        score: 0, // Reset score for the new level
      }));
      
      setNotification({
        message: `Level ${nextLevel} started! Target: ${getTargetScore(nextLevel)} points. You have 3 minutes!`,
        type: 'info',
      });
    }
  }, [state.levelCompleted, state.gameEnded, state.level]);

  // Add a useEffect for the timer countdown
  useEffect(() => {
    let timerInterval: NodeJS.Timeout;
    
    if (state.gameStarted && !state.gameEnded) {
      timerInterval = setInterval(updateTimer, 1000);
    }
    
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [state.gameStarted, state.gameEnded, updateTimer]);
  
  // Add a useEffect to handle level progression
  useEffect(() => {
    if (state.levelCompleted && !state.gameEnded) {
      const levelCompletionDelay = setTimeout(() => {
        progressToNextLevel();
      }, 2000); // Delay to show completion message
      
      return () => clearTimeout(levelCompletionDelay);
    }
  }, [state.levelCompleted, state.gameEnded, progressToNextLevel]);

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
        // New Roguelike properties
        level={state.level}
        targetScore={state.targetScore}
        remainingTime={state.remainingTime}
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