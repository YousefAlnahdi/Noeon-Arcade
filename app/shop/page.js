'use client';

import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const SHOP_THEMES = [
    {
        id: 'cyberpunk',
        name: 'Cyberpunk (Default)',
        price: 0,
        desc: 'The original neon violet and cyan aesthetic.',
        preview: 'from-[#ddb7ff] to-[#4cd7f6]'
    },
    {
        id: 'matrix',
        name: 'Digital Matrix',
        price: 50,
        desc: 'Retro green terminal vibes directly from the mainframe.',
        preview: 'from-[#00ff41] to-[#39ff14]'
    },
    {
        id: 'synthwave',
        name: 'Synthwave Sunset',
        price: 100,
        desc: 'Deep retro pink and orange hues from the cyber horizon.',
        preview: 'from-[#ff007f] to-[#f39c12]'
    },
    {
        id: 'minimalist',
        name: 'Monochrome Cyber',
        price: 150,
        desc: 'Ultra-clean black and white design with bright white accents.',
        preview: 'from-white to-[#888888]'
    }
];

const SHOP_PERSONAS = [
    {
        id: 'hacker',
        name: 'The Hacker',
        emoji: '🧑‍💻',
        price: 50,
        desc: 'A binary-coded AI opponent who mocks and praises in tech slang.',
    },
    {
        id: 'sage',
        name: 'The Sage',
        emoji: '🧘',
        price: 100,
        desc: 'A calm Zen master who responds in deep, cryptic riddles.',
    }
];

const SHOP_ITEMS = [
    {
        id: 'health_pack',
        name: 'Health Pack',
        emoji: '💚',
        price: 30,
        desc: 'Heals 35 HP on the Gridrunner battle grid. Press [H] during gameplay to consume. Single use.',
    }
];

export default function ShopPage() {
    const { user, playerProfile, refreshProfile } = useAuth();
    const [tokens, setTokens] = useState(0);
    const [unlockedItems, setUnlockedItems] = useState([]);
    const [activeTheme, setActiveTheme] = useState('cyberpunk');
    const [loading, setLoading] = useState(true);
    const [buyingId, setBuyingId] = useState(null);
    const [message, setMessage] = useState({ text: '', type: '' }); // type: 'success' | 'error'

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        // Fetch latest profile state directly
        const fetchLatestProfile = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('total_tokens, unlocked_items')
                .eq('id', user.id)
                .single();

            if (data) {
                setTokens(data.total_tokens ?? 0);
                setUnlockedItems(data.unlocked_items ?? []);
            }
            
            const currentTheme = localStorage.getItem('neon_arcade_theme') || 'cyberpunk';
            setActiveTheme(currentTheme);
            setLoading(false);
        };

        fetchLatestProfile();
    }, [user, playerProfile]);

    const handlePurchase = async (item, type) => {
        if (!user) return;
        const itemId = `${type}:${item.id}`;
        
        if (tokens < item.price) {
            setMessage({ text: 'Insufficient tokens. Keep playing games to earn more!', type: 'error' });
            return;
        }

        setBuyingId(item.id);
        setMessage({ text: '', type: '' });

        try {
            const updatedTokens = tokens - item.price;
            const updatedUnlocked = [...unlockedItems, itemId];

            const { error } = await supabase
                .from('profiles')
                .update({
                    total_tokens: updatedTokens,
                    unlocked_items: updatedUnlocked
                })
                .eq('id', user.id);

            if (error) throw error;

            setTokens(updatedTokens);
            setUnlockedItems(updatedUnlocked);
            const actionText = type === 'item' ? 'bought' : 'unlocked';
            setMessage({ text: `Successfully ${actionText} ${item.name}!`, type: 'success' });
            
            // Sync with global auth state immediately
            if (refreshProfile) {
                await refreshProfile();
            }

            // Force reload window profile values if necessary (or rely on state)
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('storage'));
            }
        } catch (err) {
            console.error('Purchase error:', err);
            setMessage({ text: 'Failed to complete transaction. Please try again.', type: 'error' });
        } finally {
            setBuyingId(null);
        }
    };


    const handleApplyTheme = (themeId) => {
        localStorage.setItem('neon_arcade_theme', themeId);
        setActiveTheme(themeId);
        document.documentElement.setAttribute('data-theme', themeId);
        setMessage({ text: `Applied theme: ${SHOP_THEMES.find(t => t.id === themeId)?.name}`, type: 'success' });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center font-display text-primary animate-pulse">
                <span className="text-4xl mb-4">🛒</span>
                <p className="tracking-widest">LOADING ARCADE TERMINAL SHOP...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <>
                <Navbar />
                <div className="min-h-[calc(100vh-88px)] flex flex-col items-center justify-center text-center p-6 mt-[88px]">
                    <span className="text-6xl mb-6 opacity-50">🔒</span>
                    <h2 className="font-display text-3xl font-bold text-on-surface mb-2">Restricted Access</h2>
                    <p className="font-body text-on-surface-variant max-w-md mx-auto mb-8">
                        Connect your Neural Link to access the Token Shop and trade your points for customization upgrades.
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
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent blur-3xl -z-10" />
                    <h1 className="font-display text-4xl md:text-5xl font-extrabold text-white neon-text-primary mb-4 tracking-tight">
                        Token Customization Shop
                    </h1>
                    <p className="font-body text-base text-on-surface-variant max-w-xl mx-auto">
                        Spend your hard-earned arcade tokens to personalize your dashboard style and unlock special AI opponents.
                    </p>
                    
                    {/* Token Balance Indicator */}
                    <div className="mt-8 inline-flex items-center gap-3 bg-secondary/15 border border-secondary/40 px-6 py-3 rounded-full text-secondary font-display text-lg font-bold shadow-[0_0_20px_rgba(76,215,246,0.2)]">
                        <span className="text-2xl animate-spin-slow">⬡</span>
                        <span>{tokens} TOKENS AVAILABLE</span>
                    </div>
                </header>

                {/* Notifications */}
                {message.text && (
                    <div className={`max-w-md mx-auto w-full p-4 rounded-xl text-sm font-semibold border text-center animate-fade-in ${
                        message.type === 'success' 
                            ? 'bg-neon-green/10 border-neon-green/30 text-neon-green shadow-[0_0_15px_rgba(57,255,20,0.15)]' 
                            : 'bg-error/15 border-error/30 text-error shadow-[0_0_15px_rgba(255,180,171,0.15)]'
                    }`}>
                        {message.text}
                    </div>
                )}

                {/* Shop Grid Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mt-4">
                    {/* Themes section */}
                    <section className="lg:col-span-8 space-y-6">
                        <h2 className="font-display text-2xl font-bold text-on-surface border-b border-white/10 pb-3">
                            🎨 Display Themes
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {SHOP_THEMES.map((theme) => {
                                const isUnlocked = theme.price === 0 || unlockedItems.includes(`theme:${theme.id}`);
                                const isActive = activeTheme === theme.id;
                                
                                return (
                                    <div 
                                        key={theme.id} 
                                        className={`glass-panel rounded-2xl p-6 flex flex-col justify-between border-t-2 relative overflow-hidden transition-all ${
                                            isActive 
                                                ? 'border-t-primary shadow-[0_0_20px_rgba(221,183,255,0.25)]' 
                                                : 'border-t-transparent'
                                        }`}
                                    >
                                        {/* Gradient previews */}
                                        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${theme.preview} opacity-10 rounded-bl-full`} />
                                        
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-display text-lg font-bold text-white">{theme.name}</h3>
                                                {isActive && (
                                                    <span className="bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            <p className="font-body text-xs text-on-surface-variant mb-6 min-h-[32px] leading-relaxed">
                                                {theme.desc}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between mt-auto">
                                            {isUnlocked ? (
                                                <button
                                                    onClick={() => handleApplyTheme(theme.id)}
                                                    disabled={isActive}
                                                    className={`px-4 py-2 rounded-xl font-label text-xs tracking-wider uppercase font-semibold transition-all ${
                                                        isActive 
                                                            ? 'bg-white/5 text-on-surface-variant border border-white/10 cursor-not-allowed'
                                                            : 'bg-primary text-on-primary hover:brightness-110 shadow-lg'
                                                    }`}
                                                >
                                                    {isActive ? 'Applied' : 'Use Theme'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handlePurchase(theme, 'theme')}
                                                    disabled={buyingId === theme.id}
                                                    className="bg-surface-container-high hover:bg-surface-container-highest border border-white/10 px-4 py-2 rounded-xl font-label text-xs tracking-wider uppercase text-secondary font-semibold transition-colors flex items-center gap-1.5"
                                                >
                                                    {buyingId === theme.id ? 'Processing...' : (
                                                        <>
                                                            <span>⬡</span>
                                                            Unlock — {theme.price} Tkn
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                            
                                            {!isUnlocked && (
                                                <span className="font-display text-sm font-bold text-outline">
                                                    {theme.price}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* Personas section */}
                    <aside className="lg:col-span-4 space-y-6">
                        <div className="glass-panel rounded-2xl p-6 border border-white/5">
                            <h2 className="font-display text-xl font-bold text-on-surface border-b border-white/10 pb-3 mb-6">
                                🧠 AI Personas
                            </h2>
                            
                            <div className="flex flex-col gap-6">
                                {SHOP_PERSONAS.map((persona) => {
                                    const isUnlocked = unlockedItems.includes(`persona:${persona.id}`);
                                    
                                    return (
                                        <div 
                                            key={persona.id} 
                                            className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-4 border border-white/5 relative"
                                        >
                                            <div className="flex gap-3 items-start">
                                                <div className="w-10 h-10 rounded-lg bg-surface-container-high border border-white/10 flex items-center justify-center text-xl shadow-inner shrink-0">
                                                    {persona.emoji}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-display text-sm font-bold text-white">{persona.name}</h3>
                                                        {isUnlocked && (
                                                            <span className="text-[9px] bg-neon-green/20 text-neon-green border border-neon-green/30 px-1.5 py-0.5 rounded font-bold uppercase">
                                                                Unlocked
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="font-body text-[11px] text-on-surface-variant leading-relaxed mt-1">
                                                        {persona.desc}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1">
                                                {isUnlocked ? (
                                                    <span className="font-label text-[10px] text-on-surface-variant tracking-wider uppercase font-semibold">
                                                        Available in Tic-Tac-Toe
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => handlePurchase(persona, 'persona')}
                                                        disabled={buyingId === persona.id || tokens < persona.price}
                                                        className="w-full bg-secondary text-on-secondary hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100 px-3 py-2 rounded-lg font-label text-[11px] tracking-wider uppercase font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                                    >
                                                        {buyingId === persona.id ? 'Processing...' : (
                                                            <>
                                                                <span>⬡</span>
                                                                Unlock — {persona.price} Tkn
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="glass-panel rounded-2xl p-6 border border-white/5">
                            <h2 className="font-display text-xl font-bold text-on-surface border-b border-white/10 pb-3 mb-6">
                                🧪 Consumables
                            </h2>
                            
                            <div className="flex flex-col gap-6">
                                {SHOP_ITEMS.map((item) => {
                                    const count = unlockedItems.filter(x => x === `item:${item.id}`).length;
                                    
                                    return (
                                        <div 
                                            key={item.id} 
                                            className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-4 border border-white/5 relative"
                                        >
                                            <div className="flex gap-3 items-start">
                                                <div className="w-10 h-10 rounded-lg bg-surface-container-high border border-white/10 flex items-center justify-center text-xl shadow-inner shrink-0">
                                                    {item.emoji}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="font-display text-sm font-bold text-white">{item.name}</h3>
                                                        <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded font-bold uppercase">
                                                            Qty: {count}
                                                        </span>
                                                    </div>
                                                    <p className="font-body text-[11px] text-on-surface-variant leading-relaxed mt-1">
                                                        {item.desc}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1">
                                                <button
                                                    onClick={() => handlePurchase(item, 'item')}
                                                    disabled={buyingId === item.id || tokens < item.price}
                                                    className="w-full bg-primary text-on-primary hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100 px-3 py-2 rounded-lg font-label text-[11px] tracking-wider uppercase font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                                >
                                                    {buyingId === item.id ? 'Processing...' : (
                                                        <>
                                                            <span>⬡</span>
                                                            Buy — {item.price} Tkn
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>
                </div>
            </main>
        </>
    );
}
