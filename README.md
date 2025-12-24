# NerdQuiz - Realtime Multiplayer Quiz App

🧠 Ein modernes, Browser-basiertes Multiplayer-Quiz-Spiel mit Echtzeit-Synchronisation.

## Tech Stack

- **Frontend:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS + Shadcn/UI
- **Animationen:** Framer Motion
- **Icons:** Lucide React
- **State Management:** Zustand
- **Realtime:** Socket.io (Custom Server)
- **Datenbank:** PostgreSQL (Supabase) + Prisma ORM

## 🚀 Quick Start

### 1. Dependencies installieren

```bash
npm install
```

### 2. Umgebungsvariablen konfigurieren

Kopiere `.env.example` zu `.env` und fülle die Werte aus:

```bash
cp .env.example .env
```

Erforderliche Variablen:
- `DATABASE_URL` - Supabase PostgreSQL Connection String (Pooler)
- `DIRECT_URL` - Supabase Direct Connection (für Migrationen)

### 3. Datenbank einrichten

```bash
# Prisma Client generieren
npm run db:generate

# Schema zur Datenbank pushen (Development)
npm run db:push

# ODER: Migration erstellen (Production)
npm run db:migrate
```

### 4. Development Server starten

```bash
npm run dev
```

Der Server startet auf `http://localhost:3001` und bietet sowohl die Next.js App als auch den Socket.io WebSocket Server.

## 📁 Projektstruktur

```
nerdquiz-next/
├── prisma/
│   └── schema.prisma      # Datenbank Schema
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── layout.tsx     # Root Layout
│   │   ├── page.tsx       # Home Page
│   │   └── globals.css    # Global Styles
│   ├── components/
│   │   ├── providers/     # React Context Provider
│   │   ├── screens/       # Game Screen Components
│   │   └── ui/            # Shadcn/UI Components
│   ├── hooks/
│   │   └── useSocket.ts   # Socket.io Hook
│   ├── lib/
│   │   └── socket.ts      # Socket Client Singleton
│   ├── store/
│   │   └── gameStore.ts   # Zustand Store
│   └── types/
│       └── game.ts        # TypeScript Types
├── server.ts              # Custom Server (Next.js + Socket.io)
└── package.json
```

## 🎮 Spielablauf

1. **Startseite:** Host erstellt Raum oder Spieler tritt bei
2. **Lobby:** Spieler warten, Host konfiguriert Einstellungen
3. **Kategorie-Voting:** Alle stimmen für eine Kategorie ab
4. **Fragen-Phase:** Multiple Choice mit Timer
5. **Schätzfragen:** Bonus-Runden mit numerischen Antworten
6. **Ergebnisse:** Punktestand nach jeder Frage
7. **Finale:** Podium und Gewinner-Celebration

## 📝 NPM Scripts

| Script | Beschreibung |
|--------|--------------|
| `npm run dev` | Startet Custom Server (Next.js + Socket.io) |
| `npm run dev:next` | Startet nur Next.js (ohne Socket.io) |
| `npm run build` | Production Build |
| `npm run start` | Production Server starten |
| `npm run db:generate` | Prisma Client generieren |
| `npm run db:push` | Schema zur DB pushen |
| `npm run db:migrate` | Migration erstellen |
| `npm run db:studio` | Prisma Studio öffnen |

## 🔌 Socket.io Events

### Client → Server
- `create_room` - Neuen Raum erstellen
- `join_room` - Raum beitreten
- `update_settings` - Spieleinstellungen ändern
- `start_game` - Spiel starten
- `vote_category` - Für Kategorie stimmen
- `submit_answer` - Antwort abgeben
- `submit_estimation` - Schätzung abgeben
- `next_round` - Nächste Runde starten

### Server → Client
- `room_update` - Aktualisierter Raum-Status
- `game_started` - Spiel gestartet
- `question_started` - Neue Frage
- `results` - Ergebnisse
- `game_ended` - Spiel beendet

## 🎨 Design System

Das Projekt verwendet ein dunkles Cyber/Gaming Theme mit:
- **Primary:** Electric Indigo (`oklch(0.65 0.25 265)`)
- **Secondary:** Cyber Pink (`oklch(0.7 0.2 340)`)
- **Background:** Deep Purple (`oklch(0.12 0.02 280)`)

Custom CSS Klassen:
- `.glass` - Glassmorphism Effekt
- `.btn-3d` - 3D Button Effekt
- `.gradient-text` - Gradient Text
- `.glow-primary` / `.glow-secondary` - Glow Effekte

## 🗄️ Datenbank Schema

- **Category** - Quiz-Kategorien
- **Question** - Fragen (Multiple Choice / Schätzung)
- **GameSession** - Spiel-Historie
- **PlayerResult** - Spieler-Ergebnisse
- **User** - Optionale User-Accounts

## 📱 Responsive Design

- Mobile-First Approach
- Große Touch-Targets für Smartphones
- Optimierte Layouts für Desktop

---

Made with ❤️ für Nerd-Quiz Fans
