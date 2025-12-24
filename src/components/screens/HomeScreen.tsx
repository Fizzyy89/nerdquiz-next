'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/gameStore';
import { loadSession, clearSession, type GameSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Zap, 
  Users, 
  ArrowRight, 
  Loader2,
  Sparkles,
  Trophy,
  Brain,
  RotateCcw,
  X
} from 'lucide-react';

export function HomeScreen() {
  const router = useRouter();
  const { createRoom, joinRoom } = useSocket();
  const isConnected = useGameStore((s) => s.isConnected);
  
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingSession, setExistingSession] = useState<GameSession | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const session = loadSession();
    if (session) {
      setExistingSession(session);
      // Pre-fill the name from session
      setName(session.playerName);
    }
  }, []);

  const handleDismissSession = () => {
    clearSession();
    setExistingSession(null);
  };

  const handleRejoin = () => {
    if (existingSession) {
      router.push(`/room/${existingSession.roomCode}`);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Bitte gib deinen Namen ein');
      return;
    }
    setLoading(true);
    setError(null);
    
    const result = await createRoom(name.trim());
    if (result.success && result.roomCode) {
      // Navigate to room URL
      router.push(`/room/${result.roomCode}`);
    } else {
      setError(result.error || 'Fehler beim Erstellen');
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim()) {
      setError('Bitte gib deinen Namen ein');
      return;
    }
    if (roomCode.length !== 4) {
      setError('Code muss 4 Zeichen haben');
      return;
    }
    setLoading(true);
    setError(null);
    
    const result = await joinRoom(roomCode.toUpperCase(), name.trim());
    if (result.success) {
      // Navigate to room URL
      router.push(`/room/${roomCode.toUpperCase()}`);
    } else {
      setError(result.error || 'Fehler beim Beitreten');
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center justify-center p-4"
    >
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.8 }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary mb-6 glow-primary">
          <Brain className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-2">
          <span className="gradient-text">Nerd</span>
          <span className="text-foreground">Quiz</span>
        </h1>
        <p className="text-muted-foreground text-lg">Battle of Brains</p>
      </motion.div>

      {/* Connection Status */}
      {!isConnected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm mb-8"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          Verbinde zum Server...
        </motion.div>
      )}

      {/* Existing Session Banner */}
      <AnimatePresence>
        {existingSession && mode === 'select' && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="w-full max-w-sm mb-6"
          >
            <div className="relative glass rounded-2xl p-4 border border-primary/30 bg-primary/5">
              {/* Dismiss button */}
              <button
                onClick={handleDismissSession}
                className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                title="Session verwerfen"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <RotateCcw className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm mb-1">
                    Raum <span className="font-mono font-bold text-primary">{existingSession.roomCode}</span> läuft noch
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Spielst als <span className="font-medium">{existingSession.playerName}</span>
                  </p>
                  <Button
                    onClick={handleRejoin}
                    disabled={!isConnected}
                    size="sm"
                    className="w-full bg-gradient-to-r from-primary to-cyan-400 font-bold"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Zurück zum Spiel
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode Selection */}
      {mode === 'select' && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-sm space-y-4"
        >
          <Button
            onClick={() => setMode('create')}
            disabled={!isConnected}
            className="w-full h-16 text-lg font-bold bg-gradient-to-r from-primary to-cyan-400 hover:opacity-90 glow-primary"
          >
            <Zap className="w-5 h-5 mr-2" />
            Neues Spiel
          </Button>
          
          <Button
            onClick={() => setMode('join')}
            disabled={!isConnected}
            variant="outline"
            className="w-full h-16 text-lg font-bold border-2 hover:bg-muted"
          >
            <Users className="w-5 h-5 mr-2" />
            Spiel beitreten
          </Button>

          {/* Features */}
          <div className="pt-8 grid grid-cols-3 gap-4 text-center">
            {[
              { icon: Users, label: '2-12 Spieler' },
              { icon: Trophy, label: 'Ranglisten' },
              { icon: Sparkles, label: '17 Kategorien' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="text-muted-foreground"
              >
                <item.icon className="w-5 h-5 mx-auto mb-1 text-primary" />
                <span className="text-xs">{item.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Create Form */}
      {mode === 'create' && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-sm space-y-6"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Neues Spiel erstellen</h2>
            <p className="text-muted-foreground text-sm">Du wirst der Host</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Dein Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. QuizMaster"
                maxLength={16}
                className="h-14 text-lg bg-card border-border"
                autoFocus
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-destructive text-sm text-center"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-primary to-cyan-400"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Lobby erstellen
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => { setMode('select'); setError(null); }}
              className="w-full"
            >
              Zurück
            </Button>
          </form>
        </motion.div>
      )}

      {/* Join Form */}
      {mode === 'join' && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-sm space-y-6"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Spiel beitreten</h2>
            <p className="text-muted-foreground text-sm">Gib den 4-stelligen Code ein</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleJoin(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Room Code
              </label>
              <Input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABCD"
                maxLength={4}
                className="h-16 text-3xl font-mono text-center tracking-[0.5em] bg-card border-border uppercase"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Dein Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Player1"
                maxLength={16}
                className="h-14 text-lg bg-card border-border"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-destructive text-sm text-center"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              disabled={loading || !name.trim() || roomCode.length !== 4}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-secondary to-pink-400"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Beitreten
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => { setMode('select'); setError(null); }}
              className="w-full"
            >
              Zurück
            </Button>
          </form>
        </motion.div>
      )}
    </motion.div>
  );
}

