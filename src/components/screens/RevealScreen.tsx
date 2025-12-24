'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ArrowRight, Flame, Clock, Zap, Trophy } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore, useIsHost, useMyResult } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AnswerResult } from '@/types/game';

const ANSWER_COLORS = [
  { border: 'border-red-500', bg: 'bg-red-500/20', text: 'text-red-400' },
  { border: 'border-blue-500', bg: 'bg-blue-500/20', text: 'text-blue-400' },
  { border: 'border-yellow-500', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  { border: 'border-green-500', bg: 'bg-green-500/20', text: 'text-green-400' },
];

type RevealPhase = 'waiting' | 'flying' | 'revealing' | 'results';

export function RevealScreen() {
  const { next } = useSocket();
  const { room, lastResults } = useGameStore();
  const isHost = useIsHost();
  const myResult = useMyResult();
  
  const [phase, setPhase] = useState<RevealPhase>('waiting');
  const [flyingIndex, setFlyingIndex] = useState(-1);
  const [showPointsFor, setShowPointsFor] = useState<string | null>(null);

  const question = room?.currentQuestion;

  // Sort results by answer order for flying animation
  const sortedByAnswerOrder = useMemo(() => {
    if (!lastResults) return [];
    return [...lastResults].sort((a, b) => {
      if (a.answerOrder === null && b.answerOrder === null) return 0;
      if (a.answerOrder === null) return 1;
      if (b.answerOrder === null) return -1;
      return a.answerOrder - b.answerOrder;
    });
  }, [lastResults]);

  // Sort results by points for final display
  const sortedByPoints = useMemo(() => {
    if (!lastResults) return [];
    return [...lastResults].sort((a, b) => b.points - a.points);
  }, [lastResults]);

  // Animation timeline
  useEffect(() => {
    if (!lastResults || lastResults.length === 0) return;
    
    // Start flying after brief pause
    const flyTimer = setTimeout(() => {
      setPhase('flying');
    }, 500);

    return () => clearTimeout(flyTimer);
  }, [lastResults]);

  // Flying animation - one avatar at a time
  useEffect(() => {
    if (phase !== 'flying') return;
    
    const answeredPlayers = sortedByAnswerOrder.filter(r => r.answerOrder !== null);
    
    if (flyingIndex < answeredPlayers.length - 1) {
      const timer = setTimeout(() => {
        setFlyingIndex(prev => prev + 1);
      }, flyingIndex === -1 ? 0 : 300);
      return () => clearTimeout(timer);
    } else {
      // All avatars have flown, reveal correct answer
      const revealTimer = setTimeout(() => {
        setPhase('revealing');
      }, 600);
      return () => clearTimeout(revealTimer);
    }
  }, [phase, flyingIndex, sortedByAnswerOrder]);

  // Show results after reveal
  useEffect(() => {
    if (phase !== 'revealing') return;
    
    const resultsTimer = setTimeout(() => {
      setPhase('results');
    }, 1200);
    
    return () => clearTimeout(resultsTimer);
  }, [phase]);

  const handleNext = () => {
    if (!room || !isHost) return;
    next();
  };

  if (!question || !lastResults) return null;

  const correctIndex = question.correctIndex;

  // Group players by their answer
  const playersByAnswer = useMemo(() => {
    const groups: Record<number, AnswerResult[]> = {};
    lastResults.forEach(result => {
      if (result.answer !== undefined && result.answer !== null) {
        if (!groups[result.answer]) groups[result.answer] = [];
        groups[result.answer].push(result);
      }
    });
    return groups;
  }, [lastResults]);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col p-3 sm:p-6 overflow-hidden"
    >
      {/* Question Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-4 sm:mb-6"
      >
        <p className="text-xs sm:text-sm text-muted-foreground font-medium mb-1">
          Frage {(room?.currentQuestionIndex || 0) + 1} / {room?.totalQuestions}
        </p>
        <h2 className="text-sm sm:text-lg font-bold text-muted-foreground leading-tight px-2">
          {question.text}
        </h2>
      </motion.div>

      {/* Answers Grid */}
      <div className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full max-w-3xl">
          {question.answers?.map((answer, index) => {
            const isCorrect = index === correctIndex;
            const isRevealed = phase === 'revealing' || phase === 'results';
            const playersHere = playersByAnswer[index] || [];
            const colors = ANSWER_COLORS[index];

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="relative"
              >
                <div
                  className={cn(
                    'relative p-3 sm:p-4 rounded-xl border-2 transition-all duration-500',
                    colors.border,
                    colors.bg,
                    isRevealed && isCorrect && 'ring-4 ring-green-500 shadow-lg shadow-green-500/30',
                    isRevealed && !isCorrect && 'opacity-50'
                  )}
                >
                  {/* Correct/Wrong Badge */}
                  {isRevealed && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={cn(
                        'absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center z-10',
                        isCorrect ? 'bg-green-500' : 'bg-red-500/50'
                      )}
                    >
                      {isCorrect ? (
                        <Check className="w-5 h-5 text-white" />
                      ) : (
                        <X className="w-4 h-4 text-white/70" />
                      )}
                    </motion.div>
                  )}

                  {/* Answer Label */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={cn(
                      'w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center font-bold text-sm sm:text-base',
                      colors.bg,
                      colors.text,
                      'border',
                      colors.border
                    )}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="font-medium text-sm sm:text-base flex-1">{answer}</span>
                  </div>

                  {/* Avatars Container */}
                  <div className="mt-3 min-h-[48px] flex flex-wrap gap-1 justify-start">
                    <AnimatePresence>
                      {playersHere.map((result) => {
                        const resultIndex = sortedByAnswerOrder.findIndex(r => r.playerId === result.playerId);
                        const shouldShow = phase === 'results' || 
                          (phase === 'flying' && resultIndex <= flyingIndex) ||
                          (phase === 'revealing' && result.answerOrder !== null);
                        
                        if (!shouldShow) return null;

                        return (
                          <motion.div
                            key={result.playerId}
                            layoutId={`avatar-${result.playerId}`}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="relative group cursor-pointer flex flex-col items-center"
                            onClick={() => setShowPointsFor(showPointsFor === result.playerId ? null : result.playerId)}
                          >
                            <div className="relative">
                              <img
                                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${result.avatarSeed}`}
                                alt={result.playerName}
                                className={cn(
                                  'w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 shadow-lg',
                                  result.correct ? 'border-green-500 bg-green-500/20' : 'border-red-500/50 bg-red-500/10'
                                )}
                              />
                              {/* Response Time Badge */}
                              {result.responseTimeMs !== undefined && result.responseTimeMs !== null && (
                                <div className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-cyan-500/90 text-[8px] sm:text-[9px] font-bold flex items-center justify-center text-white shadow-md">
                                  {(result.responseTimeMs / 1000).toFixed(1)}s
                                </div>
                              )}
                            </div>
                            {/* Player Name */}
                            <span className="text-[9px] sm:text-[10px] mt-1 font-medium text-center truncate max-w-[50px] sm:max-w-[60px]">
                              {result.playerName}
                            </span>
                            {/* Points Popup */}
                            <AnimatePresence>
                              {showPointsFor === result.playerId && phase === 'results' && (
                                <PointsBreakdown result={result} />
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Waiting Area - Players who haven't answered yet */}
      {phase === 'waiting' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-4"
        >
          <div className="flex justify-center items-end gap-2 min-h-[60px]">
            {sortedByAnswerOrder.map((result, index) => (
              <WuselingAvatar
                key={result.playerId}
                result={result}
                index={index}
                total={sortedByAnswerOrder.length}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Results Summary */}
      <AnimatePresence>
        {phase === 'results' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 sm:mt-6"
          >
            {/* My Result Banner */}
            {myResult && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  'mb-4 p-3 sm:p-4 rounded-xl border text-center',
                  myResult.correct 
                    ? 'border-green-500/50 bg-green-500/10' 
                    : 'border-red-500/30 bg-red-500/5'
                )}
              >
                <div className="flex items-center justify-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    myResult.correct ? 'bg-green-500' : 'bg-red-500/50'
                  )}>
                    {myResult.correct ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : (
                      <X className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm sm:text-base">
                      {myResult.correct ? 'Richtig!' : 'Leider falsch'}
                    </p>
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <span className={cn(
                        'font-mono font-bold',
                        myResult.points > 0 ? 'text-green-400' : 'text-muted-foreground'
                      )}>
                        +{myResult.points}
                      </span>
                      {myResult.points > 0 && (
                        <span className="text-muted-foreground">
                          ({myResult.basePoints} + {myResult.timeBonus}⚡ + {myResult.streakBonus}🔥)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Leaderboard for this question */}
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {sortedByPoints.slice(0, 5).map((result, index) => (
                <motion.div
                  key={result.playerId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-full glass',
                    index === 0 && result.points > 0 && 'border-yellow-500/50 bg-yellow-500/10'
                  )}
                >
                  {index === 0 && result.points > 0 && (
                    <Trophy className="w-4 h-4 text-yellow-500" />
                  )}
                  <img
                    src={`https://api.dicebear.com/7.x/bottts/svg?seed=${result.avatarSeed}`}
                    alt=""
                    className="w-6 h-6 rounded-full bg-muted"
                  />
                  <span className="text-xs font-medium truncate max-w-[60px] sm:max-w-none">
                    {result.playerName}
                  </span>
                  <span className={cn(
                    'text-xs font-mono font-bold',
                    result.points > 0 ? 'text-green-400' : 'text-muted-foreground'
                  )}>
                    +{result.points}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Next Button */}
            <div className="text-center">
              {isHost ? (
                <Button
                  onClick={handleNext}
                  className="bg-primary hover:bg-primary/90 px-6 py-5 font-bold text-base"
                >
                  Weiter
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <p className="text-muted-foreground text-sm animate-pulse">
                  Warte auf Host...
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}

// Wuseling Avatar - bounces around waiting
function WuselingAvatar({ 
  result, 
  index,
  total,
}: { 
  result: AnswerResult;
  index: number;
  total: number;
}) {
  const randomOffset = useMemo(() => ({
    x: (Math.random() - 0.5) * 30,
    baseX: ((index - (total - 1) / 2) * 50),
  }), [index, total]);

  return (
    <motion.div
      layoutId={`avatar-${result.playerId}`}
      initial={{ scale: 0, y: 50 }}
      animate={{ 
        scale: 1, 
        y: 0,
        x: randomOffset.baseX,
      }}
      exit={{ scale: 0, opacity: 0 }}
      className="relative flex flex-col items-center"
    >
      <motion.div
        animate={{
          y: [0, -6, 0, -3, 0],
          rotate: [-2, 2, -1, 1, 0],
        }}
        transition={{
          duration: 1.5 + Math.random() * 0.5,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: index * 0.15,
        }}
      >
        <img
          src={`https://api.dicebear.com/7.x/bottts/svg?seed=${result.avatarSeed}`}
          alt={result.playerName}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-muted/80 border-2 border-white/30 shadow-lg"
        />
      </motion.div>
      <span className="text-[10px] mt-1 font-medium bg-background/80 px-1.5 py-0.5 rounded-full">
        {result.playerName}
      </span>
    </motion.div>
  );
}

// Points Breakdown Popup
function PointsBreakdown({ result }: { result: AnswerResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.9 }}
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50"
    >
      <div className="bg-background/95 backdrop-blur border rounded-xl p-3 shadow-xl min-w-[140px]">
        <p className="font-bold text-sm mb-2 text-center">{result.playerName}</p>
        
        <div className="space-y-1 text-xs">
          {result.basePoints > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <Check className="w-3 h-3" /> Richtig
              </span>
              <span className="font-mono text-green-400">+{result.basePoints}</span>
            </div>
          )}
          {result.timeBonus > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" /> Speed
              </span>
              <span className="font-mono text-cyan-400">+{result.timeBonus}</span>
            </div>
          )}
          {result.streakBonus > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <Flame className="w-3 h-3" /> Streak x{result.streak}
              </span>
              <span className="font-mono text-orange-400">+{result.streakBonus}</span>
            </div>
          )}
          {result.responseTimeMs !== null && (
            <div className="flex justify-between items-center pt-1 border-t border-border/50">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Zeit
              </span>
              <span className="font-mono text-muted-foreground">
                {(result.responseTimeMs / 1000).toFixed(1)}s
              </span>
            </div>
          )}
        </div>
        
        <div className="mt-2 pt-2 border-t border-border flex justify-between items-center">
          <span className="font-bold text-sm">Gesamt</span>
          <span className={cn(
            'font-mono font-bold text-sm',
            result.points > 0 ? 'text-green-400' : 'text-muted-foreground'
          )}>
            +{result.points}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
