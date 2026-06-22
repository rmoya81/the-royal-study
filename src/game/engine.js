// Core rules engine for "The Royal Study" (faithful to the Philos rulebook).
//
// The game is played on a 3x3 board with up to five distinct pieces (King,
// Queen, Rook, Bishop, Knight). There are NO captures: a piece may only move to
// an EMPTY square and may not jump over other pieces — except the Knight, which
// jumps. Two special restrictions apply:
//   • the Bishop must always stay on dark squares;
//   • the Knight may never occupy the centre square.
// A study is solved when every piece sits on the square the challenge card
// marks for it. The score of a study is the minimum number of moves needed.

export const PIECE = Object.freeze({
  KING: 'K',
  QUEEN: 'Q',
  ROOK: 'R',
  BISHOP: 'B',
  KNIGHT: 'N',
});

let _uid = 0;
const nextId = () => `p${++_uid}`;

/** Build a fresh, mutable game state from a puzzle's start arrangement. */
export function createState(puzzle) {
  return {
    cols: puzzle.cols,
    rows: puzzle.rows,
    pieces: puzzle.start.map((p) => ({ id: nextId(), type: p.type, c: p.c, r: p.r })),
  };
}

export const cloneState = (state) => ({
  cols: state.cols,
  rows: state.rows,
  pieces: state.pieces.map((p) => ({ ...p })),
});

const inBounds = (state, c, r) => c >= 0 && c < state.cols && r >= 0 && r < state.rows;
const pieceAt = (state, c, r) => state.pieces.find((p) => p.c === c && p.r === r);

/** Dark squares are those with even (col+row) parity (centre + corners on 3x3). */
export const isDark = (c, r) => (c + r) % 2 === 0;
/** The geometric centre square (only meaningful on odd-sized boards). */
export const isCentre = (state, c, r) => c === (state.cols - 1) / 2 && r === (state.rows - 1) / 2;

const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ALL8 = [...ORTHO, ...DIAG];
const KNIGHT_STEPS = [
  [1, 2], [2, 1], [-1, 2], [-2, 1],
  [1, -2], [2, -1], [-1, -2], [-2, -1],
];

/** Squares this piece may legally move to (all empty, per chess movement). */
export function legalMoves(state, piece) {
  const out = [];
  const pushIfEmpty = (c, r) => {
    if (inBounds(state, c, r) && !pieceAt(state, c, r)) out.push({ c, r });
  };

  switch (piece.type) {
    case PIECE.KING:
      for (const [dc, dr] of ALL8) pushIfEmpty(piece.c + dc, piece.r + dr);
      break;

    case PIECE.KNIGHT:
      for (const [dc, dr] of KNIGHT_STEPS) {
        const c = piece.c + dc;
        const r = piece.r + dr;
        // Knight jumps over pieces but may never land on the centre square.
        if (inBounds(state, c, r) && !pieceAt(state, c, r) && !isCentre(state, c, r)) {
          out.push({ c, r });
        }
      }
      break;

    default: {
      // Sliding pieces: walk each ray, collecting empty squares until blocked.
      const rays =
        piece.type === PIECE.ROOK ? ORTHO : piece.type === PIECE.BISHOP ? DIAG : ALL8;
      for (const [dc, dr] of rays) {
        let c = piece.c + dc;
        let r = piece.r + dr;
        while (inBounds(state, c, r) && !pieceAt(state, c, r)) {
          // Bishop must remain on dark squares (diagonal motion preserves this,
          // but we enforce it explicitly for safety).
          if (piece.type !== PIECE.BISHOP || isDark(c, r)) out.push({ c, r });
          c += dc;
          r += dr;
        }
      }
    }
  }
  return out;
}

/** Every legal move on the board, as { pieceId, from, to }. */
export function allMoves(state) {
  const moves = [];
  for (const piece of state.pieces) {
    for (const to of legalMoves(state, piece)) {
      moves.push({ pieceId: piece.id, from: { c: piece.c, r: piece.r }, to });
    }
  }
  return moves;
}

/** Move a piece onto an empty square. Mutates and returns the state. */
export function applyMove(state, move) {
  const mover = state.pieces.find((p) => p.id === move.pieceId);
  mover.c = move.to.c;
  mover.r = move.to.r;
  return state;
}

/** True when each piece sits on the square the goal marks for its type. */
export function isSolved(state, goal) {
  return goal.every((g) => state.pieces.some((p) => p.type === g.type && p.c === g.c && p.r === g.r));
}

/** Pieces of the given type currently sitting on their goal square. */
export function piecesOnGoal(state, goal) {
  const done = new Set();
  for (const g of goal) {
    const p = state.pieces.find((x) => x.type === g.type && x.c === g.c && x.r === g.r);
    if (p) done.add(p.id);
  }
  return done;
}
