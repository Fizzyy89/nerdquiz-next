/**
 * Timer Synchronization Utilities
 * 
 * Zentrale Timer-Verwaltung für synchronisierte Timer zwischen Server und Clients.
 * 
 * Das Problem: Clients haben unterschiedliche Systemuhren, die bis zu mehreren
 * Sekunden von der Server-Zeit abweichen können. Dies führt zu asynchronen
 * Timer-Anzeigen.
 * 
 * Die Lösung:
 * 1. Server sendet bei jedem Timer-Event auch seine aktuelle Zeit (serverTime)
 * 2. Clients berechnen einen Offset zwischen ihrer lokalen Zeit und der Server-Zeit
 * 3. Timer werden basierend auf dem Offset berechnet, nicht auf der lokalen Zeit
 */

import type { Server as SocketServer } from 'socket.io';
import type { GameRoom } from './types';

/**
 * Timer-Info Struktur die an Clients gesendet wird
 * Enthält alle Informationen die Clients für synchronisierte Timer brauchen
 */
export interface TimerInfo {
  /** Absolute Endzeit des Timers (Server-Zeit in ms seit Epoch) */
  timerEnd: number;
  /** Aktuelle Server-Zeit zum Zeitpunkt des Sendens (ms seit Epoch) */
  serverTime: number;
  /** Timer-Dauer in Millisekunden (optional, für UI-Berechnungen) */
  durationMs?: number;
}

/**
 * Setzt einen Timer auf einem Room und gibt die Timer-Info zurück
 * 
 * @param room - Das GameRoom-Objekt
 * @param durationMs - Dauer des Timers in Millisekunden
 * @returns TimerInfo für das Event
 */
export function setRoomTimer(room: GameRoom, durationMs: number): TimerInfo {
  const now = Date.now();
  room.state.timerEnd = now + durationMs;
  
  return {
    timerEnd: room.state.timerEnd,
    serverTime: now,
    durationMs,
  };
}

/**
 * Löscht den Timer eines Rooms
 */
export function clearRoomTimer(room: GameRoom): void {
  room.state.timerEnd = null;
}

/**
 * Gibt die aktuelle Timer-Info für einen Room zurück
 * Nützlich für room_update Events
 */
export function getRoomTimerInfo(room: GameRoom): TimerInfo | null {
  if (!room.state.timerEnd) return null;
  
  return {
    timerEnd: room.state.timerEnd,
    serverTime: Date.now(),
  };
}

/**
 * Berechnet die verbleibende Zeit eines Timers
 * Server-seitige Utility für Logging/Debugging
 */
export function getRemainingTime(room: GameRoom): number {
  if (!room.state.timerEnd) return 0;
  return Math.max(0, room.state.timerEnd - Date.now());
}

/**
 * Sendet ein Time-Sync Event an einen Client
 * Wird bei der Verbindung und periodisch aufgerufen
 */
export function sendTimeSync(io: SocketServer, socketId: string): void {
  io.to(socketId).emit('time_sync', {
    serverTime: Date.now(),
  });
}

/**
 * Sendet ein Time-Sync Event an alle Clients in einem Room
 */
export function broadcastTimeSync(io: SocketServer, roomCode: string): void {
  io.to(roomCode).emit('time_sync', {
    serverTime: Date.now(),
  });
}

/**
 * Handler für Time-Sync-Anfrage von einem Client
 * Der Client sendet seine lokale Zeit, wir antworten mit unserer Zeit
 */
export function handleTimeSyncRequest(
  socket: any, 
  clientTime: number
): void {
  socket.emit('time_sync_response', {
    clientTime,
    serverTime: Date.now(),
  });
}
