/**
 * app.js — Application Controller
 *
 * Wires together:
 *  - WumpusWorld (environment)
 *  - WumpusAgent (KB agent with resolution)
 *  - UI renderer
 *
 * Exposes a clean GameController object consumed by the HTML.
 */

'use strict';

// ──────────────────────────────────────────
//  GameController
// ──────────────────────────────────────────

const GameController = (() => {
  let world = null;
  let agent = null;
  let autoTimer = null;
  let gameOver = false;
  let won = false;
  let showTruth = false;

  // ── Callbacks registered by the UI layer ──
  const listeners = { render: [], log: [], status: [] };

  function on(event, fn) {
    listeners[event]?.push(fn);
  }

  function emit(event, data) {
    listeners[event]?.forEach(fn => fn(data));
  }

  // ──────────────────────────────────────────
  //  Init / Reset
  // ──────────────────────────────────────────

  function init(rows, cols) {
    stopAuto();
    gameOver = false;
    won = false;
    world = new WumpusWorld(rows, cols);
    agent = new WumpusAgent(rows, cols);

    // First percept at start cell (0,0)
    const startPercepts = world.currentPercepts();
    agent.perceive(startPercepts);

    _render();
    emit('status', { message: 'New game started. Agent at (0,0).', type: 'info' });
  }

  // ──────────────────────────────────────────
  //  Single step
  // ──────────────────────────────────────────

  function step() {
    if (gameOver || !world || !agent) return false;

    // Agent decides next move
    const next = agent.chooseNextMove();
    if (!next) {
      gameOver = true;
      emit('status', { message: 'Agent is stuck — no safe moves available.', type: 'warn' });
      _render();
      return false;
    }

    // World processes move
    const result = world.moveAgent(next.r, next.c);

    if (!result.ok) {
      // Agent died — still update position for visualization
      agent.pos = next;
      gameOver = true;
      const reason = result.eaten ? '💀 Eaten by the Wumpus!' : '💀 Fell into a Pit!';
      emit('status', { message: reason, type: 'danger' });
      _render(true); // reveal truth
      return false;
    }

    // Agent commits move
    agent.moveTo(next.r, next.c);
    agent.perceive(result.percepts);

    // Check gold
    if (result.percepts.glitter || world.hasGold) {
      won = true;
      gameOver = true;
      emit('status', {
        message: `🏆 Gold collected! Agent won in ${agent.totalMoves} moves, ${agent.totalInferenceSteps} inference steps.`,
        type: 'success',
      });
      _render(true);
      return false;
    }

    emit('status', {
      message: `Moved to (${next.r},${next.c}). Inference steps: ${agent.totalInferenceSteps}`,
      type: 'info',
    });
    _render();
    return true;
  }

  // ──────────────────────────────────────────
  //  Auto-run
  // ──────────────────────────────────────────

  function startAuto(intervalMs = 500) {
    if (autoTimer) return;
    autoTimer = setInterval(() => {
      const cont = step();
      if (!cont) stopAuto();
    }, intervalMs);
  }

  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function toggleAuto(intervalMs = 500) {
    if (autoTimer) stopAuto();
    else startAuto(intervalMs);
    return !!autoTimer;
  }

  // ──────────────────────────────────────────
  //  Manual move (user clicks a cell)
  // ──────────────────────────────────────────

  function manualMove(r, c) {
    if (gameOver || !world || !agent) return;
    const adj = adjacentCells(agent.pos.r, agent.pos.c, world.rows, world.cols);
    const isAdjacent = adj.some(([ar, ac]) => ar === r && ac === c);
    if (!isAdjacent) {
      emit('status', { message: 'Can only move to adjacent cells.', type: 'warn' });
      return;
    }
    // Override agent decision and move
    const result = world.moveAgent(r, c);
    if (!result.ok) {
      agent.pos = { r, c };
      gameOver = true;
      emit('status', {
        message: result.eaten ? '🩸 Mutilated by the Cave Ghoul!' : '🦇 Swallowed by the Abyss!',
        type: 'danger',
      });
      _render(true);
      return;
    }
    agent.moveTo(r, c);
    agent.perceive(result.percepts);
    if (result.percepts.glitter || world.hasGold) {
      won = true;
      gameOver = true;
      emit('status', { message: '🏆 Gold collected!', type: 'success' });
      _render(true);
      return;
    }
    emit('status', { message: `Moved to (${r},${c})`, type: 'info' });
    _render();
  }

  // ──────────────────────────────────────────
  //  Rendering data assembly
  // ──────────────────────────────────────────

  function _render(revealAll = false) {
    if (!world || !agent) return;
    const snap = agent.getSnapshot();

    const cells = [];
    for (let r = 0; r < world.rows; r++) {
      for (let c = 0; c < world.cols; c++) {
        const isAgent = snap.pos.r === r && snap.pos.c === c;
        const isGold = world.goldPos?.r === r && world.goldPos?.c === c;
        const isPit = world.isPit(r, c);
        const isWumpus = world.isWumpus(r, c);
        const status = snap.cellStatus[r][c];
        const percepts = world.isVisited(r, c)
          ? world.getPercepts(r, c)
          : null;

        cells.push({
          r, c,
          isAgent,
          isGold: isGold && !world.hasGold,
          status,
          percepts,
          // Ground truth only revealed if revealAll or showTruth toggled
          revealPit: (revealAll || showTruth) && isPit,
          revealWumpus: (revealAll || showTruth) && isWumpus,
        });
      }
    }

    emit('render', {
      cells,
      rows: world.rows,
      cols: world.cols,
      agentPos: snap.pos,
      metrics: {
        moves: snap.totalMoves,
        inferenceSteps: snap.totalInferenceSteps,
        kbClauses: snap.kbClauseCount,
        gameOver,
        won,
        agentAlive: world.agentAlive,
        hasGold: world.hasGold,
      },
      percepts: world.currentPercepts(),
      log: snap.log,
    });
  }

  function toggleTruth() {
    showTruth = !showTruth;
    _render(gameOver);
    return showTruth;
  }

  function getState() {
    return { gameOver, won, isRunning: !!autoTimer };
  }

  function forceRender() { _render(gameOver); }

  return { init, step, startAuto, stopAuto, toggleAuto, manualMove, toggleTruth, getState, on, _forceRender: forceRender };
})();

window.GameController = GameController;
