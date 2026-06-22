// Controller: wires the rules engine, the 3D studio and the HUD together, with
// a solo campaign (incl. card transforms on levels 2/3) and a 2-player bidding
// mode where pieces carry over between rounds.
import './style.css';
import { LEVELS, DUO } from './game/puzzles.js';
import {
  createState,
  cloneState,
  legalMoves,
  applyMove,
  isSolved,
} from './game/engine.js';
import { hintMove, bestPlan } from './game/solver.js';
import {
  applyRotateCW,
  applyRotateCCW,
  applyMirrorH,
  applyMirrorV,
} from './game/transforms.js';
import { Studio } from './three/scene.js';

const $ = (id) => document.getElementById(id);
const studio = new Studio($('scene'));

const sig = (pieces) => pieces.map((p) => `${p.type}${p.c},${p.r}`).sort().join('|');

// Shared game state across both modes.
const g = {
  mode: 'solo',
  board: null, // engine state currently on the board
  goal: null, // current (possibly transformed) goal
  baseGoal: null, // upright goal before transforms
  transforms: 'none', // 'none' | 'rot' | 'all'
  moves: 0,
  selected: null,
  locked: false, // input locked (round/study over or during transitions)
  history: [],
  timeLeft: 0,
  timerId: null,
  // solo
  li: 0,
  pi: 0,
  par: 0,
  score: 0,
  // duo
  duo: {
    s1: 0,
    s2: 0,
    bid: 0,
    bid1: 0,
    holder: 1,
    par: 0,
    phase: null, // 'bid1' | 'bid2' | 'lower' | 'solve'
    roundStart: null, // arrangement the holder solves from
    carry: null, // carry-over arrangement between rounds
  },
};

// ===========================================================================
//  HUD helpers
// ===========================================================================

let bannerTimer = null;
function banner(text, kind = 'info', ms = 0) {
  const el = $('banner');
  el.textContent = text;
  el.className = `banner banner--show banner--${kind}`;
  clearTimeout(bannerTimer);
  if (ms) bannerTimer = setTimeout(() => (el.className = 'banner'), ms);
}

function refreshGoalProgress() {
  const satisfied = g.goal.filter((t) =>
    g.board.pieces.some((p) => p.type === t.type && p.c === t.c && p.r === t.r),
  );
  studio.updateGoalProgress(satisfied);
}

// ===========================================================================
//  Hourglass timer
// ===========================================================================

function startTimer(seconds) {
  stopTimer();
  g.timeLeft = seconds;
  renderTime();
  g.timerId = setInterval(() => {
    g.timeLeft -= 1;
    renderTime();
    if (g.timeLeft <= 0) onTimeUp();
  }, 1000);
}
function stopTimer() {
  if (g.timerId) clearInterval(g.timerId);
  g.timerId = null;
}
function renderTime() {
  const t = Math.max(0, g.timeLeft);
  const txt = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  const el = g.mode === 'solo' ? $('stat-time') : $('duo-time');
  el.textContent = txt;
  el.style.color = t <= 10 ? '#f0795a' : '';
}
function onTimeUp() {
  stopTimer();
  if (g.mode === 'solo') {
    banner('⏳ ¡Se acabó el tiempo! Reiniciando el estudio…', 'warn', 2200);
    setTimeout(() => resetStudy(), 1400);
  } else {
    banner('⏳ ¡Tiempo agotado!', 'warn', 1600);
    setTimeout(() => duoResolve(false), 1100);
  }
}

// ===========================================================================
//  Board interaction (shared)
// ===========================================================================

studio.onPickPiece = (id) => {
  if (studio.busy || g.locked) return;
  const piece = g.board.pieces.find((p) => p.id === id);
  if (!piece) return;
  const moves = legalMoves(g.board, piece);
  if (!moves.length) {
    banner('Esa pieza no tiene movimientos disponibles', 'warn', 1200);
    return;
  }
  g.selected = id;
  studio.select(id);
  studio.showTargets(moves);
};

studio.onPickSquare = (c, r) => {
  if (studio.busy || g.locked || !g.selected) return;
  const piece = g.board.pieces.find((p) => p.id === g.selected);
  if (!piece) return;
  if (!legalMoves(g.board, piece).some((t) => t.c === c && t.r === r)) {
    g.selected = null;
    studio.select(null);
    studio.clearMarkers();
    return;
  }
  doMove({ pieceId: piece.id, from: { c: piece.c, r: piece.r }, to: { c, r } });
};

async function doMove(move) {
  g.history.push(cloneState(g.board));
  studio.clearMarkers();
  studio.select(null);
  g.selected = null;

  await studio.animateMove(move);
  applyMove(g.board, move);
  g.moves += 1;
  refreshGoalProgress();
  refreshHud();
  checkAfterAction();
}

// A transform of the goal card. `kind` ∈ cw|ccw|h|v. Costs one move.
function transformCard(kind) {
  if (g.locked || studio.busy) return;
  if (g.transforms === 'none') return;
  if ((kind === 'h' || kind === 'v') && g.transforms !== 'all') return;
  const fn = { cw: applyRotateCW, ccw: applyRotateCCW, h: applyMirrorH, v: applyMirrorV }[kind];
  g.history.push(cloneState(g.board));
  g.goal = fn(g.goal);
  g.moves += 1;
  studio.showGoal(g.goal);
  refreshGoalProgress();
  refreshHud();
  checkAfterAction();
}

function checkAfterAction() {
  if (isSolved(g.board, g.goal)) {
    if (g.mode === 'solo') onSoloSolved();
    else duoResolve(true);
    return;
  }
  if (g.mode === 'duo' && g.moves > g.duo.bid) {
    banner(`Superaste las ${g.duo.bid} jugadas apostadas`, 'warn', 1800);
    setTimeout(() => duoResolve(false), 900);
  }
}

// ===========================================================================
//  SOLO mode
// ===========================================================================

const currentPuzzle = () => LEVELS[g.li].puzzles[g.pi];
const timeBudget = (par) => par * 12 + 25;

function loadStudy() {
  const pz = currentPuzzle();
  g.board = createState(pz);
  g.baseGoal = pz.goal.map((x) => ({ ...x }));
  g.goal = pz.goal.map((x) => ({ ...x }));
  g.transforms = pz.transforms || 'none';
  g.par = pz.par;
  g.moves = 0;
  g.history = [];
  g.selected = null;
  g.locked = false;

  studio.loadPosition(g.board);
  studio.showGoal(g.goal);
  refreshGoalProgress();
  updateToolbar();
  startTimer(timeBudget(g.par));
  refreshHud();
  const hint = g.transforms !== 'none' ? ' · puedes girar/reflejar la carta' : '';
  banner(`Estudio ${g.pi + 1} · ${LEVELS[g.li].name}${hint}`, 'info', 2400);
}

function onSoloSolved() {
  g.locked = true;
  stopTimer();
  const onPar = g.moves <= g.par;
  const gained = onPar ? 2 : 1;
  g.score += gained;
  refreshHud();
  banner(
    onPar
      ? `¡Resuelto en el mínimo de ${g.par} jugadas! +${gained} puntos ♛`
      : `¡Resuelto en ${g.moves} (mínimo ${g.par})! +${gained} punto`,
    'win',
  );
  setTimeout(() => {
    if (!goNext()) banner('¡Has completado todos los estudios! 🏆', 'win');
  }, 1900);
}

function goNext() {
  const lvl = LEVELS[g.li];
  if (g.pi < lvl.puzzles.length - 1) g.pi += 1;
  else if (g.li < LEVELS.length - 1) {
    g.li += 1;
    g.pi = 0;
  } else return false;
  loadStudy();
  return true;
}
function goPrev() {
  if (g.pi > 0) g.pi -= 1;
  else if (g.li > 0) {
    g.li -= 1;
    g.pi = LEVELS[g.li].puzzles.length - 1;
  } else return;
  loadStudy();
}

function resetStudy() {
  if (studio.busy) return;
  const pz = currentPuzzle();
  g.board = createState(pz);
  g.goal = pz.goal.map((x) => ({ ...x }));
  g.moves = 0;
  g.history = [];
  g.selected = null;
  g.locked = false;
  studio.resetPieces(g.board);
  studio.showGoal(g.goal);
  refreshGoalProgress();
  startTimer(timeBudget(g.par));
  refreshHud();
  banner('Estudio reiniciado ⟳', 'info', 1100);
}

function hint() {
  if (studio.busy || g.locked || g.mode !== 'solo') return;
  const plan = bestPlan(g.board, g.goal, 'none'); // hint for the current orientation
  const move = plan ? hintMove(g.board, g.goal) : null;
  if (!move) {
    banner('No hay solución para esta orientación — prueba a girar/reflejar o reinicia', 'warn', 2600);
    return;
  }
  studio.select(move.pieceId);
  studio.flashSquare(move.from.c, move.from.r, 0x4a90d9);
  studio.flashSquare(move.to.c, move.to.r, 0x57c785);
  banner('Pista: mueve la pieza resaltada a la casilla verde', 'info', 2400);
  setTimeout(() => {
    if (!g.locked) {
      studio.select(null);
      studio.clearMarkers();
    }
  }, 2400);
}

function refreshHud() {
  if (g.mode === 'solo') {
    $('stat-level').textContent = LEVELS[g.li].name;
    $('stat-puzzle').textContent = `${g.pi + 1}/${LEVELS[g.li].puzzles.length}`;
    $('stat-moves').textContent = String(g.moves);
    $('stat-par').textContent = String(g.par);
    $('stat-score').textContent = String(g.score);
  } else {
    $('duo-s1').textContent = String(g.duo.s1);
    $('duo-s2').textContent = String(g.duo.s2);
    $('duo-bid').textContent = g.duo.bid ? String(g.duo.bid) : '—';
    $('duo-moves').textContent = String(g.moves);
  }
}

// ===========================================================================
//  DUO mode (bidding, carry-over, first to 6 points)
// ===========================================================================

const DUO_MODE = 'all'; // full transforms allowed in duo

function startDuo() {
  g.mode = 'duo';
  g.transforms = DUO_MODE;
  g.duo.s1 = 0;
  g.duo.s2 = 0;
  g.duo.carry = DUO.cards[Math.floor(Math.random() * DUO.cards.length)].map((x) => ({ ...x }));
  $('stats-solo').hidden = true;
  $('stats-duo').hidden = false;
  $('mode-solo').classList.remove('chip--on');
  $('mode-duo').classList.add('chip--on');
  updateToolbar();
  nextDuoRound();
}

function startSolo() {
  g.mode = 'solo';
  stopTimer();
  $('stats-solo').hidden = false;
  $('stats-duo').hidden = true;
  $('mode-duo').classList.remove('chip--on');
  $('mode-solo').classList.add('chip--on');
  $('bid').hidden = true;
  loadStudy();
}

function drawDuoGoal(startArr) {
  const startState = createState({ cols: 3, rows: 3, start: startArr });
  const deck = [...DUO.cards].sort(() => Math.random() - 0.5);
  for (const card of deck) {
    if (sig(card) === sig(startArr)) continue;
    const plan = bestPlan(startState, card, DUO_MODE);
    if (plan && plan.par >= 2 && plan.par <= 9) return { goal: card, par: plan.par };
  }
  return null;
}

function nextDuoRound() {
  const startArr = g.duo.carry;
  const drawn = drawDuoGoal(startArr);
  if (!drawn) {
    // Fallback: reshuffle a fresh start.
    g.duo.carry = DUO.cards[Math.floor(Math.random() * DUO.cards.length)].map((x) => ({ ...x }));
    return nextDuoRound();
  }
  g.duo.roundStart = startArr.map((x) => ({ ...x }));
  g.board = createState({ cols: 3, rows: 3, start: startArr });
  g.baseGoal = drawn.goal.map((x) => ({ ...x }));
  g.goal = drawn.goal.map((x) => ({ ...x }));
  g.duo.par = drawn.par;
  g.duo.bid = 0;
  g.duo.bid1 = 0;
  g.moves = 0;
  g.history = [];
  g.locked = true;

  studio.loadPosition(g.board);
  studio.showGoal(g.goal);
  refreshGoalProgress();
  refreshHud();
  openBid('bid1');
}

// --- bidding overlay -------------------------------------------------------

let bidValue = 3;
function setBid(v) {
  bidValue = Math.max(1, Math.min(20, v));
  $('bid-value').textContent = String(bidValue);
}

function openBid(phase) {
  g.duo.phase = phase;
  const card = $('bid');
  const accept = $('bid-accept');
  const lower = $('bid-lower');
  const confirm = $('bid-confirm');
  const stepper = document.querySelector('.bid__stepper');

  if (phase === 'bid1') {
    $('bid-title').textContent = 'Jugador 1 — apuesta';
    $('bid-text').textContent = `¿En cuántas jugadas resuelves la carta? (óptimo posible: ${g.duo.par})`;
    setBid(g.duo.par);
    stepper.style.display = '';
    confirm.hidden = false;
    accept.hidden = true;
    lower.hidden = true;
  } else if (phase === 'bid2') {
    $('bid-title').textContent = 'Jugador 2 — responde';
    $('bid-text').textContent = `El Jugador 1 apuesta ${g.duo.bid1} jugadas. ¿Lo aceptas o puedes en menos?`;
    stepper.style.display = 'none';
    confirm.hidden = true;
    accept.hidden = false;
    lower.hidden = g.duo.bid1 <= 1; // can't underbid below 1
  } else if (phase === 'lower') {
    $('bid-title').textContent = 'Jugador 2 — apuesta menor';
    $('bid-text').textContent = `Debe ser menos de ${g.duo.bid1}.`;
    setBid(g.duo.bid1 - 1);
    stepper.style.display = '';
    confirm.hidden = false;
    accept.hidden = true;
    lower.hidden = true;
  }
  card.hidden = false;
}

function closeBid() {
  $('bid').hidden = true;
}

function onBidConfirm() {
  if (g.duo.phase === 'bid1') {
    g.duo.bid1 = bidValue;
    openBid('bid2');
  } else if (g.duo.phase === 'lower') {
    if (bidValue >= g.duo.bid1) return;
    g.duo.bid = bidValue;
    g.duo.holder = 2;
    beginDuoSolve();
  }
}
function onBidAccept() {
  g.duo.bid = g.duo.bid1;
  g.duo.holder = 1;
  beginDuoSolve();
}
function onBidLower() {
  openBid('lower');
}

function beginDuoSolve() {
  closeBid();
  // Solve from the round's start position.
  g.board = createState({ cols: 3, rows: 3, start: g.duo.roundStart });
  g.goal = g.baseGoal.map((x) => ({ ...x }));
  g.moves = 0;
  g.history = [];
  g.selected = null;
  g.locked = false;
  studio.loadPosition(g.board);
  studio.showGoal(g.goal);
  refreshGoalProgress();
  updateToolbar();
  startTimer(g.duo.bid * 14 + 20);
  refreshHud();
  banner(`Jugador ${g.duo.holder}: resuelve en ${g.duo.bid} jugada(s) o menos`, 'info', 2600);
}

function duoResolve(success) {
  if (g.locked && g.duo.phase === 'done') return;
  g.locked = true;
  g.duo.phase = 'done';
  stopTimer();
  studio.clearMarkers();
  studio.select(null);

  const holder = g.duo.holder;
  const winner = success ? holder : holder === 1 ? 2 : 1;
  if (winner === 1) g.duo.s1 += 1;
  else g.duo.s2 += 1;
  refreshHud();

  banner(
    success
      ? `¡Jugador ${holder} lo logra en ${g.moves}! Punto para el Jugador ${winner} 🏆`
      : `Jugador ${holder} no lo consigue. Punto para el Jugador ${winner}`,
    success ? 'win' : 'warn',
  );

  // Pieces stay where they ended (carry over to the next round).
  g.duo.carry = g.board.pieces.map((p) => ({ type: p.type, c: p.c, r: p.r }));

  setTimeout(() => {
    if (g.duo.s1 >= 6 || g.duo.s2 >= 6) {
      const champ = g.duo.s1 >= 6 ? 1 : 2;
      banner(`🏆 ¡El Jugador ${champ} gana la partida ${g.duo.s1}–${g.duo.s2}!`, 'win');
      g.duo.s1 = 0;
      g.duo.s2 = 0;
      setTimeout(() => {
        g.duo.carry = DUO.cards[Math.floor(Math.random() * DUO.cards.length)].map((x) => ({ ...x }));
        nextDuoRound();
      }, 3200);
    } else {
      nextDuoRound();
    }
  }, 2400);
}

// ===========================================================================
//  Toolbar visibility per mode / level
// ===========================================================================

function updateToolbar() {
  const t = g.transforms;
  $('transform-group').hidden = t === 'none';
  $('btn-mir-h').style.display = t === 'all' ? '' : 'none';
  $('btn-mir-v').style.display = t === 'all' ? '' : 'none';

  const duo = g.mode === 'duo';
  $('btn-hint').style.display = duo ? 'none' : '';
  $('btn-prev').style.display = duo ? 'none' : '';
  $('btn-next').style.display = duo ? 'none' : '';
  $('btn-concede').hidden = !duo;
}

// ===========================================================================
//  Buttons & keys
// ===========================================================================

$('btn-undo').onclick = () => {
  if (studio.busy || !g.history.length || g.locked) return;
  g.board = g.history.pop();
  g.moves = Math.max(0, g.moves - 1);
  g.selected = null;
  // Note: undo does not revert a card transform's orientation; it reverts the
  // last board state. Re-show the current goal to stay consistent.
  studio.resetPieces(g.board);
  studio.showGoal(g.goal);
  refreshGoalProgress();
  refreshHud();
};
$('btn-reset').onclick = () => {
  if (g.mode === 'solo') resetStudy();
  else beginDuoSolve();
};
$('btn-hint').onclick = hint;
$('btn-next').onclick = goNext;
$('btn-prev').onclick = goPrev;
$('btn-concede').onclick = () => {
  if (g.mode === 'duo' && !g.locked) duoResolve(false);
};
// Help modal — tied to browser history so the Back button (or back gesture)
// closes the help instead of leaving the site.
function openHelp() {
  if (!$('help').hidden) return;
  $('help').hidden = false;
  history.pushState({ modal: 'help' }, '');
}
function closeHelp() {
  if ($('help').hidden) return;
  $('help').hidden = true;
  // Unwind the history entry we added when opening (if it's still on top).
  if (history.state && history.state.modal === 'help') history.back();
}
$('btn-help').onclick = openHelp;
$('help-close').onclick = closeHelp;
window.addEventListener('popstate', () => {
  // Any back navigation first dismisses the help overlay if it's open.
  if (!$('help').hidden) $('help').hidden = true;
});

$('btn-rot-cw').onclick = () => transformCard('cw');
$('btn-rot-ccw').onclick = () => transformCard('ccw');
$('btn-mir-h').onclick = () => transformCard('h');
$('btn-mir-v').onclick = () => transformCard('v');

$('mode-solo').onclick = () => g.mode !== 'solo' && startSolo();
$('mode-duo').onclick = () => g.mode !== 'duo' && startDuo();

$('bid-minus').onclick = () => setBid(bidValue - 1);
$('bid-plus').onclick = () => setBid(bidValue + 1);
$('bid-confirm').onclick = onBidConfirm;
$('bid-accept').onclick = onBidAccept;
$('bid-lower').onclick = onBidLower;

window.addEventListener('keydown', (e) => {
  if (!$('bid').hidden) return; // don't capture keys during bidding
  switch (e.key.toLowerCase()) {
    case 'u': $('btn-undo').click(); break;
    case 'r': $('btn-reset').click(); break;
    case 'h': hint(); break;
    case 'arrowright': if (g.mode === 'solo') goNext(); break;
    case 'arrowleft': if (g.mode === 'solo') goPrev(); break;
    case '?': openHelp(); break;
    case 'escape': closeHelp(); break;
  }
});

// ===========================================================================
//  Boot
// ===========================================================================

// Load the GLB piece set first (falls back to procedural pieces on failure),
// then start the first study and reveal the scene.
studio
  .loadModels(`${import.meta.env.BASE_URL}models/pieces.glb`)
  .finally(() => {
    loadStudy();
    requestAnimationFrame(() => {
      setTimeout(() => $('loader').classList.add('loader--hidden'), 350);
    });
  });
