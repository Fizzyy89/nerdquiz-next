'use client';

/**
 * GameTimer - Zentrale Timer-Komponente
 * 
 * Synchronisierte Timer-Anzeige über Server-Zeit.
 * Verwendet den Time-Sync-Offset für korrekte Anzeige auf allen Clients.
 * 
 * Features:
 * - Automatische Synchronisation mit Server-Zeit
 * - Verschiedene Darstellungsmodi (Text, Progress, Compact)
 * - Warnfarben bei niedriger Zeit
 * - Animationen bei kritischer Zeit
 * - Optional: Callback bei Timer-Ende
 */

import { useState, useEffect, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { useTimeSyncStore } from '@/hooks/useTimeSync';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

export interface GameTimerProps {
  /** Timer-Ende in Server-Zeit (ms seit Epoch) */
  timerEnd: number | null;
  
  /** Server-Zeit zum Zeitpunkt des letzten Updates (optional, verbessert Genauigkeit) */
  serverTime?: number;
  
  /** Gesamt-Dauer des Timers in ms (für Progress-Berechnung) */
  durationMs?: number;
  
  /** Schwelle in Sekunden ab der Warnung angezeigt wird (default: 5) */
  warningThreshold?: number;
  
  /** Schwelle in Sekunden ab der kritischer Zustand angezeigt wird (default: 3) */
  criticalThreshold?: number;
  
  /** Darstellungsmodus */
  variant?: 'default' | 'compact' | 'progress' | 'minimal';
  
  /** Zusätzliche CSS-Klassen */
  className?: string;
  
  /** Callback wenn Timer abläuft */
  onExpire?: () => void;
  
  /** Timer verstecken wenn abgelaufen */
  hideWhenExpired?: boolean;
  
  /** Icon anzeigen */
  showIcon?: boolean;
  
  /** Sekunden statt Countdown-Text */
  showSeconds?: boolean;
}

// ============================================
// HOOK: useGameTimer
// ============================================

/**
 * Hook für synchronisierte Timer-Berechnung
 * Kann auch ohne die Komponente verwendet werden
 * 
 * Wichtig: serverTime wird nur EINMALIG verwendet um den initialen Offset
 * für diesen Timer zu berechnen. Danach wird Date.now() mit diesem festen
 * Offset verwendet, damit der Timer korrekt herunterzählt.
 */
export function useGameTimer(
  timerEnd: number | null,
  serverTime?: number
): {
  /** Verbleibende Zeit in Sekunden */
  remaining: number;
  /** Ob Timer abgelaufen ist */
  isExpired: boolean;
  /** Progress 0-100 (wenn durationMs bekannt) */
  progress: number;
} {
  const { offset: globalOffset, isSynced } = useTimeSyncStore();
  const [remaining, setRemaining] = useState(0);
  
  // Berechne den effektiven Offset EINMALIG wenn sich timerEnd oder serverTime ändern
  // Dieser Offset bleibt dann konstant für die Lebensdauer dieses Timers
  const effectiveOffset = useMemo(() => {
    if (serverTime) {
      // Wenn serverTime mitgesendet wird, berechne Offset daraus
      // serverTime ist der Zeitpunkt als der Server das Event gesendet hat
      // Wir speichern die Differenz zum Zeitpunkt des Empfangs
      return serverTime - Date.now();
    }
    // Sonst verwende den globalen Sync-Offset
    return isSynced ? globalOffset : 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerEnd, serverTime]); // Nur neu berechnen bei neuem Timer, nicht bei offset-Änderungen

  // Update-Interval - verwendet den festen effectiveOffset
  useEffect(() => {
    if (!timerEnd) {
      setRemaining(0);
      return;
    }

    const calculateRemaining = () => {
      // Aktuelle Server-Zeit = lokale Zeit + fester Offset
      const currentServerTime = Date.now() + effectiveOffset;
      const remainingMs = timerEnd - currentServerTime;
      return Math.max(0, Math.ceil(remainingMs / 1000));
    };

    // Sofortiges Update
    setRemaining(calculateRemaining());

    // Alle 100ms aktualisieren für flüssige Anzeige
    const interval = setInterval(() => {
      setRemaining(calculateRemaining());
    }, 100);

    return () => clearInterval(interval);
  }, [timerEnd, effectiveOffset]);

  return {
    remaining,
    isExpired: remaining === 0 && timerEnd !== null,
    progress: 0, // Wird von der Komponente berechnet wenn durationMs bekannt
  };
}

// ============================================
// COMPONENT: GameTimer
// ============================================

/**
 * Zentrale Timer-Komponente für alle Spiel-Phasen
 */
export const GameTimer = memo(function GameTimer({
  timerEnd,
  serverTime,
  durationMs,
  warningThreshold = 5,
  criticalThreshold = 3,
  variant = 'default',
  className,
  onExpire,
  hideWhenExpired = false,
  showIcon = true,
  showSeconds = true,
}: GameTimerProps) {
  const { remaining, isExpired } = useGameTimer(timerEnd, serverTime);
  const [hasExpired, setHasExpired] = useState(false);

  // Progress berechnen
  const progress = durationMs && durationMs > 0
    ? Math.max(0, Math.min(100, (remaining * 1000 / durationMs) * 100))
    : 0;

  // Timer-Status
  const isWarning = remaining <= warningThreshold && remaining > criticalThreshold;
  const isCritical = remaining <= criticalThreshold && remaining > 0;

  // Callback bei Ablauf (nur einmal)
  useEffect(() => {
    if (isExpired && !hasExpired && onExpire) {
      setHasExpired(true);
      onExpire();
    }
    
    // Reset wenn neuer Timer startet
    if (!isExpired && hasExpired) {
      setHasExpired(false);
    }
  }, [isExpired, hasExpired, onExpire]);

  // Verstecken wenn abgelaufen
  if (hideWhenExpired && isExpired) {
    return null;
  }

  // Nicht rendern wenn kein Timer
  if (!timerEnd) {
    return null;
  }

  // Farben basierend auf Status
  const colorClasses = cn(
    'transition-colors duration-300',
    isCritical && 'bg-red-500/20 text-red-500 border-red-500/30',
    isWarning && !isCritical && 'bg-amber-500/20 text-amber-500 border-amber-500/30',
    !isWarning && !isCritical && 'bg-muted/50 text-foreground border-muted',
  );

  // Varianten
  switch (variant) {
    case 'minimal':
      return (
        <span className={cn('font-mono font-bold', className, isCritical && 'text-red-500')}>
          {remaining}s
        </span>
      );

    case 'compact':
      return (
        <motion.div
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-mono font-bold border',
            colorClasses,
            className
          )}
          animate={isCritical ? { scale: [1, 1.05, 1] } : {}}
          transition={{ repeat: Infinity, duration: 0.5 }}
        >
          {showIcon && <Clock className="w-3 h-3" />}
          {remaining}s
        </motion.div>
      );

    case 'progress':
      return (
        <div className={cn('w-full', className)}>
          <div className="flex items-center justify-between mb-1">
            {showIcon && <Clock className={cn('w-4 h-4', isCritical && 'text-red-500')} />}
            {showSeconds && (
              <span className={cn('font-mono font-bold text-sm', isCritical && 'text-red-500')}>
                {remaining}s
              </span>
            )}
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className={cn(
                'h-full rounded-full transition-colors',
                isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-primary'
              )}
              initial={{ width: '100%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1, ease: 'linear' }}
            />
          </div>
        </div>
      );

    case 'default':
    default:
      return (
        <motion.div
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold text-lg border',
            colorClasses,
            className
          )}
          animate={isCritical ? { scale: [1, 1.05, 1] } : {}}
          transition={{ repeat: Infinity, duration: 0.5 }}
        >
          {showIcon && <Clock className="w-5 h-5" />}
          {remaining}s
        </motion.div>
      );
  }
});

// ============================================
// EXPORTS
// ============================================

export default GameTimer;
