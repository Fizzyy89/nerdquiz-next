'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Users, Zap } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore, usePlayers, useCurrentPlayer } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Leaderboard } from '@/components/game';
import { cn } from '@/lib/utils';

const ANSWER_COLORS = [
  'from-red-500 to-red-600 hover:from-red-400 hover:to-red-500',
  'from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500',
  'from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500',
  'from-green-500 to-green-600 hover:from-green-400 hover:to-green-500',
];

const ANSWER_BG = [
  'bg-red-500/10 border-red-500/30',
  'bg-blue-500/10 border-blue-500/30',
  'bg-yellow-500/10 border-yellow-500/30',
  'bg-green-500/10 border-green-500/30',
];

export function QuestionScreen() {
  const { submitAnswer } = useSocket();
  const { room, selectedAnswer, setSelectedAnswer, hasSubmitted, setHasSubmitted } = useGameStore();
  const players = usePlayers();
  const currentPlayer = useCurrentPlayer();
  const [timeLeft, setTimeLeft] = useState(0);

  const question = room?.currentQuestion;
  const answeredCount = players.filter(p => p.hasAnswered).length;

  // Timer
  useEffect(() => {
    if (!room?.timerEnd) return;

    const update = () => {
      const remaining = Math.max(0, Math.ceil((room.timerEnd! - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [room?.timerEnd]);

  const handleAnswer = (index: number) => {
    if (!room || hasSubmitted) return;
    
    setSelectedAnswer(index);
    setHasSubmitted(true);
    submitAnswer(index);
  };

  if (!question) return null;

  const progress = room?.timerEnd 
    ? Math.max(0, (room.timerEnd - Date.now()) / (room.settings.timePerQuestion * 1000) * 100)
    : 0;

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen p-4 sm:p-6"
    >
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{question.categoryIcon}</span>
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Frage {(room?.currentQuestionIndex || 0) + 1} / {room?.totalQuestions}
                </p>
                <p className="text-sm text-primary font-bold">{question.category}</p>
              </div>
            </div>

            {/* Timer & Player Count */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">{answeredCount}/{players.length}</span>
              </div>
              <motion.div
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold text-lg',
                  timeLeft <= 5 ? 'bg-red-500/20 text-red-500' : 'glass'
                )}
                animate={timeLeft <= 5 ? { scale: [1, 1.05, 1] } : {}}
                transition={{ repeat: Infinity, duration: 0.5 }}
              >
                <Clock className="w-5 h-5" />
                {timeLeft}s
              </motion.div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-6">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-secondary"
              initial={{ width: '100%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>

          {/* Question */}
          <Card className="glass p-6 sm:p-8 mb-6">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-center leading-tight">
              {question.text}
            </h2>
          </Card>

          {/* Streak Indicator */}
          {currentPlayer && currentPlayer.streak > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 mb-4 text-orange-500"
            >
              <Zap className="w-5 h-5" />
              <span className="font-bold">{currentPlayer.streak}er Streak!</span>
            </motion.div>
          )}

          {/* Answer Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <AnimatePresence mode="wait">
              {question.answers?.map((answer, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Button
                    onClick={() => handleAnswer(index)}
                    disabled={hasSubmitted}
                    className={cn(
                      'w-full h-auto min-h-[4rem] sm:min-h-[5rem] p-4 text-base sm:text-lg font-bold text-white whitespace-normal',
                      'transition-all duration-200',
                      hasSubmitted && selectedAnswer === index
                        ? `bg-gradient-to-br ${ANSWER_COLORS[index]} ring-4 ring-white/50 scale-[1.02]`
                        : hasSubmitted
                        ? 'opacity-50 bg-muted'
                        : `bg-gradient-to-br ${ANSWER_COLORS[index]} btn-3d`
                    )}
                  >
                    <span className="mr-2 opacity-70">{String.fromCharCode(65 + index)}.</span>
                    {answer}
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Submitted State */}
          {hasSubmitted && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mt-6"
            >
              <p className="text-muted-foreground animate-pulse">
                Antwort gesendet! Warte auf andere Spieler...
              </p>
            </motion.div>
          )}

          {/* Player Status (Mobile) */}
          <div className="lg:hidden mt-6">
            <Leaderboard compact showAnswerStatus />
          </div>
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-80">
          <Leaderboard showAnswerStatus />
        </div>
      </div>
    </motion.main>
  );
}
