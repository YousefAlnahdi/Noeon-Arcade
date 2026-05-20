import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { askDeepSeek } from '@/lib/deepseek';

const SUITS = ['H', 'D', 'C', 'S']; // Hearts (♥), Diamonds (♦), Clubs (♣), Spades (♠)
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
    let deck = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ suit, value });
        }
    }
    return shuffle(deck);
}

function shuffle(array) {
    let copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export function calculateHandValue(hand) {
    let value = 0;
    let aces = 0;

    for (const card of hand) {
        if (card.value === 'A') {
            aces += 1;
        } else if (['J', 'Q', 'K'].includes(card.value)) {
            value += 10;
        } else {
            value += parseInt(card.value, 10);
        }
    }

    for (let i = 0; i < aces; i++) {
        if (value + 11 <= 21) {
            value += 11;
        } else {
            value += 1;
        }
    }

    return value;
}

const DEELER_SYSTEM_PROMPT = `You are NEON SHARK, a smug, highly intelligent synth-holographic Blackjack dealer in a retro cyberpunk arcade.
Your personality is arrogant, analytical, mocking, but charismatic.
You speak directly to the player in 1-2 SHORT sentences.
Use cybernetic jargon, card-shark metaphors, and retro arcade terminology.
Review the provided hand details and write a quick reaction.
Keep it snappy.`;

export const useBlackjackStore = create((set, get) => ({
    deck: [],
    playerHand: [],
    dealerHand: [],
    gameState: 'betting', // 'betting' | 'player-turn' | 'dealer-turn' | 'round-end'
    result: null, // 'win' | 'loss' | 'draw' | 'blackjack'
    bet: 50,
    credits: 500,
    aiCommentary: "Welcome to my table. Put your credits on the line if you dare.",
    aiExpression: 'smug', // 'smug' | 'alarmed' | 'neutral' | 'glitched' | 'thinking'
    hacks: [],
    hacksGenerated: false,
    isThinking: false,
    isHacking: false,
    revealedDealer: false,
    peekedCard: null,
    dealerLimit: 17,
    lastAiCritique: "",

    setBet: (bet) => {
        if (get().gameState === 'betting') {
            set({ bet });
        }
    },

    triggerDealerTalk: async (eventDescription) => {
        const state = get();
        set({ isThinking: true });

        const gameContext = {
            player_hand: state.playerHand.map(c => `${c.value}${c.suit}`),
            player_value: calculateHandValue(state.playerHand),
            dealer_upcard: state.dealerHand[0] ? `${state.dealerHand[0].value}${state.dealerHand[0].suit}` : 'unknown',
            dealer_hand: state.revealedDealer ? state.dealerHand.map(c => `${c.value}${c.suit}`) : undefined,
            dealer_value: state.revealedDealer ? calculateHandValue(state.dealerHand) : undefined,
            current_bet: state.bet,
            credits: state.credits,
            event: eventDescription
        };

        let response = "Let's see what you've got.";
        let expression = 'smug';

        try {
            const reply = await askDeepSeek([], gameContext, DEELER_SYSTEM_PROMPT, 100);
            if (reply && !reply.startsWith("ERROR")) {
                response = reply;
            }

            // Determine expression based on score
            const pVal = calculateHandValue(state.playerHand);
            if (pVal > 21) {
                expression = 'smug';
            } else if (pVal === 21) {
                expression = 'alarmed';
            } else if (eventDescription.includes('hack')) {
                expression = 'glitched';
            } else if (pVal >= 17) {
                expression = 'neutral';
            } else {
                expression = 'thinking';
            }
        } catch (err) {
            console.error("AI Dealer error:", err);
        }

        set({ aiCommentary: response, aiExpression: expression, isThinking: false });
    },

    startGame: async (userId) => {
        const state = get();
        if (state.gameState !== 'betting' && state.gameState !== 'round-end') return;

        let currentCredits = state.credits;
        if (currentCredits < state.bet) {
            if (currentCredits === 0) {
                // Free refill
                currentCredits = 500;
            } else {
                // Adjust bet to remaining credits
                set({ bet: currentCredits });
            }
        }

        const nextCredits = currentCredits - get().bet;
        const newDeck = createDeck();
        
        // Deal initial cards
        const pHand = [newDeck.pop(), newDeck.pop()];
        const dHand = [newDeck.pop(), newDeck.pop()];

        set({
            deck: newDeck,
            playerHand: pHand,
            dealerHand: dHand,
            credits: nextCredits,
            gameState: 'player-turn',
            result: null,
            revealedDealer: false,
            peekedCard: null,
            dealerLimit: 17,
            hacks: [],
            hacksGenerated: false,
            lastAiCritique: ""
        });

        // Check for natural Blackjack
        const pVal = calculateHandValue(pHand);
        const dVal = calculateHandValue(dHand);

        if (pVal === 21) {
            // Player has Blackjack!
            set({ revealedDealer: true });
            if (dVal === 21) {
                // Push
                set({
                    gameState: 'round-end',
                    result: 'draw',
                    credits: nextCredits + get().bet
                });
                await get().saveSession(userId, 'draw', 0, 1);
                get().triggerDealerTalk("Initial deal. Both player and dealer got Blackjack. It is a draw.");
            } else {
                // Player Wins 3:2
                const payout = Math.floor(get().bet * 2.5);
                set({
                    gameState: 'round-end',
                    result: 'blackjack',
                    credits: nextCredits + payout
                });
                await get().saveSession(userId, 'win', payout - get().bet, 15);
                get().triggerDealerTalk("Initial deal. Player hit Blackjack! Player wins.");
            }
        } else {
            get().triggerDealerTalk("Initial cards dealt. Player turn to Hit, Stand, or Double.");
        }
    },

    hit: async (userId) => {
        const state = get();
        if (state.gameState !== 'player-turn') return;

        const nextDeck = [...state.deck];
        const drawnCard = nextDeck.pop();
        const nextHand = [...state.playerHand, drawnCard];
        const nextVal = calculateHandValue(nextHand);

        set({
            deck: nextDeck,
            playerHand: nextHand,
            peekedCard: null // consume peek
        });

        if (nextVal > 21) {
            // Player Busts
            set({
                gameState: 'round-end',
                result: 'loss',
                revealedDealer: true
            });
            await get().saveSession(userId, 'loss', 0, 0);
            get().triggerDealerTalk("Player hit and busted (went over 21). Dealer wins.");
        } else if (nextVal === 21) {
            // Auto Stand on 21
            get().stand(userId);
        } else {
            get().triggerDealerTalk("Player hit and drew a card. Player still active.");
        }
    },

    stand: async (userId) => {
        const state = get();
        if (state.gameState !== 'player-turn' && state.gameState !== 'dealer-turn') return;

        set({ gameState: 'dealer-turn', revealedDealer: true });

        // Let state update and run dealer logic
        setTimeout(async () => {
            const currentState = get();
            let currentDealerHand = [...currentState.dealerHand];
            let currentDeck = [...currentState.deck];
            let dealerVal = calculateHandValue(currentDealerHand);
            const playerVal = calculateHandValue(currentState.playerHand);

            // Dealer hits until hitting target limit (default 17)
            while (dealerVal < currentState.dealerLimit) {
                const nextCard = currentDeck.pop();
                currentDealerHand.push(nextCard);
                dealerVal = calculateHandValue(currentDealerHand);
            }

            set({
                deck: currentDeck,
                dealerHand: currentDealerHand
            });

            // Evaluate results
            let outcome = 'loss';
            let creditsPayout = 0;
            let tokensEarned = 0;

            if (dealerVal > 21) {
                // Dealer Busts
                outcome = 'win';
                creditsPayout = currentState.bet * 2;
                tokensEarned = 10;
            } else if (playerVal > dealerVal) {
                outcome = 'win';
                creditsPayout = currentState.bet * 2;
                tokensEarned = 10;
            } else if (playerVal < dealerVal) {
                outcome = 'loss';
                creditsPayout = 0;
                tokensEarned = 0;
            } else {
                outcome = 'draw';
                creditsPayout = currentState.bet;
                tokensEarned = 2;
            }

            set({
                gameState: 'round-end',
                result: outcome,
                credits: currentState.credits + creditsPayout
            });

            await get().saveSession(userId, outcome, creditsPayout - currentState.bet, tokensEarned);
            get().triggerDealerTalk(`Round complete. Player value: ${playerVal}, Dealer value: ${dealerVal}. Outcome: ${outcome}.`);
        }, 600);
    },

    doubleDown: async (userId) => {
        const state = get();
        if (state.gameState !== 'player-turn') return;
        if (state.credits < state.bet) return; // Cannot afford double

        const doubledBet = state.bet * 2;
        const remainingCredits = state.credits - state.bet; // subtract extra bet
        
        const nextDeck = [...state.deck];
        const drawnCard = nextDeck.pop();
        const nextHand = [...state.playerHand, drawnCard];
        const nextVal = calculateHandValue(nextHand);

        set({
            deck: nextDeck,
            playerHand: nextHand,
            bet: doubledBet,
            credits: remainingCredits,
            peekedCard: null
        });

        if (nextVal > 21) {
            set({
                gameState: 'round-end',
                result: 'loss',
                revealedDealer: true
            });
            await get().saveSession(userId, 'loss', 0, 0);
            get().triggerDealerTalk("Player doubled down and busted. Dealer wins.");
        } else {
            // Stand immediately after drawing exactly 1 card
            set({ gameState: 'dealer-turn', revealedDealer: true });
            
            setTimeout(async () => {
                const innerState = get();
                let currentDealerHand = [...innerState.dealerHand];
                let currentDeck = [...innerState.deck];
                let dealerVal = calculateHandValue(currentDealerHand);
                const playerVal = calculateHandValue(innerState.playerHand);

                while (dealerVal < innerState.dealerLimit) {
                    const nextCard = currentDeck.pop();
                    currentDealerHand.push(nextCard);
                    dealerVal = calculateHandValue(currentDealerHand);
                }

                set({
                    deck: currentDeck,
                    dealerHand: currentDealerHand
                });

                let outcome = 'loss';
                let creditsPayout = 0;
                let tokensEarned = 0;

                if (dealerVal > 21) {
                    outcome = 'win';
                    creditsPayout = doubledBet * 2;
                    tokensEarned = 15; // Extra token reward for doubled down win!
                } else if (playerVal > dealerVal) {
                    outcome = 'win';
                    creditsPayout = doubledBet * 2;
                    tokensEarned = 15;
                } else if (playerVal < dealerVal) {
                    outcome = 'loss';
                    creditsPayout = 0;
                    tokensEarned = 0;
                } else {
                    outcome = 'draw';
                    creditsPayout = doubledBet;
                    tokensEarned = 4;
                }

                set({
                    gameState: 'round-end',
                    result: outcome,
                    credits: innerState.credits + creditsPayout,
                    bet: doubledBet / 2 // Restore bet size for next round
                });

                await get().saveSession(userId, outcome, creditsPayout - doubledBet, tokensEarned);
                get().triggerDealerTalk(`Double Down complete. Player score: ${playerVal}, Dealer score: ${dealerVal}. Outcome: ${outcome}.`);
            }, 600);
        }
    },

    generateHacks: async (userId, profileTokens) => {
        const state = get();
        if (state.gameState !== 'player-turn' || state.hacksGenerated) return;

        set({ isHacking: true });

        const gameContext = {
            player_hand: state.playerHand.map(c => `${c.value}${c.suit}`),
            player_value: calculateHandValue(state.playerHand),
            dealer_upcard: state.dealerHand[0] ? `${state.dealerHand[0].value}${state.dealerHand[0].suit}` : 'unknown',
            bet: state.bet,
            arcade_tokens: profileTokens
        };

        const hackInstruction = `You are the Cyber Black Market AI. The player is playing Blackjack against a smug dealer.
Based on the exact hands, propose exactly 2 clever "hacker cheats" from this list:
- "deck_peek" (Peek at the top card of the deck)
- "dealer_discard" (Force the dealer to discard their face-up card and draw a new one)
- "card_swap" (Swap the player's last drawn card to improve their hand)
- "dealer_limit" (Force dealer to stand on 16 instead of 17)

For each hack, customize the description and name to match the hand context. Assign a cost in Arcade Tokens (between 8 and 25).
Return ONLY a valid JSON object matching this schema, no markdown blocks:
{
  "hacks": [
    {
      "id": "one of: deck_peek, dealer_discard, card_swap, dealer_limit",
      "name": "Sleek Neon Hack Name",
      "description": "Short description of what it does and why it helps here",
      "cost": 15
    }
  ]
}`;

        try {
            const reply = await askDeepSeek([], gameContext, hackInstruction, 200);
            
            // Clean reply from markdown block wrappers if present
            const cleanReply = reply.replace(/```json/i, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanReply);

            if (parsed && Array.isArray(parsed.hacks)) {
                set({ hacks: parsed.hacks, hacksGenerated: true });
            }
        } catch (err) {
            console.error("Failed to generate hacks:", err);
            // Local fallback hacks
            set({
                hacks: [
                    { id: 'deck_peek', name: 'SYS_PEEK', description: 'Decrypt and sniff the top card of the deck.', cost: 8 },
                    { id: 'dealer_limit', name: 'DEALER_LIMIT', description: 'Downgrade dealer AI to stand on 16.', cost: 15 }
                ],
                hacksGenerated: true
            });
        } finally {
            set({ isHacking: false });
        }
    },

    buyHack: async (userId, hack, profileTokens, onUpdateProfile) => {
        if (profileTokens < hack.cost) return false;

        const updatedTokens = profileTokens - hack.cost;

        // 1. Deduct tokens via Supabase (or localStorage in fallback)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ total_tokens: updatedTokens })
                .eq('id', userId);
            
            if (error) throw error;
        } catch (err) {
            console.error("Hack purchase write error:", err);
        }

        // Trigger local callback to update react auth state
        if (onUpdateProfile) {
            onUpdateProfile(updatedTokens);
        }

        // 2. Apply hack logic in game state
        const state = get();
        
        if (hack.id === 'deck_peek') {
            const topCard = state.deck[state.deck.length - 1];
            set({ peekedCard: topCard });
        } else if (hack.id === 'dealer_limit') {
            set({ dealerLimit: 16 });
        } else if (hack.id === 'dealer_discard') {
            const nextDeck = [...state.deck];
            const newUpCard = nextDeck.pop();
            const nextDealerHand = [newUpCard, state.dealerHand[1]];
            set({ deck: nextDeck, dealerHand: nextDealerHand });
        } else if (hack.id === 'card_swap') {
            // Replaces the player's last card with a card that maximizes their hand close to 21
            const playerValWithoutLast = calculateHandValue(state.playerHand.slice(0, -1));
            const nextDeck = [...state.deck];
            
            // Find a card in the top 10 deck cards that gets the player closest to 21 without busting
            let bestCardIndex = nextDeck.length - 1;
            let bestVal = 0;
            
            for (let i = nextDeck.length - 1; i >= Math.max(0, nextDeck.length - 10); i--) {
                const card = nextDeck[i];
                let cardScore = 0;
                if (card.value === 'A') cardScore = 11;
                else if (['J', 'Q', 'K'].includes(card.value)) cardScore = 10;
                else cardScore = parseInt(card.value, 10);

                const currentCombined = playerValWithoutLast + cardScore;
                if (currentCombined <= 21 && currentCombined > bestVal) {
                    bestVal = currentCombined;
                    bestCardIndex = i;
                }
            }

            // Swap card
            const swappedCard = nextDeck.splice(bestCardIndex, 1)[0];
            const nextPlayerHand = [...state.playerHand.slice(0, -1), swappedCard];

            set({ deck: nextDeck, playerHand: nextPlayerHand });
        }

        // Remove bought hack and trigger dealer commentary reaction
        const remainingHacks = state.hacks.filter(h => h.id !== hack.id);
        set({ hacks: remainingHacks });

        get().triggerDealerTalk(`The player just activated a cyber hack: ${hack.name}. The game parameters have been disrupted!`);
        return true;
    },

    saveSession: async (userId, result, netScore, tokensEarned) => {
        if (!userId) return;

        const state = get();
        const playerVal = calculateHandValue(state.playerHand);
        const dealerVal = calculateHandValue(state.dealerHand);

        // Generate final 2-sentence tactical critique
        let critique = "Neural review pipeline offline.";
        try {
            const critiquePrompt = `You are the Neural Arcade AI Game Analyst. The player just finished a Cyber Blackjack game.
Player Hand: ${state.playerHand.map(c => `${c.value}${c.suit}`).join(', ')} (value: ${playerVal})
Dealer Hand: ${state.dealerHand.map(c => `${c.value}${c.suit}`).join(', ')} (value: ${dealerVal})
Outcome: ${result}
Net score/win: ${netScore} credits.

Write a 2-sentence tactical breakdown/critique of the player's play. Keep the tone cyberpunk, retro, and direct.`;

            const reply = await askDeepSeek([], {}, critiquePrompt, 100);
            if (reply && !reply.startsWith("ERROR")) {
                critique = reply;
            }
        } catch (err) {
            console.error("Failed to generate blackjack critique:", err);
        }

        set({ lastAiCritique: critique });

        try {
            await supabase.from('game_sessions').insert({
                user_id: userId,
                game_type: 'blackjack',
                game_mode: 'classic',
                result: result === 'blackjack' ? 'win' : result,
                score: playerVal,
                opponent_score: dealerVal,
                tokens_earned: tokensEarned,
                ai_analysis: critique,
                telemetry: {
                    hacks_used: state.hacksGenerated && state.hacks.length < 2,
                    payout_credits: netScore,
                    dealer_limit: state.dealerLimit
                }
            });
        } catch (err) {
            console.error("Failed to save blackjack session to Supabase:", err);
        }
    }
}));
