'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/gameStore';
import { loadSession, clearSession, type GameSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { 
  Zap, 
  Users, 
  ArrowRight, 
  Loader2,
  Sparkles,
  Trophy,
  Brain,
  RotateCcw,
  X,
  Gamepad2,
  Timer,
  Target,
  Crown,
  Play,
  BookOpen,
  Newspaper,
  Dice5,
  Heart,
  ChevronRight,
  Clock,
  Flame
} from 'lucide-react';

// Category data with icons
const CATEGORIES = [
  { name: 'Gaming', icon: '🎮', color: 'from-purple-500 to-indigo-600' },
  { name: 'Filme & Serien', icon: '🎬', color: 'from-red-500 to-pink-600' },
  { name: 'Anime & Manga', icon: '🌸', color: 'from-pink-400 to-rose-500' },
  { name: 'Star Wars', icon: '⚔️', color: 'from-yellow-500 to-orange-600' },
  { name: 'Marvel', icon: '🦸', color: 'from-red-600 to-red-800' },
  { name: 'Harry Potter', icon: '⚡', color: 'from-amber-500 to-yellow-600' },
  { name: 'Herr der Ringe', icon: '💍', color: 'from-emerald-600 to-teal-700' },
  { name: 'Musik', icon: '🎵', color: 'from-violet-500 to-purple-600' },
  { name: 'Wissenschaft', icon: '🔬', color: 'from-cyan-500 to-blue-600' },
  { name: 'Technik', icon: '💻', color: 'from-slate-500 to-zinc-600' },
  { name: 'Sport', icon: '⚽', color: 'from-green-500 to-emerald-600' },
  { name: 'Mythologie', icon: '🏛️', color: 'from-amber-600 to-orange-700' },
  { name: 'Internet & Memes', icon: '🌐', color: 'from-blue-500 to-cyan-500' },
  { name: 'Cartoons', icon: '📺', color: 'from-orange-400 to-yellow-500' },
  { name: 'Fahrzeuge', icon: '🚗', color: 'from-gray-500 to-slate-600' },
  { name: 'Allgemeinwissen', icon: '📚', color: 'from-indigo-500 to-blue-600' },
];

// Mock news data
const NEWS_ITEMS = [
  {
    id: 1,
    date: '26. Dez 2024',
    title: 'NerdQuiz ist live! 🎉',
    description: 'Das ultimative Quiz-Spiel für Nerds ist endlich online.',
    tag: 'Neu',
    tagColor: 'bg-primary'
  },
  {
    id: 2,
    date: '20. Dez 2024',
    title: 'Neue Kategorien hinzugefügt',
    description: 'Mythologie und Internet Memes sind jetzt verfügbar.',
    tag: 'Update',
    tagColor: 'bg-secondary'
  },
  {
    id: 3,
    date: '15. Dez 2024',
    title: 'Dice Duel Feature',
    description: 'Der neue Würfel-Modus für Kategorie-Duelle ist da!',
    tag: 'Feature',
    tagColor: 'bg-accent'
  },
];

// Animated section wrapper
function AnimatedSection({ children, className = '', delay = 0, id }: { children: React.ReactNode; className?: string; delay?: number; id?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  
  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const { createRoom, joinRoom } = useSocket();
  const isConnected = useGameStore((s) => s.isConnected);
  
  const [dialogMode, setDialogMode] = useState<'none' | 'create' | 'join'>('none');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingSession, setExistingSession] = useState<GameSession | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setExistingSession(session);
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
      router.push(`/room/${roomCode.toUpperCase()}`);
    } else {
      setError(result.error || 'Fehler beim Beitreten');
      setLoading(false);
    }
  };

  const closeDialog = () => {
    setDialogMode('none');
    setError(null);
    setLoading(false);
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
                <Brain className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-base tracking-tight">
                <span className="text-primary">Nerd</span>Quiz
              </span>
            </div>
            
            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-1">
              {[
                { label: 'Features', id: 'features' },
                { label: 'Kategorien', id: 'categories' },
                { label: 'News', id: 'news' },
              ].map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollToSection(link.id)}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                >
                  {link.label}
                </button>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-2">
              {!isConnected && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="hidden sm:inline">Verbinde...</span>
                </div>
              )}
              <Button
                onClick={() => setDialogMode('join')}
                disabled={!isConnected}
                variant="ghost"
                size="sm"
                className="hidden sm:flex text-muted-foreground hover:text-foreground"
              >
                Code eingeben
              </Button>
              <Button
                onClick={() => setDialogMode('create')}
                disabled={!isConnected}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-md shadow-primary/20"
              >
                <Play className="w-3.5 h-3.5 mr-1.5" />
                Spielen
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Existing Session Banner */}
      <AnimatePresence>
        {existingSession && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-primary/5 border-b border-primary/20"
          >
            <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm">
                <RotateCcw className="w-4 h-4 text-primary" />
                <span>
                  Laufendes Spiel: <span className="font-mono font-bold text-primary">{existingSession.roomCode}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleRejoin} size="sm" variant="default" className="h-7 text-xs">
                  Fortsetzen
                </Button>
                <button onClick={handleDismissSession} className="p-1 rounded hover:bg-muted/50 text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section - Compact */}
      <section className="relative pt-8 pb-12 md:pt-12 md:pb-16 px-4 overflow-hidden">
        {/* Subtle background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
        
        <div className="relative max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left: Text Content */}
            <div className="text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary mb-4">
                  <Sparkles className="w-3 h-3" />
                  Multiplayer Quiz-Spiel
                </div>
                
                {/* Title */}
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-3">
                  Das Quiz für{' '}
                  <span className="text-primary">echte Nerds</span>
                </h1>
                
                {/* Subtitle */}
                <p className="text-muted-foreground text-base md:text-lg mb-6 max-w-lg mx-auto lg:mx-0">
                  17 Kategorien von Gaming bis Wissenschaft. 
                  Fordere deine Freunde heraus und beweise dein Wissen!
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6">
                  <Button
                    onClick={() => setDialogMode('create')}
                    disabled={!isConnected}
                    size="lg"
                    className="h-11 px-6 font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Neues Spiel starten
                  </Button>
                  <Button
                    onClick={() => setDialogMode('join')}
                    disabled={!isConnected}
                    variant="outline"
                    size="lg"
                    className="h-11 px-6 font-semibold"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Raum beitreten
                  </Button>
                </div>

                {/* Quick Stats */}
                <div className="flex items-center justify-center lg:justify-start gap-6 text-sm">
                  {[
                    { icon: Users, label: '2-12 Spieler' },
                    { icon: Clock, label: '~15 Min' },
                    { icon: Trophy, label: 'Kostenlos' },
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-center gap-1.5 text-muted-foreground">
                      <stat.icon className="w-4 h-4 text-primary/70" />
                      <span>{stat.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Right: Feature Cards Preview */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="hidden lg:block"
            >
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: '🎮', label: 'Gaming', players: '2.4k' },
                  { icon: '🎬', label: 'Filme', players: '1.8k' },
                  { icon: '⚔️', label: 'Star Wars', players: '1.2k' },
                  { icon: '🦸', label: 'Marvel', players: '980' },
                ].map((cat, i) => (
                  <motion.div
                    key={cat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-colors group cursor-default"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{cat.icon}</span>
                      <div>
                        <p className="font-semibold text-sm">{cat.label}</p>
                        <p className="text-xs text-muted-foreground">{cat.players} Fragen</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground mt-3">
                + 12 weitere Kategorien
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section - Compact Grid */}
      <AnimatedSection id="features" className="py-12 md:py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              So macht Quizzen Spaß
            </h2>
            <p className="text-muted-foreground text-sm md:text-base">
              Features, die NerdQuiz besonders machen
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Gamepad2,
                title: 'Multiplayer',
                description: '2-12 Spieler gleichzeitig',
                color: 'text-purple-500'
              },
              {
                icon: Timer,
                title: 'Schnelle Runden',
                description: '15 Sekunden pro Frage',
                color: 'text-orange-500'
              },
              {
                icon: Flame,
                title: 'Streak-Boni',
                description: 'Richtige Antworten in Folge',
                color: 'text-yellow-500'
              },
              {
                icon: Dice5,
                title: 'Kategorie-Modi',
                description: 'Voting, Wheel oder Würfelduell',
                color: 'text-green-500'
              },
              {
                icon: Target,
                title: 'Schätzfragen',
                description: 'Nicht nur Multiple Choice',
                color: 'text-blue-500'
              },
              {
                icon: Trophy,
                title: 'Live Rangliste',
                description: 'Echtzeit Punktestand',
                color: 'text-pink-500'
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 p-4 rounded-xl bg-background border border-border/50 hover:border-primary/20 transition-colors"
              >
                <div className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 ${feature.color}`}>
                  <feature.icon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-0.5">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* How to Play - Horizontal Steps */}
      <AnimatedSection className="py-12 md:py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              In 3 Schritten loslegen
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: '1',
                title: 'Raum erstellen',
                description: 'Erstelle einen Raum und teile den Code',
                icon: Zap,
                color: 'from-primary to-cyan-400'
              },
              {
                step: '2',
                title: 'Kategorie wählen',
                description: 'Stimmt ab oder dreht am Glücksrad',
                icon: BookOpen,
                color: 'from-secondary to-pink-400'
              },
              {
                step: '3',
                title: 'Quizzen!',
                description: 'Beantwortet Fragen und sammelt Punkte',
                icon: Trophy,
                color: 'from-amber-500 to-orange-500'
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative text-center p-6 rounded-2xl bg-card border border-border/50"
              >
                <div className={`w-12 h-12 mx-auto rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-bold">
                  {item.step}
                </div>
                <h3 className="font-bold mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button
              onClick={() => setDialogMode('create')}
              disabled={!isConnected}
              className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
            >
              <Play className="w-4 h-4 mr-2" />
              Jetzt starten
            </Button>
          </div>
        </div>
      </AnimatedSection>

      {/* Categories Grid - Compact */}
      <AnimatedSection id="categories" className="py-12 md:py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">
                17 Kategorien
              </h2>
              <p className="text-muted-foreground text-sm">
                Von Gaming bis Wissenschaft
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 md:gap-3">
            {CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.02 }}
                whileHover={{ scale: 1.05 }}
                className={`p-3 rounded-lg bg-gradient-to-br ${cat.color} cursor-default text-center group`}
              >
                <span className="text-xl md:text-2xl block mb-1">{cat.icon}</span>
                <span className="text-[10px] md:text-xs font-medium text-white/90 leading-tight block">{cat.name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* News + Ad Section - Side by Side on Desktop */}
      <AnimatedSection id="news" className="py-12 md:py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* News */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Newspaper className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold">News & Updates</h2>
              </div>
              
              <div className="space-y-3">
                {NEWS_ITEMS.map((news, i) => (
                  <motion.article
                    key={news.id}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border/50 hover:border-primary/20 transition-colors group cursor-pointer"
                  >
                    <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${news.tagColor} text-primary-foreground flex-shrink-0`}>
                      {news.tag}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                          {news.title}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {news.description}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{news.date}</span>
                  </motion.article>
                ))}
              </div>
            </div>

            {/* Ad Placeholder */}
            <div className="hidden lg:block">
              <div className="sticky top-20">
                <div className="h-[250px] rounded-xl border-2 border-dashed border-border/50 flex items-center justify-center text-muted-foreground/40 text-sm bg-muted/20">
                  Werbung
                </div>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* CTA Banner - Compact */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 border border-primary/20 p-6 md:p-8">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <h2 className="text-xl md:text-2xl font-bold mb-1">
                  Bereit für die Challenge?
                </h2>
                <p className="text-muted-foreground text-sm">
                  Starte jetzt und finde heraus, wer der größte Nerd ist!
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => setDialogMode('create')}
                  disabled={!isConnected}
                  className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Spiel erstellen
                </Button>
                <Button
                  onClick={() => setDialogMode('join')}
                  disabled={!isConnected}
                  variant="outline"
                >
                  Beitreten
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Ad Placeholder */}
      <section className="py-4 px-4 lg:hidden">
        <div className="max-w-md mx-auto">
          <div className="h-20 rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center text-muted-foreground/40 text-xs bg-muted/20">
            Werbung
          </div>
        </div>
      </section>

      {/* Footer - Minimal */}
      <footer className="py-8 px-4 border-t border-border/50 mt-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm">
                <span className="text-primary">Nerd</span>Quiz
              </span>
              <span className="text-xs text-muted-foreground">• Battle of Brains</span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Impressum</a>
              <a href="#" className="hover:text-foreground transition-colors">Datenschutz</a>
              <a href="#" className="hover:text-foreground transition-colors">Kontakt</a>
            </div>

            {/* Made with love */}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-secondary fill-secondary" /> für Nerds
            </p>
          </div>
        </div>
      </footer>

      {/* Create Room Dialog */}
      <Dialog open={dialogMode === 'create'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              Neues Spiel erstellen
            </DialogTitle>
            <DialogDescription>
              Du wirst der Host des Spiels.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Dein Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. QuizMaster"
                maxLength={16}
                className="h-11"
                autoFocus
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-destructive text-sm"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full h-11 font-semibold bg-primary hover:bg-primary/90"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Lobby erstellen
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Join Room Dialog */}
      <Dialog open={dialogMode === 'join'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-secondary" />
              </div>
              Spiel beitreten
            </DialogTitle>
            <DialogDescription>
              Gib den 4-stelligen Raum-Code ein.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleJoin(); }} className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Room Code
              </label>
              <Input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABCD"
                maxLength={4}
                className="h-14 text-2xl font-mono text-center tracking-[0.4em] uppercase"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Dein Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Player1"
                maxLength={16}
                className="h-11"
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-destructive text-sm"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              disabled={loading || !name.trim() || roomCode.length !== 4}
              className="w-full h-11 font-semibold bg-secondary hover:bg-secondary/90 text-secondary-foreground"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Beitreten
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
