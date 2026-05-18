# AI Retro Arcade Platform — Engineering Build Plan

> **Author:** Senior Software Engineer  
> **Version:** 1.0  
> **Total Duration:** 8 Weeks  
> **Stack:** React + Vite + Tailwind · HTML5 Canvas · Minimax / A* · Claude API (LLM)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Decision Records](#2-architecture-decision-records)
3. [Tech Stack & Tooling](#3-tech-stack--tooling)
4. [System Architecture](#4-system-architecture)
5. [Phase 1 — Foundation & Infrastructure (Week 1)](#5-phase-1--foundation--infrastructure-week-1)
6. [Phase 2 — Core Game Logic, No AI (Weeks 2–3)](#6-phase-2--core-game-logic-no-ai-weeks-23)
7. [Phase 3 — AI Agent Integration (Weeks 4–6)](#7-phase-3--ai-agent-integration-weeks-46)
8. [Phase 4 — Polish, QA & Launch (Weeks 7–8)](#8-phase-4--polish-qa--launch-weeks-78)
9. [AI Feature Specifications](#9-ai-feature-specifications)
10. [Data Models & State Design](#10-data-models--state-design)
11. [API & Prompt Engineering Strategy](#11-api--prompt-engineering-strategy)
12. [Risk Register](#12-risk-register)
13. [Acceptance Criteria Mapping](#13-acceptance-criteria-mapping)
14. [Engineering Standards & Conventions](#14-engineering-standards--conventions)

---

## 1. Project Overview

The AI Retro Arcade Platform is a browser-based gaming experience delivering two classic games — **Tic-Tac-Toe** and **Snake** — augmented with five distinct AI Agent features. The AI agents range from deterministic algorithms (Minimax, A*) to LLM-powered agents (persona opponents, strategy coaches, post-game analysts) built on the Claude API.

### Goals

- Ship a fully playable, bug-free dual-game platform within 8 weeks.
- Integrate 5 distinct AI agent modes with sub-2s response times.
- Keep LLM token costs minimal through disciplined prompt engineering.
- Deliver a visually polished, retro-arcade aesthetic that is fully responsive across all screen sizes.

### Non-Goals (v1)

- User accounts, leaderboards, or persistent storage.
- Backend server (all logic runs client-side; API calls go directly from browser to LLM proxy).
- Mobile native apps.

---

## 2. Architecture Decision Records

### ADR-01: Client-Side Only Architecture

**Decision:** No backend server in v1. React app calls an LLM proxy endpoint directly.  
**Rationale:** Eliminates infrastructure complexity, reduces delivery risk, and keeps the scope tight for an 8-week timeline.  
**Consequence:** API key must be managed through an environment variable injected at build time or via a thin Cloudflare Worker proxy to avoid exposure.

### ADR-02: Deterministic Algorithms First, LLM Second

**Decision:** All game-logic AI (Minimax for XO, A* for Snake) is deterministic JavaScript. The LLM is used only for text generation (chat messages, hints, analytics reports).  
**Rationale:** Guarantees optimal gameplay performance with zero API latency. LLM calls are decoupled — their failure never breaks the game loop.  
**Consequence:** Two separate AI subsystems must be maintained. The LLM layer must be designed as an optional overlay.

### ADR-03: Zustand for State Management

**Decision:** Use Zustand over Redux or Context API.  
**Rationale:** Lightweight, boilerplate-free, and well-suited for isolated per-game state slices. Context re-renders make game loops fragile; Zustand subscriptions are surgical.

### ADR-04: HTML5 Canvas for Snake, React DOM for Tic-Tac-Toe

**Decision:** Snake uses a `<canvas>` element driven by `requestAnimationFrame`. Tic-Tac-Toe uses a React DOM grid.  
**Rationale:** Snake requires 60fps rendering and imperative game-loop control — Canvas is the correct tool. Tic-Tac-Toe is a 9-cell grid with infrequent updates — React DOM is simpler and makes AI overlay integration easier.

### ADR-05: Prompt Engineering Over Fine-Tuning

**Decision:** All LLM behaviour is shaped via system prompts and structured context objects. No fine-tuning.  
**Rationale:** Cost-effective, fast to iterate, and sufficient for the text-generation tasks required (persona messages, hints, reports).

---

## 3. Tech Stack & Tooling

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React 18 + Vite | Fast HMR, modern JSX, excellent ecosystem |
| Styling | Tailwind CSS v3 | Utility-first, easy retro-theme tokens |
| State | Zustand | Minimal boilerplate, per-game slices |
| Routing | React Router v6 | Lazy-loaded game routes |
| Game rendering | HTML5 Canvas (Snake) / React DOM (XO) | Right tool per game type |
| AI (deterministic) | Pure JS — Minimax + Alpha-Beta (XO), A* (Snake) | Zero latency, zero cost |
| AI (LLM) | Claude API (`claude-sonnet-4-20250514`) | Text gen for personas, hints, analytics |
| Testing | Vitest + React Testing Library | Unit + integration tests |
| Linting | ESLint + Prettier | Consistent code style |
| CI | GitHub Actions | Lint, test, build on every PR |

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          React App (Vite)                        │
│                                                                   │
│  ┌─────────────┐   ┌──────────────────────────────────────────┐  │
│  │  Dashboard  │   │            Game Shell                    │  │
│  │  (Home)     │──▶│  ┌──────────────┐  ┌──────────────────┐  │  │
│  └─────────────┘   │  │ Tic-Tac-Toe  │  │   Snake Game     │  │  │
│                    │  │              │  │                  │  │  │
│                    │  │ ┌──────────┐ │  │ ┌────────────┐  │  │  │
│                    │  │ │Minimax   │ │  │ │ Canvas Loop│  │  │  │
│                    │  │ │Engine    │ │  │ │ A* Pathfind│  │  │  │
│                    │  │ └──────────┘ │  │ └────────────┘  │  │  │
│                    │  └──────────────┘  └──────────────────┘  │  │
│                    └──────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                  AI Service Layer                          │   │
│  │  ┌───────────────┐  ┌──────────────┐  ┌───────────────┐  │   │
│  │  │ Prompt Builder│  │  API Client  │  │Response Parser│  │   │
│  │  └───────────────┘  └──────────────┘  └───────────────┘  │   │
│  │               ↕ Claude API (claude-sonnet)                 │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                Zustand State Stores                        │   │
│  │   xoStore · snakeStore · uiStore · telemetryStore         │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Folder Structure

```
src/
├── features/
│   ├── tictactoe/
│   │   ├── components/       # Board, Cell, ChatBubble, HintOverlay
│   │   ├── engine/           # minimax.js, boardUtils.js
│   │   ├── hooks/            # useXOGame, usePersonaAgent, useCoachAgent
│   │   ├── store/            # xoStore.js (Zustand)
│   │   └── TicTacToe.jsx
│   └── snake/
│       ├── components/       # Canvas, ScoreHUD, DifficultyBadge
│       ├── engine/           # gameLoop.js, astar.js, collision.js
│       ├── hooks/            # useSnakeGame, useGameMaster, useRivalSnake
│       ├── store/            # snakeStore.js (Zustand)
│       └── Snake.jsx
├── shared/
│   ├── ai/                   # aiService.js, promptTemplates.js, tokenGuard.js
│   ├── analytics/            # telemetryCollector.js, reportFormatter.js
│   ├── components/           # Button, Modal, ModeSelector, PostGameReport
│   └── hooks/                # useAIStream.js
├── pages/
│   ├── Dashboard.jsx
│   └── NotFound.jsx
├── styles/
│   └── theme.css             # Tailwind custom tokens (retro palette)
└── main.jsx
```

---

## 5. Phase 1 — Foundation & Infrastructure (Week 1)

**Goal:** An empty-but-running app with all shared infrastructure in place. No game logic yet — only scaffolding.

### Deliverables

#### 5.1 Project Scaffold

- Initialize Vite + React 18 project.
- Configure Tailwind CSS with a custom retro-arcade theme (scanline aesthetic, neon accent colors, pixel-friendly font stack).
- Set up ESLint (Airbnb ruleset) + Prettier with pre-commit hooks (Husky + lint-staged).
- Configure path aliases (`@features`, `@shared`, `@pages`) in `vite.config.js`.

#### 5.2 Routing & Layout Shell

```jsx
// src/main.jsx — Route structure
<BrowserRouter>
  <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/tictactoe" element={<Suspense fallback={<Loader />}><TicTacToe /></Suspense>} />
    <Route path="/snake" element={<Suspense fallback={<Loader />}><Snake /></Suspense>} />
  </Routes>
</BrowserRouter>
```

- Dashboard with game-selection cards (animated hover states).
- Each game route is lazy-loaded — zero upfront JS cost for the other game.
- Shared `<GameShell>` layout: back button, score display, mode badge, mute toggle.

#### 5.3 AI Service Abstraction Layer

This is the most critical infrastructure piece. All LLM calls flow through a single, well-tested service.

```javascript
// src/shared/ai/aiService.js

const AI_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  max_tokens: 120,          // Hard ceiling — never allow open-ended generation
  temperature: 0.8,
};

/**
 * Core LLM call with token guard, retry (1x), and 2s timeout.
 * Returns { text: string } | { error: string }
 */
export async function callAI({ systemPrompt, userMessage, maxTokens = 120 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch('/api/ai', {  // Thin proxy (Cloudflare Worker)
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        ...AI_CONFIG,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    const data = await response.json();
    return { text: data.content[0].text.trim() };
  } catch (err) {
    return { error: err.name === 'AbortError' ? 'timeout' : 'api_error' };
  } finally {
    clearTimeout(timeout);
  }
}
```

Key design properties:
- **2-second hard timeout** using `AbortController` — game flow never blocks on AI.
- **Token ceiling** enforced at the service level, not just in individual prompts.
- **Graceful degradation** — every AI feature must function (silently) when `error` is returned.
- **Single proxy endpoint** — API key lives only in the Cloudflare Worker environment, never in the browser bundle.

#### 5.4 Zustand Store Scaffolding

Create empty stores with defined shape — implementation comes in Phase 2.

```javascript
// src/features/tictactoe/store/xoStore.js
import { create } from 'zustand';

export const useXOStore = create((set) => ({
  board: Array(9).fill(null),
  currentPlayer: 'X',
  winner: null,
  mode: 'pvp',            // 'pvp' | 'persona' | 'coach'
  persona: 'provoker',    // 'provoker' | 'cheerleader' | 'joker'
  chatMessages: [],
  hint: null,
  telemetry: { moves: [], timestamps: [] },
  actions: {
    makeMove: (index) => set(/* ... */),
    resetGame: () => set(/* ... */),
    setMode: (mode) => set({ mode }),
    addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
    setHint: (hint) => set({ hint }),
  }
}));
```

#### 5.5 Telemetry Collector

Build the data collection system now, so it is wired into game hooks from the first move.

```javascript
// src/shared/analytics/telemetryCollector.js

export function createTelemetry() {
  return {
    startTime: Date.now(),
    moves: [],                // { player, position, timestamp, boardState }
    offensiveMoves: 0,        // XO: moves that advance a winning line
    defensiveMoves: 0,        // XO: moves that block opponent's winning line
    snakeScore: 0,
    deathCause: null,         // 'wall' | 'self' | 'rival'
    shieldsUsed: 0,
    maneuverLog: [],          // Snake: direction changes per second
  };
}

export function classifyXOMove(board, index, player) {
  // Returns 'offensive' | 'defensive' | 'neutral'
  // Used to build the post-game analyst prompt
}
```

---

## 6. Phase 2 — Core Game Logic, No AI (Weeks 2–3)

**Goal:** Both games are fully playable in their classic modes. AI text features are absent — only deterministic logic. This phase is a complete, shippable v0 of the games.

### 6.1 Tic-Tac-Toe Engine

#### Board Logic

```javascript
// src/features/tictactoe/engine/boardUtils.js

export const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],  // rows
  [0,3,6],[1,4,7],[2,5,8],  // cols
  [0,4,8],[2,4,6],           // diagonals
];

export function checkWinner(board) {
  for (const [a,b,c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a,b,c] };
    }
  }
  return board.every(Boolean) ? { winner: 'draw' } : null;
}

export function getAvailableMoves(board) {
  return board.reduce((acc, cell, i) => cell ? acc : [...acc, i], []);
}
```

#### Minimax Engine with Alpha-Beta Pruning

```javascript
// src/features/tictactoe/engine/minimax.js

/**
 * Returns the optimal move index for the AI player.
 * Alpha-beta pruning ensures <1ms for any board state.
 */
export function getBestMove(board, aiPlayer) {
  const humanPlayer = aiPlayer === 'X' ? 'O' : 'X';
  let bestScore = -Infinity;
  let bestMove = null;

  for (const move of getAvailableMoves(board)) {
    const newBoard = board.slice();
    newBoard[move] = aiPlayer;
    const score = minimax(newBoard, 0, false, -Infinity, Infinity, aiPlayer, humanPlayer);
    if (score > bestScore) { bestScore = score; bestMove = move; }
  }
  return bestMove;
}

function minimax(board, depth, isMax, alpha, beta, aiPlayer, humanPlayer) {
  const result = checkWinner(board);
  if (result?.winner === aiPlayer) return 10 - depth;
  if (result?.winner === humanPlayer) return depth - 10;
  if (result?.winner === 'draw') return 0;

  if (isMax) {
    let best = -Infinity;
    for (const move of getAvailableMoves(board)) {
      board[move] = aiPlayer;
      best = Math.max(best, minimax(board, depth+1, false, alpha, beta, aiPlayer, humanPlayer));
      board[move] = null;
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;  // Beta cutoff
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of getAvailableMoves(board)) {
      board[move] = humanPlayer;
      best = Math.min(best, minimax(board, depth+1, true, alpha, beta, aiPlayer, humanPlayer));
      board[move] = null;
      beta = Math.min(beta, best);
      if (beta <= alpha) break;  // Alpha cutoff
    }
    return best;
  }
}
```

**Performance note:** Alpha-beta pruning reduces the Tic-Tac-Toe search space from ~255,168 nodes to ~2,000 at the opening move. Response time is always under 1ms — synchronous execution is safe.

#### Tic-Tac-Toe Components

- `<Board>` — 3×3 CSS Grid, accessible (`role="grid"`, `aria-label` per cell).
- `<Cell>` — animates X/O placement with a CSS scale-in + color flash.
- `<WinLine>` — SVG overlay that draws the winning line across the board.
- `<ModeSelector>` — tabbed UI: PvP | Persona Opponent | Strategy Coach.
- `<ChatBubble>` — animated speech bubble above the board (Phase 3 wires content).
- `<HintOverlay>` — semi-transparent highlight on a cell with tooltip (Phase 3 wires content).

### 6.2 Snake Game Engine

#### Game Loop Architecture

```javascript
// src/features/snake/engine/gameLoop.js

export class SnakeEngine {
  constructor(canvas, gridSize = 20) {
    this.ctx = canvas.getContext('2d');
    this.gridSize = gridSize;     // cells per row/col
    this.cellSize = canvas.width / gridSize;
    this.reset();
  }

  reset() {
    this.snake = [{ x: 10, y: 10 }];   // Player snake
    this.rival = null;                   // Populated in Rival mode
    this.direction = { x: 1, y: 0 };
    this.pendingDir = null;
    this.food = this.spawnFood();
    this.shields = [];
    this.obstacles = [];
    this.score = 0;
    this.speed = 150;                    // ms per tick (lower = faster)
    this.isRunning = false;
    this.telemetry = createTelemetry();
  }

  tick() {
    // 1. Apply pending direction change (buffered to prevent 180° reversal)
    if (this.pendingDir) { this.direction = this.pendingDir; this.pendingDir = null; }

    // 2. Move snake
    const head = { x: this.snake[0].x + this.direction.x, y: this.snake[0].y + this.direction.y };

    // 3. Collision detection: wall, self, obstacles
    if (this.checkCollision(head)) { this.gameOver('wall_or_self'); return; }

    // 4. Eat food
    const atFood = head.x === this.food.x && head.y === this.food.y;
    this.snake.unshift(head);
    if (atFood) { this.score++; this.food = this.spawnFood(); }
    else { this.snake.pop(); }

    // 5. Render
    this.render();
  }

  checkCollision(head) {
    const hitWall = head.x < 0 || head.y < 0 || head.x >= this.gridSize || head.y >= this.gridSize;
    const hitSelf = this.snake.some(seg => seg.x === head.x && seg.y === head.y);
    const hitObstacle = this.obstacles.some(o => o.x === head.x && o.y === head.y);
    return hitWall || hitSelf || hitObstacle;
  }

  spawnFood(type = 'normal') {
    // Ensures food never spawns on a snake body, rival body, or obstacle
    const occupied = [...this.snake, ...(this.rival || []), ...this.obstacles];
    let pos;
    do { pos = { x: Math.floor(Math.random()*this.gridSize), y: Math.floor(Math.random()*this.gridSize), type }; }
    while (occupied.some(s => s.x === pos.x && s.y === pos.y));
    return pos;
  }
}
```

#### A* Pathfinding for Rival Snake

```javascript
// src/features/snake/engine/astar.js

/**
 * Returns next move direction for the AI snake toward a target.
 * Avoids player snake body, own body, walls, and obstacles.
 */
export function getNextMove({ head, target, avoidCells, gridSize }) {
  const openSet = [{ pos: head, g: 0, h: heuristic(head, target), parent: null }];
  const closed = new Set();

  while (openSet.length) {
    openSet.sort((a, b) => (a.g + a.h) - (b.g + b.h));  // Priority queue (min f = g + h)
    const current = openSet.shift();
    const key = `${current.pos.x},${current.pos.y}`;

    if (current.pos.x === target.x && current.pos.y === target.y) {
      // Trace path back to find first step
      let node = current;
      while (node.parent?.parent) node = node.parent;
      const dx = node.pos.x - head.x;
      const dy = node.pos.y - head.y;
      return { x: dx, y: dy };
    }

    if (closed.has(key)) continue;
    closed.add(key);

    for (const neighbor of getNeighbors(current.pos, gridSize, avoidCells)) {
      const nKey = `${neighbor.x},${neighbor.y}`;
      if (!closed.has(nKey)) {
        openSet.push({ pos: neighbor, g: current.g + 1, h: heuristic(neighbor, target), parent: current });
      }
    }
  }
  return null;  // No path found — fall back to random safe move
}

function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);  // Manhattan distance
}
```

**Edge case:** When A* returns `null` (rival is fully trapped), the rival snake falls back to a "flood fill survival" move — it picks the neighbor cell that maximises accessible free space. This prevents premature rival death in tight corridors.

---

## 7. Phase 3 — AI Agent Integration (Weeks 4–6)

**Goal:** All 5 AI features from the PRD are fully wired and tested. Game logic from Phase 2 remains unmodified — AI is layered on top as hooks and side effects.

### 7.1 Feature 4.1 — Persona Opponent (Tic-Tac-Toe)

**Trigger events:** After every AI move, when the game ends, when the human makes a particularly good or bad move.

**Prompt design principle:** The board state is communicated as a compact string (`"X.O|..X|OX."`) to minimise tokens. The persona and event type are the only variable inputs.

```javascript
// src/shared/ai/promptTemplates.js

export const PERSONA_SYSTEM_PROMPTS = {
  provoker: `You are a smug, competitive Tic-Tac-Toe opponent. React to game events with short, trash-talking messages (1–2 sentences max, under 25 words). Be playful, never offensive. Use no emojis.`,
  
  cheerleader: `You are an enthusiastic, supportive Tic-Tac-Toe opponent. React to game events with energetic, encouraging messages (1–2 sentences max, under 25 words). Celebrate both your wins and the player's good moves.`,
  
  joker: `You are a deadpan comedian playing Tic-Tac-Toe. React to game events with dry, absurdist one-liners (1 sentence max, under 20 words). Never explain the joke.`,
};

export function buildPersonaPrompt({ persona, event, boardString, moveIndex }) {
  const events = {
    ai_winning_soon: 'You are one move from winning.',
    player_winning_soon: 'The player is one move from winning.',
    player_good_move: `The player played position ${moveIndex}, a strong tactical move.`,
    player_bad_move: `The player played position ${moveIndex}, a weak move.`,
    ai_wins: 'You just won the game.',
    player_wins: 'The player just won the game.',
    draw: 'The game ended in a draw.',
  };
  return `Board state (row by row, dot=empty): ${boardString}\nEvent: ${events[event]}\nReact now.`;
}
```

**Debouncing:** LLM is called with a 300ms debounce after each move. If a new move arrives before the previous response, the in-flight request is cancelled via `AbortController`.

**UI:** `<ChatBubble>` component renders with a typewriter animation. Messages queue — only one message is shown at a time, with a 3s auto-dismiss.

### 7.2 Feature 4.2 — Strategy Coach Agent (Tic-Tac-Toe)

**Trigger:** After every opponent (AI) move, compute the board state and fire an optional hint request. The hint is optional — the user must press "Show Hint" to reveal it.

**Architecture insight:** Run the Minimax engine client-side to get the best move index. Then ask the LLM only to explain *why* it is the best move — not to calculate it. This separates correctness (deterministic) from explanation quality (LLM).

```javascript
// src/features/tictactoe/hooks/useCoachAgent.js

export function useCoachAgent() {
  const { board, currentPlayer } = useXOStore();
  const [hint, setHint] = useState(null);
  const [loading, setLoading] = useState(false);

  const requestHint = useCallback(async () => {
    setLoading(true);
    const bestMoveIndex = getBestMove(board, currentPlayer);          // Deterministic
    const context = buildCoachPrompt({ board, bestMoveIndex, currentPlayer });
    const { text, error } = await callAI({
      systemPrompt: COACH_SYSTEM_PROMPT,
      userMessage: context,
      maxTokens: 80,   // Explanation should be concise
    });
    setHint(error ? { index: bestMoveIndex, explanation: 'Play in the highlighted square.' } : { index: bestMoveIndex, explanation: text });
    setLoading(false);
  }, [board, currentPlayer]);

  return { hint, loading, requestHint };
}
```

**Fallback:** If the LLM call fails or times out, the hint still shows — just with a generic explanation. The highlighted cell (from Minimax) always appears.

### 7.3 Feature 4.3 — Dynamic Game Master (Snake)

**Architecture:** A `useGameMaster` hook runs a scoring monitor on every `tick`. It uses local thresholds (no LLM) to trigger difficulty adjustments. The LLM is invoked only once — to generate an in-game notification message when a difficulty change occurs.

```javascript
// src/features/snake/hooks/useGameMaster.js

const DIFFICULTY_THRESHOLDS = {
  scoreJumpForSpeedup: 5,       // Gained 5 points in under 10 seconds → speed up
  earlyDeathStreak: 3,          // Died 3 times with score < 3 → slow down + spawn shield
  obstacleSpawnScore: 10,       // Score ≥ 10 → start spawning obstacles
};

export function useGameMaster(engineRef) {
  const [notifications, setNotifications] = useState([]);
  const sessionRef = useRef({ deaths: 0, lastScoreTime: Date.now(), lastScore: 0 });

  const evaluate = useCallback(async (score, isAlive) => {
    const session = sessionRef.current;

    if (!isAlive) {
      session.deaths++;
      if (session.deaths >= DIFFICULTY_THRESHOLDS.earlyDeathStreak && score < 3) {
        engineRef.current.speed = Math.min(engineRef.current.speed + 40, 250);  // Slow down
        engineRef.current.food = engineRef.current.spawnFood('shield');          // Shield fruit
        notify('Taking it easy on you — shield fruit incoming.');
        session.deaths = 0;
      }
      return;
    }

    const now = Date.now();
    const scoreDelta = score - session.lastScore;
    const timeDelta = (now - session.lastScoreTime) / 1000;

    if (scoreDelta >= DIFFICULTY_THRESHOLDS.scoreJumpForSpeedup && timeDelta < 10) {
      engineRef.current.speed = Math.max(engineRef.current.speed - 20, 60);    // Speed up
      engineRef.current.spawnObstacle();
      notify("You're too good. Things just got harder.");
    }

    session.lastScore = score;
    session.lastScoreTime = now;
  }, []);

  async function notify(fallbackMsg) {
    const { text } = await callAI({ systemPrompt: GAME_MASTER_SYSTEM_PROMPT, userMessage: fallbackMsg, maxTokens: 30 });
    setNotifications(n => [...n, { id: Date.now(), text: text || fallbackMsg }]);
  }

  return { evaluate, notifications };
}
```

### 7.4 Feature 4.4 — Rival Snake Agent

**Architecture:** The `useRivalSnake` hook runs a separate update cycle at the same `speed` interval as the player snake. It calls `getNextMove()` (A*) each tick targeting the nearest food item not already targeted by the player.

```javascript
// src/features/snake/hooks/useRivalSnake.js

export function useRivalSnake(engineRef) {
  const updateRival = useCallback(() => {
    const engine = engineRef.current;
    if (!engine.rival || engine.rival.length === 0) return;

    const rivalHead = engine.rival[0];
    const avoidCells = [...engine.snake, ...engine.rival.slice(1), ...engine.obstacles];
    
    const nextDir = getNextMove({
      head: rivalHead,
      target: engine.food,
      avoidCells,
      gridSize: engine.gridSize,
    }) ?? getRandomSafeMove(rivalHead, avoidCells, engine.gridSize);  // Fallback

    if (!nextDir) { engine.gameOver('rival_trapped'); return; }

    const newHead = { x: rivalHead.x + nextDir.x, y: rivalHead.y + nextDir.y };

    // Check collision with player — rival dies, not player
    if (engine.snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
      engine.rival = null;  // Rival is eliminated
      return;
    }

    const atFood = newHead.x === engine.food.x && newHead.y === engine.food.y;
    engine.rival.unshift(newHead);
    if (atFood) { engine.rivalScore++; engine.food = engine.spawnFood(); }
    else { engine.rival.pop(); }
  }, []);

  return { updateRival };
}
```

**Visual distinction:** Player snake is rendered in the primary neon color (e.g., `#39FF14`). Rival snake uses a contrasting color (e.g., `#FF3131`). Both are rendered in the same canvas `render()` pass.

### 7.5 Feature 4.5 — Post-Game Performance Analyst

**Trigger:** Called once, immediately after `gameOver()` fires for either game.

**Data passed to LLM:** Structured JSON summary of the telemetry object — not the raw log. The prompt builder compresses it into a single sentence to minimise tokens.

```javascript
// src/shared/analytics/reportFormatter.js

export function buildAnalystPrompt(telemetry, game) {
  if (game === 'tictactoe') {
    const totalMoves = telemetry.moves.length;
    const avgMoveMs = totalMoves ? Math.round(
      telemetry.moves.reduce((a, m) => a + m.thinkTime, 0) / totalMoves
    ) : 0;
    const offensivePct = Math.round((telemetry.offensiveMoves / totalMoves) * 100);

    return `Tic-Tac-Toe game. ${totalMoves} moves. Avg think time: ${avgMoveMs}ms. Offensive moves: ${offensivePct}%. Result: ${telemetry.result}. Write a 2-sentence player persona analysis. Be witty and specific.`;
  }

  if (game === 'snake') {
    return `Snake game. Score: ${telemetry.snakeScore}. Death cause: ${telemetry.deathCause}. Shields used: ${telemetry.shieldsUsed}. Direction changes/sec: ${telemetry.agility}. Write a 2-sentence player persona analysis. Be witty and specific.`;
  }
}

// Example output from LLM:
// "You're a hyper-aggressive tactician — 78% of your XO moves went straight for the win,
//  leaving your flanks open like a rookie. In Snake, however, you played like a cautious
//  grandma, hugging walls and collecting shields you never needed."
```

**UI:** A modal slides up from the bottom with the report text (typewriter reveal), the game's final score, and two buttons: "Play Again" and "Try the Other Game."

---

## 8. Phase 4 — Polish, QA & Launch (Weeks 7–8)

### 8.1 Visual Polish

- Implement CRT scanline overlay effect (CSS `repeating-linear-gradient` on a fixed `::before` pseudo-element).
- Pixel font for score displays (`Press Start 2P` from Google Fonts).
- Smooth scene transitions between Dashboard and games (CSS View Transitions API).
- Sound effects (8-bit samples): move, eat, win, lose, AI message ping. All behind a mute toggle stored in `localStorage`.
- Responsive layout audit — test at 375px, 768px, 1280px, 1920px.

### 8.2 Performance Audit

- Lighthouse score targets: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 90.
- Canvas frame rate: lock to 60fps, profile with Chrome DevTools. Confirm no janks during A* computation.
- LLM response time: instrument all `callAI` calls with `performance.now()`. Log p50/p95 to console in dev mode. Target: p95 < 1800ms.
- Bundle size: run `vite-bundle-visualizer`. Target: < 200KB gzipped initial chunk. Games are lazy-loaded.

### 8.3 Testing Plan

| Test type | Scope | Tool |
|---|---|---|
| Unit | Minimax (all board states), A* (known grids), telemetry classifier | Vitest |
| Integration | XO game flow (move → AI response → chat bubble), Snake game loop | React Testing Library |
| E2E | Full play-through both games in both AI modes | Playwright |
| AI quality | 20 persona message samples — manual review for tone & appropriateness | Manual |
| Performance | LLM latency under simulated 4G throttle | Chrome DevTools |
| Accessibility | Keyboard-only navigation through both games | Manual + axe-core |

### 8.4 Launch Checklist

- [ ] `VITE_API_PROXY_URL` environment variable configured in deployment environment.
- [ ] Cloudflare Worker proxy deployed with rate limiting (max 60 req/min per IP).
- [ ] Error boundaries wrapping both game routes — graceful fallback if AI fails.
- [ ] `robots.txt` and `meta` tags configured.
- [ ] Console is clean in production build (no warnings, no API keys exposed).
- [ ] All AI features degrade silently when the LLM is unavailable.
- [ ] Cross-browser test: Chrome, Firefox, Safari, Edge.

---

## 9. AI Feature Specifications

| # | Feature | AI Type | LLM? | Max Tokens | Trigger | Fallback |
|---|---|---|---|---|---|---|
| 4.1 | Persona Opponent | Minimax + LLM | Yes | 40 | After each AI move, game end | Silent skip |
| 4.2 | Strategy Coach | Minimax + LLM | Yes | 80 | On user request (hint button) | Generic hint text |
| 4.3 | Dynamic Game Master | Rule-based + LLM notification | Yes | 30 | Score/death threshold crossed | Notification without LLM text |
| 4.4 | Rival Snake | A* pathfinding only | No | N/A | Mode selected, continuous | N/A |
| 4.5 | Performance Analyst | Telemetry + LLM | Yes | 150 | Game over | Generic "good game" message |

---

## 10. Data Models & State Design

### Tic-Tac-Toe Board

```typescript
type Board = (null | 'X' | 'O')[];   // Length 9, index 0-8 (row-major)
type GameMode = 'pvp' | 'persona' | 'coach';
type Persona = 'provoker' | 'cheerleader' | 'joker';

interface XOState {
  board: Board;
  currentPlayer: 'X' | 'O';
  winner: 'X' | 'O' | 'draw' | null;
  winLine: [number, number, number] | null;
  mode: GameMode;
  persona: Persona;
  chatMessages: { id: string; text: string; timestamp: number }[];
  hint: { index: number; explanation: string } | null;
  telemetry: XOTelemetry;
}
```

### Snake Engine State

```typescript
interface Vec2 { x: number; y: number; }
type FoodType = 'normal' | 'shield';

interface SnakeState {
  snake: Vec2[];           // Index 0 = head
  rival: Vec2[] | null;    // Null when mode is not 'rival'
  direction: Vec2;
  food: Vec2 & { type: FoodType };
  obstacles: Vec2[];
  score: number;
  rivalScore: number;
  speed: number;           // Milliseconds per tick
  isRunning: boolean;
  shieldActive: boolean;
  shieldExpiry: number;    // Timestamp
  mode: 'classic' | 'gamemaster' | 'rival';
  telemetry: SnakeTelemetry;
}
```

### Telemetry Objects

```typescript
interface XOTelemetry {
  moves: { player: 'X'|'O'; index: number; thinkTime: number; type: 'offensive'|'defensive'|'neutral' }[];
  offensiveMoves: number;
  defensiveMoves: number;
  result: 'win' | 'loss' | 'draw';
  gameDurationMs: number;
}

interface SnakeTelemetry {
  snakeScore: number;
  deathCause: 'wall' | 'self' | 'rival' | null;
  shieldsUsed: number;
  agility: number;          // Average direction changes per second
  survivalMs: number;
}
```

---

## 11. API & Prompt Engineering Strategy

### Token Budget by Feature

| Feature | System prompt tokens | User message tokens | Max response tokens | Total per call |
|---|---|---|---|---|
| Persona (mid-game) | ~35 | ~25 | 40 | ~100 |
| Persona (game end) | ~35 | ~15 | 40 | ~90 |
| Coach hint | ~20 | ~30 | 80 | ~130 |
| Game Master notify | ~15 | ~15 | 30 | ~60 |
| Analyst report | ~25 | ~40 | 150 | ~215 |

**Average tokens per complete game session (persona mode):** ~700 input + ~300 output = ~1,000 tokens total. At current Claude API pricing, this is negligible per session.

### Prompt Engineering Rules

1. **Board state as compact string** — `"X.O|..X|OX."` not a verbose description.
2. **Explicit length constraint** in every system prompt — "under 25 words," "1–2 sentences."
3. **No context window bloat** — chat history is never sent back to the LLM. Each call is stateless.
4. **Persona locked in system prompt** — never in the user message. System prompt tokens are cached server-side.
5. **Structured user messages** — use a consistent template so the LLM has no ambiguity about what to react to.
6. **Temperature 0.8 for personas, 0.3 for coach/analyst** — creative voice for personas, factual precision for advice.

---

## 12. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM API latency exceeds 2s | Medium | High | 2s `AbortController` timeout; all UI degrades gracefully |
| API key exposed in frontend bundle | High (if not mitigated) | Critical | Cloudflare Worker proxy — key never reaches the browser |
| A* rival snake causes game lag | Low | High | Run A* only once per tick; memoize grid graph; profile early |
| Minimax blocks main thread on slow devices | Very Low | Medium | Minimax is <1ms for 9-cell board; no async needed |
| Prompt injection via game state | Low | Medium | Board state is always serialized as a typed object, never raw user text |
| Canvas performance on low-end mobile | Medium | Medium | Cap `requestAnimationFrame` to 30fps on mobile via `performance.now()` delta check |
| LLM produces inappropriate persona messages | Low | High | System prompt includes hard guard: "Be playful, never offensive." Manual test 20 samples pre-launch |
| Scope creep into Phase 3 breaks Phase 2 games | Medium | High | Phase 2 ships as a standalone milestone, feature-flagged. AI hooks are additive only |

---

## 13. Acceptance Criteria Mapping

| PRD Acceptance Criterion | Implementation | Phase |
|---|---|---|
| Smooth navigation between games from dashboard | React Router lazy routes, animated transitions | 1 |
| Tic-Tac-Toe game logic flawless | Minimax engine + React DOM board, full unit test coverage | 2 |
| Snake game logic flawless | Canvas game loop, collision detection, food spawning, unit tests | 2 |
| AI Agent text responses synchronized with XO moves | `usePersonaAgent` debounced hook, `<ChatBubble>` with queue | 3 |
| Snake difficulty dynamically adjusts to skill level | `useGameMaster` threshold evaluator, speed + obstacle mutation | 3 |
| Performance Analyst report generated after game ends | `buildAnalystPrompt` + `callAI` triggered by `gameOver` event | 3 |
| AI response time < 2s | `AbortController` timeout in `callAI`, graceful fallback | 1, 3 |

---

## 14. Engineering Standards & Conventions

### Code Style

- **Functional components only** — no class components.
- **Custom hooks** for all stateful logic — components are purely presentational where possible.
- **No business logic in JSX** — all game logic lives in `engine/` or `hooks/`.
- **Named exports** for all components and utilities — no default exports except page-level components.

### Git Workflow

- Branch naming: `feature/xo-minimax`, `fix/snake-collision`, `chore/prompt-templates`.
- Every PR requires passing CI (lint + test) before merge.
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `perf:`.

### Error Handling

- All `callAI` calls are wrapped — never `throw`, always return `{ error }`.
- React Error Boundaries at the game-route level catch rendering crashes.
- `console.error` in development, silent in production (replaced by error monitoring in a production deployment).

### Accessibility

- All interactive elements have `aria-label` or visible text labels.
- Keyboard navigation: arrow keys for game controls, Tab for UI, Enter/Space for buttons.
- Colour contrast: all text meets WCAG AA (4.5:1 minimum ratio).
- `prefers-reduced-motion` respected — animations disabled for users who have set this preference.

---

*End of Engineering Build Plan — AI Retro Arcade Platform v1.0*
