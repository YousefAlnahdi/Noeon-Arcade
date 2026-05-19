'use client';

import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { askDeepSeek } from '@/lib/deepseek';

export default function PerformancePage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [playstyleTitle, setPlaystyleTitle] = useState("Analyzing...");
    const [playstyleDesc, setPlaystyleDesc] = useState("Gathering telemetry...");
    const [stats, setStats] = useState({
        winRate: "0%", apm: 0, tokens: 0, risk: "N/A"
    });

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const analyzePerformance = async () => {
            try {
                // Fetch last 10 games for context
                const { data: gamesData } = await supabase
                    .from('game_sessions')
                    .select('*')
                    .eq('player_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (gamesData && gamesData.length > 0) {
                    const wins = gamesData.filter(g => g.result === 'win').length;
                    const winRate = Math.round((wins / gamesData.length) * 100);

                    setStats({
                        winRate: `${winRate}%`,
                        apm: Math.floor(Math.random() * 50) + 100, // Mock APM
                        tokens: gamesData.reduce((acc, curr) => acc + curr.score, 0),
                        risk: winRate > 50 ? "Balanced" : "High"
                    });

                    // Call DeepSeek
                    const promptContext = {
                        games: gamesData.map(g => ({
                            game: g.game_module, result: g.result, score: g.score, ...g.telemetry
                        }))
                    };

                    const prompt = "Analyze these recent arcade game sessions. Provide a creative 2-3 word 'Playstyle Title' followed by a '|' character, and then a 2-3 sentence paragraph detailing their playstyle based on this data. Emphasize their win rates or high scores.";

                    const reply = await askDeepSeek([], promptContext, prompt);

                    // Parse reply
                    const parts = reply.split('|');
                    if (parts.length > 1) {
                        setPlaystyleTitle(parts[0].trim());
                        setPlaystyleDesc(parts[1].trim());
                    } else {
                        setPlaystyleTitle("Unpredictable Maverick");
                        setPlaystyleDesc(reply);
                    }
                } else {
                    setPlaystyleTitle("New Challenger");
                    setPlaystyleDesc("No telemetry data found. Play some games first to generate a profile.");
                }

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        analyzePerformance();
    }, [user]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center font-display text-secondary animate-pulse gap-4">
                <span className="text-4xl">🤖</span>
                <p className="tracking-widest uppercase">Initializing Performance Matrix...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <>
                <Navbar />
                <div className="min-h-[calc(100vh-88px)] flex flex-col items-center justify-center text-center p-6 mt-[88px] relative z-10">
                    <span className="text-6xl mb-6 opacity-50">🔒</span>
                    <h2 className="font-display text-3xl font-bold text-on-surface mb-2">Restricted Area</h2>
                    <p className="font-body text-on-surface-variant max-w-md mx-auto mb-8">
                        The Neural Analyst requires an active uplink. You must log in to view your playstyle performance profile.
                    </p>
                    <Link href="/login" className="px-8 py-3 bg-secondary text-on-secondary font-label text-sm tracking-wider uppercase rounded-xl neon-glow-secondary hover:brightness-110 transition-all">
                        Initiate Login Sequence
                    </Link>
                </div>
            </>
        );
    }
    return (
        <>
            <Navbar />
            <main className="pt-[100px] pb-16 px-4 md:px-12 max-w-[1440px] mx-auto min-h-screen flex flex-col gap-10 relative">
                {/* Ambient blobs */}
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />

                {/* Header */}
                <header className="text-center py-8 relative z-10">
                    <h1 className="font-display text-4xl md:text-5xl font-extrabold text-primary neon-text-primary mb-4 tracking-tight">
                        Neural Performance Breakdown
                    </h1>
                    <p className="font-body text-base text-on-surface-variant max-w-xl mx-auto">
                        Session analysis complete. Processing telemetry and behavioral data...
                    </p>
                </header>

                {/* Bento Grid Report */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10">
                    {/* Playstyle Hero Card */}
                    <div className="glass-panel rounded-[2rem] p-10 md:col-span-8 flex flex-col gap-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
                            <span className="text-[100px] text-primary">🧠</span>
                        </div>
                        <div className="space-y-3 relative z-10">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 font-label text-xs text-primary tracking-wider uppercase">
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(221,183,255,0.8)]" />
                                Analysis Complete
                            </span>
                            <h2 className="font-display text-2xl md:text-3xl font-bold text-on-surface">
                                Your Playstyle:{' '}
                                <span className="text-secondary neon-text-secondary">{playstyleTitle}</span>
                            </h2>
                        </div>
                        <div className="bg-surface-container-low/50 rounded-2xl p-6 border border-white/5 relative z-10">
                            <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                                <strong className="text-on-surface font-display text-base">LLM Insight:</strong>{' '}
                                {playstyleDesc}
                            </p>
                        </div>
                        {/* Stats Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-auto relative z-10">
                            {[
                                { label: 'Recent Win Rate', value: stats.winRate, color: 'text-primary' },
                                { label: 'Est. APM', value: stats.apm, color: 'text-secondary' },
                                { label: 'Recent Tokens', value: stats.tokens, color: 'text-tertiary' },
                                { label: 'Risk Index', value: stats.risk, color: 'text-error' },
                            ].map((stat) => (
                                <div key={stat.label} className="space-y-1">
                                    <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider">{stat.label}</p>
                                    <p className={`font-display text-2xl md:text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Neural Matrix Radar */}
                    <div className="glass-panel rounded-[2rem] p-6 md:col-span-4 flex flex-col items-center justify-center gap-6">
                        <h3 className="font-display text-lg font-semibold text-on-surface w-full text-center">Neural Matrix</h3>
                        <div className="relative w-[240px] h-[240px] flex items-center justify-center my-4">
                            {/* Radar chart visualization */}
                            <div
                                className="w-[200px] h-[200px] opacity-80 neon-glow-primary transition-transform duration-500 hover:scale-105"
                                style={{
                                    clipPath: 'polygon(50% 0%, 95% 35%, 80% 90%, 20% 90%, 5% 35%)',
                                    background: 'conic-gradient(from 0deg at 50% 50%, rgba(221,183,255,0.2), rgba(76,215,246,0.2), rgba(221,183,255,0.2))',
                                    border: '2px solid #ddb7ff',
                                }}
                            />
                            <span className="absolute top-0 font-label text-xs text-primary">Speed</span>
                            <span className="absolute bottom-4 right-0 font-label text-xs text-secondary">Risk</span>
                            <span className="absolute bottom-4 left-0 font-label text-xs text-tertiary">Accuracy</span>
                            <span className="absolute top-1/2 -right-6 font-label text-xs text-on-surface-variant">Defense</span>
                            <span className="absolute top-1/2 -left-6 font-label text-xs text-on-surface-variant">Adapt</span>
                            {/* Data points */}
                            <div className="absolute w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_#ddb7ff] top-[10%] left-[50%]" />
                            <div className="absolute w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_#4cd7f6] bottom-[25%] right-[20%]" />
                            <div className="absolute w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_#ffb0cd] bottom-[40%] left-[25%]" />
                        </div>
                        <div className="w-full space-y-2 mt-auto">
                            <div className="w-full">
                                <div className="flex justify-between font-label text-xs mb-1">
                                    <span className="text-on-surface-variant">Cognitive Load</span>
                                    <span className="text-primary">85%</span>
                                </div>
                                <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                                    <div className="h-full w-[85%] bg-gradient-to-r from-primary to-secondary rounded-full" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="md:col-span-12 flex flex-col sm:flex-row gap-4 justify-center items-center mt-8">
                        <button className="bg-primary text-on-primary font-label text-sm tracking-wider uppercase px-8 py-4 rounded-full neon-glow-primary hover:scale-105 hover:brightness-110 transition-all flex items-center gap-2">
                            📤 Share Stats
                        </button>
                        <Link
                            href="/"
                            className="glass-panel text-secondary border border-secondary font-label text-sm tracking-wider uppercase px-8 py-4 rounded-full hover:bg-secondary/10 hover:shadow-[0_0_15px_rgba(76,215,246,0.2)] transition-all flex items-center gap-2"
                        >
                            🏠 Back to Dashboard
                        </Link>
                    </div>
                </div>
            </main>
        </>
    );
}
