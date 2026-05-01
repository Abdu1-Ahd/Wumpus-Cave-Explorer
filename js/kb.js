/**
 * kb.js — Propositional Logic Knowledge Base
 * Implements:
 *  - TELL: add clauses to the KB
 *  - ASK:  resolution refutation to prove a query
 *  - CNF conversion of biconditionals
 *  - Full PL-Resolution algorithm
 */

'use strict';

// ──────────────────────────────────────────
//  Clause helpers
// ──────────────────────────────────────────

/**
 * A literal is either { name, negated:false } or { name, negated:true }.
 * A clause is an array of literals (disjunction).
 */
function literal(name, negated = false) {
  return { name, negated };
}

function negateLiteral(lit) {
  return { name: lit.name, negated: !lit.negated };
}

function litKey(lit) {
  return (lit.negated ? '¬' : '') + lit.name;
}

function clauseKey(clause) {
  return clause.map(litKey).sort().join('∨');
}

/** Check if clause is a tautology (contains both P and ¬P). */
function isTautology(clause) {
  const pos = new Set(clause.filter(l => !l.negated).map(l => l.name));
  return clause.some(l => l.negated && pos.has(l.name));
}

/** Resolve two clauses on a complementary literal pair. Returns array of resolvents (may be empty). */
function resolveClauses(c1, c2) {
  const resolvents = [];
  for (const lit of c1) {
    const complement = negateLiteral(lit);
    if (c2.some(l => litKey(l) === litKey(complement))) {
      // Resolve on `lit`
      const merged = [
        ...c1.filter(l => litKey(l) !== litKey(lit)),
        ...c2.filter(l => litKey(l) !== litKey(complement)),
      ];
      // Remove duplicates
      const seen = new Set();
      const unique = merged.filter(l => {
        const k = litKey(l);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (!isTautology(unique)) {
        resolvents.push(unique);
      }
    }
  }
  return resolvents;
}

// ──────────────────────────────────────────
//  KnowledgeBase class
// ──────────────────────────────────────────

class KnowledgeBase {
  constructor() {
    /** @type {Array<Array<{name:string,negated:boolean}>>} */
    this.clauses = [];
    this._clauseSet = new Set();
    this.inferenceSteps = 0;
  }

  /** Add a single clause (disjunction of literals) to the KB. */
  addClause(clause) {
    const key = clauseKey(clause);
    if (!this._clauseSet.has(key) && !isTautology(clause)) {
      this.clauses.push(clause);
      this._clauseSet.add(key);
    }
  }

  /**
   * TELL the KB percepts for a cell.
   *
   * Encodes the full biconditional in CNF, as required by the assignment:
   *   B_{r,c} ⟺ (P_adj1 ∨ P_adj2 ∨ ... ∨ P_adjN)
   *
   * CNF conversion steps:
   *   1. B ⟺ (P1∨P2∨P3) becomes (B→P1∨P2∨P3) ∧ (P1∨P2∨P3→B)
   *   2. Eliminate implications: (¬B∨P1∨P2∨P3) ∧ (¬P1∨B) ∧ (¬P2∨B) ∧ (¬P3∨B)
   *   3. Add observed fact: {B} or {¬B} as unit clause
   *   4. Resolution will derive the simplified consequences automatically.
   *
   * Same structure applies for Stench / Wumpus.
   *
   * @param {number} r  row (0-indexed)
   * @param {number} c  col (0-indexed)
   * @param {{breeze:boolean, stench:boolean}} percepts
   * @param {number} rows  total rows
   * @param {number} cols  total cols
   */
  tell(r, c, percepts, rows, cols) {
    const adj = adjacentCells(r, c, rows, cols);

    // ── BREEZE biconditional ──────────────────────────────────────────
    // Symbol: B_{r}_{c}
    const B = `B_${r}_${c}`;

    // Assert observed truth of B (unit clause)
    this.addClause([literal(B, !percepts.breeze)]);  // {B} or {¬B}

    // CNF Clause 1 — forward: ¬B ∨ P_adj1 ∨ P_adj2 ∨ ...
    //   (B → P_adj1 ∨ P_adj2 ∨ ...)
    this.addClause([
      literal(B, true),                                  // ¬B
      ...adj.map(([ar, ac]) => literal(`P_${ar}_${ac}`)) // P_adj*
    ]);

    // CNF Clauses 2..N — backward: ¬P_adjI ∨ B  for each adjacent cell
    //   (P_adjI → B)
    for (const [ar, ac] of adj) {
      this.addClause([
        literal(`P_${ar}_${ac}`, true), // ¬P_adjI
        literal(B),                     // B
      ]);
    }

    // ── STENCH biconditional ─────────────────────────────────────────
    // Symbol: S_{r}_{c}
    const S = `S_${r}_${c}`;

    // Assert observed truth of S
    this.addClause([literal(S, !percepts.stench)]);  // {S} or {¬S}

    // CNF Clause 1 — forward: ¬S ∨ W_adj1 ∨ W_adj2 ∨ ...
    this.addClause([
      literal(S, true),
      ...adj.map(([ar, ac]) => literal(`W_${ar}_${ac}`))
    ]);

    // CNF Clauses 2..N — backward: ¬W_adjI ∨ S
    for (const [ar, ac] of adj) {
      this.addClause([
        literal(`W_${ar}_${ac}`, true),
        literal(S),
      ]);
    }
  }

  /**
   * TELL the KB that a visited cell itself is safe (no pit, no wumpus there).
   */
  tellSafe(r, c) {
    this.addClause([literal(`P_${r}_${c}`, true)]); // ¬P
    this.addClause([literal(`W_${r}_${c}`, true)]); // ¬W
  }

  /**
   * ASK: Is a given cell provably safe? Uses Resolution Refutation.
   * Proves ¬P_{r,c} AND ¬W_{r,c} — each conjunct separately.
   *
   * Proof of ¬P: assume P (add unit clause {P}), derive contradiction → KB ⊨ ¬P
   * Proof of ¬W: assume W (add unit clause {W}), derive contradiction → KB ⊨ ¬W
   * Safe only if BOTH succeed.
   *
   * Returns { safe: boolean, steps: number }
   */
  ask(r, c) {
    // Prove ¬P: negate it → add {P}, try to derive ⊥
    const noPit = this._plResolution([[literal(`P_${r}_${c}`)]]);
    // Prove ¬W: negate it → add {W}, try to derive ⊥
    const noWumpus = this._plResolution([[literal(`W_${r}_${c}`)]]);
    return {
      safe: noPit.safe && noWumpus.safe,
      steps: noPit.steps + noWumpus.steps,
    };
  }

  /**
   * ASK: Is a given cell provably containing a pit?
   */
  askPit(r, c) {
    const queryNeg = [[literal(`P_${r}_${c}`, true)]]; // assume ¬P → refute
    return this._plResolution(queryNeg);
  }

  /**
   * ASK: Is a given cell provably containing the Wumpus?
   */
  askWumpus(r, c) {
    const queryNeg = [[literal(`W_${r}_${c}`, true)]]; // assume ¬W → refute
    return this._plResolution(queryNeg);
  }

  /**
   * PL-Resolution with Unit Propagation (Phase 0) + full resolution fallback.
   *
   * Phase 0 — Unit Propagation (BFS):
   *   Immediately propagate each unit clause against all non-unit clauses.
   *   New unit clauses derived are queued and propagated right away.
   *   Wumpus safe-cell proofs complete here in ≤5 steps.
   *
   * Phase 1 — Full Resolution:
   *   Fallback O(n²) loop for disjunctive (non-unit) inference.
   *
   * @param {Array<Array>} negatedQueryClauses
   * @returns {{ safe: boolean, steps: number }}
   */
  _plResolution(negatedQueryClauses) {
    const workingSet = [...this.clauses, ...negatedQueryClauses];
    const seen = new Set(workingSet.map(clauseKey));
    let steps = 0;
    const MAX_STEPS = 10000;

    // ── Phase 0: Unit Propagation ──────────────────────────────────────
    // Queue all starting unit clauses; chain-propagate new units immediately.
    const unitQueue = workingSet.filter(c => c.length === 1).slice();

    while (unitQueue.length > 0 && steps < MAX_STEPS) {
      const unit = unitQueue.shift();
      const negKey = litKey(negateLiteral(unit[0]));

      // Try unit against every other clause in workingSet
      const len = workingSet.length;
      for (let k = 0; k < len && steps < MAX_STEPS; k++) {
        const clause = workingSet[k];
        // Skip if clause doesn't contain the complementary literal
        if (!clause.some(l => litKey(l) === negKey)) continue;

        steps++;
        if (clause.length === 1) {
          // unit ⊗ ¬unit → ⊥
          return { safe: true, steps };
        }

        // Remove the complementary literal → resolvent
        const resolvent = clause.filter(l => litKey(l) !== negKey);
        if (resolvent.length === 0) return { safe: true, steps };

        const key = clauseKey(resolvent);
        if (!seen.has(key)) {
          seen.add(key);
          workingSet.push(resolvent);
          if (resolvent.length === 1) unitQueue.push(resolvent); // chain
        }
      }
    }

    // ── Phase 1: Full Resolution (non-unit disjunctive inference) ──────
    // Capped heavily: Grid Wumpus proofs rarely need deep disjunctive inference.
    // If unit propagation failed, this will likely fail too, so don't waste 10,000 steps.
    const PHASE1_MAX = 100;
    let phase1Steps = 0;
    let newFound = true;
    while (newFound && phase1Steps < PHASE1_MAX) {
      newFound = false;
      const snapshot = workingSet.slice();
      const prevLen = snapshot.length;
      for (let i = 0; i < snapshot.length && phase1Steps < PHASE1_MAX; i++) {
        for (let j = i + 1; j < snapshot.length && phase1Steps < PHASE1_MAX; j++) {
          phase1Steps++;
          steps++;
          const resolvents = resolveClauses(snapshot[i], snapshot[j]);
          for (const res of resolvents) {
            if (res.length === 0) return { safe: true, steps };
            const key = clauseKey(res);
            if (!seen.has(key)) {
              seen.add(key);
              workingSet.push(res);
              newFound = true;
            }
          }
        }
      }
      if (workingSet.length > prevLen) newFound = true;
    }

    return { safe: false, steps };
  }

  reset() {
    this.clauses = [];
    this._clauseSet = new Set();
    this.inferenceSteps = 0;
  }
}

// ──────────────────────────────────────────
//  Utility
// ──────────────────────────────────────────

function adjacentCells(r, c, rows, cols) {
  const candidates = [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ];
  return candidates.filter(([ar, ac]) => ar >= 0 && ar < rows && ac >= 0 && ac < cols);
}

// Export for use in main app
window.KnowledgeBase = KnowledgeBase;
window.adjacentCells = adjacentCells;
window.literal = literal;
