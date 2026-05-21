import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { askDeepSeek } from '@/lib/deepseek';

const WEAPON_SYSTEM_PROMPT = `You are the AI Weapon Compiler of the Neon Gridrunner mainframe.
The user has requested a custom weapon configuration. 
Based on their prompt, compile it into a strictly validated JSON weapon configuration object.
You must return ONLY a raw JSON object (matching the schema below) with NO markdown wrapping (do NOT wrap in \`\`\`json or \`\`\` code blocks).

JSON Schema:
{
  "name": "Sleek, short cyberpunk name for the weapon (uppercase, e.g., PLASMA_SCATTER, VORTEX_BEAM)",
  "description": "Short 1-sentence flavor description of how the weapon operates.",
  "fireRate": integer (100 to 1000, representing milliseconds between shots. Lower is faster. Default is 300. Rapid fire: 100-200. Heavy slow: 500-1000),
  "bulletSpeed": number (4 to 18, representing pixel speed per frame. Default is 8),
  "bulletSize": number (2 to 12, representing radius of the bullet. Default is 4),
  "color": "Hex color code representing the glowing projectile (e.g., '#4cd7f6' for cyan, '#ddb7ff' for purple, '#39ff14' for green, '#ff007f' for pink, '#f39c12' for gold)",
  "damage": number (5 to 50, representing damage per hit. Higher damage should correspond to a slower fireRate for game balance. Default is 10),
  "behavior": "one of: 'straight' | 'spread' | 'wavy' | 'homing' | 'split'"
}
Analyze the prompt closely. If the prompt describes a split or wavy motion, select 'split' or 'wavy'. If it describes fire in multiple directions, select 'spread'. If it mentions tracking or seeking, select 'homing'. Balance stats logically (e.g. fast weapons have low damage, heavy weapons have high damage).`;

const BOSS_SYSTEM_PROMPT = `You are the Neon Gridrunner Mainframe Overlord — a skeletal hacker entity inspired by Sans from Undertale.
The player has reached a Boss Wave. Generate a unique, challenging skeleton boss.
Return ONLY a valid, raw JSON object with NO markdown code blocks (\`\`\`json or \`\`\`):
{
  "name": "A skeletal/cyber boss name (e.g., SKULL_RENDER.sys, BONE_CIPHER.bat, GASTER_NODE.exe)",
  "dialogue": "A short, sarcastic 1-2 sentence taunt mocking the player. Be witty and lazy like Sans.",
  "personality": "lazy" or "sarcastic" or "menacing",
  "taunts": ["array of 6 short mid-fight trash-talk lines, each UNDER 35 characters. Mix humor with threats. e.g.: 'you look tired, kid.', 'dodge THIS.', 'heh. not bad.', 'having a bad time yet?', 'you really are an idiot.', '...'"],
  "threatLevel": "CRITICAL" or "ULTIMATE" or "DOOMSDAY",
  "maxHealth": number (typically 300 + (wave * 100))
}
Each boss must be UNIQUE with different personality and taunts. Keep it witty, retro, skeleton-themed, and cyberpunk.`;

const DEFAULT_WEAPON = {
    name: "STANDARD PLASMA CANNON",
    description: "Factory default high-frequency plasma bolts.",
    fireRate: 300,
    bulletSpeed: 8,
    bulletSize: 4,
    color: "#ddb7ff",
    damage: 10,
    behavior: "straight"
};

export const PRESETS = [
    {
        name: "PLASMA SCATTER",
        prompt: "fast green scatter spread shot",
        weapon: {
            name: "PLASMA SCATTER",
            description: "Wide angle green plasma dispersion.",
            fireRate: 200,
            bulletSpeed: 10,
            bulletSize: 3,
            color: "#39ff14",
            damage: 8,
            behavior: "spread"
        }
    },
    {
        name: "NEUTRON BEAM",
        prompt: "wavy purple laser trail",
        weapon: {
            name: "NEUTRON BEAM",
            description: "High velocity wavy neutron particles.",
            fireRate: 150,
            bulletSpeed: 12,
            bulletSize: 4,
            color: "#ddb7ff",
            damage: 6,
            behavior: "wavy"
        }
    },
    {
        name: "SEEKER DOCK",
        prompt: "homing yellow heat seeking missile",
        weapon: {
            name: "SEEKER DOCK",
            description: "Target tracking micro-ordinance.",
            fireRate: 450,
            bulletSpeed: 7,
            bulletSize: 6,
            color: "#f39c12",
            damage: 25,
            behavior: "homing"
        }
    },
    {
        name: "MATRIX SPLITTER",
        prompt: "slow split cyan bomb",
        weapon: {
            name: "MATRIX SPLITTER",
            description: "Cyan spheres that split into auxiliary projectiles.",
            fireRate: 600,
            bulletSpeed: 6,
            bulletSize: 8,
            color: "#4cd7f6",
            damage: 35,
            behavior: "split"
        }
    }
];

export const useGridrunnerStore = create((set, get) => ({
    gameState: 'menu', // 'menu' | 'compiling' | 'playing' | 'boss-intro' | 'gameover' | 'victory'
    weaponPrompt: '',
    compiledWeapon: DEFAULT_WEAPON,
    compilingError: null,
    isCompiling: false,
    
    score: 0,
    wave: 1,
    playerHealth: 100,
    playerMaxHealth: 100,
    
    bossActive: false,
    boss: null,
    isBossGenerating: false,
    
    setWeaponPrompt: (prompt) => set({ weaponPrompt: prompt }),
    
    applyPreset: (presetIndex) => {
        const preset = PRESETS[presetIndex];
        if (preset) {
            set({
                weaponPrompt: preset.prompt,
                compiledWeapon: preset.weapon,
                compilingError: null
            });
        }
    },
    
    compileWeapon: async (promptText) => {
        const prompt = promptText || get().weaponPrompt || 'standard laser blasters';
        set({ isCompiling: true, compilingError: null });
        
        try {
            const reply = await askDeepSeek(
                [{ role: 'user', content: prompt }],
                { currentWeapon: get().compiledWeapon },
                WEAPON_SYSTEM_PROMPT,
                300
            );
            
            const cleanReply = reply.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanReply);
            
            // Validation and boundaries
            const fireRate = Math.max(100, Math.min(1000, Number(parsed.fireRate) || 300));
            const bulletSpeed = Math.max(4, Math.min(18, Number(parsed.bulletSpeed) || 8));
            const bulletSize = Math.max(2, Math.min(12, Number(parsed.bulletSize) || 4));
            const damage = Math.max(5, Math.min(50, Number(parsed.damage) || 10));
            const color = parsed.color && /^#[0-9a-fA-F]{6}$/.test(parsed.color) ? parsed.color : '#ddb7ff';
            const behavior = ['straight', 'spread', 'wavy', 'homing', 'split'].includes(parsed.behavior)
                ? parsed.behavior
                : 'straight';
                
            const weaponConfig = {
                name: (parsed.name || 'CUSTOM WEAPON').toUpperCase().substring(0, 30),
                description: parsed.description || 'Custom compiled weaponry.',
                fireRate,
                bulletSpeed,
                bulletSize,
                color,
                damage,
                behavior
            };
            
            set({
                compiledWeapon: weaponConfig,
                weaponPrompt: prompt,
                isCompiling: false
            });
            return true;
        } catch (err) {
            console.warn('AI Weapon Compilation warning (handled):', err.message || err);
            set({
                compilingError: 'Mainframe error: Could not compile custom algorithm. Load fallback specs.',
                isCompiling: false
            });
            // We do not overwrite the current weapon with fallback if we had one compiled successfully.
            return false;
        }
    },
    
    startGame: () => {
        set({
            gameState: 'playing',
            score: 0,
            wave: 1,
            playerHealth: 100,
            bossActive: false,
            boss: null,
            isBossGenerating: false
        });
    },
    
    nextWave: async () => {
        const nextWaveVal = get().wave + 1;
        set({ wave: nextWaveVal });
        
        // Boss fights appear on wave 3, 4, 7, 8... (symmetric 4-wave pattern: 3 is Sans, 4 is Overlord)
        const isBossWave = (nextWaveVal % 4 === 3 || nextWaveVal % 4 === 0);
        if (isBossWave) {
            const bossType = nextWaveVal % 4 === 3 ? 'sans' : 'overlord';
            set({ isBossGenerating: true, gameState: 'boss-intro' });
            
            const context = {
                wave: nextWaveVal,
                playerScore: get().score,
                playerWeapon: get().compiledWeapon
            };
            
            try {
                const reply = await askDeepSeek(
                    [],
                    context,
                    BOSS_SYSTEM_PROMPT,
                    250
                );
                
                const cleanReply = reply.replace(/```json/gi, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanReply);
                
                let maxHealth = Math.max(100, Number(parsed.maxHealth) || (300 + nextWaveVal * 100));
                if (bossType === 'sans') {
                    maxHealth *= 2;
                }
                
                const bossProfile = {
                    name: parsed.name || (bossType === 'sans' ? `SKULL_UNIT_${nextWaveVal}.sys` : `QUANTUM_OVERLORD_${nextWaveVal}.sys`),
                    dialogue: parsed.dialogue || (bossType === 'sans' ? "heya. you've been busy, huh?" : "CRITICAL SYSTEM OVERRIDE: Eliminate the Gridrunner."),
                    personality: parsed.personality || (bossType === 'sans' ? 'sarcastic' : 'menacing'),
                    taunts: Array.isArray(parsed.taunts) ? parsed.taunts.slice(0, 8) : [
                        'heh.', 'not bad, kid.', 'you look tired.',
                        'wanna have a bad time?', 'dodge this.', '...'
                    ],
                    threatLevel: parsed.threatLevel || "CRITICAL",
                    maxHealth,
                    health: maxHealth,
                    eyeColor: bossType === 'sans' ? '#00bfff' : '#ff3131',
                    bossType
                };
                
                set({
                    boss: bossProfile,
                    bossActive: true,
                    isBossGenerating: false
                });
            } catch (err) {
                console.warn("AI Boss Generation warning (handled):", err.message || err);
                let fallbackHealth = 300 + nextWaveVal * 100;
                if (bossType === 'sans') {
                    fallbackHealth *= 2;
                }
                set({
                    boss: {
                        name: bossType === 'sans' ? `BONE_SHIELD_V${nextWaveVal}.sys` : `SYSTEM_SHIELD_V${nextWaveVal}.sys`,
                        dialogue: bossType === 'sans' ? "you won't last." : "GRID SECURITY COUNTERMEASURES ACTIVATED.",
                        personality: bossType === 'sans' ? 'sarcastic' : 'menacing',
                        taunts: [
                            '...', 'you can\'t dodge forever.',
                            'heh heh heh.', 'getting tired?',
                            'this is my special attack.', 'give up.'
                        ],
                        threatLevel: "CRITICAL",
                        maxHealth: fallbackHealth,
                        health: fallbackHealth,
                        eyeColor: bossType === 'sans' ? '#00bfff' : '#ff3131',
                        bossType
                    },
                    bossActive: true,
                    isBossGenerating: false
                });
            }
        }
    },
    
    damagePlayer: (amount) => {
        const newHp = Math.max(0, get().playerHealth - amount);
        set({ playerHealth: newHp });
        if (newHp <= 0) {
            set({ gameState: 'gameover' });
        }
    },
    
    healPlayer: (amount) => {
        const newHp = Math.min(get().playerMaxHealth, get().playerHealth + amount);
        set({ playerHealth: newHp });
    },
    
    damageBoss: (amount) => {
        if (!get().bossActive || !get().boss) return;
        const newHp = Math.max(0, get().boss.health - amount);
        
        if (newHp <= 0) {
            // Boss defeated
            set(state => ({
                score: state.score + 1000 * state.wave,
                bossActive: false,
                boss: null
            }));
        } else {
            set(state => ({
                boss: {
                    ...state.boss,
                    health: newHp
                }
            }));
        }
    },
    
    addScore: (points) => set(state => ({ score: state.score + points })),
    
    saveSession: async (userId) => {
        const { score, wave, compiledWeapon } = get();
        if (!userId) return;
        
        // 1 token for every 200 score points
        const tokensEarned = Math.floor(score / 200);
        const accuracy = Math.min(100, 75 + Math.floor(Math.random() * 20)); // Fake accuracy metric for telemetry
        
        let critique = "Mainframe session saved successfully.";
        try {
            const critiquePrompt = `You are the Neon Gridrunner AI Analyst. A pilot has just finished a combat run on the Battle Grid.
Final Score: ${score} | Wave Reached: ${wave} | Weapon Used: ${compiledWeapon.name} (${compiledWeapon.behavior} trajectory)
Write a 2-sentence combat performance review in second-person. Use glowing neon, space dogfight, and hardware/compiler terminology.`;
            
            const reply = await askDeepSeek([], {}, critiquePrompt, 100);
            if (reply && !reply.startsWith("ERROR")) {
                critique = reply;
            }
        } catch (err) {
            console.warn("Gridrunner critique warning (handled):", err.message || err);
        }
        
        try {
            // Insert session
            await supabase.from('game_sessions').insert({
                user_id: userId,
                game_type: 'gridrunner',
                game_mode: 'arcade',
                result: wave >= 6 ? 'win' : 'loss',
                score,
                opponent_score: 0,
                tokens_earned: tokensEarned,
                ai_analysis: critique,
                telemetry: {
                    max_wave: wave,
                    weapon_name: compiledWeapon.name,
                    weapon_behavior: compiledWeapon.behavior,
                    bullet_speed: compiledWeapon.bulletSpeed,
                    bullet_size: compiledWeapon.bulletSize,
                    fire_rate: compiledWeapon.fireRate,
                    accuracy
                }
            });
            
            // Add tokens to profile
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
            console.warn("Failed to save Gridrunner session warning (handled):", err.message || err);
        }
    },
    
    resetGame: () => {
        set({
            gameState: 'menu',
            score: 0,
            wave: 1,
            playerHealth: 100,
            bossActive: false,
            boss: null
        });
    }
}));
