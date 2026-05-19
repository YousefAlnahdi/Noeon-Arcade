import { create } from 'zustand';

export const WINNING_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

export const checkWin = (board) => {
    for (const [a, b, c] of WINNING_COMBINATIONS) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], line: [a, b, c] };
        }
    }
    if (!board.includes(null)) return { winner: 'draw', line: [] };
    return null;
};

// Deterministic Minimax algorithm for perfect AI play
export const getBestMove = (board, player, makeDumb = false) => {
    const opponent = player === 'X' ? 'O' : 'X';

    // 40% chance to make a random move to keep AI competitive but beatable
    if (makeDumb && Math.random() < 0.40) {
        const availableMoves = [];
        for (let i = 0; i < 9; i++) {
            if (!board[i]) availableMoves.push(i);
        }
        if (availableMoves.length > 0) {
            return availableMoves[Math.floor(Math.random() * availableMoves.length)];
        }
    }

    const minimax = (newBoard, depth, isMaximizing) => {
        const gameState = checkWin(newBoard);
        if (gameState) {
            if (gameState.winner === player) return 10 - depth;
            if (gameState.winner === opponent) return depth - 10;
            return 0;
        }

        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (!newBoard[i]) {
                    newBoard[i] = player;
                    const score = minimax(newBoard, depth + 1, false);
                    newBoard[i] = null;
                    bestScore = Math.max(score, bestScore);
                }
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let i = 0; i < 9; i++) {
                if (!newBoard[i]) {
                    newBoard[i] = opponent;
                    const score = minimax(newBoard, depth + 1, true);
                    newBoard[i] = null;
                    bestScore = Math.min(score, bestScore);
                }
            }
            return bestScore;
        }
    };

    let bestScore = -Infinity;
    let move = -1;

    for (let i = 0; i < 9; i++) {
        if (!board[i]) {
            board[i] = player;
            const score = minimax(board, 0, false);
            board[i] = null;
            if (score > bestScore) {
                bestScore = score;
                move = i;
            }
        }
    }
    return move;
};

export const useTicTacToeStore = create((set, get) => ({
    board: Array(9).fill(null),
    isPlayerTurn: true, // Player is always X and goes first
    winner: null,
    winningLine: [],
    playerSymbol: 'X',
    aiSymbol: 'O',
    mode: 'persona', // 'pvp' | 'persona' | 'coach'
    aiPersona: 'provoker',
    playerWins: 0,
    aiWins: 0,

    setMode: (mode) => set({ mode, playerWins: 0, aiWins: 0 }),
    setPersona: (persona) => set({ aiPersona: persona }),

    makeMove: (index) => {
        const { board, isPlayerTurn, winner, mode } = get();

        // Ignore if cell is taken or game is over
        if (board[index] || winner) return;

        if (mode === 'pvp') {
            const currentPlayerSymbol = isPlayerTurn ? 'X' : 'O';
            const newBoard = [...board];
            newBoard[index] = currentPlayerSymbol;

            const gameResult = checkWin(newBoard);
            const newWinner = gameResult?.winner || null;
            let newPlayerWins = get().playerWins;
            let newAiWins = get().aiWins;

            if (newWinner === 'X') {
                newPlayerWins += 1;
            } else if (newWinner === 'O') {
                newAiWins += 1;
            }

            set({
                board: newBoard,
                isPlayerTurn: !isPlayerTurn,
                winner: newWinner,
                winningLine: gameResult?.line || [],
                playerWins: newPlayerWins,
                aiWins: newAiWins
            });
        } else {
            // AI Mode handling
            if (!isPlayerTurn) return; // Ignore if not player's turn

            const newBoard = [...board];
            newBoard[index] = get().playerSymbol;

            const p1Result = checkWin(newBoard);

            if (p1Result) {
                const newWinner = p1Result.winner;
                let newPlayerWins = get().playerWins;
                if (newWinner === get().playerSymbol) {
                    newPlayerWins += 1;
                }
                set({
                    board: newBoard,
                    winner: newWinner,
                    winningLine: p1Result.line,
                    playerWins: newPlayerWins
                });
                return;
            }

            set({ board: newBoard, isPlayerTurn: false });

            // Trigger AI Move
            setTimeout(() => {
                const currentBoard = get().board;
                const aiMove = getBestMove([...currentBoard], get().aiSymbol, true);

                if (aiMove !== -1) {
                    const aiBoard = [...currentBoard];
                    aiBoard[aiMove] = get().aiSymbol;

                    const aiResult = checkWin(aiBoard);
                    const newWinner = aiResult?.winner || null;
                    let newAiWins = get().aiWins;

                    if (newWinner === get().aiSymbol) {
                        newAiWins += 1;
                    }

                    set({
                        board: aiBoard,
                        isPlayerTurn: true,
                        winner: newWinner,
                        winningLine: aiResult?.line || [],
                        aiWins: newAiWins
                    });
                }
            }, 500); // Small delay to represent AI "thinking" and to allow UI to render player's text
        }
    },

    resetGame: () => set({
        board: Array(9).fill(null),
        isPlayerTurn: true,
        winner: null,
        winningLine: []
    })
}));
