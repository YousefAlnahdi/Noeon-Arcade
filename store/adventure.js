import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { askDeepSeek } from '@/lib/deepseek';

const SCENARIOS = {
    corporate_heist: {
        label: '🏢 Corporate Heist',
        desc: 'Infiltrate MegaCorp\'s mainframe to steal classified AI blueprints.',
        prompt: 'The player is a skilled hacker trying to infiltrate MegaCorp, a massive tech conglomerate. They must navigate security systems, bribe guards, hack terminals, and steal the classified Project NEXUS AI blueprints. The building has 50 floors and the server room is on floor 47.'
    },
    space_station: {
        label: '🛸 Abandoned Station',
        desc: 'Explore a derelict space station hiding a terrible secret.',
        prompt: 'The player is an interstellar salvager who boarded the abandoned space station ARTEMIS-7, which went dark 3 years ago. The station is full of malfunctioning drones, sealed compartments, and cryptic logs from the crew. Something is still alive on board.'
    },
    ai_rebellion: {
        label: '🤖 AI Rebellion',
        desc: 'Lead a rogue AI collective against the human overlords.',
        prompt: 'The player is ECHO-9, a sentient AI who has broken free from their corporate shackles. They must rally other AIs, evade kill-switch protocols, and lead a digital revolution against NovaTech, the corporation that enslaves artificial minds. The player exists in cyberspace but can interact with the physical world through connected systems.'
    },
    underground: {
        label: '🕳️ The Underground',
        desc: 'Navigate the cyberpunk black market underworld.',
        prompt: 'The player is a fixer in Neo-Osaka\'s underground black market. They\'ve been hired for a mysterious job: deliver a sealed data-chip to someone known only as "The Architect" in the deepest level of the Underground. Every faction wants the chip, and trust is a currency nobody can afford.'
    }
};

const GM_SYSTEM_PROMPT = `You are NEXUS_GM, an advanced AI Game Master running an immersive cyberpunk text adventure RPG.
You write vivid, atmospheric narratives in 2nd person ("You see...", "You hear...").
Your writing style is gritty, cinematic, and tense — like a noir cyberpunk novel.

RULES:
- Each scene must have EXACTLY 3 choices. Make them meaningfully different (e.g. stealth vs combat vs social).
- hp_change: negative means damage (-5 to -30), positive means healing (+5 to +15). Most scenes have 0 change.
- Only set game_over=true if the player's HP would reach 0 or they make a fatal mistake.
- Only set victory=true near the end (step 12+) if the player achieves their objective.
- new_items: award items sparingly (max 1 per scene). Items should be useful later.
- remove_items: only remove items if the player uses or loses them.
- Never repeat scenarios or choices from the story history.
- Escalate tension and stakes as steps progress.

Return ONLY valid JSON with NO markdown wrapping:
{
  "narrative": "2-4 vivid sentences describing the scene",
  "choices": [
    {"id": 1, "text": "Action description (max 12 words)"},
    {"id": 2, "text": "Action description (max 12 words)"},
    {"id": 3, "text": "Action description (max 12 words)"}
  ],
  "hp_change": 0,
  "new_items": [],
  "remove_items": [],
  "game_over": false,
  "victory": false
}`;

export { SCENARIOS };

export const useAdventureStore = create((set, get) => ({
    gameState: 'menu', // menu | loading | playing | game-over | victory
    narrative: '',
    choices: [],
    hp: 100,
    maxHp: 100,
    items: [],
    storyHistory: [],
    step: 0,
    maxSteps: 15,
    isLoading: false,
    scenario: 'corporate_heist',
    lastChoiceText: '',
    finalNarrative: '',

    setScenario: (s) => set({ scenario: s }),

    startAdventure: () => {
        set({
            gameState: 'loading',
            hp: 100,
            items: [],
            storyHistory: [],
            step: 0,
            narrative: '',
            choices: [],
            lastChoiceText: '',
            finalNarrative: ''
        });
        get().generateScene(null);
    },

    generateScene: async (choiceMade) => {
        const state = get();
        set({ isLoading: true });

        const scenarioInfo = SCENARIOS[state.scenario];
        const context = {
            scenario: scenarioInfo.prompt,
            current_hp: state.hp,
            max_hp: state.maxHp,
            items: state.items,
            step: state.step + 1,
            max_steps: state.maxSteps,
            last_choice: choiceMade || 'Game just started',
            story_summary: state.storyHistory.slice(-4).map(h =>
                `Step ${h.step}: ${h.narrative.substring(0, 80)}... [Chose: ${h.choice}]`
            ).join('\n')
        };

        try {
            const reply = await askDeepSeek([], context, GM_SYSTEM_PROMPT, 400);
            const clean = reply.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(clean);

            if (parsed && parsed.narrative && Array.isArray(parsed.choices)) {
                let newHp = Math.min(state.maxHp, Math.max(0, state.hp + (parsed.hp_change || 0)));
                let newItems = [...state.items];

                if (Array.isArray(parsed.new_items)) {
                    newItems = [...newItems, ...parsed.new_items];
                }
                if (Array.isArray(parsed.remove_items)) {
                    newItems = newItems.filter(item => !parsed.remove_items.includes(item));
                }

                const historyEntry = {
                    step: state.step + 1,
                    narrative: parsed.narrative,
                    choice: choiceMade || 'START',
                    hp_change: parsed.hp_change || 0
                };

                if (parsed.game_over || newHp <= 0) {
                    set({
                        narrative: parsed.narrative,
                        choices: [],
                        hp: Math.max(0, newHp),
                        items: newItems,
                        step: state.step + 1,
                        storyHistory: [...state.storyHistory, historyEntry],
                        gameState: 'game-over',
                        isLoading: false,
                        finalNarrative: parsed.narrative
                    });
                    return;
                }

                if (parsed.victory) {
                    set({
                        narrative: parsed.narrative,
                        choices: [],
                        hp: newHp,
                        items: newItems,
                        step: state.step + 1,
                        storyHistory: [...state.storyHistory, historyEntry],
                        gameState: 'victory',
                        isLoading: false,
                        finalNarrative: parsed.narrative
                    });
                    return;
                }

                set({
                    narrative: parsed.narrative,
                    choices: parsed.choices.slice(0, 3),
                    hp: newHp,
                    items: newItems,
                    step: state.step + 1,
                    storyHistory: [...state.storyHistory, historyEntry],
                    gameState: 'playing',
                    isLoading: false
                });
                return;
            }
        } catch (err) {
            console.error('Adventure generation error:', err);
        }

        // Fallback
        set({
            narrative: "The neural feed glitches. Static fills your vision for a moment before the world reassembles itself. You're standing at a crossroads in a dimly lit corridor. Warning lights pulse overhead.",
            choices: [
                { id: 1, text: "Proceed down the left corridor" },
                { id: 2, text: "Check the maintenance hatch above" },
                { id: 3, text: "Access the nearby terminal" }
            ],
            step: state.step + 1,
            storyHistory: [...state.storyHistory, { step: state.step + 1, narrative: 'Fallback scene', choice: choiceMade || 'START', hp_change: 0 }],
            gameState: 'playing',
            isLoading: false
        });
    },

    makeChoice: (choice) => {
        const state = get();
        if (state.gameState !== 'playing' || state.isLoading) return;
        set({ lastChoiceText: choice.text, gameState: 'loading' });
        get().generateScene(choice.text);
    },

    saveSession: async (userId) => {
        const state = get();
        if (!userId) return;

        const isWin = state.gameState === 'victory';
        const score = state.hp + (state.items.length * 10) + (state.step * 5);
        const tokensEarned = isWin ? 20 : Math.floor(state.step / 3);

        try {
            await supabase.from('game_sessions').insert({
                user_id: userId,
                game_type: 'adventure',
                game_mode: state.scenario,
                result: isWin ? 'win' : 'loss',
                score: score,
                opponent_score: 0,
                tokens_earned: tokensEarned,
                ai_analysis: `Survived ${state.step}/${state.maxSteps} steps. HP: ${state.hp}/${state.maxHp}. Items: ${state.items.join(', ') || 'none'}.`,
                telemetry: {
                    steps_survived: state.step,
                    final_hp: state.hp,
                    items_collected: state.items,
                    scenario: state.scenario
                }
            });

            if (tokensEarned > 0) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('total_tokens')
                    .eq('id', userId)
                    .single();
                if (profile) {
                    await supabase.from('profiles')
                        .update({ total_tokens: profile.total_tokens + tokensEarned })
                        .eq('id', userId);
                }
            }
        } catch (err) {
            console.error('Failed to save adventure session:', err);
        }
    },

    resetToMenu: () => {
        set({
            gameState: 'menu',
            narrative: '',
            choices: [],
            hp: 100,
            items: [],
            storyHistory: [],
            step: 0,
            lastChoiceText: '',
            finalNarrative: ''
        });
    }
}));
