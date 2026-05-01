/**
 * world.js — Wumpus World Environment
 *
 * Responsibilities:
 *  - Generate a grid of given dimensions
 *  - Randomly place Pits and one Wumpus (never at start cell [0,0])
 *  - Compute percepts for any cell (Breeze / Stench / Glitter)
 *  - Track agent state: position, alive, gold collected, moves
 */

'use strict';

/**
 * @file world.js
 * @description Manages the Wumpus World environment, grid generation, and hazard placement.
 * Responsible for tracking the agent's position, calculating percepts (Breeze, Stench, Glitter),
 * and enforcing the ground rules of the simulation.
 */

class WumpusWorld {
  /**
   * @param {number} rows
   * @param {number} cols
   * @param {number} [pitCount]  default: floor(rows*cols * 0.15) but at least 1
   */
  constructor(rows, cols, pitCount) {
    this.rows = rows;
    this.cols = cols;
    this.pitCount = pitCount ?? Math.max(1, Math.floor(rows * cols * 0.15));

    // Ground truth (hidden from agent)
    this.pits = new Set();      // keys: `${r}_${c}`
    this.wumpusPos = null;      // {r, c}
    this.goldPos = null;        // {r, c}
    this.wumpusAlive = true;

    // Agent state
    this.agentPos = { r: 0, c: 0 };
    this.agentAlive = true;
    this.hasGold = false;
    this.moves = 0;
    this.visitedCells = new Set();   // keys
    this.perceptHistory = [];        // [{r,c,percepts}]

    this._generate();
  }

  _generate() {
    // Cells adjacent to start — at least one must remain safe so the
    // agent can always make a first move.
    const startAdj = adjacentCells(0, 0, this.rows, this.cols)
      .map(([r, c]) => `${r}_${c}`);

    const forbidden = new Set(['0_0']);
    const allCells = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!forbidden.has(`${r}_${c}`)) allCells.push({ r, c });
      }
    }
    this._shuffle(allCells);

    // Place pits — never fill ALL start-adjacent cells with hazards.
    let placed = 0;
    let startAdjSafe = startAdj.length; // track how many start-adj cells remain hazard-free
    for (const cell of allCells) {
      if (placed >= this.pitCount) break;
      const key = `${cell.r}_${cell.c}`;
      const isStartAdj = startAdj.includes(key);
      // Reserve at least one start-adjacent safe cell
      if (isStartAdj && startAdjSafe <= 1) continue;
      this.pits.add(key);
      if (isStartAdj) startAdjSafe--;
      placed++;
    }

    // Place wumpus (not in pit, not at 0,0, not blocking all start-adj)
    const candidates = allCells.filter(c => !this.pits.has(`${c.r}_${c.c}`));
    // Prefer non-start-adjacent for wumpus if possible
    const wumpusCandidates = candidates.filter(
      c => startAdjSafe > 1 || !startAdj.includes(`${c.r}_${c.c}`)
    );
    this.wumpusPos = (wumpusCandidates.length > 0 ? wumpusCandidates : candidates)[0];

    // Place gold (reachable: not same cell as wumpus)
    const goldCandidates = candidates.filter(
      c => !(c.r === this.wumpusPos.r && c.c === this.wumpusPos.c)
    );
    this.goldPos = goldCandidates[Math.floor(Math.random() * goldCandidates.length)];

    // Mark start as visited
    this.visitedCells.add('0_0');
  }

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  /** Compute percepts at a given cell (ground truth). */
  getPercepts(r, c) {
    const adj = adjacentCells(r, c, this.rows, this.cols);
    const breeze = adj.some(([ar, ac]) => this.pits.has(`${ar}_${ac}`));
    const stench = adj.some(
      ([ar, ac]) => this.wumpusAlive && ar === this.wumpusPos.r && ac === this.wumpusPos.c
    );
    const glitter =
      this.goldPos &&
      !this.hasGold &&
      r === this.goldPos.r &&
      c === this.goldPos.c;

    return { breeze, stench, glitter };
  }

  /** Get percepts at current agent position. */
  currentPercepts() {
    return this.getPercepts(this.agentPos.r, this.agentPos.c);
  }

  /**
   * Move agent to (r, c). Returns result object.
   * @returns {{ ok:boolean, reason:string, percepts:object, fell:boolean, eaten:boolean }}
   */
  moveAgent(r, c) {
    if (!this.agentAlive) return { ok: false, reason: 'Agent is dead' };
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) {
      return { ok: false, reason: 'Out of bounds' };
    }

    this.agentPos = { r, c };
    this.moves++;
    this.visitedCells.add(`${r}_${c}`);

    // Check hazards
    if (this.pits.has(`${r}_${c}`)) {
      this.agentAlive = false;
      return { ok: false, reason: 'fell into pit', fell: true, eaten: false, percepts: null };
    }
    if (
      this.wumpusAlive &&
      r === this.wumpusPos.r &&
      c === this.wumpusPos.c
    ) {
      this.agentAlive = false;
      return { ok: false, reason: 'eaten by wumpus', fell: false, eaten: true, percepts: null };
    }

    const percepts = this.currentPercepts();

    // Grab gold
    if (
      this.goldPos &&
      !this.hasGold &&
      r === this.goldPos.r &&
      c === this.goldPos.c
    ) {
      this.hasGold = true;
    }

    this.perceptHistory.push({ r, c, percepts });
    return { ok: true, reason: 'moved', fell: false, eaten: false, percepts };
  }

  /** Is a given cell visited by the agent? */
  isVisited(r, c) {
    return this.visitedCells.has(`${r}_${c}`);
  }

  /** Ground-truth check: is this a pit? */
  isPit(r, c) {
    return this.pits.has(`${r}_${c}`);
  }

  /** Ground-truth check: is the wumpus here? */
  isWumpus(r, c) {
    return this.wumpusAlive && this.wumpusPos.r === r && this.wumpusPos.c === c;
  }
}

window.WumpusWorld = WumpusWorld;
