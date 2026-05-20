import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { askDeepSeek } from '@/lib/deepseek';

const CATEGORIES = {
    gaming_history: { label: '🎮 Gaming History', desc: 'Retro to modern gaming lore' },
    sci_fi:         { label: '🚀 Sci-Fi & Fantasy', desc: 'Universes beyond the real' },
    retro_culture:  { label: '📼 80s/90s Retro Culture', desc: 'Pop culture time capsule' },
    tech_ai:        { label: '🤖 Tech & AI', desc: 'Silicon minds & circuits' },
    random:         { label: '🌀 Random Mix', desc: 'All categories shuffled' }
};

const DIFFICULTY_CONFIG = {
    easy:    { timeLimit: 20, basePoints: 100, label: 'EASY' },
    medium:  { timeLimit: 15, basePoints: 200, label: 'MEDIUM' },
    hard:    { timeLimit: 12, basePoints: 300, label: 'HARD' },
    extreme: { timeLimit: 8,  basePoints: 500, label: 'EXTREME' }
};

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'extreme'];

const QUESTION_SYSTEM_PROMPT = `You are NEURAL_QUIZ.exe, an advanced hacker trivia AI operating inside a neon cyberpunk arcade mainframe.
Generate exactly 1 trivia question. Return ONLY a valid JSON object with NO markdown wrapping, matching this exact schema:
{
  "question": "The question text here",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct": 0,
  "fun_fact": "A short interesting fact related to the correct answer"
}
The "correct" field must be the 0-indexed position of the correct answer in the options array.
IMPORTANT: Shuffle the position of the correct answer randomly. Do NOT always put it at index 0.
Ensure all 4 options are plausible. Never repeat a question from previous rounds.`;

const EXPLANATION_SYSTEM_PROMPT = `You are NEURAL_QUIZ.exe, a sarcastic retro-hacker AI quiz master.
When the player gets a wrong answer, you mock them in 2 SHORT sentences using cyberpunk jargon, retro computing references, and arcade slang.
Be witty, condescending but charming. Include the correct answer in your explanation.
When the player gets a correct answer, give a brief 1-sentence impressed/grudging acknowledgment.`;

export { CATEGORIES, DIFFICULTY_CONFIG, DIFFICULTY_ORDER };

export const useQuizStore = create((set, get) => ({
    category: 'random',
    difficulty: 'easy',
    gameState: 'menu', // menu | loading | question | answered | game-over
    currentQuestion: null,
    selectedAnswer: null,
    isCorrect: null,
    score: 0,
    round: 0,
    maxRounds: 10,
    streak: 0,
    bestStreak: 0,
    correctCount: 0,
    wrongCount: 0,
    timeLeft: 20,
    aiExplanation: '',
    isLoading: false,
    isExplaining: false,
    questionHistory: [],
    consecutiveCorrect: 0,
    consecutiveWrong: 0,

    setCategory: (cat) => set({ category: cat }),

    startGame: () => {
        const diff = 'easy';
        set({
            gameState: 'loading',
            difficulty: diff,
            score: 0,
            round: 0,
            streak: 0,
            bestStreak: 0,
            correctCount: 0,
            wrongCount: 0,
            questionHistory: [],
            consecutiveCorrect: 0,
            consecutiveWrong: 0,
            currentQuestion: null,
            selectedAnswer: null,
            isCorrect: null,
            aiExplanation: '',
            timeLeft: DIFFICULTY_CONFIG[diff].timeLimit
        });

        // Immediately generate first question
        get().generateQuestion();
    },

    generateQuestion: async () => {
        const state = get();
        set({ isLoading: true, gameState: 'loading' });

        const actualCategory = state.category === 'random'
            ? Object.keys(CATEGORIES).filter(k => k !== 'random')[Math.floor(Math.random() * 4)]
            : state.category;

        const context = {
            category: actualCategory,
            category_label: CATEGORIES[actualCategory]?.label || actualCategory,
            difficulty: state.difficulty,
            round: state.round + 1,
            max_rounds: state.maxRounds,
            previous_questions: state.questionHistory.slice(-5).map(q => q.question)
        };

        try {
            const reply = await askDeepSeek([], context, QUESTION_SYSTEM_PROMPT, 350);
            const cleanReply = reply.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanReply);

            if (parsed && parsed.question && Array.isArray(parsed.options) && typeof parsed.correct === 'number') {
                set({
                    currentQuestion: parsed,
                    gameState: 'question',
                    isLoading: false,
                    selectedAnswer: null,
                    isCorrect: null,
                    aiExplanation: '',
                    timeLeft: DIFFICULTY_CONFIG[state.difficulty].timeLimit
                });
                return;
            }
        } catch (err) {
            console.error('Failed to generate question:', err);
        }

        // Fallback question if AI fails
        const fallbacks = [
            { question: "What year was the original 'Space Invaders' arcade game released?", options: ["1978", "1980", "1975", "1982"], correct: 0, fun_fact: "Space Invaders caused a coin shortage in Japan." },
            { question: "Which company created the first commercially successful AI chatbot 'ELIZA'?", options: ["MIT", "IBM", "Bell Labs", "Xerox PARC"], correct: 0, fun_fact: "ELIZA was created in 1966 and simulated a psychotherapist." },
            { question: "What does 'CPU' stand for?", options: ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Core Processing Unit"], correct: 0, fun_fact: "The first CPU was the Intel 4004, released in 1971." },
            { question: "Which 1982 film features a hacker who nearly starts World War III?", options: ["WarGames", "Blade Runner", "Tron", "The Last Starfighter"], correct: 0, fun_fact: "WarGames led to the first US computer fraud law." },
            { question: "In what year was the World Wide Web invented?", options: ["1989", "1991", "1985", "1993"], correct: 0, fun_fact: "Tim Berners-Lee invented the WWW at CERN." }
        ];

        const fb = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        set({
            currentQuestion: fb,
            gameState: 'question',
            isLoading: false,
            selectedAnswer: null,
            isCorrect: null,
            aiExplanation: '',
            timeLeft: DIFFICULTY_CONFIG[state.difficulty].timeLimit
        });
    },

    answerQuestion: async (answerIndex) => {
        const state = get();
        if (state.gameState !== 'question') return;

        const correct = answerIndex === state.currentQuestion.correct;

        let newStreak = correct ? state.streak + 1 : 0;
        let newBestStreak = Math.max(state.bestStreak, newStreak);
        let newConsCorrect = correct ? state.consecutiveCorrect + 1 : 0;
        let newConsWrong = correct ? 0 : state.consecutiveWrong + 1;

        // Score calculation
        let pointsEarned = 0;
        if (correct) {
            const base = DIFFICULTY_CONFIG[state.difficulty].basePoints;
            const timeBonus = state.timeLeft * 10;
            const streakBonus = Math.min(newStreak, 5) * 50;
            pointsEarned = base + timeBonus + streakBonus;
        }

        // Difficulty auto-adjustment
        let newDifficulty = state.difficulty;
        const currentIdx = DIFFICULTY_ORDER.indexOf(state.difficulty);
        if (newConsCorrect >= 3 && currentIdx < DIFFICULTY_ORDER.length - 1) {
            newDifficulty = DIFFICULTY_ORDER[currentIdx + 1];
            newConsCorrect = 0;
        } else if (newConsWrong >= 2 && currentIdx > 0) {
            newDifficulty = DIFFICULTY_ORDER[currentIdx - 1];
            newConsWrong = 0;
        }

        const historyEntry = {
            question: state.currentQuestion.question,
            playerAnswer: state.currentQuestion.options[answerIndex],
            correctAnswer: state.currentQuestion.options[state.currentQuestion.correct],
            isCorrect: correct,
            points: pointsEarned,
            difficulty: state.difficulty
        };

        set({
            gameState: 'answered',
            selectedAnswer: answerIndex,
            isCorrect: correct,
            score: state.score + pointsEarned,
            streak: newStreak,
            bestStreak: newBestStreak,
            correctCount: state.correctCount + (correct ? 1 : 0),
            wrongCount: state.wrongCount + (correct ? 0 : 1),
            consecutiveCorrect: newConsCorrect,
            consecutiveWrong: newConsWrong,
            difficulty: newDifficulty,
            round: state.round + 1,
            questionHistory: [...state.questionHistory, historyEntry]
        });

        // Generate AI explanation
        set({ isExplaining: true });
        try {
            const explainContext = {
                question: state.currentQuestion.question,
                player_answer: state.currentQuestion.options[answerIndex],
                correct_answer: state.currentQuestion.options[state.currentQuestion.correct],
                was_correct: correct,
                fun_fact: state.currentQuestion.fun_fact || '',
                difficulty: state.difficulty,
                streak: newStreak
            };

            const reply = await askDeepSeek([], explainContext, EXPLANATION_SYSTEM_PROMPT, 120);
            if (reply && !reply.startsWith("ERROR")) {
                set({ aiExplanation: reply });
            }
        } catch (err) {
            console.error("Quiz explanation error:", err);
            set({
                aiExplanation: correct
                    ? "Not bad, meatbag. You got lucky this cycle."
                    : `WRONG. The correct answer was: ${state.currentQuestion.options[state.currentQuestion.correct]}. Your neural pathways need defragmenting.`
            });
        } finally {
            set({ isExplaining: false });
        }
    },

    timeOut: () => {
        const state = get();
        if (state.gameState !== 'question') return;
        // Treat timeout as wrong answer
        get().answerQuestion(-1);
    },

    tick: () => {
        const state = get();
        if (state.gameState !== 'question') return;
        const next = state.timeLeft - 1;
        if (next <= 0) {
            set({ timeLeft: 0 });
            get().timeOut();
        } else {
            set({ timeLeft: next });
        }
    },

    nextQuestion: () => {
        const state = get();
        if (state.round >= state.maxRounds) {
            set({ gameState: 'game-over' });
            return;
        }
        get().generateQuestion();
    },

    saveSession: async (userId) => {
        const state = get();
        if (!userId) return;

        const accuracy = state.round > 0 ? Math.round((state.correctCount / state.round) * 100) : 0;

        let critique = "Neural quiz archive logging complete.";
        try {
            const critiquePrompt = `You are the Neural Arcade AI Analyst. The player just completed a Cyber Quiz session.
Score: ${state.score} | Correct: ${state.correctCount}/${state.round} | Best Streak: ${state.bestStreak} | Final Difficulty: ${state.difficulty} | Accuracy: ${accuracy}%
Category: ${CATEGORIES[state.category]?.label || state.category}

Write a 2-sentence tactical performance review. Keep the tone cyberpunk, retro, and direct. Comment on their knowledge level and pattern.`;

            const reply = await askDeepSeek([], {}, critiquePrompt, 100);
            if (reply && !reply.startsWith("ERROR")) {
                critique = reply;
            }
        } catch (err) {
            console.error("Quiz critique error:", err);
        }

        try {
            await supabase.from('game_sessions').insert({
                user_id: userId,
                game_type: 'quiz',
                game_mode: state.category,
                result: state.correctCount >= Math.ceil(state.maxRounds / 2) ? 'win' : 'loss',
                score: state.score,
                opponent_score: 0,
                tokens_earned: Math.floor(state.score / 100),
                ai_analysis: critique,
                telemetry: {
                    correct: state.correctCount,
                    wrong: state.wrongCount,
                    best_streak: state.bestStreak,
                    final_difficulty: state.difficulty,
                    accuracy: accuracy,
                    category: state.category
                }
            });

            // Award tokens
            const tokensEarned = Math.floor(state.score / 100);
            if (tokensEarned > 0) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('total_tokens')
                    .eq('id', userId)
                    .single();

                if (profile) {
                    await supabase
                        .from('profiles')
                        .update({ total_tokens: profile.total_tokens + tokensEarned })
                        .eq('id', userId);
                }
            }
        } catch (err) {
            console.error("Failed to save quiz session:", err);
        }
    },

    resetToMenu: () => {
        set({
            gameState: 'menu',
            currentQuestion: null,
            selectedAnswer: null,
            isCorrect: null,
            score: 0,
            round: 0,
            streak: 0,
            bestStreak: 0,
            correctCount: 0,
            wrongCount: 0,
            aiExplanation: '',
            questionHistory: [],
            consecutiveCorrect: 0,
            consecutiveWrong: 0,
            timeLeft: 20
        });
    }
}));
