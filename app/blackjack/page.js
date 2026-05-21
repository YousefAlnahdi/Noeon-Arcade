'use client';

import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useBlackjackStore, calculateHandValue } from '@/store/blackjack';

const EXPRESSION_AVATARS = {
    smug: {
        face: '[ ≖ ‿ ≖ ]',
        status: 'SYSTEM: DOMINANT',
        color: 'text-primary drop-shadow-[0_0_8px_rgba(221,183,255,0.7)]'
    },
    alarmed: {
        face: '[ ⊙ _ ⊙ ]',
        status: 'WARNING: OUTLIER',
        color: 'text-error drop-shadow-[0_0_8px_rgba(255,180,171,0.7)]'
    },
    neutral: {
        face: '[ • _ • ]',
        status: 'SYSTEM: ACTIVE',
        color: 'text-secondary drop-shadow-[0_0_8px_rgba(76,215,246,0.7)]'
    },
    glitched: {
        face: '[ ⏧ _ ⏧ ]',
        status: 'SYS_ERR: GLITCH',
        color: 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)] animate-pulse'
    },
    thinking: {
        face: '[ ⬡ _ ⬡ ]',
        status: 'ANALYSIS: RUNNING',
        color: 'text-tertiary drop-shadow-[0_0_8px_rgba(255,176,205,0.7)]'
    }
};

const SUIT_SYMBOLS = {
    H: { char: '♥', color: 'text-neon-red drop-shadow-[0_0_6px_rgba(255,49,49,0.5)]' },
    D: { char: '♦', color: 'text-neon-red drop-shadow-[0_0_6px_rgba(255,49,49,0.5)]' },
    C: { char: '♣', color: 'text-secondary drop-shadow-[0_0_6px_rgba(76,215,246,0.5)]' },
    S: { char: '♠', color: 'text-secondary drop-shadow-[0_0_6px_rgba(76,215,246,0.5)]' }
};

export default function BlackjackPage() {
    const { user, playerProfile } = useAuth();
    const {
        playerHand, dealerHand, gameState, result, bet, credits,
        aiCommentary, aiExpression, hacks, hacksGenerated, isThinking, isHacking,
        revealedDealer, peekedCard, dealerLimit, lastAiCritique,
        setBet, startGame, hit, stand, doubleDown, generateHacks, buyHack
    } = useBlackjackStore();

    const [scanningHacks, setScanningHacks] = useState(false);
    const [scannedOnce, setScannedOnce] = useState(false);

    // Profile tokens (local state for immediate visual feedback before Supabase syncs)
    const [localTokens, setLocalTokens] = useState(0);

    useEffect(() => {
        if (playerProfile) {
            setLocalTokens(playerProfile.total_tokens ?? 0);
        }
    }, [playerProfile]);

    // Handle spacebar to deal or restart game
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space') {
                // Prevent scrolling
                e.preventDefault();
                if (gameState === 'betting' || gameState === 'round-end') {
                    handleStartRound();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState, bet, credits]);

    const handleStartRound = () => {
        if (user) {
            startGame(user.id);
        } else {
            startGame(null);
        }
    };

    const handleHit = () => {
        if (user) hit(user.id);
        else hit(null);
    };

    const handleStand = () => {
        if (user) stand(user.id);
        else stand(null);
    };

    const handleDouble = () => {
        if (user) doubleDown(user.id);
        else doubleDown(null);
    };

    const handleScanHacks = async () => {
        if (scanningHacks || isHacking || hacksGenerated) return;
        setScanningHacks(true);
        setTimeout(async () => {
            if (user) {
                await generateHacks(user.id, localTokens);
            } else {
                await generateHacks(null, 100); // Guest tokens mockup
            }
            setScanningHacks(false);
            setScannedOnce(true);
        }, 1200);
    };

    const handleBuyHack = async (hack) => {
        if (localTokens < hack.cost) return;
        
        const success = await buyHack(
            user?.id || null, 
            hack, 
            localTokens, 
            (updatedVal) => {
                setLocalTokens(updatedVal);
            }
        );
    };

    const playerVal = calculateHandValue(playerHand);
    const dealerVal = calculateHandValue(dealerHand);

    return (
        <>
            <Navbar />
            <div className="pt-[88px] min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-surface grid-bg">
                <style>{`
                    @keyframes card-deal {
                        0% { transform: translateY(-80px) rotate(-15deg) scale(0.85); opacity: 0; filter: blur(4px); }
                        100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; filter: none; }
                    }
                    @keyframes card-flip {
                        0% { transform: rotateY(180deg); }
                        100% { transform: rotateY(0deg); }
                    }
                    .animate-card-deal {
                        animation: card-deal 0.45s cubic-bezier(0.19, 1, 0.22, 1) both;
                    }
                    .animate-card-flip {
                        animation: card-flip 0.3s ease-out both;
                    }
                    .hologram-glow {
                        box-shadow: 0 0 15px rgba(121, 246, 255, 0.15), inset 0 0 15px rgba(121, 246, 255, 0.1);
                    }
                `}</style>

                {/* Left Sidebar */}
                <aside className="lg:col-span-3 border-r border-white/5 bg-surface-container-lowest/80 backdrop-blur-xl p-6 flex flex-col justify-between">
                    <div className="flex flex-col gap-6">
                        <div>
                            <span className="bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-full font-label text-[10px] tracking-wider uppercase">
                                CARD SYSTEM ACTIVE
                            </span>
                            <h1 className="font-display text-2xl font-black text-white mt-3 tracking-tight neon-text-primary">
                                CYBER BLACKJACK
                            </h1>
                            <p className="font-body text-xs text-on-surface-variant leading-relaxed mt-1">
                                Defeat the Croupier AI in an elevated game of mathematical risk. Use the Hack Matrix to bypass normal deck limitations.
                            </p>
                        </div>

                        {/* Credits Balance Display */}
                        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-2">
                            <div>
                                <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Credits Pool</p>
                                <p className="font-display text-3xl font-extrabold text-secondary neon-text-secondary">{credits} <span className="text-xs font-label text-on-surface-variant">CRD</span></p>
                            </div>
                            <div className="h-px bg-white/5 my-1" />
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-label text-[10px] text-on-surface-variant uppercase">Current Bet</span>
                                <span className="font-display font-semibold text-white">{bet} CRD</span>
                            </div>
                        </div>

                        {/* Arcade Wallet balance */}
                        <div className="bg-surface-container-high/40 border border-white/5 rounded-2xl p-4 flex justify-between items-center">
                            <div>
                                <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Arcade Tokens</p>
                                <p className="font-display text-lg font-bold text-tertiary">{user ? localTokens : 'GUEST'}</p>
                            </div>
                            <span className="text-tertiary text-2xl animate-pulse">⬡</span>
                        </div>

                        {/* Hand Value Reference */}
                        <div className="bg-surface-container/30 border border-white/5 rounded-2xl p-4">
                            <h3 className="font-label text-xs font-semibold text-on-surface uppercase tracking-wider mb-2">Rule System</h3>
                            <ul className="space-y-1.5 font-body text-[11px] text-on-surface-variant">
                                <li className="flex justify-between"><span>Blackjack Payout</span> <span className="text-white">3 : 2</span></li>
                                <li className="flex justify-between"><span>Standard Payout</span> <span className="text-white">1 : 1</span></li>
                                <li className="flex justify-between"><span>Dealer hits on</span> <span className="text-white">Soft 17</span></li>
                                <li className="flex justify-between"><span>Hacks cost</span> <span className="text-tertiary">Arcade Tokens</span></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-6">
                        <Link
                            href="/"
                            className="block w-full text-center py-3 bg-surface-container/60 border border-white/10 text-on-surface-variant font-label text-xs tracking-wider uppercase rounded-xl hover:bg-surface-container hover:text-primary transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            ← Leave Table
                        </Link>
                    </div>
                </aside>

                {/* Main Card Table Area */}
                <main className="lg:col-span-9 flex flex-col justify-between p-6 lg:p-8 min-h-[calc(100vh-88px)] relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(13,148,136,0.08)_0%,rgba(15,23,42,0)_70%)] pointer-events-none" />

                    {/* AI Croupier HUD Header */}
                    <div className="glass-panel rounded-2xl p-4 border-t border-white/10 flex items-start md:items-center justify-between gap-4 z-20">
                        <div className="flex gap-4 items-center">
                            <div className={`w-14 h-14 rounded-xl bg-surface-container-high/60 border border-white/10 flex flex-col justify-center items-center font-display text-sm relative shrink-0 ${EXPRESSION_AVATARS[aiExpression].color}`}>
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]" />
                                <span className="text-sm font-bold tracking-tight">{EXPRESSION_AVATARS[aiExpression].face}</span>
                                <span className="text-[7px] font-label uppercase tracking-widest mt-1 opacity-70">{EXPRESSION_AVATARS[aiExpression].status}</span>
                            </div>
                            <div className="flex-1">
                                <h2 className="font-display text-sm font-extrabold text-white tracking-wider flex items-center gap-1.5">
                                    CROUPIER_SHARK.AI
                                    {isThinking && (
                                        <span className="flex gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.15s]" />
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.3s]" />
                                        </span>
                                    )}
                                </h2>
                                <p className="font-body text-xs text-on-surface-variant italic leading-relaxed mt-0.5 max-w-2xl">
                                    &ldquo;{aiCommentary}&rdquo;
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* The Dealer and Player Card Area */}
                    <div className="flex-grow flex flex-col justify-center items-center gap-8 py-8 z-10">
                        {/* Dealer Side */}
                        <div className="w-full flex flex-col items-center gap-3">
                            <div className="flex items-center gap-3">
                                <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Dealer Hand</span>
                                {dealerHand.length > 0 && (
                                    <span className="bg-surface-container-high px-2 py-0.5 rounded font-display text-xs text-outline border border-white/5">
                                        {revealedDealer ? dealerVal : '?'}
                                    </span>
                                )}
                            </div>
                            <div className="flex justify-center gap-4 min-h-[140px] items-center">
                                {dealerHand.length === 0 ? (
                                    <div className="w-24 h-36 rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center text-xs font-label text-on-surface-variant/40">
                                        Empty
                                    </div>
                                ) : (
                                    dealerHand.map((card, index) => {
                                        const hide = !revealedDealer && index === 1;
                                        
                                        if (hide) {
                                            return (
                                                <div 
                                                    key={`dealer-card-${index}`} 
                                                    className="w-24 h-36 rounded-xl bg-gradient-to-br from-surface-container-high to-surface-container-lowest border-2 border-primary/20 flex flex-col items-center justify-center relative shadow-[0_0_15px_rgba(221,183,255,0.07)] hologram-glow overflow-hidden"
                                                >
                                                    <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.15)_50%)] bg-[size:100%_4px] pointer-events-none" />
                                                    <span className="text-primary text-xl font-bold opacity-30 select-none animate-pulse">⬡</span>
                                                    <div className="absolute bottom-2 text-[8px] font-label text-primary/40 uppercase tracking-widest">HOLE</div>
                                                </div>
                                            );
                                        }

                                        const symbolInfo = SUIT_SYMBOLS[card.suit];

                                        return (
                                            <div 
                                                key={`dealer-card-${index}`}
                                                className="w-24 h-36 rounded-xl bg-surface-container/90 border-2 border-white/10 flex flex-col justify-between p-3 relative shadow-[0_4px_12px_rgba(0,0,0,0.5)] animate-card-deal"
                                                style={{ animationDelay: `${index * 0.1}s` }}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className="font-display text-sm font-extrabold text-white leading-none">{card.value}</span>
                                                    <span className={`${symbolInfo.color} text-sm leading-none`}>{symbolInfo.char}</span>
                                                </div>
                                                <div className="flex justify-center items-center text-2xl my-auto">
                                                    <span className={`${symbolInfo.color}`}>{symbolInfo.char}</span>
                                                </div>
                                                <div className="flex justify-between items-end rotate-180">
                                                    <span className="font-display text-sm font-extrabold text-white leading-none">{card.value}</span>
                                                    <span className={`${symbolInfo.color} text-sm leading-none`}>{symbolInfo.char}</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Player Side */}
                        <div className="w-full flex flex-col items-center gap-3">
                            <div className="flex justify-center gap-4 min-h-[140px] items-center">
                                {playerHand.length === 0 ? (
                                    <div className="w-24 h-36 rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center text-xs font-label text-on-surface-variant/40">
                                        Empty
                                    </div>
                                ) : (
                                    playerHand.map((card, index) => {
                                        const symbolInfo = SUIT_SYMBOLS[card.suit];
                                        return (
                                            <div 
                                                key={`player-card-${index}`}
                                                className="w-24 h-36 rounded-xl bg-surface-container/90 border-2 border-white/10 flex flex-col justify-between p-3 relative shadow-[0_4px_12px_rgba(0,0,0,0.5)] animate-card-deal"
                                                style={{ animationDelay: `${index * 0.1}s` }}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className="font-display text-sm font-extrabold text-white leading-none">{card.value}</span>
                                                    <span className={`${symbolInfo.color} text-sm leading-none`}>{symbolInfo.char}</span>
                                                </div>
                                                <div className="flex justify-center items-center text-2xl my-auto">
                                                    <span className={`${symbolInfo.color}`}>{symbolInfo.char}</span>
                                                </div>
                                                <div className="flex justify-between items-end rotate-180">
                                                    <span className="font-display text-sm font-extrabold text-white leading-none">{card.value}</span>
                                                    <span className={`${symbolInfo.color} text-sm leading-none`}>{symbolInfo.char}</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Player Hand</span>
                                {playerHand.length > 0 && (
                                    <span className={`px-2 py-0.5 rounded font-display text-xs font-bold border ${playerVal > 21 ? 'bg-error/20 text-error border-error/30' : 'bg-primary/20 text-primary border-primary/30'}`}>
                                        {playerVal}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Deck Peek Status (Bought Hack) */}
                    {peekedCard && (
                        <div className="absolute top-1/2 left-6 transform -translate-y-1/2 bg-surface-container-high/90 border-2 border-secondary p-4 rounded-xl flex flex-col items-center gap-2 shadow-[0_0_20px_rgba(76,215,246,0.3)] z-30 animate-fade-in">
                            <span className="font-label text-[8px] text-secondary uppercase tracking-widest font-bold">PEEK DECRYPTED</span>
                            <div className="w-14 h-20 bg-surface-container border border-secondary rounded flex flex-col justify-between p-1.5 text-xs font-bold">
                                <div className="flex justify-between"><span className="text-white">{peekedCard.value}</span><span className={SUIT_SYMBOLS[peekedCard.suit].color}>{SUIT_SYMBOLS[peekedCard.suit].char}</span></div>
                                <div className="text-center text-lg">{SUIT_SYMBOLS[peekedCard.suit].char}</div>
                            </div>
                            <span className="font-body text-[8px] text-on-surface-variant text-center max-w-[80px]">Next card in deck</span>
                        </div>
                    )}

                    {/* Bottom Console Panel */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 z-20 relative">
                        {/* Game controls */}
                        <div className="md:col-span-7 flex flex-col gap-4 justify-end">
                            {gameState === 'betting' && (
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Adjust Chips Size:</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {[10, 20, 50, 100, 200].map((val) => (
                                            <button
                                                key={`bet-${val}`}
                                                disabled={credits < val}
                                                onClick={() => setBet(val)}
                                                className={`flex-1 py-2 font-display text-sm font-bold rounded-xl border transition-all ${
                                                    bet === val 
                                                        ? 'bg-secondary/20 text-secondary border-secondary shadow-[0_0_10px_rgba(76,215,246,0.25)]' 
                                                        : 'bg-surface-container-high/60 border-white/5 text-on-surface-variant hover:bg-white/5'
                                                } ${credits < val ? 'opacity-30 cursor-not-allowed' : ''}`}
                                            >
                                                {val}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleStartRound}
                                        className="w-full py-4 bg-primary text-on-primary font-label text-xs tracking-widest uppercase font-bold rounded-2xl hover:brightness-110 neon-glow-primary hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                                    >
                                        <span>▶</span> INITIALIZE DEAL (SPACE)
                                    </button>
                                </div>
                            )}

                            {gameState === 'player-turn' && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleHit}
                                            className="flex-1 py-4 bg-surface-container border border-white/10 hover:bg-surface-container-high text-white font-label text-xs tracking-wider uppercase font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                            ⚡ HIT (DRAW)
                                        </button>
                                        <button
                                            onClick={handleStand}
                                            className="flex-1 py-4 bg-secondary text-on-secondary hover:brightness-110 font-label text-xs tracking-wider uppercase font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                            ✋ STAND (HOLD)
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleDouble}
                                        disabled={credits < bet}
                                        className={`w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-tertiary font-label text-xs tracking-wider uppercase font-bold rounded-xl transition-all ${
                                            credits < bet ? 'opacity-30 cursor-not-allowed' : ''
                                        }`}
                                    >
                                        💎 DOUBLE DOWN
                                    </button>
                                </div>
                            )}

                            {gameState === 'dealer-turn' && (
                                <div className="bg-surface-container/60 border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center text-center animate-pulse">
                                    <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin mb-2" />
                                    <p className="font-display text-xs text-secondary font-bold tracking-widest">CROUPIER DRAWING CARDS...</p>
                                </div>
                            )}

                            {gameState === 'round-end' && (
                                <div className="flex flex-col gap-3">
                                    <div className="bg-surface-container-high border border-white/5 p-4 rounded-xl text-left">
                                        <p className="font-label text-[10px] text-primary tracking-wider uppercase mb-1">🤖 AI Review & Critique</p>
                                        <p className="font-body text-xs text-on-surface-variant italic leading-relaxed">
                                            {lastAiCritique || "Compiling tactical summaries..."}
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleStartRound}
                                        className="w-full py-4 bg-secondary text-on-secondary font-label text-xs tracking-widest uppercase font-bold rounded-2xl hover:brightness-110 neon-glow-secondary hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                                    >
                                        <span>↺</span> RE-INITIATE SEQUENCE (SPACE)
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Hack Matrix panel */}
                        <div className="md:col-span-5">
                            <div className={`glass-panel rounded-2xl p-4 border border-white/5 h-full min-h-[160px] flex flex-col ${
                                gameState === 'player-turn' && !hacksGenerated ? 'cursor-pointer hover:border-primary/20' : ''
                            }`}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-label text-[10px] text-tertiary uppercase tracking-wider font-bold">MATRIX_HACKS.BIN</span>
                                    {hacksGenerated && (
                                        <span className="bg-neon-green/20 text-neon-green border border-neon-green/30 px-1.5 py-0.5 rounded text-[8px] uppercase font-bold">
                                            SCANNED
                                        </span>
                                    )}
                                </div>

                                {gameState !== 'player-turn' ? (
                                    <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
                                        <span className="text-xl opacity-20 mb-1">🔒</span>
                                        <p className="font-body text-[10px] text-on-surface-variant opacity-60">
                                            Hack Matrix scanner locked.<br />Deal cards to unlock.
                                        </p>
                                    </div>
                                ) : scanningHacks || isHacking ? (
                                    <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
                                        <div className="w-8 h-8 border-2 border-dashed border-tertiary rounded-full animate-spin mb-2" />
                                        <p className="font-display text-[10px] text-tertiary font-bold tracking-widest animate-pulse">DECRYPTING SYSTEM GAPS...</p>
                                    </div>
                                ) : !hacksGenerated ? (
                                    <button 
                                        onClick={handleScanHacks}
                                        className="flex-grow w-full border border-dashed border-white/10 hover:border-tertiary/40 rounded-xl flex flex-col items-center justify-center p-4 group transition-colors"
                                    >
                                        <span className="text-tertiary text-2xl group-hover:scale-110 transition-transform mb-1 opacity-70">⬡</span>
                                        <p className="font-display text-xs text-white font-bold group-hover:text-tertiary transition-colors">SCAN FOR HACKS</p>
                                        <p className="font-body text-[9px] text-on-surface-variant opacity-60 mt-0.5">Scans deck parameters using AI logic</p>
                                    </button>
                                ) : hacks.length === 0 ? (
                                    <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
                                        <span className="text-xl opacity-40 mb-1">🛡</span>
                                        <p className="font-body text-[10px] text-on-surface-variant opacity-80">
                                            All hacks consumed for this hand.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex-grow flex flex-col gap-2.5 justify-center py-1">
                                        {hacks.map((hack) => {
                                            const canAfford = localTokens >= hack.cost;
                                            return (
                                                <div 
                                                    key={hack.id} 
                                                    className="p-2.5 bg-surface-container-high/60 border border-white/5 rounded-xl flex justify-between items-center text-xs gap-3"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-display font-bold text-white text-[11px] truncate uppercase tracking-wide">{hack.name}</p>
                                                        <p className="font-body text-[9px] text-on-surface-variant leading-tight mt-0.5">{hack.description}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleBuyHack(hack)}
                                                        disabled={!canAfford}
                                                        className={`px-3 py-1.5 rounded-lg font-label text-[9px] uppercase tracking-wider font-semibold shrink-0 transition-colors ${
                                                            canAfford 
                                                                ? 'bg-tertiary text-on-tertiary hover:brightness-110' 
                                                                : 'bg-white/5 text-on-surface-variant cursor-not-allowed border border-white/10'
                                                        }`}
                                                    >
                                                        {hack.cost} Tkn
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Victory / Defeat Overlay */}
            {gameState === 'round-end' && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 pointer-events-none">
                    <div className="text-center p-6 rounded-3xl border border-white/10 bg-surface-container/90 shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-sm w-full animate-fade-in pointer-events-auto">
                        <span className="text-4xl mb-2 block animate-bounce">
                            {result === 'win' || result === 'blackjack' ? '🏆' : result === 'loss' ? '💀' : '🤝'}
                        </span>
                        <h2 className={`font-display text-3xl font-extrabold uppercase tracking-wider mb-1 ${
                            result === 'win' || result === 'blackjack' ? 'text-neon-green neon-text-green' : result === 'loss' ? 'text-error' : 'text-outline'
                        }`}>
                            {result === 'win' ? 'WINNER!' : result === 'blackjack' ? 'BLACKJACK!' : result === 'loss' ? 'DEFEATED' : 'PUSH'}
                        </h2>
                        
                        <p className="font-body text-xs text-on-surface-variant mb-4">
                            {result === 'win' || result === 'blackjack' 
                                ? `Excellent play. Credits increased by +${result === 'blackjack' ? Math.floor(bet * 2.5) : bet * 2}.` 
                                : result === 'loss' 
                                ? `Croupier takes your bet of -${bet} credits.` 
                                : 'Push. All active credits returned.'
                            }
                        </p>
                        
                        <div className="bg-white/5 border border-white/5 py-2.5 px-4 rounded-xl mb-4 text-center">
                            <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider">Arcade Loot Gained</p>
                            <p className="font-display text-lg font-bold text-amber-400">
                                +{result === 'blackjack' ? '15' : result === 'win' ? '10' : result === 'draw' ? '2' : '0'} Tokens
                            </p>
                        </div>

                        <button
                            onClick={handleStartRound}
                            className={`w-full py-3 font-label text-xs tracking-wider uppercase rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] border font-bold ${
                                result === 'win' || result === 'blackjack'
                                    ? 'bg-neon-green/20 border-neon-green text-neon-green hover:bg-neon-green/30'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                            }`}
                        >
                            DEAL NEXT HAND (SPACE)
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
