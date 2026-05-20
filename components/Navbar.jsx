'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function Navbar() {
    const pathname = usePathname();
    const { user, playerProfile, signOut } = useAuth();

    const isAuthPage = pathname === '/login' || pathname === '/register';
    if (isAuthPage) return null;

    const navLinks = [
        { href: '/', label: 'Arcade Home' },
        { href: '/stats', label: 'My Stats' },
        { href: '/shop', label: 'Token Shop' },
        { href: '/about', label: 'About' },
    ];

    return (
        <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-4 bg-surface/80 backdrop-blur-xl border-b border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-6">
                <Link href="/" className="font-display text-3xl md:text-4xl font-extrabold text-primary drop-shadow-[0_0_10px_rgba(221,183,255,0.5)] tracking-tight">
                    NEON ARCADE
                </Link>
                <div className="hidden md:flex gap-3 ml-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`font-label text-xs tracking-widest uppercase px-2 py-1 rounded transition-colors ${pathname === link.href
                                ? 'text-primary border-b-2 border-primary pb-0.5'
                                : 'text-on-surface-variant hover:text-primary hover:bg-white/5'
                                }`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            </div>
            <div className="flex items-center gap-4">
                {user ? (
                    <>
                        {playerProfile && (
                            <div className="hidden md:flex items-center gap-1.5 text-secondary font-label text-xs tracking-wider bg-secondary/10 px-3 py-1.5 rounded-full border border-secondary/30 pulse-badge">
                                <span className="text-sm">⬡</span>
                                {playerProfile.total_tokens} TOKENS
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface-container-high border border-primary/50 flex items-center justify-center">
                                <span className="text-primary text-sm font-bold uppercase">
                                    {playerProfile?.username?.charAt(0) || user.email.charAt(0)}
                                </span>
                            </div>
                            <button
                                onClick={signOut}
                                className="font-label text-xs text-on-surface-variant hover:text-error transition-colors tracking-wider uppercase"
                            >
                                Sign Out
                            </button>
                        </div>
                    </>
                ) : (
                    <Link
                        href="/login"
                        className="bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 px-6 py-2 rounded-xl font-label text-xs tracking-wider uppercase transition-colors"
                    >
                        Login
                    </Link>
                )}
            </div>
        </nav>
    );
}
