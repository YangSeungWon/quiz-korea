import { useReducer, useCallback } from 'react';
import type { QuizState, QuizAction, QuizRegion } from '../types';
import { shuffle, recycleWrong } from '../utils/quizEngine';

const initialState: QuizState = {
  phase: 'ready',
  queue: [],
  currentIndex: 0,
  answered: new Set(),
  wrongAttempts: 0,
  totalRegions: 0,
  wrongFlashCode: null,
};

function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'START':
      return {
        phase: 'playing',
        queue: shuffle(action.regions),
        currentIndex: 0,
        answered: new Set(),
        wrongAttempts: 0,
        totalRegions: action.regions.length,
        wrongFlashCode: null,
      };

    case 'ANSWER_CORRECT': {
      const current = state.queue[state.currentIndex];
      const newAnswered = new Set(state.answered);
      newAnswered.add(current.code);
      const nextIndex = state.currentIndex + 1;
      const isFinished = nextIndex >= state.queue.length;

      return {
        ...state,
        answered: newAnswered,
        currentIndex: nextIndex,
        phase: isFinished ? 'finished' : 'playing',
      };
    }

    case 'ANSWER_WRONG': {
      const wrongCode = state.queue[state.currentIndex].code;
      return {
        ...state,
        wrongAttempts: state.wrongAttempts + 1,
        queue: recycleWrong(state.queue, state.currentIndex),
        wrongFlashCode: wrongCode,
      };
    }

    case 'CLEAR_FLASH':
      return { ...state, wrongFlashCode: null };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

export function useQuizEngine() {
  const [state, dispatch] = useReducer(quizReducer, initialState);

  const start = useCallback((regions: QuizRegion[]) => {
    dispatch({ type: 'START', regions });
  }, []);

  const answerCorrect = useCallback(() => {
    dispatch({ type: 'ANSWER_CORRECT' });
  }, []);

  const answerWrong = useCallback(() => {
    dispatch({ type: 'ANSWER_WRONG' });
    // Clear wrong flash after 400ms
    setTimeout(() => dispatch({ type: 'CLEAR_FLASH' }), 400);
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const currentRegion: QuizRegion | null =
    state.phase === 'playing' && state.currentIndex < state.queue.length
      ? state.queue[state.currentIndex]
      : null;

  const progress = state.totalRegions > 0
    ? Math.round((state.answered.size / state.totalRegions) * 100)
    : 0;

  return {
    state,
    currentRegion,
    progress,
    start,
    answerCorrect,
    answerWrong,
    reset,
  };
}
