'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Crown, Clock, Check, RefreshCw } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { getSocket } from '@/lib/socket';

// Dice faces as Unicode
const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

interface DuelPlayer {
  id: string;
  name: string;
  avatarSeed: string;
}

interface CategorySelectedData {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
}

export function DiceDuelScreen() {
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  
  const [phase, setPhase] = useState<'selecting' | 'rolling' | 'result' | 'picking' | 'selected'>('selecting');
  const [player1, setPlayer1] = useState<DuelPlayer | null>(null);
  const [player2, setPlayer2] = useState<DuelPlayer | null>(null);
  const [player1Rolls, setPlayer1Rolls] = useState<number[] | null>(null);
  const [player2Rolls, setPlayer2Rolls] = useState<number[] | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [isTie, setIsTie] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [revealedCategory, setRevealedCategory] = useState<CategorySelectedData | null>(null);

  const categories = room?.votingCategories || [];
  
  // Try to get players from room state as fallback
  const diceDuel = room?.diceDuel;
  const player1FromRoom = diceDuel?.player1Id 
    ? room?.players.find(p => p.id === diceDuel.player1Id)
    : null;
  const player2FromRoom = diceDuel?.player2Id 
    ? room?.players.find(p => p.id === diceDuel.player2Id)
    : null;

  // Use state or fallback to room data
  const effectivePlayer1 = player1 || (player1FromRoom ? {
    id: player1FromRoom.id,
    name: player1FromRoom.name,
    avatarSeed: player1FromRoom.avatarSeed,
  } : null);
  const effectivePlayer2 = player2 || (player2FromRoom ? {
    id: player2FromRoom.id,
    name: player2FromRoom.name,
    avatarSeed: player2FromRoom.avatarSeed,
  } : null);

  const isParticipant = playerId === effectivePlayer1?.id || playerId === effectivePlayer2?.id;
  const isWinner = playerId === winnerId;

  // Sync state with room data if not set
  useEffect(() => {
    if (!player1 && player1FromRoom) {
      setPlayer1({
        id: player1FromRoom.id,
        name: player1FromRoom.name,
        avatarSeed: player1FromRoom.avatarSeed,
      });
    }
    if (!player2 && player2FromRoom) {
      setPlayer2({
        id: player2FromRoom.id,
        name: player2FromRoom.name,
        avatarSeed: player2FromRoom.avatarSeed,
      });
    }
  }, [player1, player2, player1FromRoom, player2FromRoom]);

  // Socket event listeners
  useEffect(() => {
    const socket = getSocket();

    const handleDuelStart = (data: { player1: DuelPlayer; player2: DuelPlayer }) => {
      console.log('🎲 Dice duel start:', data);
      setPlayer1(data.player1);
      setPlayer2(data.player2);
      setPhase('selecting');
      // Reset state
      setPlayer1Rolls(null);
      setPlayer2Rolls(null);
      setWinnerId(null);
      setIsTie(false);
      setHasRolled(false);
      setSelectedCategory(null);
      setRevealedCategory(null);
    };

    const handleDuelReady = () => {
      console.log('🎲 Dice duel ready to roll');
      setPhase('rolling');
      setIsTie(false);
    };

    const handleDiceRoll = (data: { playerId: string; rolls: number[] }) => {
      console.log('🎲 Dice roll:', data);
      if (data.playerId === effectivePlayer1?.id) {
        setPlayer1Rolls(data.rolls);
      } else if (data.playerId === effectivePlayer2?.id) {
        setPlayer2Rolls(data.rolls);
      }
      if (data.playerId === playerId) {
        setIsRolling(false);
      }
    };

    const handleDuelTie = () => {
      console.log('🎲 Dice duel tie!');
      setIsTie(true);
      // Reset rolls for next round
      setTimeout(() => {
        setPlayer1Rolls(null);
        setPlayer2Rolls(null);
        setHasRolled(false);
      }, 1500);
    };

    const handleDuelWinner = (data: { winnerId: string; sum1: number; sum2: number }) => {
      console.log('🎲 Dice duel winner:', data);
      setWinnerId(data.winnerId);
      setPhase('result');
    };

    const handleDuelPick = () => {
      console.log('🎲 Winner can now pick');
      setPhase('picking');
    };

    const handleCategorySelected = (data: CategorySelectedData) => {
      console.log('🎲 Category selected:', data);
      setRevealedCategory(data);
      setPhase('selected');
    };

    socket.on('dice_duel_start', handleDuelStart);
    socket.on('dice_duel_ready', handleDuelReady);
    socket.on('dice_roll', handleDiceRoll);
    socket.on('dice_duel_tie', handleDuelTie);
    socket.on('dice_duel_winner', handleDuelWinner);
    socket.on('dice_duel_pick', handleDuelPick);
    socket.on('category_selected', handleCategorySelected);

    return () => {
      socket.off('dice_duel_start', handleDuelStart);
      socket.off('dice_duel_ready', handleDuelReady);
      socket.off('dice_roll', handleDiceRoll);
      socket.off('dice_duel_tie', handleDuelTie);
      socket.off('dice_duel_winner', handleDuelWinner);
      socket.off('dice_duel_pick', handleDuelPick);
      socket.off('category_selected', handleCategorySelected);
    };
  }, [effectivePlayer1?.id, effectivePlayer2?.id, playerId]);

  // Timer for picking phase
  useEffect(() => {
    if (phase !== 'picking' || !room?.timerEnd) return;

    const update = () => {
      const remaining = Math.max(0, Math.ceil((room.timerEnd! - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [phase, room?.timerEnd]);

  const handleRoll = () => {
    if (!isParticipant || hasRolled || phase !== 'rolling') return;
    
    setIsRolling(true);
    setHasRolled(true);
    
    const socket = getSocket();
    socket.emit('dice_roll', { roomCode: room?.code, playerId });
  };

  const handlePick = (categoryId: string) => {
    if (!isWinner || selectedCategory || phase !== 'picking') return;
    
    setSelectedCategory(categoryId);
    const socket = getSocket();
    socket.emit('dice_duel_pick', { roomCode: room?.code, playerId, categoryId });
  };

  // Show category reveal
  if (revealedCategory) {
    const winner = winnerId === effectivePlayer1?.id ? effectivePlayer1 : effectivePlayer2;
    return (
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen flex flex-col items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <motion.div className="text-5xl mb-4">🎲</motion.div>
          
          <div className="flex items-center justify-center gap-3 mb-6">
            <img
              src={`https://api.dicebear.com/7.x/bottts/svg?seed=${winner?.avatarSeed}`}
              alt=""
              className="w-10 h-10 rounded-full bg-muted border-2 border-amber-500"
            />
            <span className="text-lg">{winner?.name} hat gewählt:</span>
          </div>

          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="glass px-12 py-8 rounded-3xl border-2 border-amber-500/50"
          >
            <span className="text-6xl block mb-4">{revealedCategory.categoryIcon}</span>
            <h2 className="text-4xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              {revealedCategory.categoryName}
            </h2>
          </motion.div>
        </motion.div>
      </motion.main>
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col p-4 md:p-8"
    >
      {/* Header */}
      <div className="text-center py-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 text-red-400 mb-4"
        >
          <Swords className="w-5 h-5" />
          <span className="font-bold">Würfel-Duell</span>
          <Swords className="w-5 h-5" />
        </motion.div>

        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-2xl md:text-3xl font-black"
        >
          {phase === 'selecting' && 'Die Herausforderer werden gewählt...'}
          {phase === 'rolling' && 'Würfelt!'}
          {phase === 'result' && `${winnerId === effectivePlayer1?.id ? effectivePlayer1?.name : effectivePlayer2?.name} gewinnt!`}
          {phase === 'picking' && 'Der Sieger wählt...'}
        </motion.h1>

        {isTie && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/20 text-yellow-400"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Gleichstand! Nochmal würfeln!</span>
          </motion.div>
        )}
      </div>

      {/* Duel Arena */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="flex items-center justify-center gap-8 md:gap-16 w-full max-w-2xl">
          {/* Player 1 */}
          <PlayerDuelCard
            player={effectivePlayer1}
            rolls={player1Rolls}
            isWinner={winnerId === effectivePlayer1?.id}
            isSelecting={phase === 'selecting'}
            delay={0}
          />

          {/* VS */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.5, type: 'spring' }}
            className="text-4xl md:text-6xl font-black text-red-500"
          >
            ⚔️
          </motion.div>

          {/* Player 2 */}
          <PlayerDuelCard
            player={effectivePlayer2}
            rolls={player2Rolls}
            isWinner={winnerId === effectivePlayer2?.id}
            isSelecting={phase === 'selecting'}
            delay={0.3}
          />
        </div>

        {/* Roll Button */}
        {phase === 'rolling' && isParticipant && (
          <motion.button
            initial={{ scale: 0, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRoll}
            disabled={hasRolled}
            className={`px-12 py-6 rounded-2xl font-black text-2xl transition-all ${
              hasRolled
                ? 'bg-muted text-muted-foreground'
                : 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/30'
            }`}
          >
            {isRolling ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
                className="inline-block"
              >
                🎲
              </motion.span>
            ) : hasRolled ? (
              <>Gewürfelt! ✓</>
            ) : (
              <>🎲 WÜRFELN! 🎲</>
            )}
          </motion.button>
        )}

        {/* Spectator message */}
        {phase === 'rolling' && !isParticipant && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-muted-foreground animate-pulse"
          >
            Warte auf die Würfel...
          </motion.p>
        )}
      </div>

      {/* Category Picking (for winner) */}
      {phase === 'picking' && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="pb-4"
        >
          {/* Timer */}
          <div className="text-center mb-4">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              timeLeft <= 5 ? 'bg-red-500/20 text-red-400' : 'glass'
            }`}>
              <Clock className="w-4 h-4" />
              {timeLeft}s
            </span>
          </div>

          {/* Categories */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
            {categories.map((cat, i) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <motion.button
                  key={cat.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.05 * i }}
                  onClick={() => handlePick(cat.id)}
                  disabled={!isWinner || !!selectedCategory}
                  className={`relative p-4 rounded-xl text-center transition-all ${
                    isWinner && !selectedCategory
                      ? 'glass hover:bg-amber-500/20 hover:border-amber-500/50 cursor-pointer'
                      : 'glass opacity-60'
                  } ${isSelected ? 'ring-2 ring-amber-500 bg-amber-500/20' : ''}`}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-black" />
                    </motion.div>
                  )}
                  <span className="text-2xl block mb-1">{cat.icon}</span>
                  <span className="font-bold text-xs">{cat.name}</span>
                </motion.button>
              );
            })}
          </div>

          {!isWinner && (
            <p className="text-center text-muted-foreground mt-4 animate-pulse">
              Der Sieger wählt die Kategorie...
            </p>
          )}
        </motion.div>
      )}
    </motion.main>
  );
}

// Player Duel Card Component
function PlayerDuelCard({
  player,
  rolls,
  isWinner,
  isSelecting,
  delay,
}: {
  player: DuelPlayer | null;
  rolls: number[] | null;
  isWinner: boolean;
  isSelecting: boolean;
  delay: number;
}) {
  const sum = rolls ? rolls[0] + rolls[1] : 0;

  // Don't render if no player yet
  if (!player) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-muted/50 animate-pulse" />
        <p className="mt-2 font-bold text-sm md:text-base text-muted-foreground">???</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ x: delay === 0 ? -100 : 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: delay + 0.2, type: 'spring', stiffness: 200 }}
      className={`flex flex-col items-center ${isWinner ? 'scale-110' : ''}`}
    >
      {/* Winner Crown */}
      <AnimatePresence>
        {isWinner && (
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            className="mb-2"
          >
            <Crown className="w-8 h-8 text-amber-500" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar */}
      <motion.div
        className={`relative ${isSelecting ? 'animate-pulse' : ''}`}
        animate={isWinner ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 0.5, repeat: isWinner ? 3 : 0 }}
      >
        <img
          src={`https://api.dicebear.com/7.x/bottts/svg?seed=${player.avatarSeed}`}
          alt=""
          className={`w-20 h-20 md:w-24 md:h-24 rounded-full bg-muted border-4 ${
            isWinner ? 'border-amber-500 shadow-lg shadow-amber-500/30' : 'border-white/20'
          }`}
        />
        {isSelecting && (
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-white/50"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </motion.div>

      {/* Name */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.4 }}
        className="mt-2 font-bold text-sm md:text-base"
      >
        {player.name}
      </motion.p>

      {/* Dice */}
      <div className="flex gap-2 mt-4 h-16">
        <AnimatePresence mode="wait">
          {rolls ? (
            <>
              <DiceDisplay value={rolls[0]} delay={0} />
              <DiceDisplay value={rolls[1]} delay={0.2} />
            </>
          ) : (
            <motion.div
              key="waiting"
              className="flex gap-2"
            >
              <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center text-2xl">
                🎲
              </div>
              <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center text-2xl">
                🎲
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sum */}
      {rolls && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`mt-2 text-2xl font-black ${isWinner ? 'text-amber-500' : 'text-white'}`}
        >
          = {sum}
        </motion.div>
      )}
    </motion.div>
  );
}

// Dice Display Component with roll animation
function DiceDisplay({ value, delay }: { value: number; delay: number }) {
  const [displayValue, setDisplayValue] = useState(1);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    // Quick animation cycling through dice values
    let frame = 0;
    const animationFrames = 10;
    const interval = setInterval(() => {
      if (frame < animationFrames) {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
        frame++;
      } else {
        setDisplayValue(value);
        setIsAnimating(false);
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [value]);

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ 
        scale: 1, 
        rotate: isAnimating ? [0, 360] : 0,
      }}
      transition={{ 
        delay,
        rotate: { duration: 0.5, repeat: isAnimating ? Infinity : 0 }
      }}
      className={`w-12 h-12 md:w-14 md:h-14 rounded-lg bg-white text-black flex items-center justify-center text-3xl md:text-4xl font-bold shadow-lg ${
        isAnimating ? 'animate-bounce' : ''
      }`}
    >
      {DICE_FACES[displayValue - 1]}
    </motion.div>
  );
}

