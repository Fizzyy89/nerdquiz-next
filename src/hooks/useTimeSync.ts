'use client';

/**
 * Time Synchronization Hook
 * 
 * Berechnet und verwaltet den Offset zwischen Server- und Client-Zeit.
 * Ermöglicht synchronisierte Timer-Anzeige über alle Clients hinweg.
 * 
 * Funktionsweise:
 * 1. Client sendet seine lokale Zeit an den Server (time_sync_request)
 * 2. Server antwortet sofort mit seiner Zeit (time_sync_response)
 * 3. Client berechnet den Offset unter Berücksichtigung der Roundtrip-Zeit
 * 4. Der Offset wird für alle Timer-Berechnungen verwendet
 */

import { useEffect, useCallback, useRef } from 'react';
import { create } from 'zustand';
import { getSocket } from '@/lib/socket';

// ============================================
// TIME SYNC STORE
// ============================================

interface TimeSyncState {
  /** 
   * Offset zwischen Server und Client Zeit in Millisekunden
   * Positiv = Server ist voraus, Negativ = Client ist voraus
   * serverTime ≈ clientTime + offset
   */
  offset: number;
  
  /** Ob bereits mindestens ein Sync durchgeführt wurde */
  isSynced: boolean;
  
  /** Anzahl erfolgreicher Syncs (für Stabilität) */
  syncCount: number;
  
  /** Letzte Roundtrip-Zeit in ms (für Diagnose) */
  lastRoundtrip: number;
  
  /** Actions */
  updateOffset: (newOffset: number, roundtrip: number) => void;
  reset: () => void;
}

/**
 * Globaler Store für Time-Sync-Daten
 * Wird von allen Komponenten geteilt
 */
export const useTimeSyncStore = create<TimeSyncState>((set, get) => ({
  offset: 0,
  isSynced: false,
  syncCount: 0,
  lastRoundtrip: 0,
  
  updateOffset: (newOffset: number, roundtrip: number) => {
    const { offset, syncCount } = get();
    
    // Gewichtetes Moving Average für Stabilität
    // Frühere Syncs haben weniger Gewicht als spätere
    const weight = Math.min(0.5, 1 / (syncCount + 1));
    const smoothedOffset = syncCount === 0 
      ? newOffset 
      : offset * (1 - weight) + newOffset * weight;
    
    set({
      offset: Math.round(smoothedOffset),
      isSynced: true,
      syncCount: syncCount + 1,
      lastRoundtrip: roundtrip,
    });
  },
  
  reset: () => set({
    offset: 0,
    isSynced: false,
    syncCount: 0,
    lastRoundtrip: 0,
  }),
}));

// ============================================
// TIME SYNC HOOK
// ============================================

/** Sync-Intervall in ms (30 Sekunden) */
const SYNC_INTERVAL = 30000;

/** Minimale Zeit zwischen Syncs (5 Sekunden) */
const MIN_SYNC_INTERVAL = 5000;

/**
 * Hook für automatische Time-Synchronisation
 * Sollte einmal in der App (z.B. in useSocket) initialisiert werden
 */
export function useTimeSync() {
  const lastSyncRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { updateOffset, reset, isSynced, offset, syncCount } = useTimeSyncStore();

  /**
   * Führt einen Time-Sync durch
   * Sendet Anfrage an Server und berechnet Offset aus Antwort
   */
  const performSync = useCallback(() => {
    const now = Date.now();
    
    // Rate-Limiting
    if (now - lastSyncRef.current < MIN_SYNC_INTERVAL) {
      return;
    }
    lastSyncRef.current = now;
    
    const socket = getSocket();
    if (!socket.connected) return;
    
    const clientSendTime = Date.now();
    socket.emit('time_sync_request', { clientTime: clientSendTime });
  }, []);

  /**
   * Handler für Server-Antwort
   */
  const handleTimeSyncResponse = useCallback((data: { clientTime: number; serverTime: number }) => {
    const clientReceiveTime = Date.now();
    const roundtrip = clientReceiveTime - data.clientTime;
    
    // Geschätzte One-Way-Latenz (Annahme: symmetrisch)
    const oneWayLatency = roundtrip / 2;
    
    // Server-Zeit zum Zeitpunkt des Empfangs beim Client
    // = serverTime + oneWayLatency (Zeit die das Paket unterwegs war)
    const estimatedServerTimeNow = data.serverTime + oneWayLatency;
    
    // Offset = Server-Zeit - Client-Zeit
    const newOffset = estimatedServerTimeNow - clientReceiveTime;
    
    updateOffset(newOffset, roundtrip);
    
    // Debug-Log (nur in Entwicklung)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`⏱️ Time sync: offset=${newOffset}ms, roundtrip=${roundtrip}ms`);
    }
  }, [updateOffset]);

  /**
   * Handler für einfaches time_sync Event (ohne Roundtrip-Messung)
   * Wird vom Server bei Connect gesendet
   */
  const handleTimeSync = useCallback((data: { serverTime: number }) => {
    const clientTime = Date.now();
    // Ohne Roundtrip-Messung nehmen wir einen kleinen Default-Offset an
    const estimatedOffset = data.serverTime - clientTime;
    
    // Nur aktualisieren wenn wir noch nicht synchronisiert sind
    // oder wenn der Unterschied signifikant ist (> 500ms)
    const { isSynced: wasSynced, offset: currentOffset } = useTimeSyncStore.getState();
    if (!wasSynced || Math.abs(estimatedOffset - currentOffset) > 500) {
      updateOffset(estimatedOffset, 0);
    }
  }, [updateOffset]);

  // Socket-Events registrieren und periodischen Sync starten
  useEffect(() => {
    const socket = getSocket();
    
    socket.on('time_sync_response', handleTimeSyncResponse);
    socket.on('time_sync', handleTimeSync);
    
    // Initial Sync wenn verbunden
    if (socket.connected) {
      performSync();
    }
    
    // Bei Connect synchronisieren
    const handleConnect = () => {
      performSync();
    };
    socket.on('connect', handleConnect);
    
    // Periodischer Sync
    intervalRef.current = setInterval(performSync, SYNC_INTERVAL);
    
    return () => {
      socket.off('time_sync_response', handleTimeSyncResponse);
      socket.off('time_sync', handleTimeSync);
      socket.off('connect', handleConnect);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [performSync, handleTimeSyncResponse, handleTimeSync]);

  // Cleanup bei Unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return {
    /** Manuellen Sync auslösen */
    sync: performSync,
    /** Ob synchronisiert */
    isSynced,
    /** Aktueller Offset in ms */
    offset,
    /** Anzahl erfolgreicher Syncs */
    syncCount,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Berechnet die synchronisierte Server-Zeit
 * Verwendet den Offset um die lokale Zeit in Server-Zeit umzurechnen
 */
export function getServerTime(): number {
  const { offset } = useTimeSyncStore.getState();
  return Date.now() + offset;
}

/**
 * Berechnet die verbleibende Zeit bis zu einem Timer-Ende
 * Unter Berücksichtigung des Time-Offsets
 * 
 * WICHTIG: Diese Funktion sollte nur für einmalige Berechnungen verwendet werden.
 * Für kontinuierliche Updates verwende den useGameTimer Hook!
 * 
 * @param timerEnd - Timer-Ende in Server-Zeit (ms seit Epoch)
 * @returns Verbleibende Zeit in Sekunden (aufgerundet)
 */
export function getRemainingSeconds(timerEnd: number | null): number {
  if (!timerEnd) return 0;
  
  const { offset, isSynced } = useTimeSyncStore.getState();
  const effectiveOffset = isSynced ? offset : 0;
  
  const currentServerTime = Date.now() + effectiveOffset;
  const remainingMs = timerEnd - currentServerTime;
  
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/**
 * Berechnet den Timer-Progress (0-100%)
 * 
 * WICHTIG: Diese Funktion sollte nur für einmalige Berechnungen verwendet werden.
 * Für kontinuierliche Updates verwende den useGameTimer Hook!
 * 
 * @param timerEnd - Timer-Ende in Server-Zeit
 * @param durationMs - Gesamt-Dauer des Timers in ms
 */
export function getTimerProgress(
  timerEnd: number | null, 
  durationMs: number
): number {
  if (!timerEnd || durationMs <= 0) return 0;
  
  const remainingSec = getRemainingSeconds(timerEnd);
  const remainingMs = remainingSec * 1000;
  
  return Math.max(0, Math.min(100, (remainingMs / durationMs) * 100));
}
