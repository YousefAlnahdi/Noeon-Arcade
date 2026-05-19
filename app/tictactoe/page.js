'use client';

import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useTicTacToeStore, getBestMove } from '@/store/tictactoe';
import { useEffect, useState } from 'react';
import { askDeepSeek } from '@/lib/deepseek';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

const PERSONAS = [
    { id: 'provoker', label: 'The Provoker', emoji: '😈', color: 'text-error' },
    { id: 'cheerleader', label: 'The Cheerleader', emoji: '🎉', color: 'text-neon-green' },
    { id: 'joker', label: 'The Joker', emoji: '🃏', color: 'text-tertiary' },
];

export default function TicTacToePage() {
    const {
        board, mode, setMode, aiPersona, setPersona, makeMove, resetGame,
        isPlayerTurn, winner, winningLine, playerSymbol, aiSymbol,
        playerWins, aiWins
    } = useTicTacToeStore();

    const [aiChat, setAiChat] = useState("I'm watching your moves closely...");
    const [aiThinking, setAiThinking] = useState(false);

    // Coach states
    const [coachTip, setCoachTip] = useState("Analyze the board before placing your first mark.");
    const [coachGlow, setCoachGlow] = useState(false);
    const [coachHighlightIndex, setCoachHighlightIndex] = useState(null);

    const { user, playerProfile } = useAuth();
    const persona = PERSONAS.find((p) => p.id === aiPersona);
    // AI Trigger Hook
    useEffect(() => {
        if (mode === 'pvp') return;

        const turnTrigger = async () => {
            const asciiBoard = `
 ${board[0] || '0'} | ${board[1] || '1'} | ${board[2] || '2'}
---+---+---
 ${board[3] || '3'} | ${board[4] || '4'} | ${board[5] || '5'}
---+---+---
 ${board[6] || '6'} | ${board[7] || '7'} | ${board[8] || '8'}
`;

            const gameContext = {
                boardString: asciiBoard,
                winner,
                difficulty: 'insane'
            };

            // Give AI Persona text when Player makes a move
            if (mode === 'persona' && (!isPlayerTurn || winner)) {
                setAiThinking(true);
                const prompt = `You are playing ${persona.label}. Your personality is: ${persona.id === 'provoker' ? "Trash-talking, arrogant, mocking." :
                    persona.id === 'cheerleader' ? "Incredibly positive, encouraging, hype-woman." :
                        "Sarcastic, makes terrible jokes, chaos gremlin."
                    } Describe your thoughts on the board in 1-2 SHORT sentences. Note: you just made a move (or are about to).`;

                const reply = await askDeepSeek([], gameContext, prompt);
                setAiChat(reply);
                setAiThinking(false);
            }

            if (mode === 'coach' && isPlayerTurn && !winner) {
                setCoachGlow(true);
                const bestMoveIndex = getBestMove(board, playerSymbol);
                
                const positionNames = [
                    "top-left corner (index 0)", "top-center (index 1)", "top-right corner (index 2)",
                    "middle-left (index 3)", "center (index 4)", "middle-right (index 5)",
                    "bottom-left corner (index 6)", "bottom-center (index 7)", "bottom-right corner (index 8)"
                ];
                const bestMoveName = positionNames[bestMoveIndex];
                
                const prompt = `You are a Tic-Tac-Toe Strategy Coach.
The player plays as '${playerSymbol}' (X) and the AI opponent plays as '${aiSymbol}' (O).
The current board state is represented as:
${asciiBoard}

The mathematically perfect best move for the player ('${playerSymbol}') is index ${bestMoveIndex} which is the ${bestMoveName}.
Explain to the player in 1-2 short sentences why playing at ${bestMoveName} is the optimal move.
- If it blocks the AI from winning, explain that.
- If it sets up a win or double threat, explain that.
- If the game is in a state where a draw is the only outcome, explain that playing here is necessary to secure the draw.
- You MUST recommend only the position at index ${bestMoveIndex} (${bestMoveName}). Do NOT suggest any other index or name.
- Do NOT recommend any cell that is already occupied. X is at: ${board.reduce((acc, c, i) => c === 'X' ? [...acc, i] : acc, []).join(', ')}. O is at: ${board.reduce((acc, c, i) => c === 'O' ? [...acc, i] : acc, []).join(', ')}.
- Do NOT hallucinate who has played where.

Format your output EXACTLY like this:
RECOMMENDED_MOVE: ${bestMoveIndex} | <your explanation here>`;

                const reply = await askDeepSeek([], gameContext, prompt);
                const match = reply.match(/RECOMMENDED_MOVE:\s*(\d+)\s*\|\s*(.*)/i);
                if (match) {
                    const index = parseInt(match[1]);
                    setCoachHighlightIndex(index >= 0 ? index : null);
                    setCoachTip(match[2]);
                } else {
                    setCoachTip(reply);
                    setCoachHighlightIndex(bestMoveIndex);
                }
                setTimeout(() => setCoachGlow(false), 800);
            } else if (mode === 'coach' && (!isPlayerTurn || winner)) {
                setCoachHighlightIndex(null);
            }
        };

turnTrigger();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlayerTurn, winner, mode]); // run when turn changes or winner is set

    // Supabase Save Game Hook
    useEffect(() => {
        const saveScore = async () => {
            if (winner && user) {
                // Determine result
                let finalScore = 0;
                let outcome = 'draw';
                if (winner === 'X') {
                    finalScore = 150;
                    outcome = 'win';
                } else if (winner === 'O') {
                    outcome = 'loss';
                }

                await supabase.from('game_sessions').insert({
                    user_id: user.id,
                    game_type: 'tictactoe',
                    game_mode: mode,
                    result: outcome,
                    score: finalScore,
                    tokens_earned: outcome === 'win' ? 10 : outcome === 'draw' ? 2 : 0,
                    ai_persona: aiPersona,
                    telemetry: {
                        mode,
                        ai_persona: aiPersona
                    }
                });
            }
        };

        // Fire once when winner state changes
        if (winner) saveScore();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [winner]);

return (
    <>
        <Navbar />
        <div className="flex flex-1 pt-[88px] relative z-10">
            {/* Side Navigation */}
            <aside className="hidden lg:flex fixed left-0 top-[88px] h-[calc(100vh-88px)] w-64 flex-col bg-surface-container-low/60 backdrop-blur-lg border-r border-white/5 shadow-2xl shadow-black/50 z-40">
                <div className="p-6 border-b border-white/5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center border border-secondary text-2xl">
                        🤖
                    </div>
                    <div>
                        <h2 className="font-display text-lg font-semibold text-secondary neon-text-secondary">NEURAL BOT</h2>
                        <p className="font-body text-xs text-on-surface-variant">Strategic Analyst</p>
                    </div>
                </div>
                <nav className="flex-1 py-4 flex flex-col gap-1">
                    {[
                        { icon: '🏁', label: 'Base Game', active: mode === 'pvp', onClick: () => { setMode('pvp'); resetGame(); } },
                        { icon: '🧠', label: 'Persona AI', active: mode === 'persona', onClick: () => { setMode('persona'); resetGame(); } },
                        { icon: '💡', label: 'Strategy Coach', active: mode === 'coach', onClick: () => { setMode('coach'); resetGame(); } },
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
                                className={`p-4 flex items-center w-full text-left gap-3 font-label text-sm tracking-wider transition-all ${item.active
                                    ? 'bg-secondary-container/20 text-secondary border-r-4 border-secondary translate-x-1'
                                    : 'text-on-surface-variant hover:bg-white/5 hover:shadow-[0_0_15px_rgba(76,215,246,0.3)]'
                                    }`}
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

            {/* Main Game Area */}
            <main className="flex-1 lg:ml-64 flex flex-col min-h-[calc(100vh-88px)]">
                <div className="flex-1 p-6 max-w-[1440px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Center: Board */}
                    <div className="lg:col-span-8 flex flex-col items-center justify-center min-h-[600px]">
                        {/* Mode Selector */}
                        <div className="w-full max-w-md flex gap-2 mb-6">
                            {[
                                { id: 'pvp', label: 'PvP' },
                                { id: 'persona', label: 'Persona AI' },
                                { id: 'coach', label: 'Coach Mode' },
                            ].map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => { setMode(m.id); resetGame(); setCoachHighlightIndex(null); }}
                                    className={`flex-1 py-2 rounded-xl font-label text-xs tracking-wider uppercase transition-all ${mode === m.id
                                        ? 'bg-primary/20 text-primary border border-primary/50 neon-glow-primary'
                                        : 'bg-surface-container/50 text-on-surface-variant border border-white/5 hover:bg-white/5'
                                        }`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>

                        {/* Persona Selector (visible only in persona mode) */}
                        {mode === 'persona' && (
                            <div className="w-full max-w-md flex gap-2 mb-6">
                                {PERSONAS.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => { setPersona(p.id); resetGame(); }}
                                        className={`flex-1 py-2 rounded-xl font-label text-xs tracking-wider transition-all flex items-center justify-center gap-1 ${aiPersona === p.id
                                            ? 'bg-surface-container-high border border-primary/30 text-white'
                                            : 'bg-surface-container/30 border border-white/5 text-on-surface-variant hover:bg-white/5'
                                            }`}
                                    >
                                        <span>{p.emoji}</span> {p.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Score Header */}
                        <div className="w-full max-w-md flex justify-between items-center mb-8 glass-panel px-6 py-4 rounded-2xl">
                            <div className="text-center">
                                <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider mb-1">{playerProfile?.username || 'Player'} ({playerSymbol})</p>
                                <p className="font-display text-3xl font-bold text-primary neon-text-primary">{playerWins}</p>
                            </div>
                            <div className="flex flex-col items-center">
                                {winner ? (
                                    <span className={`px-3 py-1 font-label text-[10px] tracking-wider rounded-full border mb-2 uppercase ${winner === 'draw' ? 'bg-surface-variant text-on-surface border-white/30' : winner === playerSymbol ? 'bg-primary/20 text-primary border-primary/30' : 'bg-secondary/20 text-secondary border-secondary/30'}`}>
                                        {winner === 'draw' ? 'DRAW!' : `${winner} WINS!`}
                                    </span>
                                ) : (
                                    <span className={`px-3 py-1 font-label text-[10px] tracking-wider rounded-full border mb-2 uppercase ${isPlayerTurn ? 'bg-primary/20 text-primary border-primary/30' : mode === 'pvp' ? 'bg-secondary/20 text-secondary border-secondary/30' : 'bg-surface-variant text-on-surface-variant border-white/10'}`}>
                                        {isPlayerTurn ? 'Your Turn' : (mode === 'pvp' ? 'Player O Turn' : 'AI Thinking...')}
                                    </span>
                                )}
                                <p className="font-display text-lg font-semibold text-on-surface">VS</p>
                            </div>
                            <div className="text-center">
                                <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider mb-1">{mode === 'pvp' ? 'Player 2' : 'AI'} ({aiSymbol})</p>
                                <p className="font-display text-3xl font-bold text-secondary neon-text-secondary">{aiWins}</p>
                            </div>
                        </div>

                        {/* Game Board */}
                        <div className={`grid grid-cols-3 gap-3 p-6 glass-panel rounded-2xl relative ${winner ? 'opacity-80' : ''}`}>
                            {/* Decorative grid lines */}
                            <div className="absolute inset-0 pointer-events-none flex justify-evenly">
                                <div className="w-[2px] bg-white/5 h-full" />
                                <div className="w-[2px] bg-white/5 h-full" />
                            </div>
                            <div className="absolute inset-0 pointer-events-none flex flex-col justify-evenly">
                                <div className="h-[2px] bg-white/5 w-full" />
                                <div className="h-[2px] bg-white/5 w-full" />
                            </div>

                            {/* Cells */}
                            {board.map((cell, i) => {
                                const isWinningCell = winningLine.includes(i);
                                const isCoachHighlight = coachHighlightIndex === i;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => { makeMove(i); setCoachHighlightIndex(null); }}
                                        disabled={!!cell || !!winner || (!isPlayerTurn && mode !== 'pvp')}
                                        className={`w-24 h-24 sm:w-32 sm:h-32 rounded-xl flex items-center justify-center group relative z-10 transition-all duration-300 ${isWinningCell ? 'bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                                            : isCoachHighlight ? 'bg-primary/20 border-2 border-primary shadow-[0_0_25px_rgba(221,183,255,0.6)] animate-pulse'
                                                : cell ? 'bg-surface-container/50'
                                                    : 'bg-surface-container/50 hover:bg-surface-container cursor-pointer'
                                            }`}
                                    >
                                        {cell && (
                                            <span
                                                className={`font-display text-6xl font-extrabold transform transition-transform group-hover:scale-110 ${cell === 'X'
                                                    ? 'text-primary neon-text-primary'
                                                    : 'text-secondary neon-text-secondary'
                                                    }`}
                                            >
                                                {cell}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Reset/Actions */}
                        <div className="mt-8 flex gap-4">
                            <button
                                onClick={() => { resetGame(); setCoachHighlightIndex(null); }}
                                className="px-6 py-3 bg-surface-container border border-white/10 text-on-surface font-label text-xs tracking-wider uppercase rounded-xl hover:bg-surface-variant transition-colors"
                            >
                                Reset Game
                            </button>
                            <Link
                                href="/"
                                className="px-6 py-3 glass-panel text-on-surface-variant font-label text-xs tracking-wider uppercase rounded-xl hover:text-primary transition-colors lg:hidden"
                            >
                                ← Menu
                            </Link>
                        </div>
                    </div>

                    {/* Right Sidebar */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        {/* AI Persona Chat */}
                        {mode === 'persona' && (
                            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary to-primary" />
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center border border-secondary shrink-0 neon-glow-secondary text-lg">
                                        {persona?.emoji}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-label text-sm font-semibold text-on-surface tracking-wider">{persona?.label}</h3>
                                            {aiThinking ? (
                                                <span className="flex gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce" />
                                                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce delay-100" />
                                                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce delay-200" />
                                                </span>
                                            ) : (
                                                !winner && <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                                            )}
                                        </div>
                                        <div className="bg-surface-container p-3 rounded-xl rounded-tl-none border border-white/5 relative">
                                            <p className="font-body text-sm text-on-surface-variant">
                                                {aiChat}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Strategy Coach */}
                        <div className="glass-panel p-6 rounded-2xl flex-1 flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-display text-lg font-semibold text-on-surface flex items-center gap-2">
                                    <span>📊</span>
                                    Strategy Coach
                                </h3>
                                {/* Toggle */}
                                <button className="w-12 h-6 bg-primary/20 rounded-full relative p-1 border border-primary/50 transition-colors">
                                    <div className="w-4 h-4 bg-primary rounded-full absolute right-1 top-0.5 shadow-[0_0_10px_rgba(221,183,255,0.8)] transition-transform" />
                                </button>
                            </div>
                            <div className={`bg-surface-container-low p-4 rounded-xl border transition-all relative overflow-hidden group mb-4 ${coachGlow ? 'border-primary shadow-[0_0_15px_rgba(221,183,255,0.4)]' : 'border-primary/20'}`}>
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-primary text-lg">💡</span>
                                    <span className="font-label text-xs text-primary tracking-[0.2em] uppercase">AI Recommendation</span>
                                </div>
                                <p className="font-body text-sm text-on-surface">
                                    {mode === 'coach' ? coachTip : 'Enable Coach Mode to receive live strategic analysis from the DeepSeek neural network.'}
                                </p>
                            </div>
                            <div className="mt-auto pt-6 border-t border-white/10">
                                <h4 className="font-label text-xs text-on-surface-variant mb-3 uppercase tracking-[0.2em]">Win Probability</h4>
                                <div className="w-full bg-surface-container h-3 rounded-full overflow-hidden flex">
                                    <div className="h-full bg-primary rounded-l-full" style={{ width: '45%' }} />
                                    <div className="h-full bg-secondary rounded-r-full" style={{ width: '55%' }} />
                                </div>
                                <div className="flex justify-between mt-2 font-body text-xs">
                                    <span className="text-primary">Player: 45%</span>
                                    <span className="text-secondary">AI: 55%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <footer className="w-full py-4 px-6 flex justify-between items-center bg-surface-container-lowest border-t border-white/5 relative z-10">
                    <span className="font-display text-xs text-on-surface-variant opacity-80">© 2025 NEON ARCADE SYSTEMS</span>
                    <div className="flex gap-4">
                        <a href="#" className="font-label text-xs text-on-surface-variant hover:text-secondary opacity-80 hover:opacity-100 transition-colors tracking-wider">Privacy</a>
                        <a href="#" className="font-label text-xs text-on-surface-variant hover:text-secondary opacity-80 hover:opacity-100 transition-colors tracking-wider">Terms</a>
                    </div>
                </footer>
            </main>
        </div>
    </>
);
}
