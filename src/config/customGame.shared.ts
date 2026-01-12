/**
 * Custom Game Configuration
 * 
 * Shared types and utilities for custom game mode.
 * Diese Datei kann sowohl im Server als auch im Client verwendet werden.
 */

import type { CategorySelectionMode } from './gameModes.shared';
import { CATEGORY_SELECTION_MODES_DATA, IMPLEMENTED_BONUS_TYPES_DATA } from './gameModes.shared';

// ============================================
// ROUND TYPES
// ============================================

/**
 * Alle möglichen Rundentypen
 */
export const ROUND_TYPE_IDS = ['question_round', 'hot_button', 'collective_list'] as const;
export type RoundType = typeof ROUND_TYPE_IDS[number];

/**
 * Daten für einen Rundentyp
 */
export interface RoundTypeData {
  id: RoundType;
  name: string;
  emoji: string;
  color: string;
  description: string;
  /** Ob dieser Typ aktuell verfügbar ist */
  isAvailable: boolean;
  /** Ob Kategorie-Modus-Auswahl relevant ist */
  hasCategoryMode: boolean;
}

/**
 * Alle verfügbaren Rundentypen mit Metadaten
 */
export const ROUND_TYPES_DATA: RoundTypeData[] = [
  {
    id: 'question_round',
    name: 'Fragerunde',
    emoji: '🎯',
    color: 'from-blue-500 to-cyan-500',
    description: 'Normale Quizrunde mit Multiple Choice & Schätzfragen',
    isAvailable: true,
    hasCategoryMode: true,
  },
  {
    id: 'hot_button',
    name: 'Hot Button',
    emoji: '⚡',
    color: 'from-yellow-500 to-orange-500',
    description: 'Buzzere und beantworte die Frage so schnell wie möglich!',
    isAvailable: true,
    hasCategoryMode: false,
  },
  {
    id: 'collective_list',
    name: 'Listen-Runde',
    emoji: '📝',
    color: 'from-amber-500 to-yellow-500',
    description: 'Nennt nacheinander alle Begriffe einer Liste!',
    isAvailable: true,
    hasCategoryMode: false,
  },
];

/**
 * Lookup-Map für schnellen Zugriff per ID
 */
export const ROUND_TYPE_DATA_MAP = new Map(
  ROUND_TYPES_DATA.map(type => [type.id, type])
);

// ============================================
// CUSTOM ROUND CONFIGURATION
// ============================================

/**
 * Konfiguration für eine einzelne benutzerdefinierte Runde
 */
export interface CustomRoundConfig {
  /** Eindeutige ID für React keys und Referenzen */
  id: string;
  /** Typ der Runde */
  type: RoundType;
  /** 
   * Für Fragerunden: Wie wird die Kategorie ausgewählt?
   * 'random' = zufällige Auswahl wie im Standard-Modus
   */
  categoryMode?: CategorySelectionMode | 'random';
  /**
   * Für Fragerunden: Anzahl der Fragen (optional, nutzt sonst Settings-Default)
   */
  questionsPerRound?: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generiert eine eindeutige ID für eine neue Runde
 */
export function generateRoundId(): string {
  return `round_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Erstellt eine Standard-Fragerunde
 */
export function createQuestionRound(categoryMode: CategorySelectionMode | 'random' = 'random'): CustomRoundConfig {
  return {
    id: generateRoundId(),
    type: 'question_round',
    categoryMode,
  };
}

/**
 * Erstellt eine Hot Button Runde
 */
export function createHotButtonRound(): CustomRoundConfig {
  return {
    id: generateRoundId(),
    type: 'hot_button',
  };
}

/**
 * Erstellt eine Collective List Runde
 */
export function createCollectiveListRound(): CustomRoundConfig {
  return {
    id: generateRoundId(),
    type: 'collective_list',
  };
}

/**
 * Erstellt ein Standard-Custom-Game-Setup basierend auf der Rundenanzahl
 * (5 Fragerunden mit zufälliger Kategoriewahl als Default)
 */
export function createDefaultCustomRounds(count: number = 5): CustomRoundConfig[] {
  return Array.from({ length: count }, () => createQuestionRound('random'));
}

/**
 * Validiert eine Custom-Game-Konfiguration
 */
export function validateCustomRounds(rounds: CustomRoundConfig[]): { valid: boolean; error?: string } {
  if (!rounds || rounds.length === 0) {
    return { valid: false, error: 'Mindestens eine Runde erforderlich' };
  }

  if (rounds.length > 20) {
    return { valid: false, error: 'Maximal 20 Runden erlaubt' };
  }

  for (const round of rounds) {
    if (!ROUND_TYPE_IDS.includes(round.type)) {
      return { valid: false, error: `Ungültiger Rundentyp: ${round.type}` };
    }

    if (round.type === 'question_round' && round.categoryMode) {
      const validModes = ['random', ...CATEGORY_SELECTION_MODES_DATA.map(m => m.id)];
      if (!validModes.includes(round.categoryMode)) {
        return { valid: false, error: `Ungültiger Kategorie-Modus: ${round.categoryMode}` };
      }
    }
  }

  return { valid: true };
}

/**
 * Gibt den Display-Namen für einen Kategorie-Modus zurück
 */
export function getCategoryModeName(mode: CategorySelectionMode | 'random'): string {
  if (mode === 'random') return 'Zufall';
  const modeData = CATEGORY_SELECTION_MODES_DATA.find(m => m.id === mode);
  return modeData?.name || mode;
}

/**
 * Gibt das Emoji für einen Kategorie-Modus zurück
 */
export function getCategoryModeEmoji(mode: CategorySelectionMode | 'random'): string {
  if (mode === 'random') return '🎲';
  const modeData = CATEGORY_SELECTION_MODES_DATA.find(m => m.id === mode);
  return modeData?.emoji || '❓';
}
