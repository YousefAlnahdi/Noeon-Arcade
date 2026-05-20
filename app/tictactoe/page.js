'use client';

import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useTicTacToeStore, getBestMove } from '@/store/tictactoe';
import { useEffect, useState } from 'react';
import { askDeepSeek } from '@/lib/deepseek';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

const BASE_PERSONAS = [
    { id: 'provoker', label: 'The Provoker', emoji: '😈', color: 'text-error' },
    { id: 'cheerleader', label: 'The Cheerleader', emoji: '🎉', color: 'text-neon-green' },
    { id: 'joker', label: 'The Joker', emoji: '🃏', color: 'text-tertiary' },
];

const SHOP_PERSONAS = [
    { id: 'hacker', label: 'The Hacker', emoji: '🧑‍💻', color: 'text-secondary' },
    { id: 'sage', label: 'The Sage', emoji: '🧘', color: 'text-primary' },
];

export default function TicTacToePage() {
    const {
        board, mode, setMode, aiPersona, setPersona, makeMove, resetGame,
        isPlayerTurn, winner, winningLine, playerSymbol, aiSymbol,
        playerWins, aiWins, difficulty, setDifficulty
    } = useTicTacToeStore();

    const [aiChat, setAiChat] = useState("I'm watching your moves closely...");
    const [aiThinking, setAiThinking] = useState(false);

    // Coach states
    const [coachTip, setCoachTip] = useState("Analyze the board before placing your first mark.");
    const [coachGlow, setCoachGlow] = useState(false);
    const [coachHighlightIndex, setCoachHighlightIndex] = useState(null);
    const [coachEnabled, setCoachEnabled] = useState(true);

    const { user, playerProfile } = useAuth();
    const unlockedItems = playerProfile?.unlocked_items || [];
    const availablePersonas = [
        ...BASE_PERSONAS,
        ...SHOP_PERSONAS.filter(p => unlockedItems.includes(`persona:${p.id}`))
    ];
    const persona = availablePersonas.find((p) => p.id === aiPersona) || BASE_PERSONAS[0];

    const [gameAnalysis, setGameAnalysis] = useState("");
    const [analysisLoading, setAnalysisLoading] = useState(false);
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
                const prompt = `You are playing ${persona.label}. Your personality is: ${
                    persona.id === 'provoker' ? "Trash-talking, arrogant, mocking." :
                    persona.id === 'cheerleader' ? "Incredibly positive, encouraging, hype-woman." :
                    persona.id === 'joker' ? "Sarcastic, makes terrible jokes, chaos gremlin." :
                    persona.id === 'hacker' ? "A chaotic hacker who speaks in leetspeak/binary fragments and tech slang." :
                    "A calm Zen master who speaks in deep, cryptic riddles."
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
                setAnalysisLoading(true);
                setGameAnalysis("Connecting to Neural Network for Match Review...");

                // Determine result
                let finalScore = 0;
                let outcome = 'draw';
                if (winner === 'X') {
                    finalScore = 150;
                    outcome = 'win';
                } else if (winner === 'O') {
                    outcome = 'loss';
                }

                const rawBoard = board;
                const asciiBoard = `
 ${rawBoard[0] || ' '} | ${rawBoard[1] || ' '} | ${rawBoard[2] || ' '}
---+---+---
 ${rawBoard[3] || ' '} | ${rawBoard[4] || ' '} | ${rawBoard[5] || ' '}
---+---+---
 ${rawBoard[6] || ' '} | ${rawBoard[7] || ' '} | ${rawBoard[8] || ' '}
`;

                let critique = "Critique engine offline.";
                try {
                    const gameContext = {
                        board: asciiBoard,
                        winner: outcome === 'win' ? 'Player (X)' : outcome === 'loss' ? 'AI (O)' : 'Draw',
                        game_mode: mode
                    };

                    const prompt = `You are the Neural Arcade AI Game Analyst. The player just finished a Tic-Tac-Toe game in mode '${mode}'.
Final Board State:
${asciiBoard}
Winner: ${outcome === 'win' ? 'Player (X)' : outcome === 'loss' ? 'AI (O)' : 'Draw'}

Provide a 2-sentence tactical breakdown/critique of the match. Keep the tone retro, arcade-like, and direct.`;

                    critique = await askDeepSeek([], gameContext, prompt);
                    setGameAnalysis(critique);
                } catch (err) {
                    console.error("Analysis generation error:", err);
                    setGameAnalysis("Analysis generation failed.");
                } finally {
                    setAnalysisLoading(false);
                }

                await supabase.from('game_sessions').insert({
                    user_id: user.id,
                    game_type: 'tictactoe',
                    game_mode: mode,
                    result: outcome,
                    score: finalScore,
                    tokens_earned: outcome === 'win' ? 10 : outcome === 'draw' ? 2 : 0,
                    ai_persona: aiPersona,
                    ai_analysis: critique,
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
                                {availablePersonas.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => { setPersona(p.id); resetGame(); setGameAnalysis(""); }}
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

                        {/* Difficulty Selector (visible for AI modes) */}
                        {(mode === 'persona' || mode === 'coach') && (
                            <div className="w-full max-w-md flex flex-col gap-2 mb-6">
                                <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest text-center font-bold">Bot Difficulty</p>
                                <div className="flex gap-2">
                                    {[
                                        { id: 'easy', label: 'Easy' },
                                        { id: 'medium', label: 'Medium' },
                                        { id: 'hard', label: 'Hard (Perfect)' }
                                    ].map((diff) => (
                                        <button
                                            key={diff.id}
                                            onClick={() => { setDifficulty(diff.id); resetGame(); }}
                                            className={`flex-1 py-1.5 rounded-lg font-label text-[10px] tracking-wider uppercase transition-all ${difficulty === diff.id
                                                ? diff.id === 'easy' ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-[0_0_8px_rgba(57,255,20,0.2)]'
                                                  : diff.id === 'medium' ? 'bg-secondary/20 text-secondary border border-secondary/50 shadow-[0_0_8px_rgba(76,215,246,0.2)]'
                                                  : 'bg-error/20 text-error border border-error/50 shadow-[0_0_8px_rgba(255,180,171,0.2)]'
                                                : 'bg-surface-container/30 border border-white/5 text-on-surface-variant hover:bg-white/5'
                                            }`}
                                        >
                                            {diff.label}
                                        </button>
                                    ))}
                                </div>
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
                                const isCoachHighlight = coachHighlightIndex === i && coachEnabled;
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

                        {winner && (
                            <div className="w-full max-w-md mt-6 glass-panel rounded-2xl p-5 border border-primary/30 text-center animate-fade-in relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary to-secondary" />
                                <h4 className="font-label text-xs text-primary tracking-[0.2em] uppercase mb-2">🤖 NEURAL MATCH REVIEW</h4>
                                <p className="font-body text-xs text-on-surface-variant italic">
                                    {gameAnalysis}
                                </p>
                            </div>
                        )}

                        {/* Reset/Actions */}
                        <div className="mt-8 flex gap-4">
                            <button
                                onClick={() => { resetGame(); setCoachHighlightIndex(null); setGameAnalysis(""); }}
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
                                <button 
                                    onClick={() => setCoachEnabled(!coachEnabled)}
                                    className={`w-12 h-6 rounded-full relative p-1 border transition-colors ${coachEnabled ? 'bg-primary/20 border-primary/50' : 'bg-surface-container-high border-white/10'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full absolute top-0.5 shadow-[0_0_10px_rgba(221,183,255,0.8)] transition-transform ${coachEnabled ? 'right-1 bg-primary' : 'left-1 bg-on-surface-variant'}`} />
                                </button>
                            </div>
                            <div className={`bg-surface-container-low p-4 rounded-xl border transition-all relative overflow-hidden group mb-4 ${coachGlow && coachEnabled ? 'border-primary shadow-[0_0_15px_rgba(221,183,255,0.4)]' : 'border-primary/20'}`}>
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-primary text-lg">💡</span>
                                    <span className="font-label text-xs text-primary tracking-[0.2em] uppercase">AI Recommendation</span>
                                </div>
                                <p className="font-body text-sm text-on-surface">
                                    {mode === 'coach' && coachEnabled ? coachTip : !coachEnabled ? 'Strategy Coach recommendations are muted.' : 'Enable Coach Mode to receive live strategic analysis from the DeepSeek neural network.'}
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
