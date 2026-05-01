/**
 * agent.js — Knowledge-Based Agent
 *
 * Implements the PEAS loop:
 *  - Perceive: receive world percepts
 *  - Reason:   TELL KB, then ASK KB to classify cells
 *  - Act:      choose safest unvisited adjacent cell, or backtrack
 *
 * The agent uses a frontier-based DFS with KB pruning:
 *  1. From current cell, get adjacent cells.
 *  2. For each unvisited adjacent cell, ASK KB if safe.
 *  3. Move to a proven-safe cell. If none available, backtrack via visited path.
 *  4. If a cell is proven to have a pit or wumpus, mark as confirmed danger.
 */

'use strict';

/** Cell classification enum */
const CellStatus = {
  UNKNOWN:       'unknown',
  SAFE:          'safe',
  DANGER_PIT:    'danger_pit',
  DANGER_WUMPUS: 'danger_wumpus',
  VISITED:       'visited',
};

class WumpusAgent {
  /**
   * @param {number} rows
   * @param {number} cols
   */
  constructor(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.kb = new KnowledgeBase();

    /** Grid of cell statuses */
    this.cellStatus = Array.from({ length: rows }, () =>
      Array(cols).fill(CellStatus.UNKNOWN)
    );

    /** Stack for DFS backtracking */
    this.pathStack = [{ r: 0, c: 0 }];
    this.visited = new Set(['0_0']);

    /** Current position */
    this.pos = { r: 0, c: 0 };

    /** Track confirmed safe frontier */
    this.safeFrontier = new Set();

    /** Metrics */
    this.totalInferenceSteps = 0;
    this.totalMoves = 0;
    this.log = [];

    // Start cell is safe
    this._markVisited(0, 0);
    this.kb.tellSafe(0, 0);
  }

  /**
   * Process percepts at current position and update KB.
   * @param {{ breeze:boolean, stench:boolean, glitter:boolean }} percepts
   */
  perceive(percepts) {
    const { r, c } = this.pos;
    this.kb.tell(r, c, percepts, this.rows, this.cols);

    const active = [];
    if (percepts.breeze) active.push('BREEZE');
    if (percepts.stench) active.push('STENCH');
    if (percepts.glitter) active.push('GLITTER');

    if (active.length > 0) {
      this._log(`Perceive @(${r},${c}): ${active.join(' ')}`);
    }

    this._infer();
  }

  /**
   * Run resolution inference on all unvisited adjacent cells.
   * Updates cellStatus accordingly.
   */
  _infer() {
    // Check every cell on the grid for inference opportunities
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.visited.has(`${r}_${c}`)) continue;
        if (this.cellStatus[r][c] === CellStatus.SAFE ||
            this.cellStatus[r][c] === CellStatus.DANGER_PIT ||
            this.cellStatus[r][c] === CellStatus.DANGER_WUMPUS) continue;

        // Only infer on cells adjacent to visited cells (the frontier)
        const adj = adjacentCells(r, c, this.rows, this.cols);
        const adjVisited = adj.some(([ar, ac]) => this.visited.has(`${ar}_${ac}`));
        if (!adjVisited) continue;

        const safeResult = this.kb.ask(r, c);
        this.totalInferenceSteps += safeResult.steps;

        if (safeResult.safe) {
          this.cellStatus[r][c] = CellStatus.SAFE;
          this.safeFrontier.add(`${r}_${c}`);
          this._log(`Inferred SAFE: (${r},${c}) in ${safeResult.steps} steps`);
          continue;
        }

        const pitResult = this.kb.askPit(r, c);
        this.totalInferenceSteps += pitResult.steps;
        if (pitResult.safe) {
          this.cellStatus[r][c] = CellStatus.DANGER_PIT;
          this.safeFrontier.delete(`${r}_${c}`);
          this._log(`Inferred PIT: (${r},${c})`);
          continue;
        }

        const wumpusResult = this.kb.askWumpus(r, c);
        this.totalInferenceSteps += wumpusResult.steps;
        if (wumpusResult.safe) {
          this.cellStatus[r][c] = CellStatus.DANGER_WUMPUS;
          this.safeFrontier.delete(`${r}_${c}`);
          this._log(`Inferred WUMPUS: (${r},${c})`);
        }
      }
    }
  }

  /**
   * Choose the next cell to move to (always ONE adjacent step).
   *
   * Priority order:
   *  1. Adjacent unvisited cell that is PROVEN SAFE
   *  2. First step of BFS path (through visited cells) toward nearest safe frontier cell
   *  3. Backtrack one step along visited path stack
   *  4. null → agent is stuck
   *
   * The agent NEVER teleports — it always returns an adjacent cell.
   */
  chooseNextMove() {
    const { r, c } = this.pos;
    const adj = adjacentCells(r, c, this.rows, this.cols);

    // ── Priority 1: adjacent proven-safe unvisited cell ──
    const adjProven = adj.find(
      ([ar, ac]) =>
        !this.visited.has(`${ar}_${ac}`) &&
        this.cellStatus[ar][ac] === CellStatus.SAFE
    );
    if (adjProven) return { r: adjProven[0], c: adjProven[1] };

    // ── Priority 2: BFS toward nearest reachable safe frontier cell ──
    // Navigate through visited cells; the first step is the returned move.
    const bfsTarget = this._bfsToSafeFrontier();
    if (bfsTarget) return bfsTarget;

    // ── Priority 3: Backtrack along path stack ──
    if (this.pathStack.length > 1) {
      this.pathStack.pop();
      const prev = this.pathStack[this.pathStack.length - 1];
      return { r: prev.r, c: prev.c };
    }

    return null; // Fully stuck — no safe moves exist
  }

  /**
   * BFS from current position through visited cells to find
   * the nearest unvisited SAFE cell, returning only the FIRST step.
   *
   * This ensures the agent moves one cell at a time even when
   * the target is multiple steps away.
   *
   * @returns {{ r, c } | null}
   */
  _bfsToSafeFrontier() {
    const { r: startR, c: startC } = this.pos;
    const queue = [{ r: startR, c: startC, firstStep: null }];
    const visitedBFS = new Set([`${startR}_${startC}`]);

    while (queue.length > 0) {
      const { r, c, firstStep } = queue.shift();
      const neighbors = adjacentCells(r, c, this.rows, this.cols);

      for (const [nr, nc] of neighbors) {
        const key = `${nr}_${nc}`;
        if (visitedBFS.has(key)) continue;
        visitedBFS.add(key);

        // Track first step from start
        const step = firstStep ?? { r: nr, c: nc };

        // Found an unvisited SAFE cell — return the first step toward it
        if (!this.visited.has(key) && this.cellStatus[nr][nc] === CellStatus.SAFE) {
          return step;
        }

        // Keep navigating through visited cells only
        if (this.visited.has(key)) {
          queue.push({ r: nr, c: nc, firstStep: step });
        }
      }
    }

    return null; // No reachable safe frontier
  }

  /**
   * Commit to moving to (r, c). Call after world confirms the move is safe.
   * Only pushes to pathStack when the cell is being visited for the FIRST time.
   * Backtracking moves (to already-visited cells) do NOT grow the stack,
   * ensuring repeated pops eventually exhaust options and return null.
   */
  moveTo(r, c) {
    this.pos = { r, c };
    this.totalMoves++;
    const isNew = !this.visited.has(`${r}_${c}`);
    this._markVisited(r, c);
    this.kb.tellSafe(r, c);
    if (isNew) this.pathStack.push({ r, c });   // forward move only
    this._log(`Moved to (${r},${c})`);
  }

  _markVisited(r, c) {
    this.visited.add(`${r}_${c}`);
    this.cellStatus[r][c] = CellStatus.VISITED;
    this.safeFrontier.delete(`${r}_${c}`);
  }

  _log(msg) {
    this.log.push(msg);
    if (this.log.length > 200) this.log.shift();
  }

  /** Full snapshot for UI rendering */
  getSnapshot() {
    return {
      pos: { ...this.pos },
      cellStatus: this.cellStatus.map(row => [...row]),
      totalInferenceSteps: this.totalInferenceSteps,
      totalMoves: this.totalMoves,
      kbClauseCount: this.kb.clauses.length,
      log: [...this.log],
    };
  }

  reset(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.kb.reset();
    this.cellStatus = Array.from({ length: rows }, () =>
      Array(cols).fill(CellStatus.UNKNOWN)
    );
    this.pathStack = [{ r: 0, c: 0 }];
    this.visited = new Set(['0_0']);
    this.pos = { r: 0, c: 0 };
    this.safeFrontier = new Set();
    this.totalInferenceSteps = 0;
    this.totalMoves = 0;
    this.log = [];
    this._markVisited(0, 0);
    this.kb.tellSafe(0, 0);
  }
}

window.WumpusAgent = WumpusAgent;
window.CellStatus = CellStatus;
