'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { useGridrunnerStore, PRESETS } from '@/store/gridrunner';
import { supabase } from '@/lib/supabase';

const HAZARD_DETAILS = {
    NORMAL: { name: 'NORMAL', banner: 'GRID SEQUENCE INITIATED', desc: 'Mainframe stability at 100%' },
    SOLAR_FLARE: { name: 'SOLAR FLARE', banner: 'SOLAR FLARE INCOMING', desc: 'Enemy projectile velocity increased (+50%)' },
    GRAVITY_WELL: { name: 'GRAVITY WELL', banner: 'GRAVITY WELL DETECTED', desc: 'Player thruster speed dampening active (-30%)' },
    CHROME_SHIELD: { name: 'CHROME SHIELD', banner: 'CHROME SHIELD UPLINK ACTIVE', desc: 'Hostile mainframe defense buffer: Enemy health increased (+50%)' },
    SUPERCHARGE: { name: 'SUPERCHARGE', banner: 'GRID SUPERCHARGE DETECTED', desc: 'Weapon compiler re-routed: Player fire rate doubled!' }
};
// Removes the white background of the sprite by performing a flood-fill from the borders
function makeSpriteBackgroundTransparent(img) {
    if (typeof window === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const width = imgData.width;
    const height = imgData.height;

    const visited = new Uint8Array(width * height);
    const queue = [];

    const isWhite = (r, g, b, a) => {
        if (a === 0) return false;
        // White/near-white check
        return r > 220 && g > 220 && b > 220;
    };

    // Add all border pixels to queue if they are white/near-white
    for (let x = 0; x < width; x++) {
        // Top edge
        const topIdx = x;
        if (isWhite(data[topIdx * 4], data[topIdx * 4 + 1], data[topIdx * 4 + 2], data[topIdx * 4 + 3])) {
            queue.push(x, 0);
            visited[topIdx] = 1;
        }
        // Bottom edge
        const btmIdx = x + (height - 1) * width;
        if (isWhite(data[btmIdx * 4], data[btmIdx * 4 + 1], data[btmIdx * 4 + 2], data[btmIdx * 4 + 3])) {
            queue.push(x, height - 1);
            visited[btmIdx] = 1;
        }
    }
    for (let y = 0; y < height; y++) {
        // Left edge
        const lftIdx = y * width;
        if (isWhite(data[lftIdx * 4], data[lftIdx * 4 + 1], data[lftIdx * 4 + 2], data[lftIdx * 4 + 3])) {
            queue.push(0, y);
            visited[lftIdx] = 1;
        }
        // Right edge
        const rgtIdx = (width - 1) + y * width;
        if (isWhite(data[rgtIdx * 4], data[rgtIdx * 4 + 1], data[rgtIdx * 4 + 2], data[rgtIdx * 4 + 3])) {
            queue.push(width - 1, y);
            visited[rgtIdx] = 1;
        }
    }

    let head = 0;
    const dirs = [
        [0, 1], [0, -1], [1, 0], [-1, 0]
    ];

    while (head < queue.length) {
        const x = queue[head++];
        const y = queue[head++];

        const pIdx = (x + y * width) * 4;
        data[pIdx + 3] = 0; // set alpha to 0

        for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = nx + ny * width;
                if (visited[nIdx] === 0) {
                    const npIdx = nIdx * 4;
                    if (isWhite(data[npIdx], data[npIdx + 1], data[npIdx + 2], data[npIdx + 3])) {
                        queue.push(nx, ny);
                        visited[nIdx] = 1;
                    }
                }
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
}

export default function GridrunnerPage() {
    const { user, playerProfile, refreshProfile } = useAuth();
    const [healthPacks, setHealthPacks] = useState(0);
    const isUsingHealRef = useRef(false);
    const useHealthPackRef = useRef(null);

    const playerProfileRef = useRef(playerProfile);
    useEffect(() => {
        playerProfileRef.current = playerProfile;
        if (playerProfile?.unlocked_items) {
            const count = playerProfile.unlocked_items.filter(item => item === 'item:health_pack').length;
            setHealthPacks(count);
        }
    }, [playerProfile]);

    // Force fetch absolute latest profile state on mount/auth load to prevent stale state or CDC delays
    useEffect(() => {
        if (!user) return;
        const fetchLatestProfile = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('unlocked_items')
                    .eq('id', user.id)
                    .single();
                if (data && data.unlocked_items) {
                    if (playerProfileRef.current) {
                        playerProfileRef.current = {
                            ...playerProfileRef.current,
                            unlocked_items: data.unlocked_items
                        };
                    } else {
                        playerProfileRef.current = {
                            unlocked_items: data.unlocked_items
                        };
                    }
                    const count = data.unlocked_items.filter(item => item === 'item:health_pack').length;
                    setHealthPacks(count);
                }
            } catch (err) {
                console.warn('Error fetching latest profile on mount:', err.message || err);
            }
        };
        fetchLatestProfile();
    }, [user]);

    const userRef = useRef(user);
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    const useHealthPack = async () => {
        if (!userRef.current || isUsingHealRef.current) return;
        
        // 1. Guard against local count first to prevent any race conditions or using empty packs
        if (healthPacks <= 0) {
            return;
        }

        const store = useGridrunnerStore.getState();
        const currentHealth = store.playerHealth;
        const maxHealth = store.playerMaxHealth;
        
        if (currentHealth >= maxHealth) {
            return; // Already full health
        }

        const unlockedItems = playerProfileRef.current?.unlocked_items || [];
        const index = unlockedItems.indexOf('item:health_pack');
        if (index === -1) {
            return; // No health packs available
        }

        isUsingHealRef.current = true;
        
        // 2. Heal
        store.healPlayer(35);
        synthSound('heal');

        // 3. Remove one health pack locally
        setHealthPacks(prev => Math.max(0, prev - 1));

        // 4. Remove one from unlocked items and update Supabase
        const newUnlockedItems = [...unlockedItems];
        newUnlockedItems.splice(index, 1);

        // Update playerProfileRef.current synchronously so subsequent calls are immediately blocked
        if (playerProfileRef.current) {
            playerProfileRef.current = {
                ...playerProfileRef.current,
                unlocked_items: newUnlockedItems
            };
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ unlocked_items: newUnlockedItems })
                .eq('id', userRef.current.id);
            if (error) throw error;

            // Sync with global auth state immediately
            if (refreshProfile) {
                await refreshProfile();
            }
        } catch (err) {
            console.warn('Failed to consume health pack in DB:', err.message || err);
        } finally {
            isUsingHealRef.current = false;
        }
    };

    // Update ref to avoid stale closures
    useEffect(() => {
        useHealthPackRef.current = useHealthPack;
    });


    const {
        gameState,
        weaponPrompt,
        compiledWeapon,
        compilingError,
        isCompiling,
        score,
        wave,
        playerHealth,
        playerMaxHealth,
        bossActive,
        boss,
        isBossGenerating,
        setWeaponPrompt,
        applyPreset,
        compileWeapon,
        startGame,
        damagePlayer,
        damageBoss,
        addScore,
        nextWave,
        saveSession,
        resetGame,
        healPlayer
    } = useGridrunnerStore();

    const [soundEnabled, setSoundEnabled] = useState(true);
    const [saved, setSaved] = useState(false);
    const [promptInput, setPromptInput] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    const [shieldTimeLeft, setShieldTimeLeft] = useState(0);
    const [overchargeTimeLeft, setOverchargeTimeLeft] = useState(0);
    const [hazard, setHazard] = useState('NORMAL');
    const [bannerActive, setBannerActive] = useState(false);

    const canvasRef = useRef(null);
    const sansCanvasRef = useRef(null);
    const sansMusicRef = useRef(null);
    const keysRef = useRef({});
    const gameLoopRef = useRef(null);
    const shootCooldownRef = useRef(0);

    // Keep track of soundEnabled using a ref to avoid stale closures in the high-performance game loop
    const soundEnabledRef = useRef(soundEnabled);
    useEffect(() => {
        soundEnabledRef.current = soundEnabled;
    }, [soundEnabled]);

    // Keep track of isPaused using a ref to avoid stale closures in the loop
    const isPausedRef = useRef(isPaused);
    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    // Game entity arrays stored in refs for 60fps performance without React re-render lags
    const playerRef = useRef({ x: 400, y: 480, width: 32, height: 32, speed: 6 });
    const bulletsRef = useRef([]);
    const enemiesRef = useRef([]);
    const enemyBulletsRef = useRef([]);
    const particlesRef = useRef([]);
    const starfieldRef = useRef([]);
    const gridOffsetRef = useRef(0);
    const timeRef = useRef(0);

    // Dynamic state synchronization refs to eliminate game loop restarts and stale closures
    const compiledWeaponRef = useRef(compiledWeapon);
    useEffect(() => {
        compiledWeaponRef.current = compiledWeapon;
    }, [compiledWeapon]);

    const waveRef = useRef(wave);
    useEffect(() => {
        waveRef.current = wave;
    }, [wave]);

    const bossActiveRef = useRef(bossActive);
    useEffect(() => {
        bossActiveRef.current = bossActive;
    }, [bossActive]);

    const bossRef = useRef(boss);
    useEffect(() => {
        bossRef.current = boss;
    }, [boss]);

    const isBossGeneratingRef = useRef(isBossGenerating);
    useEffect(() => {
        isBossGeneratingRef.current = isBossGenerating;
    }, [isBossGenerating]);

    // Timers and combat hazard refs
    const shieldTimeRef = useRef(0);
    const overchargeTimeRef = useRef(0);
    const hazardRef = useRef('NORMAL');
    const shakeRef = useRef(0);
    const flashRef = useRef(0);
    const powerupsRef = useRef([]);
    const isTransitioningWaveRef = useRef(false);

    // Sans Boss Fight refs
    const bossAttacksRef = useRef([]);       // active bone walls and beams
    const bossTauntRef = useRef({ text: '', timer: 0, fadeTimer: 0 });
    const bossPhaseRef = useRef(1);
    const bossAttackTimerRef = useRef(0);
    const iFramesRef = useRef(0);            // invincibility frames after boss attack damage
    const sensitivityRef = useRef(1.0);      // player speed sensitivity multiplier
    const [sensitivity, setSensitivity] = useState(1.0);

    // Audio synthesizer helper
    const synthSound = (type) => {
        if (!soundEnabledRef.current || typeof window === 'undefined') return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContextClass();
            
            if (type === 'shoot') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                // Laser frequency sweep
                osc.frequency.setValueAtTime(600, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.12);
                
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
                
                osc.start();
                osc.stop(ctx.currentTime + 0.12);
            } else if (type === 'explosion') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sawtooth';
                
                // Exploding downward crash
                osc.frequency.setValueAtTime(180, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(30, ctx.currentTime + 0.35);
                
                gain.gain.setValueAtTime(0.18, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
                
                osc.start();
                osc.stop(ctx.currentTime + 0.35);
            } else if (type === 'hit') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.frequency.setValueAtTime(240, ctx.currentTime);
                gain.gain.setValueAtTime(0.06, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
                
                osc.start();
                osc.stop(ctx.currentTime + 0.05);
            } else if (type === 'boss_alert') {
                // Siren dual warning
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(ctx.destination);
                
                osc1.frequency.setValueAtTime(150, ctx.currentTime);
                osc1.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.3);
                
                osc2.frequency.setValueAtTime(155, ctx.currentTime);
                osc2.frequency.linearRampToValueAtTime(225, ctx.currentTime + 0.3);
                
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.4);
                
                osc1.start();
                osc2.start();
                osc1.stop(ctx.currentTime + 0.4);
                osc2.stop(ctx.currentTime + 0.4);
            } else if (type === 'heal') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                
                // Rising pitch sweep for healing
                osc.frequency.setValueAtTime(300, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.35);
                
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
                
                osc.start();
                osc.stop(ctx.currentTime + 0.35);
            }
        } catch (e) {
            console.warn('Audio synthesizer warning (handled):', e.message || e);
        }
    };

    // Preload the high-quality Sans boss soundtrack on mount
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!sansMusicRef.current) {
            sansMusicRef.current = new Audio('/068. Death By Glamour (UNDERTALE Soundtrack) - Toby Fox.mp3');
            sansMusicRef.current.loop = true;
            sansMusicRef.current.volume = 0.35;
            sansMusicRef.current.preload = 'auto';
        }
        
        return () => {
            if (sansMusicRef.current) {
                sansMusicRef.current.pause();
                sansMusicRef.current.currentTime = 0;
            }
        };
    }, []);

    // Sans Boss Fight Soundtrack State Controller
    useEffect(() => {
        if (typeof window === 'undefined' || !sansMusicRef.current) return;

        const isSansFight = (gameState === 'playing' || gameState === 'boss-intro') && boss && boss.bossType === 'sans';

        if (isSansFight && soundEnabled && !isPaused) {
            if (sansMusicRef.current.paused) {
                const playPromise = sansMusicRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        if (e.name !== 'AbortError') {
                            console.warn("Failed to play Sans boss theme:", e);
                        }
                    });
                }
            }
        } else {
            if (!sansMusicRef.current.paused) {
                if (isPaused && (gameState === 'playing' || gameState === 'boss-intro') && boss && boss.bossType === 'sans') {
                    sansMusicRef.current.pause();
                } else {
                    sansMusicRef.current.pause();
                    sansMusicRef.current.currentTime = 0;
                }
            }
        }

        return () => {
            if (sansMusicRef.current && (gameState === 'gameover' || gameState === 'menu' || !isSansFight)) {
                sansMusicRef.current.pause();
                sansMusicRef.current.currentTime = 0;
            }
        };
    }, [gameState, boss, soundEnabled, isPaused]);

    // Keyboard handlers
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) && gameState === 'playing') {
                e.preventDefault(); // Stop page scrolling
            }
            if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && gameState === 'playing') {
                e.preventDefault();
                setIsPaused(prev => !prev);
            }
            if ((e.key === 'h' || e.key === 'H') && gameState === 'playing') {
                e.preventDefault();
                if (useHealthPackRef.current) {
                    useHealthPackRef.current();
                }
            }
            keysRef.current[e.key] = true;
        };

        const handleKeyUp = (e) => {
            keysRef.current[e.key] = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // Generate background stars once
        const stars = [];
        for (let i = 0; i < 40; i++) {
            stars.push({
                x: Math.random() * 800,
                y: Math.random() * 550,
                speed: Math.random() * 1.5 + 0.5,
                size: Math.random() * 2 + 0.5
            });
        }
        starfieldRef.current = stars;

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameState]);

    // Handle session auto-saving when entering gameover state
    useEffect(() => {
        if (gameState === 'gameover' && !saved) {
            setSaved(true);
            if (user) {
                saveSession(user.id);
            } else {
                saveSession('mock-user-id'); // fallback
            }
        }
    }, [gameState, user, saveSession, saved]);

    // Trigger sound alerts on state transition
    useEffect(() => {
        if (gameState === 'playing') {
            setSaved(false);
            synthSound('boss_alert');
        } else if (gameState === 'boss-intro') {
            synthSound('boss_alert');
        }
    }, [gameState]);

    // Listen to wave sector progress and assign random hazard modifiers
    useEffect(() => {
        if (gameState === 'playing') {
            // Select random hazard
            const hazards = ['NORMAL', 'SOLAR_FLARE', 'GRAVITY_WELL', 'CHROME_SHIELD', 'SUPERCHARGE'];
            const rand = Math.random();
            let chosenHazard = 'NORMAL';
            
            // 25% chance of normal, 75% chance of cyber-hazard
            if (rand > 0.25) {
                const idx = 1 + Math.floor(Math.random() * (hazards.length - 1));
                chosenHazard = hazards[idx];
            }
            
            setHazard(chosenHazard);
            hazardRef.current = chosenHazard;
            
            // Launch neon display alert
            setBannerActive(true);
            const bannerTimer = setTimeout(() => {
                setBannerActive(false);
            }, 3500);

            // Trigger visual shockwave
            shakeRef.current = 25;
            
            return () => clearTimeout(bannerTimer);
        }
    }, [wave, gameState]);

    // Spawning enemies at the start of a wave, factoring in cyber-hazard status
    const spawnEnemyWave = () => {
        const currentWave = waveRef.current;
        const newEnemies = [];
        const rows = Math.min(4, 1 + Math.floor(currentWave / 2));
        const cols = Math.min(8, 4 + (currentWave % 4));
        
        const spacingX = 600 / (cols + 1);
        const spacingY = 50;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Enemy templates: fighters (classic), diving interceptors, heavy bombers
                let type = 'fighter';
                let health = 10 + currentWave * 5;
                let color = '#ff5722'; // Orange
                let scoreVal = 100 * currentWave;
                
                const rand = Math.random();
                if (currentWave >= 3 && rand > 0.7) {
                    type = 'interceptor';
                    health = 5 + currentWave * 3;
                    color = '#ffeb3b'; // Yellow (Fast)
                    scoreVal = 150 * currentWave;
                } else if (currentWave >= 5 && rand > 0.5) {
                    type = 'bomber';
                    health = 25 + currentWave * 8;
                    color = '#e91e63'; // Pink (Heavy)
                    scoreVal = 250 * currentWave;
                }

                // CHROME SHIELD modifier adds a 50% health buffer to enemies
                if (hazardRef.current === 'CHROME_SHIELD') {
                    health = Math.floor(health * 1.5);
                }

                newEnemies.push({
                    x: 100 + (c + 1) * spacingX,
                    y: 60 + r * spacingY,
                    width: 24,
                    height: 24,
                    startX: 100 + (c + 1) * spacingX,
                    startY: 60 + r * spacingY,
                    health,
                    maxHealth: health,
                    color,
                    type,
                    scoreVal,
                    vx: Math.sin(r + c) * 1.5,
                    vy: 0,
                    fireCooldown: Math.random() * 200 + 100 - currentWave * 5
                });
            }
        }
        enemiesRef.current = newEnemies;
    };

    // Spawn a power-up drop box at specified coordinates
    const spawnPowerup = (x, y) => {
        const types = ['repair', 'shield', 'overcharge', 'emp'];
        const colors = {
            repair: '#39ff14',      // green
            shield: '#00f0ff',      // cyan
            overcharge: '#ff00ff',  // magenta
            emp: '#ffeb3b'          // yellow
        };
        const type = types[Math.floor(Math.random() * types.length)];
        powerupsRef.current.push({
            x,
            y,
            vy: 1.5,
            type,
            color: colors[type],
            size: 10,
            pulse: 0
        });
    };

    // Spawn a bone wall attack (Sans-style bones with a dodge gap)
    const spawnBoneWall = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Limit max concurrent bone walls to prevent stacking
        const activeBones = bossAttacksRef.current.filter(a => a.type === 'bone_wall').length;
        if (activeBones >= 2) return;
        const player = playerRef.current;
        const phase = bossPhaseRef.current;
        const direction = Math.random() > 0.5 ? 'horizontal' : 'vertical';
        const speed = 1.4 + phase * 0.4;
        const gapSize = Math.max(70, 100 - phase * 8);

        if (direction === 'horizontal') {
            // Gap stays close to player (±80px) so they can actually reach it
            const gapStart = Math.max(30, Math.min(canvas.width - gapSize - 30,
                player.x - gapSize / 2 + (Math.random() - 0.5) * 100));
            const fromTop = Math.random() > 0.5;
            bossAttacksRef.current.push({
                type: 'bone_wall', direction: 'horizontal',
                position: fromTop ? -20 : canvas.height + 20,
                velocity: fromTop ? speed : -speed,
                gapStart, gapSize, thickness: 16,
                lifetime: 400, color: '#ffffff'
            });
        } else {
            const gapStart = Math.max(canvas.height * 0.3, Math.min(canvas.height - gapSize - 30,
                player.y - gapSize / 2 + (Math.random() - 0.5) * 80));
            const fromLeft = Math.random() > 0.5;
            bossAttacksRef.current.push({
                type: 'bone_wall', direction: 'vertical',
                position: fromLeft ? -20 : canvas.width + 20,
                velocity: fromLeft ? speed : -speed,
                gapStart, gapSize, thickness: 16,
                lifetime: 400, color: '#ffffff'
            });
        }
        synthSound('hit');
    };

    // Spawn a Gaster Blaster beam attack (warning line → wide beam with gap)
    const spawnGasterBeam = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Limit max concurrent beams
        const activeBeams = bossAttacksRef.current.filter(a => a.type === 'beam').length;
        if (activeBeams >= 1) return;
        const player = playerRef.current;
        const phase = bossPhaseRef.current;
        const isHorizontal = Math.random() > 0.5;
        const gapSize = Math.max(55, 75 - phase * 6);

        if (isHorizontal) {
            // Beam spawns AWAY from player (offset 80-200px) so they can see warning and react
            const offset = (Math.random() > 0.5 ? 1 : -1) * (80 + Math.random() * 120);
            const position = Math.max(60, Math.min(canvas.height - 60, player.y + offset));
            // Gap placed ON the player so they're safe if they don't panic-move
            const gapStart = Math.max(30, Math.min(canvas.width - gapSize - 30,
                player.x - gapSize / 2));
            bossAttacksRef.current.push({
                type: 'beam', direction: 'horizontal',
                position, chargeTime: 70, fireTime: 45, fadeTime: 15,
                phase: 'charging', timer: 70, beamWidth: 35,
                gapStart, gapSize, color: '#ffffff'
            });
        } else {
            const offset = (Math.random() > 0.5 ? 1 : -1) * (80 + Math.random() * 120);
            const position = Math.max(40, Math.min(canvas.width - 40, player.x + offset));
            const gapStart = Math.max(canvas.height * 0.3, Math.min(canvas.height - gapSize - 30,
                player.y - gapSize / 2));
            bossAttacksRef.current.push({
                type: 'beam', direction: 'vertical',
                position, chargeTime: 70, fireTime: 45, fadeTime: 15,
                phase: 'charging', timer: 70, beamWidth: 35,
                gapStart, gapSize, color: '#ffffff'
            });
        }
    };

    // Main game setup when launching play
    const handleStartClick = () => {
        setIsPaused(false);
        playerRef.current = { x: 400, y: 480, width: 32, height: 32, speed: 6 };
        bulletsRef.current = [];
        enemyBulletsRef.current = [];
        particlesRef.current = [];
        shootCooldownRef.current = 0;
        
        // Reset timers and hazard variables
        powerupsRef.current = [];
        shieldTimeRef.current = 0;
        overchargeTimeRef.current = 0;
        shakeRef.current = 0;
        flashRef.current = 0;
        waveRef.current = 1;
        hazardRef.current = 'NORMAL';
        isTransitioningWaveRef.current = false;
        bossAttacksRef.current = [];
        bossTauntRef.current = { text: '', timer: 0, fadeTimer: 0 };
        bossPhaseRef.current = 1;
        bossAttackTimerRef.current = 0;
        iFramesRef.current = 0;
        setShieldTimeLeft(0);
        setOverchargeTimeLeft(0);
        setHazard('NORMAL');
        setBannerActive(false);

        startGame();
        spawnEnemyWave();
    };

    // Abort active gridrun
    const handleAbortClick = () => {
        setIsPaused(false);
        
        // Clear active variables
        powerupsRef.current = [];
        shieldTimeRef.current = 0;
        overchargeTimeRef.current = 0;
        shakeRef.current = 0;
        flashRef.current = 0;
        waveRef.current = 1;
        hazardRef.current = 'NORMAL';
        isTransitioningWaveRef.current = false;
        bossAttacksRef.current = [];
        bossTauntRef.current = { text: '', timer: 0, fadeTimer: 0 };
        bossPhaseRef.current = 1;
        bossAttackTimerRef.current = 0;
        iFramesRef.current = 0;
        setShieldTimeLeft(0);
        setOverchargeTimeLeft(0);
        setHazard('NORMAL');
        setBannerActive(false);

        resetGame();
    };

    // Form weapon compiler submission
    const handleCompileSubmit = async (e) => {
        e.preventDefault();
        if (!promptInput.trim() || isCompiling) return;
        await compileWeapon(promptInput);
    };

    // Select preset from terminal list
    const handleSelectPreset = (idx) => {
        applyPreset(idx);
        const preset = PRESETS[idx];
        setPromptInput(preset.prompt);
    };

    // Preload Sans sprite and make background transparent
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const img = new Image();
        img.src = '/sans.png';
        img.onload = () => {
            sansCanvasRef.current = makeSpriteBackgroundTransparent(img);
        };
    }, []);

    // Main drawing and physics update loop
    useEffect(() => {
        if (gameState !== 'playing') {
            if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        const updatePhysics = () => {
            if (isPausedRef.current) return;
            timeRef.current++;
            
            // Decays and timers decrement
            if (shakeRef.current > 0) {
                shakeRef.current *= 0.9;
                if (shakeRef.current < 0.2) shakeRef.current = 0;
            }
            if (flashRef.current > 0) {
                flashRef.current -= 1;
            }
            if (iFramesRef.current > 0) {
                iFramesRef.current--;
            }
            if (shieldTimeRef.current > 0) {
                shieldTimeRef.current -= 16.7;
                if (shieldTimeRef.current <= 0) shieldTimeRef.current = 0;
            }
            if (overchargeTimeRef.current > 0) {
                overchargeTimeRef.current -= 16.7;
                if (overchargeTimeRef.current <= 0) overchargeTimeRef.current = 0;
            }

            // Sync timers to React state every 10 frames
            if (timeRef.current % 10 === 0) {
                setShieldTimeLeft(Math.ceil(shieldTimeRef.current / 1000));
                setOverchargeTimeLeft(Math.ceil(overchargeTimeRef.current / 1000));
            }

            // 1. Move Player (Gravity Well slows player speed)
            const player = playerRef.current;
            const keys = keysRef.current;
            const baseSpeed = 6;
            const hazardMul = hazardRef.current === 'GRAVITY_WELL' ? 0.7 : 1;
            const speed = baseSpeed * hazardMul * sensitivityRef.current;
            
            if (keys['ArrowLeft'] || keys['a']) player.x = Math.max(player.width / 2, player.x - speed);
            if (keys['ArrowRight'] || keys['d']) player.x = Math.min(canvas.width - player.width / 2, player.x + speed);
            if (keys['ArrowUp'] || keys['w']) player.y = Math.max(canvas.height / 2, player.y - speed); // restrict to lower half
            if (keys['ArrowDown'] || keys['s']) player.y = Math.min(canvas.height - player.height / 2, player.y + speed);

            // 2. Player Shooting cooldown
            if (shootCooldownRef.current > 0) {
                shootCooldownRef.current -= 16.7; // ~60fps tick in ms
            }

            if (keys[' '] && shootCooldownRef.current <= 0) {
                const weapon = compiledWeaponRef.current;
                
                // Calculate cooldown speed factoring in SUPERCHARGE wave and overcharge powerup
                let cooldown = weapon.fireRate;
                if (hazardRef.current === 'SUPERCHARGE') cooldown *= 0.5;
                if (overchargeTimeRef.current > 0) cooldown *= 0.5;
                shootCooldownRef.current = Math.max(80, cooldown); // Minimum cap for performance

                synthSound('shoot');

                const baseBullet = {
                    x: player.x,
                    y: player.y - 12,
                    vx: 0,
                    vy: -weapon.bulletSpeed,
                    size: weapon.bulletSize,
                    color: weapon.color,
                    damage: weapon.damage,
                    behavior: weapon.behavior,
                    age: 0,
                    startX: player.x
                };

                if (weapon.behavior === 'spread') {
                    // Angle spread shots
                    bulletsRef.current.push({
                        ...baseBullet,
                        vx: -weapon.bulletSpeed * 0.26,
                        vy: -weapon.bulletSpeed * 0.96
                    });
                    bulletsRef.current.push({
                        ...baseBullet,
                        vx: 0,
                        vy: -weapon.bulletSpeed
                    });
                    bulletsRef.current.push({
                        ...baseBullet,
                        vx: weapon.bulletSpeed * 0.26,
                        vy: -weapon.bulletSpeed * 0.96
                    });
                } else if (weapon.behavior === 'split') {
                    // Big bullet that splits later
                    bulletsRef.current.push({
                        ...baseBullet,
                        size: weapon.bulletSize * 1.5,
                        hasSplit: false
                    });
                } else {
                    bulletsRef.current.push(baseBullet);
                }
            }

            // 3. Update Player Bullets
            const activeBullets = [];
            for (let b of bulletsRef.current) {
                b.age++;
                b.x += b.vx;
                b.y += b.vy;

                // Handle custom behavioral kinematics
                if (b.behavior === 'wavy') {
                    // Sine-wave horizontal offset
                    b.x = b.startX + Math.sin(b.age / 5) * 35;
                } else if (b.behavior === 'homing') {
                    // Track nearest enemy or boss
                    let target = null;
                    let minDist = Infinity;
                    
                    if (bossActiveRef.current && bossRef.current) {
                        target = { x: bossRef.current.x, y: bossRef.current.y };
                        minDist = Math.hypot(target.x - b.x, target.y - b.y);
                    } else {
                        for (let e of enemiesRef.current) {
                            let dist = Math.hypot(e.x - b.x, e.y - b.y);
                            if (dist < minDist) {
                                minDist = dist;
                                target = e;
                            }
                        }
                    }

                    if (target) {
                        const angle = Math.atan2(target.y - b.y, target.x - b.x);
                        const targetVx = Math.cos(angle) * compiledWeaponRef.current.bulletSpeed;
                        const targetVy = Math.sin(angle) * compiledWeaponRef.current.bulletSpeed;
                        // Smooth steering interpolation
                        b.vx = b.vx * 0.88 + targetVx * 0.12;
                        b.vy = b.vy * 0.88 + targetVy * 0.12;
                    }
                } else if (b.behavior === 'split' && !b.hasSplit && b.age >= 25) {
                    b.hasSplit = true;
                    // Split into three sub-bullets
                    const splitSpeed = compiledWeaponRef.current.bulletSpeed * 0.85;
                    const damageFraction = Math.max(3, Math.floor(compiledWeaponRef.current.damage * 0.6));
                    
                    activeBullets.push({
                        ...b,
                        x: b.x,
                        y: b.y,
                        vx: -splitSpeed * 0.35,
                        vy: -splitSpeed * 0.9,
                        size: compiledWeaponRef.current.bulletSize,
                        damage: damageFraction,
                        behavior: 'straight'
                    });
                    activeBullets.push({
                        ...b,
                        x: b.x,
                        y: b.y,
                        vx: 0,
                        vy: -splitSpeed,
                        size: compiledWeaponRef.current.bulletSize,
                        damage: damageFraction,
                        behavior: 'straight'
                    });
                    activeBullets.push({
                        ...b,
                        x: b.x,
                        y: b.y,
                        vx: splitSpeed * 0.35,
                        vy: -splitSpeed * 0.9,
                        size: compiledWeaponRef.current.bulletSize,
                        damage: damageFraction,
                        behavior: 'straight'
                    });
                    // Skip adding parent since it split
                    continue;
                }

                // Keep bullets inside canvas bounds
                if (b.y > -20 && b.y < canvas.height + 20 && b.x > -20 && b.x < canvas.width + 20) {
                    activeBullets.push(b);
                }
            }
            bulletsRef.current = activeBullets;

            // 4. Update Starfield and Grid offsets
            for (let s of starfieldRef.current) {
                s.y += s.speed;
                if (s.y > canvas.height) {
                    s.y = 0;
                    s.x = Math.random() * canvas.width;
                }
            }
            gridOffsetRef.current = (gridOffsetRef.current + 2) % 40;

            // 5. Update Enemies
            const activeEnemies = [];
            for (let e of enemiesRef.current) {
                // Wave movement patterns
                if (e.type === 'interceptor') {
                    // Diving interceptor
                    e.y += 2.5;
                    e.x += e.vx * 1.5;
                    if (e.x < 50 || e.x > canvas.width - 50) e.vx *= -1;
                    if (e.y > canvas.height) {
                        e.y = -20;
                        e.x = Math.random() * (canvas.width - 100) + 50;
                    }
                } else if (e.type === 'bomber') {
                    // Slow heavy hoverer
                    e.x = e.startX + Math.sin(timeRef.current / 40) * 120;
                    e.y = e.startY + Math.cos(timeRef.current / 50) * 20;
                } else {
                    // Classic fighter layout sway
                    e.x = e.startX + Math.sin(timeRef.current / 30) * 80;
                    e.y = e.startY + Math.sin(timeRef.current / 60) * 15;
                }

                // Enemy bullet firing cooldown
                e.fireCooldown -= 1;
                if (e.fireCooldown <= 0) {
                    e.fireCooldown = Math.random() * 200 + 150 - waveRef.current * 4;
                    
                    // SOLAR FLARE increases enemy bullet velocity
                    let bulletVy = 4 + waveRef.current * 0.3;
                    if (e.type === 'interceptor') bulletVy = 6 + waveRef.current * 0.4;
                    if (hazardRef.current === 'SOLAR_FLARE') {
                        bulletVy *= 1.5;
                    }

                    enemyBulletsRef.current.push({
                        x: e.x,
                        y: e.y + 12,
                        vx: 0,
                        vy: bulletVy,
                        size: 3.5,
                        color: '#ff3131'
                    });
                }

                activeEnemies.push(e);
            }
            enemiesRef.current = activeEnemies;

                    // 6. Update Boss AI — branched by bossType
            if (bossActiveRef.current && bossRef.current) {
                const isSans = bossRef.current.bossType === 'sans';

                // Boss movement
                bossRef.current.x = (canvas.width / 2) + Math.sin(timeRef.current / 80) * (isSans ? 150 : 200);
                bossRef.current.y = (isSans ? 80 : 100) + Math.cos(timeRef.current / 50) * (isSans ? 15 : 20);

                // Phase detection based on HP percentage
                const healthPercent = bossRef.current.health / bossRef.current.maxHealth;
                const newPhase = healthPercent > 0.6 ? 1 : healthPercent > 0.3 ? 2 : 3;
                if (newPhase !== bossPhaseRef.current) {
                    bossPhaseRef.current = newPhase;
                    shakeRef.current = 30;
                    flashRef.current = 10;
                    if (isSans) {
                        if (newPhase === 3) bossRef.current.eyeColor = '#ffeb3b';
                        else if (newPhase === 2) bossRef.current.eyeColor = '#00e5ff';
                    }
                }

                const phase = bossPhaseRef.current;

                // Taunt timer (shared)
                bossTauntRef.current.timer--;
                if (bossTauntRef.current.timer <= 0) {
                    const taunts = bossRef.current.taunts || [];
                    if (taunts.length > 0) {
                        bossTauntRef.current = {
                            text: taunts[Math.floor(Math.random() * taunts.length)],
                            timer: phase === 1 ? 420 : phase === 2 ? 260 : 150,
                            fadeTimer: 90
                        };
                    }
                }
                if (bossTauntRef.current.fadeTimer > 0) bossTauntRef.current.fadeTimer--;

                if (isSans) {
                    // === SANS ATTACKS: Bone walls + Gaster beams ===
                    bossAttackTimerRef.current++;
                    const attackInterval = phase === 1 ? 280 : phase === 2 ? 180 : 120;

                    if (bossAttackTimerRef.current >= attackInterval) {
                        bossAttackTimerRef.current = 0;
                        const roll = Math.random();

                        if (phase === 1) {
                            spawnBoneWall();
                        } else if (phase === 2) {
                            if (roll > 0.35) spawnBoneWall();
                            else spawnGasterBeam();
                        } else {
                            if (roll > 0.5) {
                                spawnBoneWall();
                                if (roll > 0.75) spawnGasterBeam();
                            } else {
                                spawnGasterBeam();
                            }
                        }
                    }

                    // Sans also fires aimed shots in phase 2+
                    if (phase >= 2 && timeRef.current % 150 === 0) {
                        synthSound('shoot');
                        const angle = Math.atan2(player.y - bossRef.current.y, player.x - bossRef.current.x);
                        for (let d = -1; d <= 1; d++) {
                            enemyBulletsRef.current.push({
                                x: bossRef.current.x,
                                y: bossRef.current.y + 50,
                                vx: Math.cos(angle + d * 0.25) * 4.5,
                                vy: Math.sin(angle + d * 0.25) * 4.5,
                                size: 3.5,
                                color: bossRef.current.eyeColor || '#00bfff'
                            });
                        }
                    }
                } else {
                    // === OVERLORD ATTACKS: Radial rings + aimed bursts (classic) ===
                    const fireRate1 = phase === 1 ? 100 : phase === 2 ? 70 : 50;
                    const fireRate2 = phase === 1 ? 130 : phase === 2 ? 90 : 60;

                    if (timeRef.current % fireRate1 === 0) {
                        synthSound('hit');
                        const bulletCount = phase === 1 ? 8 : phase === 2 ? 10 : 14;
                        for (let a = 0; a < bulletCount; a++) {
                            const angle = (a / bulletCount) * Math.PI * 2;
                            enemyBulletsRef.current.push({
                                x: bossRef.current.x,
                                y: bossRef.current.y,
                                vx: Math.cos(angle) * (3 + phase * 0.5),
                                vy: Math.sin(angle) * (3 + phase * 0.5),
                                size: 4.5,
                                color: '#ff3131'
                            });
                        }
                    }

                    if (timeRef.current % fireRate2 === 0) {
                        synthSound('shoot');
                        const angle = Math.atan2(player.y - bossRef.current.y, player.x - bossRef.current.x);
                        const spreadCount = phase === 1 ? 3 : phase === 2 ? 5 : 7;
                        for (let d = -(spreadCount - 1) / 2; d <= (spreadCount - 1) / 2; d++) {
                            enemyBulletsRef.current.push({
                                x: bossRef.current.x,
                                y: bossRef.current.y,
                                vx: Math.cos(angle + d * 0.15) * 5,
                                vy: Math.sin(angle + d * 0.15) * 5,
                                size: 4,
                                color: '#f39c12'
                            });
                        }
                    }
                }

                // Update Sans bone/beam attacks (only active for Sans)
                const activeAttacks = [];
                for (let atk of bossAttacksRef.current) {
                    if (atk.type === 'bone_wall') {
                        atk.position += atk.velocity;
                        atk.lifetime--;

                        if (iFramesRef.current <= 0 && shieldTimeRef.current <= 0) {
                            let hit = false;
                            if (atk.direction === 'horizontal') {
                                if (Math.abs(player.y - atk.position) < (player.height / 2 + atk.thickness / 2)) {
                                    if (player.x < atk.gapStart || player.x > atk.gapStart + atk.gapSize) hit = true;
                                }
                            } else {
                                if (Math.abs(player.x - atk.position) < (player.width / 2 + atk.thickness / 2)) {
                                    if (player.y < atk.gapStart || player.y > atk.gapStart + atk.gapSize) hit = true;
                                }
                            }
                            if (hit) {
                                damagePlayer(15);
                                iFramesRef.current = 30;
                                shakeRef.current = 20;
                                synthSound('hit');
                                spawnExplosion(player.x, player.y, '#ffffff', 8);
                            }
                        }

                        if (atk.lifetime > 0) activeAttacks.push(atk);
                    } else if (atk.type === 'beam') {
                        atk.timer--;
                        if (atk.timer <= 0) {
                            if (atk.phase === 'charging') {
                                atk.phase = 'firing';
                                atk.timer = atk.fireTime;
                                synthSound('boss_alert');
                            } else if (atk.phase === 'firing') {
                                atk.phase = 'fading';
                                atk.timer = atk.fadeTime;
                            } else {
                                continue;
                            }
                        }

                        if (atk.phase === 'firing' && iFramesRef.current <= 0 && shieldTimeRef.current <= 0) {
                            let hit = false;
                            if (atk.direction === 'horizontal') {
                                if (Math.abs(player.y - atk.position) < atk.beamWidth / 2) {
                                    if (player.x < atk.gapStart || player.x > atk.gapStart + atk.gapSize) hit = true;
                                }
                            } else {
                                if (Math.abs(player.x - atk.position) < atk.beamWidth / 2) {
                                    if (player.y < atk.gapStart || player.y > atk.gapStart + atk.gapSize) hit = true;
                                }
                            }
                            if (hit) {
                                damagePlayer(20);
                                iFramesRef.current = 30;
                                shakeRef.current = 25;
                                synthSound('explosion');
                                spawnExplosion(player.x, player.y, '#ffffff', 10);
                            }
                        }

                        activeAttacks.push(atk);
                    }
                }
                bossAttacksRef.current = activeAttacks;
            }

            // 7. Update Enemy Projectiles
            const activeEnemyBullets = [];
            for (let eb of enemyBulletsRef.current) {
                eb.x += eb.vx;
                eb.y += eb.vy;

                // Hit Player check (factoring in SHIELD)
                const distToPlayer = Math.hypot(eb.x - player.x, eb.y - player.y);
                if (distToPlayer < (player.width / 2 + eb.size)) {
                    if (shieldTimeRef.current <= 0) {
                        damagePlayer(10);
                        synthSound('hit');
                        spawnExplosion(player.x, player.y, '#ff3131', 6);
                        shakeRef.current = 18;
                    } else {
                        // Shield bounce!
                        synthSound('hit');
                        spawnExplosion(eb.x, eb.y, '#00f0ff', 4);
                    }
                } else if (eb.y < canvas.height + 20 && eb.y > -20 && eb.x > -20 && eb.x < canvas.width + 20) {
                    activeEnemyBullets.push(eb);
                }
            }
            enemyBulletsRef.current = activeEnemyBullets;

            // 8. Collisions: Player Bullets hitting Enemies / Boss
            for (let b of bulletsRef.current) {
                let bulletHit = false;

                // Check boss collision
                if (bossActiveRef.current && bossRef.current) {
                    const distToBoss = Math.hypot(b.x - bossRef.current.x, b.y - bossRef.current.y);
                    if (distToBoss < 45) { // Boss radius approximation
                        bulletHit = true;
                        damageBoss(b.damage);
                        synthSound('hit');
                        spawnExplosion(b.x, b.y, compiledWeaponRef.current.color, 4);
                        shakeRef.current = Math.max(shakeRef.current, 5);

                        // Check if boss was just defeated
                        if (!useGridrunnerStore.getState().bossActive) {
                            bossAttacksRef.current = [];
                            bossTauntRef.current = { text: '', timer: 0, fadeTimer: 0 };
                            bossPhaseRef.current = 1;
                            bossAttackTimerRef.current = 0;
                            synthSound('explosion');
                            shakeRef.current = 40;
                            // Big death explosion
                            for (let k = 0; k < 20; k++) {
                                spawnExplosion(
                                    bossRef.current?.x || b.x,
                                    bossRef.current?.y || b.y,
                                    ['#ffffff', '#00bfff', '#ffeb3b'][k % 3],
                                    6
                                );
                            }
                        }
                    }
                }

                // Check standard enemy collisions
                if (!bulletHit) {
                    for (let e of enemiesRef.current) {
                        const distToEnemy = Math.hypot(b.x - e.x, b.y - e.y);
                        if (distToEnemy < (e.width / 2 + b.size)) {
                            bulletHit = true;
                            e.health -= b.damage;
                            synthSound('hit');
                            spawnExplosion(b.x, b.y, compiledWeaponRef.current.color, 3);
                            shakeRef.current = Math.max(shakeRef.current, 2);

                            if (e.health <= 0) {
                                addScore(e.scoreVal);
                                synthSound('explosion');
                                spawnExplosion(e.x, e.y, e.color, 12);
                                shakeRef.current = Math.max(shakeRef.current, 6);
                                
                                // 20% drop chance for power-up
                                if (Math.random() < 0.2) {
                                    spawnPowerup(e.x, e.y);
                                }

                                // Filter out deceased enemy
                                enemiesRef.current = enemiesRef.current.filter(item => item !== e);
                            }
                            break;
                        }
                    }
                }

                if (bulletHit) {
                    bulletsRef.current = bulletsRef.current.filter(item => item !== b);
                }
            }

            // 9. Collisions: Player Ship crashing directly into Enemies (factoring in SHIELD)
            for (let e of enemiesRef.current) {
                const crashDist = Math.hypot(player.x - e.x, player.y - e.y);
                if (crashDist < (player.width / 2 + e.width / 2)) {
                    if (shieldTimeRef.current <= 0) {
                        damagePlayer(25);
                        synthSound('explosion');
                        spawnExplosion(e.x, e.y, e.color, 15);
                        shakeRef.current = 28;
                    } else {
                        // Shield ramming damages enemy without player penalty
                        addScore(e.scoreVal);
                        synthSound('explosion');
                        spawnExplosion(e.x, e.y, e.color, 15);
                        shakeRef.current = 15;
                    }
                    enemiesRef.current = enemiesRef.current.filter(item => item !== e);
                    break;
                }
            }

            // Update Powerups movement & collection
            const activePowerups = [];
            for (let p of powerupsRef.current) {
                p.y += p.vy;
                p.pulse += 0.05;

                const distToPlayer = Math.hypot(p.x - player.x, p.y - player.y);
                if (distToPlayer < (player.width / 2 + p.size)) {
                    synthSound('boss_alert');
                    shakeRef.current = 8;
                    
                    if (p.type === 'repair') {
                        healPlayer(25);
                        spawnExplosion(p.x, p.y, p.color, 10);
                    } else if (p.type === 'shield') {
                        shieldTimeRef.current = 5000;
                        spawnExplosion(p.x, p.y, p.color, 10);
                    } else if (p.type === 'overcharge') {
                        overchargeTimeRef.current = 6000;
                        spawnExplosion(p.x, p.y, p.color, 10);
                    } else if (p.type === 'emp') {
                        // Clear enemy bullets
                        enemyBulletsRef.current = [];
                        
                        // Deal 30 damage to all enemies on grid
                        for (let e of enemiesRef.current) {
                            e.health -= 30;
                            spawnExplosion(e.x, e.y, '#ffffff', 4);
                            if (e.health <= 0) {
                                addScore(e.scoreVal);
                                synthSound('explosion');
                                spawnExplosion(e.x, e.y, e.color, 12);
                            }
                        }
                        enemiesRef.current = enemiesRef.current.filter(item => item.health > 0);
                        
                        // Flash screen effect
                        flashRef.current = 15;
                        shakeRef.current = 22;
                    }
                } else if (p.y < canvas.height + 20) {
                    activePowerups.push(p);
                }
            }
            powerupsRef.current = activePowerups;

            // 10. Wave Progress check (Transition to next wave if cleared)
            if (enemiesRef.current.length === 0 && !bossActiveRef.current && !isBossGeneratingRef.current && !isTransitioningWaveRef.current) {
                isTransitioningWaveRef.current = true;
                nextWave().then(() => {
                    const newWaveVal = useGridrunnerStore.getState().wave;
                    waveRef.current = newWaveVal;
                    if (gameState === 'playing' || gameState === 'boss-intro') {
                        // If it's not a boss wave, spawn enemies immediately
                        if (newWaveVal % 4 !== 3 && newWaveVal % 4 !== 0) {
                            spawnEnemyWave();
                        }
                    }
                    isTransitioningWaveRef.current = false;
                }).catch(() => {
                    isTransitioningWaveRef.current = false;
                });
            }

            // 11. Update particles
            const activeParticles = [];
            for (let p of particlesRef.current) {
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= p.decay;
                if (p.alpha > 0) {
                    activeParticles.push(p);
                }
            }
            particlesRef.current = activeParticles;
        };

        const drawGame = () => {
            ctx.save();
            
            // Screen shake
            if (shakeRef.current > 0) {
                const dx = (Math.random() - 0.5) * shakeRef.current;
                const dy = (Math.random() - 0.5) * shakeRef.current;
                ctx.translate(dx, dy);
            }

            // Clear screen (extended boundaries to cover shake)
            ctx.fillStyle = '#060e20';
            ctx.fillRect(-50, -50, canvas.width + 100, canvas.height + 100);

            // Draw Parallax Starfield
            for (let s of starfieldRef.current) {
                ctx.fillStyle = `rgba(255, 255, 255, ${s.size > 1.5 ? 0.8 : 0.4})`;
                ctx.fillRect(s.x, s.y, s.size, s.size);
            }

            // Draw Cyber Vector Grid with fading depth gradient
            const gridSpacing = 40;
            const gridGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gridGradient.addColorStop(0, 'rgba(76, 215, 246, 0.01)'); // Fade near horizon top
            gridGradient.addColorStop(0.4, 'rgba(76, 215, 246, 0.07)');
            gridGradient.addColorStop(1, 'rgba(76, 215, 246, 0.22)'); // Bright at base
            
            ctx.strokeStyle = gridGradient;
            ctx.lineWidth = 1;
            
            // Vertical grid lines
            for (let x = 0; x < canvas.width; x += gridSpacing) {
                ctx.beginPath();
                ctx.moveTo(x, -50);
                ctx.lineTo(x, canvas.height + 50);
                ctx.stroke();
            }
            // Scrolling Horizontal grid lines
            for (let y = gridOffsetRef.current - 40; y < canvas.height + 40; y += gridSpacing) {
                ctx.beginPath();
                ctx.moveTo(-50, y);
                ctx.lineTo(canvas.width + 50, y);
                ctx.stroke();
            }

            // Draw Player Ship (Glowing futuristic fighter)
            const player = playerRef.current;
            ctx.shadowBlur = 18;
            ctx.shadowColor = compiledWeaponRef.current.color;
            ctx.strokeStyle = compiledWeaponRef.current.color;
            ctx.lineWidth = 3;
            
            // Outer Wings outline
            ctx.beginPath();
            ctx.moveTo(player.x, player.y - player.height / 2 - 2); // Nose tip
            ctx.lineTo(player.x - player.width / 2, player.y + player.height / 2); // Left wingtip
            ctx.lineTo(player.x - player.width / 4, player.y + player.height / 4); // Left jet intake
            ctx.lineTo(player.x, player.y + player.height / 2); // Rear thruster center
            ctx.lineTo(player.x + player.width / 4, player.y + player.height / 4); // Right jet intake
            ctx.lineTo(player.x + player.width / 2, player.y + player.height / 2); // Right wingtip
            ctx.closePath();
            ctx.stroke();

            // Inner stabilizer deck
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(player.x, player.y - player.height / 4);
            ctx.lineTo(player.x - player.width / 6, player.y + player.height / 4);
            ctx.lineTo(player.x + player.width / 6, player.y + player.height / 4);
            ctx.closePath();
            ctx.stroke();

            // Glowing cockpit/core
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(player.x, player.y - player.height / 6);
            ctx.lineTo(player.x - player.width / 8, player.y + player.height / 6);
            ctx.lineTo(player.x + player.width / 8, player.y + player.height / 6);
            ctx.closePath();
            ctx.fill();

            // Small stabilizer tips
            ctx.shadowBlur = 0;
            ctx.fillStyle = compiledWeaponRef.current.color;
            ctx.fillRect(player.x - player.width / 2 - 1, player.y + player.height / 2 - 2, 3, 3);
            ctx.fillRect(player.x + player.width / 2 - 1, player.y + player.height / 2 - 2, 3, 3);

            // Draw Shield Ring
            if (shieldTimeRef.current > 0) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#00f0ff';
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(player.x, player.y, player.width * 0.8, 0, Math.PI * 2);
                ctx.stroke();
                
                // Pulsing inner ring
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.beginPath();
                ctx.arc(player.x, player.y, player.width * 0.8 - 4 - Math.sin(timeRef.current / 5) * 3, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Draw Player thruster flame particles
            if (timeRef.current % 3 === 0) {
                const thrusterColor = overchargeTimeRef.current > 0 ? '#ff00ff' : '#4cd7f6';
                spawnExplosion(player.x, player.y + player.height / 2, thrusterColor, overchargeTimeRef.current > 0 ? 4 : 2);
            }

            // Draw Player Bullets (Energy blasts)
            for (let b of bulletsRef.current) {
                ctx.shadowBlur = 12;
                ctx.shadowColor = b.color;
                ctx.fillStyle = b.color;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;

                ctx.beginPath();
                ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }

            // Draw Enemies
            for (let e of enemiesRef.current) {
                ctx.shadowBlur = 12;
                ctx.shadowColor = e.color;
                ctx.strokeStyle = e.color;
                ctx.lineWidth = 2.5;

                if (e.type === 'interceptor') {
                    // Sleek claw-like interceptor drone
                    ctx.beginPath();
                    ctx.moveTo(e.x, e.y + 12); // Front claw point
                    ctx.lineTo(e.x - 10, e.y); // Left shoulder
                    ctx.lineTo(e.x - 14, e.y - 12); // Left stabilizer blade
                    ctx.lineTo(e.x, e.y - 4); // Rear exhaust
                    ctx.lineTo(e.x + 14, e.y - 12); // Right stabilizer blade
                    ctx.lineTo(e.x + 10, e.y); // Right shoulder
                    ctx.closePath();
                    ctx.stroke();

                    // Central glowing power cell
                    ctx.shadowBlur = 6;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(e.x - 2, e.y - 2, 4, 4);
                } else if (e.type === 'bomber') {
                    // Armored hexagonal shield layout
                    ctx.fillStyle = 'rgba(233, 30, 99, 0.15)';
                    ctx.beginPath();
                    ctx.moveTo(e.x, e.y - 14);
                    ctx.lineTo(e.x - 14, e.y - 6);
                    ctx.lineTo(e.x - 14, e.y + 6);
                    ctx.lineTo(e.x, e.y + 14);
                    ctx.lineTo(e.x + 14, e.y + 6);
                    ctx.lineTo(e.x + 14, e.y - 6);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Inner plates lines
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(e.x - 14, e.y - 6);
                    ctx.lineTo(e.x + 14, e.y - 6);
                    ctx.moveTo(e.x - 14, e.y + 6);
                    ctx.lineTo(e.x + 14, e.y + 6);
                    ctx.stroke();

                    // Glowing inner power core
                    ctx.shadowBlur = 8;
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(e.x, e.y, 4.5, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Aggressive classic delta wings fighter drone
                    ctx.beginPath();
                    ctx.moveTo(e.x, e.y + 12); // Nose points down
                    ctx.lineTo(e.x - 12, e.y - 12); // Back left
                    ctx.lineTo(e.x, e.y - 4); // Back exhaust groove
                    ctx.lineTo(e.x + 12, e.y - 12); // Back right
                    ctx.closePath();
                    ctx.stroke();

                    // Core glowing sensor eye
                    ctx.shadowBlur = 6;
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(e.x, e.y, 3, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Enemy mini-health bars (only when damaged)
                if (e.health < e.maxHealth) {
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(e.x - 12, e.y - 18, 24, 3);
                    ctx.fillStyle = '#ff3131';
                    ctx.fillRect(e.x - 12, e.y - 18, (e.health / e.maxHealth) * 24, 3);
                }
            }

            // Draw Boss — Sans-inspired Skeleton or Mainframe Overlord
            if (bossActiveRef.current && bossRef.current) {
                const bx = bossRef.current.x;
                const by = bossRef.current.y;
                const bob = Math.sin(timeRef.current / 30) * 4;
                const isSans = bossRef.current.bossType === 'sans';

                if (isSans) {
                    const eyeColor = bossRef.current.eyeColor || '#00bfff';
                    const phase = bossPhaseRef.current;

                    ctx.shadowBlur = 0;

                    if (sansCanvasRef.current) {
                        const img = sansCanvasRef.current;
                        const spriteW = 90;
                        const spriteH = (img.height / img.width) * spriteW;

                        // Center the sprite at bx, by + bob
                        ctx.drawImage(img, bx - spriteW / 2, by - spriteH / 2 + bob, spriteW, spriteH);
                    } else {
                        // Fallback simple skull outline in case image hasn't loaded yet
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(bx, by + bob, 20, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillRect(bx - 14, by + 10 + bob, 28, 10);
                        
                        // Eye sockets
                        ctx.fillStyle = '#060e20';
                        ctx.beginPath();
                        ctx.arc(bx - 7, by - 3 + bob, 5.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(bx + 7, by - 3 + bob, 5.5, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    // Glowing left eye (layered on top of the sprite in phase 2 and 3, or pulsing)
                    // Coordinates offset matched to Sans's left eye socket on the sprite
                    const eyeX = bx - 10;
                    const eyeY = by - 32 + bob;

                    ctx.shadowBlur = phase >= 3 ? 30 : 18;
                    ctx.shadowColor = eyeColor;
                    ctx.fillStyle = eyeColor;
                    ctx.beginPath();
                    ctx.arc(eyeX, eyeY, phase >= 3 ? 4.5 : 3.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;

                    // Eye glow particle trail (left eye)
                    if (phase >= 2) {
                        for (let i = 1; i <= 3; i++) {
                            ctx.fillStyle = `rgba(${eyeColor === '#ffeb3b' ? '255,235,59' : '0,191,255'}, ${0.4 - i * 0.1})`;
                            ctx.beginPath();
                            ctx.arc(eyeX - i * 4, eyeY - i * 2, 2 - i * 0.3, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                } else {
                    // Draw Boss AI Overlord (Large glowing structure)
                    ctx.shadowBlur = 25;
                    ctx.shadowColor = '#ff3131';
                    ctx.strokeStyle = '#ff3131';
                    ctx.lineWidth = 3;

                    // Outer rotating shield segments
                    const angleOffset = timeRef.current * 0.015;
                    ctx.beginPath();
                    ctx.arc(bx, by, 48, angleOffset, angleOffset + Math.PI * 0.6);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(bx, by, 48, angleOffset + Math.PI, angleOffset + Math.PI * 1.6);
                    ctx.stroke();

                    // Inner counter-rotating shield segments
                    ctx.beginPath();
                    ctx.arc(bx, by, 36, -angleOffset, -angleOffset + Math.PI * 0.5);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(bx, by, 36, -angleOffset + Math.PI, -angleOffset + Math.PI * 1.5);
                    ctx.stroke();

                    // Concentric spiky superstructure ring
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    for (let i = 0; i < 8; i++) {
                        const baseAngle = (i / 8) * Math.PI * 2 + angleOffset * 0.2;
                        const spikeLen = i % 2 === 0 ? 60 : 45;
                        const nextAngle = ((i + 1) / 8) * Math.PI * 2 + angleOffset * 0.2;
                        const nextSpikeLen = (i + 1) % 2 === 0 ? 60 : 45;

                        ctx.moveTo(bx + Math.cos(baseAngle) * spikeLen, by + Math.sin(baseAngle) * spikeLen);
                        ctx.lineTo(bx + Math.cos(nextAngle) * nextSpikeLen, by + Math.sin(nextAngle) * nextSpikeLen);
                    }
                    ctx.stroke();

                    // Glowing central core red pulsing eye
                    const pulseRadius = 10 + Math.sin(timeRef.current / 4) * 4;
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(bx, by, pulseRadius, 0, Math.PI * 2);
                    ctx.fill();

                    // Orbiting secondary micro core
                    ctx.fillStyle = '#ff3131';
                    ctx.beginPath();
                    ctx.arc(bx + Math.cos(-angleOffset * 2) * 20, by + Math.sin(-angleOffset * 2) * 20, 3, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Chat bubble with taunt
                if (bossTauntRef.current.fadeTimer > 0 && bossTauntRef.current.text) {
                    const tauntText = bossTauntRef.current.text;
                    const fadeAlpha = Math.min(1, bossTauntRef.current.fadeTimer / 20);
                    const bubbleX = bx + 30;
                    const bubbleY = by - 30 + bob;

                    ctx.font = 'bold 11px monospace';
                    const tw = Math.min(ctx.measureText(tauntText).width + 16, 200);
                    const bh = 24;

                    ctx.globalAlpha = fadeAlpha;
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.roundRect(bubbleX, bubbleY, tw, bh, 6);
                    ctx.fill();

                    // Pointer triangle
                    ctx.beginPath();
                    ctx.moveTo(bubbleX, bubbleY + bh / 2 - 4);
                    ctx.lineTo(bubbleX - 8, bubbleY + bh / 2);
                    ctx.lineTo(bubbleX, bubbleY + bh / 2 + 4);
                    ctx.closePath();
                    ctx.fill();

                    ctx.fillStyle = '#060e20';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(tauntText, bubbleX + 8, bubbleY + bh / 2, tw - 16);
                    ctx.globalAlpha = 1.0;
                }
            }

            // Draw Bone Walls & Gaster Beams
            for (let atk of bossAttacksRef.current) {
                if (atk.type === 'bone_wall') {
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = '#ffffff';
                    ctx.fillStyle = '#ffffff';

                    if (atk.direction === 'horizontal') {
                        // Left segment
                        ctx.fillRect(0, atk.position - atk.thickness / 2, atk.gapStart, atk.thickness);
                        // Right segment
                        ctx.fillRect(atk.gapStart + atk.gapSize, atk.position - atk.thickness / 2,
                            canvas.width - atk.gapStart - atk.gapSize, atk.thickness);
                        // Bone knob circles at gap edges
                        ctx.beginPath();
                        ctx.arc(atk.gapStart, atk.position, atk.thickness / 2 + 2, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(atk.gapStart + atk.gapSize, atk.position, atk.thickness / 2 + 2, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        // Top segment
                        ctx.fillRect(atk.position - atk.thickness / 2, 0, atk.thickness, atk.gapStart);
                        // Bottom segment
                        ctx.fillRect(atk.position - atk.thickness / 2, atk.gapStart + atk.gapSize,
                            atk.thickness, canvas.height - atk.gapStart - atk.gapSize);
                        // Bone knob circles
                        ctx.beginPath();
                        ctx.arc(atk.position, atk.gapStart, atk.thickness / 2 + 2, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(atk.position, atk.gapStart + atk.gapSize, atk.thickness / 2 + 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.shadowBlur = 0;
                } else if (atk.type === 'beam') {
                    if (atk.phase === 'charging') {
                        // Flashing warning line
                        const flash = Math.sin(timeRef.current * 0.4) * 0.5 + 0.5;
                        ctx.strokeStyle = `rgba(255, 50, 50, ${flash * 0.8})`;
                        ctx.lineWidth = 2;
                        ctx.setLineDash([6, 6]);
                        ctx.beginPath();
                        if (atk.direction === 'horizontal') {
                            ctx.moveTo(0, atk.position);
                            ctx.lineTo(canvas.width, atk.position);
                        } else {
                            ctx.moveTo(atk.position, 0);
                            ctx.lineTo(atk.position, canvas.height);
                        }
                        ctx.stroke();
                        ctx.setLineDash([]);
                    } else {
                        // Firing or fading
                        const alpha = atk.phase === 'fading' ? (atk.timer / atk.fadeTime) * 0.9 : 0.9;
                        ctx.shadowBlur = 20;
                        ctx.shadowColor = `rgba(255, 255, 255, ${alpha})`;
                        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;

                        if (atk.direction === 'horizontal') {
                            ctx.fillRect(0, atk.position - atk.beamWidth / 2, atk.gapStart, atk.beamWidth);
                            ctx.fillRect(atk.gapStart + atk.gapSize, atk.position - atk.beamWidth / 2,
                                canvas.width - atk.gapStart - atk.gapSize, atk.beamWidth);
                        } else {
                            ctx.fillRect(atk.position - atk.beamWidth / 2, 0, atk.beamWidth, atk.gapStart);
                            ctx.fillRect(atk.position - atk.beamWidth / 2, atk.gapStart + atk.gapSize,
                                atk.beamWidth, canvas.height - atk.gapStart - atk.gapSize);
                        }

                        // Bright edge glow lines
                        ctx.strokeStyle = `rgba(0, 191, 255, ${alpha * 0.6})`;
                        ctx.lineWidth = 1;
                        if (atk.direction === 'horizontal') {
                            ctx.beginPath();
                            ctx.moveTo(0, atk.position - atk.beamWidth / 2);
                            ctx.lineTo(canvas.width, atk.position - atk.beamWidth / 2);
                            ctx.stroke();
                            ctx.beginPath();
                            ctx.moveTo(0, atk.position + atk.beamWidth / 2);
                            ctx.lineTo(canvas.width, atk.position + atk.beamWidth / 2);
                            ctx.stroke();
                        } else {
                            ctx.beginPath();
                            ctx.moveTo(atk.position - atk.beamWidth / 2, 0);
                            ctx.lineTo(atk.position - atk.beamWidth / 2, canvas.height);
                            ctx.stroke();
                            ctx.beginPath();
                            ctx.moveTo(atk.position + atk.beamWidth / 2, 0);
                            ctx.lineTo(atk.position + atk.beamWidth / 2, canvas.height);
                            ctx.stroke();
                        }
                        ctx.shadowBlur = 0;
                    }
                }
            }

            // Draw Enemy Projectiles
            for (let eb of enemyBulletsRef.current) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = eb.color;
                ctx.fillStyle = eb.color;
                ctx.beginPath();
                ctx.arc(eb.x, eb.y, eb.size, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw Powerups
            for (let p of powerupsRef.current) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = p.color;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 2;
                
                const size = p.size + Math.sin(p.pulse) * 2;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y - size);
                ctx.lineTo(p.x + size, p.y);
                ctx.lineTo(p.x, p.y + size);
                ctx.lineTo(p.x - size, p.y);
                ctx.closePath();
                ctx.stroke();

                // Draw central abbreviation letter
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 9px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                let symbol = '';
                if (p.type === 'repair') symbol = 'H';
                if (p.type === 'shield') symbol = 'S';
                if (p.type === 'overcharge') symbol = 'O';
                if (p.type === 'emp') symbol = 'E';
                ctx.fillText(symbol, p.x, p.y);
            }

            // Draw neon explosion particles
            ctx.shadowBlur = 0;
            for (let p of particlesRef.current) {
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }
            ctx.globalAlpha = 1.0; // Reset alpha

            // Visual EMP flash screen overlay
            if (flashRef.current > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${(flashRef.current / 15) * 0.45})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            ctx.restore();
        };

        const spawnExplosion = (x, y, color, count) => {
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 4 + 1;
                particlesRef.current.push({
                    x,
                    y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: Math.random() * 3 + 1.5,
                    color: color || '#ff007f',
                    alpha: 1.0,
                    decay: Math.random() * 0.04 + 0.02
                });
            }
        };

        const runLoop = () => {
            try {
                updatePhysics();
                drawGame();
            } catch (err) {
                console.warn("Gridrunner Game Loop warning (handled):", err.message || err);
            }
            gameLoopRef.current = requestAnimationFrame(runLoop);
        };

        runLoop();

        return () => {
            if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState]);

    return (
        <main className="min-h-screen grid-bg radial-mesh relative flex flex-col items-center justify-start p-4 md:p-8">
            {/* Scanline retro effect */}
            <div className="absolute inset-0 scanline-overlay z-10 pointer-events-none opacity-40" />

            {/* Header Deck */}
            <header className="w-full max-w-5xl flex justify-between items-center mb-6 z-20">
                <div className="flex items-center gap-3">
                    <Link href="/" className="px-4 py-2 bg-slate-950/80 hover:bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-label tracking-widest text-[11px] rounded-lg uppercase shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.35)]">
                        ← RETURN DECK
                    </Link>
                    <h1 className="font-display text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-primary to-pink-500 tracking-wider neon-text-primary">
                        NEON GRIDRUNNER
                    </h1>
                </div>

                <div className="flex items-center gap-4">
                    {gameState !== 'menu' && (
                        <button
                            onClick={handleStartClick}
                            className="px-3.5 py-2 rounded-lg border border-neon-red/30 bg-neon-red/10 hover:bg-neon-red/20 text-neon-red text-xs font-label uppercase tracking-widest font-semibold transition-all hover:shadow-[0_0_15px_rgba(255,49,49,0.25)] duration-200 cursor-pointer"
                        >
                            🔄 RESTART RUN
                        </button>
                    )}
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`px-3.5 py-2 rounded-lg border text-xs font-label uppercase tracking-widest transition-all cursor-pointer ${
                            soundEnabled
                                ? 'bg-secondary/20 text-secondary border-secondary/40 shadow-[0_0_10px_rgba(76,215,246,0.15)]'
                                : 'bg-surface-container text-on-surface-variant border-white/5'
                        }`}
                    >
                        🔊 Synth: {soundEnabled ? 'ON' : 'OFF'}
                    </button>
                    {user && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-low border border-white/5 rounded-lg">
                            <span className="w-2 h-2 rounded-full bg-neon-green pulse-badge" />
                            <span className="font-label text-[10px] tracking-wider text-on-surface-variant uppercase">
                                USER: {user.email.split('@')[0]}
                            </span>
                        </div>
                    )}
                </div>
            </header>

            {/* Centered and Stacked Layout Container */}
            <div className="w-full max-w-6xl flex flex-col items-center gap-6 z-20">
                
                {/* GAME GRID INTERFACE */}
                <section className="w-full">
                    {/* Main Game Column */}
                    <div className="w-full flex flex-col gap-4">
                    {/* Game Terminal Container */}
                    <div className="relative w-full glass-panel rounded-2xl overflow-hidden border border-secondary/40 shadow-[0_0_30px_rgba(76,215,246,0.18)]">
                        
                        {/* 1. MAIN MENU OVERLAY */}
                        {gameState === 'menu' && (
                            <div className="absolute inset-0 bg-[#060e20]/95 flex flex-col items-center justify-center p-8 text-center z-20">
                                <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
                                <span className="text-5xl mb-4 animate-bounce">🚀</span>
                                <h2 className="font-display text-4xl font-black text-white tracking-widest uppercase mb-2 text-shadow">
                                    NEON GRIDRUNNER
                                </h2>
                                <p className="font-body text-sm text-secondary tracking-widest uppercase mb-8">
                                    Mainframe Battle Shield System v2.85
                                </p>
                                
                                <div className="max-w-md bg-surface-container-low border border-white/5 rounded-2xl p-5 mb-8">
                                    <h4 className="font-display text-xs font-bold text-white uppercase mb-2 tracking-wide">
                                        Grid Telemetry Directives
                                    </h4>
                                    <ul className="text-left font-body text-xs text-on-surface-variant/90 space-y-2 list-disc list-inside">
                                        <li>Pilot using <strong className="text-white">WASD / Arrow Keys</strong>.</li>
                                        <li>Deploy customized lasers using <strong className="text-white">Spacebar</strong>.</li>
                                        <li>AI Overlords hijack critical frequencies starting at Wave 3.</li>
                                        <li>Earn 1 Token per 200 grid score points recorded.</li>
                                    </ul>
                                </div>

                                <button
                                    onClick={handleStartClick}
                                    className="px-8 py-3 bg-secondary text-on-secondary font-label text-sm uppercase tracking-widest font-black rounded-full shadow-lg neon-glow-secondary transition-all hover:scale-105 cursor-pointer"
                                >
                                    INITIATE NEURAL GRIDRUN
                                </button>
                            </div>
                        )}

                        {/* 2. BOSS DIALOGUE OVERLAY */}
                        {gameState === 'boss-intro' && (() => {
                            const isSans = boss ? (boss.bossType === 'sans') : (wave % 4 === 3);
                            return (
                                <div className="absolute inset-0 bg-[#0a0210]/95 flex flex-col items-center justify-center p-8 text-center z-20 border border-error/40">
                                    <div className="absolute inset-0 grid-bg opacity-5 pointer-events-none" />
                                    
                                    <div className="w-full max-w-lg glass-panel-cyan border-t-error/30 rounded-2xl p-6 flex flex-col items-center">
                                        <div className="bg-error/10 text-error border border-error/30 px-3 py-1 rounded-full font-label text-[10px] tracking-wider uppercase pulse-badge mb-4">
                                            ⚠️ WARNING: SYSTEM HIJACK IN PROGRESS ⚠️
                                        </div>

                                        {isBossGenerating ? (
                                            <div className="flex flex-col items-center gap-3 py-8">
                                                <div className="w-8 h-8 border-3 border-error border-t-transparent rounded-full animate-spin" />
                                                <p className="font-label text-xs tracking-wider text-error uppercase">
                                                    {isSans ? 'Compiling Skeletal Hostility Core...' : 'Syncing Mainframe Security Core...'}
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Boss icon */}
                                                <div className="text-7xl mb-3 animate-pulse">{isSans ? '💀' : '🌀'}</div>

                                                <h3 className="font-display text-2xl font-black text-white uppercase tracking-widest mb-1">
                                                    {boss?.name}
                                                </h3>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="px-2 py-0.5 bg-[#00bfff]/15 border border-[#00bfff]/30 text-[#00bfff] text-[9px] font-label font-bold uppercase tracking-wider rounded">
                                                        {boss?.personality || 'sarcastic'}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-error/15 border border-error/30 text-error text-[9px] font-label font-bold uppercase tracking-wider rounded">
                                                        {boss?.threatLevel}
                                                    </span>
                                                    <span className="text-[9px] font-label text-on-surface-variant uppercase tracking-wider">
                                                        HP: {boss?.maxHealth}
                                                    </span>
                                                </div>

                                                <div className="font-body text-sm text-on-surface-variant border-t border-white/10 pt-4 mb-6 leading-relaxed italic">
                                                    &quot;{boss?.dialogue}&quot;
                                                </div>

                                                <div className="flex gap-4">
                                                    <button
                                                        onClick={() => {
                                                            bossAttacksRef.current = [];
                                                            bossPhaseRef.current = 1;
                                                            bossAttackTimerRef.current = 0;
                                                            bossTauntRef.current = { text: '', timer: 60, fadeTimer: 0 };
                                                            useGridrunnerStore.setState({ gameState: 'playing' });
                                                        }}
                                                        className="px-6 py-2.5 bg-[#00bfff] text-[#060e20] font-label text-xs uppercase tracking-widest font-bold rounded-lg shadow-lg hover:bg-[#00e5ff] transition-all cursor-pointer shadow-[0_0_15px_rgba(0,191,255,0.3)]"
                                                    >
                                                        {isSans ? '☠️ ENGAGE SKELETON' : '⚡ CONFRONT OVERLORD'}
                                                    </button>
                                                    <button
                                                        onClick={handleAbortClick}
                                                        className="px-6 py-2.5 bg-surface-container border border-white/10 text-white font-label text-xs uppercase tracking-widest font-bold rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer"
                                                    >
                                                        ABORT RUN
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* 3. GAMEOVER OVERLAY */}
                        {gameState === 'gameover' && (
                            <div className="absolute inset-0 bg-[#060e20]/95 flex flex-col items-center justify-center p-8 text-center z-20">
                                <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
                                <span className="text-5xl mb-4">💀</span>
                                <h2 className="font-display text-4xl font-black text-error tracking-widest uppercase mb-2">
                                    GRID RUN TERMINATED
                                </h2>
                                <p className="font-body text-xs text-on-surface-variant mb-6 uppercase tracking-wider">
                                    Ship core overloaded at Wave {wave}
                                </p>

                                <div className="grid grid-cols-2 gap-4 max-w-sm w-full mb-6">
                                    <div className="bg-surface-container p-3 rounded-xl border border-white/5">
                                        <span className="block font-label text-[10px] text-on-surface-variant uppercase mb-1">FINAL SCORE</span>
                                        <span className="font-display text-xl font-bold text-white">{score} pts</span>
                                    </div>
                                    <div className="bg-surface-container p-3 rounded-xl border border-white/5">
                                        <span className="block font-label text-[10px] text-on-surface-variant uppercase mb-1">TOKENS EARNED</span>
                                        <span className="font-display text-xl font-bold text-secondary">+{Math.floor(score / 200)}</span>
                                    </div>
                                </div>

                                <div className="max-w-md bg-surface-container-low border border-white/5 rounded-xl p-4 mb-8 text-left">
                                    <span className="block font-label text-[10px] text-secondary uppercase tracking-widest font-black mb-1">
                                        AI Mainframe Assessment
                                    </span>
                                    <p className="font-body text-xs text-on-surface-variant leading-relaxed">
                                        {boss?.dialogue || "Connecting with critique analyst... Analysing weapon compilation stats."}
                                    </p>
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={handleStartClick}
                                        className="px-6 py-2.5 bg-secondary text-on-secondary font-label text-xs uppercase tracking-widest font-bold rounded-lg shadow-lg hover:scale-105 transition-transform cursor-pointer"
                                    >
                                        REDEPLOY RUNNER
                                    </button>
                                    <button
                                        onClick={resetGame}
                                        className="px-6 py-2.5 bg-surface-container border border-white/10 text-white font-label text-xs uppercase tracking-widest font-bold rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer"
                                    >
                                        RETURN DECK
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 4. PAUSE OVERLAY */}
                        {gameState === 'playing' && isPaused && (
                            <div className="absolute inset-0 bg-[#060e20]/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center z-20 border border-secondary/40">
                                <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
                                <span className="text-6xl mb-6 animate-pulse">⏸️</span>
                                <h2 className="font-display text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-secondary tracking-widest uppercase mb-4 text-shadow neon-text-primary">
                                    SYSTEM STANDBY
                                </h2>
                                <p className="font-body text-sm text-on-surface-variant max-w-md mb-8 uppercase tracking-widest leading-relaxed">
                                    GRID RUN SUSPENDED. MAIN TRANSMISSION CHANNELS IN SECURE HOLD STATE. PRESS <kbd className="px-2 py-1 bg-surface-container border border-white/10 rounded font-mono text-white text-xs">P</kbd> OR <kbd className="px-2 py-1 bg-surface-container border border-white/10 rounded font-mono text-white text-xs">ESC</kbd> TO RESUME.
                                </p>
                                
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setIsPaused(false)}
                                        className="px-8 py-3 bg-secondary text-on-secondary font-label text-xs uppercase tracking-widest font-black rounded-lg shadow-lg neon-glow-secondary transition-all hover:scale-105 cursor-pointer"
                                    >
                                        RESUME RUN
                                    </button>
                                    <button
                                        onClick={handleAbortClick}
                                        className="px-8 py-3 bg-surface-container-high border border-white/15 text-white font-label text-xs uppercase tracking-widest font-black rounded-lg hover:bg-surface-container-highest transition-colors cursor-pointer"
                                    >
                                        ABORT RUN
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Interactive HUD Header inside Canvas element */}
                        <div className="absolute top-0 inset-x-0 p-5 pb-10 flex justify-between items-center pointer-events-none z-10 select-none bg-gradient-to-b from-[#060e20]/95 via-[#060e20]/60 to-transparent">
                            <div className="flex items-center gap-8">
                                <div className="flex flex-col">
                                    <span className="font-label text-xs text-on-surface-variant/80 uppercase tracking-widest mb-0.5">GRID SCORE</span>
                                    <span className="font-display text-2xl font-extrabold text-white leading-none">{score}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-label text-xs text-on-surface-variant/80 uppercase tracking-widest mb-0.5">WAVE SECTOR</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-display text-2xl font-extrabold text-secondary leading-none">{wave}</span>
                                        {hazard !== 'NORMAL' && (
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-label font-bold uppercase tracking-wider animate-pulse leading-none border ${
                                                hazard === 'SOLAR_FLARE' ? 'bg-[#ff3131]/20 text-[#ff3131] border-[#ff3131]/30 shadow-[0_0_5px_rgba(255,49,49,0.25)]' :
                                                hazard === 'GRAVITY_WELL' ? 'bg-[#00f0ff]/20 text-[#00f0ff] border-[#00f0ff]/30 shadow-[0_0_5px_rgba(0,240,255,0.25)]' :
                                                hazard === 'CHROME_SHIELD' ? 'bg-[#ffeb3b]/20 text-[#ffeb3b] border-[#ffeb3b]/30 shadow-[0_0_5px_rgba(255,235,59,0.25)]' :
                                                'bg-[#ff00ff]/20 text-[#ff00ff] border-[#ff00ff]/30 shadow-[0_0_5px_rgba(255,0,255,0.25)]' // SUPERCHARGE
                                            }`}>
                                                ⚠️ {hazard.replace('_', ' ')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-label text-xs text-on-surface-variant/80 uppercase tracking-widest mb-0.5">WEAPON PROTOCOL</span>
                                    <span className="font-label text-sm font-bold leading-none uppercase mt-1" style={{ color: compiledWeapon.color }}>
                                        {compiledWeapon.name}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-label text-xs text-on-surface-variant/80 uppercase tracking-widest mb-0.5">HEALTH PACKS</span>
                                    <span className="font-display text-sm font-bold leading-none uppercase mt-1 text-neon-green flex items-center gap-1">
                                        💚 {user ? `${healthPacks}` : 'N/A'} <span className="text-[10px] text-on-surface-variant font-label normal-case font-medium ml-1 pointer-events-auto">([H] to use)</span>
                                    </span>
                                </div>
                            </div>

                            {/* HUD Interactive Controls */}
                            {gameState === 'playing' && (
                                <div className="flex items-center gap-2 pointer-events-auto">
                                    <button
                                        onClick={() => setIsPaused(!isPaused)}
                                        className="px-3.5 py-2 rounded bg-slate-950/90 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-label text-xs uppercase tracking-widest font-bold transition-all hover:shadow-[0_0_10px_rgba(6,182,212,0.25)] duration-200 cursor-pointer"
                                    >
                                        {isPaused ? '▶️ RESUME' : '⏸️ PAUSE'}
                                    </button>
                                    <button
                                        onClick={handleStartClick}
                                        className="px-3.5 py-2 rounded bg-slate-950/90 hover:bg-neon-red/20 border border-neon-red/30 text-neon-red font-label text-xs uppercase tracking-widest font-bold transition-all hover:shadow-[0_0_10px_rgba(255,49,49,0.25)] duration-200 cursor-pointer"
                                    >
                                        🔄 RESTART
                                    </button>
                                    <button
                                        onClick={handleAbortClick}
                                        className="px-3.5 py-2 rounded bg-slate-950/90 hover:bg-white/10 border border-white/20 text-white font-label text-xs uppercase tracking-widest font-bold transition-all duration-200 cursor-pointer"
                                    >
                                        ⏹️ ABORT
                                    </button>
                                </div>
                            )}

                            {/* Player Hull Integrity HP Bar */}
                            <div className="flex flex-col items-end w-56">
                                <div className="flex justify-between w-full font-label text-xs text-on-surface-variant/80 uppercase mb-1">
                                    <span>HULL INTEGRITY</span>
                                    <span className={`text-sm font-extrabold ${playerHealth > 30 ? 'text-neon-green' : 'text-error animate-pulse'}`}>
                                        {playerHealth}%
                                    </span>
                                </div>
                                <div className="w-full h-4 bg-surface-container-lowest rounded-full overflow-hidden border border-white/10">
                                    <div
                                        className={`h-full transition-all duration-300 ${
                                            playerHealth > 50
                                                ? 'bg-neon-green'
                                                : playerHealth > 25
                                                    ? 'bg-secondary'
                                                    : 'bg-error animate-pulse'
                                        }`}
                                        style={{ width: `${playerHealth}%` }}
                                    />
                                </div>
                                {/* Active power-up countdown bars */}
                                {(shieldTimeLeft > 0 || overchargeTimeLeft > 0) && (
                                    <div className="w-full flex flex-col gap-1.5 mt-2 text-right">
                                        {shieldTimeLeft > 0 && (
                                            <div className="flex flex-col w-full text-[10px] font-label">
                                                <div className="flex justify-between text-[#00f0ff] font-bold uppercase tracking-wider">
                                                    <span>🛡️ SHIELD MATRIX</span>
                                                    <span>{shieldTimeLeft}s</span>
                                                </div>
                                                <div className="w-full h-1 bg-[#00f0ff]/10 rounded-full overflow-hidden mt-0.5">
                                                    <div className="h-full bg-[#00f0ff] transition-all duration-300" style={{ width: `${(shieldTimeLeft / 5) * 100}%` }} />
                                                </div>
                                            </div>
                                        )}
                                        {overchargeTimeLeft > 0 && (
                                            <div className="flex flex-col w-full text-[10px] font-label">
                                                <div className="flex justify-between text-[#ff00ff] font-bold uppercase tracking-wider">
                                                    <span>⚡ OVERCHARGE ACTIVE</span>
                                                    <span>{overchargeTimeLeft}s</span>
                                                </div>
                                                <div className="w-full h-1 bg-[#ff00ff]/10 rounded-full overflow-hidden mt-0.5">
                                                    <div className="h-full bg-[#ff00ff] transition-all duration-300" style={{ width: `${(overchargeTimeLeft / 6) * 100}%` }} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Boss Health Bar HUD */}
                        {bossActive && boss && (
                            <div className="absolute top-20 inset-x-0 flex flex-col items-center pointer-events-none z-10 select-none">
                                <div className="w-80 bg-surface-container-lowest/80 border border-error/20 p-2.5 rounded-xl flex flex-col items-center">
                                    <div className="flex justify-between w-full font-label text-xs text-error font-bold uppercase mb-1 px-1">
                                        <span>BOSS: {boss.name}</span>
                                        <span>{boss.health} / {boss.maxHealth} HP</span>
                                    </div>
                                    <div className="w-full h-2 bg-[#420005] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-error transition-all duration-100"
                                            style={{ width: `${(boss.health / boss.maxHealth) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Cyber-Hazard Alert Banner */}
                        {bannerActive && (
                            <div className="absolute top-[85px] inset-x-0 flex justify-center pointer-events-none z-10 select-none px-4">
                                <div className={`max-w-md w-full py-2.5 px-6 rounded-xl border border-dashed backdrop-blur-md flex flex-col items-center text-center shadow-lg transition-all duration-300 animate-pulse ${
                                    hazard === 'NORMAL' ? 'bg-[#060e20]/90 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]' :
                                    hazard === 'SOLAR_FLARE' ? 'bg-[#060e20]/90 border-[#ff3131]/50 text-[#ff3131] shadow-[0_0_15px_rgba(255,49,49,0.2)]' :
                                    hazard === 'GRAVITY_WELL' ? 'bg-[#060e20]/90 border-[#00f0ff]/50 text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.2)]' :
                                    hazard === 'CHROME_SHIELD' ? 'bg-[#060e20]/90 border-[#ffeb3b]/50 text-[#ffeb3b] shadow-[0_0_15px_rgba(255,235,59,0.2)]' :
                                    'bg-[#060e20]/90 border-[#ff00ff]/50 text-[#ff00ff] shadow-[0_0_15px_rgba(255,0,255,0.2)]' // SUPERCHARGE
                                }`}>
                                    <span className="font-label text-[9px] tracking-[0.2em] uppercase mb-0.5 opacity-70">SYSTEM ALTERATION STATUS</span>
                                    <h3 className="font-display text-lg font-black tracking-widest uppercase mb-0.5">
                                        {HAZARD_DETAILS[hazard]?.banner}
                                    </h3>
                                    <p className="font-body text-[10px] tracking-wider uppercase opacity-95">
                                        {HAZARD_DETAILS[hazard]?.desc}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* The Game Canvas */}
                        <canvas
                            ref={canvasRef}
                            width={800}
                            height={550}
                            className="block w-full h-auto aspect-[800/550] bg-[#060e20]"
                        />
                    </div>
                    </div>
                </section>

                {/* CONTROL DECKS stacked side-by-side underneath */}
                <section className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Panel 1: Move Speed / Sensitivity Control */}
                    <div className="glass-panel rounded-2xl p-6 flex flex-col border border-secondary/20 shadow-[0_0_20px_rgba(76,215,246,0.08)] hover:border-secondary/40 transition-all duration-300">
                        <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
                            <span className="font-display text-xl">🕹️</span>
                            <h2 className="font-display text-base font-bold text-white tracking-wide uppercase">
                                Ship Move Speed
                            </h2>
                        </div>

                        <p className="font-body text-sm text-on-surface-variant mb-6 leading-relaxed">
                            Adjust the thruster responsiveness and sensitivity. Choose a preset or fine-tune using the throttle slider.
                        </p>

                        <div className="flex flex-col items-center gap-3 w-full mb-6">
                            <div className="flex justify-between w-full font-label text-xs text-on-surface-variant/80 uppercase">
                                <span>Sensitivity Throttle</span>
                                <span className="font-display text-base font-bold text-secondary">{Math.round(sensitivity * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0.3"
                                max="2.0"
                                step="0.1"
                                value={sensitivity}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setSensitivity(val);
                                    sensitivityRef.current = val;
                                }}
                                className="w-full h-2 appearance-none rounded-full cursor-pointer accent-secondary"
                                style={{
                                    background: `linear-gradient(to right, #4cd7f6 0%, #4cd7f6 ${((sensitivity - 0.3) / 1.7) * 100}%, #1a2a40 ${((sensitivity - 0.3) / 1.7) * 100}%, #1a2a40 100%)`
                                }}
                            />
                        </div>

                        <div className="flex flex-col gap-2 w-full mt-auto">
                            <span className="font-label text-xs uppercase tracking-wider text-on-surface-variant/70 mb-1">
                                Thruster Presets
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => { setSensitivity(0.6); sensitivityRef.current = 0.6; }}
                                    className={`px-3 py-2.5 rounded-lg text-xs font-label uppercase tracking-wider cursor-pointer transition-all hover:scale-[1.02] duration-200 ${sensitivity === 0.6 ? 'bg-secondary/25 text-secondary border border-secondary/40 font-bold' : 'bg-surface-container-low hover:bg-surface-container border border-white/5 text-on-surface-variant hover:text-white'}`}
                                >
                                    🐢 Slow
                                </button>
                                <button
                                    onClick={() => { setSensitivity(1.0); sensitivityRef.current = 1.0; }}
                                    className={`px-3 py-2.5 rounded-lg text-xs font-label uppercase tracking-wider cursor-pointer transition-all hover:scale-[1.02] duration-200 ${sensitivity === 1.0 ? 'bg-secondary/25 text-secondary border border-secondary/40 font-bold' : 'bg-surface-container-low hover:bg-surface-container border border-white/5 text-on-surface-variant hover:text-white'}`}
                                >
                                    ⚡ Normal
                                </button>
                                <button
                                    onClick={() => { setSensitivity(1.5); sensitivityRef.current = 1.5; }}
                                    className={`px-3 py-2.5 rounded-lg text-xs font-label uppercase tracking-wider cursor-pointer transition-all hover:scale-[1.02] duration-200 ${sensitivity === 1.5 ? 'bg-secondary/25 text-secondary border border-secondary/40 font-bold' : 'bg-surface-container-low hover:bg-surface-container border border-white/5 text-on-surface-variant hover:text-white'}`}
                                >
                                    🚀 Fast
                                </button>
                                <button
                                    onClick={() => { setSensitivity(2.0); sensitivityRef.current = 2.0; }}
                                    className={`px-3 py-2.5 rounded-lg text-xs font-label uppercase tracking-wider cursor-pointer transition-all hover:scale-[1.02] duration-200 ${sensitivity === 2.0 ? 'bg-secondary/25 text-secondary border border-secondary/40 font-bold' : 'bg-surface-container-low hover:bg-surface-container border border-white/5 text-on-surface-variant hover:text-white'}`}
                                >
                                    💨 Turbo
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Panel 2: Neural Weapon Compiler */}
                    <div className="glass-panel rounded-2xl p-6 flex flex-col border border-primary/20 shadow-[0_0_20px_rgba(221,183,255,0.08)] hover:border-primary/40 transition-all duration-300">
                        <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
                            <span className="font-display text-xl">🤖</span>
                            <h2 className="font-display text-base font-bold text-white tracking-wide uppercase">
                                NEURAL WEAPON COMPILER
                            </h2>
                        </div>

                        <p className="font-body text-sm text-on-surface-variant mb-4 leading-relaxed">
                            Draft a customized gun algorithm. The mainframe compiles natural descriptions into customized weapon metrics.
                        </p>

                        <form onSubmit={handleCompileSubmit} className="flex flex-col gap-3 mb-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={promptInput}
                                    onChange={(e) => setPromptInput(e.target.value)}
                                    placeholder="e.g. rapid fire red homing missiles"
                                    className="w-full bg-slate-950 border border-primary/30 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 outline-none rounded-xl p-4 text-base font-body text-white placeholder-on-surface-variant/40 pr-12 transition-all shadow-[0_0_15px_rgba(221,183,255,0.03)]"
                                />
                                {isCompiling && (
                                    <div className="absolute right-4 top-4.5 w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isCompiling || !promptInput.trim()}
                                className="w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 hover:border-primary/60 disabled:opacity-50 disabled:pointer-events-none rounded-xl py-3.5 font-label text-sm uppercase tracking-widest font-bold transition-all hover:shadow-[0_0_15px_rgba(221,183,255,0.15)] cursor-pointer"
                            >
                                {isCompiling ? 'COMPILING ALGORITHM...' : 'COMPILE WEAPON SYSTEM'}
                            </button>
                        </form>

                        {compilingError && (
                            <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error font-body text-xs mb-4">
                                {compilingError}
                            </div>
                        )}

                        {/* Presets Grid */}
                        <div className="flex flex-col gap-2">
                            <span className="font-label text-xs uppercase tracking-wider text-on-surface-variant/70">
                                Compiler Blueprint Presets
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                                {PRESETS.map((p, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSelectPreset(idx)}
                                        className="bg-surface-container-low hover:bg-surface-container border border-white/5 hover:border-white/10 rounded-lg p-3 text-left font-label text-xs text-on-surface-variant transition-all hover:text-white uppercase truncate hover:scale-[1.02] duration-200 cursor-pointer"
                                    >
                                                ⬡ {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Quick Control Matrix shown during gameplay */}
                        {gameState !== 'menu' && gameState !== 'gameover' && (
                            <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={handleStartClick}
                                    className="flex-1 bg-neon-red/10 text-neon-red border border-neon-red/30 hover:bg-neon-red/20 rounded-xl py-2.5 font-label text-xs uppercase tracking-widest font-bold transition-all text-center hover:shadow-[0_0_12px_rgba(255,49,49,0.15)] cursor-pointer"
                                >
                                🔄 RESTART
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAbortClick}
                                    className="flex-1 bg-surface-container text-on-surface-variant border border-white/10 hover:bg-surface-container-high rounded-xl py-2.5 font-label text-xs uppercase tracking-widest font-bold transition-all text-center cursor-pointer"
                                >
                                ⏹️ ABORT
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Panel 2: Compiled Weapon Matrix */}
                    <div className="glass-panel rounded-2xl p-6 flex flex-col border border-secondary/20 shadow-[0_0_20px_rgba(76,215,246,0.08)] hover:border-secondary/40 transition-all duration-300">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                            <h3 className="font-display text-base font-bold text-white tracking-wide uppercase">
                                Compiled Weapon Matrix
                            </h3>
                            <span className="font-label text-xs px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">
                                ACTIVE
                            </span>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <span className="font-display text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-secondary tracking-wide uppercase">
                                    {compiledWeapon.name}
                                </span>
                                <span
                                    className="w-4 h-4 rounded-full border border-white/30"
                                    style={{
                                        backgroundColor: compiledWeapon.color,
                                        boxShadow: `0 0 10px ${compiledWeapon.color}`
                                    }}
                                />
                            </div>

                            <p className="font-body text-sm text-on-surface-variant leading-relaxed italic">
                                {compiledWeapon.description}
                            </p>

                            <div className="space-y-4 mt-2 border-t border-white/5 pt-3">
                                <div>
                                    <div className="flex justify-between font-label text-xs text-on-surface-variant/80 uppercase mb-1.5">
                                        <span>TRAJECTORY</span>
                                        <span className="text-secondary font-extrabold text-sm">{compiledWeapon.behavior}</span>
                                    </div>
                                    <div className="h-2.5 bg-surface-container-lowest rounded-full overflow-hidden border border-white/5">
                                        <div
                                            className="h-full bg-secondary transition-all duration-700"
                                            style={{
                                                width: compiledWeapon.behavior === 'straight' ? '20%'
                                                    : compiledWeapon.behavior === 'spread' ? '60%'
                                                    : compiledWeapon.behavior === 'wavy' ? '40%'
                                                    : compiledWeapon.behavior === 'homing' ? '80%'
                                                    : '100%'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between font-label text-xs text-on-surface-variant/80 uppercase mb-1.5">
                                        <span>PULSE DELAY (FIRE RATE)</span>
                                        <span className="text-primary font-extrabold text-sm">{compiledWeapon.fireRate}ms</span>
                                    </div>
                                    <div className="h-2.5 bg-surface-container-lowest rounded-full overflow-hidden border border-white/5">
                                        <div
                                            className="h-full bg-primary transition-all duration-700"
                                            style={{ width: `${100 - ((compiledWeapon.fireRate - 100) / 9)}%` }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between font-label text-xs text-on-surface-variant/80 uppercase mb-1.5">
                                        <span>ENERGY OUTPUT (DAMAGE)</span>
                                        <span className="text-tertiary font-extrabold text-sm">{compiledWeapon.damage} HP</span>
                                    </div>
                                    <div className="h-2.5 bg-surface-container-lowest rounded-full overflow-hidden border border-white/5">
                                        <div
                                            className="h-full bg-tertiary transition-all duration-700"
                                            style={{ width: `${(compiledWeapon.damage / 50) * 100}%` }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between font-label text-xs text-on-surface-variant/80 uppercase mb-1.5">
                                        <span>CALIBER (BULLET SIZE)</span>
                                        <span className="text-white font-extrabold text-sm">{compiledWeapon.bulletSize}px</span>
                                    </div>
                                    <div className="h-2.5 bg-surface-container-lowest rounded-full overflow-hidden border border-white/5">
                                        <div
                                            className="h-full bg-white transition-all duration-700"
                                            style={{ width: `${((compiledWeapon.bulletSize - 2) / 10) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
