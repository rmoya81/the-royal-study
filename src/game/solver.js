// Breadth-first solver for "The Royal Study".
//
// A study is a start arrangement plus a goal arrangement. Because the board is
// tiny (3x3) and pieces are few, BFS over board arrangements finds the true
// minimum number of moves (the "par") and a concrete shortest line for hints.

import { allMoves, applyMove, cloneState, isSolved } from './engine.js';
import { allowedGoals } from './transforms.js';

// Order-independent signature of a position (piece type + square).
function key(state) {
  return state.pieces
    .map((p) => `${p.type}${p.c},${p.r}`)
    .sort()
    .join('|');
}

/**
 * Shortest winning line from `state` to `goal`, as an array of moves, or null.
 * Each move is { pieceId, from, to } valid in the position it is applied to.
 */
export function solve(state, goal, limit = 200000) {
  if (isSolved(state, goal)) return [];
  const start = cloneState(state);
  const queue = [start];
  const prev = new Map(); // key -> { parentKey, move }
  const seen = new Set([key(start)]);
  const byKey = new Map([[key(start), start]]);

  let head = 0;
  while (head < queue.length && seen.size < limit) {
    const cur = queue[head++];
    for (const move of allMoves(cur)) {
      const next = applyMove(cloneState(cur), move);
      const k = key(next);
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, { parentKey: key(cur), move });
      byKey.set(k, next);
      if (isSolved(next, goal)) return reconstruct(prev, k);
      queue.push(next);
    }
  }
  return null;
}

function reconstruct(prev, endKey) {
  const line = [];
  let k = endKey;
  while (prev.has(k)) {
    const { parentKey, move } = prev.get(k);
    line.push(move);
    k = parentKey;
  }
  return line.reverse();
}

/** Minimum number of moves to reach the goal, or null if unreachable. */
export function minMoves(state, goal) {
  const line = solve(state, goal);
  return line ? line.length : null;
}

/** The next move on a shortest path to the goal, or null. */
export function hintMove(state, goal) {
  const line = solve(state, goal);
  return line && line.length ? line[0] : null;
}

/**
 * Minimum total cost to solve when the card may be transformed, where
 * `mode` is 'none' | 'rot' | 'all'. The cost of an orientation is its action
 * cost (rotations/mirrors) plus the moves to reach that oriented goal.
 * Returns { par, key, goal } for the best orientation, or null if unreachable.
 */
export function bestPlan(state, goal, mode = 'none') {
  let best = null;
  for (const opt of allowedGoals(goal, mode)) {
    const moves = minMoves(state, opt.goal);
    if (moves == null) continue;
    const total = moves + opt.cost;
    if (!best || total < best.par) best = { par: total, key: opt.key, goal: opt.goal };
  }
  return best;
}

