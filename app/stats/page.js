'use client';

import Navbar from '@/components/Navbar';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';

export default function StatsPage() {
    const { user, playerProfile } = useAuth();
    const [stats, setStats] = useState({
        overall: { total: 0, wins: 0, losses: 0, winRate: 0 },
        tictactoe: { games: 0, wins: 0, draws: 0 },
        snake: { games: 0, highScore: 0, wins: 0 }
    });
    const [recentGames, setRecentGames] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const fetchStats = async () => {
            try {
                // Fetch player stats view
                const { data: statsData } = await supabase
                    .from('player_stats')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                // Fetch recent games
                const { data: gamesData } = await supabase
                    .from('game_sessions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (statsData) {
                    setStats({
                        overall: {
                            total: statsData.total_games,
                            wins: statsData.total_wins,
                            losses: statsData.total_losses,
                            winRate: statsData.total_games > 0
                                ? Math.round((statsData.total_wins / statsData.total_games) * 100)
                                : 0
                        },
                        tictactoe: {
                            games: statsData.xo_games,
                            wins: statsData.xo_wins,
                            draws: statsData.xo_draws
                        },
                        snake: {
                            games: statsData.snake_games,
                            highScore: statsData.snake_high_score,
                            wins: statsData.snake_wins
                        }
                    });
                }

                if (gamesData) {
                    setRecentGames(gamesData);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [user]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center font-display text-primary animate-pulse">
                <span className="text-4xl mb-4">🧠</span>
                <p className="tracking-widest">LOADING NEURAL LINK...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <>
                <Navbar />
                <div className="min-h-[calc(100vh-88px)] flex flex-col items-center justify-center text-center p-6 mt-[88px]">
                    <span className="text-6xl mb-6 opacity-50">🔒</span>
                    <h2 className="font-display text-3xl font-bold text-on-surface mb-2">Restricted Area</h2>
                    <p className="font-body text-on-surface-variant max-w-md mx-auto mb-8">
                        You must establish a Neural Link (Login) before you can view your player statistics.
                    </p>
                    <Link href="/login" className="px-8 py-3 bg-primary text-on-primary font-label text-sm tracking-wider uppercase rounded-xl neon-glow-primary hover:brightness-110 transition-all">
                        Initiate Login Sequence
                    </Link>
                </div>
            </>
        );
    }
    return (
        <>
            <Navbar />
            <main className="pt-[100px] pb-16 px-4 md:px-12 max-w-[1440px] mx-auto min-h-screen flex flex-col gap-10">
                {/* Header */}
                <header className="text-center py-10 relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-secondary/10 to-transparent blur-3xl -z-10" />
                    <h1 className="font-display text-4xl md:text-5xl font-extrabold text-white neon-text-secondary mb-4 tracking-tight">
                        {playerProfile?.username || 'Player'} Statistics
                    </h1>
                    <p className="font-body text-base text-on-surface-variant max-w-xl mx-auto">
                        Your arcade journey at a glance. Wins, losses, and everything in between.
                    </p>
                </header>

                {/* Stats Overview Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Games', value: stats.overall.total, color: 'text-on-surface', icon: '🎮' },
                        { label: 'Wins', value: stats.overall.wins, color: 'text-neon-green', icon: '🏆' },
                        { label: 'Losses', value: stats.overall.losses, color: 'text-error', icon: '💀' },
                        { label: 'Win Rate', value: `${stats.overall.winRate}%`, color: 'text-primary', icon: '📈' },
                    ].map((stat) => (
                        <div key={stat.label} className="glass-panel rounded-2xl p-6 text-center relative overflow-hidden group hover:scale-[1.02] transition-transform">
                            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="text-2xl mb-2 block">{stat.icon}</span>
                            <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider mb-1">{stat.label}</p>
                            <p className={`font-display text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Game-Specific Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Tic-Tac-Toe Stats */}
                    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary-container" />
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 text-lg">
                                ❌
                            </div>
                            <div>
                                <h3 className="font-display text-lg font-semibold text-on-surface">Tic-Tac-Toe</h3>
                                <p className="font-body text-xs text-on-surface-variant">Strategic Mind Games</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                                <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider">Games</p>
                                <p className="font-display text-2xl font-bold text-on-surface">{stats.tictactoe.games}</p>
                            </div>
                            <div>
                                <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider">Wins</p>
                                <p className="font-display text-2xl font-bold text-neon-green">{stats.tictactoe.wins}</p>
                            </div>
                            <div>
                                <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider">Draws</p>
                                <p className="font-display text-2xl font-bold text-outline">{stats.tictactoe.draws}</p>
                            </div>
                        </div>
                        <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${stats.tictactoe.games > 0 ? (stats.tictactoe.wins / stats.tictactoe.games) * 100 : 0}%` }} />
                        </div>
                        <p className="font-body text-xs text-on-surface-variant mt-2">{stats.tictactoe.games > 0 ? Math.round((stats.tictactoe.wins / stats.tictactoe.games) * 100) : 0}% win rate</p>
                    </div>

                    {/* Snake Stats */}
                    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary to-secondary-container" />
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center border border-secondary/30 text-lg">
                                🐍
                            </div>
                            <div>
                                <h3 className="font-display text-lg font-semibold text-on-surface">Neural Snake</h3>
                                <p className="font-body text-xs text-on-surface-variant">Reflex & Adaptability</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                                <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider">Games</p>
                                <p className="font-display text-2xl font-bold text-on-surface">{stats.snake.games}</p>
                            </div>
                            <div>
                                <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider">High Score</p>
                                <p className="font-display text-2xl font-bold text-secondary">{stats.snake.highScore}</p>
                            </div>
                            <div>
                                <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider">Wins</p>
                                <p className="font-display text-2xl font-bold text-neon-green">{stats.snake.wins}</p>
                            </div>
                        </div>
                        <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                            <div className="h-full bg-secondary rounded-full transition-all duration-1000" style={{ width: `${stats.snake.games > 0 ? (stats.snake.highScore / 500) * 100 : 0}%` }} />
                        </div>
                        <p className="font-body text-xs text-on-surface-variant mt-2">Target High Score Progress</p>
                    </div>
                </div>

                {/* Recent Games */}
                <div className="glass-panel rounded-2xl p-6">
                    <h3 className="font-display text-xl font-semibold text-on-surface mb-6 flex items-center gap-2">
                        <span>📜</span> Recent Games
                    </h3>

                    {recentGames.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <span className="text-4xl opacity-30 mb-4">🎮</span>
                            <p className="font-body text-sm text-on-surface-variant opacity-60 mb-4">
                                No games played yet. Start your journey!
                            </p>
                            <Link href="/" className="px-6 py-2 bg-primary/20 text-primary border border-primary/30 rounded-full font-label text-xs tracking-wider uppercase hover:bg-primary/30 transition-colors">
                                PLAY NOW
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {recentGames.map((game) => (
                                <div key={game.id} className="flex flex-col gap-3 p-4 bg-surface-container-low rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-surface-container-high border
                                                ${game.game_type === 'tictactoe' ? 'border-primary/20 text-primary' : 'border-secondary/20 text-secondary'}
                                            `}>
                                                {game.game_type === 'tictactoe' ? '❌' : '🐍'}
                                            </div>
                                            <div>
                                                <p className="font-display font-semibold text-on-surface capitalize">
                                                    {game.game_type === 'tictactoe' ? `Tic-Tac-Toe (${game.game_mode})` : `Neural Snake (${game.game_mode})`}
                                                </p>
                                                <p className="font-body text-xs text-on-surface-variant">
                                                    {new Date(game.created_at).toLocaleDateString()} at {new Date(game.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-label text-sm uppercase tracking-wider font-bold ${game.result === 'win' ? 'text-neon-green' :
                                                game.result === 'loss' ? 'text-error' :
                                                    'text-outline'
                                                }`}>
                                                {game.result}
                                            </p>
                                            <p className="font-body text-xs text-on-surface-variant mt-1">{game.score} pts</p>
                                        </div>
                                    </div>
                                    {game.ai_analysis && (
                                        <div className="mt-1 bg-surface-container-highest/60 border border-white/5 p-3 rounded-lg flex gap-2.5 items-start">
                                            <span className="text-base shrink-0 select-none">🤖</span>
                                            <p className="font-body text-xs text-on-surface-variant leading-relaxed">
                                                <span className="font-label text-[10px] text-primary uppercase tracking-widest block mb-0.5 font-semibold">AI Critique Summary</span>
                                                {game.ai_analysis}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
