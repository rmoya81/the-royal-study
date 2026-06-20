// Depth-first solver for solitaire-chess studies.
//
// Because every move removes exactly one piece, a study with N pieces is solved
// in exactly N-1 moves when solvable. We use DFS to (a) verify a puzzle is
// solvable and (b) produce a concrete winning line used for hints.

import { allMoves, applyMove, cloneState, isSolved } from './engine.js';

/**
 * Return a winning sequence of moves from `state`, or null if unsolvable.
 * Each returned move is the same shape produced by allMoves().
 */
export function solve(state) {
  const seen = new Set();

  function key(s) {
    // Order-independent signature of the position.
    return s.pieces
      .map((p) => `${p.type}${p.c},${p.r}`)
      .sort()
      .join('|');
  }

  function dfs(s) {
    if (isSolved(s)) return [];
    const k = key(s);
    if (seen.has(k)) return null;
    seen.add(k);

    for (const move of allMoves(s)) {
      const next = applyMove(cloneState(s), move);
      const rest = dfs(next);
      if (rest) return [move, ...rest];
    }
    return null;
  }

  return dfs(cloneState(state));
}

/** The next single best move from the current position, or null. */
export function hintMove(state) {
  const line = solve(state);
  return line && line.length ? line[0] : null;
}

/** Minimum number of moves to solve (N-1 when solvable, else null). */
export function minMoves(state) {
  const line = solve(state);
  return line ? line.length : null;
}
