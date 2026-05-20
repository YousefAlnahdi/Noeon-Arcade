'use client';

import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSnakeStore, GRID_SIZE, CANVAS_SIZE, COLS, ROWS } from '@/store/snake';
import { askDeepSeek } from '@/lib/deepseek';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

export default function SnakePage() {
    const canvasRef = useRef(null);

    const {
        mode, setMode, startGame, gameTick, snake, food, obstacles, score,
        gameState, activePowerups, changeDirection, speedState,
        rivalSnake, foodValue, spawnObstaclesAt, setSpeedState, setFoodPosition,
        clearObstacles, grantShield, difficulty, setDifficulty, direction
    } = useSnakeStore();

    const { user } = useAuth();

    // Game Master / Dungeon Master States
    const [gmMessage, setGmMessage] = useState("Ready to monitor performance.");
    const [gmThinking, setGmThinking] = useState(false);
    const [goldFruitTimer, setGoldFruitTimer] = useState(null);

    // AI Analysis States
    const [gameAnalysis, setGameAnalysis] = useState("");
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [generatingLevel, setGeneratingLevel] = useState(false);
    const [countdownVal, setCountdownVal] = useState(3);

    // ── Procedural Maze Generator (no AI needed for geometry) ──
    const generatePathfinderLevel = async () => {
        setGeneratingLevel(true);
        useSnakeStore.getState().clearObstacles();

        const COLS = 40, ROWS = 22;
        const snakeStart = [
            { x: 3, y: 11 },
            { x: 2, y: 11 },
            { x: 1, y: 11 }
        ];
        const portal = { x: 36, y: 11 };

        useSnakeStore.setState({
            snake: snakeStart,
            direction: { x: 0, y: 0 },
            food: portal,
            score: 0
        });

        // Helper: check if a cell is reserved (snake start or portal)
        const isReserved = (x, y) => {
            if (portal.x === x && portal.y === y) return true;
            if (snakeStart.some(s => s.x === x && s.y === y)) return true;
            // Also reserve a 1-cell buffer around start and portal
            if (x <= 4 && y === 11) return true;   // snake start zone
            if (x >= 35 && y === 11) return true;   // portal zone
            return false;
        };

        // ── STEP 1: Generate vertical wall pillars with alternating gaps ──
        const obstacles = new Set();
        const addObs = (x, y) => {
            if (x >= 0 && x < COLS && y >= 0 && y < ROWS && !isReserved(x, y)) {
                obstacles.add(`${x},${y}`);
            }
        };

        // Difficulty settings — balanced so every level is winnable
        const config = {
            easy:   { pillarCount: 3, gapSize: 7, extraScatter: 3,  wallThickness: 1, minSpacing: 8, maxSpacing: 11 },
            medium: { pillarCount: 4, gapSize: 5, extraScatter: 8,  wallThickness: 1, minSpacing: 6, maxSpacing: 9 },
            hard:   { pillarCount: 4, gapSize: 4, extraScatter: 10, wallThickness: 1, minSpacing: 6, maxSpacing: 8 },
        }[difficulty] || { pillarCount: 4, gapSize: 5, extraScatter: 8, wallThickness: 1, minSpacing: 6, maxSpacing: 9 };

        // Generate pillar x-positions with random spacing
        const pillarXPositions = [];
        let currentX = 6 + Math.floor(Math.random() * 3); // Start first pillar between col 6-8
        for (let i = 0; i < config.pillarCount; i++) {
            if (currentX >= 35) break; // Don't go past portal
            pillarXPositions.push(currentX);
            currentX += config.minSpacing + Math.floor(Math.random() * (config.maxSpacing - config.minSpacing + 1));
        }

        // Build each pillar as a vertical wall with a randomized gap (top, middle, or bottom)
        pillarXPositions.forEach((px) => {
            const gapOffset = Math.floor(Math.random() * 4); // 0-3 cells variance
            let gapStart, gapEnd;

            // Roll to decide gap location: top (33%), bottom (33%), or middle (34%)
            const gapTypeRoll = Math.random();

            if (gapTypeRoll < 0.33) {
                // Gap at the top
                gapStart = 1 + gapOffset;
                gapEnd = gapStart + config.gapSize;
                // Wall below the gap
                for (let y = gapEnd; y < ROWS; y++) {
                    for (let t = 0; t < config.wallThickness; t++) {
                        addObs(px + t, y);
                    }
                }
            } else if (gapTypeRoll < 0.66) {
                // Gap at the bottom
                gapStart = ROWS - config.gapSize - 1 - gapOffset;
                gapEnd = gapStart + config.gapSize;
                // Wall above the gap
                for (let y = 0; y < gapStart; y++) {
                    for (let t = 0; t < config.wallThickness; t++) {
                        addObs(px + t, y);
                    }
                }
            } else {
                // Gap in the middle
                const minMiddleCenter = 5 + Math.floor(config.gapSize / 2);
                const maxMiddleCenter = ROWS - 5 - Math.ceil(config.gapSize / 2);
                const gapCenter = minMiddleCenter + Math.floor(Math.random() * (maxMiddleCenter - minMiddleCenter + 1));
                
                gapStart = gapCenter - Math.floor(config.gapSize / 2);
                gapEnd = gapStart + config.gapSize;

                // Wall above the gap
                for (let y = 0; y < gapStart; y++) {
                    for (let t = 0; t < config.wallThickness; t++) {
                        addObs(px + t, y);
                    }
                }
                // Wall below the gap
                for (let y = gapEnd; y < ROWS; y++) {
                    for (let t = 0; t < config.wallThickness; t++) {
                        addObs(px + t, y);
                    }
                }
            }
        });

        // ── STEP 2: Add horizontal connector walls between pillars ──
        // Placing these at various heights to break up straight lines and force maneuvering
        for (let i = 0; i < pillarXPositions.length - 1; i++) {
            const x1 = pillarXPositions[i];
            const x2 = pillarXPositions[i + 1];
            const midX = Math.floor((x1 + x2) / 2);
            
            const wallRoll = Math.random();
            const wallLen = 2 + Math.floor(Math.random() * 3);

            if (wallRoll < 0.35) {
                // Horizontal barrier near the top
                const wallY = 2 + Math.floor(Math.random() * 2);
                for (let wx = midX - Math.floor(wallLen / 2); wx <= midX + Math.floor(wallLen / 2); wx++) {
                    addObs(wx, wallY);
                }
            } else if (wallRoll < 0.70) {
                // Horizontal barrier near the bottom
                const wallY = ROWS - 3 - Math.floor(Math.random() * 2);
                for (let wx = midX - Math.floor(wallLen / 2); wx <= midX + Math.floor(wallLen / 2); wx++) {
                    addObs(wx, wallY);
                }
            } else {
                // Floating horizontal block in the middle
                const wallY = Math.floor(ROWS / 2) - 1 + Math.floor(Math.random() * 3);
                for (let wx = midX - Math.floor(wallLen / 2); wx <= midX + Math.floor(wallLen / 2); wx++) {
                    addObs(wx, wallY);
                }
            }
        }

        // ── STEP 3: Add random scatter obstacles for extra challenge ──
        let scatterPlaced = 0;
        let attempts = 0;
        while (scatterPlaced < config.extraScatter && attempts < 500) {
            attempts++;
            const sx = 5 + Math.floor(Math.random() * 30);
            const sy = Math.floor(Math.random() * ROWS);
            const key = `${sx},${sy}`;
            if (!obstacles.has(key) && !isReserved(sx, sy)) {
                obstacles.add(key);
                scatterPlaced++;
            }
        }

        // ── STEP 4: For Hard mode, add small L-shaped blockers near corridors ──
        if (difficulty === 'hard') {
            for (let i = 0; i < 2; i++) {
                const bx = 8 + Math.floor(Math.random() * 24);
                const by = 3 + Math.floor(Math.random() * 16);
                const armLen = 2;
                const dir = Math.random() > 0.5 ? 1 : -1;
                for (let a = 0; a < armLen; a++) {
                    addObs(bx + a * dir, by);
                    addObs(bx, by + a * dir);
                }
            }
        }

        // Convert Set to array of {x, y} objects
        const obstacleArray = Array.from(obstacles).map(key => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
        });

        // Small artificial delay so the loader is visible
        await new Promise(resolve => setTimeout(resolve, 600));

        useSnakeStore.setState({ obstacles: obstacleArray, gameState: 'countdown' });
        setGeneratingLevel(false);
    };

    const handleStartGame = () => {
        setGameAnalysis("");
        setAnalysisLoading(false);
        setGoldFruitTimer(null);
        if (mode === 'pathfinder') {
            generatePathfinderLevel();
        } else {
            startGame();
        }
    };

    // AI Dungeon Master Hook
    useEffect(() => {
        if (mode !== 'gamemaster' || gameState !== 'playing') return;

        let isFetching = false;

        const executeDungeonMasterTurn = async () => {
            if (isFetching) return;
            isFetching = true;
            setGmThinking(true);

            // Capture current snapshots
            const currentSnake = useSnakeStore.getState().snake;
            const currentFood = useSnakeStore.getState().food;
            const currentObstacles = useSnakeStore.getState().obstacles;
            const currentScore = useSnakeStore.getState().score;
            const currentSpeed = useSnakeStore.getState().speedState;

            const gameContext = {
                snake_head: currentSnake[0],
                snake_length: currentSnake.length,
                food_location: currentFood,
                obstacles_count: currentObstacles.length,
                active_powerups: useSnakeStore.getState().activePowerups,
                score: currentScore,
                speed: currentSpeed,
                arena_dimensions: { cols: 40, rows: 22 }
            };

            const prompt = `You are the AI Dungeon Master of a Snake game. You are currently set to ${difficulty.toUpperCase()} difficulty.
${difficulty === 'hard' 
  ? `DIFFICULTY LEVEL: HARD (EXPERT / HIGH-SPEED MODE)
- Your goal is to defeat the player! Be extremely challenging and devious.
- The game is running at high speed. The snake moves very fast.
- You must analyze the snake's position: ${JSON.stringify(currentSnake)} and its direction of travel.
- Place a significant blocking wall or a cluster of obstacles (between 4 to 8 coordinates) directly in the snake's path.
- To give the player a fair 1.5-second reaction time to detour, place this wall/obstacles exactly 12 to 18 cells ahead of the snake's head in its direction of travel.
- Make sure to place MORE obstacles across the game board to build a challenging maze over time.
- Never place obstacles directly on the snake's head or body segments.`
  : difficulty === 'easy'
  ? `DIFFICULTY LEVEL: EASY (BENEVOLENT MODE)
- Be friendly, helpful, and kind.
- Prioritize giving the player rewards: spawn powerups (shields), clear obstacles, or spawn high-value golden fruits.
- Avoid placing obstacles. If you must spawn obstacles, place them very far away (6-8 cells) where they cannot hurt the player.
- Make the game easy and fun.`
  : `DIFFICULTY LEVEL: MEDIUM (STANDARD MODE)
- Be theatrical and fair.
- Obstacles must be placed 2-4 cells ahead of the head, giving enough reaction time.
- Spawn 1-3 obstacles maximum.
- Do not spawn obstacles if the snake is near a border (within 3 cells of the grid edge).`
}

You MUST reply ONLY with a raw JSON object with no wrapping, markdown, code blocks, or prefix text.

JSON Structure:
{
  "event_type": "spawn_obstacles" | "spawn_powerup" | "modify_speed" | "clear_obstacles" | "grant_shield" | "spawn_gold_fruit" | "no_event",
  "parameters": {
    "coordinates": [{"x": number, "y": number}], // For spawn_obstacles. Ensure coordinates are within grid cols: 40, rows: 22.
    "powerup_type": "shield", // For spawn_powerup
    "speed": "slow" | "normal" | "fast", // For modify_speed
    "gold_fruit": {"x": number, "y": number, "value": number, "duration": number} // For spawn_gold_fruit
  },
  "flavor_text": "One sentence only, under 15 words. Second-person present tense. Talk trash to the player!"
}`;

            try {
                const reply = await askDeepSeek([], gameContext, prompt, 300);
                
                let cleanReply = reply.trim();
                if (cleanReply.startsWith("```json")) {
                    cleanReply = cleanReply.substring(7);
                }
                if (cleanReply.endsWith("```")) {
                    cleanReply = cleanReply.substring(0, cleanReply.length - 3);
                }
                cleanReply = cleanReply.trim();

                const parsed = JSON.parse(cleanReply);

                if (parsed.flavor_text) {
                    setGmMessage(parsed.flavor_text);
                }

                switch (parsed.event_type) {
                    case 'spawn_obstacles':
                        if (parsed.parameters?.coordinates) {
                            spawnObstaclesAt(parsed.parameters.coordinates);
                        }
                        break;
                    case 'modify_speed':
                        if (parsed.parameters?.speed) {
                            setSpeedState(parsed.parameters.speed);
                        }
                        break;
                    case 'grant_shield':
                    case 'spawn_powerup':
                        grantShield();
                        break;
                    case 'clear_obstacles':
                        clearObstacles();
                        break;
                    case 'spawn_gold_fruit':
                        if (parsed.parameters?.gold_fruit) {
                            const gf = parsed.parameters.gold_fruit;
                            setFoodPosition(gf.x, gf.y, gf.value);
                            setGoldFruitTimer(gf.duration);
                        }
                        break;
                    case 'no_event':
                    default:
                        break;
                }
            } catch (err) {
                console.error("AI Dungeon Master parse error:", err);
            } finally {
                setGmThinking(false);
                isFetching = false;
            }
        };

        const interval = setInterval(executeDungeonMasterTurn, 6500);

        return () => {
            clearInterval(interval);
        };
    }, [mode, gameState, spawnObstaclesAt, setSpeedState, grantShield, clearObstacles, setFoodPosition, difficulty]);

    // Golden Fruit Timer Countdown Effect
    useEffect(() => {
        if (goldFruitTimer === null) return;
        if (goldFruitTimer <= 0) {
            const currentSnake = useSnakeStore.getState().snake;
            const currentObstacles = useSnakeStore.getState().obstacles;
            let newFood;
            while (true) {
                newFood = {
                    x: Math.floor(Math.random() * 40),
                    y: Math.floor(Math.random() * 22)
                };
                const isOnSnake = currentSnake.some(s => s.x === newFood.x && s.y === newFood.y);
                const isOnObstacle = currentObstacles.some(o => o.x === newFood.x && o.y === newFood.y);
                if (!isOnSnake && !isOnObstacle) break;
            }
            setFoodPosition(newFood.x, newFood.y, 10);
            setGoldFruitTimer(null);
            return;
        }

        const countdown = setTimeout(() => {
            setGoldFruitTimer(prev => prev - 1);
        }, 1000);

        return () => clearTimeout(countdown);
    }, [goldFruitTimer, setFoodPosition]);

    // Clear Golden Fruit timer if eaten
    useEffect(() => {
        if (foodValue === 10 && goldFruitTimer !== null) {
            setGoldFruitTimer(null);
        }
    }, [foodValue, goldFruitTimer]);

    // Supabase Save Game Hook
    useEffect(() => {
        const saveScore = async () => {
            if ((gameState === 'gameover' || gameState === 'won') && user) {
                setAnalysisLoading(true);
                setGameAnalysis(gameState === 'won' ? "Uploading victory logs..." : "Decompressing telemetry and compiling tactical review...");

                let critique = "Critique engine offline.";
                try {
                    const gameContext = {
                        score,
                        length: snake.length,
                        speed: speedState,
                        mode,
                        result: gameState === 'won' ? 'victory' : 'loss'
                    };

                    const prompt = gameState === 'won'
                        ? `You are the Neural Arcade AI Game Analyst. The player just WON the Pathfinder mode of Neural Snake on difficulty '${difficulty}'.
Final Steps/Telemetry: ${score}
Provide a 2-sentence congratulatory cyberpunk breakdown.`
                        : `You are the Neural Arcade AI Game Analyst. The player just finished a Neural Snake game in mode '${mode}'.
Final Score: ${score}
Snake Length: ${snake.length}
Final Speed: ${speedState}

Provide a 2-sentence performance breakdown/critique. Keep the tone technical, retro, and slightly arcade-cyberpunk.`;

                    critique = await askDeepSeek([], gameContext, prompt);
                    setGameAnalysis(critique);
                } catch (err) {
                    console.error("Critique error:", err);
                    setGameAnalysis("Critique generation failed.");
                } finally {
                    setAnalysisLoading(false);
                }

                let tokensEarned = Math.floor(score / 10);
                if (mode === 'pathfinder' && gameState === 'won') {
                    tokensEarned = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 40;
                }

                await supabase.from('game_sessions').insert({
                    user_id: user.id,
                    game_type: 'snake',
                    game_mode: mode,
                    result: gameState === 'won' ? 'win' : 'loss',
                    score: score,
                    tokens_earned: tokensEarned,
                    ai_analysis: critique,
                    telemetry: {
                        mode,
                        length: snake.length,
                        speed: speedState,
                        difficulty
                    }
                });
            }
        };

        if (gameState === 'gameover' || gameState === 'won') saveScore();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState]);

    // Handle Keyboard Input
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Prevent scrolling on arrow keys in game
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }

            if (e.key === ' ' && gameState !== 'playing' && gameState !== 'countdown') {
                handleStartGame();
                return;
            }

            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    changeDirection({ x: 0, y: -1 }); break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    changeDirection({ x: 0, y: 1 }); break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    changeDirection({ x: -1, y: 0 }); break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    changeDirection({ x: 1, y: 0 }); break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [changeDirection, handleStartGame, gameState]);

    // Countdown Timer Hook
    useEffect(() => {
        if (gameState !== 'countdown') return;

        let currentVal = 3;
        setCountdownVal(3);

        const timer = setInterval(() => {
            currentVal -= 1;
            if (currentVal <= 0) {
                clearInterval(timer);
                useSnakeStore.setState({ gameState: 'playing' });
            } else {
                setCountdownVal(currentVal);
            }
        }, 800);

        return () => clearInterval(timer);
    }, [gameState]);

    // Main Game Loop
    useEffect(() => {
        if (gameState !== 'playing') return;

        // Evaluate speed based on speedState and difficulty
        let baseMs = 100;
        if (speedState === 'slow') baseMs = 150;
        if (speedState === 'fast') baseMs = 60;

        let ms = baseMs;
        if (difficulty === 'easy') ms = Math.round(baseMs * 1.3);
        if (difficulty === 'medium') ms = Math.round(baseMs * 0.75); // 75ms ticks, fast!
        if (difficulty === 'hard') ms = Math.round(baseMs * 0.65);    // 65ms ticks, fast but winnable!

        const interval = setInterval(() => {
            gameTick();
        }, ms);

        return () => clearInterval(interval);
    }, [gameState, speedState, gameTick, difficulty]);

    // Canvas Drawing
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Clear board
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw grid lines for that retro feel (faint)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= canvas.width; x += GRID_SIZE) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y <= canvas.height; y += GRID_SIZE) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        // Draw Obstacles (Red walls)
        ctx.fillStyle = '#ffb4ab'; // error color
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(255, 180, 171, 0.5)';
        obstacles.forEach(obs => {
            ctx.fillRect(obs.x * GRID_SIZE, obs.y * GRID_SIZE, GRID_SIZE - 1, GRID_SIZE - 1);
        });

        // Draw Food or Portal
        if (food) {
            if (mode === 'pathfinder') {
                const time = Date.now() * 0.005;
                const radius = GRID_SIZE / 2;
                const cx = food.x * GRID_SIZE + radius;
                const cy = food.y * GRID_SIZE + radius;

                ctx.save();
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#a855f7';
                ctx.strokeStyle = '#c084fc';
                ctx.lineWidth = 3;

                // Outer portal ring (pulsating)
                ctx.beginPath();
                ctx.arc(cx, cy, radius * (0.85 + Math.sin(time) * 0.1), 0, Math.PI * 2);
                ctx.stroke();

                // Inner portal fill (swirling core)
                const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(0.3, '#c084fc');
                grad.addColorStop(1, '#a855f7');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
            } else {
                // Draw Food (Pink pulse, or Golden for Dungeon Master rewards)
                const isGolden = foodValue > 10;
                ctx.fillStyle = isGolden ? '#fbbf24' : '#ffb0cd'; // gold or tertiary pink
                ctx.shadowBlur = isGolden ? 25 : 15;
                ctx.shadowColor = isGolden ? 'rgba(251, 191, 36, 0.9)' : 'rgba(255, 176, 205, 0.8)';
                ctx.beginPath();
                ctx.arc(
                    food.x * GRID_SIZE + GRID_SIZE / 2,
                    food.y * GRID_SIZE + GRID_SIZE / 2,
                    isGolden ? GRID_SIZE / 2 : GRID_SIZE / 2 - 2, // slightly larger if golden
                    0, Math.PI * 2
                );
                ctx.fill();
            }
        }

        // Draw Snake
        ctx.fillStyle = activePowerups.shield ? '#ffffff' : '#4cd7f6'; // secondary or shield white
        ctx.shadowBlur = activePowerups.shield ? 20 : 10;
        ctx.shadowColor = activePowerups.shield ? 'rgba(255, 255, 255, 0.8)' : 'rgba(76, 215, 246, 0.6)';

        snake.forEach((segment, i) => {
            // Head is a bit brighter
            if (i === 0) {
                ctx.fillStyle = activePowerups.shield ? '#ffffff' : '#03b5d3';
            } else {
                // Fade tail out slightly
                const alpha = Math.max(0.3, 1 - (i / snake.length));
                ctx.fillStyle = activePowerups.shield
                    ? `rgba(255, 255, 255, ${alpha})`
                    : `rgba(76, 215, 246, ${alpha})`;
            }
            ctx.fillRect(segment.x * GRID_SIZE, segment.y * GRID_SIZE, GRID_SIZE - 1, GRID_SIZE - 1);
        });

        // Draw Rival Snake
        if (mode === 'rival' && rivalSnake.length > 0) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'rgba(255, 107, 107, 0.6)';

            rivalSnake.forEach((segment, i) => {
                if (i === 0) {
                    ctx.fillStyle = '#ff6b6b'; // Brighter red head
                } else {
                    const alpha = Math.max(0.3, 1 - (i / rivalSnake.length));
                    ctx.fillStyle = `rgba(255, 107, 107, ${alpha})`;
                }
                ctx.fillRect(segment.x * GRID_SIZE, segment.y * GRID_SIZE, GRID_SIZE - 1, GRID_SIZE - 1);
            });
        }

        // Reset shadow
        ctx.shadowBlur = 0;

    }, [snake, food, obstacles, activePowerups.shield, rivalSnake, mode]);

    return (
        <>
            <Navbar />
            <div className="flex flex-1 pt-[88px] relative z-10">
                {/* Side Navigation */}
                <aside className="hidden lg:flex fixed left-0 top-[88px] h-[calc(100vh-88px)] w-64 flex-col bg-surface-container-low/60 backdrop-blur-lg border-r border-white/5 shadow-2xl shadow-black/50 z-40">
                    <div className="p-6 border-b border-white/5">
                        <h2 className="font-display text-lg font-semibold text-secondary neon-text-secondary">NEURAL BOT</h2>
                        <p className="font-body text-xs text-on-surface-variant mt-1">Strategic Analyst</p>
                    </div>
                    <nav className="flex-1 py-4 flex flex-col gap-1">
                        {[
                            { icon: '🏁', label: 'Classic Rules', active: mode === 'classic', onClick: () => { if (gameState !== 'playing') setMode('classic'); } },
                            { icon: '🎮', label: 'Game Master', active: mode === 'gamemaster', onClick: () => { if (gameState !== 'playing') setMode('gamemaster'); } },
                            { icon: '🤖', label: 'Rival Snake', active: mode === 'rival', onClick: () => { if (gameState !== 'playing') setMode('rival'); } },
                            { icon: '📜', label: 'Stats History', active: false, href: '/stats' },
                        ].map((item) => (
                            item.href ? (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className={`p-4 flex items-center gap-3 font-label text-sm tracking-wider transition-all text-on-surface-variant hover:bg-white/5 hover:shadow-[0_0_15px_rgba(76,215,246,0.3)]`}
                                >
                                    <span className="text-lg">{item.icon}</span>
                                    {item.label}
                                </Link>
                            ) : (
                                <button
                                    key={item.label}
                                    onClick={item.onClick}
                                    disabled={gameState === 'playing'}
                                    className={`p-4 flex items-center w-full text-left gap-3 font-label text-sm tracking-wider transition-all ${item.active
                                        ? 'bg-secondary-container/20 text-secondary border-r-4 border-secondary translate-x-1'
                                        : 'text-on-surface-variant hover:bg-white/5 hover:shadow-[0_0_15px_rgba(76,215,246,0.3)]'
                                        } ${gameState === 'playing' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <span className="text-lg">{item.icon}</span>
                                    {item.label}
                                </button>
                            )
                        ))}
                    </nav>
                    <div className="p-6 border-t border-white/5">
                        <Link
                            href="/"
                            className="block w-full text-center py-3 bg-surface-container border border-white/10 text-on-surface-variant font-label text-xs tracking-wider uppercase rounded-xl hover:bg-surface-variant hover:text-primary transition-colors"
                        >
                            ← BACK TO ARCADE
                        </Link>
                    </div>
                </aside>

                {/* Canvas and HUD Area */}
                <main className="flex-1 lg:ml-64 flex flex-col items-center justify-center p-6 relative overflow-hidden min-h-[calc(100vh-88px)]">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(3,181,211,0.1)_0%,rgba(15,23,42,0)_70%)] pointer-events-none" />

                    {/* Mode Selector */}
                    <div className="w-full max-w-[800px] flex gap-2 mb-6 relative z-20">
                        {[
                            { id: 'classic', label: 'Classic' },
                            { id: 'gamemaster', label: 'Game Master' },
                            { id: 'rival', label: 'Rival Snake' },
                            { id: 'pathfinder', label: 'Pathfinder (Odyssey)' },
                        ].map((m) => (
                            <button
                                key={m.id}
                                onClick={() => { if (gameState !== 'playing' && !generatingLevel) setMode(m.id); }}
                                className={`flex-1 py-2 rounded-xl font-label text-xs tracking-wider uppercase transition-all ${mode === m.id
                                    ? 'bg-secondary/20 text-secondary border border-secondary/50 neon-glow-secondary'
                                    : 'bg-surface-container/50 text-on-surface-variant border border-white/5 hover:bg-white/5'
                                    } ${gameState === 'playing' || generatingLevel ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>

                    {/* Difficulty Selector */}
                    <div className="w-full max-w-[800px] flex flex-col gap-2 mb-6 relative z-20">
                        <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest text-center font-bold">Game Difficulty</p>
                        <div className="flex gap-2">
                            {[
                                { id: 'easy', label: 'Easy' },
                                { id: 'medium', label: 'Medium' },
                                { id: 'hard', label: 'Hard (Extreme)' }
                            ].map((diff) => (
                                <button
                                    key={diff.id}
                                    onClick={() => { if (gameState !== 'playing') setDifficulty(diff.id); }}
                                    className={`flex-1 py-1.5 rounded-lg font-label text-[10px] tracking-wider uppercase transition-all ${difficulty === diff.id
                                        ? diff.id === 'easy' ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-[0_0_8px_rgba(57,255,20,0.2)]'
                                          : diff.id === 'medium' ? 'bg-secondary/20 text-secondary border border-secondary/50 shadow-[0_0_8px_rgba(76,215,246,0.2)]'
                                          : 'bg-error/20 text-error border border-error/50 shadow-[0_0_8px_rgba(255,180,171,0.2)] animate-pulse'
                                        : 'bg-surface-container/50 border border-white/5 text-on-surface-variant hover:bg-white/5'
                                    } ${gameState === 'playing' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {diff.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* HUD */}
                    <div className="w-full max-w-[800px] flex justify-between items-end mb-4 relative z-20">
                        <div className="bg-surface/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-4">
                            <div>
                                <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider">Score</p>
                                <p className="font-display text-3xl font-bold text-primary neon-text-primary">{score}</p>
                            </div>
                            <div className="h-8 w-px bg-white/20" />
                            <div>
                                <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider">Speed</p>
                                <p className="font-display text-lg font-semibold text-secondary capitalize">
                                    {difficulty === 'easy' ? 'Standard' : difficulty === 'medium' ? 'Turbo' : 'Hyper'}
                                </p>
                            </div>
                        </div>

                        {goldFruitTimer !== null && (
                            <div className="bg-amber-500/20 border border-amber-500/50 px-4 py-2 rounded-2xl flex items-center gap-2 animate-pulse">
                                <span className="text-sm">🪙</span>
                                <span className="font-label text-xs text-amber-300 font-semibold uppercase tracking-wider">
                                    GOLD FRUIT: {goldFruitTimer}s
                                </span>
                            </div>
                        )}
                        <div className="bg-surface/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-3">
                            <span className="font-label text-xs text-on-surface-variant uppercase tracking-wider">Active:</span>
                            <div className="flex gap-2">
                                <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm transition-all ${activePowerups.shield
                                    ? 'bg-secondary/20 border-secondary shadow-[0_0_10px_rgba(76,215,246,0.5)] opacity-100'
                                    : 'bg-surface-variant border-white/10 opacity-30'
                                    }`}>
                                    🛡
                                </div>
                                <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm transition-all ${activePowerups.speed
                                    ? 'bg-neon-green/20 border-neon-green shadow-[0_0_10px_rgba(57,255,20,0.5)] opacity-100'
                                    : 'bg-surface-variant border-white/10 opacity-30'
                                    }`}>
                                    ⚡
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Game Canvas */}
                    <div className="relative w-full max-w-[800px] aspect-[800/450] bg-surface-container-lowest glow-border-secondary rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(3,181,211,0.2)] z-20">
                        <div className="absolute inset-0 scanline-overlay z-10" />

                        <canvas
                            ref={canvasRef}
                            width={CANVAS_SIZE.width}
                            height={CANVAS_SIZE.height}
                            className="absolute inset-0 w-full h-full object-contain"
                        />

                        {/* Countdown Overlay */}
                        {gameState === 'countdown' && (
                            <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[0.5px] flex items-center justify-center z-30 pointer-events-none">
                                <div className="text-center animate-pulse duration-500">
                                    <span className="font-display text-8xl font-black text-secondary neon-text-secondary drop-shadow-[0_0_20px_rgba(76,215,246,0.8)]">
                                        {countdownVal > 0 ? countdownVal : 'GO!'}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Start Instruction Overlay */}
                        {gameState === 'playing' && direction && direction.x === 0 && direction.y === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none bg-slate-950/10">
                                <div className="text-center animate-pulse duration-[1500ms]">
                                    <span className="font-display text-2xl font-extrabold text-secondary neon-text-secondary drop-shadow-[0_0_15px_rgba(76,215,246,0.6)] tracking-widest">
                                        PRESS ANY ARROW OR WASD KEY TO START
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Pathfinder Level Generation Loader */}
                        {generatingLevel && (
                            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(3,181,211,0.5)]" />
                                <p className="font-display text-lg text-primary font-bold animate-pulse">NEURAL CORE GENERATING ROAD...</p>
                                <p className="font-body text-xs text-on-surface-variant mt-1">AI is carving out a randomized obstacle track for {difficulty.toUpperCase()} difficulty</p>
                            </div>
                        )}

                        {/* Victory Overlay */}
                        {gameState === 'won' && (
                            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center z-30 p-4">
                                <div className="text-center p-8 rounded-3xl border border-neon-green/30 bg-surface-container-low/80 shadow-[0_0_40px_rgba(57,255,20,0.3)] max-w-sm w-full animate-scale-in">
                                    <span className="text-5xl mb-3 block animate-bounce">🔮</span>
                                    <h2 className="font-display text-2xl font-extrabold text-neon-green neon-text-green tracking-wider uppercase mb-1">
                                        PORTAL ESCAPE!
                                    </h2>
                                    <p className="font-body text-xs text-on-surface-variant mb-4">
                                        You completed the {difficulty.toUpperCase()} Pathfinder level!
                                    </p>
                                    
                                    <div className="bg-white/5 border border-white/5 py-3 px-4 rounded-xl mb-4">
                                        <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider">Loot Reward</p>
                                        <p className="font-display text-lg font-bold text-amber-400">+{difficulty === 'easy' ? '10' : difficulty === 'medium' ? '20' : '40'} Tokens</p>
                                    </div>

                                    {/* AI Critique Panel */}
                                    <div className="text-left bg-white/5 border border-white/10 p-3 rounded-lg mb-5 max-h-[100px] overflow-y-auto">
                                        <p className="font-label text-[9px] text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
                                            🤖 ANALYST DEBRIEF
                                        </p>
                                        <p className="font-body text-[11px] text-on-surface italic leading-relaxed">
                                            {gameAnalysis || "Compiling tactical escape summary..."}
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleStartGame}
                                        className="w-full py-3 bg-neon-green/20 hover:bg-neon-green/30 border border-neon-green text-neon-green font-label text-xs tracking-wider uppercase rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                                    >
                                        NEXT RANDOM ROAD (SPACE)
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Overlays */}
                        {gameState === 'idle' && (
                            <div className="absolute inset-0 flex items-center justify-center z-20 bg-surface/40 backdrop-blur-sm">
                                <div className="text-center">
                                    <p className="font-display text-4xl font-extrabold text-secondary neon-text-secondary mb-4">🐍 NEURAL SNAKE</p>
                                    <p className="font-body text-on-surface-variant mb-6">Press SPACE or tap to start</p>
                                    <button
                                        onClick={handleStartGame}
                                        className="bg-secondary text-on-secondary font-label text-sm tracking-wider uppercase px-8 py-3 rounded-xl neon-glow-secondary hover:brightness-110 hover:scale-[1.02] transition-all"
                                    >
                                        START GAME
                                    </button>
                                </div>
                            </div>
                        )}

                        {gameState === 'gameover' && (
                            <div className="absolute inset-0 flex items-center justify-center z-20 bg-error/10 backdrop-blur-sm">
                                <div className="text-center glass-panel p-8 rounded-2xl border-error/50 shadow-[0_0_30px_rgba(255,180,171,0.3)] max-w-md">
                                    <p className="font-display text-4xl font-extrabold text-error mb-2">SYSTEM FAILURE</p>
                                    <p className="font-body text-on-surface mb-4">Final Score: <span className="font-bold text-primary text-xl">{score}</span></p>
                                    
                                    {/* AI Critique block */}
                                    <div className="mb-6 p-3 bg-surface-container/60 border border-white/5 rounded-xl text-left max-w-sm mx-auto">
                                        <p className="font-label text-[10px] text-secondary tracking-widest uppercase mb-1">🤖 Analyst Critique:</p>
                                        <p className="font-body text-xs text-on-surface-variant italic leading-relaxed">
                                            {gameAnalysis}
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleStartGame}
                                        className="bg-surface-container-high text-white border border-white/20 font-label text-xs tracking-wider uppercase px-6 py-3 rounded-xl hover:bg-white/10 transition-all font-semibold"
                                    >
                                        REBOOT SEQUENCE (SPACE)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Game Director / Rival Panels */}
                    <div className="w-full max-w-[800px] mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 relative z-20">
                        <div className={`bg-surface/60 backdrop-blur-lg border rounded-2xl p-4 flex flex-col justify-center transition-colors ${mode === 'gamemaster' ? 'border-tertiary/50 shadow-[0_0_15px_rgba(255,176,205,0.2)]' : 'border-white/5'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-lg ${mode === 'gamemaster' ? 'text-tertiary' : 'text-on-surface-variant'}`}>🔮</span>
                                <h3 className={`font-label text-sm font-semibold tracking-wider ${mode === 'gamemaster' ? 'text-on-surface' : 'text-on-surface-variant'}`}>Neural Dungeon Master</h3>
                                {gmThinking && (
                                    <span className="flex gap-1 ml-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-bounce" />
                                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-bounce delay-100" />
                                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-bounce delay-200" />
                                    </span>
                                )}
                            </div>
                            <p className={`font-body text-sm mb-1 ${mode === 'gamemaster' ? 'text-tertiary font-bold' : 'text-on-surface-variant'}`}>
                                {mode === 'gamemaster' ? gameState === 'playing' ? 'Authoring Game State in Real-Time...' : 'Ready to Direct' : 'Mode inactive'}
                            </p>
                            <p className="font-body text-xs text-on-surface-variant border-t border-white/10 pt-2 italic leading-relaxed">
                                {mode === 'gamemaster'
                                    ? `"${gmMessage}"`
                                    : 'Enable Game Master mode to activate the real-time AI narrating director.'}
                            </p>
                        </div>

                        <div className={`bg-surface/60 backdrop-blur-lg border rounded-2xl p-4 flex items-center justify-between transition-colors ${mode === 'rival' ? 'border-error/50' : 'border-white/5'}`}>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-lg transition-colors ${mode === 'rival' ? 'text-error' : 'text-on-surface-variant'}`}>🤖</span>
                                    <h3 className={`font-label text-sm font-semibold tracking-wider transition-colors ${mode === 'rival' ? 'text-on-surface' : 'text-on-surface-variant'}`}>Rival AI Snake</h3>
                                </div>
                                <p className="font-body text-xs text-on-surface-variant">A* Pathfinding Competitor</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={mode === 'rival'}
                                    onChange={() => setMode(mode === 'rival' ? 'classic' : 'rival')}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-error shadow-[0_0_10px_rgba(221,183,255,0.2)] peer-checked:shadow-[0_0_15px_rgba(255,180,171,0.5)]" />
                            </label>
                        </div>
                    </div>

                    <div className="mt-6 lg:hidden relative z-20">
                        <Link href="/" className="px-6 py-3 glass-panel text-on-surface-variant font-label text-xs tracking-wider uppercase rounded-xl hover:text-secondary transition-colors">
                            ← Back to Arcade
                        </Link>
                    </div>
                </main>
            </div>
        </>
    );
}
