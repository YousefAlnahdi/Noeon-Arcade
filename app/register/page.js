'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { signUp } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            return setError("Passwords do not match");
        }

        setLoading(true);
        setError('');

        const { error } = await signUp(email, password, username);

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            router.push('/');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-secondary/5 via-transparent to-primary/5 pointer-events-none" />

            <div className="w-full max-w-md animate-fade-in">
                {/* Logo */}
                <div className="text-center mb-10">
                    <Link href="/" className="font-display text-4xl font-extrabold text-primary neon-text-primary tracking-tight">
                        NEON ARCADE
                    </Link>
                    <p className="font-body text-sm text-on-surface-variant mt-2">
                        Create your arcade profile
                    </p>
                </div>

                {/* Register Card */}
                <div className="glass-panel rounded-2xl p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary via-primary to-tertiary" />

                    {error && (
                        <div className="mb-4 p-3 rounded-xl bg-error-container/20 border border-error/30 text-error text-sm font-body">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        {/* Username */}
                        <div className="flex flex-col gap-2">
                            <label className="font-label text-xs text-on-surface-variant uppercase tracking-wider">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="NeonPlayer42"
                                required
                                className="w-full bg-surface-container-low border border-white/10 rounded-xl px-4 py-3 text-on-surface font-body text-sm placeholder-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                            />
                        </div>

                        {/* Email */}
                        <div className="flex flex-col gap-2">
                            <label className="font-label text-xs text-on-surface-variant uppercase tracking-wider">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="player@neonarcade.io"
                                required
                                className="w-full bg-surface-container-low border border-white/10 rounded-xl px-4 py-3 text-on-surface font-body text-sm placeholder-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                            />
                        </div>

                        {/* Password */}
                        <div className="flex flex-col gap-2">
                            <label className="font-label text-xs text-on-surface-variant uppercase tracking-wider">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full bg-surface-container-low border border-white/10 rounded-xl px-4 py-3 text-on-surface font-body text-sm placeholder-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                            />
                        </div>

                        {/* Confirm Password */}
                        <div className="flex flex-col gap-2">
                            <label className="font-label text-xs text-on-surface-variant uppercase tracking-wider">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full bg-surface-container-low border border-white/10 rounded-xl px-4 py-3 text-on-surface font-body text-sm placeholder-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-secondary text-on-secondary font-label text-sm tracking-wider uppercase py-3 rounded-xl neon-glow-secondary hover:brightness-110 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-on-secondary/30 border-t-on-secondary rounded-full animate-spin" />
                                    CREATING...
                                </span>
                            ) : (
                                'CREATE ACCOUNT'
                            )}
                        </button>
                    </form>

                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="font-label text-xs text-on-surface-variant tracking-wider">OR</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    <p className="text-center font-body text-sm text-on-surface-variant">
                        Already have an account?{' '}
                        <Link href="/login" className="text-primary hover:text-primary/80 transition-colors font-semibold">
                            Sign In
                        </Link>
                    </p>
                </div>

                <div className="text-center mt-6">
                    <Link href="/" className="font-label text-xs text-on-surface-variant hover:text-primary transition-colors tracking-wider uppercase">
                        ← Back to Arcade
                    </Link>
                </div>
            </div>
        </div>
    );
}
