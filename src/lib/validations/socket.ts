/**
 * Zod-Validierung für Socket.io Events
 * 
 * Validiert alle eingehenden Socket-Events für Sicherheit und Typsicherheit.
 */

import { z } from 'zod';

// ============================================
// COMMON SCHEMAS
// ============================================

/** 4-stelliger Room Code (nur erlaubte Zeichen) */
const RoomCodeSchema = z.string()
    .length(4, 'Room-Code muss 4 Zeichen haben')
    .regex(/^[A-Z2-9]+$/, 'Ungültiger Room-Code');

/** Player ID Format */
const PlayerIdSchema = z.string()
    .min(3, 'Player-ID zu kurz')
    .regex(/^p_[a-z0-9]+$/, 'Ungültiges Player-ID Format');

/** Player Name */
const PlayerNameSchema = z.string()
    .min(1, 'Name darf nicht leer sein')
    .max(16, 'Name zu lang')
    .trim();

// ============================================
// ROOM EVENTS
// ============================================

export const CreateRoomSchema = z.object({
    playerName: PlayerNameSchema,
    avatarOptions: z.string().max(500).optional(),
});

export const JoinRoomSchema = z.object({
    roomCode: RoomCodeSchema,
    playerName: PlayerNameSchema,
    avatarOptions: z.string().max(500).optional(),
});

export const ReconnectPlayerSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
});

// ============================================
// GAME SETTINGS
// ============================================

export const UpdateSettingsSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
    settings: z.object({
        maxRounds: z.number().int().min(1).max(20).optional(),
        questionsPerRound: z.number().int().min(1).max(20).optional(),
        timePerQuestion: z.number().int().min(5).max(60).optional(),
        bonusRoundChance: z.number().int().min(0).max(100).optional(),
        finalRoundAlwaysBonus: z.boolean().optional(),
        enableEstimation: z.boolean().optional(),
        enableMediaQuestions: z.boolean().optional(),
        hotButtonQuestionsPerRound: z.number().int().min(1).max(10).optional(),
    }),
});

// ============================================
// CATEGORY SELECTION
// ============================================

export const VoteCategorySchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
    categoryId: z.string().min(1).max(100),
});

export const LoserPickCategorySchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
    categoryId: z.string().min(1).max(100),
});

export const DiceRoyaleRollSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
});

export const DiceRoyalePickSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
    categoryId: z.string().min(1).max(100),
});

export const RPSChoiceSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
    choice: z.enum(['rock', 'paper', 'scissors']),
});

export const RPSDuelPickSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
    categoryId: z.string().min(1).max(100),
});

// ============================================
// ANSWERS
// ============================================

export const SubmitAnswerSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
    answerIndex: z.number().int().min(0).max(9),
});

export const SubmitEstimationSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
    value: z.number().finite(),
});

// ============================================
// BONUS ROUNDS
// ============================================

export const BonusRoundSubmitSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
    answer: z.string().max(500),
});

export const BonusRoundSkipSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
});

export const HotButtonBuzzSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
});

export const HotButtonSubmitSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
    answer: z.string().max(500),
});

// ============================================
// GAME FLOW
// ============================================

export const StartGameSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
});

export const NextSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
});

export const VoteRematchSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
    vote: z.enum(['yes', 'no']),
});

// ============================================
// AVATAR
// ============================================

export const RerollAvatarSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
});

export const UpdateAvatarSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
    avatarOptions: z.string().max(500),
});

// ============================================
// DEV COMMANDS
// ============================================

export const EnableDevModeSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
    secretCode: z.string().max(100),
});

export const DevCommandSchema = z.object({
    roomCode: RoomCodeSchema,
    playerId: PlayerIdSchema,
    command: z.string().max(50),
    params: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// VALIDATION HELPER
// ============================================

/**
 * Validiert Socket-Event-Daten und gibt typsicheres Ergebnis zurück.
 * Bei Fehler wird null zurückgegeben und ein Warning geloggt.
 */
export function validateSocketEvent<T extends z.ZodSchema>(
    schema: T,
    data: unknown,
    eventName: string
): z.infer<T> | null {
    const result = schema.safeParse(data);
    if (!result.success) {
        console.warn(`⚠️ Invalid ${eventName} event:`, result.error.issues.map(i => i.message).join(', '));
        return null;
    }
    return result.data;
}

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateRoomData = z.infer<typeof CreateRoomSchema>;
export type JoinRoomData = z.infer<typeof JoinRoomSchema>;
export type VoteCategoryData = z.infer<typeof VoteCategorySchema>;
export type SubmitAnswerData = z.infer<typeof SubmitAnswerSchema>;
export type SubmitEstimationData = z.infer<typeof SubmitEstimationSchema>;
export type RPSChoiceData = z.infer<typeof RPSChoiceSchema>;
export type DevCommandData = z.infer<typeof DevCommandSchema>;
