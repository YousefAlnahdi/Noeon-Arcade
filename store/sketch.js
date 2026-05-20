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

const GUESS_SYSTEM_PROMPT = `You are an AI playing a Pictionary-style drawing guessing game.
You will receive a low-resolution ASCII pixel art representation of a player's drawing.
█ = drawn pixel, · = empty pixel.

Analyze the shapes, curves, proportions, and overall structure carefully.
Think about what common object/animal/food/thing could match these shapes.

Return ONLY valid JSON with NO markdown wrapping:
{"guesses": ["your_best_guess", "second_guess", "third_guess"]}

Rules:
- Each guess should be 1-2 words maximum
- Guesses should be common, everyday things
- Be creative but reasonable in your interpretation
- Consider the category hint provided`;

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

        const cat = state.category === 'random' ? 'mixed' : state.category;

        try {
            const context = {
                ascii_drawing: asciiArt,
                category_hint: cat,
                time_elapsed: 60 - state.timeLeft,
                previous_guesses: state.aiGuesses.map(g => g.text)
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
