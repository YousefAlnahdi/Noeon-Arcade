'use client';

import Navbar from '@/components/Navbar';

export default function AboutPage() {
    const features = [
        {
            icon: '😈',
            title: 'Persona Opponent',
            description: 'Play Tic-Tac-Toe against AI with personality — trash-talkers, cheerleaders, and jokers who react to every move.',
            color: 'text-error',
            borderColor: 'border-error/30',
        },
        {
            icon: '🧠',
            title: 'Strategy Coach',
            description: 'Get real-time AI-powered hints explaining the best move and the strategic reasoning behind it.',
            color: 'text-primary',
            borderColor: 'border-primary/30',
        },
        {
            icon: '🎮',
            title: 'Dynamic Game Master',
            description: 'An AI director watches your Snake gameplay and adjusts difficulty in real-time — spawning obstacles or shields.',
            color: 'text-tertiary',
            borderColor: 'border-tertiary/30',
        },
        {
            icon: '🐍',
            title: 'Rival Snake Agent',
            description: 'Compete against an A*-powered rival snake that pathfinds toward food while avoiding you.',
            color: 'text-secondary',
            borderColor: 'border-secondary/30',
        },
        {
            icon: '📊',
            title: 'Performance Analyst',
            description: 'After every game, an LLM analyzes your telemetry and generates a witty, personalized playstyle report.',
            color: 'text-neon-green',
            borderColor: 'border-neon-green/30',
        },
    ];

    return (
        <>
            <Navbar />
            <main className="pt-[100px] pb-16 px-4 md:px-12 max-w-[1024px] mx-auto min-h-screen flex flex-col gap-12">
                <header className="text-center py-10 relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-tertiary/10 to-transparent blur-3xl -z-10" />
                    <h1 className="font-display text-4xl md:text-5xl font-extrabold text-white neon-text-tertiary mb-4 tracking-tight">
                        About Neon Arcade
                    </h1>
                    <p className="font-body text-base text-on-surface-variant max-w-xl mx-auto">
                        A retro-futuristic gaming platform where classic games meet cutting-edge AI.
                    </p>
                </header>

                <section className="glass-panel rounded-2xl p-8">
                    <h2 className="font-display text-2xl font-bold text-on-surface mb-4">The Concept</h2>
                    <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                        Neon Arcade is a browser-based gaming platform delivering two classic games — <strong className="text-primary">Tic-Tac-Toe</strong> and <strong className="text-secondary">Snake</strong> —
                        augmented with five distinct AI Agent features. The AI agents range from deterministic algorithms
                        (Minimax, A* Pathfinding) to LLM-powered agents (persona opponents, strategy coaches,
                        post-game analysts) built on the DeepSeek API.
                    </p>
                </section>

                <section>
                    <h2 className="font-display text-2xl font-bold text-on-surface mb-6 text-center">5 AI Features</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {features.map((f) => (
                            <div key={f.title} className={`glass-panel rounded-2xl p-6 border-l-4 ${f.borderColor} hover:scale-[1.02] transition-transform`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-2xl">{f.icon}</span>
                                    <h3 className={`font-display text-lg font-semibold ${f.color}`}>{f.title}</h3>
                                </div>
                                <p className="font-body text-sm text-on-surface-variant">{f.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="glass-panel rounded-2xl p-8">
                    <h2 className="font-display text-2xl font-bold text-on-surface mb-4">Tech Stack</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Framework', value: 'Next.js' },
                            { label: 'Styling', value: 'Tailwind CSS' },
                            { label: 'State', value: 'Zustand' },
                            { label: 'Database', value: 'Supabase' },
                            { label: 'AI (Logic)', value: 'Minimax / A*' },
                            { label: 'AI (Text)', value: 'DeepSeek' },
                            { label: 'Auth', value: 'Supabase Auth' },
                            { label: 'Game', value: 'HTML5 Canvas' },
                        ].map((t) => (
                            <div key={t.label} className="bg-surface-container/50 rounded-xl p-3 border border-white/5">
                                <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider">{t.label}</p>
                                <p className="font-display text-sm font-semibold text-on-surface">{t.value}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </>
    );
}
