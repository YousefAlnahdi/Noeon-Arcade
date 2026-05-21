'use client';

import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const { user, playerProfile } = useAuth();
  const [recentGames, setRecentGames] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoadingLogs(false);
      return;
    }

    const fetchRecentGames = async () => {
      try {
        const { data, error } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);
        if (data) {
          setRecentGames(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingLogs(false);
      }
    };

    fetchRecentGames();
  }, [user]);

  return (
    <>
      <Navbar />
      <main className="pt-[100px] pb-16 px-4 md:px-12 max-w-[1440px] mx-auto min-h-screen flex flex-col gap-16">
        {/* Hero Section */}
        <header className="text-center py-16 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent blur-3xl -z-10" />
          <h1 className="font-display text-5xl md:text-7xl font-extrabold text-white neon-text-primary mb-6 tracking-tight">
            Welcome to the Neural Arcade.
          </h1>
          <p className="font-body text-lg text-on-surface-variant max-w-2xl mx-auto mb-10">
            Experience classic games supercharged by advanced AI. Train your mind, test your reflexes, and dominate the global leaderboard.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/tictactoe"
              className="bg-primary text-on-primary font-label text-sm tracking-wider uppercase px-6 py-3 rounded-2xl neon-glow-primary neon-glow-primary-hover flex items-center gap-2 font-semibold"
            >
              <span className="text-lg">▶</span>
              START PLAYING
            </Link>
            <Link
              href="/shop"
              className="glass-panel text-tertiary font-label text-sm tracking-wider uppercase px-6 py-3 rounded-2xl hover:bg-tertiary/10 transition-colors flex items-center gap-2 font-semibold"
            >
              <span className="text-lg">🛒</span>
              TOKEN SHOP
            </Link>
            <Link
              href="/stats"
              className="glass-panel text-secondary font-label text-sm tracking-wider uppercase px-6 py-3 rounded-2xl hover:bg-secondary/10 transition-colors flex items-center gap-2 font-semibold"
            >
              <span className="text-lg">📊</span>
              VIEW RANKS
            </Link>
          </div>
        </header>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Game Cards Section */}
          <section className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex justify-between items-end mb-2">
              <h2 className="font-display text-3xl font-bold text-on-surface">Featured Games</h2>
              <span className="font-label text-xs text-primary tracking-[0.2em] uppercase">Select Mode</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Tic-Tac-Toe Card */}
              <Link href="/tictactoe">
                <article className="relative h-[320px] rounded-2xl overflow-hidden group cursor-pointer neon-glow-primary-hover glass-panel">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary-container/10 to-surface-container-lowest transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-30 transition-opacity">
                    <span className="font-display text-[120px] font-extrabold text-primary">XO</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-low/80 to-transparent" />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className="bg-primary/20 text-primary border border-primary/30 px-2 py-1 rounded-full font-label text-[10px] tracking-wider uppercase">
                      Strategic Mind Games
                    </span>
                  </div>
                  <div className="absolute bottom-0 w-full p-6 glass-panel !border-t-white/10 !border-b-0 !border-l-0 !border-r-0 rounded-b-2xl">
                    <h3 className="font-display text-2xl font-bold text-white mb-1 group-hover:text-primary transition-colors">
                      Tic-Tac-Toe (XO)
                    </h3>
                    <p className="font-body text-sm text-on-surface-variant mb-3">
                      Master the classic with adaptive AI opponents.
                    </p>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 bg-surface-container-high/50 px-2 py-1 rounded text-xs font-label text-secondary">
                        🤖 Persona AI
                      </div>
                      <div className="flex items-center gap-1 bg-surface-container-high/50 px-2 py-1 rounded text-xs font-label text-tertiary">
                        🧠 Strategy Coach
                      </div>
                    </div>
                  </div>
                </article>
              </Link>

              {/* Snake Card */}
              <Link href="/snake">
                <article className="relative h-[320px] rounded-2xl overflow-hidden group cursor-pointer neon-glow-primary-hover glass-panel">
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 via-secondary-container/10 to-surface-container-lowest transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-30 transition-opacity">
                    <span className="font-display text-[100px] font-extrabold text-secondary">🐍</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-low/80 to-transparent" />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className="bg-secondary/20 text-secondary border border-secondary/30 px-2 py-1 rounded-full font-label text-[10px] tracking-wider uppercase pulse-badge">
                      Reflex & Adaptability
                    </span>
                  </div>
                  <div className="absolute bottom-0 w-full p-6 glass-panel !border-t-white/10 !border-b-0 !border-l-0 !border-r-0 rounded-b-2xl">
                    <h3 className="font-display text-2xl font-bold text-white mb-1 group-hover:text-secondary transition-colors">
                      Neural Snake
                    </h3>
                    <p className="font-body text-sm text-on-surface-variant mb-3">
                      Survive against evolving, intelligent rival snakes.
                    </p>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 bg-surface-container-high/50 px-2 py-1 rounded text-xs font-label text-primary">
                        🎮 Dynamic GM
                      </div>
                      <div className="flex items-center gap-1 bg-surface-container-high/50 px-2 py-1 rounded text-xs font-label text-error">
                        ⚠ Rival Agent
                      </div>
                    </div>
                  </div>
                </article>
              </Link>

              {/* Quiz Card */}
              <Link href="/quiz">
                <article className="relative h-[320px] rounded-2xl overflow-hidden group cursor-pointer neon-glow-primary-hover glass-panel">
                  <div className="absolute inset-0 bg-gradient-to-br from-neon-green/15 via-neon-green/5 to-surface-container-lowest transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-15 group-hover:opacity-25 transition-opacity">
                    <span className="font-mono text-[80px] font-extrabold text-neon-green">?!</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-low/80 to-transparent" />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className="bg-neon-green/15 text-neon-green border border-neon-green/30 px-2 py-1 rounded-full font-label text-[10px] tracking-wider uppercase pulse-badge">
                      Knowledge & Speed
                    </span>
                  </div>
                  <div className="absolute bottom-0 w-full p-6 glass-panel !border-t-white/10 !border-b-0 !border-l-0 !border-r-0 rounded-b-2xl">
                    <h3 className="font-display text-2xl font-bold text-white mb-1 group-hover:text-neon-green transition-colors">
                      Neural Quiz
                    </h3>
                    <p className="font-body text-sm text-on-surface-variant mb-3">
                      AI-generated trivia with adaptive difficulty.
                    </p>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 bg-surface-container-high/50 px-2 py-1 rounded text-xs font-label text-neon-green">
                        🧠 AI Questions
                      </div>
                      <div className="flex items-center gap-1 bg-surface-container-high/50 px-2 py-1 rounded text-xs font-label text-amber-400">
                        ⚡ Adaptive
                      </div>
                    </div>
                  </div>
                </article>
              </Link>

              {/* Adventure Card */}
              <Link href="/adventure">
                <article className="relative h-[320px] rounded-2xl overflow-hidden group cursor-pointer neon-glow-primary-hover glass-panel">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-surface-container-lowest transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-15 group-hover:opacity-25 transition-opacity">
                    <span className="font-mono text-[80px] font-extrabold text-amber-400">{'>_'}</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-low/80 to-transparent" />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-1 rounded-full font-label text-[10px] tracking-wider uppercase pulse-badge">
                      Story & Choices
                    </span>
                  </div>
                  <div className="absolute bottom-0 w-full p-6 glass-panel !border-t-white/10 !border-b-0 !border-l-0 !border-r-0 rounded-b-2xl">
                    <h3 className="font-display text-2xl font-bold text-white mb-1 group-hover:text-amber-400 transition-colors">
                      Beyond the CRT
                    </h3>
                    <p className="font-body text-sm text-on-surface-variant mb-3">
                      AI-driven text RPG on a retro CRT terminal.
                    </p>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 bg-surface-container-high/50 px-2 py-1 rounded text-xs font-label text-amber-400">
                        📜 Dynamic Story
                      </div>
                      <div className="flex items-center gap-1 bg-surface-container-high/50 px-2 py-1 rounded text-xs font-label text-neon-green">
                        ❤️ HP System
                      </div>
                    </div>
                  </div>
                </article>
              </Link>

              {/* Gridrunner Card */}
              <Link href="/gridrunner">
                <article className="relative h-[320px] rounded-2xl overflow-hidden group cursor-pointer neon-glow-primary-hover glass-panel">
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 via-secondary-container/10 to-surface-container-lowest transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-15 group-hover:opacity-25 transition-opacity">
                    <span className="font-display text-[100px] font-extrabold text-secondary">🚀</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-low/80 to-transparent" />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className="bg-secondary/20 text-secondary border border-secondary/30 px-2 py-1 rounded-full font-label text-[10px] tracking-wider uppercase pulse-badge">
                      Action & AI Combat
                    </span>
                  </div>
                  <div className="absolute bottom-0 w-full p-6 glass-panel !border-t-white/10 !border-b-0 !border-l-0 !border-r-0 rounded-b-2xl">
                    <h3 className="font-display text-2xl font-bold text-white mb-1 group-hover:text-secondary transition-colors">
                      Neon Gridrunner
                    </h3>
                    <p className="font-body text-sm text-on-surface-variant mb-3">
                      Blast retro aliens with an AI-compiled weapon mainframe.
                    </p>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 bg-surface-container-high/50 px-2 py-1 rounded text-xs font-label text-secondary">
                        ⚡ AI Weapons
                      </div>
                      <div className="flex items-center gap-1 bg-surface-container-high/50 px-2 py-1 rounded text-xs font-label text-error">
                        👾 Boss Fights
                      </div>
                    </div>
                  </div>
                </article>
              </Link>

              {/* Neon City Border Card */}
              <Link href="/neon-city-border">
                <article className="relative h-[320px] rounded-2xl overflow-hidden group cursor-pointer neon-glow-primary-hover glass-panel">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-surface-container-lowest transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-15 group-hover:opacity-25 transition-opacity">
                    <span className="font-display text-[100px] font-extrabold text-amber-500">🚧</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-low/80 to-transparent" />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-1 rounded-full font-label text-[10px] tracking-wider uppercase pulse-badge">
                      Interrogation & AI RPG
                    </span>
                  </div>
                  <div className="absolute bottom-0 w-full p-6 glass-panel !border-t-white/10 !border-b-0 !border-l-0 !border-r-0 rounded-b-2xl">
                    <h3 className="font-display text-2xl font-bold text-white mb-1 group-hover:text-amber-400 transition-colors">
                      Neon City Border
                    </h3>
                    <p className="font-body text-sm text-on-surface-variant mb-3">
                      Interrogate travelers, detect contradictions, and guard the gateway using neural diagnostics.
                    </p>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 bg-surface-container-high/50 px-2 py-1 rounded text-xs font-label text-amber-400">
                        🔍 AI Roleplay
                      </div>
                      <div className="flex items-center gap-1 bg-surface-container-high/50 px-2 py-1 rounded text-xs font-label text-neon-green">
                        🔬 Bio-Scanner
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            </div>
          </section>

          {/* Terminal Uplink Sidebar */}
          <aside className="lg:col-span-4 flex flex-col gap-6">
            <div className="flex justify-between items-end mb-2">
              <h2 className="font-display text-xl font-semibold text-on-surface">Terminal Uplink</h2>
            </div>
            <div className="glass-panel rounded-2xl p-6 h-full flex flex-col gap-6 relative overflow-hidden">
              {/* Decorative corners */}
              <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-primary/30 rounded-tr-2xl opacity-50" />
              <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-secondary/30 rounded-bl-2xl opacity-50" />

              {/* Rank */}
              <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center border border-primary/50 neon-glow-primary">
                  <span className="text-primary text-xl">🏅</span>
                </div>
                <div>
                  <div className="font-label text-xs text-on-surface-variant uppercase tracking-wider">Current Rank</div>
                  <div className="font-display text-lg font-semibold text-white">
                    {user ? (playerProfile?.rank || 'Rookie') : 'Offline'}
                  </div>
                </div>
              </div>

              {/* Token Balance */}
              <Link href="/shop" className="bg-surface-container/50 rounded-xl p-4 border border-white/5 flex justify-between items-center group hover:border-secondary/30 transition-colors">
                <div>
                  <div className="font-label text-xs text-on-surface-variant mb-1 uppercase tracking-wider">Total Tokens</div>
                  <div className="font-display text-3xl font-bold text-secondary">
                    {user ? (playerProfile?.total_tokens ?? 0) : '—'}
                  </div>
                </div>
                <span className="text-secondary opacity-50 group-hover:opacity-100 transition-opacity text-4xl">⬡</span>
              </Link>

              {/* Recent Logs */}
              <div className="flex-grow flex flex-col gap-3">
                <div className="font-label text-xs text-on-surface-variant uppercase tracking-[0.2em] mt-2">Recent Logs</div>

                {!user ? (
                  <div className="flex flex-col gap-2 flex-grow justify-center items-center text-center py-6">
                    <span className="text-3xl opacity-30">🔒</span>
                    <p className="font-body text-xs text-on-surface-variant opacity-60 mb-2">
                      Neural Link Offline.<br />Connect to upload game session logs.
                    </p>
                    <Link href="/login" className="px-4 py-2 bg-primary/20 text-primary border border-primary/30 rounded-full font-label text-[10px] tracking-wider uppercase hover:bg-primary/30 transition-colors">
                      CONNECT LINK
                    </Link>
                  </div>
                ) : loadingLogs ? (
                  <div className="flex-grow flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  </div>
                ) : recentGames.length === 0 ? (
                  <div className="flex flex-col gap-2 flex-grow justify-center items-center text-center py-8">
                    <span className="text-3xl opacity-30">🎮</span>
                    <p className="font-body text-sm text-on-surface-variant opacity-60">
                      No games played yet.<br />Start playing to see your logs!
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 mt-1">
                    {recentGames.map((game) => (
                      <div key={game.id} className="p-3 bg-surface-container-low/50 rounded-xl border border-white/5 flex items-center justify-between text-xs hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">
                            {game.game_type === 'tictactoe' ? '❌' : game.game_type === 'quiz' ? '🧠' : game.game_type === 'adventure' ? '📜' : game.game_type === 'gridrunner' ? '🚀' : game.game_type === 'border' ? '🚧' : '🐍'}
                          </span>
                          <div>
                            <p className="font-display font-medium text-white capitalize text-xs">
                              {game.game_type === 'tictactoe' ? 'Tic-Tac-Toe' : game.game_type === 'quiz' ? 'Neural Quiz' : game.game_type === 'adventure' ? 'Beyond the CRT' : game.game_type === 'gridrunner' ? 'Neon Gridrunner' : game.game_type === 'border' ? 'Neon City Border' : 'Neural Snake'}
                            </p>
                            <p className="font-body text-[10px] text-on-surface-variant">
                              {new Date(game.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`font-label text-[10px] uppercase font-bold tracking-wider ${
                            game.result === 'win' ? 'text-neon-green' : game.result === 'loss' ? 'text-error' : 'text-outline'
                          }`}>
                            {game.result}
                          </span>
                          <p className="font-body text-[10px] text-on-surface-variant">{game.score} pts</p>
                        </div>
                      </div>
                    ))}
                    <Link href="/stats" className="text-center font-label text-[10px] text-primary/80 hover:text-primary tracking-widest uppercase mt-2 transition-colors">
                      VIEW FULL HISTORY →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 px-6 flex justify-between items-center bg-surface-container-lowest border-t border-white/5 relative z-10">
        <span className="font-display text-xs text-on-surface-variant opacity-80">© 2025 NEON ARCADE SYSTEMS</span>
        <div className="flex gap-4">
          <a href="#" className="font-label text-xs text-on-surface-variant hover:text-secondary opacity-80 hover:opacity-100 transition-colors tracking-wider">Privacy</a>
          <a href="#" className="font-label text-xs text-on-surface-variant hover:text-secondary opacity-80 hover:opacity-100 transition-colors tracking-wider">Terms</a>
          <a href="#" className="font-label text-xs text-on-surface-variant hover:text-secondary opacity-80 hover:opacity-100 transition-colors tracking-wider">Support</a>
        </div>
      </footer>
    </>
  );
}
