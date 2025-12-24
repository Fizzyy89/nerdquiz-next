/**
 * Session Persistence für NerdQuiz
 * Speichert playerId, roomCode und playerName im localStorage
 * für automatisches Reconnect nach Page Refresh
 */

const SESSION_KEY = 'nerdquiz_session';

export interface GameSession {
  playerId: string;
  roomCode: string;
  playerName: string;
  timestamp: number;
}

/**
 * Speichert die aktuelle Session
 */
export function saveSession(session: Omit<GameSession, 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  
  const data: GameSession = {
    ...session,
    timestamp: Date.now(),
  };
  
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    console.log('💾 Session saved:', session.roomCode, session.playerName);
  } catch (error) {
    console.error('Failed to save session:', error);
  }
}

/**
 * Lädt die gespeicherte Session
 * Gibt null zurück wenn keine Session existiert oder sie älter als 2 Stunden ist
 */
export function loadSession(): GameSession | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    
    const session: GameSession = JSON.parse(stored);
    
    // Session ist maximal 2 Stunden gültig
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours in ms
    if (Date.now() - session.timestamp > maxAge) {
      clearSession();
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Failed to load session:', error);
    return null;
  }
}

/**
 * Löscht die Session
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(SESSION_KEY);
    console.log('🗑️ Session cleared');
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
}

/**
 * Prüft ob eine gültige Session für einen bestimmten Room existiert
 */
export function hasSessionForRoom(roomCode: string): boolean {
  const session = loadSession();
  return session !== null && session.roomCode.toUpperCase() === roomCode.toUpperCase();
}

