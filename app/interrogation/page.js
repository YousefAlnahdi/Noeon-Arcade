'use client';

import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useInterrogationStore, DIFFICULTY } from '@/store/interrogation';

export default function InterrogationPage() {
    const { user } = useAuth();
    const {
        gameState, difficulty, caseData, messages, questionsLeft, maxQuestions,
        notes, accusation, accusationResult, score, isLoading, error,
        setDifficulty, generateCase, enterRoom, askQuestion,
        setNotes, setAccusation, beginAccusation, submitAccusation,
        saveSession, resetToMenu
    } = useInterrogationStore();

    const [input, setInput] = useState('');
    const [saved, setSaved] = useState(false);
    const [revealStep, setRevealStep] = useState(0);
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    useEffect(() => {
        if (gameState === 'result' && !saved) {
            setSaved(true);
            if (user) saveSession(user.id);
        }
        if (gameState === 'menu') setSaved(false);
    }, [gameState, saved, user, saveSession]);

    // Progressive reveal on result screen
    useEffect(() => {
        if (gameState === 'result' && revealStep < (caseData?.contradictions?.length || 0) + 2) {
            const timer = setTimeout(() => setRevealStep(s => s + 1), 800);
            return () => clearTimeout(timer);
        }
    }, [gameState, revealStep, caseData]);

    useEffect(() => {
        if (gameState === 'result') setRevealStep(0);
    }, [gameState]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        askQuestion(input.trim());
        setInput('');
    };

    const handleAccuse = (e) => {
        e.preventDefault();
        if (!accusation.trim() || isLoading) return;
        submitAccusation();
    };

    const questionsUsed = maxQuestions - questionsLeft;

    return (
        <>
            <Navbar />
            <div className="pt-[88px] min-h-screen bg-surface" dir="rtl">
                <style>{`
                    @keyframes flicker { 0%,100%{opacity:1} 50%{opacity:0.97} }
                    @keyframes pulse-red { 0%,100%{box-shadow:0 0 8px rgba(255,59,48,0.3)} 50%{box-shadow:0 0 20px rgba(255,59,48,0.6)} }
                    @keyframes slide-up { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
                    @keyframes typewriter { from{max-height:0;opacity:0} to{max-height:500px;opacity:1} }
                    .recording { animation: pulse-red 2s ease-in-out infinite; }
                    .msg-enter { animation: slide-up 0.3s ease-out both; }
                    .reveal-card { animation: slide-up 0.5s ease-out both; }
                    .interrogation-bg {
                        background: radial-gradient(ellipse at 50% 0%, rgba(255,59,48,0.04) 0%, transparent 60%),
                                    radial-gradient(ellipse at 80% 100%, rgba(57,255,20,0.03) 0%, transparent 50%);
                    }
                `}</style>

                {/* ============ MENU ============ */}
                {gameState === 'menu' && (
                    <div className="max-w-2xl mx-auto px-6 py-12">
                        <div className="text-center mb-8">
                            <span className="text-6xl mb-4 block">🕵️</span>
                            <h1 className="font-display text-4xl font-black text-white mb-2" style={{ textShadow: '0 0 20px rgba(255,59,48,0.3)' }}>
                                غرفة الاستجواب
                            </h1>
                            <p className="font-body text-sm text-on-surface-variant">
                                استجوب المشتبه به. اكتشف التناقضات. اكشف الحقيقة.
                            </p>
                        </div>

                        <div className="glass-panel rounded-2xl p-6 mb-6">
                            <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider mb-4">مستوى الصعوبة</p>
                            <div className="flex flex-col gap-2">
                                {Object.entries(DIFFICULTY).map(([key, cfg]) => (
                                    <button
                                        key={key}
                                        onClick={() => setDifficulty(key)}
                                        className={`w-full px-4 py-4 rounded-xl border text-right transition-all ${
                                            difficulty === key
                                                ? 'border-error/40 bg-error/10 shadow-[0_0_12px_rgba(255,59,48,0.15)]'
                                                : 'border-white/5 bg-surface-container/30 hover:border-white/15'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className={`font-label text-xs px-2 py-0.5 rounded-full ${
                                                key === 'easy' ? 'bg-neon-green/15 text-neon-green' :
                                                key === 'medium' ? 'bg-amber-400/15 text-amber-400' :
                                                'bg-error/15 text-error'
                                            }`}>
                                                {cfg.questions} أسئلة
                                            </span>
                                            <span className={`font-display text-base font-bold ${difficulty === key ? 'text-white' : 'text-on-surface-variant'}`}>
                                                {cfg.label}
                                            </span>
                                        </div>
                                        <p className="font-body text-[11px] text-on-surface-variant mt-1 text-right">
                                            {cfg.contradictions} تناقضات مخفية • المشتبه: {cfg.personality.split('،')[0]}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="bg-error/10 border border-error/30 rounded-xl p-3 mb-4 text-center">
                                <p className="font-body text-sm text-error">{error}</p>
                            </div>
                        )}

                        <button
                            onClick={generateCase}
                            disabled={isLoading}
                            className="w-full py-4 bg-error/90 text-white font-label text-sm tracking-[0.15em] uppercase font-bold rounded-2xl hover:bg-error transition-all disabled:opacity-50 disabled:cursor-wait"
                            style={{ boxShadow: '0 0 25px rgba(255,59,48,0.2)' }}
                        >
                            {isLoading ? '⏳ جاري توليد القضية...' : '🔍 ابدأ التحقيق'}
                        </button>
                        <Link href="/" className="block text-center mt-4 font-body text-xs text-on-surface-variant hover:text-primary transition-colors">
                            → العودة للأركيد
                        </Link>
                    </div>
                )}

                {/* ============ GENERATING ============ */}
                {gameState === 'generating' && (
                    <div className="max-w-md mx-auto px-6 py-24 text-center">
                        <div className="w-16 h-16 border-4 border-error/30 border-t-error rounded-full animate-spin mx-auto mb-6" />
                        <h2 className="font-display text-xl font-bold text-white mb-2">جاري تجهيز القضية...</h2>
                        <p className="font-body text-sm text-on-surface-variant">الذكاء الاصطناعي يبني السيناريو والتناقضات</p>
                    </div>
                )}

                {/* ============ BRIEFING ============ */}
                {gameState === 'briefing' && caseData && (
                    <div className="max-w-3xl mx-auto px-6 py-8">
                        <div className="text-center mb-6">
                            <span className="bg-error/15 text-error border border-error/30 px-3 py-1 rounded-full font-label text-[10px] tracking-wider uppercase">
                                ملف سري — {caseData.case_id}
                            </span>
                        </div>

                        <div className="glass-panel rounded-2xl p-6 mb-4 border-error/10">
                            <h2 className="font-display text-2xl font-bold text-error mb-3">{caseData.crime_title}</h2>
                            <p className="font-body text-sm text-on-surface-variant leading-relaxed">{caseData.crime_description}</p>
                            <div className="mt-3 inline-block bg-surface-container/60 border border-white/5 rounded-lg px-3 py-1.5">
                                <span className="font-label text-[10px] text-on-surface-variant">الهدف: </span>
                                <span className="font-body text-xs text-white">{caseData.victim_or_target}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="glass-panel rounded-2xl p-5">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-12 h-12 rounded-xl bg-error/15 border border-error/30 flex items-center justify-center text-2xl">
                                        👤
                                    </div>
                                    <div>
                                        <h3 className="font-display text-base font-bold text-white">{caseData.suspect.name}</h3>
                                        <p className="font-label text-[10px] text-error">"{caseData.suspect.alias}"</p>
                                    </div>
                                </div>
                                <p className="font-body text-xs text-on-surface-variant mb-1">{caseData.suspect.role} • {caseData.suspect.age} سنة</p>
                                <p className="font-body text-xs text-on-surface-variant/70 leading-relaxed">{caseData.suspect.background}</p>
                            </div>

                            <div className="glass-panel rounded-2xl p-5">
                                <h3 className="font-display text-sm font-bold text-amber-400 mb-2">📋 الأدلة المتوفرة</h3>
                                <p className="font-body text-xs text-on-surface-variant leading-relaxed">{caseData.evidence_summary}</p>
                            </div>
                        </div>

                        <div className="glass-panel rounded-2xl p-5 mb-6 border-amber-400/10">
                            <h3 className="font-display text-sm font-bold text-amber-400 mb-2">📝 رواية المشتبه به الأولية</h3>
                            <p className="font-body text-sm text-on-surface-variant leading-relaxed italic">"{caseData.suspect_alibi}"</p>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-6">
                            <div className="glass-panel rounded-xl p-3 text-center">
                                <p className="font-label text-[8px] text-on-surface-variant uppercase">أسئلتك</p>
                                <p className="font-display text-2xl font-bold text-error">{maxQuestions}</p>
                            </div>
                            <div className="glass-panel rounded-xl p-3 text-center">
                                <p className="font-label text-[8px] text-on-surface-variant uppercase">تناقضات مخفية</p>
                                <p className="font-display text-2xl font-bold text-amber-400">?</p>
                            </div>
                            <div className="glass-panel rounded-xl p-3 text-center">
                                <p className="font-label text-[8px] text-on-surface-variant uppercase">المهمة</p>
                                <p className="font-display text-sm font-bold text-neon-green">اكشف الكذب</p>
                            </div>
                        </div>

                        <button
                            onClick={enterRoom}
                            className="w-full py-4 bg-error/90 text-white font-label text-sm tracking-[0.15em] uppercase font-bold rounded-2xl hover:bg-error transition-all"
                            style={{ boxShadow: '0 0 25px rgba(255,59,48,0.25)' }}
                        >
                            🚪 ادخل غرفة الاستجواب
                        </button>
                    </div>
                )}

                {/* ============ INTERROGATING ============ */}
                {gameState === 'interrogating' && (
                    <div className="max-w-6xl mx-auto px-4 py-4 interrogation-bg">
                        {/* Top Bar */}
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <div className="recording flex items-center gap-2 bg-error/10 border border-error/30 px-3 py-1.5 rounded-full">
                                    <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
                                    <span className="font-label text-[9px] text-error uppercase tracking-wider">تسجيل</span>
                                </div>
                                <span className="font-label text-[10px] text-on-surface-variant">{caseData?.case_id}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-surface-container/60 border border-white/5 px-3 py-1.5 rounded-lg text-center">
                                    <p className="font-label text-[7px] text-on-surface-variant uppercase">الأسئلة المتبقية</p>
                                    <p className={`font-display text-lg font-bold ${questionsLeft <= 2 ? 'text-error animate-pulse' : questionsLeft <= 4 ? 'text-amber-400' : 'text-neon-green'}`}>
                                        {questionsLeft}
                                    </p>
                                </div>
                                <button
                                    onClick={beginAccusation}
                                    className="bg-error/90 text-white px-4 py-2 rounded-xl font-label text-[10px] uppercase tracking-wider font-bold hover:bg-error transition-all"
                                    style={{ boxShadow: '0 0 12px rgba(255,59,48,0.2)' }}
                                >
                                    ⚡ وجّه الاتهام
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            {/* Chat Area */}
                            <div className="lg:col-span-8 flex flex-col">
                                <div className="glass-panel rounded-2xl flex-1 flex flex-col overflow-hidden" style={{ minHeight: '500px', maxHeight: '70vh' }}>
                                    {/* Chat Messages */}
                                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                                        {messages.map((msg, i) => (
                                            <div key={i} className={`msg-enter flex ${msg.role === 'detective' ? 'justify-start' : msg.role === 'suspect' ? 'justify-end' : 'justify-center'}`}>
                                                {msg.role === 'system' ? (
                                                    <div className="bg-surface-container/40 border border-white/5 rounded-lg px-3 py-1.5 max-w-[80%]">
                                                        <p className="font-label text-[9px] text-on-surface-variant text-center">{msg.content}</p>
                                                    </div>
                                                ) : msg.role === 'detective' ? (
                                                    <div className="flex items-start gap-2 max-w-[80%]">
                                                        <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-xs shrink-0 mt-1">🕵️</div>
                                                        <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-sm px-4 py-2.5">
                                                            <p className="font-body text-sm text-white leading-relaxed">{msg.content}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start gap-2 max-w-[80%] flex-row-reverse">
                                                        <div className="w-7 h-7 rounded-lg bg-error/20 border border-error/30 flex items-center justify-center text-xs shrink-0 mt-1">👤</div>
                                                        <div className="bg-error/8 border border-error/15 rounded-2xl rounded-tl-sm px-4 py-2.5">
                                                            <p className="font-body text-sm text-on-surface-variant leading-relaxed">{msg.content}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {isLoading && (
                                            <div className="flex justify-end msg-enter">
                                                <div className="flex items-start gap-2 flex-row-reverse">
                                                    <div className="w-7 h-7 rounded-lg bg-error/20 border border-error/30 flex items-center justify-center text-xs shrink-0">👤</div>
                                                    <div className="bg-error/8 border border-error/15 rounded-2xl px-4 py-3">
                                                        <div className="flex gap-1">
                                                            <div className="w-2 h-2 rounded-full bg-on-surface-variant/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                                                            <div className="w-2 h-2 rounded-full bg-on-surface-variant/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                                                            <div className="w-2 h-2 rounded-full bg-on-surface-variant/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>

                                    {/* Input */}
                                    <form onSubmit={handleSend} className="border-t border-white/5 p-3 flex gap-2">
                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder={questionsLeft > 0 ? `اكتب سؤالك... (${questionsLeft} متبقية)` : 'انتهت أسئلتك — وجّه الاتهام'}
                                            disabled={questionsLeft <= 0 || isLoading}
                                            className="flex-1 bg-surface-container/50 border border-white/10 rounded-xl px-4 py-2.5 font-body text-sm text-white placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/30 disabled:opacity-40 transition-colors"
                                            dir="rtl"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!input.trim() || questionsLeft <= 0 || isLoading}
                                            className="bg-primary/90 text-on-primary px-4 rounded-xl font-label text-xs uppercase font-bold disabled:opacity-30 hover:bg-primary transition-colors"
                                        >
                                            اسأل
                                        </button>
                                    </form>
                                </div>

                                {questionsLeft <= 0 && (
                                    <div className="mt-3 bg-error/10 border border-error/30 rounded-xl p-4 text-center">
                                        <p className="font-display text-sm font-bold text-error mb-2">⚠️ انتهت أسئلتك!</p>
                                        <button onClick={beginAccusation} className="bg-error text-white px-6 py-2 rounded-xl font-label text-xs uppercase font-bold hover:brightness-110 transition-all">
                                            وجّه الاتهام الآن
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Side Panel */}
                            <div className="lg:col-span-4 flex flex-col gap-4">
                                {/* Suspect Card */}
                                <div className="glass-panel rounded-2xl p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-xl bg-error/15 border border-error/30 flex items-center justify-center text-xl">👤</div>
                                        <div>
                                            <h3 className="font-display text-sm font-bold text-white">{caseData?.suspect?.name}</h3>
                                            <p className="font-label text-[9px] text-error">"{caseData?.suspect?.alias}"</p>
                                        </div>
                                    </div>
                                    <p className="font-body text-[10px] text-on-surface-variant">{caseData?.suspect?.role}</p>
                                </div>

                                {/* Progress */}
                                <div className="glass-panel rounded-2xl p-4">
                                    <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider mb-2">تقدم الاستجواب</p>
                                    <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden mb-1">
                                        <div className="h-full bg-error rounded-full transition-all duration-500" style={{ width: `${(questionsUsed / maxQuestions) * 100}%` }} />
                                    </div>
                                    <p className="font-body text-[10px] text-on-surface-variant">{questionsUsed}/{maxQuestions} أسئلة مُستخدمة</p>
                                </div>

                                {/* Notes */}
                                <div className="glass-panel rounded-2xl p-4 flex-1">
                                    <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider mb-2">📝 ملاحظات المحقق</p>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="دوّن ملاحظاتك هنا... أي شي مشبوه لاحظته"
                                        className="w-full h-32 bg-surface-container/30 border border-white/5 rounded-xl px-3 py-2 font-body text-xs text-on-surface-variant placeholder:text-on-surface-variant/30 focus:outline-none focus:border-amber-400/20 resize-none"
                                        dir="rtl"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============ ACCUSING ============ */}
                {gameState === 'accusing' && (
                    <div className="max-w-2xl mx-auto px-6 py-8">
                        <div className="text-center mb-6">
                            <span className="text-5xl block mb-3">⚖️</span>
                            <h2 className="font-display text-3xl font-black text-error mb-2" style={{ textShadow: '0 0 20px rgba(255,59,48,0.3)' }}>
                                وجّه الاتهام
                            </h2>
                            <p className="font-body text-sm text-on-surface-variant">
                                اشرح نظريتك: ايش اللي فعلاً صار؟ وين التناقضات اللي لقيتها؟
                            </p>
                        </div>

                        {notes && (
                            <div className="glass-panel rounded-xl p-4 mb-4">
                                <p className="font-label text-[9px] text-amber-400 uppercase tracking-wider mb-1">ملاحظاتك</p>
                                <p className="font-body text-xs text-on-surface-variant whitespace-pre-wrap">{notes}</p>
                            </div>
                        )}

                        <form onSubmit={handleAccuse}>
                            <textarea
                                value={accusation}
                                onChange={(e) => setAccusation(e.target.value)}
                                placeholder="أعتقد إن المشتبه به كذب بخصوص... لأن في كلامه قال... لكن هذا يتناقض مع... والحقيقة إنه..."
                                className="w-full h-40 glass-panel rounded-2xl px-5 py-4 font-body text-sm text-white placeholder:text-on-surface-variant/40 focus:outline-none focus:border-error/30 resize-none mb-4"
                                dir="rtl"
                            />
                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={!accusation.trim() || isLoading}
                                    className="flex-1 py-4 bg-error/90 text-white font-label text-sm tracking-[0.15em] uppercase font-bold rounded-2xl hover:bg-error disabled:opacity-40 transition-all"
                                    style={{ boxShadow: '0 0 20px rgba(255,59,48,0.2)' }}
                                >
                                    {isLoading ? '⏳ جاري التقييم...' : '⚡ قدّم الاتهام'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => useInterrogationStore.setState({ gameState: 'interrogating' })}
                                    disabled={isLoading}
                                    className="px-4 py-4 bg-surface-container/50 border border-white/10 text-on-surface-variant font-label text-xs uppercase rounded-2xl hover:text-white transition-all"
                                >
                                    ارجع
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ============ RESULT — THE BIG REVEAL ============ */}
                {gameState === 'result' && (
                    <div className="max-w-2xl mx-auto px-6 py-8">
                        {/* Verdict */}
                        {revealStep >= 1 && (
                            <div className="reveal-card text-center mb-6">
                                <p className="font-display text-6xl font-black mb-2" style={{
                                    color: score >= 60 ? '#39ff14' : '#ff3b30',
                                    textShadow: `0 0 30px ${score >= 60 ? 'rgba(57,255,20,0.4)' : 'rgba(255,59,48,0.4)'}`
                                }}>
                                    {score}%
                                </p>
                                <h2 className={`font-display text-2xl font-extrabold uppercase tracking-wider mb-1 ${
                                    score >= 60 ? 'text-neon-green' : 'text-error'
                                }`}>
                                    {accusationResult?.verdict}
                                </h2>
                                <p className="font-body text-sm text-on-surface-variant">
                                    {accusationResult?.feedback}
                                </p>
                            </div>
                        )}

                        {/* Truth Reveal */}
                        {revealStep >= 2 && (
                            <div className="reveal-card glass-panel rounded-2xl p-6 mb-4 border-error/20">
                                <h3 className="font-display text-base font-bold text-error mb-2 flex items-center gap-2">
                                    <span>🔓</span> الحقيقة الكاملة
                                </h3>
                                <p className="font-body text-sm text-on-surface leading-relaxed">
                                    {accusationResult?.truth_reveal}
                                </p>
                            </div>
                        )}

                        {/* Contradictions Breakdown — THE "AHHH" MOMENT */}
                        {caseData?.contradictions?.map((c, i) => (
                            revealStep >= i + 3 && (
                                <div key={i} className="reveal-card glass-panel rounded-2xl p-5 mb-3 border-amber-400/15" style={{ animationDelay: `${i * 0.2}s` }}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="bg-amber-400/15 text-amber-400 border border-amber-400/30 px-2 py-0.5 rounded-full font-label text-[9px] tracking-wider">
                                            تناقض #{i + 1}
                                        </span>
                                        <span className="font-label text-[10px] text-on-surface-variant">{c.area}</span>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2 mb-3">
                                        <div className="bg-error/8 border border-error/15 rounded-xl p-3">
                                            <p className="font-label text-[8px] text-error uppercase tracking-wider mb-1">🗣️ ادّعى المشتبه به:</p>
                                            <p className="font-body text-xs text-on-surface leading-relaxed">"{c.what_they_claim}"</p>
                                        </div>
                                        <div className="bg-neon-green/8 border border-neon-green/15 rounded-xl p-3">
                                            <p className="font-label text-[8px] text-neon-green uppercase tracking-wider mb-1">✅ الحقيقة:</p>
                                            <p className="font-body text-xs text-on-surface leading-relaxed">{c.why_its_wrong}</p>
                                        </div>
                                    </div>

                                    <div className="bg-amber-400/8 border border-amber-400/15 rounded-xl p-3">
                                        <p className="font-label text-[8px] text-amber-400 uppercase tracking-wider mb-1">💡 السؤال القاتل اللي كان يفضحه:</p>
                                        <p className="font-body text-xs text-amber-400 font-semibold leading-relaxed">"{c.killer_question}"</p>
                                    </div>
                                </div>
                            )
                        ))}

                        {/* Score Breakdown */}
                        {revealStep >= (caseData?.contradictions?.length || 0) + 3 && (
                            <div className="reveal-card">
                                <div className="grid grid-cols-3 gap-3 mb-6">
                                    <div className="glass-panel rounded-xl p-3 text-center">
                                        <p className="font-label text-[8px] text-on-surface-variant uppercase">الأسئلة المُستخدمة</p>
                                        <p className="font-display text-xl font-bold text-white">{questionsUsed}/{maxQuestions}</p>
                                    </div>
                                    <div className="glass-panel rounded-xl p-3 text-center">
                                        <p className="font-label text-[8px] text-on-surface-variant uppercase">تناقضات مكتشفة</p>
                                        <p className="font-display text-xl font-bold text-amber-400">{accusationResult?.contradictions_caught || 0}/{caseData?.contradictions?.length || 0}</p>
                                    </div>
                                    <div className="glass-panel rounded-xl p-3 text-center">
                                        <p className="font-label text-[8px] text-on-surface-variant uppercase">توكنز</p>
                                        <p className="font-display text-xl font-bold text-primary">+{Math.floor(score / 20)}</p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={resetToMenu}
                                        className="w-full py-4 bg-error/90 text-white font-label text-sm tracking-[0.15em] uppercase font-bold rounded-2xl hover:bg-error transition-all"
                                    >
                                        🔄 قضية جديدة
                                    </button>
                                    <Link href="/" className="w-full py-3 bg-surface-container/50 border border-white/10 text-on-surface-variant font-label text-xs uppercase tracking-wider rounded-xl hover:text-primary hover:border-primary/20 transition-all text-center block">
                                        → العودة للأركيد
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
