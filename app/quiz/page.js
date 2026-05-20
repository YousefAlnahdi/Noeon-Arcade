'use client';

import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuizStore, CATEGORIES, DIFFICULTY_CONFIG, DIFFICULTY_ORDER } from '@/store/quiz';

export default function QuizPage() {
    const { user } = useAuth();
    const {
        category, difficulty, gameState, currentQuestion, selectedAnswer,
        isCorrect, score, round, maxRounds, streak, bestStreak,
        correctCount, wrongCount, timeLeft, aiExplanation, isLoading,
        isExplaining, questionHistory,
        setCategory, startGame, answerQuestion, nextQuestion, tick,
        saveSession, resetToMenu
    } = useQuizStore();

    const timerRef = useRef(null);
    const [savedSession, setSavedSession] = useState(false);
    const [matrixChars, setMatrixChars] = useState([]);

    // Generate matrix rain characters on mount
    useEffect(() => {
        const chars = [];
        for (let i = 0; i < 40; i++) {
            chars.push({
                char: String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)),
                left: Math.random() * 100,
                delay: Math.random() * 8,
                duration: 4 + Math.random() * 8,
                opacity: 0.03 + Math.random() * 0.08
            });
        }
        setMatrixChars(chars);
    }, []);

    // Timer logic
    useEffect(() => {
        if (gameState === 'question') {
            timerRef.current = setInterval(() => {
                tick();
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameState, tick]);

    // Save session on game over
    useEffect(() => {
        if (gameState === 'game-over' && !savedSession) {
            setSavedSession(true);
            if (user) {
                saveSession(user.id);
            }
        }
    }, [gameState, savedSession, user, saveSession]);

    // Reset saved flag when going back to menu
    useEffect(() => {
        if (gameState === 'menu') {
            setSavedSession(false);
        }
    }, [gameState]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKey = (e) => {
            if (gameState === 'question' && !isLoading) {
                const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
                if (keyMap[e.key] !== undefined) {
                    answerQuestion(keyMap[e.key]);
                }
            }
            if (gameState === 'answered' && e.code === 'Space') {
                e.preventDefault();
                nextQuestion();
            }
            if (gameState === 'game-over' && e.code === 'Space') {
                e.preventDefault();
                resetToMenu();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [gameState, isLoading, answerQuestion, nextQuestion, resetToMenu]);

    const accuracy = round > 0 ? Math.round((correctCount / round) * 100) : 0;
    const tokensEarned = Math.floor(score / 100);
    const timerPercent = currentQuestion
        ? (timeLeft / DIFFICULTY_CONFIG[difficulty].timeLimit) * 100
        : 100;

    return (
        <>
            <Navbar />
            <div className="pt-[88px] min-h-screen bg-surface relative overflow-hidden">
                <style>{`
                    @keyframes matrix-fall {
                        0% { transform: translateY(-100vh); }
                        100% { transform: translateY(100vh); }
                    }
                    @keyframes terminal-blink {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0; }
                    }
                    @keyframes scan-line {
                        0% { transform: translateY(-100%); }
                        100% { transform: translateY(100vh); }
                    }
                    @keyframes glitch-shift {
                        0%, 100% { transform: translate(0); }
                        20% { transform: translate(-2px, 1px); }
                        40% { transform: translate(2px, -1px); }
                        60% { transform: translate(-1px, 2px); }
                        80% { transform: translate(1px, -2px); }
                    }
                    @keyframes score-pop {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.3); }
                        100% { transform: scale(1); }
                    }
                    .matrix-char {
                        position: absolute;
                        font-family: monospace;
                        font-size: 14px;
                        color: #39ff14;
                        writing-mode: vertical-rl;
                        animation: matrix-fall linear infinite;
                        pointer-events: none;
                        user-select: none;
                    }
                    .terminal-cursor::after {
                        content: '█';
                        animation: terminal-blink 1s step-end infinite;
                        color: #39ff14;
                    }
                    .scan-beam {
                        position: absolute;
                        left: 0; right: 0;
                        height: 2px;
                        background: linear-gradient(90deg, transparent, rgba(57,255,20,0.4), transparent);
                        animation: scan-line 4s linear infinite;
                        pointer-events: none;
                    }
                    .answer-btn {
                        transition: all 0.15s ease;
                    }
                    .answer-btn:hover:not(:disabled) {
                        transform: translateX(6px);
                        border-color: rgba(57, 255, 20, 0.5);
                        box-shadow: 0 0 15px rgba(57, 255, 20, 0.15);
                    }
                    .score-pop { animation: score-pop 0.3s ease; }
                    .glitch-text { animation: glitch-shift 0.3s ease; }
                `}</style>

                {/* Matrix Rain Background */}
                {matrixChars.map((m, i) => (
                    <span
                        key={i}
                        className="matrix-char"
                        style={{
                            left: `${m.left}%`,
                            animationDelay: `${m.delay}s`,
                            animationDuration: `${m.duration}s`,
                            opacity: m.opacity
                        }}
                    >
                        {m.char}
                    </span>
                ))}

                {/* Scan Beam */}
                <div className="scan-beam z-10" />

                {/* ============ MENU STATE ============ */}
                {gameState === 'menu' && (
                    <div className="relative z-20 max-w-3xl mx-auto px-6 py-12 flex flex-col items-center">
                        {/* ASCII Title */}
                        <div className="mb-8 text-center">
                            <pre className="font-mono text-neon-green text-xs sm:text-sm leading-tight neon-text-green select-none whitespace-pre" style={{ textShadow: '0 0 20px rgba(57,255,20,0.6)' }}>
{`
 ███╗   ██╗███████╗██╗   ██╗██████╗  █████╗ ██╗     
 ████╗  ██║██╔════╝██║   ██║██╔══██╗██╔══██╗██║     
 ██╔██╗ ██║█████╗  ██║   ██║██████╔╝███████║██║     
 ██║╚██╗██║██╔══╝  ██║   ██║██╔══██╗██╔══██║██║     
 ██║ ╚████║███████╗╚██████╔╝██║  ██║██║  ██║███████╗
 ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝
      ░▒▓ Q U I Z . E X E ▓▒░`}
                            </pre>
                        </div>

                        {/* Terminal Frame */}
                        <div className="w-full border border-neon-green/30 rounded-xl bg-surface-container-lowest/90 backdrop-blur-xl overflow-hidden shadow-[0_0_40px_rgba(57,255,20,0.08)]">
                            {/* Terminal Header */}
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-high/50 border-b border-neon-green/20">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-error/60" />
                                    <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                                    <div className="w-3 h-3 rounded-full bg-neon-green/60" />
                                </div>
                                <span className="font-mono text-[10px] text-neon-green/60 ml-2 tracking-wider uppercase">neural_quiz.exe — select_category</span>
                            </div>

                            {/* Terminal Body */}
                            <div className="p-6">
                                <p className="font-mono text-xs text-neon-green/60 mb-1">root@arcade:~$ <span className="text-neon-green">./scan_categories</span></p>
                                <p className="font-mono text-xs text-neon-green/40 mb-6">Scanning knowledge databases... {Object.keys(CATEGORIES).length} sectors found.</p>

                                <div className="flex flex-col gap-2.5">
                                    {Object.entries(CATEGORIES).map(([key, cat]) => (
                                        <button
                                            key={key}
                                            onClick={() => setCategory(key)}
                                            className={`w-full text-left px-4 py-3 rounded-lg border font-mono text-sm transition-all ${
                                                category === key
                                                    ? 'border-neon-green/60 bg-neon-green/10 text-neon-green shadow-[0_0_12px_rgba(57,255,20,0.15)]'
                                                    : 'border-white/5 bg-surface-container/30 text-on-surface-variant hover:border-neon-green/20 hover:bg-neon-green/5 hover:text-neon-green/80'
                                            }`}
                                        >
                                            <span className="text-neon-green/40 mr-2">&gt;</span>
                                            {cat.label}
                                            <span className="text-[10px] text-on-surface-variant/50 ml-3 font-body">— {cat.desc}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-8 pt-4 border-t border-neon-green/10">
                                    <p className="font-mono text-[10px] text-neon-green/40 mb-3">
                                        root@arcade:~$ <span className="text-neon-green/60">config --rounds {maxRounds} --adaptive-difficulty ON</span>
                                    </p>
                                    <button
                                        onClick={startGame}
                                        className="w-full py-4 bg-neon-green/15 border-2 border-neon-green/50 text-neon-green font-mono text-sm uppercase tracking-[0.3em] rounded-xl hover:bg-neon-green/25 hover:shadow-[0_0_30px_rgba(57,255,20,0.2)] transition-all hover:scale-[1.01] active:scale-[0.99]"
                                        style={{ textShadow: '0 0 10px rgba(57,255,20,0.5)' }}
                                    >
                                        ▶ INITIALIZE QUIZ PROTOCOL
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Info Cards */}
                        <div className="grid grid-cols-3 gap-3 w-full mt-6">
                            <div className="border border-neon-green/10 bg-surface-container/30 rounded-lg p-3 text-center">
                                <p className="font-mono text-[9px] text-neon-green/40 uppercase tracking-widest">Rounds</p>
                                <p className="font-display text-lg font-bold text-neon-green">{maxRounds}</p>
                            </div>
                            <div className="border border-neon-green/10 bg-surface-container/30 rounded-lg p-3 text-center">
                                <p className="font-mono text-[9px] text-neon-green/40 uppercase tracking-widest">Difficulty</p>
                                <p className="font-display text-lg font-bold text-secondary">ADAPTIVE</p>
                            </div>
                            <div className="border border-neon-green/10 bg-surface-container/30 rounded-lg p-3 text-center">
                                <p className="font-mono text-[9px] text-neon-green/40 uppercase tracking-widest">AI Engine</p>
                                <p className="font-display text-lg font-bold text-primary">DeepSeek</p>
                            </div>
                        </div>

                        <div className="mt-6">
                            <Link href="/" className="font-mono text-xs text-on-surface-variant/40 hover:text-neon-green/60 transition-colors">
                                ← exit_to_arcade
                            </Link>
                        </div>
                    </div>
                )}

                {/* ============ LOADING STATE ============ */}
                {gameState === 'loading' && (
                    <div className="relative z-20 max-w-2xl mx-auto px-6 flex flex-col items-center justify-center min-h-[calc(100vh-88px)]">
                        <div className="border border-neon-green/30 rounded-xl bg-surface-container-lowest/90 p-10 w-full text-center backdrop-blur-xl">
                            <div className="w-12 h-12 border-2 border-dashed border-neon-green rounded-full animate-spin mx-auto mb-4" style={{ boxShadow: '0 0 15px rgba(57,255,20,0.3)' }} />
                            <p className="font-mono text-sm text-neon-green mb-2 terminal-cursor" style={{ textShadow: '0 0 10px rgba(57,255,20,0.5)' }}>
                                DECRYPTING QUESTION DATABASE
                            </p>
                            <p className="font-mono text-[10px] text-neon-green/30">
                                accessing neural_core/{category}/difficulty_{difficulty}...
                            </p>
                            <div className="mt-4 flex gap-1 justify-center">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="w-2 h-2 rounded-full bg-neon-green animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ============ QUESTION STATE ============ */}
                {(gameState === 'question' || gameState === 'answered') && currentQuestion && (
                    <div className="relative z-20 max-w-3xl mx-auto px-6 py-6">
                        {/* HUD Bar */}
                        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
                            <div className="flex items-center gap-4">
                                <div className="border border-neon-green/20 bg-surface-container/50 px-4 py-2 rounded-lg">
                                    <p className="font-mono text-[8px] text-neon-green/40 uppercase">Round</p>
                                    <p className="font-display text-lg font-bold text-neon-green">{round + (gameState === 'question' ? 1 : 0)}<span className="text-neon-green/30 text-xs">/{maxRounds}</span></p>
                                </div>
                                <div className="border border-neon-green/20 bg-surface-container/50 px-4 py-2 rounded-lg">
                                    <p className="font-mono text-[8px] text-neon-green/40 uppercase">Score</p>
                                    <p className={`font-display text-lg font-bold text-secondary ${gameState === 'answered' && isCorrect ? 'score-pop' : ''}`}>{score}</p>
                                </div>
                                <div className="border border-neon-green/20 bg-surface-container/50 px-4 py-2 rounded-lg">
                                    <p className="font-mono text-[8px] text-neon-green/40 uppercase">Streak</p>
                                    <p className="font-display text-lg font-bold text-amber-400">
                                        {streak > 0 ? `🔥${streak}` : '—'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className={`px-3 py-1.5 rounded-lg border font-mono text-[10px] uppercase tracking-wider font-bold ${
                                    difficulty === 'easy' ? 'border-neon-green/30 text-neon-green bg-neon-green/10' :
                                    difficulty === 'medium' ? 'border-secondary/30 text-secondary bg-secondary/10' :
                                    difficulty === 'hard' ? 'border-amber-400/30 text-amber-400 bg-amber-400/10' :
                                    'border-error/30 text-error bg-error/10 animate-pulse'
                                }`}>
                                    {DIFFICULTY_CONFIG[difficulty].label}
                                </div>
                            </div>
                        </div>

                        {/* Timer Bar */}
                        <div className="w-full h-1.5 bg-surface-container-high rounded-full mb-6 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                                    timerPercent > 50 ? 'bg-neon-green shadow-[0_0_8px_rgba(57,255,20,0.5)]' :
                                    timerPercent > 25 ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' :
                                    'bg-error shadow-[0_0_8px_rgba(255,49,49,0.5)] animate-pulse'
                                }`}
                                style={{ width: `${timerPercent}%` }}
                            />
                        </div>

                        {/* Question Panel */}
                        <div className="border border-neon-green/25 rounded-xl bg-surface-container-lowest/90 backdrop-blur-xl overflow-hidden shadow-[0_0_25px_rgba(57,255,20,0.05)] mb-6">
                            {/* Question Header */}
                            <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-high/50 border-b border-neon-green/15">
                                <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                                <span className="font-mono text-[10px] text-neon-green/50 tracking-wider uppercase">
                                    signal_intercepted — {CATEGORIES[category]?.label || 'Random'}
                                </span>
                                {gameState === 'question' && (
                                    <span className="ml-auto font-mono text-sm font-bold" style={{
                                        color: timerPercent > 50 ? '#39ff14' : timerPercent > 25 ? '#fbbf24' : '#ff3131',
                                        textShadow: `0 0 10px ${timerPercent > 50 ? 'rgba(57,255,20,0.5)' : timerPercent > 25 ? 'rgba(251,191,36,0.5)' : 'rgba(255,49,49,0.5)'}`
                                    }}>
                                        {timeLeft}s
                                    </span>
                                )}
                            </div>

                            {/* Question Body */}
                            <div className="p-6 md:p-8">
                                <p className="font-display text-lg md:text-xl font-bold text-white leading-relaxed" style={{ textShadow: '0 0 30px rgba(255,255,255,0.05)' }}>
                                    {currentQuestion.question}
                                </p>
                            </div>
                        </div>

                        {/* Answer Options */}
                        <div className="flex flex-col gap-3 mb-6">
                            {currentQuestion.options.map((option, idx) => {
                                const isSelected = selectedAnswer === idx;
                                const isCorrectOption = idx === currentQuestion.correct;
                                const isAnswered = gameState === 'answered';
                                const wasTimedOut = isAnswered && selectedAnswer === -1;

                                let btnStyle = 'border-white/10 bg-surface-container/40 text-on-surface hover:text-neon-green';
                                if (isAnswered) {
                                    if (isCorrectOption) {
                                        btnStyle = 'border-neon-green/60 bg-neon-green/15 text-neon-green shadow-[0_0_15px_rgba(57,255,20,0.15)]';
                                    } else if (isSelected && !isCorrectOption) {
                                        btnStyle = 'border-error/60 bg-error/15 text-error shadow-[0_0_15px_rgba(255,49,49,0.15)]';
                                    } else {
                                        btnStyle = 'border-white/5 bg-surface-container/20 text-on-surface-variant/40';
                                    }
                                }

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => !isAnswered && answerQuestion(idx)}
                                        disabled={isAnswered}
                                        className={`answer-btn w-full text-left px-5 py-4 rounded-xl border font-body text-sm md:text-base flex items-center gap-4 ${btnStyle} ${isAnswered ? 'cursor-default' : ''}`}
                                    >
                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 border ${
                                            isAnswered && isCorrectOption ? 'bg-neon-green/20 border-neon-green/40 text-neon-green' :
                                            isAnswered && isSelected && !isCorrectOption ? 'bg-error/20 border-error/40 text-error' :
                                            'bg-surface-container-high/60 border-white/10 text-on-surface-variant'
                                        }`}>
                                            {isAnswered && isCorrectOption ? '✓' : isAnswered && isSelected && !isCorrectOption ? '✗' : idx + 1}
                                        </span>
                                        <span>{option}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Answer Feedback Panel */}
                        {gameState === 'answered' && (
                            <div className="animate-fade-in">
                                <div className={`border rounded-xl p-5 mb-4 ${
                                    isCorrect
                                        ? 'border-neon-green/30 bg-neon-green/5'
                                        : 'border-error/30 bg-error/5'
                                }`}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="text-2xl">{isCorrect ? '⚡' : selectedAnswer === -1 ? '⏰' : '💀'}</span>
                                        <div>
                                            <p className={`font-display text-lg font-extrabold uppercase tracking-wider ${
                                                isCorrect ? 'text-neon-green' : 'text-error'
                                            }`} style={{ textShadow: isCorrect ? '0 0 10px rgba(57,255,20,0.5)' : '0 0 10px rgba(255,49,49,0.5)' }}>
                                                {isCorrect ? 'CORRECT!' : selectedAnswer === -1 ? 'TIME OUT!' : 'WRONG!'}
                                            </p>
                                            {isCorrect && (
                                                <p className="font-mono text-[10px] text-neon-green/50">
                                                    +{DIFFICULTY_CONFIG[difficulty].basePoints + timeLeft * 10 + Math.min(streak, 5) * 50} pts
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* AI Explanation */}
                                    <div className="border-t border-white/5 pt-3">
                                        <p className="font-mono text-[9px] text-neon-green/40 uppercase tracking-wider mb-1.5">
                                            🤖 NEURAL_QUIZ.exe says:
                                        </p>
                                        {isExplaining ? (
                                            <p className="font-body text-sm text-on-surface-variant italic terminal-cursor">Generating response</p>
                                        ) : (
                                            <p className="font-body text-sm text-on-surface-variant italic leading-relaxed">
                                                "{aiExplanation}"
                                            </p>
                                        )}
                                    </div>

                                    {currentQuestion.fun_fact && (
                                        <div className="mt-3 pt-3 border-t border-white/5">
                                            <p className="font-mono text-[9px] text-secondary/50 uppercase tracking-wider mb-1">📡 Fun Fact:</p>
                                            <p className="font-body text-xs text-on-surface-variant/70">{currentQuestion.fun_fact}</p>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={nextQuestion}
                                    className="w-full py-4 bg-neon-green/15 border-2 border-neon-green/40 text-neon-green font-mono text-sm uppercase tracking-[0.2em] rounded-xl hover:bg-neon-green/25 hover:shadow-[0_0_20px_rgba(57,255,20,0.15)] transition-all hover:scale-[1.01] active:scale-[0.99]"
                                    style={{ textShadow: '0 0 10px rgba(57,255,20,0.5)' }}
                                >
                                    {round >= maxRounds ? '▶ VIEW RESULTS' : '▶ NEXT SIGNAL (SPACE)'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ============ GAME OVER STATE ============ */}
                {gameState === 'game-over' && (
                    <div className="relative z-20 max-w-2xl mx-auto px-6 py-10 flex flex-col items-center">
                        <div className="w-full border border-neon-green/30 rounded-xl bg-surface-container-lowest/90 backdrop-blur-xl overflow-hidden shadow-[0_0_40px_rgba(57,255,20,0.08)]">
                            {/* Terminal Header */}
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-high/50 border-b border-neon-green/20">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-error/60" />
                                    <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                                    <div className="w-3 h-3 rounded-full bg-neon-green/60" />
                                </div>
                                <span className="font-mono text-[10px] text-neon-green/60 ml-2 tracking-wider uppercase">neural_quiz.exe — session_complete</span>
                            </div>

                            <div className="p-8 text-center">
                                <p className="font-mono text-xs text-neon-green/40 mb-2">root@arcade:~$ ./display_results</p>

                                <div className="mb-6">
                                    <p className="font-display text-5xl font-black text-neon-green mb-1" style={{ textShadow: '0 0 30px rgba(57,255,20,0.5)' }}>
                                        {score}
                                    </p>
                                    <p className="font-mono text-xs text-neon-green/40 uppercase tracking-widest">Total Score</p>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                    <div className="border border-neon-green/10 bg-surface-container/30 rounded-lg p-3">
                                        <p className="font-mono text-[8px] text-neon-green/40 uppercase">Correct</p>
                                        <p className="font-display text-xl font-bold text-neon-green">{correctCount}</p>
                                    </div>
                                    <div className="border border-error/10 bg-surface-container/30 rounded-lg p-3">
                                        <p className="font-mono text-[8px] text-error/40 uppercase">Wrong</p>
                                        <p className="font-display text-xl font-bold text-error">{wrongCount}</p>
                                    </div>
                                    <div className="border border-amber-400/10 bg-surface-container/30 rounded-lg p-3">
                                        <p className="font-mono text-[8px] text-amber-400/40 uppercase">Best Streak</p>
                                        <p className="font-display text-xl font-bold text-amber-400">🔥{bestStreak}</p>
                                    </div>
                                    <div className="border border-secondary/10 bg-surface-container/30 rounded-lg p-3">
                                        <p className="font-mono text-[8px] text-secondary/40 uppercase">Accuracy</p>
                                        <p className="font-display text-xl font-bold text-secondary">{accuracy}%</p>
                                    </div>
                                </div>

                                {/* Difficulty reached */}
                                <div className="flex items-center justify-center gap-2 mb-6">
                                    <span className="font-mono text-[10px] text-on-surface-variant/40">Peak Difficulty Reached:</span>
                                    <span className={`px-3 py-1 rounded-lg border font-mono text-xs font-bold uppercase ${
                                        difficulty === 'easy' ? 'border-neon-green/30 text-neon-green bg-neon-green/10' :
                                        difficulty === 'medium' ? 'border-secondary/30 text-secondary bg-secondary/10' :
                                        difficulty === 'hard' ? 'border-amber-400/30 text-amber-400 bg-amber-400/10' :
                                        'border-error/30 text-error bg-error/10'
                                    }`}>
                                        {DIFFICULTY_CONFIG[difficulty].label}
                                    </span>
                                </div>

                                {/* Tokens earned */}
                                <div className="bg-white/5 border border-white/5 py-3 px-4 rounded-xl mb-6 inline-flex items-center gap-3 mx-auto">
                                    <span className="text-2xl">⬡</span>
                                    <div className="text-left">
                                        <p className="font-mono text-[9px] text-on-surface-variant/50 uppercase tracking-wider">Tokens Earned</p>
                                        <p className="font-display text-lg font-bold text-amber-400">+{tokensEarned}</p>
                                    </div>
                                </div>

                                {/* Performance Rating */}
                                <div className="border border-neon-green/10 bg-neon-green/5 rounded-xl p-4 mb-6 text-left">
                                    <p className="font-mono text-[9px] text-neon-green/40 uppercase tracking-wider mb-2">🤖 NEURAL_QUIZ PERFORMANCE ANALYSIS:</p>
                                    <p className="font-mono text-sm text-neon-green/80 leading-relaxed">
                                        {accuracy >= 90 ? ">>> STATUS: ELITE. Your neural pathways are operating at peak capacity. Few meatbags achieve this clearance level. Consider yourself a Tier-1 operator." :
                                         accuracy >= 70 ? ">>> STATUS: COMPETENT. Solid performance across the board. Your knowledge banks are well-stocked, though some sectors could use a firmware update." :
                                         accuracy >= 50 ? ">>> STATUS: ACCEPTABLE. You survived the gauntlet, but barely. Consider running a full diagnostic on your memory sectors." :
                                         ">>> STATUS: CRITICAL. Your knowledge cache is severely fragmented. Recommend immediate re-education protocol before next attempt."}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={resetToMenu}
                                        className="w-full py-4 bg-neon-green/15 border-2 border-neon-green/40 text-neon-green font-mono text-sm uppercase tracking-[0.2em] rounded-xl hover:bg-neon-green/25 hover:shadow-[0_0_20px_rgba(57,255,20,0.15)] transition-all"
                                        style={{ textShadow: '0 0 10px rgba(57,255,20,0.5)' }}
                                    >
                                        ↺ REINITIALIZE (SPACE)
                                    </button>
                                    <Link
                                        href="/"
                                        className="w-full py-3 bg-surface-container/50 border border-white/10 text-on-surface-variant font-mono text-xs uppercase tracking-wider rounded-xl hover:text-neon-green hover:border-neon-green/20 transition-all text-center"
                                    >
                                        ← exit_to_arcade
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
