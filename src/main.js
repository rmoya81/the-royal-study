// Controller: wires the rules engine, the 3D studio and the HUD together.
import './style.css';
import { LEVELS } from './game/puzzles.js';
import {
  createState,
  cloneState,
  legalMoves,
  applyMove,
  isSolved,
} from './game/engine.js';
import { hintMove } from './game/solver.js';
import { Studio } from './three/scene.js';

const $ = (id) => document.getElementById(id);

const ui = {
  level: $('stat-level'),
  puzzle: $('stat-puzzle'),
  moves: $('stat-moves'),
  par: $('stat-par'),
  time: $('stat-time'),
  score: $('stat-score'),
  banner: $('banner'),
  loader: $('loader'),
};

const studio = new Studio($('scene'));

const game = {
  li: 0, // level index
  pi: 0, // puzzle index
  state: null,
  goal: null,
  par: 0,
  moves: 0,
  score: 0,
  history: [],
  selected: null,
  solved: false,
  timeLeft: 0,
  timerId: null,
};

const currentPuzzle = () => LEVELS[game.li].puzzles[game.pi];
// Generous time budget that scales with the study's difficulty (the hourglass).
const timeBudget = (par) => par * 12 + 25;

function loadPuzzle() {
  const puzzle = currentPuzzle();
  game.state = createState(puzzle);
  game.goal = puzzle.goal;
  game.par = puzzle.par;
  game.moves = 0;
  game.history = [];
  game.selected = null;
  game.solved = false;

  studio.loadPosition(game.state);
  studio.showGoal(game.goal);
  refreshGoalProgress();
  startTimer(timeBudget(game.par));
  refreshHud();
  banner(`Estudio ${game.pi + 1} · ${LEVELS[game.li].name} — coloca las piezas en las siluetas doradas`, 'info', 2200);
}

function refreshHud() {
  ui.level.textContent = LEVELS[game.li].name;
  ui.puzzle.textContent = `${game.pi + 1}/${LEVELS[game.li].puzzles.length}`;
  ui.moves.textContent = String(game.moves);
  ui.par.textContent = String(game.par);
  ui.score.textContent = String(game.score);
}

function refreshGoalProgress() {
  const satisfied = game.goal.filter((g) =>
    game.state.pieces.some((p) => p.type === g.type && p.c === g.c && p.r === g.r),
  );
  studio.updateGoalProgress(satisfied);
}

// --- hourglass timer -------------------------------------------------------

function startTimer(seconds) {
  stopTimer();
  game.timeLeft = seconds;
  renderTime();
  game.timerId = setInterval(() => {
    game.timeLeft -= 1;
    renderTime();
    if (game.timeLeft <= 0) onTimeUp();
  }, 1000);
}

function stopTimer() {
  if (game.timerId) clearInterval(game.timerId);
  game.timerId = null;
}

function renderTime() {
  const t = Math.max(0, game.timeLeft);
  const m = Math.floor(t / 60);
  const s = String(t % 60).padStart(2, '0');
  ui.time.textContent = `${m}:${s}`;
  ui.time.style.color = t <= 10 ? '#f0795a' : '';
}

function onTimeUp() {
  stopTimer();
  banner('⏳ ¡Se acabó el tiempo! Reiniciando el estudio…', 'warn', 2200);
  setTimeout(() => reset(), 1400);
}

// --- interaction -----------------------------------------------------------

studio.onPickPiece = (id) => {
  if (studio.busy || game.solved) return;
  const piece = game.state.pieces.find((p) => p.id === id);
  if (!piece) return;
  const moves = legalMoves(game.state, piece);
  if (moves.length === 0) {
    banner('Esa pieza no tiene movimientos disponibles', 'warn', 1200);
    return;
  }
  game.selected = id;
  studio.select(id);
  studio.showTargets(moves);
};

studio.onPickSquare = (c, r) => {
  if (studio.busy || game.solved || !game.selected) return;
  const piece = game.state.pieces.find((p) => p.id === game.selected);
  if (!piece) return;
  const ok = legalMoves(game.state, piece).some((t) => t.c === c && t.r === r);
  if (!ok) {
    game.selected = null;
    studio.select(null);
    studio.clearMarkers();
    return;
  }
  doMove({ pieceId: piece.id, from: { c: piece.c, r: piece.r }, to: { c, r } });
};

async function doMove(move) {
  game.history.push(cloneState(game.state));
  studio.clearMarkers();
  studio.select(null);
  game.selected = null;

  await studio.animateMove(move);
  applyMove(game.state, move);
  game.moves += 1;
  refreshGoalProgress();
  refreshHud();

  if (isSolved(game.state, game.goal)) onSolved();
}

function onSolved() {
  game.solved = true;
  stopTimer();
  const onPar = game.moves <= game.par;
  const gained = onPar ? 2 : 1;
  game.score += gained;
  refreshHud();
  banner(
    onPar
      ? `¡Resuelto en el mínimo de ${game.par} jugadas! +${gained} puntos ♛`
      : `¡Resuelto en ${game.moves} jugadas (mínimo ${game.par})! +${gained} punto`,
    'win',
  );
  setTimeout(() => {
    if (!goNext()) banner('¡Has completado todos los estudios! 🏆', 'win');
  }, 1900);
}

// --- navigation ------------------------------------------------------------

function goNext() {
  const lvl = LEVELS[game.li];
  if (game.pi < lvl.puzzles.length - 1) game.pi += 1;
  else if (game.li < LEVELS.length - 1) {
    game.li += 1;
    game.pi = 0;
  } else return false;
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
  refreshGoalProgress();
  refreshHud();
}

function reset() {
  if (studio.busy) return;
  const puzzle = currentPuzzle();
  game.state = createState(puzzle);
  game.moves = 0;
  game.history = [];
  game.selected = null;
  game.solved = false;
  studio.resetPieces(game.state);
  refreshGoalProgress();
  startTimer(timeBudget(game.par));
  refreshHud();
  banner('Estudio reiniciado ⟳', 'info', 1100);
}

function hint() {
  if (studio.busy || game.solved) return;
  const move = hintMove(game.state, game.goal);
  if (!move) {
    banner('No hay solución desde aquí — reinicia ⟳', 'warn', 2200);
    return;
  }
  studio.select(move.pieceId);
  studio.flashSquare(move.from.c, move.from.r, 0x4a90d9);
  studio.flashSquare(move.to.c, move.to.r, 0x57c785);
  banner('Pista: mueve la pieza resaltada a la casilla verde', 'info', 2400);
  setTimeout(() => {
    if (!game.solved) {
      studio.select(null);
      studio.clearMarkers();
    }
  }, 2400);
}

// --- buttons & keys --------------------------------------------------------

$('btn-undo').onclick = undo;
$('btn-reset').onclick = reset;
$('btn-hint').onclick = hint;
$('btn-next').onclick = goNext;
$('btn-prev').onclick = goPrev;
$('btn-help').onclick = () => ($('help').hidden = false);
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

let bannerTimer = null;
function banner(text, kind = 'info', ms = 0) {
  ui.banner.textContent = text;
  ui.banner.className = `banner banner--show banner--${kind}`;
  clearTimeout(bannerTimer);
  if (ms) bannerTimer = setTimeout(() => (ui.banner.className = 'banner'), ms);
}

// --- boot ------------------------------------------------------------------

loadPuzzle();
requestAnimationFrame(() => {
  setTimeout(() => ui.loader.classList.add('loader--hidden'), 350);
});
