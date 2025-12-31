import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TUTORIAL_STORAGE_KEY = '@nshapes_tutorial';

export type TutorialStep =
  | 'intro'
  | 'quiz_1'
  | 'quiz_2'
  | 'quiz_3'
  | 'complexity'
  | 'practice'
  | 'ui_tour'
  | 'complete';

export interface TutorialState {
  hasCompletedTutorial: boolean;
  hasBeenOfferedTutorial: boolean;
  currentStep: TutorialStep;
  quizScore: number;
  practiceMatchCount: number;
  isActive: boolean;
}

interface TutorialContextType {
  state: TutorialState;
  startTutorial: () => void;
  endTutorial: (completed: boolean) => void;
  nextStep: () => void;
  setStep: (step: TutorialStep) => void;
  incrementQuizScore: () => void;
  incrementPracticeMatch: () => void;
  markTutorialOffered: () => void;
  resetTutorial: () => void;
}

const defaultState: TutorialState = {
  hasCompletedTutorial: false,
  hasBeenOfferedTutorial: false,
  currentStep: 'intro',
  quizScore: 0,
  practiceMatchCount: 0,
  isActive: false,
};

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<TutorialState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load tutorial state from AsyncStorage on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const stored = await AsyncStorage.getItem(TUTORIAL_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setState(prev => ({
            ...prev,
            hasCompletedTutorial: parsed.hasCompletedTutorial ?? false,
            hasBeenOfferedTutorial: parsed.hasBeenOfferedTutorial ?? false,
          }));
        }
      } catch (error) {
        console.error('Failed to load tutorial state:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadState();
  }, []);

  // Persist relevant state to AsyncStorage
  const persistState = async (updates: Partial<TutorialState>) => {
    try {
      const toPersist = {
        hasCompletedTutorial: updates.hasCompletedTutorial ?? state.hasCompletedTutorial,
        hasBeenOfferedTutorial: updates.hasBeenOfferedTutorial ?? state.hasBeenOfferedTutorial,
      };
      await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(toPersist));
    } catch (error) {
      console.error('Failed to persist tutorial state:', error);
    }
  };

  const startTutorial = () => {
    setState(prev => ({
      ...prev,
      isActive: true,
      currentStep: 'intro',
      quizScore: 0,
      practiceMatchCount: 0,
    }));
  };

  const endTutorial = (completed: boolean) => {
    const updates = {
      hasCompletedTutorial: completed,
      hasBeenOfferedTutorial: true,
      isActive: false,
      currentStep: 'intro' as TutorialStep,
      quizScore: 0,
      practiceMatchCount: 0,
    };
    setState(prev => ({ ...prev, ...updates }));
    persistState(updates);
  };

  const stepOrder: TutorialStep[] = [
    'intro',
    'quiz_1',
    'quiz_2',
    'quiz_3',
    'complexity',
    'practice',
    'ui_tour',
    'complete',
  ];

  const nextStep = () => {
    setState(prev => {
      const currentIndex = stepOrder.indexOf(prev.currentStep);
      const nextIndex = Math.min(currentIndex + 1, stepOrder.length - 1);
      return { ...prev, currentStep: stepOrder[nextIndex] };
    });
  };

  const setStep = (step: TutorialStep) => {
    setState(prev => ({ ...prev, currentStep: step }));
  };

  const incrementQuizScore = () => {
    setState(prev => ({ ...prev, quizScore: prev.quizScore + 1 }));
  };

  const incrementPracticeMatch = () => {
    setState(prev => ({ ...prev, practiceMatchCount: prev.practiceMatchCount + 1 }));
  };

  const markTutorialOffered = () => {
    const updates = { hasBeenOfferedTutorial: true };
    setState(prev => ({ ...prev, ...updates }));
    persistState(updates);
  };

  const resetTutorial = async () => {
    setState(defaultState);
    try {
      await AsyncStorage.removeItem(TUTORIAL_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to reset tutorial state:', error);
    }
  };

  // Don't render children until state is loaded
  if (!isLoaded) {
    return null;
  }

  return (
    <TutorialContext.Provider
      value={{
        state,
        startTutorial,
        endTutorial,
        nextStep,
        setStep,
        incrementQuizScore,
        incrementPracticeMatch,
        markTutorialOffered,
        resetTutorial,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = (): TutorialContextType => {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};

export default TutorialContext;
