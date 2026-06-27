<div align="center">

# 🦇 Wumpus Cave Explorer

**A Knowledge-Based AI Agent navigating a treacherous cavern using Propositional Logic Resolution**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-wumpus--explorer.vercel.app-gold?style=for-the-badge&logo=vercel)](https://wumpus-explorer.vercel.app)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla%20ES6-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

</div>

---

## 📖 Overview

**Wumpus Cave Explorer** is a fully browser-based implementation of the classic AI problem — the **Wumpus World**. An autonomous agent is dropped into a grid-based cavern filled with hidden pits, a lurking Cave Ghoul, and somewhere, a glittering treasure.

The agent has **no map**. It can only feel the world around it through localized percepts:
- A **Breeze** warns of a nearby Pit.
- A **Stench** warns of the Cave Ghoul.
- A **Glitter** reveals the treasure underfoot.

Using **Propositional Logic** and a custom-built **Resolution Refutation engine**, the agent builds a knowledge base from these percepts and rigorously deduces which cells are safe before stepping into them — simulating logical reasoning under uncertainty.

> **Assignment Context:** AI2002 — Assignment #6 | Dynamic Wumpus Logic Agent (Web App)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🧠 **Logic Engine** | Custom Propositional Logic KB with unit propagation + bounded resolution refutation |
| 🗺️ **Dynamic Grid** | Configurable N×M grid (up to 10×10) with randomized hazard placement each game |
| ⚡ **Auto-Run Mode** | Fully autonomous agent that reasons, decides, and moves without human input |
| 👁️ **Reveal Truth** | Toggle to expose the hidden ground truth — pit locations, ghoul, and gold |
| 📊 **Live Metrics** | Real-time dashboard displaying Inference Steps, Moves Taken, and KB Clause count |
| 📜 **Reasoning Log** | Timestamped log of every percept received, inference made, and move taken |
| 🎮 **Step Mode** | Manual single-step control for inspecting the agent's decision-making process |
| 🎨 **Cave Theme** | Immersive mossy rock wall background, atmospheric dark palette, and custom icons |
| 🚀 **Zero Dependencies** | Pure Vanilla HTML/CSS/JS — no frameworks, no build tools, runs anywhere |

---

## 🏗️ Architecture

The application is structured as a clean, decoupled pipeline of three logical layers:

```
┌──────────────────────────────────────────────────────────────┐
│                         Browser UI                           │
│  (index.html  ·  css/index.css  ·  js/ui.js  ·  js/app.js) │
└────────────────────────────┬─────────────────────────────────┘
                             │  Events / Render Commands
┌────────────────────────────▼─────────────────────────────────┐
│                      AI Agent Layer                          │
│                       js/agent.js                            │
│  • BFS pathfinding over the safe frontier                    │
│  • Integrates with KB to classify cells before moving        │
└──────────────┬──────────────────────────┬────────────────────┘
               │ TELL / ASK               │ getPercepts / moveAgent
┌──────────────▼──────────┐  ┌────────────▼───────────────────┐
│   Logic Engine (KB)     │  │      Environment (World)       │
│      js/kb.js           │  │         js/world.js            │
│  • Clause storage       │  │  • Grid & hazard generation    │
│  • CNF conversion       │  │  • Ground truth management     │
│  • Unit propagation     │  │  • Percept computation         │
│  • Resolution refutation│  │  • Safe-start guarantee        │
└─────────────────────────┘  └────────────────────────────────┘
```

---

## 📂 Project Structure

```
wumpus-cave-explorer/
│
├── index.html            # Application entry point, three-column layout
│
├── css/
│   └── index.css         # Design system: CSS variables, grid, animations, cave theme
│
├── js/
│   ├── kb.js             # Propositional Logic KB & Resolution Refutation Engine
│   ├── world.js          # Wumpus World environment state machine
│   ├── agent.js          # Autonomous BFS + KB-driven exploration agent
│   ├── ui.js             # Grid cell renderer, percept display, log writer
│   └── app.js            # Top-level controller — wires all modules together
│
├── assets/
│   └── bg.jpg            # Cave rock wall background texture
│
├── vercel.json           # Vercel deployment configuration
└── README.md             # This file
```

---

## 🧠 Logic Engine Deep Dive

### Knowledge Base (`js/kb.js`)

The KB operates in two inference phases to balance correctness and performance:

#### Phase 0 — Unit Propagation
Fast O(n) pass. Any clause with a single literal is immediately resolved and removed from the working set. This handles the majority of obvious safe/dangerous deductions in milliseconds.

```
Example: If ¬Breeze(2,1) is known, then ¬Pit(1,1) ∧ ¬Pit(2,2) ∧ ¬Pit(3,1) can be immediately deduced.
```

#### Phase 1 — Bounded Disjunctive Resolution
Full PL-Resolution algorithm on the remaining ambiguous clauses. A hard cap of **100 steps** prevents the exponential blowup of clause generation from blocking the UI thread during highly ambiguous board states.

#### TELL / ASK Interface

```javascript
// When the agent visits a new cell, it TELLs the KB what it perceived:
kb.tell(percepts, r, c, rows, cols);

// Before moving to an adjacent unvisited cell, the agent ASKs:
const isPitSafe    = kb.askSafe_Pit(r, c);    // Proves ¬Pit(r,c)
const isWumpusSafe = kb.askSafe_Wumpus(r, c); // Proves ¬Wumpus(r,c)
```

### Agent Behaviour (`js/agent.js`)

The agent follows this decision loop each step:

1. **Perceive** — receive Breeze/Stench/Glitter from the current cell.
2. **TELL** — encode all logical implications of the percept into the KB.
3. **Classify** — ASK the KB to label every adjacent unvisited cell as `SAFE`, `DANGER`, or `UNKNOWN`.
4. **Move** — prioritize provably `SAFE` cells. If none exist, backtrack via BFS over visited cells.
5. **Repeat** — until the treasure is grabbed, a hazard is triggered, or no moves remain.

---

## 🎨 UI & Controls Reference

| Control | Location | Function |
|---|---|---|
| **Rows × Cols** | Left Panel | Define the grid dimensions for the next game |
| **Auto Run** ⚡ | Left Panel | Toggle fully autonomous agent operation |
| **Reveal Truth** 👁️ | Left Panel | Unmask all hidden pits, ghoul, and gold on the grid |
| **Speed Slider** | Left Panel | Control delay between agent steps (Slow ↔ Fast) |
| **Step** ▶ | Left Panel | Advance the agent exactly one move manually |
| **New Game** ↺ | Left Panel | Reset the world with a fresh random layout |
| **Active Percepts** | Right Panel | Live display of Breeze/Stench/Glitter at current cell |
| **Inference Steps** | Right Panel | Count of total resolution steps performed |
| **Moves Taken** | Right Panel | Count of cells the agent has visited |
| **KB Clauses** | Right Panel | Live count of clauses currently in the KB |
| **Reasoning Log** | Right Panel | Chronological log of all agent decisions and inferences |

### Grid Cell Legend

| Color | Meaning |
|---|---|
| 🟤 Dark (default) | Unvisited / Unknown |
| 🟢 Green tint | Visited & safe (agent has been here) |
| 🟡 Yellow/amber tint | Inferred safe by the KB (not yet visited) |
| 🔴 Red tint | Inferred dangerous (probable pit or ghoul) |
| 🟣 Purple glow | Current agent position |

---

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Edge, Safari)
- Any static file server (for local development)

### Run Locally

```bash
# Clone the repository
git clone https://github.com/Abdu1-Ahd/Wumpus-Cave-Explorer.git
cd Wumpus-Cave-Explorer

# Option 1: Use npx serve
npx serve .

# Option 2: Use VS Code Live Server extension
# Right-click index.html → "Open with Live Server"

# Option 3: Use Python's built-in server
python -m http.server 8080
```

Then open `http://localhost:8080` (or the port your server reports) in your browser.

> **Note:** Opening `index.html` directly as a `file://` URL works in most browsers since there are no module imports or fetch calls.

---

## ⚙️ Technical Notes & Design Decisions

### Safe-Start Guarantee
`world.js` uses a generation loop that validates `[0,0]` (the start cell) has **at least one adjacent cell free of hazards** before accepting a layout. This prevents instant, unavoidable deaths on the very first move, which would make the AI indistinguishable from a random walker.

### Resolution Step Budget
Without a cap, the Resolution algorithm on a fully ambiguous 10×10 board can generate millions of candidate clauses. The **100-step limit** on Phase 1 is a deliberate trade-off: the agent may label some provably-safe cells as `UNKNOWN` (being conservative), but the simulation never freezes. In practice, the cap is rarely hit because Phase 0 (unit propagation) resolves the vast majority of deductions.

### Glitter Percept Timing
A subtle correctness fix: percepts are computed **before** the agent collects gold. This ensures the `✨ Glitter` percept is correctly logged when the agent first steps onto the treasure cell, rather than reading `no percepts` (which would happen if gold collection occurred first).

---

## 📋 Assignment Requirements Checklist

| Requirement | Status |
|---|---|
| Dynamic grid sizing (N × M) | ✅ Implemented |
| Random pit and wumpus placement | ✅ Implemented |
| Breeze percept adjacent to pits | ✅ Implemented |
| Stench percept adjacent to wumpus | ✅ Implemented |
| Propositional Logic Knowledge Base | ✅ Implemented |
| Resolution Refutation (CNF + resolve) | ✅ Implemented |
| Web-based graphical UI | ✅ Implemented |
| Grid visualization with color coding | ✅ Implemented |
| Real-time Inference Steps metric | ✅ Implemented |
| Active Percepts display | ✅ Implemented |

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Built for AI2002 Assignment #6 · Wumpus World Knowledge-Based Agent</sub>
</div>



<!-- dev-sync: 03293119 | ts: 2026-06-27T12:33:05+0500 -->
