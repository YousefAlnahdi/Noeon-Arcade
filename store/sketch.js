import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { askDeepSeek } from '@/lib/deepseek';

const WORD_LISTS = {
    animals: ['cat', 'dog', 'fish', 'bird', 'snake', 'spider', 'elephant', 'lion', 'rabbit', 'turtle', 'whale', 'penguin', 'frog', 'butterfly', 'shark', 'octopus', 'monkey', 'bear', 'horse', 'dolphin'],
    objects: ['house', 'car', 'phone', 'book', 'clock', 'key', 'umbrella', 'guitar', 'lamp', 'chair', 'sword', 'crown', 'rocket', 'camera', 'balloon', 'diamond', 'ladder', 'robot', 'headphones', 'glasses'],
    food: ['pizza', 'apple', 'cake', 'burger', 'ice cream', 'banana', 'cookie', 'egg', 'sushi', 'watermelon', 'donut', 'taco', 'popcorn', 'mushroom', 'carrot', 'cherry', 'hot dog', 'grapes', 'pineapple', 'cheese'],
    nature: ['tree', 'sun', 'moon', 'star', 'mountain', 'flower', 'cloud', 'rain', 'ocean', 'fire', 'lightning', 'snowflake', 'volcano', 'rainbow', 'cactus', 'leaf', 'tornado', 'island', 'river', 'waterfall'],
};

const CATEGORIES = {
    animals:  { label: '🐾 Animals', color: '#4cd7f6' },
    objects:  { label: '🔧 Objects', color: '#ddb7ff' },
    food:     { label: '🍕 Food', color: '#ff6ec7' },
    nature:   { label: '🌿 Nature', color: '#39ff14' },
    random:   { label: '🎲 Random', color: '#ffb000' },
};

const GUESS_SYSTEM_PROMPT = `You are playing a Pictionary drawing guessing game. A player drew something and you must identify it.

You receive:
1. An ASCII pixel grid of the drawing (█ = drawn, · = empty)
2. A list of POSSIBLE WORDS — the answer is ALWAYS one of these words
3. Your previous wrong guesses to avoid repeating

Your job: pick the 3 most likely words FROM THE PROVIDED LIST that match the drawing.
Study the overall shape, silhouette, and proportions. Think about what object would create that outline.

Return ONLY valid JSON, no markdown:
{"guesses": ["word1", "word2", "word3"]}

CRITICAL RULES:
- You MUST pick words from the provided word list ONLY
- Do NOT repeat previous guesses
- Do NOT invent new words outside the list
- Order by confidence (best guess first)`;

export { CATEGORIES, WORD_LISTS };

export const useSketchStore = create((set, get) => ({
    gameState: 'menu',
    category: 'random',
    currentWord: '',
    round: 0,
    maxRounds: 5,
    score: 0,
    totalScore: 0,
    timeLeft: 60,
    aiGuesses: [],
    aiGuessedCorrectly: false,
    guessTime: 0,
    roundHistory: [],
    isGuessing: false,
    usedWords: [],
    activeCategory: 'animals',

    setCategory: (cat) => set({ category: cat }),

    startGame: () => {
        set({
            gameState: 'countdown',
            round: 0,
            totalScore: 0,
            roundHistory: [],
            usedWords: [],
        });
        get().nextRound();
    },

    nextRound: () => {
        const state = get();
        const cat = state.category === 'random'
            ? ['animals', 'objects', 'food', 'nature'][Math.floor(Math.random() * 4)]
            : state.category;

        const wordList = WORD_LISTS[cat];
        const available = wordList.filter(w => !state.usedWords.includes(w));
        const pool = available.length > 0 ? available : wordList;
        const word = pool[Math.floor(Math.random() * pool.length)];

        set({
            currentWord: word,
            activeCategory: cat,
            round: state.round + 1,
            score: 0,
            timeLeft: 60,
            aiGuesses: [],
            aiGuessedCorrectly: false,
            guessTime: 0,
            isGuessing: false,
            usedWords: [...state.usedWords, word],
            gameState: 'playing',
        });
    },

    tick: () => {
        const state = get();
        if (state.gameState !== 'playing') return;
        const next = state.timeLeft - 1;
        if (next <= 0) {
            set({ timeLeft: 0 });
            get().endRound(false);
        } else {
            set({ timeLeft: next });
        }
    },

    submitGuess: async (asciiArt) => {
        const state = get();
        if (state.gameState !== 'playing' || state.isGuessing || state.aiGuessedCorrectly) return;

        set({ isGuessing: true });

        const activeCat = state.activeCategory;
        const wordList = WORD_LISTS[activeCat] || [];
        const previousGuesses = state.aiGuesses.map(g => g.text.toLowerCase());
        const remainingWords = wordList.filter(w => !previousGuesses.includes(w.toLowerCase()));

        try {
            const context = {
                ascii_drawing: asciiArt,
                possible_words: remainingWords.join(', '),
                category: activeCat,
                previous_wrong_guesses: previousGuesses.join(', ') || 'none yet',
            };

            const reply = await askDeepSeek([], context, GUESS_SYSTEM_PROMPT, 100);
            const clean = reply.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(clean);

            if (parsed && Array.isArray(parsed.guesses)) {
                const targetLower = state.currentWord.toLowerCase().trim();
                const newGuesses = [];
                let matched = false;

                for (const guess of parsed.guesses.slice(0, 3)) {
                    const guessLower = guess.toLowerCase().trim();
                    const isCorrect = guessLower === targetLower
                        || targetLower.includes(guessLower)
                        || guessLower.includes(targetLower);

                    newGuesses.push({ text: guess, isCorrect, time: 60 - state.timeLeft });
                    if (isCorrect) matched = true;
                }

                set((s) => ({
                    aiGuesses: [...s.aiGuesses, ...newGuesses],
                    isGuessing: false,
                }));

                if (matched) {
                    const elapsed = 60 - state.timeLeft;
                    get().endRound(true, elapsed);
                } else {
                    set({ isGuessing: false });
                }
                return;
            }
        } catch (err) {
            console.error('Sketch guess error:', err);
        }

        set({ isGuessing: false });
    },

    endRound: (guessedCorrectly, elapsed = 60) => {
        let roundScore = 0;
        if (guessedCorrectly) {
            if (elapsed <= 15) roundScore = 100;
            else if (elapsed <= 30) roundScore = 75;
            else if (elapsed <= 45) roundScore = 50;
            else roundScore = 25;
        }

        const state = get();
        const entry = {
            word: state.currentWord,
            guessed: guessedCorrectly,
            score: roundScore,
            time: elapsed,
            guessCount: state.aiGuesses.length,
        };

        set({
            score: roundScore,
            totalScore: state.totalScore + roundScore,
            aiGuessedCorrectly: guessedCorrectly,
            guessTime: elapsed,
            gameState: 'round-result',
            roundHistory: [...state.roundHistory, entry],
        });
    },

    continueGame: () => {
        const state = get();
        if (state.round >= state.maxRounds) {
            set({ gameState: 'game-over' });
        } else {
            get().nextRound();
        }
    },

    saveSession: async (userId) => {
        const state = get();
        if (!userId) return;

        const totalCorrect = state.roundHistory.filter(r => r.guessed).length;
        const tokensEarned = Math.floor(state.totalScore / 50);

        try {
            await supabase.from('game_sessions').insert({
                user_id: userId,
                game_type: 'sketch',
                game_mode: state.category,
                result: totalCorrect >= 3 ? 'win' : 'loss',
                score: state.totalScore,
                opponent_score: 0,
                tokens_earned: tokensEarned,
                ai_analysis: `AI guessed ${totalCorrect}/${state.maxRounds} drawings correctly. Total score: ${state.totalScore}.`,
                telemetry: {
                    rounds: state.roundHistory,
                    category: state.category,
                    correct_count: totalCorrect,
                }
            });

            if (tokensEarned > 0) {
                const { data: profile } = await supabase
                    .from('profiles').select('total_tokens').eq('id', userId).single();
                if (profile) {
                    await supabase.from('profiles')
                        .update({ total_tokens: profile.total_tokens + tokensEarned })
                        .eq('id', userId);
                }
            }
        } catch (err) {
            console.error('Sketch session save error:', err);
        }
    },

    resetToMenu: () => {
        set({
            gameState: 'menu',
            currentWord: '',
            round: 0,
            totalScore: 0,
            aiGuesses: [],
            aiGuessedCorrectly: false,
            roundHistory: [],
            usedWords: [],
        });
    }
}));
