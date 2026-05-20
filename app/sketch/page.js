'use client';

import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useSketchStore, CATEGORIES } from '@/store/sketch';

function canvasToAscii(canvas, gridSize = 28) {
    const temp = document.createElement('canvas');
    temp.width = gridSize;
    temp.height = gridSize;
    const tCtx = temp.getContext('2d');
    tCtx.fillStyle = '#000';
    tCtx.fillRect(0, 0, gridSize, gridSize);
    tCtx.drawImage(canvas, 0, 0, gridSize, gridSize);
    const data = tCtx.getImageData(0, 0, gridSize, gridSize).data;

    let ascii = '';
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const i = (y * gridSize + x) * 4;
            const bright = (data[i] + data[i + 1] + data[i + 2]) / 3;
            ascii += bright > 35 ? '█' : '·';
        }
        ascii += '\n';
    }
    return ascii;
}

const NEON_COLORS = [
    { color: '#39ff14', label: 'Green' },
    { color: '#ff6ec7', label: 'Pink' },
    { color: '#4cd7f6', label: 'Blue' },
    { color: '#fff44f', label: 'Yellow' },
    { color: '#ff3131', label: 'Red' },
    { color: '#ffffff', label: 'White' },
];

const BRUSH_SIZES = [3, 6, 10, 16];

export default function SketchPage() {
    const { user } = useAuth();
    const {
        gameState, category, currentWord, round, maxRounds,
        score, totalScore, timeLeft, aiGuesses, aiGuessedCorrectly,
        guessTime, roundHistory, isGuessing,
        setCategory, startGame, tick, submitGuess, continueGame,
        saveSession, resetToMenu
    } = useSketchStore();

    const canvasRef = useRef(null);
    const [drawing, setDrawing] = useState(false);
    const [brushColor, setBrushColor] = useState('#39ff14');
    const [brushSize, setBrushSize] = useState(6);
    const [strokes, setStrokes] = useState([]);
    const [currentStroke, setCurrentStroke] = useState([]);
    const [saved, setSaved] = useState(false);
    const [countdown, setCountdown] = useState(3);
    const guessIntervalRef = useRef(null);

    // Canvas setup
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = 500;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, 500, 500);
    }, [gameState]);

    // Redraw all strokes
    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (const stroke of strokes) {
            if (stroke.points.length < 2) continue;
            ctx.beginPath();
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 12;
            ctx.shadowColor = stroke.color;
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }, [strokes]);

    useEffect(() => { redrawCanvas(); }, [redrawCanvas]);

    // Timer
    useEffect(() => {
        if (gameState !== 'playing') return;
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [gameState, tick]);

    // Countdown before round
    useEffect(() => {
        if (gameState === 'playing' && countdown > 0) {
            const t = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(t);
        }
    }, [gameState, countdown]);

    // Reset countdown & canvas for new rounds
    useEffect(() => {
        if (gameState === 'playing') {
            setCountdown(3);
            setStrokes([]);
            setCurrentStroke([]);
        }
    }, [round]);

    // Periodic AI guessing every 8 seconds
    useEffect(() => {
        if (gameState !== 'playing') {
            if (guessIntervalRef.current) clearInterval(guessIntervalRef.current);
            return;
        }

        guessIntervalRef.current = setInterval(() => {
            const canvas = canvasRef.current;
            const state = useSketchStore.getState();
            if (!canvas || state.aiGuessedCorrectly || state.isGuessing || state.timeLeft > 52) return;
            const ascii = canvasToAscii(canvas);
            submitGuess(ascii);
        }, 8000);

        return () => { if (guessIntervalRef.current) clearInterval(guessIntervalRef.current); };
    }, [gameState, submitGuess]);

    // Save session on game over
    useEffect(() => {
        if (gameState === 'game-over' && !saved) {
            setSaved(true);
            if (user) saveSession(user.id);
        }
    }, [gameState, saved, user, saveSession]);

    useEffect(() => {
        if (gameState === 'menu') setSaved(false);
    }, [gameState]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKey = (e) => {
            if (e.code === 'Space' && (gameState === 'round-result' || gameState === 'game-over')) {
                e.preventDefault();
                if (gameState === 'round-result') continueGame();
                else resetToMenu();
            }
            if (e.key === 'z' && e.ctrlKey && gameState === 'playing') {
                e.preventDefault();
                setStrokes(prev => prev.slice(0, -1));
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [gameState, continueGame, resetToMenu]);

    // Drawing handlers
    const getPos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startDraw = (e) => {
        if (countdown > 0) return;
        e.preventDefault();
        setDrawing(true);
        const pos = getPos(e);
        setCurrentStroke([pos]);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 12;
        ctx.shadowColor = brushColor;
        ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
        if (!drawing || countdown > 0) return;
        e.preventDefault();
        const pos = getPos(e);
        setCurrentStroke(prev => [...prev, pos]);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const endDraw = () => {
        if (!drawing) return;
        setDrawing(false);
        const ctx = canvasRef.current.getContext('2d');
        ctx.shadowBlur = 0;
        if (currentStroke.length > 0) {
            setStrokes(prev => [...prev, { points: currentStroke, color: brushColor, size: brushSize }]);
            setCurrentStroke([]);
        }
    };

    const clearCanvas = () => {
        setStrokes([]);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    };

    const undo = () => {
        setStrokes(prev => prev.slice(0, -1));
    };

    const timerPercent = (timeLeft / 60) * 100;
    const totalCorrect = roundHistory.filter(r => r.guessed).length;

    return (
        <>
            <Navbar />
            <div className="pt-[88px] min-h-screen bg-surface grid-bg">
                <style>{`
                    @keyframes neon-pulse {
                        0%, 100% { filter: drop-shadow(0 0 6px var(--glow)); }
                        50% { filter: drop-shadow(0 0 14px var(--glow)); }
                    }
                    @keyframes pop-in {
                        0% { transform: scale(0.5) translateY(10px); opacity: 0; }
                        100% { transform: scale(1) translateY(0); opacity: 1; }
                    }
                    .guess-pop { animation: pop-in 0.3s ease-out both; }
                    .canvas-container {
                        box-shadow: 0 0 30px rgba(57,255,20,0.06), inset 0 0 30px rgba(0,0,0,0.5);
                    }
                `}</style>

                {/* ============ MENU ============ */}
                {gameState === 'menu' && (
                    <div className="max-w-2xl mx-auto px-6 py-12">
                        <div className="text-center mb-8">
                            <span className="text-6xl mb-4 block">🎨</span>
                            <h1 className="font-display text-4xl font-black text-white neon-text-primary mb-2">
                                AI SKETCH DUEL
                            </h1>
                            <p className="font-body text-sm text-on-surface-variant">
                                Draw it. Let the AI guess it. The faster it guesses, the higher your score.
                            </p>
                        </div>

                        <div className="glass-panel rounded-2xl p-6 mb-6">
                            <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider mb-4">Select Category</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {Object.entries(CATEGORIES).map(([key, cat]) => (
                                    <button
                                        key={key}
                                        onClick={() => setCategory(key)}
                                        className={`px-4 py-3 rounded-xl border font-label text-sm transition-all ${
                                            category === key
                                                ? 'border-primary/50 bg-primary/15 text-primary shadow-[0_0_12px_rgba(221,183,255,0.15)]'
                                                : 'border-white/5 bg-surface-container/30 text-on-surface-variant hover:border-white/15 hover:bg-white/5'
                                        }`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-6">
                            <div className="glass-panel rounded-xl p-4 text-center">
                                <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">Rounds</p>
                                <p className="font-display text-2xl font-bold text-secondary">5</p>
                            </div>
                            <div className="glass-panel rounded-xl p-4 text-center">
                                <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">Time/Round</p>
                                <p className="font-display text-2xl font-bold text-amber-400">60s</p>
                            </div>
                            <div className="glass-panel rounded-xl p-4 text-center">
                                <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">AI Engine</p>
                                <p className="font-display text-2xl font-bold text-primary">DeepSeek</p>
                            </div>
                        </div>

                        <button
                            onClick={startGame}
                            className="w-full py-4 bg-primary text-on-primary font-label text-sm tracking-[0.2em] uppercase font-bold rounded-2xl hover:brightness-110 neon-glow-primary transition-all hover:scale-[1.01] active:scale-[0.99]"
                        >
                            🎨 START DRAWING
                        </button>
                        <Link href="/" className="block text-center mt-4 font-body text-xs text-on-surface-variant hover:text-primary transition-colors">
                            ← Back to Arcade
                        </Link>
                    </div>
                )}

                {/* ============ PLAYING ============ */}
                {gameState === 'playing' && (
                    <div className="max-w-6xl mx-auto px-4 py-4">
                        {/* HUD Bar */}
                        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                            <div className="flex items-center gap-4">
                                <div className="bg-surface-container/60 border border-white/5 px-4 py-2 rounded-xl">
                                    <p className="font-label text-[8px] text-on-surface-variant uppercase">Round</p>
                                    <p className="font-display text-lg font-bold text-white">{round}<span className="text-on-surface-variant/40 text-xs">/{maxRounds}</span></p>
                                </div>
                                <div className="bg-surface-container/60 border border-white/5 px-4 py-2 rounded-xl">
                                    <p className="font-label text-[8px] text-on-surface-variant uppercase">Score</p>
                                    <p className="font-display text-lg font-bold text-secondary">{totalScore}</p>
                                </div>
                            </div>

                            {/* Word to draw */}
                            <div className="bg-primary/15 border-2 border-primary/40 px-6 py-2 rounded-xl text-center">
                                <p className="font-label text-[8px] text-primary/60 uppercase tracking-wider">Draw This</p>
                                <p className="font-display text-xl font-black text-primary uppercase tracking-wider" style={{ textShadow: '0 0 15px rgba(221,183,255,0.5)' }}>
                                    {currentWord}
                                </p>
                            </div>

                            {/* Timer */}
                            <div className="flex items-center gap-3">
                                <div className="w-24 h-2 bg-surface-container-high rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${
                                            timerPercent > 50 ? 'bg-neon-green' : timerPercent > 25 ? 'bg-amber-400' : 'bg-error animate-pulse'
                                        }`}
                                        style={{ width: `${timerPercent}%` }}
                                    />
                                </div>
                                <span className={`font-display text-lg font-bold ${
                                    timerPercent > 50 ? 'text-neon-green' : timerPercent > 25 ? 'text-amber-400' : 'text-error'
                                }`}>
                                    {timeLeft}s
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            {/* Canvas Area */}
                            <div className="lg:col-span-8">
                                <div className="canvas-container rounded-2xl border-2 border-white/10 overflow-hidden relative bg-[#0a0a0a]">
                                    {/* Countdown Overlay */}
                                    {countdown > 0 && (
                                        <div className="absolute inset-0 bg-surface/90 backdrop-blur-sm flex items-center justify-center z-30">
                                            <div className="text-center">
                                                <p className="font-display text-7xl font-black text-primary animate-bounce" style={{ textShadow: '0 0 30px rgba(221,183,255,0.5)' }}>
                                                    {countdown}
                                                </p>
                                                <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest mt-2">Get ready to draw...</p>
                                            </div>
                                        </div>
                                    )}

                                    <canvas
                                        ref={canvasRef}
                                        className="w-full aspect-square cursor-crosshair touch-none"
                                        onMouseDown={startDraw}
                                        onMouseMove={draw}
                                        onMouseUp={endDraw}
                                        onMouseLeave={endDraw}
                                        onTouchStart={startDraw}
                                        onTouchMove={draw}
                                        onTouchEnd={endDraw}
                                    />
                                </div>

                                {/* Drawing Tools */}
                                <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
                                    {/* Colors */}
                                    <div className="flex gap-1.5">
                                        {NEON_COLORS.map(c => (
                                            <button
                                                key={c.color}
                                                onClick={() => setBrushColor(c.color)}
                                                className={`w-8 h-8 rounded-full border-2 transition-transform ${
                                                    brushColor === c.color ? 'scale-110 border-white' : 'border-white/20 hover:scale-105'
                                                }`}
                                                style={{ backgroundColor: c.color, boxShadow: brushColor === c.color ? `0 0 12px ${c.color}` : 'none' }}
                                            />
                                        ))}
                                    </div>

                                    {/* Brush Sizes */}
                                    <div className="flex gap-1.5 items-center">
                                        {BRUSH_SIZES.map(s => (
                                            <button
                                                key={s}
                                                onClick={() => setBrushSize(s)}
                                                className={`rounded-full border transition-all flex items-center justify-center ${
                                                    brushSize === s
                                                        ? 'border-primary bg-primary/20'
                                                        : 'border-white/10 bg-surface-container/40 hover:border-white/20'
                                                }`}
                                                style={{ width: Math.max(28, s + 18), height: Math.max(28, s + 18) }}
                                            >
                                                <div className="rounded-full bg-white" style={{ width: s, height: s }} />
                                            </button>
                                        ))}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button onClick={undo} className="px-3 py-2 bg-surface-container/60 border border-white/10 rounded-lg font-label text-[10px] text-on-surface-variant uppercase hover:bg-white/10 transition-colors">
                                            ↩ Undo
                                        </button>
                                        <button onClick={clearCanvas} className="px-3 py-2 bg-error/10 border border-error/20 rounded-lg font-label text-[10px] text-error uppercase hover:bg-error/20 transition-colors">
                                            ✕ Clear
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* AI Guesses Panel */}
                            <div className="lg:col-span-4">
                                <div className="glass-panel rounded-2xl p-5 h-full flex flex-col">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className={`w-2 h-2 rounded-full ${isGuessing ? 'bg-amber-400 animate-pulse' : 'bg-neon-green'}`} />
                                        <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">
                                            {isGuessing ? 'AI Analyzing...' : 'AI Observer'}
                                        </span>
                                    </div>

                                    <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[400px]">
                                        {aiGuesses.length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 opacity-50">
                                                <span className="text-3xl mb-2">🤖</span>
                                                <p className="font-body text-xs text-on-surface-variant">
                                                    AI is watching you draw...<br />First guess in ~8 seconds
                                                </p>
                                            </div>
                                        ) : (
                                            aiGuesses.map((guess, i) => (
                                                <div
                                                    key={i}
                                                    className={`guess-pop px-3 py-2 rounded-lg border text-sm font-body ${
                                                        guess.isCorrect
                                                            ? 'border-neon-green/50 bg-neon-green/15 text-neon-green'
                                                            : 'border-white/5 bg-surface-container/40 text-on-surface-variant'
                                                    }`}
                                                    style={{ animationDelay: `${(i % 3) * 0.1}s` }}
                                                >
                                                    {guess.isCorrect ? '✅ ' : '❌ '}
                                                    {guess.text}
                                                    <span className="text-[10px] opacity-40 ml-2">{guess.time}s</span>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {isGuessing && (
                                        <div className="mt-3 flex items-center gap-2 text-amber-400">
                                            <div className="w-4 h-4 border-2 border-dashed border-amber-400 rounded-full animate-spin" />
                                            <span className="font-label text-[10px] uppercase tracking-wider">Processing sketch...</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============ ROUND RESULT ============ */}
                {gameState === 'round-result' && (
                    <div className="max-w-lg mx-auto px-6 py-12 text-center">
                        <div className="glass-panel rounded-2xl p-8">
                            <span className="text-5xl block mb-4">{aiGuessedCorrectly ? '🎉' : '🤔'}</span>
                            <h2 className={`font-display text-3xl font-extrabold uppercase tracking-wider mb-2 ${
                                aiGuessedCorrectly ? 'text-neon-green neon-text-green' : 'text-amber-400'
                            }`}>
                                {aiGuessedCorrectly ? 'AI GOT IT!' : 'AI FAILED!'}
                            </h2>
                            <p className="font-body text-sm text-on-surface-variant mb-6">
                                {aiGuessedCorrectly
                                    ? `The AI guessed "${currentWord}" in ${guessTime} seconds!`
                                    : `The AI couldn't figure out "${currentWord}". Better luck next time!`
                                }
                            </p>

                            <div className="flex justify-center gap-6 mb-6">
                                <div className="text-center">
                                    <p className="font-label text-[9px] text-on-surface-variant uppercase">Round Score</p>
                                    <p className="font-display text-3xl font-bold text-secondary">{score}</p>
                                </div>
                                <div className="text-center">
                                    <p className="font-label text-[9px] text-on-surface-variant uppercase">Total</p>
                                    <p className="font-display text-3xl font-bold text-primary">{totalScore}</p>
                                </div>
                            </div>

                            <button
                                onClick={continueGame}
                                className="w-full py-4 bg-primary text-on-primary font-label text-xs tracking-widest uppercase font-bold rounded-2xl hover:brightness-110 neon-glow-primary transition-all"
                            >
                                {round >= maxRounds ? '▶ VIEW RESULTS' : '▶ NEXT ROUND (SPACE)'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ============ GAME OVER ============ */}
                {gameState === 'game-over' && (
                    <div className="max-w-lg mx-auto px-6 py-12 text-center">
                        <div className="glass-panel rounded-2xl p-8">
                            <span className="text-5xl block mb-4">🏆</span>
                            <h2 className="font-display text-3xl font-extrabold text-primary uppercase tracking-wider mb-2 neon-text-primary">
                                SESSION COMPLETE
                            </h2>

                            <p className="font-display text-5xl font-black text-secondary mb-1">{totalScore}</p>
                            <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest mb-6">Total Score</p>

                            <div className="grid grid-cols-3 gap-3 mb-6">
                                <div className="bg-surface-container/40 border border-white/5 rounded-xl p-3">
                                    <p className="font-label text-[9px] text-on-surface-variant uppercase">AI Guessed</p>
                                    <p className="font-display text-xl font-bold text-neon-green">{totalCorrect}/{maxRounds}</p>
                                </div>
                                <div className="bg-surface-container/40 border border-white/5 rounded-xl p-3">
                                    <p className="font-label text-[9px] text-on-surface-variant uppercase">Accuracy</p>
                                    <p className="font-display text-xl font-bold text-secondary">{Math.round((totalCorrect / maxRounds) * 100)}%</p>
                                </div>
                                <div className="bg-surface-container/40 border border-white/5 rounded-xl p-3">
                                    <p className="font-label text-[9px] text-on-surface-variant uppercase">Tokens</p>
                                    <p className="font-display text-xl font-bold text-amber-400">+{Math.floor(totalScore / 50)}</p>
                                </div>
                            </div>

                            {/* Round History */}
                            <div className="text-left mb-6">
                                <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider mb-2">Round Breakdown</p>
                                <div className="flex flex-col gap-1.5">
                                    {roundHistory.map((r, i) => (
                                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-surface-container/30 rounded-lg text-xs border border-white/5">
                                            <div className="flex items-center gap-2">
                                                <span>{r.guessed ? '✅' : '❌'}</span>
                                                <span className="font-body text-on-surface capitalize">{r.word}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-on-surface-variant">
                                                <span>{r.time}s</span>
                                                <span className={`font-bold ${r.score > 0 ? 'text-neon-green' : 'text-error'}`}>+{r.score}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={resetToMenu}
                                    className="w-full py-4 bg-primary text-on-primary font-label text-xs tracking-widest uppercase font-bold rounded-2xl hover:brightness-110 neon-glow-primary transition-all"
                                >
                                    ↺ PLAY AGAIN (SPACE)
                                </button>
                                <Link href="/" className="w-full py-3 bg-surface-container/50 border border-white/10 text-on-surface-variant font-label text-xs uppercase tracking-wider rounded-xl hover:text-primary hover:border-primary/20 transition-all text-center block">
                                    ← Back to Arcade
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
