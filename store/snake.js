import { create } from 'zustand';

// Grid size settings
export const GRID_SIZE = 20;
export const CANVAS_SIZE = { width: 800, height: 450 }; // 16:9 ratio approximately
export const COLS = Math.floor(CANVAS_SIZE.width / GRID_SIZE); // 40
export const ROWS = Math.floor(CANVAS_SIZE.height / GRID_SIZE); // 22

const INITIAL_SNAKE = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
];

const INITIAL_DIRECTION = { x: 1, y: 0 };
const SPEEDS = { slow: 150, normal: 100, fast: 60 };

export const useSnakeStore = create((set, get) => ({
    snake: INITIAL_SNAKE,
    direction: INITIAL_DIRECTION,
    food: { x: 20, y: 10 },
    obstacles: [],
    score: 0,
    speedState: 'normal',
    gameState: 'idle', // 'idle' | 'playing' | 'gameover'
    mode: 'classic', // 'classic' | 'gamemaster' | 'rival'
    activePowerups: { shield: false, speed: false },
    foodValue: 10,
    difficulty: 'medium', // 'easy' | 'medium' | 'hard'

    // Rival Snake state
    rivalSnake: [],
    rivalDirection: { x: 0, y: 0 },
    rivalScore: 0,

    setMode: (mode) => {
        const isPlaying = get().gameState === 'playing';
        if (mode === 'rival' && isPlaying) {
            set({
                rivalSnake: [
                    { x: COLS - 5, y: ROWS - 5 },
                    { x: COLS - 4, y: ROWS - 5 },
                    { x: COLS - 3, y: ROWS - 5 }
                ],
                rivalScore: 0,
                mode
            });
        } else if (mode !== 'rival') {
            set({ rivalSnake: [], mode });
        } else {
            set({ mode });
        }
    },

    startGame: () => {
        set({
            snake: INITIAL_SNAKE,
            direction: { x: 0, y: 0 },
            score: 0,
            gameState: 'countdown',
            obstacles: [],
            activePowerups: { shield: false, speed: false },
            speedState: 'normal',
            food: generateFood(INITIAL_SNAKE, []),
            rivalSnake: get().mode === 'rival' ? [
                { x: COLS - 5, y: ROWS - 5 },
                { x: COLS - 4, y: ROWS - 5 },
                { x: COLS - 3, y: ROWS - 5 }
            ] : [],
            rivalScore: 0,
            foodValue: 10,
        });
    },

    changeDirection: (newDir) => {
        const { direction } = get();
        // Prevent 180 degree turns
        if (direction.x !== 0 && newDir.x !== 0) return;
        if (direction.y !== 0 && newDir.y !== 0) return;
        set({ direction: newDir });
    },

    gameTick: () => {
        const state = get();
        if (state.gameState !== 'playing') return;

        // If stationary, do not move or check collisions
        if (state.direction.x === 0 && state.direction.y === 0) return;

        const head = state.snake[0];
        const newHead = {
            x: head.x + state.direction.x,
            y: head.y + state.direction.y
        };

        // 1. Check Wall Collisions
        if (
            newHead.x < 0 ||
            newHead.x >= COLS ||
            newHead.y < 0 ||
            newHead.y >= ROWS
        ) {
            if (state.activePowerups.shield) {
                // Bounce off wall and consume shield
                set({ activePowerups: { ...state.activePowerups, shield: false } });
                // Naive bounce: just reverse direction
                set({ direction: { x: -state.direction.x, y: -state.direction.y } });
                return;
            }
            return set({ gameState: 'gameover' });
        }

        // 2. Check Self Collision
        if (state.snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
            if (state.activePowerups.shield) {
                set({ activePowerups: { ...state.activePowerups, shield: false } });
            } else {
                return set({ gameState: 'gameover' });
            }
        }

        // 3. Check Obstacle Collision
        if (state.obstacles.some(obs => obs.x === newHead.x && obs.y === newHead.y)) {
            if (state.activePowerups.shield) {
                set({
                    activePowerups: { ...state.activePowerups, shield: false },
                    obstacles: state.obstacles.filter(obs => obs.x !== newHead.x || obs.y !== newHead.y)
                });
            } else {
                return set({ gameState: 'gameover' });
            }
        }

        const newSnake = [newHead, ...state.snake];
        let newScore = state.score;
        let newFood = state.food;

        // Pathfinder mode win check
        if (state.mode === 'pathfinder') {
            if (newHead.x === state.food.x && newHead.y === state.food.y) {
                set({
                    snake: newSnake,
                    gameState: 'won'
                });
                return;
            }
            newSnake.pop(); // Keep snake length fixed to navigate roads
        } else {
            // 4. Check Food Collision
            if (newHead.x === state.food.x && newHead.y === state.food.y) {
                newScore += state.foodValue;
                newFood = generateFood(newSnake, state.obstacles, state.rivalSnake);
                set({ foodValue: 10 }); // Reset to default after eating
            } else {
                newSnake.pop(); // Remove tail if no food eaten
            }
        }

        // --- RIVAL SNAKE LOGIC ---
        let newRivalSnake = state.rivalSnake;
        let newRivalScore = state.rivalScore;

        if (state.mode === 'rival' && newRivalSnake.length > 0) {
            const rivalHead = newRivalSnake[0];

            // Compute A* Path to Food
            const path = aStarSearch(
                { x: rivalHead.x, y: rivalHead.y },
                { x: newFood.x, y: newFood.y },
                newSnake, // Avoid player body
                newRivalSnake, // Avoid own body
                state.obstacles
            );

            let nextRivalMove;
            if (path && path.length > 0) {
                nextRivalMove = path[0];
            } else {
                // Fallback: move randomly to a valid adjacent cell if no path exists
                const adjacent = [
                    { x: rivalHead.x + 1, y: rivalHead.y },
                    { x: rivalHead.x - 1, y: rivalHead.y },
                    { x: rivalHead.x, y: rivalHead.y + 1 },
                    { x: rivalHead.x, y: rivalHead.y - 1 }
                ];

                const validMoves = adjacent.filter(m =>
                    m.x >= 0 && m.x < COLS && m.y >= 0 && m.y < ROWS &&
                    !newSnake.some(s => s.x === m.x && s.y === m.y) &&
                    !newRivalSnake.some(s => s.x === m.x && s.y === m.y) &&
                    !state.obstacles.some(o => o.x === m.x && o.y === m.y)
                );

                if (validMoves.length > 0) {
                    nextRivalMove = validMoves[0]; // Take first valid
                } else {
                    nextRivalMove = null; // Rival dies
                }
            }

            if (nextRivalMove) {
                newRivalSnake = [nextRivalMove, ...newRivalSnake];

                if (nextRivalMove.x === newFood.x && nextRivalMove.y === newFood.y) {
                    newRivalScore += 10;
                    newFood = generateFood(newSnake, state.obstacles, newRivalSnake);
                } else {
                    newRivalSnake.pop();
                }
            }

            // Did Player crash into Rival?
            if (newRivalSnake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
                if (state.activePowerups.shield) {
                    set({ activePowerups: { ...state.activePowerups, shield: false } });
                } else {
                    return set({ gameState: 'gameover' });
                }
            }
        }

        // --- GAME MASTER LOGIC ---
        // rule-based obstacle spawning is deactivated in favor of AI Dungeon Master commands

        set({
            snake: newSnake,
            score: newScore,
            food: newFood,
            rivalSnake: newRivalSnake,
            rivalScore: newRivalScore
        });
    },

    // Used by AI Game Master to dynamically add challenges
    spawnObstacle: () => {
        const state = get();
        if (state.gameState !== 'playing') return;

        // Don't clutter too much (max 10)
        if (state.obstacles.length >= 10) return;

        let obs;
        // Attempt to find empty spot
        for (let i = 0; i < 50; i++) {
            obs = {
                x: Math.floor(Math.random() * COLS),
                y: Math.floor(Math.random() * ROWS)
            };
            // Don't spawn on snake, food, or other obstacles
            if (
                !state.snake.some(s => s.x === obs.x && s.y === obs.y) &&
                !(state.food.x === obs.x && state.food.y === obs.y) &&
                !state.obstacles.some(o => o.x === obs.x && o.y === obs.y)
            ) {
                set({ obstacles: [...state.obstacles, obs] });
                break;
            }
        }
    },

    grantShield: () => {
        set(state => ({ activePowerups: { ...state.activePowerups, shield: true } }));
    },

    setDifficulty: (difficulty) => {
        set({ difficulty });
    },

    spawnObstaclesAt: (coords) => {
        const state = get();
        if (state.gameState !== 'playing') return;
        const valid = coords.filter(c =>
            c.x >= 0 && c.x < COLS && c.y >= 0 && c.y < ROWS &&
            !state.snake.some(s => s.x === c.x && s.y === c.y) &&
            !(state.food.x === c.x && state.food.y === c.y) &&
            !state.obstacles.some(o => o.x === c.x && o.y === c.y)
        );
        set({ obstacles: [...state.obstacles, ...valid].slice(-15) });
    },

    setSpeedState: (speedState) => {
        if (['slow', 'normal', 'fast'].includes(speedState)) {
            set({ speedState });
        }
    },

    setFoodPosition: (x, y, val) => {
        if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
            set({ food: { x, y }, foodValue: val || 10 });
        }
    },

    clearObstacles: () => {
        set({ obstacles: [] });
    }
}));

// Helper to spawn food in empty spaces
function generateFood(snake, obstacles, rivalSnake = []) {
    let newFood;
    while (true) {
        newFood = {
            x: Math.floor(Math.random() * COLS),
            y: Math.floor(Math.random() * ROWS)
        };
        const isOnSnake = snake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
        const isOnRival = rivalSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
        const isOnObstacle = obstacles.some(obs => obs.x === newFood.x && obs.y === newFood.y);
        if (!isOnSnake && !isOnObstacle && !isOnRival) break;
    }
    return newFood;
}

// --- A* Pathfinding Implementation for Rival Snake ---
class Node {
    constructor(x, y, parent = null) {
        this.x = x;
        this.y = y;
        this.parent = parent;
        this.g = 0; // Cost from start
        this.h = 0; // Heuristic to end
        this.f = 0; // Total cost
    }
}

// Manhattan distance heuristic
function heuristic(nodeA, nodeB) {
    return Math.abs(nodeA.x - nodeB.x) + Math.abs(nodeA.y - nodeB.y);
}

function aStarSearch(startPos, endPos, playerSnake, rivalSnake, obstacles) {
    const openList = [];
    const closedSet = new Set();

    const startNode = new Node(startPos.x, startPos.y);
    const endNode = new Node(endPos.x, endPos.y);

    openList.push(startNode);

    const invalidSpaces = new Set();
    const addInvalid = (pos) => invalidSpaces.add(`${pos.x},${pos.y}`);

    obstacles.forEach(addInvalid);
    playerSnake.forEach(addInvalid);
    rivalSnake.forEach(addInvalid);

    let maxIterations = 200;
    let iterations = 0;

    while (openList.length > 0 && iterations < maxIterations) {
        iterations++;

        let currentIndex = 0;
        for (let i = 1; i < openList.length; i++) {
            if (openList[i].f < openList[currentIndex].f) {
                currentIndex = i;
            }
        }

        const currentNode = openList[currentIndex];

        if (currentNode.x === endNode.x && currentNode.y === endNode.y) {
            const path = [];
            let current = currentNode;
            while (current.parent) {
                path.unshift({ x: current.x, y: current.y });
                current = current.parent;
            }
            return path;
        }

        openList.splice(currentIndex, 1);
        closedSet.add(`${currentNode.x},${currentNode.y}`);

        const neighbors = [
            { x: currentNode.x + 1, y: currentNode.y },
            { x: currentNode.x - 1, y: currentNode.y },
            { x: currentNode.x, y: currentNode.y + 1 },
            { x: currentNode.x, y: currentNode.y - 1 }
        ];

        for (const neighborPos of neighbors) {
            if (neighborPos.x < 0 || neighborPos.x >= COLS || neighborPos.y < 0 || neighborPos.y >= ROWS) {
                continue;
            }

            const neighborKey = `${neighborPos.x},${neighborPos.y}`;

            if (invalidSpaces.has(neighborKey) && !(neighborPos.x === endNode.x && neighborPos.y === endNode.y)) {
                continue;
            }

            if (closedSet.has(neighborKey)) {
                continue;
            }

            const neighborNode = new Node(neighborPos.x, neighborPos.y, currentNode);
            neighborNode.g = currentNode.g + 1;
            neighborNode.h = heuristic(neighborNode, endNode);
            neighborNode.f = neighborNode.g + neighborNode.h;

            const openNodeIndex = openList.findIndex(n => n.x === neighborNode.x && n.y === neighborNode.y);
            if (openNodeIndex !== -1) {
                if (openList[openNodeIndex].g <= neighborNode.g) continue;
                openList[openNodeIndex] = neighborNode;
            } else {
                openList.push(neighborNode);
            }
        }
    }

    return null;
}
