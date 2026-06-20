// Core rules engine for "The Royal Study".
//
// The game is a solitaire-chess study: every move MUST capture another piece,
// and the study is solved when a single piece remains. Pieces move exactly as
// in chess. Colour is irrelevant for capturing (any piece may capture any
// other), which is the classic solitaire-chess convention.

export const PIECE = Object.freeze({
  KING: 'K',
  QUEEN: 'Q',
  ROOK: 'R',
  BISHOP: 'B',
  KNIGHT: 'N',
  PAWN: 'P',
});

let _uid = 0;
const nextId = () => `p${++_uid}`;

/** Build a fresh, mutable game state from a puzzle definition. */
export function createState(puzzle) {
  return {
    cols: puzzle.cols,
    rows: puzzle.rows,
    pieces: puzzle.pieces.map((p) => ({ id: nextId(), type: p.type, c: p.c, r: p.r })),
  };
}

export const cloneState = (state) => ({
  cols: state.cols,
  rows: state.rows,
  pieces: state.pieces.map((p) => ({ ...p })),
});

const inBounds = (state, c, r) => c >= 0 && c < state.cols && r >= 0 && r < state.rows;
const pieceAt = (state, c, r) => state.pieces.find((p) => p.c === c && p.r === r);

const SLIDERS = {
  [PIECE.ROOK]: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  [PIECE.BISHOP]: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  [PIECE.QUEEN]: [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ],
};
const KING_STEPS = SLIDERS[PIECE.QUEEN];
const KNIGHT_STEPS = [
  [1, 2], [2, 1], [-1, 2], [-2, 1],
  [1, -2], [2, -1], [-1, -2], [-2, -1],
];

/**
 * All squares the given piece can legally CAPTURE on (i.e. squares currently
 * occupied by another piece and reachable per chess movement). Returns an
 * array of { c, r, targetId }.
 */
export function captureTargets(state, piece) {
  const out = [];
  const add = (c, r) => {
    const t = pieceAt(state, c, r);
    if (t && t.id !== piece.id) out.push({ c, r, targetId: t.id });
  };

  switch (piece.type) {
    case PIECE.KNIGHT:
      for (const [dc, dr] of KNIGHT_STEPS) {
        const c = piece.c + dc;
        const r = piece.r + dr;
        if (inBounds(state, c, r)) add(c, r);
      }
      break;

    case PIECE.KING:
      for (const [dc, dr] of KING_STEPS) {
        const c = piece.c + dc;
        const r = piece.r + dr;
        if (inBounds(state, c, r)) add(c, r);
      }
      break;

    case PIECE.PAWN:
      // Pawns capture diagonally "forward" (toward higher rows).
      for (const dc of [-1, 1]) {
        const c = piece.c + dc;
        const r = piece.r + 1;
        if (inBounds(state, c, r)) add(c, r);
      }
      break;

    default: {
      // Sliding pieces: walk each ray until we hit the first occupied square.
      const rays = SLIDERS[piece.type] || [];
      for (const [dc, dr] of rays) {
        let c = piece.c + dc;
        let r = piece.r + dr;
        while (inBounds(state, c, r)) {
          const t = pieceAt(state, c, r);
          if (t) {
            if (t.id !== piece.id) out.push({ c, r, targetId: t.id });
            break; // ray is blocked beyond the first piece
          }
          c += dc;
          r += dr;
        }
      }
    }
  }
  return out;
}

/** Every capturing move available to any piece on the board. */
export function allMoves(state) {
  const moves = [];
  for (const piece of state.pieces) {
    for (const t of captureTargets(state, piece)) {
      moves.push({ pieceId: piece.id, from: { c: piece.c, r: piece.r }, to: { c: t.c, r: t.r }, targetId: t.targetId });
    }
  }
  return moves;
}

/**
 * Apply a capture: the moving piece lands on the target square and the captured
 * piece is removed. Mutates and returns the state. Assumes the move is legal.
 */
export function applyMove(state, move) {
  const mover = state.pieces.find((p) => p.id === move.pieceId);
  state.pieces = state.pieces.filter((p) => p.id !== move.targetId);
  mover.c = move.to.c;
  mover.r = move.to.r;
  return state;
}

export const isSolved = (state) => state.pieces.length === 1;

/** Solved is impossible once no capture exists with >1 piece left. */
export const isStuck = (state) => state.pieces.length > 1 && allMoves(state).length === 0;
