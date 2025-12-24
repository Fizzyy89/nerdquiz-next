/**
 * Zustand Game Store
 */

import { create } from 'zustand';
import type { RoomState, AnswerResult, FinalRanking, Player } from '@/types/game';

interface GameStore {
  // Connection
  isConnected: boolean;
  playerId: string | null;
  roomCode: string | null;
  
  // Room State
  room: RoomState | null;
  
  // UI State
  selectedAnswer: number | null;
  estimationValue: string;
  hasSubmitted: boolean;
  
  // Results
  lastResults: AnswerResult[] | null;
  finalRankings: FinalRanking[] | null;
  
  // Actions
  setConnected: (connected: boolean) => void;
  setPlayer: (playerId: string, roomCode: string) => void;
  setRoom: (room: RoomState | null) => void;
  setSelectedAnswer: (index: number | null) => void;
  setEstimationValue: (value: string) => void;
  setHasSubmitted: (submitted: boolean) => void;
  setLastResults: (results: AnswerResult[] | null) => void;
  setFinalRankings: (rankings: FinalRanking[] | null) => void;
  
  // Utility
  reset: () => void;
  resetQuestion: () => void;
}

const initialState = {
  isConnected: false,
  playerId: null as string | null,
  roomCode: null as string | null,
  room: null as RoomState | null,
  selectedAnswer: null as number | null,
  estimationValue: '',
  hasSubmitted: false,
  lastResults: null as AnswerResult[] | null,
  finalRankings: null as FinalRanking[] | null,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  
  setConnected: (connected) => set({ isConnected: connected }),
  
  setPlayer: (playerId, roomCode) => set({ playerId, roomCode }),
  
  setRoom: (room) => set({ room }),
  
  setSelectedAnswer: (index) => set({ selectedAnswer: index }),
  
  setEstimationValue: (value) => set({ estimationValue: value }),
  
  setHasSubmitted: (submitted) => set({ hasSubmitted: submitted }),
  
  setLastResults: (results) => set({ lastResults: results }),
  
  setFinalRankings: (rankings) => set({ finalRankings: rankings }),
  
  reset: () => set(initialState),
  
  resetQuestion: () => set({ 
    selectedAnswer: null, 
    estimationValue: '',
    hasSubmitted: false,
    lastResults: null,
  }),
}));

// Hook-based selectors
export const useIsHost = () => {
  const playerId = useGameStore((s) => s.playerId);
  const players = useGameStore((s) => s.room?.players);
  
  if (!playerId || !players) return false;
  return players.find(p => p.id === playerId)?.isHost ?? false;
};

export const useCurrentPlayer = () => {
  const playerId = useGameStore((s) => s.playerId);
  const players = useGameStore((s) => s.room?.players);
  
  if (!playerId || !players) return null;
  return players.find(p => p.id === playerId) ?? null;
};

export const usePlayers = () => useGameStore((s) => s.room?.players ?? []);

export const useMyResult = () => {
  const playerId = useGameStore((s) => s.playerId);
  const lastResults = useGameStore((s) => s.lastResults);
  
  if (!playerId || !lastResults) return null;
  return lastResults.find(r => r.playerId === playerId) ?? null;
};
