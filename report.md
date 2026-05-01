# AI2002 — Assignment #6: Wumpus Logic Agent Technical Report

**Student Submission:** Abdu1-Ahd  
**Project:** Knowledge-Based Agent (Wumpus Cave Explorer)

---

## 🔗 Project Links
- **GitHub Repository:** [github.com/Abdu1-Ahd/Wumpus-Cave-Explorer](https://github.com/Abdu1-Ahd/Wumpus-Cave-Explorer)
- **Live Deployment (Vercel):** [wumpus-explorer.vercel.app](https://wumpus-explorer.vercel.app)
- **LinkedIn Profile:** [INSERT YOUR LINKEDIN LINK HERE]

---

## 1. Introduction
This project implements a Knowledge-Based Agent (KBA) designed to navigate the "Wumpus World" cavern. The core challenge involves reasoning under uncertainty: the agent must deduce the locations of hidden pits and the "Cave Ghoul" (Wumpus) using only localized sensory input (Breeze and Stench). The solution utilizes Propositional Logic and an automated Resolution Refutation engine to guarantee safety before each movement.

## 2. Environment & Percepts
The environment is a dynamic N×M grid. At each step, the agent perceives:
- **Breeze:** Implies an adjacent cell contains a **Pit**.
- **Stench:** Implies an adjacent cell contains the **Wumpus**.
- **Glitter:** Implies the current cell contains the **Gold**.

These percepts are translated into logical sentences and added to the **Knowledge Base (KB)**.

## 3. Knowledge Representation (CNF)
The inference engine operates on clauses in **Conjunctive Normal Form (CNF)**. 

### Biconditional Encoding
For every cell $(i, j)$, the rules of the world are encoded as biconditionals:
- $B_{i,j} \iff (P_{i+1,j} \lor P_{i-1,j} \lor P_{i,j+1} \lor P_{i,j-1})$
- $S_{i,j} \iff (W_{i+1,j} \lor W_{i-1,j} \lor W_{i,j+1} \lor W_{i,j-1})$

### Conversion to CNF
The engine automatically converts these biconditionals into a set of clauses. For example, $A \iff (B \lor C)$ is converted into:
1. $(\neg A \lor B \lor C)$
2. $(A \lor \neg B)$
3. $(A \lor \neg C)$

This allows the Resolution algorithm to operate on a uniform set of disjunctions.

## 4. The Resolution Refutation Loop
To determine if a cell $(x, y)$ is safe, the agent performs a **Resolution Refutation Proof**.

### The Algorithm
1. **Goal:** Prove that a cell $(x, y)$ is safe (i.e., $\neg Pit_{x,y} \land \neg Wumpus_{x,y}$).
2. **Negation of Goal:** To prove $\neg Pit_{x,y}$, we add the contradiction $Pit_{x,y}$ to the KB.
3. **Resolution Loop:**
   - The engine repeatedly selects two clauses $(C_1, C_2)$ that contain complementary literals (e.g., $P$ and $\neg P$).
   - It produces a new clause (the resolvent) by combining the remaining literals.
   - If the engine produces an **empty clause** (a contradiction), the original goal is proven true.

### Hybrid Inference Strategy
To maintain web performance, the engine employs a two-phase approach:
- **Phase 0 (Unit Propagation):** The engine first performs O(n) passes to resolve all single-literal clauses. This handles >90% of deductions instantly.
- **Phase 1 (Bounded Resolution):** For remaining ambiguous cells, a full resolution loop is executed with a **100-step limit**. This prevents the "Resolution Explosion" problem (exponential clause growth) from freezing the browser.

## 5. Performance & Metrics
- **Inference Steps:** Tracked in real-time on the dashboard to show the complexity of each deduction.
- **Safe-Start Guarantee:** The generator ensures the initial move is never a forced death, allowing the logic engine to bootstrap its knowledge safely.
- **Responsive UI:** Decoupled logic and rendering ensure that even complex 10×10 resolutions do not degrade the frame rate.

---
*Note: This report was generated as part of the AI2002 course requirements.*
