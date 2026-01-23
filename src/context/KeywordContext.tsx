/**
 * KeywordContext
 *
 * Manages the state for the keyword tooltip system.
 * Provides functions to open/close tooltips and tracks which keyword is active.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { getKeyword, KeywordDefinition } from '../utils/keywords';

interface KeywordContextValue {
  /** Currently open keyword ID, or null if none */
  activeKeyword: string | null;
  /** The definition of the active keyword */
  activeDefinition: KeywordDefinition | null;
  /** Open a tooltip for a keyword */
  openKeyword: (keywordId: string) => void;
  /** Close the current tooltip */
  closeKeyword: () => void;
  /** Whether a tooltip is currently open */
  isOpen: boolean;
}

const KeywordContext = createContext<KeywordContextValue | undefined>(undefined);

interface KeywordProviderProps {
  children: ReactNode;
}

export const KeywordProvider: React.FC<KeywordProviderProps> = ({ children }) => {
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const [activeDefinition, setActiveDefinition] = useState<KeywordDefinition | null>(null);

  const openKeyword = useCallback((keywordId: string) => {
    const definition = getKeyword(keywordId);
    if (definition) {
      setActiveKeyword(keywordId);
      setActiveDefinition(definition);
    }
  }, []);

  const closeKeyword = useCallback(() => {
    setActiveKeyword(null);
    setActiveDefinition(null);
  }, []);

  const value: KeywordContextValue = {
    activeKeyword,
    activeDefinition,
    openKeyword,
    closeKeyword,
    isOpen: activeKeyword !== null,
  };

  return (
    <KeywordContext.Provider value={value}>
      {children}
    </KeywordContext.Provider>
  );
};

export const useKeyword = (): KeywordContextValue => {
  const context = useContext(KeywordContext);
  if (context === undefined) {
    throw new Error('useKeyword must be used within a KeywordProvider');
  }
  return context;
};

export default KeywordContext;
