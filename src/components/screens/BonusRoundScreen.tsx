'use client';

import { useGameStore } from '@/store/gameStore';
import { CollectiveListGame } from './bonus-rounds/CollectiveListGame';
import type { BonusRoundState } from '@/types/game';

/**
 * BonusRoundScreen - Router für verschiedene Bonusrunden-Spieltypen
 * 
 * Entscheidet basierend auf dem `questionType` welcher Spieltyp angezeigt wird.
 * Aktuell unterstützt:
 * - "Liste" / "collective_list" → CollectiveListGame
 * 
 * Zukünftig geplant:
 * - "Sortieren" → SortingGame
 * - "Zuordnen" → MatchingGame
 * - "Texteingabe" → TextInputGame
 */
export function BonusRoundScreen() {
  const room = useGameStore((s) => s.room);
  const bonusRound = room?.bonusRound as BonusRoundState | null;

  if (!bonusRound) return null;

  // Route to appropriate game type based on questionType
  const questionType = bonusRound.questionType?.toLowerCase() || 'liste';

  switch (questionType) {
    case 'liste':
    case 'collective_list':
    case 'sammelliste':
      return <CollectiveListGame />;
    
    // Zukünftige Spieltypen:
    // case 'sortieren':
    // case 'sorting':
    //   return <SortingGame />;
    
    // case 'zuordnen':
    // case 'matching':
    //   return <MatchingGame />;
    
    // case 'texteingabe':
    // case 'text_input':
    //   return <TextInputGame />;
    
    default:
      // Fallback: CollectiveListGame als Standard
      console.warn(`Unknown bonus round type: ${questionType}, falling back to CollectiveListGame`);
      return <CollectiveListGame />;
  }
}
