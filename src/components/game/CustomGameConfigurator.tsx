'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  Zap,
  ListChecks,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CustomRoundConfig, RoundType } from '@/config/customGame.shared';
import {
  ROUND_TYPES_DATA,
  ROUND_TYPE_DATA_MAP,
  createQuestionRound,
  createHotButtonRound,
  createCollectiveListRound,
  getCategoryModeName,
  getCategoryModeEmoji,
} from '@/config/customGame.shared';
import { CATEGORY_SELECTION_MODES_DATA } from '@/config/gameModes.shared';
import type { CategorySelectionMode } from '@/config/gameModes.shared';

// ============================================
// TYPES
// ============================================

interface CustomGameConfiguratorProps {
  rounds: CustomRoundConfig[];
  onChange: (rounds: CustomRoundConfig[]) => void;
  questionsPerRound: number;
  onQuestionsPerRoundChange: (value: number) => void;
}

// ============================================
// ROUND TYPE SELECTOR
// ============================================

function RoundTypeSelector({
  selectedType,
  onChange,
}: {
  selectedType: RoundType;
  onChange: (type: RoundType) => void;
}) {
  return (
    <div className="flex gap-1">
      {ROUND_TYPES_DATA.filter(t => t.isAvailable).map((type) => (
        <motion.button
          key={type.id}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(type.id)}
          className={`px-2 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
            selectedType === type.id
              ? `bg-gradient-to-r ${type.color} text-white shadow-md`
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}
          title={type.description}
        >
          <span>{type.emoji}</span>
          <span className="hidden sm:inline">{type.name}</span>
        </motion.button>
      ))}
    </div>
  );
}

// ============================================
// CATEGORY MODE SELECTOR
// ============================================

function CategoryModeSelector({
  selectedMode,
  onChange,
}: {
  selectedMode: CategorySelectionMode | 'random';
  onChange: (mode: CategorySelectionMode | 'random') => void;
}) {
  const allModes: Array<{ id: CategorySelectionMode | 'random'; name: string; emoji: string }> = [
    { id: 'random', name: 'Zufall', emoji: '🎲' },
    ...CATEGORY_SELECTION_MODES_DATA.map(m => ({
      id: m.id as CategorySelectionMode,
      name: m.name,
      emoji: m.emoji,
    })),
  ];

  return (
    <select
      value={selectedMode}
      onChange={(e) => onChange(e.target.value as CategorySelectionMode | 'random')}
      className="px-2 py-1 rounded-lg text-xs bg-muted/50 border-0 focus:ring-2 focus:ring-primary/50 cursor-pointer"
    >
      {allModes.map((mode) => (
        <option key={mode.id} value={mode.id}>
          {mode.emoji} {mode.name}
        </option>
      ))}
    </select>
  );
}

// ============================================
// SINGLE ROUND ITEM
// ============================================

function RoundItem({
  round,
  index,
  totalRounds,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  round: CustomRoundConfig;
  index: number;
  totalRounds: number;
  onUpdate: (updated: CustomRoundConfig) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const roundType = ROUND_TYPE_DATA_MAP.get(round.type);
  const isFirstRound = index === 0;
  const isLastRound = index === totalRounds - 1;

  const handleTypeChange = (newType: RoundType) => {
    if (newType === 'question_round') {
      onUpdate({
        ...round,
        type: newType,
        categoryMode: round.categoryMode || 'random',
      });
    } else {
      // Für Bonusrunden: categoryMode entfernen
      const { categoryMode, questionsPerRound, ...rest } = round;
      onUpdate({
        ...rest,
        type: newType,
      });
    }
  };

  const handleCategoryModeChange = (mode: CategorySelectionMode | 'random') => {
    onUpdate({
      ...round,
      categoryMode: mode,
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      className="glass rounded-xl p-3 relative group"
    >
      <div className="flex items-center gap-3">
        {/* Round Number */}
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${roundType?.color || 'from-gray-500 to-gray-600'} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
          {index + 1}
        </div>

        {/* Round Type Selector */}
        <div className="flex-1 min-w-0">
          <RoundTypeSelector
            selectedType={round.type}
            onChange={handleTypeChange}
          />
        </div>

        {/* Category Mode (only for question rounds) */}
        {round.type === 'question_round' && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground hidden sm:inline">Kategorie:</span>
            <CategoryModeSelector
              selectedMode={round.categoryMode || 'random'}
              onChange={handleCategoryModeChange}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Move Up */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onMoveUp}
            disabled={isFirstRound}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              isFirstRound
                ? 'text-muted-foreground/30 cursor-not-allowed'
                : 'bg-muted/50 hover:bg-muted text-foreground'
            }`}
            title="Nach oben"
          >
            <ChevronUp className="w-4 h-4" />
          </motion.button>

          {/* Move Down */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onMoveDown}
            disabled={isLastRound}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              isLastRound
                ? 'text-muted-foreground/30 cursor-not-allowed'
                : 'bg-muted/50 hover:bg-muted text-foreground'
            }`}
            title="Nach unten"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.button>

          {/* Remove */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onRemove}
            disabled={totalRounds <= 1}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              totalRounds <= 1
                ? 'text-muted-foreground/30 cursor-not-allowed'
                : 'bg-destructive/10 hover:bg-destructive/20 text-destructive'
            }`}
            title="Entfernen"
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// ADD ROUND BUTTON
// ============================================

function AddRoundButton({ onAdd }: { onAdd: (type: RoundType) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-3 rounded-xl border-2 border-dashed border-border/50 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        <span>Runde hinzufügen</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 p-2 glass rounded-xl z-20 flex flex-wrap gap-2"
          >
            {ROUND_TYPES_DATA.filter(t => t.isAvailable).map((type) => (
              <motion.button
                key={type.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  onAdd(type.id);
                  setIsOpen(false);
                }}
                className={`flex-1 min-w-[100px] px-3 py-2 rounded-lg bg-gradient-to-r ${type.color} text-white font-medium text-sm shadow-md hover:shadow-lg transition-shadow flex items-center justify-center gap-2`}
              >
                <span>{type.emoji}</span>
                <span>{type.name}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// GAME SUMMARY
// ============================================

function CustomGameSummary({ rounds, questionsPerRound }: { rounds: CustomRoundConfig[]; questionsPerRound: number }) {
  const questionRounds = rounds.filter(r => r.type === 'question_round').length;
  const hotButtonRounds = rounds.filter(r => r.type === 'hot_button').length;
  const collectiveListRounds = rounds.filter(r => r.type === 'collective_list').length;
  
  const totalQuestions = questionRounds * questionsPerRound;
  const estimatedMinutes = Math.round(
    (totalQuestions * 0.5) + // ~30s per question
    (hotButtonRounds * 3) + // ~3 min per hot button
    (collectiveListRounds * 4) // ~4 min per collective list
  );

  return (
    <motion.div 
      className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground py-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-1.5">
        <ListChecks className="w-3.5 h-3.5" />
        <span>{rounds.length} Runden</span>
      </div>
      
      {questionRounds > 0 && (
        <>
          <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{totalQuestions} Fragen</span>
          </div>
        </>
      )}
      
      {(hotButtonRounds > 0 || collectiveListRounds > 0) && (
        <>
          <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          <div className="flex items-center gap-1.5 text-amber-500">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{hotButtonRounds + collectiveListRounds} Bonus</span>
          </div>
        </>
      )}
      
      <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        <span>~{estimatedMinutes} Min</span>
      </div>
    </motion.div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CustomGameConfigurator({
  rounds,
  onChange,
  questionsPerRound,
  onQuestionsPerRoundChange,
}: CustomGameConfiguratorProps) {
  // Update a single round
  const handleUpdateRound = useCallback((index: number, updated: CustomRoundConfig) => {
    const newRounds = [...rounds];
    newRounds[index] = updated;
    onChange(newRounds);
  }, [rounds, onChange]);

  // Remove a round
  const handleRemoveRound = useCallback((index: number) => {
    if (rounds.length <= 1) return;
    const newRounds = rounds.filter((_, i) => i !== index);
    onChange(newRounds);
  }, [rounds, onChange]);

  // Move a round up
  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    const newRounds = [...rounds];
    [newRounds[index - 1], newRounds[index]] = [newRounds[index], newRounds[index - 1]];
    onChange(newRounds);
  }, [rounds, onChange]);

  // Move a round down
  const handleMoveDown = useCallback((index: number) => {
    if (index === rounds.length - 1) return;
    const newRounds = [...rounds];
    [newRounds[index], newRounds[index + 1]] = [newRounds[index + 1], newRounds[index]];
    onChange(newRounds);
  }, [rounds, onChange]);

  // Add a new round
  const handleAddRound = useCallback((type: RoundType) => {
    if (rounds.length >= 20) return;
    
    let newRound: CustomRoundConfig;
    switch (type) {
      case 'hot_button':
        newRound = createHotButtonRound();
        break;
      case 'collective_list':
        newRound = createCollectiveListRound();
        break;
      case 'question_round':
      default:
        newRound = createQuestionRound('random');
        break;
    }
    
    onChange([...rounds, newRound]);
  }, [rounds, onChange]);

  // Quick add templates
  const applyTemplate = useCallback((template: 'standard' | 'bonus_heavy' | 'quiz_only') => {
    let newRounds: CustomRoundConfig[];
    
    switch (template) {
      case 'standard':
        // 4 Fragerunden + 1 Bonusrunde
        newRounds = [
          createQuestionRound('random'),
          createQuestionRound('random'),
          createQuestionRound('random'),
          createQuestionRound('random'),
          createHotButtonRound(),
        ];
        break;
      case 'bonus_heavy':
        // Abwechselnd Fragen und Bonus
        newRounds = [
          createQuestionRound('random'),
          createHotButtonRound(),
          createQuestionRound('random'),
          createCollectiveListRound(),
          createQuestionRound('random'),
        ];
        break;
      case 'quiz_only':
        // Nur Fragerunden mit verschiedenen Modi
        newRounds = [
          createQuestionRound('voting'),
          createQuestionRound('wheel'),
          createQuestionRound('dice_royale'),
          createQuestionRound('voting'),
          createQuestionRound('random'),
        ];
        break;
      default:
        return;
    }
    
    onChange(newRounds);
  }, [onChange]);

  return (
    <div className="space-y-4">
      {/* Quick Templates */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center">Vorlagen:</span>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => applyTemplate('standard')}
          className="px-2 py-1 text-xs rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
          🎮 Standard
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => applyTemplate('bonus_heavy')}
          className="px-2 py-1 text-xs rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
          🎉 Bonus-Heavy
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => applyTemplate('quiz_only')}
          className="px-2 py-1 text-xs rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
          📚 Nur Quiz
        </motion.button>
      </div>

      {/* Questions per Round (for question rounds) */}
      <div className="flex items-center justify-between glass rounded-xl p-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <HelpCircle className="w-4 h-4 text-primary" />
          </div>
          <div>
            <span className="text-sm font-medium">Fragen pro Fragerunde</span>
            <p className="text-xs text-muted-foreground">Gilt für alle Fragerunden</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[3, 5, 7, 10].map((value) => (
            <motion.button
              key={value}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onQuestionsPerRoundChange(value)}
              className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${
                questionsPerRound === value
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              {value}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Round List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout">
          {rounds.map((round, index) => (
            <RoundItem
              key={round.id}
              round={round}
              index={index}
              totalRounds={rounds.length}
              onUpdate={(updated) => handleUpdateRound(index, updated)}
              onRemove={() => handleRemoveRound(index)}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Add Round Button */}
      {rounds.length < 20 && (
        <AddRoundButton onAdd={handleAddRound} />
      )}

      {/* Summary */}
      <CustomGameSummary rounds={rounds} questionsPerRound={questionsPerRound} />
    </div>
  );
}
