// Controller: wires the rules engine, the 3D studio and the HUD together.
import './style.css';
import { LEVELS } from './game/puzzles.js';
import {
  createState,
  cloneState,
  captureTargets,
  applyMove,
  isSolved,
  isStuck,
} from './game/engine.js';
import { hintMove } from './game/solver.js';
import { Studio } from './three/scene.js';

const $ = (id) => document.getElementById(id);

const ui = {
  level: $('stat-level'),
  puzzle: $('stat-puzzle'),
  moves: $('stat-moves'),
  par: $('stat-par'),
  score: $('stat-score'),
  banner: $('banner'),
  loader: $('loader'),
};

const studio = new Studio($('scene'));

const game = {
  li: 0, // level index
  pi: 0, // puzzle index
  state: null,
  par: 0,
  moves: 0,
  score: 0,
  history: [], // snapshots for undo
  selected: null,
  solved: false,
};

function currentPuzzle() {
  return LEVELS[game.li].puzzles[game.pi];
}

function loadPuzzle(reframe = true) {
  const puzzle = currentPuzzle();
  game.state = createState(puzzle);
  game.par = puzzle.par;
  game.moves = 0;
  game.history = [];
  game.selected = null;
  game.solved = false;

  studio.loadPosition(game.state);
  if (!reframe) {/* loadPosition reframes; fine for first load */}
  refreshHud();
  banner(`Estudio ${game.pi + 1} · ${LEVELS[game.li].name}`, 'info', 1600);
}

function refreshHud() {
  ui.level.textContent = LEVELS[game.li].name;
  ui.puzzle.textContent = `${game.pi + 1}/${LEVELS[game.li].puzzles.length}`;
  ui.moves.textContent = String(game.moves);
  ui.par.textContent = String(game.par);
  ui.score.textContent = String(game.score);
}

let bannerTimer = null;
function banner(text, kind = 'info', ms = 0) {
  ui.banner.textContent = text;
  ui.banner.className = `banner banner--show banner--${kind}`;
  clearTimeout(bannerTimer);
  if (ms) bannerTimer = setTimeout(() => (ui.banner.className = 'banner'), ms);
}

// --- interaction -----------------------------------------------------------

studio.onPickPiece = (id) => {
  if (studio.busy || game.solved) return;
  const piece = game.state.pieces.find((p) => p.id === id);
  if (!piece) return;
  const targets = captureTargets(game.state, piece);
  if (targets.length === 0) {
    banner('Esa pieza no puede capturar', 'warn', 1200);
    return;
  }
  game.selected = id;
  studio.select(id);
  studio.showTargets(targets);
};

studio.onPickSquare = (c, r) => {
  if (studio.busy || game.solved || !game.selected) return;
  const piece = game.state.pieces.find((p) => p.id === game.selected);
  if (!piece) return;
  const target = captureTargets(game.state, piece).find((t) => t.c === c && t.r === r);
  if (!target) {
    // Clicked elsewhere: deselect.
    game.selected = null;
    studio.select(null);
    studio.clearMarkers();
    return;
  }
  doMove({ pieceId: piece.id, from: { c: piece.c, r: piece.r }, to: { c, r }, targetId: target.targetId });
};

async function doMove(move) {
  game.history.push(cloneState(game.state));
  studio.clearMarkers();
  studio.select(null);
  game.selected = null;

  await studio.animateMove(move);
  applyMove(game.state, move);
  game.moves += 1;
  refreshHud();

  if (isSolved(game.state)) return onSolved();
  if (isStuck(game.state)) {
    banner('Sin capturas posibles — usa Deshacer ↩', 'warn', 2600);
  }
}

function onSolved() {
  game.solved = true;
  const onPar = game.moves <= game.par;
  const gained = onPar ? 2 : 1;
  game.score += gained;
  refreshHud();
  banner(
    onPar
      ? `¡Estudio resuelto en el par! +${gained} puntos ♛`
      : `¡Resuelto! +${gained} punto`,
    'win',
  );
  setTimeout(() => {
    if (!autoNext()) banner('¡Has completado todos los estudios! 🏆', 'win');
  }, 1700);
}

// --- navigation ------------------------------------------------------------

function autoNext() {
  return goNext();
}

function goNext() {
  const lvl = LEVELS[game.li];
  if (game.pi < lvl.puzzles.length - 1) {
    game.pi += 1;
  } else if (game.li < LEVELS.length - 1) {
    game.li += 1;
    game.pi = 0;
  } else {
    return false;
  }
  loadPuzzle();
  return true;
}

function goPrev() {
  if (game.pi > 0) game.pi -= 1;
  else if (game.li > 0) {
    game.li -= 1;
    game.pi = LEVELS[game.li].puzzles.length - 1;
  } else return;
  loadPuzzle();
}

function undo() {
  if (studio.busy || !game.history.length) return;
  game.state = game.history.pop();
  game.moves = Math.max(0, game.moves - 1);
  game.solved = false;
  game.selected = null;
  studio.resetPieces(game.state);
  refreshHud();
}

function reset() {
  if (studio.busy) return;
  loadPuzzleSameView();
}

function loadPuzzleSameView() {
  const puzzle = currentPuzzle();
  game.state = createState(puzzle);
  game.moves = 0;
  game.history = [];
  game.selected = null;
  game.solved = false;
  studio.resetPieces(game.state);
  refreshHud();
  banner('Estudio reiniciado ⟳', 'info', 1100);
}

async function hint() {
  if (studio.busy || game.solved) return;
  const move = hintMove(game.state);
  if (!move) {
    banner('No hay solución desde aquí — reinicia ⟳', 'warn', 2200);
    return;
  }
  // Highlight the suggested piece and destination.
  studio.select(move.pieceId);
  studio.flashSquare(move.from.c, move.from.r, 0x4a90d9);
  studio.flashSquare(move.to.c, move.to.r, 0xffce4d);
  banner('Pista: mueve la pieza resaltada al destino dorado', 'info', 2400);
  setTimeout(() => {
    studio.select(null);
    studio.clearMarkers();
  }, 2400);
}

// --- buttons & keys --------------------------------------------------------

$('btn-undo').onclick = undo;
$('btn-reset').onclick = reset;
$('btn-hint').onclick = hint;
$('btn-next').onclick = goNext;
$('btn-prev').onclick = goPrev;
$('btn-help').onclick = () => $('help').hidden = false;
$('help-close').onclick = () => ($('help').hidden = true);

window.addEventListener('keydown', (e) => {
  switch (e.key.toLowerCase()) {
    case 'u': undo(); break;
    case 'r': reset(); break;
    case 'h': hint(); break;
    case 'arrowright': goNext(); break;
    case 'arrowleft': goPrev(); break;
    case '?': $('help').hidden = false; break;
    case 'escape': $('help').hidden = true; break;
  }
});

// --- boot ------------------------------------------------------------------

loadPuzzle();
// Reveal once the first frame is ready.
requestAnimationFrame(() => {
  setTimeout(() => ui.loader.classList.add('loader--hidden'), 350);
});
