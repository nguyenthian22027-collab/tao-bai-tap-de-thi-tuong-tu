import { useState, useCallback, useEffect } from 'react';

export function useUndoRedo<T>(initialState: T, maxHistory = 50) {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [index, setIndex] = useState<number>(0);

  const state = history[index];

  const setState = useCallback((action: T | ((prev: T) => T)) => {
    setHistory(prevHistory => {
      const currentVal = prevHistory[index];
      const newVal = typeof action === 'function' ? (action as (p: T) => T)(currentVal) : action;
      
      // If no actual change, ignore
      if (JSON.stringify(currentVal) === JSON.stringify(newVal)) {
        return prevHistory;
      }

      const newHistory = prevHistory.slice(0, index + 1);
      newHistory.push(newVal);

      if (newHistory.length > maxHistory) {
        newHistory.shift();
      }

      setIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [index, maxHistory]);

  const undo = useCallback(() => {
    if (index > 0) {
      setIndex(prev => prev - 1);
    }
  }, [index]);

  const redo = useCallback(() => {
    if (index < history.length - 1) {
      setIndex(prev => prev + 1);
    }
  }, [index, history.length]);

  const canUndo = index > 0;
  const canRedo = index < history.length - 1;

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const resetState = useCallback((newState: T) => {
    setHistory([newState]);
    setIndex(0);
  }, []);

  return {
    state,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    resetState
  };
}
