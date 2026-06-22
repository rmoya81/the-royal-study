// Card transformations for "The Royal Study" levels 2 and 3.
//
// During execution the challenge card may be transformed, and each action costs
// moves (per the rulebook):
//   • Level 2 — rotate the card: 90° (either way) costs 1 move, 180° costs 2.
//   • Level 3 — also mirror the card: each mirror (H or V) costs 1 move.
//
// On a 3x3 board the reachable orientations form the dihedral group D4 (8
// elements). All transforms preserve square colour and the centre, so the
// Bishop-on-dark and Knight-not-centre rules stay valid after transforming.

const N = 3;

// Primitive transforms applied to a single (c, r). Each costs 1 move in play.
export const rotateCW = (c, r) => [N - 1 - r, c];
export const rotateCCW = (c, r) => [r, N - 1 - c];
export const mirrorH = (c, r) => [N - 1 - c, r];
export const mirrorV = (c, r) => [c, N - 1 - r];

const map = (goal, fn) => goal.map((g) => {
  const [c, r] = fn(g.c, g.r);
  return { type: g.type, c, r };
});

export const applyRotateCW = (goal) => map(goal, rotateCW);
export const applyRotateCCW = (goal) => map(goal, rotateCCW);
export const applyMirrorH = (goal) => map(goal, mirrorH);
export const applyMirrorV = (goal) => map(goal, mirrorV);

// The 8 dihedral orientations of a goal, each with the minimal action cost to
// reach it using the primitives above (rotate = 1, mirror = 1).
//   e=0, r90=1, r270=1, r180=2, mirrorH=1, mirrorV=1, diagonals=2.
const D4 = [
  { key: 'e', cost: 0, fn: (c, r) => [c, r] },
  { key: 'r90', cost: 1, fn: rotateCW },
  { key: 'r270', cost: 1, fn: rotateCCW },
  { key: 'r180', cost: 2, fn: (c, r) => [N - 1 - c, N - 1 - r] },
  { key: 'mh', cost: 1, fn: mirrorH },
  { key: 'mv', cost: 1, fn: mirrorV },
  { key: 'd1', cost: 2, fn: (c, r) => [r, c] },
  { key: 'd2', cost: 2, fn: (c, r) => [N - 1 - r, N - 1 - c] },
];

/**
 * Orientations allowed at a difficulty, with their move costs:
 *   'none' → identity only; 'rot' → rotations; 'all' → rotations + mirrors.
 * Returns [{ key, cost, goal }].
 */
export function allowedGoals(goal, mode) {
  let keys;
  if (mode === 'rot') keys = ['e', 'r90', 'r270', 'r180'];
  else if (mode === 'all') keys = D4.map((t) => t.key);
  else keys = ['e'];
  return D4
    .filter((t) => keys.includes(t.key))
    .map((t) => ({ key: t.key, cost: t.cost, goal: map(goal, t.fn) }));
}
