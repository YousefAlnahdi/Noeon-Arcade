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
        rivalSnake
    } = useSnakeStore();

    const { user } = useAuth();

    // Game Master States
    const [gmMessage, setGmMessage] = useState("Ready to monitor performance.");
    const [gmThinking, setGmThinking] = useState(false);

    // Game Master AI Hook
    useEffect(() => {
        if (mode !== 'gamemaster') return;

        const checkEventTrigger = async () => {
            // Trigger whenever score increases by 30 or game over
            const isMilestone = score > 0 && score % 30 === 0;
            const isGameOver = gameState === 'gameover';

            if (isMilestone || isGameOver) {
                setGmThinking(true);
                const gameContext = {
                    score,
                    snakeLength: snake.length,
                    status: gameState
                };

                const prompt = `You are a rogue Game Master AI monitoring a player in Neural Snake. In one SHORT sentence, taunt, praise, or comment on their current run. ${isGameOver ? 'The player just died. Mock them.' : 'The player reached a new score milestone.'}`;

                const reply = await askDeepSeek([], gameContext, prompt);
                setGmMessage(reply);
                setGmThinking(false);
            }
        };

        checkEventTrigger();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [score, gameState, mode]);

    // Supabase Save Game Hook
    useEffect(() => {
        const saveScore = async () => {
            if (gameState === 'gameover' && user) {
                await supabase.from('game_sessions').insert({
                    user_id: user.id,
                    game_type: 'snake',
                    game_mode: mode,
                    result: 'loss', // Snake is indefinite so you always eventually die
                    score: score,
                    tokens_earned: Math.floor(score / 10),
                    telemetry: {
                        mode,
                        length: snake.length,
                        speed: speedState
                    }
                });
            }
        };

        if (gameState === 'gameover') saveScore();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState]);

    // Handle Keyboard Input
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Prevent scrolling on arrow keys in game
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }

            if (e.key === ' ' && gameState !== 'playing') {
                startGame();
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
    }, [changeDirection, startGame, gameState]);

    // Main Game Loop
    useEffect(() => {
        if (gameState !== 'playing') return;

        // Evaluate speed
        let ms = 100;
        if (speedState === 'slow') ms = 150;
        if (speedState === 'fast') ms = 60;

        const interval = setInterval(() => {
            gameTick();
        }, ms);

        return () => clearInterval(interval);
    }, [gameState, speedState, gameTick]);

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

        // Draw Food (Pink pulse)
        ctx.fillStyle = '#ffb0cd'; // tertiary
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(255, 176, 205, 0.8)';
        ctx.beginPath();
        ctx.arc(
            food.x * GRID_SIZE + GRID_SIZE / 2,
            food.y * GRID_SIZE + GRID_SIZE / 2,
            GRID_SIZE / 2 - 2,
            0, Math.PI * 2
        );
        ctx.fill();

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
                        ].map((m) => (
                            <button
                                key={m.id}
                                onClick={() => { if (gameState !== 'playing') setMode(m.id); }}
                                className={`flex-1 py-2 rounded-xl font-label text-xs tracking-wider uppercase transition-all ${mode === m.id
                                    ? 'bg-secondary/20 text-secondary border border-secondary/50 neon-glow-secondary'
                                    : 'bg-surface-container/50 text-on-surface-variant border border-white/5 hover:bg-white/5'
                                    } ${gameState === 'playing' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {m.label}
                            </button>
                        ))}
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
                                <p className="font-display text-lg font-semibold text-secondary capitalize">{speedState}</p>
                            </div>
                        </div>
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

                        {/* Overlays */}
                        {gameState === 'idle' && (
                            <div className="absolute inset-0 flex items-center justify-center z-20 bg-surface/40 backdrop-blur-sm">
                                <div className="text-center">
                                    <p className="font-display text-4xl font-extrabold text-secondary neon-text-secondary mb-4">🐍 NEURAL SNAKE</p>
                                    <p className="font-body text-on-surface-variant mb-6">Press SPACE or tap to start</p>
                                    <button
                                        onClick={startGame}
                                        className="bg-secondary text-on-secondary font-label text-sm tracking-wider uppercase px-8 py-3 rounded-xl neon-glow-secondary hover:brightness-110 hover:scale-[1.02] transition-all"
                                    >
                                        START GAME
                                    </button>
                                </div>
                            </div>
                        )}

                        {gameState === 'gameover' && (
                            <div className="absolute inset-0 flex items-center justify-center z-20 bg-error/10 backdrop-blur-sm">
                                <div className="text-center glass-panel p-8 rounded-2xl border-error/50 shadow-[0_0_30px_rgba(255,180,171,0.3)]">
                                    <p className="font-display text-4xl font-extrabold text-error mb-2">SYSTEM FAILURE</p>
                                    <p className="font-body text-on-surface mb-6">Final Score: <span className="font-bold text-primary text-xl">{score}</span></p>
                                    <button
                                        onClick={startGame}
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
                                <span className={`text-lg ${mode === 'gamemaster' ? 'text-tertiary' : 'text-on-surface-variant'}`}>🎮</span>
                                <h3 className={`font-label text-sm font-semibold tracking-wider ${mode === 'gamemaster' ? 'text-on-surface' : 'text-on-surface-variant'}`}>Game Director Status</h3>
                                {gmThinking && (
                                    <span className="flex gap-1 ml-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-bounce" />
                                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-bounce delay-100" />
                                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-bounce delay-200" />
                                    </span>
                                )}
                            </div>
                            <p className={`font-body text-sm mb-1 ${mode === 'gamemaster' ? 'text-tertiary font-bold' : 'text-on-surface-variant'}`}>
                                {mode === 'gamemaster' ? gameState === 'playing' ? 'Difficulty: Escalating...' : 'Ready to Monitor' : 'Mode inactive'}
                            </p>
                            <p className="font-body text-xs text-on-surface-variant border-t border-white/10 pt-2 italic">
                                {mode === 'gamemaster'
                                    ? `"${gmMessage}"`
                                    : 'Enable Game Master mode to activate dynamic difficulty and live commentary.'}
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
                                    onChange={() => { if (gameState !== 'playing') setMode(mode === 'rival' ? 'classic' : 'rival') }}
                                    disabled={gameState === 'playing'}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-error shadow-[0_0_10px_rgba(221,183,255,0.2)] peer-checked:shadow-[0_0_15px_rgba(255,180,171,0.5)] peer-disabled:opacity-50" />
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
