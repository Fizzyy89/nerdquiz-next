/**
 * Bot Manager - Handles AI bot players for testing
 * 
 * This module is completely separate from the main game logic.
 * Bots simulate real player behavior with random delays and choices.
 * Only active in development mode.
 */

import type { Server as SocketServer } from 'socket.io';

// ============================================
// TYPES
// ============================================

interface BotPlayer {
  id: string;
  roomCode: string;
  name: string;
}

interface GameRoom {
  code: string;
  players: Map<string, any>;
  state: {
    phase: string;
    diceDuel: any;
    loserPickPlayerId: string | null;
    votingCategories: any[];
    currentQuestion: any;
  };
}

type RoomGetter = (code: string) => GameRoom | undefined;

// ============================================
// BOT MANAGER CLASS
// ============================================

class BotManager {
  private bots: Map<string, BotPlayer> = new Map();
  private io: SocketServer | null = null;
  private getRoomFn: RoomGetter | null = null;
  private actionHandlers: Map<string, (data: any) => void> = new Map();
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Initialize the bot manager with socket server and room getter
   */
  initialize(io: SocketServer, getRoom: RoomGetter) {
    this.io = io;
    this.getRoomFn = getRoom;
    console.log('🤖 Bot Manager initialized');
  }

  /**
   * Register action handlers that bots can trigger
   */
  registerActionHandler(action: string, handler: (data: any) => void) {
    this.actionHandlers.set(action, handler);
  }

  /**
   * Register a new bot
   */
  registerBot(botId: string, roomCode: string, name: string) {
    this.bots.set(botId, { id: botId, roomCode, name });
    console.log(`🤖 Bot registered: ${name} (${botId}) in room ${roomCode}`);
  }

  /**
   * Remove a bot
   */
  removeBot(botId: string) {
    const bot = this.bots.get(botId);
    if (bot) {
      console.log(`🤖 Bot removed: ${bot.name}`);
      this.bots.delete(botId);
      // Clear any pending timers for this bot
      this.clearBotTimers(botId);
    }
  }

  /**
   * Clear all timers for a specific bot
   */
  private clearBotTimers(botId: string) {
    for (const [key, timer] of this.activeTimers) {
      if (key.startsWith(botId)) {
        clearTimeout(timer);
        this.activeTimers.delete(key);
      }
    }
  }

  /**
   * Get all bots in a room
   */
  getBotsInRoom(roomCode: string): BotPlayer[] {
    return Array.from(this.bots.values()).filter(b => b.roomCode === roomCode);
  }

  /**
   * Trigger bot actions based on game phase change
   */
  onPhaseChange(roomCode: string, phase: string) {
    const botsInRoom = this.getBotsInRoom(roomCode);
    if (botsInRoom.length === 0) return;

    const room = this.getRoomFn?.(roomCode);
    if (!room) return;

    console.log(`🤖 Phase change in ${roomCode}: ${phase} (${botsInRoom.length} bots)`);

    switch (phase) {
      case 'category_voting':
        this.handleVotingPhase(botsInRoom, room);
        break;
      case 'category_dice_duel':
        this.handleDiceDuelPhase(botsInRoom, room);
        break;
      case 'category_losers_pick':
        this.handleLoserPickPhase(botsInRoom, room);
        break;
      case 'question':
        this.handleQuestionPhase(botsInRoom, room);
        break;
      case 'estimation':
        this.handleEstimationPhase(botsInRoom, room);
        break;
    }
  }

  /**
   * Handle voting phase - bots vote for random categories
   */
  private handleVotingPhase(bots: BotPlayer[], room: GameRoom) {
    const categories = room.state.votingCategories;
    if (!categories || categories.length === 0) return;

    for (const bot of bots) {
      const delay = this.randomDelay(1000, 4000);
      const timerId = `${bot.id}-vote`;
      
      const timer = setTimeout(() => {
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        console.log(`🤖 ${bot.name} votes for ${randomCategory.name}`);
        
        this.triggerAction('vote_category', {
          roomCode: bot.roomCode,
          playerId: bot.id,
          categoryId: randomCategory.id,
        });
        
        this.activeTimers.delete(timerId);
      }, delay);
      
      this.activeTimers.set(timerId, timer);
    }
  }

  /**
   * Handle dice duel phase - bot rolls dice if selected
   */
  private handleDiceDuelPhase(bots: BotPlayer[], room: GameRoom) {
    // Wait for the duel to be ready (rolling phase)
    const checkAndRoll = () => {
      const duel = room.state.diceDuel;
      if (!duel || duel.phase !== 'rolling') return;

      for (const bot of bots) {
        const isInDuel = bot.id === duel.player1Id || bot.id === duel.player2Id;
        const hasRolled = 
          (bot.id === duel.player1Id && duel.player1Rolls) ||
          (bot.id === duel.player2Id && duel.player2Rolls);

        if (isInDuel && !hasRolled) {
          const delay = this.randomDelay(500, 2000);
          const timerId = `${bot.id}-dice`;
          
          const timer = setTimeout(() => {
            console.log(`🤖 ${bot.name} rolls the dice!`);
            
            this.triggerAction('dice_roll', {
              roomCode: bot.roomCode,
              playerId: bot.id,
            });
            
            this.activeTimers.delete(timerId);
          }, delay);
          
          this.activeTimers.set(timerId, timer);
        }
      }
    };

    // Check after a delay (wait for rolling phase)
    setTimeout(checkAndRoll, 3000);
  }

  /**
   * Handle loser pick phase - bot picks category if they're the loser
   */
  private handleLoserPickPhase(bots: BotPlayer[], room: GameRoom) {
    const loserId = room.state.loserPickPlayerId;
    const categories = room.state.votingCategories;
    
    for (const bot of bots) {
      if (bot.id === loserId && categories.length > 0) {
        const delay = this.randomDelay(1500, 4000);
        const timerId = `${bot.id}-loserpick`;
        
        const timer = setTimeout(() => {
          const randomCategory = categories[Math.floor(Math.random() * categories.length)];
          console.log(`🤖 ${bot.name} (loser) picks ${randomCategory.name}`);
          
          this.triggerAction('loser_pick_category', {
            roomCode: bot.roomCode,
            playerId: bot.id,
            categoryId: randomCategory.id,
          });
          
          this.activeTimers.delete(timerId);
        }, delay);
        
        this.activeTimers.set(timerId, timer);
      }
    }
  }

  /**
   * Handle question phase - bots answer with random choice
   */
  private handleQuestionPhase(bots: BotPlayer[], room: GameRoom) {
    const question = room.state.currentQuestion;
    if (!question || !question.answers) return;

    for (const bot of bots) {
      const delay = this.randomDelay(1500, 8000);
      const timerId = `${bot.id}-answer`;
      
      const timer = setTimeout(() => {
        // 60% chance to get it right (if we knew the answer), otherwise random
        // Since we don't know the correct answer here, just pick random
        const randomAnswer = Math.floor(Math.random() * question.answers.length);
        console.log(`🤖 ${bot.name} answers: ${randomAnswer}`);
        
        this.triggerAction('submit_answer', {
          roomCode: bot.roomCode,
          playerId: bot.id,
          answerIndex: randomAnswer,
        });
        
        this.activeTimers.delete(timerId);
      }, delay);
      
      this.activeTimers.set(timerId, timer);
    }
  }

  /**
   * Handle estimation phase - bots submit random estimation
   */
  private handleEstimationPhase(bots: BotPlayer[], room: GameRoom) {
    const question = room.state.currentQuestion;
    if (!question || question.correctValue === undefined) return;

    for (const bot of bots) {
      const delay = this.randomDelay(2000, 10000);
      const timerId = `${bot.id}-estimation`;
      
      const timer = setTimeout(() => {
        // Generate estimation within ±50% of correct value
        const correctValue = question.correctValue;
        const variance = correctValue * (0.5 * (Math.random() * 2 - 1)); // ±50%
        const estimation = Math.round(correctValue + variance);
        
        console.log(`🤖 ${bot.name} estimates: ${estimation} (correct: ${correctValue})`);
        
        this.triggerAction('submit_estimation', {
          roomCode: bot.roomCode,
          playerId: bot.id,
          value: Math.max(0, estimation), // Don't go negative
        });
        
        this.activeTimers.delete(timerId);
      }, delay);
      
      this.activeTimers.set(timerId, timer);
    }
  }

  /**
   * Handle dice duel pick - bot picks category if they won
   */
  onDiceDuelWinner(roomCode: string, winnerId: string) {
    const bot = this.bots.get(winnerId);
    if (!bot) return;

    const room = this.getRoomFn?.(roomCode);
    if (!room) return;

    const categories = room.state.votingCategories;
    if (!categories || categories.length === 0) return;

    const delay = this.randomDelay(1500, 4000);
    const timerId = `${bot.id}-dicepick`;
    
    const timer = setTimeout(() => {
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      console.log(`🤖 ${bot.name} (dice winner) picks ${randomCategory.name}`);
      
      this.triggerAction('dice_duel_pick', {
        roomCode: bot.roomCode,
        playerId: bot.id,
        categoryId: randomCategory.id,
      });
      
      this.activeTimers.delete(timerId);
    }, delay);
    
    this.activeTimers.set(timerId, timer);
  }

  /**
   * Trigger an action (calls registered handler)
   */
  private triggerAction(action: string, data: any) {
    const handler = this.actionHandlers.get(action);
    if (handler) {
      handler(data);
    } else {
      console.warn(`🤖 No handler for action: ${action}`);
    }
  }

  /**
   * Generate random delay between min and max ms
   */
  private randomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Check if a player ID belongs to a bot
   */
  isBot(playerId: string): boolean {
    return this.bots.has(playerId);
  }

  /**
   * Clean up all bots in a room (when room is deleted)
   */
  cleanupRoom(roomCode: string) {
    const botsInRoom = this.getBotsInRoom(roomCode);
    for (const bot of botsInRoom) {
      this.removeBot(bot.id);
    }
  }
}

// Export singleton instance
export const botManager = new BotManager();


