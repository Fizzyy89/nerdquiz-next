/**
 * NerdQuiz Custom Server
 * Next.js + Socket.io WebSocket Server
 */

import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import next from 'next';
import fs from 'fs';
import path from 'path';
import { botManager } from './src/server/botManager';

const dev = process.env.NODE_ENV !== 'production';
const hostname = dev ? 'localhost' : '0.0.0.0';
const port = parseInt(process.env.PORT || '3001', 10);

const app = next({ dev, hostname, port, turbopack: false });
const handle = app.getRequestHandler();

// ============================================
// TYPES
// ============================================

interface QuestionData {
  question: string;
  answers?: string[];
  correct?: number;
  correctAnswer?: number;
  unit?: string;
}

interface CategoryData {
  name: string;
  icon: string;
  questions: QuestionData[];
  estimationQuestions?: QuestionData[]; // Some categories have these in a separate array
}

interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
  questionCount: number;
}

interface Player {
  id: string;
  socketId: string;
  name: string;
  avatarSeed: string;
  score: number;
  isHost: boolean;
  isConnected: boolean;
  currentAnswer: number | null;
  estimationAnswer: number | null;
  answerTime: number | null;
  streak: number;
}

interface GameQuestion {
  id: string;
  text: string;
  type: 'choice' | 'estimation';
  answers?: string[];
  correctIndex?: number;
  correctValue?: number;
  unit?: string;
  category: string;
  categoryIcon: string;
}

type CategorySelectionMode = 'voting' | 'wheel' | 'losers_pick' | 'dice_duel';

interface DiceDuelState {
  player1Id: string;
  player2Id: string;
  player1Rolls: number[] | null; // [die1, die2]
  player2Rolls: number[] | null;
  winnerId: string | null;
  phase: 'selecting' | 'rolling' | 'result';
}

interface GameRoom {
  code: string;
  hostId: string;
  players: Map<string, Player>;
  settings: {
    maxRounds: number;
    questionsPerRound: number;
    timePerQuestion: number;
  };
  state: {
    phase: 'lobby' | 'category_announcement' | 'category_voting' | 'category_wheel' | 'category_losers_pick' | 'category_dice_duel' | 'question' | 'estimation' | 'revealing' | 'estimation_reveal' | 'scoreboard' | 'final';
    currentRound: number;
    currentQuestionIndex: number;
    currentQuestion: GameQuestion | null;
    categorySelectionMode: CategorySelectionMode | null;
    votingCategories: CategoryInfo[];
    categoryVotes: Map<string, string>;
    selectedCategory: string | null;
    roundQuestions: GameQuestion[];
    timerEnd: number | null;
    showingCorrectAnswer: boolean;
    loserPickPlayerId: string | null;
    lastLoserPickRound: number; // Cooldown tracking
    diceDuel: DiceDuelState | null;
    wheelSelectedIndex: number | null; // Pre-selected wheel index for animation
  };
  createdAt: Date;
}

// ============================================
// CATEGORY LOADER
// ============================================

let categoriesCache: Map<string, CategoryData> | null = null;

function loadCategories(): Map<string, CategoryData> {
  if (categoriesCache) return categoriesCache;

  const categoriesDir = path.join(process.cwd(), 'data', 'categories');
  const categories = new Map<string, CategoryData>();

  try {
    if (fs.existsSync(categoriesDir)) {
      const files = fs.readdirSync(categoriesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(categoriesDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const data: CategoryData = JSON.parse(content);
          const id = file.replace('.json', '');
          categories.set(id, data);
          console.log(`📚 Loaded: ${data.name} (${data.questions.length} questions)`);
        }
      }
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  }

  categoriesCache = categories;
  return categories;
}

function getCategoryList(): CategoryInfo[] {
  const categories = loadCategories();
  const list: CategoryInfo[] = [];

  categories.forEach((data, id) => {
    list.push({
      id,
      name: data.name,
      icon: data.icon,
      questionCount: data.questions.length,
    });
  });

  return list.sort((a, b) => a.name.localeCompare(b.name));
}

function getRandomQuestions(categoryId: string, count: number): GameQuestion[] {
  const categories = loadCategories();
  const category = categories.get(categoryId);

  if (!category) {
    console.log(`❌ Category not found: ${categoryId}`);
    return [];
  }

  // Get all questions - some categories have estimationQuestions in a separate array
  const allQuestions = [...category.questions];
  if (category.estimationQuestions) {
    allQuestions.push(...category.estimationQuestions);
  }

  // Separate choice and estimation questions
  const choiceQuestions = allQuestions.filter(q => q.answers !== undefined && q.answers.length > 0);
  const estimationQuestions = allQuestions.filter(q => q.correctAnswer !== undefined);
  
  console.log(`📊 Category ${category.name}: ${choiceQuestions.length} choice, ${estimationQuestions.length} estimation available`);
  
  // Shuffle both arrays
  const shuffledChoice = [...choiceQuestions].sort(() => Math.random() - 0.5);
  const shuffledEstimation = [...estimationQuestions].sort(() => Math.random() - 0.5);
  
  // Take (count - 1) choice questions, then 1 estimation question at the end
  const selectedChoice = shuffledChoice.slice(0, count - 1);
  const selectedEstimation = shuffledEstimation.slice(0, 1);
  
  // If no estimation questions available, just use choice questions
  const selected = selectedEstimation.length > 0 
    ? [...selectedChoice, ...selectedEstimation]
    : shuffledChoice.slice(0, count);

  console.log(`📝 Round: ${selectedChoice.length} choice + ${selectedEstimation.length} estimation = ${selected.length} total`);

  return selected.map((q, i) => {
    const isEstimation = q.correctAnswer !== undefined;
    
    const gameQ = {
      id: `q_${Date.now()}_${i}`,
      text: q.question,
      type: isEstimation ? 'estimation' : 'choice',
      answers: q.answers,
      correctIndex: q.correct,
      correctValue: q.correctAnswer,
      unit: q.unit || '',
      category: category.name,
      categoryIcon: category.icon,
    } as GameQuestion;
    
    console.log(`  ${i + 1}. [${gameQ.type}] ${gameQ.text.substring(0, 50)}...`);
    
    return gameQ;
  });
}

function getRandomCategoriesForVoting(count: number = 6): CategoryInfo[] {
  const allCategories = getCategoryList();
  const shuffled = [...allCategories].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ============================================
// IN-MEMORY STORE
// ============================================

const rooms = new Map<string, GameRoom>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

function generatePlayerId(): string {
  return 'p_' + Math.random().toString(36).substring(2, 11);
}

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Emit phase change and notify bots
 */
function emitPhaseChange(room: GameRoom, io: SocketServer, phase: string) {
  io.to(room.code).emit('phase_change', { phase });
  
  // Notify bots about phase change (dev only)
  if (dev) {
    botManager.onPhaseChange(room.code, phase);
  }
}

function roomToClient(room: GameRoom) {
  const players = Array.from(room.players.values()).map(p => ({
    id: p.id,
    name: p.name,
    avatarSeed: p.avatarSeed,
    score: p.score,
    isHost: p.isHost,
    isConnected: p.isConnected,
    hasAnswered: p.currentAnswer !== null || p.estimationAnswer !== null,
    streak: p.streak,
  }));

  players.sort((a, b) => b.score - a.score);

  const question = room.state.currentQuestion;
  const clientQuestion = question ? {
    id: question.id,
    text: question.text,
    type: question.type,
    answers: question.answers,
    unit: question.unit,
    category: question.category,
    categoryIcon: question.categoryIcon,
    // Only send correct answer during reveal
    ...(room.state.showingCorrectAnswer && {
      correctIndex: question.correctIndex,
      correctValue: question.correctValue,
    }),
  } : null;

  return {
    code: room.code,
    players,
    settings: room.settings,
    phase: room.state.phase,
    currentRound: room.state.currentRound,
    currentQuestionIndex: room.state.currentQuestionIndex,
    totalQuestions: room.settings.questionsPerRound,
    currentQuestion: clientQuestion,
    categorySelectionMode: room.state.categorySelectionMode,
    votingCategories: room.state.votingCategories,
    categoryVotes: Object.fromEntries(room.state.categoryVotes),
    selectedCategory: room.state.selectedCategory,
    loserPickPlayerId: room.state.loserPickPlayerId,
    diceDuel: room.state.diceDuel,
    timerEnd: room.state.timerEnd,
    showingCorrectAnswer: room.state.showingCorrectAnswer,
    wheelSelectedIndex: room.state.wheelSelectedIndex,
  };
}

// ============================================
// START SERVER
// ============================================

app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);
  
  const categories = loadCategories();
  console.log(`\n📚 ${categories.size} Kategorien geladen\n`);

  const io = new SocketServer(httpServer, {
    cors: {
      origin: dev 
        ? ['http://localhost:3000', 'http://localhost:3001'] 
        : process.env.CORS_ORIGIN?.split(',') || [],
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ============================================
  // BOT MANAGER SETUP (Development only)
  // ============================================

  if (dev) {
    botManager.initialize(io, (code) => rooms.get(code));
    
    // Register action handlers for bots
    botManager.registerActionHandler('vote_category', (data) => {
      const room = rooms.get(data.roomCode);
      if (!room || room.state.phase !== 'category_voting') return;
      room.state.categoryVotes.set(data.playerId, data.categoryId);
      io.to(data.roomCode).emit('room_update', roomToClient(room));
      if (room.state.categoryVotes.size >= room.players.size) {
        finalizeCategoryVoting(room, io);
      }
    });

    botManager.registerActionHandler('submit_answer', (data) => {
      const room = rooms.get(data.roomCode);
      if (!room || room.state.phase !== 'question') return;
      const player = room.players.get(data.playerId);
      if (!player || player.currentAnswer !== null) return;
      player.currentAnswer = data.answerIndex;
      player.answerTime = room.state.timerEnd ? room.state.timerEnd - Date.now() : 0;
      io.to(data.roomCode).emit('room_update', roomToClient(room));
      io.to(data.roomCode).emit('player_answered', { playerId: data.playerId, playerName: player.name });
      const allAnswered = Array.from(room.players.values()).every(
        p => p.currentAnswer !== null || !p.isConnected
      );
      if (allAnswered) {
        clearTimeout((room as any).questionTimer);
        showAnswer(room, io);
      }
    });

    botManager.registerActionHandler('submit_estimation', (data) => {
      const room = rooms.get(data.roomCode);
      if (!room || room.state.phase !== 'estimation') return;
      const player = room.players.get(data.playerId);
      if (!player || player.estimationAnswer !== null) return;
      player.estimationAnswer = data.value;
      player.answerTime = room.state.timerEnd ? room.state.timerEnd - Date.now() : 0;
      io.to(data.roomCode).emit('room_update', roomToClient(room));
      io.to(data.roomCode).emit('player_answered', { playerId: data.playerId, playerName: player.name });
      const allEstimated = Array.from(room.players.values()).every(
        p => p.estimationAnswer !== null || !p.isConnected
      );
      if (allEstimated) {
        clearTimeout((room as any).questionTimer);
        showEstimationAnswer(room, io);
      }
    });

    botManager.registerActionHandler('loser_pick_category', (data) => {
      const room = rooms.get(data.roomCode);
      if (!room || room.state.phase !== 'category_losers_pick') return;
      if (data.playerId !== room.state.loserPickPlayerId) return;
      finalizeLosersPick(room, io, data.categoryId);
    });

    botManager.registerActionHandler('dice_roll', (data) => {
      const room = rooms.get(data.roomCode);
      if (!room || room.state.phase !== 'category_dice_duel') return;
      const duel = room.state.diceDuel;
      if (!duel || duel.phase !== 'rolling') return;
      const isPlayer1 = data.playerId === duel.player1Id;
      const isPlayer2 = data.playerId === duel.player2Id;
      if (!isPlayer1 && !isPlayer2) return;
      if (isPlayer1 && duel.player1Rolls) return;
      if (isPlayer2 && duel.player2Rolls) return;
      const rolls = [rollDie(), rollDie()];
      if (isPlayer1) duel.player1Rolls = rolls;
      else duel.player2Rolls = rolls;
      io.to(room.code).emit('dice_roll', { playerId: data.playerId, rolls });
      io.to(room.code).emit('room_update', roomToClient(room));
      if (duel.player1Rolls && duel.player2Rolls) {
        setTimeout(() => checkDiceDuelResult(room, io), 1500);
      }
    });

    botManager.registerActionHandler('dice_duel_pick', (data) => {
      const room = rooms.get(data.roomCode);
      if (!room || room.state.phase !== 'category_dice_duel') return;
      const duel = room.state.diceDuel;
      if (!duel || duel.phase !== 'result') return;
      if (data.playerId !== duel.winnerId) return;
      finalizeDiceDuelPick(room, io, data.categoryId);
    });
  }

  // ============================================
  // SOCKET EVENTS
  // ============================================

  io.on('connection', (socket) => {
    console.log(`🔌 Connected: ${socket.id}`);

    // === CREATE ROOM ===
    socket.on('create_room', (data: { playerName: string }, callback) => {
      const roomCode = generateRoomCode();
      const playerId = generatePlayerId();
      
      const player: Player = {
        id: playerId,
        socketId: socket.id,
        name: data.playerName.trim(),
        avatarSeed: data.playerName + Date.now(),
        score: 0,
        isHost: true,
        isConnected: true,
        currentAnswer: null,
        estimationAnswer: null,
        answerTime: null,
        streak: 0,
      };

      const room: GameRoom = {
        code: roomCode,
        hostId: playerId,
        players: new Map([[playerId, player]]),
        settings: {
          maxRounds: 5,
          questionsPerRound: 5,
          timePerQuestion: 20,
        },
        state: {
          phase: 'lobby',
          currentRound: 1,
          currentQuestionIndex: 0,
          currentQuestion: null,
          categorySelectionMode: null,
          votingCategories: [],
          categoryVotes: new Map(),
          selectedCategory: null,
          roundQuestions: [],
          timerEnd: null,
          showingCorrectAnswer: false,
          loserPickPlayerId: null,
          lastLoserPickRound: 0,
          diceDuel: null,
          wheelSelectedIndex: null,
        },
        createdAt: new Date(),
      };

      rooms.set(roomCode, room);
      socket.join(roomCode);
      
      console.log(`🎮 Room ${roomCode} created by ${data.playerName}`);
      
      callback({
        success: true,
        roomCode,
        playerId,
        room: roomToClient(room),
      });
    });

    // === JOIN ROOM ===
    socket.on('join_room', (data: { roomCode: string; playerName: string }, callback) => {
      const code = data.roomCode.toUpperCase();
      const room = rooms.get(code);
      
      if (!room) {
        callback({ success: false, error: 'Raum nicht gefunden' });
        return;
      }

      if (room.state.phase !== 'lobby') {
        callback({ success: false, error: 'Spiel läuft bereits' });
        return;
      }

      if (room.players.size >= 12) {
        callback({ success: false, error: 'Raum ist voll (max. 12)' });
        return;
      }

      const nameTaken = Array.from(room.players.values()).some(
        p => p.name.toLowerCase() === data.playerName.trim().toLowerCase()
      );
      if (nameTaken) {
        callback({ success: false, error: 'Name bereits vergeben' });
        return;
      }

      const playerId = generatePlayerId();
      const player: Player = {
        id: playerId,
        socketId: socket.id,
        name: data.playerName.trim(),
        avatarSeed: data.playerName + Date.now(),
        score: 0,
        isHost: false,
        isConnected: true,
        currentAnswer: null,
        estimationAnswer: null,
        answerTime: null,
        streak: 0,
      };

      room.players.set(playerId, player);
      socket.join(code);

      console.log(`👤 ${data.playerName} joined ${code}`);

      io.to(code).emit('room_update', roomToClient(room));
      io.to(code).emit('player_joined', { playerName: data.playerName, playerId });

      callback({
        success: true,
        roomCode: code,
        playerId,
        room: roomToClient(room),
      });
    });

    // === UPDATE SETTINGS ===
    socket.on('update_settings', (data: { roomCode: string; playerId: string; settings: any }) => {
      const room = rooms.get(data.roomCode);
      if (!room) return;
      
      const player = room.players.get(data.playerId);
      if (!player?.isHost) return;
      
      room.settings = { ...room.settings, ...data.settings };
      io.to(data.roomCode).emit('room_update', roomToClient(room));
    });

    // === START GAME ===
    socket.on('start_game', (data: { roomCode: string; playerId: string }, callback) => {
      const room = rooms.get(data.roomCode);
      
      if (!room) {
        callback({ success: false, error: 'Raum nicht gefunden' });
        return;
      }

      const player = room.players.get(data.playerId);
      if (!player?.isHost) {
        callback({ success: false, error: 'Nur der Host kann starten' });
        return;
      }

      startCategorySelection(room, io);
      console.log(`🚀 Game started in ${data.roomCode}`);
      callback({ success: true });
    });

    // === VOTE CATEGORY ===
    socket.on('vote_category', (data: { roomCode: string; playerId: string; categoryId: string }) => {
      const room = rooms.get(data.roomCode);
      if (!room || room.state.phase !== 'category_voting') return;

      room.state.categoryVotes.set(data.playerId, data.categoryId);
      io.to(data.roomCode).emit('room_update', roomToClient(room));

      if (room.state.categoryVotes.size >= room.players.size) {
        finalizeCategoryVoting(room, io);
      }
    });

    // === LOSER PICK CATEGORY ===
    socket.on('loser_pick_category', (data: { roomCode: string; playerId: string; categoryId: string }) => {
      const room = rooms.get(data.roomCode);
      if (!room || room.state.phase !== 'category_losers_pick') return;

      // Only the designated loser can pick
      if (data.playerId !== room.state.loserPickPlayerId) return;

      finalizeLosersPick(room, io, data.categoryId);
    });

    // === DICE DUEL ROLL ===
    socket.on('dice_roll', (data: { roomCode: string; playerId: string }) => {
      const room = rooms.get(data.roomCode);
      if (!room || room.state.phase !== 'category_dice_duel') return;
      
      const duel = room.state.diceDuel;
      if (!duel || duel.phase !== 'rolling') return;

      // Check if this player is in the duel
      const isPlayer1 = data.playerId === duel.player1Id;
      const isPlayer2 = data.playerId === duel.player2Id;
      if (!isPlayer1 && !isPlayer2) return;

      // Check if already rolled
      if (isPlayer1 && duel.player1Rolls) return;
      if (isPlayer2 && duel.player2Rolls) return;

      // Roll the dice!
      const rolls = [rollDie(), rollDie()];
      
      if (isPlayer1) {
        duel.player1Rolls = rolls;
      } else {
        duel.player2Rolls = rolls;
      }

      const player = room.players.get(data.playerId);
      console.log(`🎲 ${player?.name} rolled: ${rolls[0]} + ${rolls[1]} = ${rolls[0] + rolls[1]}`);

      io.to(room.code).emit('dice_roll', {
        playerId: data.playerId,
        rolls: rolls,
      });
      io.to(room.code).emit('room_update', roomToClient(room));

      // Check if both have rolled
      if (duel.player1Rolls && duel.player2Rolls) {
        setTimeout(() => {
          checkDiceDuelResult(room, io);
        }, 1500); // Wait for animation
      }
    });

    // === DICE DUEL PICK CATEGORY ===
    socket.on('dice_duel_pick', (data: { roomCode: string; playerId: string; categoryId: string }) => {
      const room = rooms.get(data.roomCode);
      if (!room || room.state.phase !== 'category_dice_duel') return;
      
      const duel = room.state.diceDuel;
      if (!duel || duel.phase !== 'result') return;

      // Only the winner can pick
      if (data.playerId !== duel.winnerId) return;

      finalizeDiceDuelPick(room, io, data.categoryId);
    });

    // === SUBMIT ANSWER (Multiple Choice) ===
    socket.on('submit_answer', (data: { roomCode: string; playerId: string; answerIndex: number }) => {
      const room = rooms.get(data.roomCode);
      if (!room || room.state.phase !== 'question') return;

      const player = room.players.get(data.playerId);
      if (!player || player.currentAnswer !== null) return;

      player.currentAnswer = data.answerIndex;
      player.answerTime = room.state.timerEnd ? room.state.timerEnd - Date.now() : 0;

      io.to(data.roomCode).emit('room_update', roomToClient(room));
      io.to(data.roomCode).emit('player_answered', { 
        playerId: data.playerId,
        playerName: player.name 
      });

      const allAnswered = Array.from(room.players.values()).every(
        p => p.currentAnswer !== null || !p.isConnected
      );
      if (allAnswered) {
        clearTimeout((room as any).questionTimer);
        showAnswer(room, io);
      }
    });

    // === SUBMIT ESTIMATION ===
    socket.on('submit_estimation', (data: { roomCode: string; playerId: string; value: number }) => {
      const room = rooms.get(data.roomCode);
      if (!room || room.state.phase !== 'estimation') return;

      const player = room.players.get(data.playerId);
      if (!player || player.estimationAnswer !== null) return;

      player.estimationAnswer = data.value;
      player.answerTime = room.state.timerEnd ? room.state.timerEnd - Date.now() : 0;

      io.to(data.roomCode).emit('room_update', roomToClient(room));
      io.to(data.roomCode).emit('player_answered', { 
        playerId: data.playerId,
        playerName: player.name 
      });

      const allAnswered = Array.from(room.players.values()).every(
        p => p.estimationAnswer !== null || !p.isConnected
      );
      if (allAnswered) {
        clearTimeout((room as any).questionTimer);
        showEstimationAnswer(room, io);
      }
    });

    // === NEXT (Host only) ===
    socket.on('next', (data: { roomCode: string; playerId: string }) => {
      const room = rooms.get(data.roomCode);
      if (!room) return;
      
      const player = room.players.get(data.playerId);
      if (!player?.isHost) return;

      if (room.state.phase === 'revealing' || room.state.phase === 'estimation_reveal') {
        proceedAfterReveal(room, io);
      } else if (room.state.phase === 'scoreboard') {
        // Prüfen ob letzte Runde - dann zum Finale, nicht zur nächsten Kategorie
        if (room.state.currentRound >= room.settings.maxRounds) {
          showFinalResults(room, io);
        } else {
          startCategorySelection(room, io);
        }
      }
    });

    // === DEV COMMANDS (Development only) ===
    socket.on('dev_command', (data: { roomCode: string; playerId: string; command: string; params?: any }) => {
      // Only allow in development
      if (process.env.NODE_ENV === 'production') return;

      const room = rooms.get(data.roomCode);
      if (!room) return;

      const player = room.players.get(data.playerId);
      if (!player?.isHost) return; // Only host can use dev commands

      console.log(`🔧 Dev command: ${data.command}`, data.params);

      switch (data.command) {
        case 'force_category_mode': {
          // Store forced mode for next category selection
          (room as any).forcedCategoryMode = data.params?.mode;
          io.to(room.code).emit('dev_notification', { 
            message: `Nächster Modus: ${data.params?.mode}` 
          });
          break;
        }

        case 'add_bot': {
          const botId = generatePlayerId();
          const botNames = ['🤖 Bot-Alex', '🤖 Bot-Sam', '🤖 Bot-Max', '🤖 Bot-Kim', '🤖 Bot-Jo'];
          const botName = botNames[room.players.size % botNames.length];
          
          const bot: Player = {
            id: botId,
            socketId: 'bot-' + botId,
            name: botName,
            avatarSeed: 'bot-' + Math.random().toString(36).slice(2),
            score: 0,
            isHost: false,
            isConnected: true,
            currentAnswer: null,
            estimationAnswer: null,
            answerTime: null,
            streak: 0,
          };
          
          room.players.set(botId, bot);
          
          // Register bot with BotManager
          botManager.registerBot(botId, data.roomCode, botName);
          
          io.to(room.code).emit('room_update', roomToClient(room));
          io.to(room.code).emit('dev_notification', { message: `${botName} hinzugefügt` });
          break;
        }

        case 'randomize_scores': {
          room.players.forEach(p => {
            p.score = Math.floor(Math.random() * 5000);
            p.streak = Math.floor(Math.random() * 5);
          });
          io.to(room.code).emit('room_update', roomToClient(room));
          io.to(room.code).emit('dev_notification', { message: 'Scores randomisiert' });
          break;
        }

        case 'skip_to_question': {
          if (room.state.phase === 'lobby') {
            startCategorySelection(room, io);
          }
          // Auto-select category if in voting phase
          setTimeout(() => {
            if (room.state.votingCategories.length > 0) {
              const randomCat = room.state.votingCategories[0];
              room.state.selectedCategory = randomCat.id;
              room.state.roundQuestions = getRandomQuestions(randomCat.id, room.settings.questionsPerRound);
              room.state.currentQuestionIndex = 0;
              startQuestion(room, io);
            }
          }, 500);
          break;
        }

        case 'skip_to_estimation': {
          // Find an estimation question and show it
          const categories = loadCategories();
          for (const [catId, catData] of categories) {
            const estQ = catData.questions.find(q => (q as any).correctAnswer !== undefined);
            if (estQ) {
              room.state.currentQuestion = {
                id: 'dev-est-' + Date.now(),
                text: estQ.question,
                type: 'estimation',
                category: catData.name,
                categoryIcon: catData.icon,
                correctValue: (estQ as any).correctAnswer,
                unit: (estQ as any).unit || '',
              };
              room.state.phase = 'estimation';
              room.state.timerEnd = Date.now() + 30000;
              emitPhaseChange(room, io, 'estimation');
              io.to(room.code).emit('room_update', roomToClient(room));
              io.to(room.code).emit('dev_notification', { message: 'Schätzfrage geladen' });
              break;
            }
          }
          break;
        }

        case 'skip_to_scoreboard': {
          showScoreboard(room, io);
          io.to(room.code).emit('dev_notification', { message: 'Scoreboard angezeigt' });
          break;
        }

        case 'skip_to_final': {
          showFinalResults(room, io);
          io.to(room.code).emit('dev_notification', { message: 'Finale angezeigt' });
          break;
        }
      }
    });

    // === RECONNECT ===
    socket.on('reconnect_player', (data: { roomCode: string; playerId: string }, callback) => {
      const room = rooms.get(data.roomCode);
      if (!room) {
        callback({ success: false, error: 'Raum nicht gefunden' });
        return;
      }

      const player = room.players.get(data.playerId);
      if (!player) {
        callback({ success: false, error: 'Spieler nicht gefunden' });
        return;
      }

      player.socketId = socket.id;
      player.isConnected = true;
      socket.join(data.roomCode);

      io.to(data.roomCode).emit('player_reconnected', { playerId: data.playerId });
      io.to(data.roomCode).emit('room_update', roomToClient(room));

      callback({ success: true, room: roomToClient(room) });
    });

    // === DISCONNECT ===
    socket.on('disconnect', () => {
      console.log(`🔌 Disconnected: ${socket.id}`);
      
      rooms.forEach((room, roomCode) => {
        room.players.forEach((player) => {
          if (player.socketId === socket.id) {
            player.isConnected = false;
            
            if (player.isHost) {
              const newHost = Array.from(room.players.values())
                .find(p => p.isConnected && p.id !== player.id);
              
              if (newHost) {
                player.isHost = false;
                newHost.isHost = true;
                room.hostId = newHost.id;
                io.to(roomCode).emit('host_changed', { newHostId: newHost.id });
              }
            }
            
            io.to(roomCode).emit('player_disconnected', { 
              playerId: player.id, 
              playerName: player.name 
            });
            io.to(roomCode).emit('room_update', roomToClient(room));

            setTimeout(() => {
              const currentRoom = rooms.get(roomCode);
              if (currentRoom) {
                const connected = Array.from(currentRoom.players.values()).filter(p => p.isConnected);
                if (connected.length === 0) {
                  // Clean up bots in this room
                  if (dev) {
                    botManager.cleanupRoom(roomCode);
                  }
                  rooms.delete(roomCode);
                  console.log(`🗑️ Room ${roomCode} deleted`);
                }
              }
            }, 60000);
          }
        });
      });
    });
  });

  // ============================================
  // GAME LOGIC
  // ============================================

  // ============================================
  // CATEGORY SELECTION MODES
  // ============================================

  function selectCategoryMode(room: GameRoom): CategorySelectionMode {
    // Check for forced mode (dev command)
    const forcedMode = (room as any).forcedCategoryMode;
    if (forcedMode) {
      delete (room as any).forcedCategoryMode; // Use only once
      console.log(`🔧 Using forced category mode: ${forcedMode}`);
      return forcedMode;
    }

    // Need at least 2 players for dice duel
    const connectedPlayers = Array.from(room.players.values()).filter(p => p.isConnected);
    const canDoDiceDuel = connectedPlayers.length >= 2;
    
    // Loser's Pick cooldown: can't happen two rounds in a row
    const canDoLosersPick = room.state.currentRound - room.state.lastLoserPickRound >= 2;
    
    const rand = Math.random() * 100;
    
    // Distribution: Voting 30%, Wheel 30%, Loser's Pick 20%, Dice Duel 20%
    if (canDoLosersPick && rand < 15) {
      return 'losers_pick';
    } else if (canDoDiceDuel && rand < 35) { // 15-35% = 20% for dice duel
      return 'dice_duel';
    } else if (rand < 65) { // 35-65% = 30% for wheel
      return 'wheel';
    } else {
      return 'voting'; // 65-100% = 35% for voting
    }
  }

  function getLoserPlayer(room: GameRoom): Player | null {
    const players = Array.from(room.players.values())
      .filter(p => p.isConnected)
      .sort((a, b) => a.score - b.score);
    return players[0] || null;
  }

  function startCategorySelection(room: GameRoom, io: SocketServer) {
    const mode = selectCategoryMode(room);
    room.state.categorySelectionMode = mode;
    // 8 categories for wheel, but voting/loser's pick will use all of them too
    room.state.votingCategories = getRandomCategoriesForVoting(8);
    room.state.categoryVotes = new Map();
    room.state.selectedCategory = null;
    room.state.loserPickPlayerId = null;

    console.log(`🎲 Round ${room.state.currentRound}: Category mode = ${mode}`);

    // First show announcement
    room.state.phase = 'category_announcement';
    
    let announcementData: any = { mode };
    
    if (mode === 'losers_pick') {
      const loser = getLoserPlayer(room);
      if (loser) {
        room.state.loserPickPlayerId = loser.id;
        room.state.lastLoserPickRound = room.state.currentRound;
        announcementData.loserPlayerId = loser.id;
        announcementData.loserPlayerName = loser.name;
      } else {
        // Fallback to voting if no loser found
        room.state.categorySelectionMode = 'voting';
        announcementData.mode = 'voting';
      }
    }

    io.to(room.code).emit('category_mode', announcementData);
    io.to(room.code).emit('room_update', roomToClient(room));

    // After announcement, start the actual selection
    setTimeout(() => {
      if (room.state.categorySelectionMode === 'voting') {
        startCategoryVoting(room, io);
      } else if (room.state.categorySelectionMode === 'wheel') {
        startCategoryWheel(room, io);
      } else if (room.state.categorySelectionMode === 'losers_pick') {
        startLosersPick(room, io);
      } else if (room.state.categorySelectionMode === 'dice_duel') {
        startDiceDuel(room, io);
      }
    }, 3000); // 3 seconds for announcement
  }

  function startCategoryVoting(room: GameRoom, io: SocketServer) {
    room.state.phase = 'category_voting';
    room.state.timerEnd = Date.now() + 15000;

    emitPhaseChange(room, io, 'category_voting');
    io.to(room.code).emit('room_update', roomToClient(room));

    setTimeout(() => {
      if (room.state.phase === 'category_voting') {
        finalizeCategoryVoting(room, io);
      }
    }, 15000);
  }

  function startCategoryWheel(room: GameRoom, io: SocketServer) {
    room.state.phase = 'category_wheel';
    
    // The wheel shows max 8 categories, so we only pick from those
    const WHEEL_SEGMENTS = 8;
    const wheelCategories = room.state.votingCategories.slice(0, WHEEL_SEGMENTS);
    
    // Pre-select a random category from the wheel categories
    const selectedIndex = Math.floor(Math.random() * wheelCategories.length);
    const selectedCat = wheelCategories[selectedIndex];
    
    // Store the selected index in room state so clients can read it on mount
    room.state.wheelSelectedIndex = selectedIndex;
    
    console.log(`🎡 Wheel will land on index ${selectedIndex}: ${selectedCat.name}`);
    
    emitPhaseChange(room, io, 'category_wheel');
    io.to(room.code).emit('room_update', roomToClient(room));

    // Wheel animation takes ~5 seconds, then show result
    setTimeout(() => {
      if (room.state.phase === 'category_wheel') {
        finalizeWheelSelection(room, io, selectedCat.id);
      }
    }, 5500); // Animation duration
  }

  function startLosersPick(room: GameRoom, io: SocketServer) {
    room.state.phase = 'category_losers_pick';
    room.state.timerEnd = Date.now() + 15000;

    emitPhaseChange(room, io, 'category_losers_pick');
    io.to(room.code).emit('room_update', roomToClient(room));

    // Timeout fallback - random selection if loser doesn't pick
    setTimeout(() => {
      if (room.state.phase === 'category_losers_pick') {
        const randomCat = room.state.votingCategories[
          Math.floor(Math.random() * room.state.votingCategories.length)
        ];
        finalizeLosersPick(room, io, randomCat.id);
      }
    }, 15000);
  }

  function startDiceDuel(room: GameRoom, io: SocketServer) {
    room.state.phase = 'category_dice_duel';
    
    // Select two random connected players
    const connectedPlayers = Array.from(room.players.values())
      .filter(p => p.isConnected);
    
    if (connectedPlayers.length < 2) {
      // Fallback to voting if not enough players
      startCategoryVoting(room, io);
      return;
    }

    // Shuffle and pick 2
    const shuffled = [...connectedPlayers].sort(() => Math.random() - 0.5);
    const player1 = shuffled[0];
    const player2 = shuffled[1];

    room.state.diceDuel = {
      player1Id: player1.id,
      player2Id: player2.id,
      player1Rolls: null,
      player2Rolls: null,
      winnerId: null,
      phase: 'selecting',
    };

    console.log(`🎲 Dice Duel: ${player1.name} vs ${player2.name}`);

    // Send initial state - players are being "selected"
    emitPhaseChange(room, io, 'category_dice_duel');
    io.to(room.code).emit('room_update', roomToClient(room));

    // Send dice_duel_start with a small delay to ensure clients have mounted
    setTimeout(() => {
      io.to(room.code).emit('dice_duel_start', {
        player1: { id: player1.id, name: player1.name, avatarSeed: player1.avatarSeed },
        player2: { id: player2.id, name: player2.name, avatarSeed: player2.avatarSeed },
      });
    }, 300);

    // After selection animation, allow rolling (300ms delay + 2500ms animation)
    setTimeout(() => {
      if (room.state.diceDuel) {
        room.state.diceDuel.phase = 'rolling';
        io.to(room.code).emit('dice_duel_ready');
        io.to(room.code).emit('room_update', roomToClient(room));
      }
    }, 2800);

    // Timeout - auto-roll for players who haven't rolled after 15 seconds
    setTimeout(() => {
      if (room.state.phase === 'category_dice_duel' && room.state.diceDuel?.phase === 'rolling') {
        // Auto-roll for any player who hasn't rolled
        if (!room.state.diceDuel.player1Rolls) {
          room.state.diceDuel.player1Rolls = [rollDie(), rollDie()];
          io.to(room.code).emit('dice_roll', {
            playerId: room.state.diceDuel.player1Id,
            rolls: room.state.diceDuel.player1Rolls,
          });
        }
        if (!room.state.diceDuel.player2Rolls) {
          room.state.diceDuel.player2Rolls = [rollDie(), rollDie()];
          io.to(room.code).emit('dice_roll', {
            playerId: room.state.diceDuel.player2Id,
            rolls: room.state.diceDuel.player2Rolls,
          });
        }
        checkDiceDuelResult(room, io);
      }
    }, 17800); // 2.8s selection + 15s rolling time
  }

  function checkDiceDuelResult(room: GameRoom, io: SocketServer) {
    const duel = room.state.diceDuel;
    if (!duel || !duel.player1Rolls || !duel.player2Rolls) return;

    const sum1 = duel.player1Rolls[0] + duel.player1Rolls[1];
    const sum2 = duel.player2Rolls[0] + duel.player2Rolls[1];

    console.log(`🎲 Dice results: Player1=${sum1}, Player2=${sum2}`);

    if (sum1 === sum2) {
      // Tie! Roll again
      io.to(room.code).emit('dice_duel_tie');
      
      // Reset rolls and let them roll again
      setTimeout(() => {
        if (room.state.diceDuel) {
          room.state.diceDuel.player1Rolls = null;
          room.state.diceDuel.player2Rolls = null;
          room.state.diceDuel.phase = 'rolling';
          io.to(room.code).emit('dice_duel_ready');
          io.to(room.code).emit('room_update', roomToClient(room));
        }
      }, 2000);
      return;
    }

    // We have a winner!
    const winnerId = sum1 > sum2 ? duel.player1Id : duel.player2Id;
    duel.winnerId = winnerId;
    duel.phase = 'result';
    room.state.loserPickPlayerId = winnerId; // Reuse this field for the winner who gets to pick

    const winner = room.players.get(winnerId);
    console.log(`🎲 Winner: ${winner?.name} with ${Math.max(sum1, sum2)}`);

    // Notify bot manager about dice duel winner
    if (dev) {
      botManager.onDiceDuelWinner(room.code, winnerId);
    }

    io.to(room.code).emit('dice_duel_winner', {
      winnerId,
      winnerName: winner?.name,
      sum1,
      sum2,
    });
    io.to(room.code).emit('room_update', roomToClient(room));

    // After showing winner, let them pick
    setTimeout(() => {
      if (room.state.phase === 'category_dice_duel') {
        startDiceDuelPick(room, io);
      }
    }, 3000);
  }

  function startDiceDuelPick(room: GameRoom, io: SocketServer) {
    room.state.timerEnd = Date.now() + 15000;
    io.to(room.code).emit('dice_duel_pick');
    io.to(room.code).emit('room_update', roomToClient(room));

    // Timeout fallback
    setTimeout(() => {
      if (room.state.phase === 'category_dice_duel' && room.state.diceDuel?.phase === 'result') {
        const randomCat = room.state.votingCategories[
          Math.floor(Math.random() * room.state.votingCategories.length)
        ];
        finalizeDiceDuelPick(room, io, randomCat.id);
      }
    }, 15000);
  }

  function finalizeDiceDuelPick(room: GameRoom, io: SocketServer, categoryId: string) {
    room.state.selectedCategory = categoryId;
    room.state.roundQuestions = getRandomQuestions(categoryId, room.settings.questionsPerRound);
    room.state.currentQuestionIndex = 0;

    const categoryData = loadCategories().get(categoryId);
    const winner = room.state.diceDuel?.winnerId ? room.players.get(room.state.diceDuel.winnerId) : null;
    
    io.to(room.code).emit('category_selected', { 
      categoryId,
      categoryName: categoryData?.name,
      categoryIcon: categoryData?.icon,
      pickedBy: winner?.id,
      pickedByName: winner?.name,
    });

    // Clean up dice duel state
    room.state.diceDuel = null;

    setTimeout(() => {
      startQuestion(room, io);
    }, 2500);
  }

  function finalizeWheelSelection(room: GameRoom, io: SocketServer, categoryId: string) {
    room.state.selectedCategory = categoryId;
    room.state.roundQuestions = getRandomQuestions(categoryId, room.settings.questionsPerRound);
    room.state.currentQuestionIndex = 0;
    room.state.wheelSelectedIndex = null; // Clear wheel index

    const categoryData = loadCategories().get(categoryId);
    
    io.to(room.code).emit('category_selected', { 
      categoryId,
      categoryName: categoryData?.name,
      categoryIcon: categoryData?.icon,
    });

    setTimeout(() => {
      startQuestion(room, io);
    }, 2000);
  }

  function finalizeLosersPick(room: GameRoom, io: SocketServer, categoryId: string) {
    room.state.selectedCategory = categoryId;
    room.state.roundQuestions = getRandomQuestions(categoryId, room.settings.questionsPerRound);
    room.state.currentQuestionIndex = 0;

    const categoryData = loadCategories().get(categoryId);
    
    io.to(room.code).emit('category_selected', { 
      categoryId,
      categoryName: categoryData?.name,
      categoryIcon: categoryData?.icon,
      pickedBy: room.state.loserPickPlayerId,
    });

    setTimeout(() => {
      startQuestion(room, io);
    }, 2500);
  }

  function finalizeCategoryVoting(room: GameRoom, io: SocketServer) {
    const voteCounts = new Map<string, number>();
    room.state.categoryVotes.forEach((catId) => {
      voteCounts.set(catId, (voteCounts.get(catId) || 0) + 1);
    });

    let maxVotes = 0;
    let winners: string[] = [];
    
    if (voteCounts.size > 0) {
      voteCounts.forEach((count, catId) => {
        if (count > maxVotes) {
          maxVotes = count;
          winners = [catId];
        } else if (count === maxVotes) {
          winners.push(catId);
        }
      });
    }

    const selectedCategoryId = winners.length > 0 
      ? winners[Math.floor(Math.random() * winners.length)]
      : room.state.votingCategories[Math.floor(Math.random() * room.state.votingCategories.length)]?.id;

    room.state.selectedCategory = selectedCategoryId;
    room.state.roundQuestions = getRandomQuestions(selectedCategoryId, room.settings.questionsPerRound);
    room.state.currentQuestionIndex = 0;

    const categoryData = loadCategories().get(selectedCategoryId);
    
    io.to(room.code).emit('category_selected', { 
      categoryId: selectedCategoryId,
      categoryName: categoryData?.name,
      categoryIcon: categoryData?.icon,
    });

    setTimeout(() => {
      startQuestion(room, io);
    }, 2500);
  }

  function startQuestion(room: GameRoom, io: SocketServer) {
    const question = room.state.roundQuestions[room.state.currentQuestionIndex];
    if (!question) {
      showScoreboard(room, io);
      return;
    }

    room.players.forEach(p => {
      p.currentAnswer = null;
      p.estimationAnswer = null;
      p.answerTime = null;
    });

    room.state.phase = question.type === 'estimation' ? 'estimation' : 'question';
    room.state.currentQuestion = question;
    room.state.showingCorrectAnswer = false;
    room.state.timerEnd = Date.now() + (room.settings.timePerQuestion * 1000);

    emitPhaseChange(room, io, room.state.phase);
    io.to(room.code).emit('room_update', roomToClient(room));

    (room as any).questionTimer = setTimeout(() => {
      if (room.state.phase === 'question') {
        showAnswer(room, io);
      } else if (room.state.phase === 'estimation') {
        showEstimationAnswer(room, io);
      }
    }, room.settings.timePerQuestion * 1000);
  }

  function showAnswer(room: GameRoom, io: SocketServer) {
    room.state.phase = 'revealing';
    room.state.showingCorrectAnswer = true;
    room.state.timerEnd = null;

    const question = room.state.currentQuestion;
    if (!question) return;

    // Collect all players with their answer times for ordering
    const playerAnswers = Array.from(room.players.values()).map(player => ({
      player,
      answerTime: player.answerTime,
      hasAnswered: player.currentAnswer !== null,
    }));
    
    // Sort by answer time (highest = fastest, answered first) to get order
    const sortedByTime = [...playerAnswers]
      .filter(p => p.hasAnswered)
      .sort((a, b) => (b.answerTime || 0) - (a.answerTime || 0));
    
    // Create order map (1 = first to answer)
    const answerOrderMap = new Map<string, number>();
    sortedByTime.forEach((entry, index) => {
      answerOrderMap.set(entry.player.id, index + 1);
    });

    const results: any[] = [];
    
    room.players.forEach((player) => {
      const correct = player.currentAnswer === question.correctIndex;
      let basePoints = 0;
      let timeBonus = 0;
      let streakBonus = 0;

      if (correct) {
        basePoints = 1000;
        timeBonus = Math.max(0, Math.floor((player.answerTime || 0) / 100));
        streakBonus = Math.min(player.streak * 50, 250);
        player.streak++;
      } else {
        player.streak = 0;
      }

      const points = basePoints + timeBonus + streakBonus;
      player.score += points;
      
      results.push({
        playerId: player.id,
        playerName: player.name,
        avatarSeed: player.avatarSeed,
        correct,
        points,
        basePoints,
        timeBonus,
        streakBonus,
        streak: player.streak,
        newScore: player.score,
        answer: player.currentAnswer,
        answerOrder: answerOrderMap.get(player.id) || null,
        responseTimeMs: player.answerTime 
          ? room.settings.timePerQuestion * 1000 - player.answerTime 
          : null,
      });
    });

    // Sort by answer order for animation (null = didn't answer, goes last)
    results.sort((a, b) => {
      if (a.answerOrder === null && b.answerOrder === null) return 0;
      if (a.answerOrder === null) return 1;
      if (b.answerOrder === null) return -1;
      return a.answerOrder - b.answerOrder;
    });

    io.to(room.code).emit('answer_reveal', {
      correctIndex: question.correctIndex,
      results,
    });
    io.to(room.code).emit('room_update', roomToClient(room));
  }

  function showEstimationAnswer(room: GameRoom, io: SocketServer) {
    room.state.phase = 'estimation_reveal'; // Special phase for animated reveal
    room.state.showingCorrectAnswer = true;
    room.state.timerEnd = null;

    const question = room.state.currentQuestion;
    if (!question || question.correctValue === undefined) return;

    const correctValue = question.correctValue;
    
    // Collect answer times for ordering
    const playerAnswerTimes = Array.from(room.players.values())
      .filter(p => p.estimationAnswer !== null)
      .sort((a, b) => (b.answerTime || 0) - (a.answerTime || 0));
    
    const answerOrderMap = new Map<string, number>();
    playerAnswerTimes.forEach((player, index) => {
      answerOrderMap.set(player.id, index + 1);
    });
    
    // Calculate differences and sort (best first for results)
    const playerEstimates = Array.from(room.players.values())
      .map(p => ({
        player: p,
        estimation: p.estimationAnswer,
        diff: p.estimationAnswer !== null 
          ? p.estimationAnswer - correctValue
          : null,
        absDiff: p.estimationAnswer !== null 
          ? Math.abs(p.estimationAnswer - correctValue) 
          : Infinity,
      }))
      .sort((a, b) => a.absDiff - b.absDiff); // Best first

    const results: any[] = [];
    
    playerEstimates.forEach((entry, index) => {
      let basePoints = 0;
      let rankBonus = 0;
      let perfectBonus = 0;
      
      if (entry.estimation !== null) {
        // Points based on ranking
        const rankPoints = [1500, 1200, 1000, 800, 600, 400, 300, 200, 100, 50];
        basePoints = rankPoints[index] || 25;
        
        // Perfect answer bonus
        if (entry.absDiff === 0) {
          perfectBonus = 500;
        }
        
        entry.player.streak++;
      } else {
        entry.player.streak = 0;
      }

      const points = basePoints + perfectBonus;
      entry.player.score += points;
      
      results.push({
        playerId: entry.player.id,
        playerName: entry.player.name,
        avatarSeed: entry.player.avatarSeed,
        correct: entry.absDiff === 0,
        points,
        basePoints,
        timeBonus: 0, // No time bonus for estimation
        streakBonus: 0,
        streak: entry.player.streak,
        newScore: entry.player.score,
        answerOrder: answerOrderMap.get(entry.player.id) || null,
        responseTimeMs: entry.player.answerTime 
          ? room.settings.timePerQuestion * 1000 - entry.player.answerTime 
          : null,
        estimation: entry.estimation,
        diff: entry.diff,
        absDiff: entry.estimation !== null ? entry.absDiff : null,
        rank: index + 1,
      });
    });

    emitPhaseChange(room, io, 'estimation_reveal');
    io.to(room.code).emit('answer_reveal', {
      correctValue: question.correctValue,
      unit: question.unit,
      results,
    });
    io.to(room.code).emit('room_update', roomToClient(room));
  }

  function proceedAfterReveal(room: GameRoom, io: SocketServer) {
    room.state.currentQuestionIndex++;

    if (room.state.currentQuestionIndex >= room.settings.questionsPerRound) {
      showScoreboard(room, io);
    } else {
      startQuestion(room, io);
    }
  }

  function showScoreboard(room: GameRoom, io: SocketServer) {
    room.state.phase = 'scoreboard';
    room.state.currentQuestion = null;
    room.state.timerEnd = null;

    emitPhaseChange(room, io, 'scoreboard');
    io.to(room.code).emit('room_update', roomToClient(room));

    // Runde nur erhöhen wenn es NICHT die letzte Runde ist
    // Der Übergang zum Finale wird durch Host-Klick oder automatisch gesteuert
    if (room.state.currentRound < room.settings.maxRounds) {
      room.state.currentRound++;
    }
  }

  function showFinalResults(room: GameRoom, io: SocketServer) {
    room.state.phase = 'final';
    
    const finalRankings = Array.from(room.players.values())
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({
        rank: i + 1,
        playerId: p.id,
        name: p.name,
        score: p.score,
        avatarSeed: p.avatarSeed,
      }));

    io.to(room.code).emit('game_over', { rankings: finalRankings });
    io.to(room.code).emit('room_update', roomToClient(room));
  }

  // ============================================
  // NEXT.JS HANDLER
  // ============================================

  expressApp.all('/{*path}', (req: Request, res: Response) => {
    return handle(req, res);
  });

  // ============================================
  // START
  // ============================================

  httpServer.listen(port, () => {
    console.log(`
╔══════════════════════════════════════════╗
║   🎮 NerdQuiz Server                     ║
║   📍 http://${hostname}:${port}               ║
║   🔌 WebSocket ready                     ║
╚══════════════════════════════════════════╝
    `);
  });
});
