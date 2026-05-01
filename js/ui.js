/**
 * ui.js — UI Controller for three-column layout
 * Handles: DOM events, toggle switches, slider, grid rendering,
 *          percept rows, animated metrics, log, game overlay.
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // ── Element refs ──
  const gridEl        = document.getElementById('grid');
  const btnStep       = document.getElementById('btn-step');
  const btnReset      = document.getElementById('btn-reset');
  const toggleAuto    = document.getElementById('toggle-auto');
  const toggleTruth   = document.getElementById('toggle-truth');
  const speedSlider   = document.getElementById('speed-slider');
  const inRows        = document.getElementById('input-rows');
  const inCols        = document.getElementById('input-cols');

  const vInference    = document.getElementById('val-inference');
  const vMoves        = document.getElementById('val-moves');
  const vKb           = document.getElementById('val-kb');

  const perceptList   = document.getElementById('percept-list');
  const logContainer  = document.getElementById('log-container');

  const overlay       = document.getElementById('game-overlay');
  const overlayEmoji  = document.getElementById('overlay-emoji');
  const overlayTitle  = document.getElementById('overlay-title');
  const overlaySub    = document.getElementById('overlay-sub');
  const overlayBtn    = document.getElementById('overlay-btn');

  // ── State ──
  let autoInterval    = null;
  let speedMs         = 400;
  let previousMetrics = { inferenceSteps: 0, moves: 0, kbClauses: 0 };

  // ── Percept config ──
  const PERCEPTS_CFG = [
    {
      key:  'breeze',
      icon: '🌬️',
      name: 'Breeze',
      color:    '#60a5fa',
      bg:       'rgba(96,165,250,0.08)',
      glow:     'rgba(96,165,250,0.2)',
    },
    {
      key:  'stench',
      icon: '🦠',
      name: 'Stench',
      color:    '#a3e635',
      bg:       'rgba(163,230,53,0.08)',
      glow:     'rgba(163,230,53,0.2)',
    },
    {
      key:  'glitter',
      icon: '✨',
      name: 'Glitter',
      color:    '#fbbf24',
      bg:       'rgba(251,191,36,0.08)',
      glow:     'rgba(251,191,36,0.2)',
    },
  ];

  // ── Build static percept rows ──
  PERCEPTS_CFG.forEach(cfg => {
    const row = document.createElement('div');
    row.className = 'percept-row';
    row.id = `percept-${cfg.key}`;
    row.style.setProperty('--p-color', cfg.color);
    row.style.setProperty('--p-bg',    cfg.bg);
    row.style.setProperty('--p-glow',  cfg.glow);
    row.innerHTML = `
      <span class="percept-icon">${cfg.icon}</span>
      <span class="percept-name">${cfg.name}</span>
      <span class="percept-dot"></span>
    `;
    perceptList.appendChild(row);
  });

  // ── Auto-run helpers ──
  function startAuto() {
    if (autoInterval) return;
    autoInterval = setInterval(() => {
      const cont = GameController.step();
      if (!cont) stopAuto();
    }, speedMs);
  }

  function stopAuto() {
    if (autoInterval) { clearInterval(autoInterval); autoInterval = null; }
    if (toggleAuto.checked) toggleAuto.checked = false;
  }

  function getSpeed() {
    // Slider is 100–1500ms; invert so right = faster
    return 1600 - parseInt(speedSlider.value);
  }

  // ── GameController callbacks ──

  GameController.on('status', ({ message, type }) => {
    // Status is handled by overlay for game-over states
  });

  GameController.on('render', (data) => {
    renderGrid(data);
    updatePercepts(data.percepts);
    updateMetrics(data.metrics);
    updateLog(data.log);
    updateButtonStates(data.metrics);
    if (data.metrics.gameOver) showOverlay(data.metrics);
  });

  // ── Grid rendering ──
  function renderGrid({ cells, rows, cols }) {
    const cellSize = computeCellSize(rows, cols);

    // Only rebuild DOM if grid size changed
    if (gridEl.children.length !== rows * cols) {
      gridEl.innerHTML = '';
      gridEl.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
      gridEl.style.gridTemplateRows    = `repeat(${rows}, ${cellSize}px)`;

      // Build from row(rows-1) down to 0 so top of grid = high row index (standard coords)
      for (let r = rows - 1; r >= 0; r--) {
        for (let c = 0; c < cols; c++) {
          const el = document.createElement('div');
          el.className = 'cell cell-enter';
          el.dataset.r = r;
          el.dataset.c = c;
          el.style.width  = cellSize + 'px';
          el.style.height = cellSize + 'px';
          el.addEventListener('animationend', () => el.classList.remove('cell-enter'));
          el.addEventListener('click', () => GameController.manualMove(r, c));
          gridEl.appendChild(el);
        }
      }
    } else {
      // Update grid dimensions in case size changed
      gridEl.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
    }

    // Update each cell's content and classes
    const cellMap = {};
    cells.forEach(c => { cellMap[`${c.r}_${c.c}`] = c; });

    Array.from(gridEl.children).forEach(el => {
      const r = parseInt(el.dataset.r);
      const c = parseInt(el.dataset.c);
      const cell = cellMap[`${r}_${c}`];
      if (!cell) return;

      // Classes
      el.className = `cell ${cell.status}`;
      if (cell.isAgent) el.classList.add('has-agent');

      // Content
      let emojiContent = '';
      let floatClass   = '';

      if (cell.isAgent) {
        emojiContent = '🤠';
        floatClass   = 'agent-float';
      } else if (cell.revealPit) {
        emojiContent = '🕳️';
      } else if (cell.revealWumpus) {
        emojiContent = '🧟';
      } else if (cell.isGold) {
        emojiContent = '💎';
      } else if (cell.status === 'danger_pit') {
        emojiContent = '🦇';
      } else if (cell.status === 'danger_wumpus') {
        emojiContent = '🩸';
      } else if (cell.status === 'safe') {
        emojiContent = '✓';
      }

      let inds = '';
      if (cell.percepts) {
        if (cell.percepts.breeze)  inds += '🌬️';
        if (cell.percepts.stench)  inds += '🦠';
        if (cell.percepts.glitter) inds += '✨';
      }

      el.innerHTML = `
        <span class="cell-coord">${r},${c}</span>
        <span class="cell-emoji ${floatClass}">${emojiContent}</span>
        ${inds ? `<span class="cell-indicators">${inds}</span>` : ''}
      `;
    });
  }

  function computeCellSize(rows, cols) {
    // Available space in center column: roughly viewport - two side columns - padding
    const availW = window.innerWidth  - 460 - 48;  // 2×230 cols + 48px padding
    const availH = window.innerHeight - 48;
    const maxByW = Math.floor((availW - (cols - 1) * 8)  / cols);
    const maxByH = Math.floor((availH - (rows - 1) * 8)  / rows);
    return Math.max(44, Math.min(maxByW, maxByH, 90));
  }

  // ── Percept rows ──
  function updatePercepts(percepts) {
    PERCEPTS_CFG.forEach(cfg => {
      const row = document.getElementById(`percept-${cfg.key}`);
      if (!row) return;
      row.classList.toggle('active', !!percepts[cfg.key]);
    });
  }

  // ── Animated metric counter ──
  function animateCount(el, from, to) {
    if (from === to) return;
    const dur   = 400;
    const start = performance.now();
    const diff  = to - from;
    function tick(now) {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
      el.textContent = Math.round(from + diff * eased);
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = to;
    }
    requestAnimationFrame(tick);

    // Bump flash
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 200);
  }

  function updateMetrics(metrics) {
    animateCount(vInference, previousMetrics.inferenceSteps, metrics.inferenceSteps);
    animateCount(vMoves,     previousMetrics.moves,          metrics.moves);
    animateCount(vKb,        previousMetrics.kbClauses,      metrics.kbClauses);
    previousMetrics = {
      inferenceSteps: metrics.inferenceSteps,
      moves:          metrics.moves,
      kbClauses:      metrics.kbClauses,
    };
  }

  // ── Log ──
  const LOG_MAX = 60;
  function updateLog(log) {
    // Only append new lines
    const existing = logContainer.children.length;
    const allLines  = log;
    const toAdd     = allLines.slice(existing);

    toAdd.forEach(msg => {
      const line = document.createElement('div');
      line.className = 'log-line ' + classifyLog(msg);
      line.innerHTML = `<span class="log-prefix">›</span><span class="log-msg">${msg}</span>`;
      logContainer.appendChild(line);
    });

    // Trim to max
    while (logContainer.children.length > LOG_MAX) {
      logContainer.removeChild(logContainer.firstChild);
    }

    logContainer.scrollTop = logContainer.scrollHeight;
  }

  function classifyLog(msg) {
    if (msg.includes('Inferred'))  return 'infer';
    if (msg.includes('Moved'))     return 'move';
    if (msg.includes('Perceive'))  return 'perceive';
    return 'warn';
  }

  // ── Button states ──
  function updateButtonStates(metrics) {
    const dead = metrics.gameOver;
    btnStep.disabled = dead;
    // Auto toggle is handled by the overlay / gameover check
  }

  // ── Game Over Overlay ──
  function showOverlay(metrics) {
    stopAuto();

    let emoji, title, sub;
    if (metrics.won) {
      emoji = '💎';
      title = 'Treasure Found!';
      sub   = `The explorer escaped with the gold in ${metrics.moves} moves\nand ${metrics.inferenceSteps} inference steps.`;
    } else if (!metrics.agentAlive) {
      emoji = '🩸';
      title = 'Explorer Lost';
      sub   = `The cave claimed another victim.\n${metrics.moves} moves · ${metrics.inferenceSteps} inference steps.`;
    } else {
      emoji = '🏕️';
      title = 'Trapped';
      sub   = 'No safe paths remain. The explorer is trapped.';
    }

    overlayEmoji.textContent = emoji;
    overlayTitle.textContent = title;
    overlaySub.textContent   = sub;
    overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  // ── Event bindings ──

  btnStep.addEventListener('click', () => {
    GameController.step();
  });

  btnReset.addEventListener('click', () => {
    const r = Math.max(2, Math.min(10, parseInt(inRows.value) || 5));
    const c = Math.max(2, Math.min(10, parseInt(inCols.value) || 5));
    inRows.value = r;
    inCols.value = c;
    stopAuto();
    hideOverlay();
    gridEl.innerHTML = ''; // force full rebuild
    logContainer.innerHTML = '';
    previousMetrics = { inferenceSteps: 0, moves: 0, kbClauses: 0 };
    GameController.init(r, c);
  });

  toggleAuto.addEventListener('change', () => {
    if (toggleAuto.checked) {
      speedMs = getSpeed();
      startAuto();
    } else {
      stopAuto();
    }
  });

  speedSlider.addEventListener('input', () => {
    speedMs = getSpeed();
    if (autoInterval) {
      stopAuto();
      if (toggleAuto.checked) startAuto();
    }
  });

  toggleTruth.addEventListener('change', () => {
    GameController.toggleTruth();
  });

  overlayBtn.addEventListener('click', () => {
    hideOverlay();
    const r = Math.max(2, Math.min(10, parseInt(inRows.value) || 5));
    const c = Math.max(2, Math.min(10, parseInt(inCols.value) || 5));
    stopAuto();
    gridEl.innerHTML = '';
    logContainer.innerHTML = '';
    previousMetrics = { inferenceSteps: 0, moves: 0, kbClauses: 0 };
    GameController.init(r, c);
  });

  // Resize handler
  window.addEventListener('resize', () => {
    // Force grid recompute by clearing
    const state = GameController.getState();
    if (!state.gameOver) {
      // Trigger a re-render from current state
      GameController._forceRender?.();
    }
  });

  // ── Boot ──
  GameController.init(5, 5);
});
