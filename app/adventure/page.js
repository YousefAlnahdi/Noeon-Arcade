'use client';

import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useAdventureStore, SCENARIOS } from '@/store/adventure';

function TypewriterText({ text, speed = 20 }) {
    const [displayed, setDisplayed] = useState('');
    const [done, setDone] = useState(false);
    const idx = useRef(0);

    useEffect(() => {
        setDisplayed('');
        setDone(false);
        idx.current = 0;

        if (!text) return;

        const timer = setInterval(() => {
            idx.current++;
            if (idx.current >= text.length) {
                setDisplayed(text);
                setDone(true);
                clearInterval(timer);
            } else {
                setDisplayed(text.slice(0, idx.current));
            }
        }, speed);

        return () => clearInterval(timer);
    }, [text, speed]);

    return (
        <span>
            {displayed}
            {!done && <span className="crt-cursor">█</span>}
        </span>
    );
}

export default function AdventurePage() {
    const { user } = useAuth();
    const {
        gameState, narrative, choices, hp, maxHp, items,
        step, maxSteps, isLoading, scenario, finalNarrative,
        setScenario, startAdventure, makeChoice, saveSession, resetToMenu
    } = useAdventureStore();

    const [saved, setSaved] = useState(false);

    // Save on game over / victory
    useEffect(() => {
        if ((gameState === 'game-over' || gameState === 'victory') && !saved) {
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
            if (gameState === 'playing' && !isLoading) {
                const map = { '1': 0, '2': 1, '3': 2 };
                if (map[e.key] !== undefined && choices[map[e.key]]) {
                    makeChoice(choices[map[e.key]]);
                }
            }
            if ((gameState === 'game-over' || gameState === 'victory') && e.code === 'Space') {
                e.preventDefault();
                resetToMenu();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [gameState, isLoading, choices, makeChoice, resetToMenu]);

    const hpPercent = (hp / maxHp) * 100;
    const stepPercent = (step / maxSteps) * 100;

    return (
        <>
            <Navbar />
            <div className="pt-[88px] min-h-screen bg-[#0a0a0a] relative overflow-hidden flex items-center justify-center p-4 md:p-8">
                <style>{`
                    @keyframes crt-flicker {
                        0%, 100% { opacity: 1; }
                        92% { opacity: 1; }
                        93% { opacity: 0.8; }
                        94% { opacity: 1; }
                        96% { opacity: 0.9; }
                        97% { opacity: 1; }
                    }
                    @keyframes crt-on {
                        0% { transform: scaleY(0.005) scaleX(0.3); filter: brightness(30); }
                        20% { transform: scaleY(0.005) scaleX(1); filter: brightness(10); }
                        40% { transform: scaleY(1) scaleX(1); filter: brightness(2); }
                        100% { transform: scaleY(1) scaleX(1); filter: brightness(1); }
                    }
                    @keyframes text-glow-pulse {
                        0%, 100% { text-shadow: 0 0 4px rgba(0,255,65,0.6), 0 0 12px rgba(0,255,65,0.2); }
                        50% { text-shadow: 0 0 6px rgba(0,255,65,0.8), 0 0 20px rgba(0,255,65,0.3); }
                    }
                    @keyframes cursor-blink {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0; }
                    }
                    .crt-monitor {
                        background: #111;
                        border-radius: 18px;
                        border: 3px solid #2a2a2a;
                        box-shadow:
                            inset 0 0 80px rgba(0,0,0,0.8),
                            0 0 40px rgba(0,255,65,0.06),
                            0 8px 32px rgba(0,0,0,0.8);
                        position: relative;
                        overflow: hidden;
                    }
                    .crt-screen {
                        position: relative;
                        background: #050805;
                        animation: crt-flicker 8s infinite;
                    }
                    .crt-screen::before {
                        content: '';
                        position: absolute;
                        inset: 0;
                        background: linear-gradient(
                            transparent 50%,
                            rgba(0, 0, 0, 0.15) 50%
                        );
                        background-size: 100% 3px;
                        pointer-events: none;
                        z-index: 5;
                    }
                    .crt-screen::after {
                        content: '';
                        position: absolute;
                        inset: 0;
                        background: radial-gradient(
                            ellipse at center,
                            transparent 55%,
                            rgba(0, 0, 0, 0.5) 100%
                        );
                        pointer-events: none;
                        z-index: 5;
                    }
                    .crt-text {
                        color: #00ff41;
                        font-family: 'Courier New', 'Consolas', monospace;
                        text-shadow: 0 0 5px rgba(0,255,65,0.6), 0 0 15px rgba(0,255,65,0.15);
                        animation: text-glow-pulse 4s ease-in-out infinite;
                    }
                    .crt-text-amber {
                        color: #ffb000;
                        text-shadow: 0 0 5px rgba(255,176,0,0.6), 0 0 15px rgba(255,176,0,0.15);
                    }
                    .crt-text-dim {
                        color: #00aa2a;
                        text-shadow: 0 0 3px rgba(0,170,42,0.4);
                    }
                    .crt-text-red {
                        color: #ff3131;
                        text-shadow: 0 0 5px rgba(255,49,49,0.6);
                    }
                    .crt-cursor {
                        animation: cursor-blink 1s step-end infinite;
                        color: #00ff41;
                    }
                    .crt-boot {
                        animation: crt-on 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both;
                    }
                    .choice-btn {
                        border: 1px solid #00ff4130;
                        background: #00ff4108;
                        color: #00ff41;
                        transition: all 0.15s ease;
                        font-family: 'Courier New', monospace;
                        text-shadow: 0 0 4px rgba(0,255,65,0.4);
                    }
                    .choice-btn:hover {
                        background: #00ff4118;
                        border-color: #00ff4160;
                        box-shadow: 0 0 15px rgba(0,255,65,0.1);
                        transform: translateX(4px);
                    }
                    .hp-bar-fill {
                        transition: width 0.8s ease;
                        box-shadow: 0 0 8px currentColor;
                    }
                    .monitor-base {
                        background: linear-gradient(to bottom, #222, #1a1a1a);
                        border-radius: 0 0 12px 12px;
                        border: 2px solid #2a2a2a;
                        border-top: none;
                    }
                `}</style>

                {/* CRT Monitor Frame */}
                <div className="w-full max-w-4xl">
                    <div className="crt-monitor">
                        <div className="crt-screen">
                            {/* Monitor Top Bar */}
                            <div className="flex items-center justify-between px-4 py-2 border-b border-[#00ff4115] relative z-10">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${gameState === 'menu' ? 'bg-[#00ff41]' : 'bg-[#00ff41] animate-pulse'}`} style={{ boxShadow: '0 0 6px #00ff41' }} />
                                    <span className="crt-text text-[10px] tracking-[0.3em] uppercase opacity-60">
                                        NEXUS_GM v3.7 — {gameState === 'menu' ? 'STANDBY' : gameState === 'loading' ? 'PROCESSING' : gameState === 'playing' ? 'LIVE' : 'TERMINATED'}
                                    </span>
                                </div>
                                {gameState === 'playing' && (
                                    <span className="crt-text text-[10px] opacity-50">
                                        STEP {step}/{maxSteps}
                                    </span>
                                )}
                            </div>

                            {/* ============ MENU ============ */}
                            {gameState === 'menu' && (
                                <div className="p-6 md:p-10 relative z-10 min-h-[60vh]">
                                    {/* ASCII Title */}
                                    <pre className="crt-text text-[9px] sm:text-xs leading-tight mb-6 select-none text-center" style={{ textShadow: '0 0 15px rgba(0,255,65,0.5)' }}>
{`
 ▄▄▄▄    ▄▄▄▄▄▄▄ ▄▄   ▄▄ ▄▄▄▄▄▄▄ ▄▄    ▄ ▄▄▄▄▄▄▄ ▄▄   ▄▄ ▄▄▄▄▄▄   ▄▄▄▄▄▄▄ 
█    █  █       █  █ █  █       █  █  █ █       █  █ █  █      █ █       █
█    █  █    ▄▄▄█  █▄█  █   ▄   █   █▄█ █    ▄  █  █ █  █  ▄   ██    ▄▄▄█
█    █  █   █▄▄▄█       █  █ █  █       █   █▄█ █  █▄█  █ █▄█  ██   █▄▄▄ 
█   █▄  █    ▄▄▄█▄     ▄█  █▄█  █  ▄    █    ▄▄▄█       █      ██    ▄▄▄█
█       █   █▄▄▄  █   █ █       █ █ █   █   █   █       █  ▄   ██   █▄▄▄ 
█▄▄▄▄▄▄██▄▄▄▄▄▄▄█ █▄▄▄█ █▄▄▄▄▄▄▄█▄█  █▄▄█▄▄▄█   █▄▄▄▄▄▄▄█▄█ █▄▄██▄▄▄▄▄▄▄█
`}
                                    </pre>

                                    <p className="crt-text-dim text-xs text-center mb-8 tracking-wider">
                                        {'>'} SELECT SCENARIO TO BEGIN NEURAL SIMULATION {'<'}
                                    </p>

                                    <div className="flex flex-col gap-3 max-w-lg mx-auto mb-8">
                                        {Object.entries(SCENARIOS).map(([key, sc]) => (
                                            <button
                                                key={key}
                                                onClick={() => setScenario(key)}
                                                className={`text-left px-4 py-3 rounded border transition-all ${
                                                    scenario === key
                                                        ? 'border-[#00ff4160] bg-[#00ff4115] crt-text'
                                                        : 'border-[#00ff4115] bg-transparent crt-text-dim hover:border-[#00ff4130] hover:bg-[#00ff4108]'
                                                }`}
                                                style={{ fontFamily: "'Courier New', monospace" }}
                                            >
                                                <span className="crt-text opacity-40 mr-2">{'>'}</span>
                                                {sc.label}
                                                <span className="block text-[10px] opacity-50 mt-0.5 ml-5">{sc.desc}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="max-w-lg mx-auto">
                                        <button
                                            onClick={startAdventure}
                                            className="w-full py-4 border-2 border-[#00ff4150] bg-[#00ff4110] crt-text text-sm tracking-[0.3em] uppercase rounded hover:bg-[#00ff4120] hover:border-[#00ff4180] transition-all"
                                            style={{ fontFamily: "'Courier New', monospace", textShadow: '0 0 10px rgba(0,255,65,0.6)' }}
                                        >
                                            ▶ BOOT SIMULATION
                                        </button>
                                        <Link href="/" className="block text-center mt-4 crt-text-dim text-xs hover:text-[#00ff41] transition-colors" style={{ fontFamily: "'Courier New', monospace" }}>
                                            {'<'} EXIT TO ARCADE
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* ============ LOADING ============ */}
                            {gameState === 'loading' && (
                                <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] relative z-10 crt-boot">
                                    <div className="w-10 h-10 border-2 border-dashed border-[#00ff41] rounded-full animate-spin mb-4" style={{ boxShadow: '0 0 15px rgba(0,255,65,0.3)' }} />
                                    <p className="crt-text text-sm tracking-[0.2em] mb-2">
                                        <TypewriterText text="GENERATING NEURAL FEED..." speed={40} />
                                    </p>
                                    <p className="crt-text-dim text-[10px] tracking-wider opacity-50">
                                        scenario: {scenario} | step: {step + 1}
                                    </p>
                                </div>
                            )}

                            {/* ============ PLAYING ============ */}
                            {gameState === 'playing' && (
                                <div className="relative z-10 flex flex-col min-h-[60vh]">
                                    {/* HUD */}
                                    <div className="flex items-center gap-4 px-4 py-2 border-b border-[#00ff4110]">
                                        {/* HP */}
                                        <div className="flex items-center gap-2 flex-1">
                                            <span className="crt-text text-[10px] tracking-wider">HP</span>
                                            <div className="flex-1 max-w-[120px] h-2 bg-[#001a00] rounded overflow-hidden border border-[#00ff4120]">
                                                <div
                                                    className="h-full rounded hp-bar-fill"
                                                    style={{
                                                        width: `${hpPercent}%`,
                                                        backgroundColor: hpPercent > 60 ? '#00ff41' : hpPercent > 30 ? '#ffb000' : '#ff3131',
                                                        color: hpPercent > 60 ? '#00ff41' : hpPercent > 30 ? '#ffb000' : '#ff3131'
                                                    }}
                                                />
                                            </div>
                                            <span className={`text-[10px] ${hpPercent > 60 ? 'crt-text' : hpPercent > 30 ? 'crt-text-amber' : 'crt-text-red'}`} style={{ fontFamily: "'Courier New', monospace" }}>
                                                {hp}/{maxHp}
                                            </span>
                                        </div>

                                        {/* Progress */}
                                        <div className="flex items-center gap-2">
                                            <span className="crt-text-dim text-[10px]">STEP</span>
                                            <span className="crt-text text-xs font-bold">{step}</span>
                                            <span className="crt-text-dim text-[10px]">/{maxSteps}</span>
                                        </div>
                                    </div>

                                    {/* Items Bar */}
                                    {items.length > 0 && (
                                        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[#00ff4108]">
                                            <span className="crt-text-dim text-[9px] tracking-wider uppercase">INV:</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {items.map((item, i) => (
                                                    <span key={i} className="crt-text text-[10px] px-2 py-0.5 border border-[#00ff4120] rounded bg-[#00ff4108]">
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Narrative */}
                                    <div className="flex-1 p-6 md:p-8">
                                        <p className="crt-text text-sm md:text-base leading-relaxed" style={{ fontFamily: "'Courier New', monospace" }}>
                                            <TypewriterText text={narrative} speed={15} />
                                        </p>
                                    </div>

                                    {/* Choices */}
                                    <div className="px-6 pb-6 flex flex-col gap-2">
                                        <p className="crt-text-dim text-[9px] tracking-[0.2em] uppercase mb-1">{'>'} SELECT ACTION:</p>
                                        {choices.map((choice, idx) => (
                                            <button
                                                key={choice.id}
                                                onClick={() => makeChoice(choice)}
                                                disabled={isLoading}
                                                className="choice-btn text-left px-4 py-3 rounded text-sm flex items-center gap-3"
                                            >
                                                <span className="w-6 h-6 rounded border border-[#00ff4130] bg-[#00ff4108] flex items-center justify-center text-xs font-bold shrink-0 crt-text">
                                                    {idx + 1}
                                                </span>
                                                <span>{choice.text}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ============ GAME OVER ============ */}
                            {gameState === 'game-over' && (
                                <div className="p-6 md:p-10 flex flex-col items-center justify-center min-h-[60vh] relative z-10 text-center">
                                    <pre className="crt-text-red text-xs mb-4 select-none" style={{ fontFamily: "'Courier New', monospace" }}>
{`
 ▄▄▄▄▄▄▄ ▄▄▄▄▄▄▄ ▄▄▄   ▄▄▄ ▄▄▄▄▄▄▄    ▄▄▄▄▄▄▄ ▄▄   ▄▄ ▄▄▄▄▄▄▄ ▄▄▄▄▄▄  
█       █       █   █ █   █       █  █       █  █ █  █       █      █ 
█   ▄▄▄▄█   ▄   █   █▄█   █    ▄▄▄█  █   ▄   █  █▄█  █    ▄▄▄█   ▄▄▄▄█ 
█  █  ▄▄█  █▄█  █       █   █▄▄▄  █  █  █ █  █       █   █▄▄▄█  █▄▄▄▄ 
█  █ █  █       █       █    ▄▄▄█ █  █  █▄█  █       █    ▄▄▄█   ▄▄▄▄█
█  █▄▄█ █   ▄   █ ██▄██ █   █▄▄▄█  █       █     █ █   █▄▄▄█  █▄▄▄▄ 
█▄▄▄▄▄▄▄█▄▄█ █▄▄█▄█   █▄█▄▄▄▄▄▄▄█  █▄▄▄▄▄▄▄█ ▄▄▄█ █▄█▄▄▄▄▄▄▄█▄▄▄▄▄▄█
`}
                                    </pre>

                                    <p className="crt-text text-sm leading-relaxed mb-6 max-w-md" style={{ fontFamily: "'Courier New', monospace" }}>
                                        {finalNarrative}
                                    </p>

                                    <div className="flex gap-6 mb-6">
                                        <div className="text-center">
                                            <p className="crt-text-dim text-[9px] uppercase tracking-wider">Steps</p>
                                            <p className="crt-text text-xl font-bold">{step}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="crt-text-dim text-[9px] uppercase tracking-wider">Final HP</p>
                                            <p className="crt-text-red text-xl font-bold">{hp}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="crt-text-dim text-[9px] uppercase tracking-wider">Items</p>
                                            <p className="crt-text text-xl font-bold">{items.length}</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={resetToMenu}
                                        className="px-8 py-3 border-2 border-[#ff313150] bg-[#ff313110] crt-text-red text-sm tracking-[0.2em] uppercase rounded hover:bg-[#ff313120] transition-all"
                                        style={{ fontFamily: "'Courier New', monospace" }}
                                    >
                                        ↺ REBOOT SYSTEM (SPACE)
                                    </button>
                                </div>
                            )}

                            {/* ============ VICTORY ============ */}
                            {gameState === 'victory' && (
                                <div className="p-6 md:p-10 flex flex-col items-center justify-center min-h-[60vh] relative z-10 text-center">
                                    <pre className="crt-text text-xs mb-4 select-none" style={{ fontFamily: "'Courier New', monospace", textShadow: '0 0 20px rgba(0,255,65,0.6)' }}>
{`
 ▄▄   ▄▄ ▄▄▄ ▄▄▄▄▄▄▄ ▄▄▄▄▄▄▄ ▄▄▄▄▄▄▄ ▄▄▄▄▄▄   ▄▄   ▄▄ 
█  █▄█  █   █       █       █       █   ▄  █ █  █ █  █
█       █   █  ▄▄▄▄▄█  ▄▄▄▄▄█   ▄▄▄▄█  █ █ █ █  █▄█  █
█       █   █ █▄▄▄▄▄█ █▄▄▄▄▄█  █  ▄▄█   █▄▄▄██       █
█       █   █▄▄▄▄▄  █▄▄▄▄▄  █  █ █  █    ▄▄  █▄     ▄█
█ ██▄██ █   █▄▄▄▄▄█ █▄▄▄▄▄█ █  █▄▄█ █   █  █ █ █   █  
█▄█   █▄█▄▄▄█▄▄▄▄▄▄▄█▄▄▄▄▄▄▄█▄▄▄▄▄▄▄█▄▄▄█  █▄█ █▄▄▄█  
`}
                                    </pre>

                                    <p className="crt-text text-sm leading-relaxed mb-6 max-w-md" style={{ fontFamily: "'Courier New', monospace" }}>
                                        {finalNarrative}
                                    </p>

                                    <div className="flex gap-6 mb-4">
                                        <div className="text-center">
                                            <p className="crt-text-dim text-[9px] uppercase tracking-wider">Steps</p>
                                            <p className="crt-text text-xl font-bold">{step}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="crt-text-dim text-[9px] uppercase tracking-wider">Final HP</p>
                                            <p className="crt-text text-xl font-bold">{hp}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="crt-text-dim text-[9px] uppercase tracking-wider">Items</p>
                                            <p className="crt-text text-xl font-bold">{items.length}</p>
                                        </div>
                                    </div>

                                    <div className="border border-[#00ff4120] bg-[#00ff4108] rounded px-4 py-2 mb-6">
                                        <p className="crt-text-dim text-[9px] uppercase tracking-wider">Tokens Earned</p>
                                        <p className="crt-text-amber text-lg font-bold">+20 ⬡</p>
                                    </div>

                                    <button
                                        onClick={resetToMenu}
                                        className="px-8 py-3 border-2 border-[#00ff4150] bg-[#00ff4110] crt-text text-sm tracking-[0.2em] uppercase rounded hover:bg-[#00ff4120] transition-all"
                                        style={{ fontFamily: "'Courier New', monospace" }}
                                    >
                                        ↺ NEW SIMULATION (SPACE)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Monitor Base Stand */}
                    <div className="monitor-base h-4 w-3/5 mx-auto" />
                    <div className="w-2/5 h-3 mx-auto bg-[#1a1a1a] rounded-b-lg border-2 border-t-0 border-[#252525]" />
                </div>
            </div>
        </>
    );
}
