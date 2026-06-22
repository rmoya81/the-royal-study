// Offline puzzle generator for "The Royal Study".
//
//   node scripts/generate-puzzles.js
//
// Each study has a start arrangement and a goal arrangement on a 3x3 board.
// Goals are produced by random-walking legal moves from a valid start, which
// guarantees reachability; the BFS solver then computes the true "par".
//
//   • Level 1 (Aprendiz): identity goal only.
//   • Level 2 (Maestro): the card may be rotated; par counts rotation costs and
//     we keep studies where rotating strictly beats the upright solution.
//   • Level 3 (Gran Maestro): rotations + mirrors, same "transform helps" rule.
//
// We also emit a DUO deck (goal cards + valid arrangements) for the 2-player
// bidding mode, where pieces carry over between rounds. Output is deterministic.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createState, allMoves, applyMove, isDark, isCentre } from '../src/game/engine.js';
import { solve, bestPlan } from '../src/game/solver.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLS = 3;
const ROWS = 3;
const tmp = { cols: COLS, rows: ROWS };

const LEVELS = [
  { id: 'aprendiz', name: 'Aprendiz', set: ['R', 'N', 'K'], transforms: 'none', walk: 5, parMin: 2, parMax: 4, seed: 11, want: 8 },
  { id: 'maestro', name: 'Maestro', set: ['Q', 'R', 'N', 'K'], transforms: 'rot', walk: 7, parMin: 3, parMax: 7, seed: 22, want: 8 },
  { id: 'granmaestro', name: 'Gran Maestro', set: ['Q', 'R', 'B', 'N', 'K'], transforms: 'all', walk: 9, parMin: 4, parMax: 9, seed: 33, want: 8 },
];

const squares = [];
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) squares.push({ c, r });

function validSquareFor(type, c, r, used) {
  if (used.has(`${c},${r}`)) return false;
  if (type === 'B' && !isDark(c, r)) return false;
  if (type === 'N' && isCentre(tmp, c, r)) return false;
  return true;
}

function randomStart(rand, set) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const used = new Set();
    const pieces = [];
    let ok = true;
    for (const type of set) {
      const choices = squares.filter((s) => validSquareFor(type, s.c, s.r, used));
      if (!choices.length) { ok = false; break; }
      const s = choices[Math.floor(rand() * choices.length)];
      used.add(`${s.c},${s.r}`);
      pieces.push({ type, c: s.c, r: s.r });
    }
    if (ok) return pieces;
  }
  return null;
}

function randomWalk(rand, startPieces, steps) {
  const state = createState({ cols: COLS, rows: ROWS, start: startPieces });
  for (let i = 0; i < steps; i++) {
    const moves = allMoves(state);
    if (!moves.length) break;
    applyMove(state, moves[Math.floor(rand() * moves.length)]);
  }
  return state.pieces.map((p) => ({ type: p.type, c: p.c, r: p.r }));
}

const sig = (pieces) => pieces.map((p) => `${p.type}${p.c},${p.r}`).sort().join('|');

const levelsOut = [];
for (const level of LEVELS) {
  const rand = rng(level.seed);
  const found = [];
  const seen = new Set();
  let guard = 0;
  while (found.length < level.want && guard < 600000) {
    guard++;
    const start = randomStart(rand, level.set);
    if (!start) continue;
    const goal = randomWalk(rand, start, level.walk);
    if (sig(start) === sig(goal)) continue;

    const state = createState({ cols: COLS, rows: ROWS, start });
    const upright = solve(state, goal);
    if (!upright) continue;
    const plan = bestPlan(state, goal, level.transforms);
    if (!plan) continue;
    const par = plan.par;
    if (par < level.parMin || par > level.parMax) continue;

    // For transform levels, require that transforming strictly beats upright,
    // so the mechanic actually matters.
    if (level.transforms !== 'none' && par >= upright.length) continue;

    const id = `${sig(start)}=>${sig(goal)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    found.push({ cols: COLS, rows: ROWS, start, goal, par, transforms: level.transforms });
  }
  console.log(`${level.name}: ${found.length} studies (tried ${guard})`);
  levelsOut.push({ id: level.id, name: level.name, transforms: level.transforms, puzzles: found });
}

// --- DUO deck: arrangements of all five pieces for the carry-over bidding mode.
const DUO_SET = ['K', 'Q', 'R', 'B', 'N'];
const duoRand = rng(777);
const duoCards = [];
const duoSeen = new Set();
let duoGuard = 0;
while (duoCards.length < 40 && duoGuard < 200000) {
  duoGuard++;
  const arr = randomStart(duoRand, DUO_SET);
  if (!arr) continue;
  const s = sig(arr);
  if (duoSeen.has(s)) continue;
  duoSeen.add(s);
  duoCards.push(arr.map((p) => ({ type: p.type, c: p.c, r: p.r })));
}
console.log(`Duo deck: ${duoCards.length} arrangements`);

const header = `// AUTO-GENERATED by scripts/generate-puzzles.js — do not edit by hand.
// LEVELS: solo studies (start + goal + BFS-verified par, with transform mode).
// DUO: arrangements of all 5 pieces for the 2-player carry-over bidding mode.
`;
const body =
  `export const LEVELS = ${JSON.stringify(levelsOut, null, 2)};\n\n` +
  `export const DUO = ${JSON.stringify({ set: DUO_SET, cards: duoCards }, null, 2)};\n`;
const outPath = resolve(__dirname, '../src/game/puzzles.js');
writeFileSync(outPath, header + body);
console.log(`Wrote ${outPath}`);
