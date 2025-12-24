'use client';

import { useEffect, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { RoomState, AnswerResult, FinalRanking } from '@/types/game';
import { getSocket } from '@/lib/socket';
import { saveSession, clearSession } from '@/lib/session';

export function useSocket() {
  const {
    setConnected,
    setPlayer,
    setRoom,
    setLastResults,
    setFinalRankings,
    resetQuestion,
    reset,
  } = useGameStore();

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      console.log('🔌 Connected to server');
      setConnected(true);
    };

    const handleDisconnect = () => {
      console.log('🔌 Disconnected from server');
      setConnected(false);
    };

    const handleRoomUpdate = (room: RoomState) => {
      console.log('📦 Room update:', room.phase);
      setRoom(room);
    };

    const handlePhaseChange = ({ phase }: { phase: string }) => {
      console.log('📍 Phase change:', phase);
      if (phase === 'question' || phase === 'estimation') {
        resetQuestion();
      }
    };

    const handleCategoryMode = (data: { mode: string; loserPlayerId?: string; loserPlayerName?: string }) => {
      console.log('🎲 Category mode:', data.mode, data.loserPlayerName || '');
    };

    const handleCategorySelected = (data: { categoryId: string; categoryName: string; categoryIcon: string }) => {
      console.log('📂 Category selected:', data.categoryName);
    };

    const handleAnswerReveal = (data: { correctIndex?: number; correctValue?: number; unit?: string; results: AnswerResult[] }) => {
      console.log('🎯 Answer reveal:', data);
      setLastResults(data.results);
    };

    const handleGameOver = ({ rankings }: { rankings: FinalRanking[] }) => {
      console.log('🏆 Game over:', rankings);
      setFinalRankings(rankings);
    };

    const handlePlayerJoined = ({ playerName }: { playerName: string }) => {
      console.log(`👤 ${playerName} joined`);
    };

    const handlePlayerDisconnected = ({ playerName }: { playerName: string }) => {
      console.log(`👋 ${playerName} disconnected`);
    };

    const handlePlayerAnswered = ({ playerName }: { playerName: string }) => {
      console.log(`✅ ${playerName} answered`);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('room_update', handleRoomUpdate);
    socket.on('phase_change', handlePhaseChange);
    socket.on('category_mode', handleCategoryMode);
    socket.on('category_selected', handleCategorySelected);
    socket.on('answer_reveal', handleAnswerReveal);
    socket.on('game_over', handleGameOver);
    socket.on('player_joined', handlePlayerJoined);
    socket.on('player_disconnected', handlePlayerDisconnected);
    socket.on('player_answered', handlePlayerAnswered);

    // Connect if not already connected
    if (!socket.connected) {
      socket.connect();
    } else {
      setConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('room_update', handleRoomUpdate);
      socket.off('phase_change', handlePhaseChange);
      socket.off('category_mode', handleCategoryMode);
      socket.off('category_selected', handleCategorySelected);
      socket.off('answer_reveal', handleAnswerReveal);
      socket.off('game_over', handleGameOver);
      socket.off('player_joined', handlePlayerJoined);
      socket.off('player_disconnected', handlePlayerDisconnected);
      socket.off('player_answered', handlePlayerAnswered);
    };
  }, [setConnected, setRoom, setLastResults, setFinalRankings, resetQuestion]);

  // === API Methods ===
  // All methods automatically get roomCode and playerId from store

  const createRoom = useCallback((playerName: string): Promise<{ success: boolean; roomCode?: string; error?: string }> => {
    return new Promise((resolve) => {
      const socket = getSocket();
      socket.emit('create_room', { playerName }, (response: any) => {
        if (response.success) {
          setPlayer(response.playerId, response.roomCode);
          setRoom(response.room);
          // Save session for reconnect
          saveSession({
            playerId: response.playerId,
            roomCode: response.roomCode,
            playerName: playerName.trim(),
          });
        }
        resolve(response);
      });
    });
  }, [setPlayer, setRoom]);

  const joinRoom = useCallback((roomCode: string, playerName: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const socket = getSocket();
      socket.emit('join_room', { roomCode, playerName }, (response: any) => {
        if (response.success) {
          setPlayer(response.playerId, response.roomCode);
          setRoom(response.room);
          // Save session for reconnect
          saveSession({
            playerId: response.playerId,
            roomCode: response.roomCode,
            playerName: playerName.trim(),
          });
        }
        resolve(response);
      });
    });
  }, [setPlayer, setRoom]);

  const reconnectPlayer = useCallback((roomCode: string, playerId: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const socket = getSocket();
      socket.emit('reconnect_player', { roomCode, playerId }, (response: any) => {
        if (response.success) {
          setPlayer(playerId, roomCode);
          setRoom(response.room);
          console.log('🔄 Reconnected to room:', roomCode);
        }
        resolve(response);
      });
    });
  }, [setPlayer, setRoom]);

  const updateSettings = useCallback((settings: any) => {
    const socket = getSocket();
    const { playerId, roomCode } = useGameStore.getState();
    if (!roomCode || !playerId) return;
    socket.emit('update_settings', { roomCode, playerId, settings });
  }, []);

  const startGame = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const socket = getSocket();
      const { playerId, roomCode } = useGameStore.getState();
      
      if (!roomCode || !playerId) {
        resolve({ success: false, error: 'Nicht in einem Raum' });
        return;
      }
      
      console.log('🚀 Starting game:', { roomCode, playerId });
      socket.emit('start_game', { roomCode, playerId }, (response: any) => {
        console.log('🚀 Start game response:', response);
        resolve(response);
      });
    });
  }, []);

  const voteCategory = useCallback((categoryId: string) => {
    const socket = getSocket();
    const { playerId, roomCode } = useGameStore.getState();
    if (!roomCode || !playerId) return;
    socket.emit('vote_category', { roomCode, playerId, categoryId });
  }, []);

  const loserPickCategory = useCallback((categoryId: string) => {
    const socket = getSocket();
    const { playerId, roomCode } = useGameStore.getState();
    if (!roomCode || !playerId) return;
    socket.emit('loser_pick_category', { roomCode, playerId, categoryId });
  }, []);

  const submitAnswer = useCallback((answerIndex: number) => {
    const socket = getSocket();
    const { playerId, roomCode } = useGameStore.getState();
    if (!roomCode || !playerId) return;
    socket.emit('submit_answer', { roomCode, playerId, answerIndex });
  }, []);

  const submitEstimation = useCallback((value: number) => {
    const socket = getSocket();
    const { playerId, roomCode } = useGameStore.getState();
    if (!roomCode || !playerId) return;
    socket.emit('submit_estimation', { roomCode, playerId, value });
  }, []);

  const next = useCallback(() => {
    const socket = getSocket();
    const { playerId, roomCode } = useGameStore.getState();
    if (!roomCode || !playerId) return;
    socket.emit('next', { roomCode, playerId });
  }, []);

  const leaveGame = useCallback(() => {
    clearSession();
    reset();
  }, [reset]);

  return {
    createRoom,
    joinRoom,
    reconnectPlayer,
    updateSettings,
    startGame,
    voteCategory,
    loserPickCategory,
    submitAnswer,
    submitEstimation,
    next,
    leaveGame,
  };
}
