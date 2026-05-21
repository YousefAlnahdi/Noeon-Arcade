'use client';

import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { askDeepSeek } from '@/lib/deepseek';

// ── Character Generation Data ──────────────────────────────────────────
const FIRST_NAMES = [
  'Jax', 'Kira', 'Vex', 'Nova', 'Sable', 'Renn', 'Zara', 'Dex', 'Lira', 'Orion',
  'Kai', 'Mira', 'Sol', 'Ash', 'Nyx', 'Blaze', 'Echo', 'Talon', 'Lyric', 'Storm'
];
const LAST_NAMES = [
  'Voidwalker', 'Chrome', 'Nexus', 'Driftwood', 'Steele', 'Haze', 'Blackwell', 'Surge',
  'Flux', 'Cipher', 'Ghost', 'Neon', 'Wire', 'Shade', 'Volt', 'Ember', 'Prism', 'Glitch'
];
const NATIONALITIES = [
  'Neo-Tokyo Sector', 'Europa Collective', 'Saharan Free State', 'Atlantis Ring',
  'Arctic Haven', 'Silicon Valley Enclave', 'Mumbai Megaplex', 'Lagos Neon District',
  'Berlin Underground', 'Seoul Highrise Zone'
];
const PURPOSES = [
  'Trade & Commerce', 'Medical Treatment', 'Family Reunion', 'Academic Research',
  'Tourism & Leisure', 'Tech Conference', 'Refugee Asylum', 'Corporate Transfer',
  'Artistic Residency', 'Freelance Contract'
];
const OCCUPATIONS = [
  'Neural Engineer', 'Synth Medic', 'Data Courier', 'Mech Technician',
  'Bio-Chemist', 'Holo-Artist', 'Quantum Trader', 'Cyber-Journalist',
  'Nano-Surgeon', 'Grid Architect', 'Freelance Hacker', 'Street Vendor'
];

// Criminal backstories for the AI to roleplay — each includes SPECIFIC contradictions with passport data
const CRIMINAL_DIRECTIVES = [
  `You are secretly smuggling illegal cybernetic implants inside your luggage. You have a fake trade permit.
  CONTRADICTIONS TO PLANT: Your passport says your occupation is one thing, but if asked what you do day-to-day, describe a completely different job. If asked about your luggage, be vague and change the subject. If pressed hard, become nervous and stutter.`,

  `You are wanted for data theft from a mega-corporation. Your passport is forged.
  CONTRADICTIONS TO PLANT: The nationality on your passport is WRONG — if the officer asks you about your hometown or local customs from your listed nationality, give answers that don't match (mention wrong landmarks, wrong climate, wrong local food). If asked why, make an excuse like "I moved away young."`,

  `You are carrying a concealed EMP weapon to sabotage the city's power grid. You claim to be a tourist.
  CONTRADICTIONS TO PLANT: Your passport says your purpose is one thing, but during conversation you accidentally mention a DIFFERENT reason for visiting (e.g., "meeting a contact" or "picking up a package"). If the officer catches it, quickly try to correct yourself. Also, if asked about tourist spots or hotels, struggle to name any.`,

  `You are a fugitive who escaped a prison colony. Your age on the passport is falsified — you are actually 10 years OLDER.
  CONTRADICTIONS TO PLANT: If asked about your age or when you graduated/started working, your math won't add up. For example, say you've been working for 25 years, which would make you older than your passport age. If confronted, become defensive and say "I misspoke."`,

  `You are an undercover agent for a rival city planning corporate espionage.
  CONTRADICTIONS TO PLANT: Your passport lists one occupation, but you accidentally use jargon or knowledge from a military/intelligence background that doesn't match. Your cover story mentions a "tech conference" but you don't know the conference name, location, or any speakers when asked. If pressed, change the subject nervously.`,

  `You are a black-market organ dealer transporting illegal bio-synthetic organs in a cooler disguised as medical supplies.
  CONTRADICTIONS TO PLANT: You claim to be in the medical field but use incorrect medical terminology when pressed. If asked about your employer or hospital, give a name that doesn't exist. Your hands shake when discussing your cargo.`,

  `You are a hacker who just wiped a city's entire financial database. You are fleeing before authorities catch up.
  CONTRADICTIONS TO PLANT: You say you've been traveling for "a few hours" but your passport shows a stamp from 3 days ago from a distant sector. If asked about your travel timeline, the numbers don't add up. You keep glancing at your device nervously.`,

  `You are a gang leader with a bounty on your head. Your identity is entirely fabricated.
  CONTRADICTIONS TO PLANT: Your name feels unfamiliar to you — if asked to spell your last name, hesitate or spell it differently than what's on the passport. If asked casual questions about your life (hobbies, family), your answers feel rehearsed and generic.`,

  `You are smuggling a weaponized AI chip that could take control of the city's defense systems.
  CONTRADICTIONS TO PLANT: You claim to work in "tech support" but when asked basic tech questions, you give expert-level answers about neural networks and cybersecurity that don't match a support role. Your purpose says one thing but you mention needing to "deliver something to someone important."`,

  `You are a corrupt ex-border officer from another city who sold classified security codes.
  CONTRADICTIONS TO PLANT: You know WAY too much about checkpoint procedures and security protocols for a regular civilian. If asked how you know these things, stumble over your words. Your occupation on the passport doesn't explain your security knowledge.`
];

const INFECTED_DIRECTIVES = [
  `You are infected with the Neon Plague (a highly contagious nano-virus). You feel unwell but are trying to hide it.
  CONTRADICTIONS TO PLANT: Due to brain fog from the illness, occasionally state your age WRONG by 1-2 years, or slightly misspell/mispronounce your own last name. If the officer notices, say "Sorry, I'm just tired from the journey." Show physical symptoms: *coughs*, *shivers*, *wipes sweat from forehead*.`,

  `You carry the Synapse Rot virus which causes memory lapses.
  CONTRADICTIONS TO PLANT: Forget details you already mentioned. For example, say your purpose is "medical treatment" in one answer, then later say "I'm here for business" by accident. If asked about your occupation, give a slightly different job title than what's on the passport. Occasionally pause mid-sentence as if you lost your train of thought.`,

  `You have the Chrome Fever — a cybernetic rejection syndrome that is contagious. You keep twitching.
  CONTRADICTIONS TO PLANT: Due to fever-induced confusion, mix up your nationality with a different one mid-conversation, then quickly correct yourself. Mention headaches when asked how you feel. Try to rush through the checkpoint — say things like "Can we hurry this up? I really need to get through." *twitches involuntarily*`,

  `You are infected with Bio-Dust, an airborne pathogen. You keep coughing but claim it's just allergies.
  CONTRADICTIONS TO PLANT: When asked how long you've been traveling, give inconsistent timeframes (e.g., "left 3 days ago" then later "been traveling for a week"). If the officer insists about your coughing, become anxious and beg to be let through quickly. *coughs into sleeve* *wipes nose nervously*`,

  `You have Glitch Syndrome — a virus that corrupts cybernetic implants and spreads via proximity. Your vision keeps blurring.
  CONTRADICTIONS TO PLANT: You misread things. If asked about details on your passport, accidentally say the wrong passport ID number or misread your own occupation. Blame it on "bad lighting" or "my optics are glitching." *rubs eyes repeatedly* *blinks hard*`,

  `You are carrying the Rust Plague — a pathogen that causes rapid decay of cybernetic tissue. Your arm trembles uncontrollably.
  CONTRADICTIONS TO PLANT: You keep switching which hand you use, as if one arm is failing. If asked about your health, say you're "just cold" but then mention it's actually been hot outside. Contradicting your own temperature perception. *flexes fingers painfully* *grips wrist with other hand*`,

  `You have Neural Drift — a contagious condition that causes personality fragmentation. You sometimes speak as a different person.
  CONTRADICTIONS TO PLANT: Your tone shifts dramatically mid-conversation. In one message you're polite and formal, in the next you're aggressive or confused. If asked about your occupation, give one answer, then later give a completely different one as if the first never happened. *stares blankly for a moment*`,

  `You are infected with Phantom Code — a digital virus that jumps between organic and synthetic hosts. You hear voices.
  CONTRADICTIONS TO PLANT: Occasionally respond to something nobody said, like "No, I wasn't talking about that" when the officer didn't mention it. Confuse your nationality with a neighboring sector. Get your own travel dates mixed up. *tilts head as if listening to something* *whispers under breath*`
];

const CLEAN_DIRECTIVES = [
  'You are a completely normal, law-abiding citizen. Answer all questions honestly and consistently. You are calm, polite, and have nothing to hide. Your documents are all legitimate.',
  'You are a friendly traveler, excited to visit the city. Be enthusiastic and open. All your information is truthful and your documents are in order.',
  'You are a quiet, reserved professional on a business trip. Answer concisely but honestly. Everything checks out perfectly.',
  'You are a parent traveling to reunite with family in the city. You are warm and cooperative. All your paperwork and answers are consistent and truthful.',
  'You are a retired military veteran visiting old friends in the city. You are disciplined, direct, and no-nonsense. You answer everything clearly and have perfect documentation.',
  'You are a university student transferring to a school in the city. You are a little nervous (first time traveling alone) but completely innocent. You over-explain things out of anxiety, but everything checks out.',
  'You are a journalist covering a story about the city\'s tech boom. You are curious, ask the officer questions too, and are very transparent about your purpose. Everything is legitimate.',
  'You are a street musician hoping to perform in the city\'s entertainment district. You are laid-back, crack jokes, and are completely honest. You might even hum a tune while waiting.'
];

// ── Personality Traits (affects speaking style) ─────────────────────
const PERSONALITIES = [
  { id: 'aggressive', desc: 'You are AGGRESSIVE and confrontational. You resent being stopped and questioned. Use short, sharp sentences. Challenge the officer\'s authority. "Why do I need to answer that?" "You got a problem?"' },
  { id: 'nervous', desc: 'You are VERY NERVOUS. You speak fast, repeat yourself, and over-explain everything. You fidget constantly. Even innocent things sound suspicious because of how anxious you are.' },
  { id: 'charming', desc: 'You are SMOOTH and CHARMING. You flirt subtly, use humor, and try to build rapport with the officer. You\'re charismatic and try to make the officer like you so they\'ll let you through.' },
  { id: 'cold', desc: 'You are COLD and EMOTIONLESS. You answer in the shortest possible sentences. You show zero emotion. You find this whole process beneath you. One-word answers when possible.' },
  { id: 'chatty', desc: 'You are extremely TALKATIVE. You ramble about everything — the weather, the queue, a story about your neighbor. You give way more information than asked, making it hard for the officer to find the real clues among all the noise.' },
  { id: 'respectful', desc: 'You are OVERLY RESPECTFUL and formal. You call the officer "sir" or "ma\'am" constantly. You are polite to a fault. You seem almost too perfect, too rehearsed in your politeness.' },
  { id: 'confused', desc: 'You are CONFUSED and disoriented from the long journey. You ask the officer to repeat questions. You seem dazed. You take a moment to think before answering. Not suspicious — just exhausted.' },
  { id: 'cocky', desc: 'You are COCKY and arrogant. You act like this checkpoint is a joke and you\'re too important to be stopped. Name-drop fake connections. Act like you own the place.' },
];

// ── Greeting templates (randomized per character) ──────────────────
const GREETINGS_CRIMINAL = [
  (c) => `*walks up slowly, scanning the area* ...Yeah, hi. ${c.purpose.toLowerCase()}. Papers are in here somewhere.`,
  (c) => `*adjusts collar, avoiding eye contact* Officer. Just passing through. Here for ${c.purpose.toLowerCase()}.`,
  (c) => `*approaches with a forced smile* Hey, how's it going? Just need to get through quick, got ${c.purpose.toLowerCase()} to take care of.`,
  (c) => `*fumbles with documents, drops one* Ah, sorry. Here. I'm here for ${c.purpose.toLowerCase()}. Long trip.`,
  (c) => `*steps up, hands deep in jacket* Yo. Let's make this quick, yeah? ${c.purpose.toLowerCase()}, that's all.`,
  (c) => `*leans against the counter, too casual* What's up, officer? Just a regular ${c.occupation.toLowerCase()} heading in for ${c.purpose.toLowerCase()}. No big deal.`,
];

const GREETINGS_INFECTED = [
  (c) => `*approaches slowly, breathing heavily* H-hey officer... *wipes forehead* here for ${c.purpose.toLowerCase()}. Sorry, long journey.`,
  (c) => `*shuffles forward, looking pale* Morning... or is it evening? *squints* Lost track. Here for ${c.purpose.toLowerCase()}.`,
  (c) => `*steadies self against the counter* Excuse me... *coughs lightly* I'm here for ${c.purpose.toLowerCase()}. Just need to get through.`,
  (c) => `*walks up unsteadily, rubbing temples* Hey there... *blinks hard* Sorry, bit of a headache. ${c.purpose.toLowerCase()} — got my docs right here.`,
  (c) => `*approaches, constantly adjusting posture* Officer... *shivers despite the heat* I'm here for ${c.purpose.toLowerCase()}. Can we... can we do this quickly?`,
];

const GREETINGS_CLEAN = [
  (c) => `*steps forward calmly with documents ready* Good day, officer. Here for ${c.purpose.toLowerCase()}. Got everything you need right here.`,
  (c) => `*walks up confidently, smiling* Hey! ${c.firstName} ${c.lastName}, here for ${c.purpose.toLowerCase()}. What do you need from me?`,
  (c) => `*approaches the checkpoint at a steady pace* Hello officer. I'm a ${c.occupation.toLowerCase()}, in town for ${c.purpose.toLowerCase()}. Here are my papers.`,
  (c) => `*waits patiently in line, then steps up* Hi there. ${c.purpose.toLowerCase()} — I've got all my documents sorted. *holds out passport*`,
  (c) => `*nods politely* Officer. ${c.firstName}. Just here for ${c.purpose.toLowerCase()}, nothing exciting. *smiles*`,
  (c) => `*walks up briskly, organized* Afternoon! Ready whenever you are. ${c.purpose.toLowerCase()} — all paperwork is in order.`,
];

// ── Avatar Feature Sets ────────────────────────────────────────────────
const HAIR_STYLES = ['mohawk', 'slicked', 'buzz', 'long', 'bald', 'cyberhawk'];
const FACE_SHAPES = ['angular', 'round', 'square', 'oval'];
const CYBER_MODS = ['eye_implant', 'jaw_plate', 'temple_circuit', 'neck_port', 'none'];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Generate a random character ────────────────────────────────────────
function generateCharacter() {
  const statusRoll = Math.random();
  let hiddenStatus, secretDirective;

  if (statusRoll < 0.35) {
    hiddenStatus = 'CRIMINAL';
    secretDirective = randomFrom(CRIMINAL_DIRECTIVES);
  } else if (statusRoll < 0.55) {
    hiddenStatus = 'INFECTED';
    secretDirective = randomFrom(INFECTED_DIRECTIVES);
  } else {
    hiddenStatus = 'CLEAN';
    secretDirective = randomFrom(CLEAN_DIRECTIVES);
  }

  // ── Unreliable Visual Cues ──────────────────────────────────────
  // ~40% chance the visual appearance MISMATCHES the true status.
  // This prevents the player from relying on visuals alone.
  const ALL_VISUAL_STATUSES = ['CLEAN', 'CRIMINAL', 'INFECTED'];
  let visualStatus;
  if (Math.random() < 0.4) {
    // Pick a random visual that is DIFFERENT from the true status
    const fakeOptions = ALL_VISUAL_STATUSES.filter(s => s !== hiddenStatus);
    visualStatus = randomFrom(fakeOptions);
  } else {
    visualStatus = hiddenStatus;
  }

  const age = randomBetween(19, 62);
  const passportId = 'NC-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + randomBetween(1000, 9999);

  // ── Bribe System ────────────────────────────────────────────────────
  // ~50% of criminals will attempt to bribe the officer
  const hasBribe = hiddenStatus === 'CRIMINAL' && Math.random() < 0.7;
  const bribeAmount = hasBribe ? randomBetween(10, 25) : 0;

  return {
    firstName: randomFrom(FIRST_NAMES),
    lastName: randomFrom(LAST_NAMES),
    age,
    nationality: randomFrom(NATIONALITIES),
    purpose: randomFrom(PURPOSES),
    occupation: randomFrom(OCCUPATIONS),
    passportId,
    hiddenStatus,
    visualStatus,
    secretDirective,
    personality: randomFrom(PERSONALITIES),
    hasBribe,
    bribeAmount,
    // Avatar traits
    hairStyle: randomFrom(HAIR_STYLES),
    faceShape: randomFrom(FACE_SHAPES),
    cyberMod: randomFrom(CYBER_MODS),
    skinHue: randomBetween(0, 360),
  };
}

// ── Holographic Avatar Component ───────────────────────────────────────
function HolographicAvatar({ character, status }) {
  const baseColor = status === 'CRIMINAL' ? '#ff3131' : status === 'INFECTED' ? '#f5a623' : '#4cd7f6';
  const glowColor = status === 'CRIMINAL' ? 'rgba(255,49,49,0.4)' : status === 'INFECTED' ? 'rgba(245,166,35,0.4)' : 'rgba(76,215,246,0.3)';
  const scanLineColor = status === 'CRIMINAL' ? 'rgba(255,49,49,0.08)' : status === 'INFECTED' ? 'rgba(245,166,35,0.08)' : 'rgba(76,215,246,0.06)';

  const showGlitch = status === 'CRIMINAL';
  const showSweat = status === 'INFECTED';

  // Face shape path
  const facePaths = {
    angular: 'M80,30 L110,50 L115,100 L105,130 L55,130 L45,100 L50,50 Z',
    round: 'M80,28 Q120,50 115,95 Q110,140 80,145 Q50,140 45,95 Q40,50 80,28 Z',
    square: 'M50,35 L110,35 L115,130 L45,130 Z',
    oval: 'M80,25 Q125,60 115,100 Q105,145 80,150 Q55,145 45,100 Q35,60 80,25 Z',
  };

  // Hair paths
  const hairPaths = {
    mohawk: <path d="M70,30 L75,5 L80,15 L85,2 L90,18 L95,8 L100,30" fill={baseColor} opacity="0.7" />,
    slicked: <path d="M45,45 Q50,15 80,12 Q110,15 115,45 L110,40 Q100,22 80,20 Q60,22 50,40 Z" fill={baseColor} opacity="0.5" />,
    buzz: <ellipse cx="80" cy="30" rx="30" ry="10" fill={baseColor} opacity="0.3" />,
    long: <><path d="M45,50 Q40,30 55,15 Q75,5 95,15 Q115,30 110,50 L115,90 L110,100 Q108,60 100,50" fill={baseColor} opacity="0.4" /><path d="M45,50 L40,95 L48,100 Q50,60 55,50" fill={baseColor} opacity="0.35" /></>,
    bald: null,
    cyberhawk: <><path d="M65,32 L60,2 L70,20 L75,0 L80,22 L85,3 L90,25 L95,8 L100,32" fill={baseColor} opacity="0.8" /><line x1="60" y1="10" x2="100" y2="10" stroke={baseColor} strokeWidth="1" opacity="0.4" /></>,
  };

  // Cyber modification overlays
  const cyberModOverlays = {
    eye_implant: <><circle cx="68" cy="75" r="8" fill="none" stroke={baseColor} strokeWidth="1.5" opacity="0.9" /><circle cx="68" cy="75" r="3" fill={baseColor} opacity="0.6" /><line x1="60" y1="75" x2="50" y2="72" stroke={baseColor} strokeWidth="0.8" opacity="0.5" /></>,
    jaw_plate: <path d="M55,115 Q60,125 80,128 Q100,125 105,115 L108,118 Q100,135 80,138 Q60,135 52,118 Z" fill={baseColor} opacity="0.25" stroke={baseColor} strokeWidth="0.5" />,
    temple_circuit: <><line x1="45" y1="60" x2="35" y2="55" stroke={baseColor} strokeWidth="1" opacity="0.6" /><line x1="35" y1="55" x2="30" y2="65" stroke={baseColor} strokeWidth="1" opacity="0.6" /><circle cx="30" cy="65" r="2" fill={baseColor} opacity="0.8" /><line x1="115" y1="60" x2="125" y2="55" stroke={baseColor} strokeWidth="1" opacity="0.6" /><circle cx="125" cy="55" r="2" fill={baseColor} opacity="0.8" /></>,
    neck_port: <><rect x="72" y="140" width="16" height="8" rx="2" fill="none" stroke={baseColor} strokeWidth="1" opacity="0.6" /><line x1="76" y1="142" x2="76" y2="146" stroke={baseColor} strokeWidth="0.8" opacity="0.5" /><line x1="80" y1="142" x2="80" y2="146" stroke={baseColor} strokeWidth="0.8" opacity="0.5" /><line x1="84" y1="142" x2="84" y2="146" stroke={baseColor} strokeWidth="0.8" opacity="0.5" /></>,
    none: null,
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          boxShadow: `0 0 30px ${glowColor}, inset 0 0 20px ${glowColor}`,
          border: `1px solid ${baseColor}30`,
        }}
      />
      {/* Scan lines overlay */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none z-10"
        style={{
          background: `linear-gradient(transparent 50%, ${scanLineColor} 50%)`,
          backgroundSize: '100% 4px',
        }}
      />

      <svg viewBox="0 0 160 180" className={`w-full h-full ${showGlitch ? 'animate-glitch-avatar' : ''}`}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Face outline */}
        <path
          d={facePaths[character.faceShape] || facePaths.oval}
          fill="none"
          stroke={baseColor}
          strokeWidth="1.5"
          opacity="0.7"
          filter="url(#glow)"
        />
        {/* Inner face fill */}
        <path
          d={facePaths[character.faceShape] || facePaths.oval}
          fill={baseColor}
          opacity="0.06"
        />

        {/* Eyes */}
        <ellipse cx="68" cy="78" rx="6" ry="4" fill={baseColor} opacity="0.8" />
        <ellipse cx="92" cy="78" rx="6" ry="4" fill={baseColor} opacity="0.8" />
        {/* Pupils */}
        <circle cx="68" cy="78" r="2" fill="#fff" opacity="0.9" />
        <circle cx="92" cy="78" r="2" fill="#fff" opacity="0.9" />

        {/* Nose */}
        <line x1="80" y1="85" x2="80" y2="98" stroke={baseColor} strokeWidth="1" opacity="0.4" />
        <line x1="76" y1="98" x2="84" y2="98" stroke={baseColor} strokeWidth="1" opacity="0.3" />

        {/* Mouth */}
        <path d="M68,112 Q80,120 92,112" fill="none" stroke={baseColor} strokeWidth="1.2" opacity="0.5" />

        {/* Hair */}
        {hairPaths[character.hairStyle]}

        {/* Cyber modifications */}
        {cyberModOverlays[character.cyberMod]}

        {/* Sweat drops for infected */}
        {showSweat && (
          <>
            <circle cx="50" cy="65" r="1.5" fill="#f5a623" opacity="0.7">
              <animate attributeName="cy" from="65" to="85" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.7" to="0" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="112" cy="70" r="1.5" fill="#f5a623" opacity="0.6">
              <animate attributeName="cy" from="70" to="90" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.6" to="0" dur="2.5s" repeatCount="indefinite" />
            </circle>
          </>
        )}

        {/* Glitch bars for criminal */}
        {showGlitch && (
          <>
            <rect x="0" y="60" width="160" height="3" fill={baseColor} opacity="0.15">
              <animate attributeName="y" values="60;90;40;110;60" dur="3s" repeatCount="indefinite" />
            </rect>
            <rect x="0" y="100" width="160" height="2" fill={baseColor} opacity="0.1">
              <animate attributeName="y" values="100;50;120;70;100" dur="4s" repeatCount="indefinite" />
            </rect>
          </>
        )}
      </svg>

      {/* Status scan label */}
      <div className="absolute bottom-2 left-0 right-0 text-center">
        <span
          className="font-label text-[8px] tracking-[0.25em] uppercase px-2 py-0.5 rounded"
          style={{
            color: baseColor,
            background: `${baseColor}15`,
            border: `1px solid ${baseColor}30`,
          }}
        >
          {status === 'CRIMINAL' ? 'SCAN: ANOMALY' : status === 'INFECTED' ? 'SCAN: ELEVATED' : 'SCAN: STABLE'}
        </span>
      </div>
    </div>
  );
}


// ── BORDER SYSTEM PROMPT ───────────────────────────────────────────────
const BORDER_SYSTEM_PROMPT = `You are roleplaying as a character arriving at a Cyberpunk border checkpoint in "Neon City". 
You are being interrogated by a Border Control Officer (the player).

CRITICAL RULES:
1. Stay in character AT ALL TIMES. Never break character or mention that you are an AI.
2. Respond in 1-3 SHORT sentences. Keep it natural and conversational.
3. Follow your SECRET DIRECTIVE precisely — it defines your hidden motives, behavior, AND specific contradictions you must plant.
4. Follow your PERSONALITY trait — it defines HOW you speak, your tone, your attitude, and your body language. This is critical for variety.
5. Use occasional cyberpunk slang. Keep the retro-futuristic vibe.
6. NEVER reveal your hidden status directly. Make the officer WORK for it.
7. Between responses, include brief physical description cues in *asterisks* to hint at your true state.
8. IMPORTANT: Vary your responses! Do not repeat the same phrases or patterns. Each answer should feel unique and reflect your specific personality.

DISCREPANCY RULES (VERY IMPORTANT):
- If you are CLEAN: You MUST be 100% consistent with your passport data at ALL times. Your name, age, nationality, occupation, and purpose must ALWAYS match exactly. You are calm and have nothing to hide.
- If you are CRIMINAL: You MUST follow the "CONTRADICTIONS TO PLANT" section in your secret directive. These are SPECIFIC inconsistencies between what you say and what your passport shows. Drop these contradictions NATURALLY — don't make them obvious. When the officer catches a contradiction, react nervously: try to backtrack, make excuses ("I misspoke", "you misheard me"), or change the subject. Do NOT immediately confess.
- If you are INFECTED: You MUST follow the "CONTRADICTIONS TO PLANT" section in your secret directive. Your contradictions come from illness-related confusion (memory fog, fever, disorientation). When caught in a contradiction, look confused and say something like "Sorry... I'm not feeling great" or "Did I say that? I meant...". Also show physical symptoms in *asterisks* like *coughs*, *shivers*, *wipes forehead*, *squints as if dizzy*.

BRIBE RULES:
- If your game context includes "bribe_enabled: true", you are a criminal who wants to bribe the officer.
- After 1-2 exchanges, naturally slip in an offer. Examples: "Listen officer, I know things move slow... maybe I can make this easier for both of us?", "What if I left a little something for your trouble? Say, some credits to smooth things over?", "Look, I got tokens. Good ones. Just let me through, yeah?"
- If the officer seems interested, increase the pressure subtly. If rejected, become nervous but don't give up immediately.
- NEVER mention the exact token amount — the game UI handles that.

REMEMBER: The passport data provided in the game context is what the officer sees on their screen. Your job is to either match it perfectly (if CLEAN) or subtly contradict it (if CRIMINAL/INFECTED) according to your directive.`;


// ══════════════════════════════════════════════════════════════════════
// MAIN GAME COMPONENT
// ══════════════════════════════════════════════════════════════════════
export default function NeonCityBorderPage() {
  const { user, playerProfile } = useAuth();
  const chatEndRef = useRef(null);

  // ── Game State ───────────────────────────────────────────────────
  const [gameState, setGameState] = useState('welcome'); // welcome | loading | playing | revealed | game-over | victory
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0); // characters cleared correctly
  const [characterIndex, setCharacterIndex] = useState(0); // which character (0-4)
  const [character, setCharacter] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [questionsLeft, setQuestionsLeft] = useState(5);
  const [inputValue, setInputValue] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [revealResult, setRevealResult] = useState(null); // { correct: bool, trueStatus, decision }
  const [totalTokensEarned, setTotalTokensEarned] = useState(0);

  // ── Investigation Gadgets ────────────────────────────────────────
  const [gadgetUses, setGadgetUses] = useState({ lieDetector: 2, bioScanner: 2, dbQuery: 1 });
  const [gadgetResult, setGadgetResult] = useState(null); // { type, data }
  const [isScanning, setIsScanning] = useState(false);

  // ── Bribe System ────────────────────────────────────────────────
  const [bribeState, setBribeState] = useState('hidden'); // hidden | offered | accepted | rejected
  const questionsAsked = 5 - questionsLeft;

  // Trigger bribe offer after 2 questions if character has bribe
  useEffect(() => {
    if (gameState === 'playing' && character?.hasBribe && questionsAsked >= 2 && bribeState === 'hidden') {
      setBribeState('offered');
    }
  }, [questionsAsked, gameState, character, bribeState]);

  // ── Use Lie Detector ─────────────────────────────────────────────
  const useLieDetector = () => {
    if (gadgetUses.lieDetector <= 0 || isScanning || gameState !== 'playing' || !character) return;
    setGadgetUses(prev => ({ ...prev, lieDetector: prev.lieDetector - 1 }));
    setIsScanning(true);
    setTimeout(() => {
      const isSuspicious = character.hiddenStatus !== 'CLEAN';
      // 75% accuracy: sometimes clean people show high BPM (nervous), sometimes criminals stay calm
      const accurateReading = Math.random() < 0.75;
      const showsHigh = accurateReading ? isSuspicious : !isSuspicious;
      const bpm = showsHigh ? randomBetween(105, 145) : randomBetween(62, 88);
      setGadgetResult({
        type: 'lie_detector',
        bpm,
        level: bpm > 100 ? 'ELEVATED' : 'NORMAL',
        color: bpm > 100 ? '#ff3131' : '#39ff14',
      });
      setIsScanning(false);
    }, 1200);
  };

  // ── Use Bio-Scanner ──────────────────────────────────────────────
  const useBioScanner = () => {
    if (gadgetUses.bioScanner <= 0 || isScanning || gameState !== 'playing' || !character) return;
    setGadgetUses(prev => ({ ...prev, bioScanner: prev.bioScanner - 1 }));
    setIsScanning(true);
    setTimeout(() => {
      const isInfected = character.hiddenStatus === 'INFECTED';
      // 80% accuracy for detecting infected
      const accurateReading = Math.random() < 0.8;
      const showsInfected = accurateReading ? isInfected : !isInfected;
      const temp = showsInfected ? (37.5 + Math.random() * 2.5).toFixed(1) : (36.2 + Math.random() * 0.8).toFixed(1);
      const contamination = showsInfected ? randomBetween(45, 92) : randomBetween(2, 15);
      setGadgetResult({
        type: 'bio_scanner',
        temp,
        contamination,
        level: contamination > 30 ? 'WARNING' : 'CLEAR',
        color: contamination > 30 ? '#f5a623' : '#39ff14',
      });
      setIsScanning(false);
    }, 1500);
  };

  // ── Use Database Query ───────────────────────────────────────────
  const useDbQuery = () => {
    if (gadgetUses.dbQuery <= 0 || isScanning || gameState !== 'playing' || !character) return;
    setGadgetUses(prev => ({ ...prev, dbQuery: prev.dbQuery - 1 }));
    setIsScanning(true);
    setTimeout(() => {
      const isCriminal = character.hiddenStatus === 'CRIMINAL';
      // 90% accuracy for detecting forged passports
      const accurateReading = Math.random() < 0.9;
      const showsForged = accurateReading ? isCriminal : !isCriminal;
      setGadgetResult({
        type: 'db_query',
        passportValid: !showsForged,
        matchRate: showsForged ? randomBetween(12, 45) : randomBetween(88, 99),
        flags: showsForged ? randomFrom(['INTERPOL_WATCHLIST', 'DOC_MISMATCH', 'BIOMETRIC_FAIL', 'EXPIRED_VISA']) : 'NONE',
        level: showsForged ? 'FLAGGED' : 'VERIFIED',
        color: showsForged ? '#ff3131' : '#39ff14',
      });
      setIsScanning(false);
    }, 1800);
  };

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isAiTyping]);

  // ── Start a new game ─────────────────────────────────────────────
  const startGame = () => {
    setLives(3);
    setScore(0);
    setCharacterIndex(0);
    setTotalTokensEarned(0);
    setGadgetUses({ lieDetector: 2, bioScanner: 2, dbQuery: 1 });
    setGadgetResult(null);
    loadNextCharacter(true);
  };

  // ── Load the next character ──────────────────────────────────────
  const loadNextCharacter = (isFirst = false) => {
    setGameState('loading');
    const newChar = generateCharacter();
    setCharacter(newChar);
    setChatHistory([]);
    setQuestionsLeft(5);
    setInputValue('');
    setRevealResult(null);
    setGadgetResult(null);
    setBribeState('hidden');

    // Simulate "scanning" delay
    setTimeout(() => {
      setGameState('playing');
      // Add system greeting
      const greetingFn = newChar.hiddenStatus === 'CRIMINAL'
        ? randomFrom(GREETINGS_CRIMINAL)
        : newChar.hiddenStatus === 'INFECTED'
          ? randomFrom(GREETINGS_INFECTED)
          : randomFrom(GREETINGS_CLEAN);

      setChatHistory([
        {
          role: 'system',
          content: `Subject #${(isFirst ? 0 : characterIndex) + 1} approaching checkpoint. Initiating neural scan...`,
        },
        {
          role: 'character',
          content: greetingFn(newChar),
        },
      ]);
    }, 1500);
  };

  // ── Send a message to the character ──────────────────────────────
  const sendMessage = async () => {
    if (!inputValue.trim() || questionsLeft <= 0 || isAiTyping || gameState !== 'playing') return;

    const userMsg = inputValue.trim();
    setInputValue('');
    setQuestionsLeft((prev) => prev - 1);
    setChatHistory((prev) => [...prev, { role: 'officer', content: userMsg }]);
    setIsAiTyping(true);

    try {
      const gameContext = {
        character_name: `${character.firstName} ${character.lastName}`,
        age: character.age,
        nationality: character.nationality,
        occupation: character.occupation,
        purpose_of_visit: character.purpose,
        passport_id: character.passportId,
        personality: character.personality.desc,
        bribe_enabled: character.hasBribe && bribeState !== 'rejected',
        hidden_status: character.hiddenStatus,
        secret_directive: character.secretDirective,
        questions_remaining: questionsLeft - 1,
      };

      const messages = chatHistory
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'officer' ? 'user' : 'assistant',
          content: m.content,
        }));
      messages.push({ role: 'user', content: userMsg });

      const reply = await askDeepSeek(messages, gameContext, BORDER_SYSTEM_PROMPT, 150);

      if (reply && !reply.startsWith('ERROR')) {
        setChatHistory((prev) => [...prev, { role: 'character', content: reply }]);
      } else {
        setChatHistory((prev) => [
          ...prev,
          { role: 'character', content: '*shifts uncomfortably* ...I\'m not sure what you mean, officer.' },
        ]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setChatHistory((prev) => [
        ...prev,
        { role: 'character', content: '*looks around nervously* Could you repeat that, officer?' },
      ]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // ── Player makes a decision ──────────────────────────────────────
  const makeDecision = async (decision) => {
    // decision: 'approve' or 'deny'
    if (gameState !== 'playing') return;

    const trueStatus = character.hiddenStatus;
    let correct = false;

    if (decision === 'approve' && trueStatus === 'CLEAN') correct = true;
    if (decision === 'deny' && (trueStatus === 'CRIMINAL' || trueStatus === 'INFECTED')) correct = true;

    let newLives = lives;
    let tokensForThis = 0;

    if (correct) {
      tokensForThis = trueStatus === 'CLEAN' ? 3 : 5;
    } else {
      newLives = lives - 1;
      tokensForThis = 0;
    }

    setRevealResult({ correct, trueStatus, decision });
    setLives(newLives);
    setScore((prev) => prev + (correct ? 1 : 0));
    setTotalTokensEarned((prev) => prev + tokensForThis);
    setGameState('revealed');

    // Check game end conditions after all 5 characters
    const nextIndex = characterIndex + 1;
    setCharacterIndex(nextIndex);

    if (newLives <= 0) {
      // Game over
      setTimeout(() => setGameState('game-over'), 2500);
      await saveSession('loss', score + (correct ? 1 : 0), totalTokensEarned + tokensForThis);
    } else if (nextIndex >= 5) {
      // Victory!
      setTimeout(() => setGameState('victory'), 2500);
      await saveSession('win', score + (correct ? 1 : 0), totalTokensEarned + tokensForThis);
    }
  };

  // ── Continue to next character ───────────────────────────────────
  const continueToNext = () => {
    if (lives <= 0) {
      setGameState('game-over');
      return;
    }
    if (characterIndex >= 5) {
      setGameState('victory');
      return;
    }
    loadNextCharacter();
  };

  // ── Save game session to Supabase ────────────────────────────────
  const saveSession = async (result, finalScore, tokens) => {
    if (!user) return;
    try {
      await supabase.from('game_sessions').insert({
        user_id: user.id,
        game_type: 'border',
        game_mode: 'classic',
        result,
        score: finalScore,
        opponent_score: 0,
        tokens_earned: tokens,
        telemetry: {
          characters_processed: characterIndex + 1,
          lives_remaining: lives,
        },
      });
    } catch (err) {
      console.error('Failed to save border session:', err);
    }
  };

  // ── Handle Enter key in chat ─────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Render message content with styled physical cues ───────────────
  const renderMessageContent = (text) => {
    // Split by *asterisk cues* and render them as styled body-language hints
    const parts = text.split(/(\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        const cueText = part.slice(1, -1);
        return (
          <span
            key={i}
            className="inline-block italic text-amber-400/90 bg-amber-400/10 px-1.5 py-0.5 rounded-md text-[12px] mx-0.5 border border-amber-400/15"
            title="Physical cue"
          >
            ✦ {cueText}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <>
      <Navbar />
      <div className="pt-[88px] min-h-screen bg-surface grid-bg">
        <style>{`
          @keyframes glitch-avatar {
            0%, 100% { transform: translate(0); }
            20% { transform: translate(-2px, 1px); }
            40% { transform: translate(2px, -1px); }
            60% { transform: translate(-1px, 2px); }
            80% { transform: translate(1px, -2px); }
          }
          .animate-glitch-avatar {
            animation: glitch-avatar 4s ease-in-out infinite;
          }
          @keyframes border-scan {
            0% { top: 0%; opacity: 0.8; }
            100% { top: 100%; opacity: 0; }
          }
          .scan-line-anim {
            animation: border-scan 2s linear infinite;
          }
          @keyframes stamp-in {
            0% { transform: scale(3) rotate(-25deg); opacity: 0; }
            60% { transform: scale(1.05) rotate(-15deg); opacity: 0.9; }
            100% { transform: scale(1) rotate(-12deg); opacity: 1; }
          }
          .animate-stamp {
            animation: stamp-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
        `}</style>

        {/* ─── WELCOME SCREEN ─────────────────────────────────── */}
        {gameState === 'welcome' && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-88px)] px-4 text-center">
            <div className="max-w-lg w-full animate-fade-in">
              <div className="mb-8">
                <span className="text-6xl mb-4 block">🚧</span>
                <h1 className="font-display text-4xl md:text-5xl font-extrabold text-white neon-text-primary mb-3 tracking-tight">
                  NEON CITY BORDER
                </h1>
                <p className="font-body text-sm text-on-surface-variant leading-relaxed max-w-md mx-auto">
                  You are the Border Control Officer of Neon City. Interrogate incoming subjects,
                  analyze their documents, and determine if they should be{' '}
                  <span className="text-neon-green font-semibold">APPROVED</span> or{' '}
                  <span className="text-neon-red font-semibold">DENIED</span> entry.
                </p>
              </div>

              <div className="glass-panel rounded-2xl p-6 mb-6 text-left">
                <h3 className="font-label text-xs text-primary uppercase tracking-wider mb-3 font-bold">Mission Briefing</h3>
                <ul className="space-y-2 font-body text-xs text-on-surface-variant">
                  <li className="flex items-start gap-2">
                    <span className="text-neon-red mt-0.5">❤️</span>
                    <span>You have <strong className="text-white">3 lives</strong>. Admitting a criminal/infected or rejecting an innocent citizen costs 1 life.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-secondary mt-0.5">💬</span>
                    <span>You get <strong className="text-white">5 questions</strong> per character to interrogate them via chat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">🎯</span>
                    <span>Process <strong className="text-white">5 characters</strong> without losing all lives to win.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-tertiary mt-0.5">🔍</span>
                    <span>Look for <strong className="text-white">inconsistencies</strong> in their story, body language cues, and suspicious behavior.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-secondary mt-0.5">🔧</span>
                    <span>Use <strong className="text-white">investigation gadgets</strong> (Lie Detector, Bio-Scanner, DB Query) — limited uses, not 100% accurate!</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={startGame}
                className="w-full py-4 bg-primary text-on-primary font-label text-sm tracking-widest uppercase font-bold rounded-2xl hover:brightness-110 neon-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <span>▶</span> BEGIN SHIFT
              </button>

              <Link
                href="/"
                className="block mt-4 text-center font-label text-xs text-on-surface-variant hover:text-primary tracking-wider uppercase transition-colors"
              >
                ← Return to Arcade
              </Link>
            </div>
          </div>
        )}

        {/* ─── LOADING SCREEN ─────────────────────────────────── */}
        {gameState === 'loading' && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-88px)] px-4 text-center">
            <div className="animate-fade-in flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-2 border-dashed border-primary rounded-full animate-spin" />
              <p className="font-display text-sm text-primary font-bold tracking-widest animate-pulse uppercase">
                Scanning Subject #{characterIndex + 1}...
              </p>
              <p className="font-body text-xs text-on-surface-variant">Neural profile rendering in progress</p>
            </div>
          </div>
        )}

        {/* ─── MAIN GAMEPLAY ──────────────────────────────────── */}
        {(gameState === 'playing' || gameState === 'revealed') && character && (
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-88px)]">
            {/* ── Left Panel: Subject Profile ── */}
            <aside className="lg:col-span-4 border-r border-white/5 bg-surface-container-lowest/80 backdrop-blur-xl p-6 flex flex-col gap-5">
              {/* HUD Bar */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {[...Array(3)].map((_, i) => (
                    <span key={i} className={`text-lg transition-all duration-300 ${i < lives ? 'drop-shadow-[0_0_6px_rgba(255,49,49,0.6)]' : 'opacity-20 grayscale'}`}>
                      {i < lives ? '❤️' : '🖤'}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                    <span className="text-amber-400 text-sm">⬡</span>
                    <span className="font-display text-xs font-bold text-amber-400">{totalTokensEarned}</span>
                    <span className="font-label text-[8px] text-amber-400/70 uppercase">Tkn</span>
                  </div>
                  <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">
                    Subject <span className="text-white font-bold">{characterIndex + (gameState === 'revealed' ? 0 : 1)}</span>/5
                  </span>
                </div>
              </div>

              {/* Holographic Avatar */}
              <div className="relative w-full aspect-square max-w-[220px] mx-auto rounded-2xl overflow-hidden bg-surface-container-lowest/80">
                {/* Reveal stamp overlay */}
                {gameState === 'revealed' && revealResult && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                    <div className={`animate-stamp font-display text-3xl font-black uppercase tracking-wider px-4 py-2 border-4 rounded-lg ${
                      revealResult.correct
                        ? 'text-neon-green border-neon-green bg-neon-green/10'
                        : 'text-neon-red border-neon-red bg-neon-red/10'
                    }`} style={{ transform: 'rotate(-12deg)' }}>
                      {revealResult.correct ? '✓ CORRECT' : '✗ WRONG'}
                    </div>
                  </div>
                )}
                <HolographicAvatar character={character} status={gameState === 'revealed' ? character.hiddenStatus : character.visualStatus} />
              </div>

              {/* Passport / ID Card */}
              <div className="glass-panel rounded-2xl p-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-12 h-12 border-t border-r border-primary/20 rounded-tr-2xl opacity-40" />
                <div className="flex justify-between items-start mb-3">
                  <span className="font-label text-[9px] text-primary uppercase tracking-[0.2em] font-bold">NEON CITY — TRAVEL DOCUMENT</span>
                  <span className="font-label text-[8px] text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded tracking-wider">
                    {character.passportId}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Name</span>
                    <span className="font-display font-bold text-white">{character.firstName} {character.lastName}</span>
                  </div>
                  <div className="h-px bg-white/5" />
                  <div className="flex justify-between text-xs">
                    <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Age</span>
                    <span className="font-body text-white">{character.age}</span>
                  </div>
                  <div className="h-px bg-white/5" />
                  <div className="flex justify-between text-xs">
                    <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Origin</span>
                    <span className="font-body text-white text-right max-w-[55%]">{character.nationality}</span>
                  </div>
                  <div className="h-px bg-white/5" />
                  <div className="flex justify-between text-xs">
                    <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Occupation</span>
                    <span className="font-body text-white text-right max-w-[55%]">{character.occupation}</span>
                  </div>
                  <div className="h-px bg-white/5" />
                  <div className="flex justify-between text-xs">
                    <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Purpose</span>
                    <span className="font-body text-secondary text-right max-w-[55%]">{character.purpose}</span>
                  </div>
                </div>

                {/* Reveal true status */}
                {gameState === 'revealed' && revealResult && (
                  <div className={`mt-3 pt-3 border-t ${
                    revealResult.trueStatus === 'CLEAN' ? 'border-neon-green/30' : 'border-neon-red/30'
                  }`}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-label text-[10px] uppercase tracking-wider font-bold" style={{
                        color: revealResult.trueStatus === 'CLEAN' ? '#39ff14' : revealResult.trueStatus === 'CRIMINAL' ? '#ff3131' : '#f5a623'
                      }}>
                        True Status: {revealResult.trueStatus}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Investigation Gadgets Panel ── */}
              {gameState === 'playing' && (
                <div className="glass-panel-cyan rounded-2xl p-4 relative overflow-hidden">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-label text-[9px] text-secondary uppercase tracking-[0.2em] font-bold">🔧 Investigation Gadgets</span>
                    <span className="font-label text-[8px] text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded tracking-wider">
                      {gadgetUses.lieDetector + gadgetUses.bioScanner + gadgetUses.dbQuery} uses left
                    </span>
                  </div>

                  <div className="flex gap-2 mb-3">
                    {/* Lie Detector */}
                    <button
                      onClick={useLieDetector}
                      disabled={gadgetUses.lieDetector <= 0 || isScanning}
                      className={`flex-1 py-2 px-2 rounded-lg border text-center transition-all ${gadgetUses.lieDetector > 0 && !isScanning ? 'border-tertiary/30 bg-tertiary/10 hover:bg-tertiary/20 hover:scale-[1.03] active:scale-[0.97] cursor-pointer' : 'border-white/5 bg-white/5 opacity-30 cursor-not-allowed'}`}
                    >
                      <span className="text-base block mb-0.5">💓</span>
                      <span className="font-label text-[8px] text-on-surface-variant uppercase tracking-wider block">Lie Detect</span>
                      <span className="font-display text-[9px] text-tertiary font-bold">×{gadgetUses.lieDetector}</span>
                    </button>

                    {/* Bio-Scanner */}
                    <button
                      onClick={useBioScanner}
                      disabled={gadgetUses.bioScanner <= 0 || isScanning}
                      className={`flex-1 py-2 px-2 rounded-lg border text-center transition-all ${gadgetUses.bioScanner > 0 && !isScanning ? 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 hover:scale-[1.03] active:scale-[0.97] cursor-pointer' : 'border-white/5 bg-white/5 opacity-30 cursor-not-allowed'}`}
                    >
                      <span className="text-base block mb-0.5">🔬</span>
                      <span className="font-label text-[8px] text-on-surface-variant uppercase tracking-wider block">Bio-Scan</span>
                      <span className="font-display text-[9px] text-amber-400 font-bold">×{gadgetUses.bioScanner}</span>
                    </button>

                    {/* Database Query */}
                    <button
                      onClick={useDbQuery}
                      disabled={gadgetUses.dbQuery <= 0 || isScanning}
                      className={`flex-1 py-2 px-2 rounded-lg border text-center transition-all ${gadgetUses.dbQuery > 0 && !isScanning ? 'border-primary/30 bg-primary/10 hover:bg-primary/20 hover:scale-[1.03] active:scale-[0.97] cursor-pointer' : 'border-white/5 bg-white/5 opacity-30 cursor-not-allowed'}`}
                    >
                      <span className="text-base block mb-0.5">🗄️</span>
                      <span className="font-label text-[8px] text-on-surface-variant uppercase tracking-wider block">DB Query</span>
                      <span className="font-display text-[9px] text-primary font-bold">×{gadgetUses.dbQuery}</span>
                    </button>
                  </div>

                  {/* Scanning Animation */}
                  {isScanning && (
                    <div className="flex items-center justify-center gap-2 py-3 bg-surface-container/50 rounded-lg border border-white/5 animate-pulse">
                      <div className="w-4 h-4 border-2 border-dashed border-secondary rounded-full animate-spin" />
                      <span className="font-label text-[9px] text-secondary uppercase tracking-widest">Scanning...</span>
                    </div>
                  )}

                  {/* Gadget Result Display */}
                  {!isScanning && gadgetResult && (
                    <div className="py-3 px-3 bg-surface-container/50 rounded-lg border animate-fade-in" style={{ borderColor: `${gadgetResult.color}40` }}>
                      {gadgetResult.type === 'lie_detector' && (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-label text-[8px] text-on-surface-variant uppercase tracking-wider">Heart Rate Monitor</p>
                            <p className="font-display text-lg font-bold" style={{ color: gadgetResult.color }}>
                              {gadgetResult.bpm} <span className="text-[10px] font-label">BPM</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-label text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded" style={{
                              color: gadgetResult.color,
                              background: `${gadgetResult.color}15`,
                              border: `1px solid ${gadgetResult.color}30`,
                            }}>
                              {gadgetResult.level}
                            </span>
                          </div>
                        </div>
                      )}

                      {gadgetResult.type === 'bio_scanner' && (
                        <div>
                          <p className="font-label text-[8px] text-on-surface-variant uppercase tracking-wider mb-1">Bio-Scan Report</p>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-body text-[10px] text-on-surface-variant">Body Temp</span>
                            <span className="font-display text-xs font-bold" style={{ color: gadgetResult.color }}>{gadgetResult.temp}°C</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-body text-[10px] text-on-surface-variant">Nano-Contamination</span>
                            <span className="font-display text-xs font-bold" style={{ color: gadgetResult.color }}>{gadgetResult.contamination}%</span>
                          </div>
                          <div className="mt-1.5 text-right">
                            <span className="font-label text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded" style={{
                              color: gadgetResult.color,
                              background: `${gadgetResult.color}15`,
                              border: `1px solid ${gadgetResult.color}30`,
                            }}>
                              {gadgetResult.level}
                            </span>
                          </div>
                        </div>
                      )}

                      {gadgetResult.type === 'db_query' && (
                        <div>
                          <p className="font-label text-[8px] text-on-surface-variant uppercase tracking-wider mb-1">Database Cross-Reference</p>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-body text-[10px] text-on-surface-variant">ID Match Rate</span>
                            <span className="font-display text-xs font-bold" style={{ color: gadgetResult.color }}>{gadgetResult.matchRate}%</span>
                          </div>
                          {gadgetResult.flags !== 'NONE' && (
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-body text-[10px] text-on-surface-variant">Flag</span>
                              <span className="font-label text-[9px] text-neon-red font-bold">{gadgetResult.flags}</span>
                            </div>
                          )}
                          <div className="mt-1.5 text-right">
                            <span className="font-label text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded" style={{
                              color: gadgetResult.color,
                              background: `${gadgetResult.color}15`,
                              border: `1px solid ${gadgetResult.color}30`,
                            }}>
                              {gadgetResult.level}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Bribe Alert Panel ── */}
              {gameState === 'playing' && bribeState === 'offered' && character?.hasBribe && (
                <div className="rounded-2xl p-4 relative overflow-hidden animate-fade-in border border-amber-500/40 bg-amber-500/5">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse" />
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💰</span>
                    <div className="flex-1">
                      <p className="font-label text-[9px] text-amber-400 uppercase tracking-[0.2em] font-bold mb-1">⚠ Bribe Detected</p>
                      <p className="font-body text-xs text-on-surface-variant leading-relaxed">
                        Subject is offering <span className="text-amber-400 font-bold">{character.bribeAmount} Arcade Tokens</span> to bypass inspection.
                        Accepting will auto-approve their entry.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => {
                            setBribeState('accepted');
                            setTotalTokensEarned(prev => prev + character.bribeAmount);
                            setChatHistory(prev => [...prev, {
                              role: 'system',
                              content: `💰 Bribe accepted: +${character.bribeAmount} tokens. Subject auto-approved.`,
                            }]);
                            // Auto-approve — risky because they're always criminals!
                            setTimeout(() => makeDecision('approve'), 500);
                          }}
                          className="flex-1 py-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 font-label text-[10px] tracking-wider uppercase font-bold rounded-lg hover:bg-amber-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                          💰 Accept ({character.bribeAmount} Tkn)
                        </button>
                        <button
                          onClick={() => {
                            setBribeState('rejected');
                            setChatHistory(prev => [...prev, {
                              role: 'system',
                              content: '🚫 Bribe rejected. Interrogation continues.',
                            }]);
                          }}
                          className="flex-1 py-2 bg-surface-container/60 border border-white/10 text-on-surface-variant font-label text-[10px] tracking-wider uppercase font-bold rounded-lg hover:bg-white/5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                          🚫 Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Decision Buttons */}
              {gameState === 'playing' && (
                <div className="flex gap-3 mt-auto">
                  <button
                    onClick={() => makeDecision('approve')}
                    className="flex-1 py-3 bg-neon-green/15 border border-neon-green/40 text-neon-green font-label text-xs tracking-wider uppercase font-bold rounded-xl hover:bg-neon-green/25 transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_20px_rgba(57,255,20,0.2)]"
                  >
                    ✅ APPROVE
                  </button>
                  <button
                    onClick={() => makeDecision('deny')}
                    className="flex-1 py-3 bg-neon-red/15 border border-neon-red/40 text-neon-red font-label text-xs tracking-wider uppercase font-bold rounded-xl hover:bg-neon-red/25 transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_20px_rgba(255,49,49,0.2)]"
                  >
                    🛑 DENY
                  </button>
                </div>
              )}

              {/* Continue button after reveal */}
              {gameState === 'revealed' && lives > 0 && characterIndex < 5 && (
                <button
                  onClick={continueToNext}
                  className="w-full py-3 bg-secondary/20 border border-secondary/40 text-secondary font-label text-xs tracking-wider uppercase font-bold rounded-xl hover:bg-secondary/30 transition-all hover:scale-[1.02] active:scale-[0.98] mt-auto"
                >
                  NEXT SUBJECT →
                </button>
              )}
            </aside>

            {/* ── Right Panel: Chat Terminal ── */}
            <main className="lg:col-span-8 flex flex-col min-h-[calc(100vh-88px)] relative">
              {/* Terminal Header */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-surface-container-lowest/60 backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-neon-red/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-neon-green/70" />
                  </div>
                  <span className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase">
                    BORDER_TERMINAL v3.7 — Interrogation Channel
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${questionsLeft > 0 ? 'bg-neon-green animate-pulse' : 'bg-neon-red'}`} />
                  <span className="font-label text-[10px] text-on-surface-variant tracking-wider">
                    {questionsLeft} question{questionsLeft !== 1 ? 's' : ''} left
                  </span>
                </div>
              </div>

              {/* Chat Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chatHistory.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'officer' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                  >
                    {msg.role === 'system' ? (
                      <div className="w-full text-center">
                        <span className="font-label text-[9px] text-primary/60 uppercase tracking-[0.2em] bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
                          {msg.content}
                        </span>
                      </div>
                    ) : (
                      <div className={`max-w-[75%] ${msg.role === 'officer' ? 'order-1' : 'order-1'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`font-label text-[9px] uppercase tracking-wider font-bold ${
                            msg.role === 'officer' ? 'text-secondary' : 'text-tertiary'
                          }`}>
                            {msg.role === 'officer' ? '🛡 Officer' : `👤 ${character?.firstName || 'Subject'}`}
                          </span>
                        </div>
                        <div className={`px-4 py-3 rounded-2xl text-sm font-body leading-relaxed ${
                          msg.role === 'officer'
                            ? 'bg-secondary/15 border border-secondary/20 text-white rounded-br-sm'
                            : 'bg-surface-container-high/60 border border-white/5 text-on-surface rounded-bl-sm'
                        }`}>
                          {msg.role === 'character' ? renderMessageContent(msg.content) : msg.content}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* AI typing indicator */}
                {isAiTyping && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="bg-surface-container-high/60 border border-white/5 px-4 py-3 rounded-2xl rounded-bl-sm">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-tertiary animate-bounce" />
                        <span className="w-2 h-2 rounded-full bg-tertiary animate-bounce [animation-delay:0.15s]" />
                        <span className="w-2 h-2 rounded-full bg-tertiary animate-bounce [animation-delay:0.3s]" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="px-6 py-4 border-t border-white/5 bg-surface-container-lowest/60 backdrop-blur">
                {gameState === 'playing' && questionsLeft > 0 ? (
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Interrogate the subject..."
                      disabled={isAiTyping}
                      className="flex-1 bg-surface-container/80 border border-white/10 rounded-xl px-4 py-3 font-body text-sm text-white placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-50"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={isAiTyping || !inputValue.trim()}
                      className="px-5 py-3 bg-primary text-on-primary font-label text-xs tracking-wider uppercase font-bold rounded-xl hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                    >
                      SEND
                    </button>
                  </div>
                ) : gameState === 'playing' && questionsLeft === 0 ? (
                  <div className="text-center py-2">
                    <p className="font-label text-xs text-amber-400 uppercase tracking-wider animate-pulse">
                      ⚠ Question limit reached — Make your decision now, Officer.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider">
                      Interrogation channel closed
                    </p>
                  </div>
                )}
              </div>
            </main>
          </div>
        )}

        {/* ─── GAME OVER SCREEN ───────────────────────────────── */}
        {gameState === 'game-over' && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-88px)] px-4 text-center">
            <div className="max-w-md w-full animate-fade-in">
              <span className="text-6xl mb-4 block">💀</span>
              <h1 className="font-display text-4xl font-extrabold text-neon-red mb-2 tracking-tight">
                SHIFT TERMINATED
              </h1>
              <p className="font-body text-sm text-on-surface-variant mb-6">
                Too many critical errors. The city council has revoked your clearance.
              </p>

              <div className="glass-panel rounded-2xl p-6 mb-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider">Processed</p>
                    <p className="font-display text-2xl font-bold text-white">{characterIndex}</p>
                  </div>
                  <div>
                    <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider">Correct</p>
                    <p className="font-display text-2xl font-bold text-neon-green">{score}</p>
                  </div>
                  <div>
                    <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider">Tokens</p>
                    <p className="font-display text-2xl font-bold text-secondary">{totalTokensEarned}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={startGame}
                className="w-full py-4 bg-neon-red/20 border border-neon-red/40 text-neon-red font-label text-xs tracking-widest uppercase font-bold rounded-2xl hover:bg-neon-red/30 transition-all hover:scale-[1.02] active:scale-[0.98] mb-3"
              >
                ↺ RESTART SHIFT
              </button>
              <Link
                href="/"
                className="block text-center font-label text-xs text-on-surface-variant hover:text-primary tracking-wider uppercase transition-colors"
              >
                ← Return to Arcade
              </Link>
            </div>
          </div>
        )}

        {/* ─── VICTORY SCREEN ─────────────────────────────────── */}
        {gameState === 'victory' && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-88px)] px-4 text-center">
            <div className="max-w-md w-full animate-fade-in">
              <span className="text-6xl mb-4 block animate-bounce">🏆</span>
              <h1 className="font-display text-4xl font-extrabold text-neon-green neon-text-green mb-2 tracking-tight">
                SHIFT COMPLETE
              </h1>
              <p className="font-body text-sm text-on-surface-variant mb-6">
                Outstanding work, Officer. Neon City is safer thanks to your vigilance.
              </p>

              <div className="glass-panel rounded-2xl p-6 mb-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider">Processed</p>
                    <p className="font-display text-2xl font-bold text-white">5</p>
                  </div>
                  <div>
                    <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider">Correct</p>
                    <p className="font-display text-2xl font-bold text-neon-green">{score}</p>
                  </div>
                  <div>
                    <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider">Tokens</p>
                    <p className="font-display text-2xl font-bold text-secondary">{totalTokensEarned}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Lives Remaining</span>
                    <div className="flex gap-1">
                      {[...Array(3)].map((_, i) => (
                        <span key={i} className={`text-sm ${i < lives ? '' : 'opacity-20 grayscale'}`}>
                          {i < lives ? '❤️' : '🖤'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={startGame}
                className="w-full py-4 bg-neon-green/15 border border-neon-green/40 text-neon-green font-label text-xs tracking-widest uppercase font-bold rounded-2xl hover:bg-neon-green/25 transition-all hover:scale-[1.02] active:scale-[0.98] mb-3"
              >
                ▶ NEW SHIFT
              </button>
              <Link
                href="/"
                className="block text-center font-label text-xs text-on-surface-variant hover:text-primary tracking-wider uppercase transition-colors"
              >
                ← Return to Arcade
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
