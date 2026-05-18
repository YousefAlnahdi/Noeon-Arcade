Product Requirements Document (PRD)
1. Product Overview
Proposed Project Name: AI Retro Arcade Platform

Product Type: Web-based Gaming Platform

Primary Objective: Develop a classic gaming website (Tic-Tac-Toe and Snake) integrated with AI Agents to provide an interactive, adaptive, and educational gaming experience for users.

Target Audience: Fans of casual and classic games, and users interested in interacting with AI technologies.

2. Tech Stack Requirements
To facilitate the entire development process via AI, it is highly recommended to rely on a modern and clean tech stack:

Frontend: React.js or Vue.js with Tailwind CSS to ensure a fast and fully responsive interface across all screen sizes.

Game Logic: HTML5 Canvas or lightweight JavaScript libraries to manage the Snake game mechanics and the Tic-Tac-Toe board.

AI Agent Architecture: Integration via API (e.g., OpenAI API or Google Gemini API) for text processing and persona analysis, combined with local deterministic algorithms (e.g., Minimax for Tic-Tac-Toe and A* Pathfinding for the AI Snake) to minimize API costs and token consumption.

3. System Architecture
The platform consists of 3 main sections:

Dashboard (Home Page): Allows the user to select the desired game (Tic-Tac-Toe or Snake).

Tic-Tac-Toe Game Screen: Contains the game board and a menu to select the AI Agent mode.

Snake Game Screen: Contains the play area (Canvas) and a menu to select the AI Agent mode.

4. Functional Specifications & AI Agent Features
First: Tic-Tac-Toe (XO)
The game includes the traditional mode (local PvP), in addition to two advanced modes driven by AI Agents:

Feature 4.1: The Persona Opponent Mode
Description: The user plays against an AI Agent that adopts a specific persona (e.g., the provoker, the cheerleader, the joker).

Mechanism:

The Agent relies on the Minimax algorithm to ensure optimal and smart gameplay.

The Agent is connected to an LLM to generate interactive text messages displayed in a chat bubble above the board, reacting to the game's progress (e.g., when the Agent is close to winning, when the user makes a smart move, or when the user loses).

Feature 4.2: Strategy Coach Agent Mode
Description: The user plays against a standard computer opponent, while an AI Agent acts as an in-corner technical assistant for the user.

Mechanism:

The Agent analyzes the Board State in real-time after every move made by the opponent.

The Agent provides an optional Hint to the user, explaining the best next move and the strategic reasoning behind it (e.g., "We recommend playing in the center square to block the opponent's potential winning line").

Second: Snake Game
The game includes the classic mode, alongside two interactive modes supported by the AI Agent:

Feature 4.3: Dynamic Game Master Mode
Description: The Agent acts as a "Director," monitoring the player's performance and dynamically altering the game environment.

Mechanism:

If the player's score increases rapidly, the Agent generates sudden obstacles on the map or automatically increases the snake's speed to heighten the challenge.

If the player repeatedly loses early in the game, the Agent decreases the speed and spawns helper fruits that grant a temporary "Shield" against collisions.

Feature 4.4: The Rival Snake Agent Mode
Description: A Player vs. Environment (PvE) mode occurring on the same screen.

Mechanism:

The AI Agent controls a second snake (distinguished by a different color) navigating the same play area.

The Agent utilizes a pathfinding algorithm (such as A* Search) to hunt for fruits and compete with the player, while actively avoiding collisions with the human player's snake and the boundaries.

Third: Post-Game Analytics
Feature 4.5: Performance Analyst Agent
Description: Upon the conclusion of any game (Tic-Tac-Toe or Snake), the Agent delivers an analytical report detailing the player's persona and playstyle.

Mechanism:

The system collects telemetry and game data (e.g., in Tic-Tac-Toe: speed of play, tendency toward offense or defense. In Snake: fruit score, maneuvering patterns, and cause of death).

This data is passed as a prompt to the LLM to generate a smart, lighthearted, and personalized report evaluating the player's style (e.g., "You are a highly aggressive and risk-taking player in Tic-Tac-Toe, but you prioritize absolute safety and move cautiously in Snake").

5. Non-Functional Requirements
Performance: The AI Agent's response time for chat generation or analysis must not exceed two seconds (2s) to maintain seamless gameplay.

UX/UI: The user interface should be visually comfortable, incorporating simple visual cues and animations when AI messages are triggered.

Cost Optimization: Prompts sent to the LLM must be engineered to be concise and direct to minimize token consumption and reduce operational costs.

6. Acceptance Criteria
The user can smoothly navigate between the two games from the main dashboard.

The game logic for both Tic-Tac-Toe and Snake functions flawlessly without any bugs.

The AI Agent's text responses appear synchronized with the gameplay moves in Tic-Tac-Toe.

The Snake game's difficulty dynamically adjusts and accurately reflects the player's actual skill level.

The Performance Analyst report is generated and displayed correctly immediately after a game concludes.