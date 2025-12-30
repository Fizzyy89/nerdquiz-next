'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Trophy, 
  Crown, 
  Medal, 
  Home, 
  Sparkles, 
  RotateCcw, 
  X, 
  Check,
  Clock,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mood based on rank
function getMoodForRank(rank: number): string {
  switch (rank) {
    case 1: return 'superHappy';
    case 2: return 'happy';
    case 3: return 'hopeful';
    default: return 'neutral';
  }
}

export function FinalScreen() {
  const router = useRouter();
  const { leaveGame, voteRematch } = useSocket();
  const finalRankings = useGameStore((s) => s.finalRankings);
  const playerId = useGameStore((s) => s.playerId);
  const room = useGameStore((s) => s.room);
  
  const [hasVoted, setHasVoted] = useState(false);
  const [myVote, setMyVote] = useState<'yes' | 'no' | null>(null);
  const [showConfetti, setShowConfetti] = useState(true);

  // Check if we're in rematch voting phase
  const isRematchVoting = room?.phase === 'rematch_voting';
  const rematchVotes = room?.rematchVotes || {};
  const timerEnd = room?.timerEnd || 0;
  
  // Calculate time left
  const [timeLeft, setTimeLeft] = useState(20);
  
  useEffect(() => {
    if (!isRematchVoting || timerEnd === 0) return;
    
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isRematchVoting, timerEnd]);

  // Get vote counts
  const voteCounts = useMemo(() => {
    const votes = Object.values(rematchVotes);
    return {
      yes: votes.filter(v => v === 'yes').length,
      no: votes.filter(v => v === 'no').length,
      total: votes.length,
    };
  }, [rematchVotes]);

  // Connected players
  const connectedPlayers = useMemo(() => {
    return room?.players?.filter(p => p.isConnected) || [];
  }, [room?.players]);

  const handleLeave = () => {
    leaveGame();
    router.push('/');
  };

  const handleVote = (vote: 'yes' | 'no') => {
    if (hasVoted) return;
    setHasVoted(true);
    setMyVote(vote);
    voteRematch(vote);
  };

  // Confetti on mount
  useEffect(() => {
    if (!showConfetti) return;
    
    const fire = async () => {
      try {
        const confetti = (await import('canvas-confetti')).default;
        
        // Initial burst
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00d4ff', '#ff0080', '#ffcc00'],
        });

        // Side cannons
        setTimeout(() => {
          confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } });
          confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } });
        }, 300);
      } catch {}
    };
    fire();
    
    // Only fire once
    setTimeout(() => setShowConfetti(false), 1000);
  }, [showConfetti]);

  if (!finalRankings || finalRankings.length === 0) return null;

  const winner = finalRankings[0];
  const podium = finalRankings.slice(0, 3);
  const rest = finalRankings.slice(3);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col p-3 sm:p-6 relative overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
      
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col relative z-10">
        
        {/* Champion Section */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.8 }}
          className="text-center py-4 sm:py-6"
        >
          <motion.div
            animate={{ rotate: [0, -5, 5, -5, 0] }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="inline-block mb-4"
          >
            <Trophy className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-accent drop-shadow-[0_0_30px_rgba(255,200,0,0.5)]" />
          </motion.div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 bg-clip-text text-transparent mb-3">
            CHAMPION
          </h1>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-3 sm:gap-4 glass rounded-2xl p-3 sm:p-4 border border-yellow-500/30"
          >
            <div className="relative">
              <img
                src={`https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(winner.avatarSeed)}&mood=superHappy`}
                alt=""
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-muted border-2 border-yellow-500"
              />
              <Crown className="absolute -top-2 -right-2 w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
            </div>
            <div className="text-left">
              <p className="text-lg sm:text-xl font-bold">{winner.name}</p>
              <p className="text-yellow-500 font-mono font-bold text-xl sm:text-2xl">
                {winner.score.toLocaleString()} <span className="text-sm font-normal">Punkte</span>
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Compact Podium */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-end justify-center gap-2 sm:gap-4 mb-6"
        >
          {/* 2nd Place */}
          {podium[1] && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="flex flex-col items-center"
            >
              <img
                src={`https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(podium[1].avatarSeed)}&mood=happy`}
                alt=""
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-muted mb-1 ring-2 ring-slate-400"
              />
              <p className="font-bold text-xs sm:text-sm truncate max-w-[70px] sm:max-w-[90px]">{podium[1].name}</p>
              <div className="w-16 sm:w-20 h-12 sm:h-16 bg-gradient-to-t from-slate-500 to-slate-400 rounded-t-lg flex items-center justify-center mt-1">
                <span className="text-lg sm:text-xl font-black text-white">2</span>
              </div>
            </motion.div>
          )}

          {/* 1st Place */}
          {podium[0] && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="flex flex-col items-center"
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 mb-1 animate-pulse" />
              <img
                src={`https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(podium[0].avatarSeed)}&mood=superHappy`}
                alt=""
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-muted mb-1 ring-2 ring-yellow-500"
              />
              <p className="font-bold text-xs sm:text-sm truncate max-w-[80px] sm:max-w-[100px]">{podium[0].name}</p>
              <div className="w-20 sm:w-24 h-16 sm:h-20 bg-gradient-to-t from-yellow-600 to-yellow-500 rounded-t-lg flex items-center justify-center mt-1">
                <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
            </motion.div>
          )}

          {/* 3rd Place */}
          {podium[2] && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              transition={{ delay: 0.7, duration: 0.4 }}
              className="flex flex-col items-center"
            >
              <img
                src={`https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(podium[2].avatarSeed)}&mood=hopeful`}
                alt=""
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-muted mb-1 ring-2 ring-amber-700"
              />
              <p className="font-bold text-xs sm:text-sm truncate max-w-[70px] sm:max-w-[90px]">{podium[2].name}</p>
              <div className="w-14 sm:w-18 h-10 sm:h-12 bg-gradient-to-t from-amber-800 to-amber-700 rounded-t-lg flex items-center justify-center mt-1">
                <span className="text-lg sm:text-xl font-black text-white">3</span>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Rest of Players - Compact */}
        {rest.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="space-y-1.5 mb-6"
          >
            {rest.map((player, index) => (
              <div
                key={player.playerId}
                className={cn(
                  'flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl glass',
                  player.playerId === playerId && 'ring-1 ring-primary'
                )}
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs sm:text-sm text-muted-foreground">
                  {index + 4}
                </div>
                <img
                  src={`https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(player.avatarSeed)}&mood=neutral`}
                  alt=""
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-muted"
                />
                <span className="flex-1 font-medium truncate text-sm sm:text-base">{player.name}</span>
                <span className="font-mono font-bold text-muted-foreground text-sm sm:text-base">
                  {player.score.toLocaleString()}
                </span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Rematch Voting Section */}
        <AnimatePresence mode="wait">
          {isRematchVoting ? (
            <motion.div
              key="rematch-voting"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-auto"
            >
              <Card className="glass p-4 sm:p-6 border border-primary/30">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 text-primary mb-3">
                    <Clock className="w-4 h-4" />
                    <span className="font-bold">{timeLeft}s</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-1">Nochmal spielen?</h3>
                  <p className="text-sm text-muted-foreground">
                    <Users className="w-4 h-4 inline mr-1" />
                    {voteCounts.total} / {connectedPlayers.length} haben abgestimmt
                  </p>
                </div>

                {/* Vote Buttons */}
                {!hasVoted ? (
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleVote('yes')}
                      className="flex-1 h-14 sm:h-16 text-lg font-bold bg-green-600 hover:bg-green-700 text-white"
                    >
                      <RotateCcw className="w-5 h-5 mr-2" />
                      Ja, nochmal!
                    </Button>
                    <Button
                      onClick={() => handleVote('no')}
                      variant="outline"
                      className="flex-1 h-14 sm:h-16 text-lg font-bold border-red-500/50 text-red-500 hover:bg-red-500/10"
                    >
                      <X className="w-5 h-5 mr-2" />
                      Nein
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={cn(
                        "inline-flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-bold",
                        myVote === 'yes' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                      )}
                    >
                      {myVote === 'yes' ? (
                        <>
                          <Check className="w-5 h-5" />
                          Du spielst nochmal!
                        </>
                      ) : (
                        <>
                          <X className="w-5 h-5" />
                          Du verlässt das Spiel
                        </>
                      )}
                    </motion.div>
                    
                    {/* Vote Progress */}
                    <div className="mt-4 flex justify-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-green-500">
                        <Check className="w-4 h-4" />
                        <span className="font-bold">{voteCounts.yes}</span> Ja
                      </div>
                      <div className="flex items-center gap-1 text-red-500">
                        <X className="w-4 h-4" />
                        <span className="font-bold">{voteCounts.no}</span> Nein
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-auto text-center"
            >
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="w-2 h-2 rounded-full bg-primary/50"
                />
                <span className="text-sm sm:text-base">Gleich kannst du abstimmen...</span>
              </div>
              
              <Button
                onClick={handleLeave}
                variant="outline"
                className="h-12 px-6 text-base font-bold"
              >
                <Home className="w-5 h-5 mr-2" />
                Zurück zum Start
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.main>
  );
}
