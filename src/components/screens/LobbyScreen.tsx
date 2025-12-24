'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore, useIsHost } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { 
  Copy, 
  Check, 
  Crown, 
  Play,
  Users,
  Settings,
  LogOut,
  Wifi,
  Share2
} from 'lucide-react';

export function LobbyScreen() {
  const router = useRouter();
  const { startGame, updateSettings, leaveGame } = useSocket();
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const isHost = useIsHost();
  
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!room) return null;

  const copyCode = async () => {
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/room/${room.code}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleLeave = () => {
    leaveGame();
    router.push('/');
  };

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    const result = await startGame();
    if (!result.success) {
      setError(result.error || 'Fehler');
    }
    setStarting(false);
  };

  const canStart = room.players.length >= 1; // 1 for testing, normally 2

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col p-4 md:p-8"
    >
      {/* Header */}
      <div className="text-center py-8">
        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-3xl md:text-4xl font-black mb-6"
        >
          Warteraum
        </motion.h1>

        {/* Room Code */}
        <motion.button
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          onClick={copyCode}
          className="inline-flex flex-col items-center gap-2 px-8 py-4 rounded-2xl glass hover:bg-muted/50 transition-colors group"
        >
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Room Code
          </span>
          <div className="flex items-center gap-3">
            <span className="text-4xl md:text-5xl font-mono font-black tracking-[0.3em] text-primary">
              {room.code}
            </span>
            {copied ? (
              <Check className="w-6 h-6 text-green-500" />
            ) : (
              <Copy className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
            )}
          </div>
        </motion.button>
      </div>

      {/* Players Grid */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex-1 max-w-4xl mx-auto w-full"
      >
        <div className="flex items-center justify-center gap-2 mb-6 text-muted-foreground">
          <Users className="w-5 h-5" />
          <span>{room.players.length} Spieler</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {room.players.map((player, i) => (
            <motion.div
              key={player.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 * i }}
              className={`relative p-4 rounded-2xl glass text-center ${
                player.id === playerId ? 'ring-2 ring-primary' : ''
              }`}
            >
              {player.isHost && (
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                  <Crown className="w-4 h-4 text-accent-foreground" />
                </div>
              )}

              <img
                src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${player.avatarSeed}`}
                alt=""
                className="w-16 h-16 mx-auto mb-3 rounded-xl bg-muted"
              />

              <p className="font-bold truncate">{player.name}</p>
              
              <div className="flex items-center justify-center gap-1 mt-1">
                <Wifi className={`w-3 h-3 ${player.isConnected ? 'text-green-500' : 'text-red-500'}`} />
                <span className="text-xs text-muted-foreground">
                  {player.id === playerId ? 'Du' : player.isConnected ? 'Online' : 'Offline'}
                </span>
              </div>
            </motion.div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: Math.max(0, 4 - room.players.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="p-4 rounded-2xl border-2 border-dashed border-border/50 text-center opacity-40"
            >
              <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-muted/30 flex items-center justify-center">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Wartet...</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Host Controls */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="max-w-2xl mx-auto w-full pt-8"
      >
        {isHost ? (
          <div className="space-y-4">
            {/* Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass rounded-xl p-4">
                <label className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Settings className="w-4 h-4" />
                  Runden
                </label>
                <select
                  value={room.settings.maxRounds}
                  onChange={(e) => updateSettings({ maxRounds: parseInt(e.target.value) })}
                  className="w-full h-12 px-4 rounded-lg bg-background border border-border text-lg font-bold"
                >
                  {[3, 5, 7, 10].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div className="glass rounded-xl p-4">
                <label className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Settings className="w-4 h-4" />
                  Fragen/Runde
                </label>
                <select
                  value={room.settings.questionsPerRound}
                  onChange={(e) => updateSettings({ questionsPerRound: parseInt(e.target.value) })}
                  className="w-full h-12 px-4 rounded-lg bg-background border border-border text-lg font-bold"
                >
                  {[3, 5, 7, 10].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="text-destructive text-sm text-center">{error}</p>
            )}

            {/* Start Button */}
            <Button
              onClick={handleStart}
              disabled={!canStart || starting}
              className="w-full h-16 text-xl font-bold bg-gradient-to-r from-primary to-cyan-400 glow-primary disabled:opacity-50"
            >
              <Play className="w-6 h-6 mr-2" />
              {starting ? 'Startet...' : 'Spiel starten'}
            </Button>

            {!canStart && (
              <p className="text-center text-muted-foreground text-sm">
                Mindestens 2 Spieler benötigt
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-8 glass rounded-2xl">
            <div className="inline-flex items-center gap-2 text-muted-foreground animate-pulse">
              <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
              Warte auf Host...
            </div>
          </div>
        )}

        {/* Share Link */}
        <Button
          variant="outline"
          onClick={copyLink}
          className="w-full mt-4"
        >
          {linkCopied ? (
            <>
              <Check className="w-4 h-4 mr-2 text-green-500" />
              Link kopiert!
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4 mr-2" />
              Einladungslink teilen
            </>
          )}
        </Button>

        {/* Leave */}
        <Button
          variant="ghost"
          onClick={handleLeave}
          className="w-full mt-2 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Spiel verlassen
        </Button>
      </motion.div>
    </motion.div>
  );
}
