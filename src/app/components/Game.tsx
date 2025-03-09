"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, GameState } from '../types';
import { createDeck, shuffleDeck, isValidSet, findAllSets } from '../utils/gameUtils';
import GameBoard from './GameBoard';
import GameInfo from './GameInfo';
import Tutorial from './Tutorial';
import Notification from './Notification';

const INITIAL_CARD_COUNT = 12;
const MAX_BOARD_SIZE = 21;

const Game: React.FC = () => {
  const [state, setState] = useState<GameState>({
    deck: [],
    board: [],
    selectedCards: [],
    foundSets: [],
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

  // Initialize the game
  const initGame = useCallback(() => {
    const deck = shuffleDeck(createDeck());
    const initialBoard = deck.slice(0, INITIAL_CARD_COUNT);
    const remainingDeck = deck.slice(INITIAL_CARD_COUNT);

    setState({
      deck: remainingDeck,
      board: initialBoard,
      selectedCards: [],
      foundSets: [],
      score: 0,
      gameStarted: false,
      gameEnded: false,
      startTime: null,
      endTime: null,
      hintUsed: false,
    });

    setHintCards([]);
    setNotification(null);
  }, []);

  // Start the game when user clicks "New Game"
  const startGame = () => {
    setState(prev => ({
      ...prev,
      gameStarted: true,
      startTime: Date.now(),
    }));
    setNotification({
      message: 'Game started! Find Sets by selecting three cards.',
      type: 'info',
    });
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

      if (newSelectedCards.length === 3) {
        // Check if the selected cards form a valid Set
        const validationResult = isValidSet(newSelectedCards);
        
        if (validationResult.isValid) {
          return handleValidSet(prev, newSelectedCards, newBoard);
        } else {
          // Invalid Set - provide feedback with detailed error message and deselect
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

  // Handle a valid Set being found
  const handleValidSet = (
    prevState: GameState, 
    selectedCards: Card[], 
    currentBoard: Card[]
  ): GameState => {
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
      message: 'You found a Set!',
      type: 'success',
    });

    // Check for game end conditions
    const allSets = findAllSets(newBoard);
    const isGameOver = newDeck.length === 0 && allSets.length === 0;

    if (isGameOver) {
      return {
        ...prevState,
        board: newBoard,
        deck: newDeck,
        selectedCards: [],
        foundSets: [...prevState.foundSets, selectedCards],
        score: prevState.score + 1,
        gameEnded: true,
        endTime: Date.now(),
      };
    }

    return {
      ...prevState,
      board: newBoard,
      deck: newDeck,
      selectedCards: [],
      foundSets: [...prevState.foundSets, selectedCards],
      score: prevState.score + 1,
    };
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

      // Check if there are any Sets with the new cards
      if (findAllSets(newBoard).length === 0 && newDeck.length === 0) {
        return {
          ...prev,
          board: newBoard,
          deck: newDeck,
          gameEnded: true,
          endTime: Date.now(),
        };
      }

      return {
        ...prev,
        board: newBoard,
        deck: newDeck,
      };
    });
  };

  // Provide a hint by highlighting a valid Set
  const handleShowHint = () => {
    const allSets = findAllSets(state.board);
    
    if (allSets.length === 0) {
      setNotification({
        message: 'No Sets available! Try adding more cards.',
        type: 'warning',
      });
      return;
    }

    // Get the first valid Set as a hint
    const hintSet = allSets[0];
    setHintCards(hintSet.map(card => card.id));
    
    setState(prev => ({
      ...prev,
      hintUsed: true,
    }));

    setNotification({
      message: 'Hint: Look for a Set with these highlighted cards!',
      type: 'info',
    });
  };

  // Initialize the game on component mount
  useEffect(() => {
    initGame();
  }, [initGame]);

  // Check if there are any valid Sets in the current board
  useEffect(() => {
    if (state.gameStarted && !state.gameEnded && state.board.length > 0) {
      const allSets = findAllSets(state.board);
      
      if (allSets.length === 0 && state.deck.length === 0) {
        // No Sets available and no cards left in deck - game over
        setState(prev => ({
          ...prev,
          gameEnded: true,
          endTime: Date.now(),
        }));
        
        setNotification({
          message: 'Game Over! No more Sets possible.',
          type: 'info',
        });
      }
    }
  }, [state.board, state.deck.length, state.gameStarted, state.gameEnded]);

  return (
    <div className="flex flex-col items-center max-w-4xl mx-auto p-4">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center">Set Game</h1>
      
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
        foundSetsCount={state.foundSets.length}
        hintAvailable={state.gameStarted && !state.gameEnded}
        canAddCards={state.gameStarted && !state.gameEnded && state.deck.length > 0 && state.board.length < MAX_BOARD_SIZE}
      />
      
      {!state.gameStarted && !state.gameEnded && (
        <div className="my-6 text-center">
          <p className="mb-4">Welcome to the game of Set! Select three cards that form a Set.</p>
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