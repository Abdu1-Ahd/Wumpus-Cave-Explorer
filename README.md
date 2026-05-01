# Wumpus Cave Explorer 🦇💎

A sophisticated, browser-based AI agent that plays the classic "Wumpus World" logic game. This project features a custom-built Propositional Logic Resolution Engine that enables the agent to safely navigate a treacherous cavern filled with abyssal pits and a terrifying Cave Ghoul, using only its localized percepts to deduce safe paths to the hidden treasure.

![Wumpus Cave Explorer](https://wumpus-explorer.vercel.app/og-image.png) <!-- Placeholder if OG image exists, or simply visual flair -->

## 🌟 Live Demo
Play the deployed version here: **[Wumpus Cave Explorer](https://wumpus-explorer.vercel.app)**

## 🧠 Core Architecture

The system is entirely decoupled into three primary modules:
1. **The Environment (`world.js`)**: Generates a 10x10 grid, ensuring a guaranteed safe start. It manages the ground truth of the board (Pits, Ghoul, Gold) and issues percepts (Breeze, Stench, Glitter) dynamically based on the agent's coordinates.
2. **The Logic Engine (`kb.js`)**: A highly optimized Propositional Knowledge Base. It employs a hybrid resolution algorithm (fast unit propagation paired with bounded disjunctive resolution) to deduce whether an adjacent, unvisited cell is strictly `SAFE` or `DANGEROUS`.
3. **The Agent (`agent.js`)**: Orchestrates the exploration. It utilizes Breadth-First Search (BFS) combined with the Knowledge Base to chart safe frontiers.

## 🎨 Aesthetics & UI

The interface abandons standard sterile grids for an immersive, atmospheric "Cave Explorer" theme:
- Deep, rocky cavern textures using CSS SVG filters.
- Real-time logging of logical inferences and percepts.
- Interactive controls to adjust simulation speed, peek at the ground truth ("Reveal World"), and visualize the agent's internal logic matrix ("Agent Knowledge").

## 🚀 Running Locally

The project uses entirely vanilla web technologies (HTML/CSS/JS) with no external dependencies required for the core logic. 

To run it locally:
1. Clone the repository.
2. Serve the directory using any local web server (e.g., `npx serve`, or Live Server in VS Code).
3. Open `index.html` in your browser.

## 📁 File Structure

- `index.html` - The application entry point and layout.
- `css/index.css` - Custom styling, CSS variables, grid layouts, and thematic cavern animations.
- `js/app.js` - The main controller tying the DOM, World, Agent, and UI together.
- `js/world.js` - The environment state machine.
- `js/kb.js` - The Propositional Logic inference engine.
- `js/agent.js` - The autonomous pathfinding and reasoning entity.
- `js/ui.js` - The rendering engine for grid cells, tooltips, and log messages.

## ⚙️ Development & Optimization Notes
- **Resolution Limit**: The logic engine limits Phase 1 (Disjunctive) resolution to 100 loops to prevent UI blocking during highly ambiguous board states, ensuring the simulation remains performant and responsive.
- **Safe Start**: `world.js` utilizes a specialized generation loop that validates the starting cell `[0,0]` has at least one adjacent safe cell to prevent instant, unavoidable deaths.
