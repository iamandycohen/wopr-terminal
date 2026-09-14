import { cities, result, bestMove } from "./game-core.js";
const $ = id => document.getElementById(id);
let phase, side, targets, timers = [], started = 0, sound = false, audio, squares, moves = [], gameOver;
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
function cancel() { timers.forEach(clearTimeout); timers = []; }
function beep(freq = 640) {
  if (!sound) return;
  try {
    audio ||= new AudioContext();
    audio.resume();
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = 'square'; osc.frequency.value = freq; gain.gain.setValueAtTime(.018, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .06);
    osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + .07);
  } catch { /* Audio is optional. */ }
}
function log(message, user = false) {
  const p = document.createElement('p'); p.textContent = message;
  if (user) p.className = 'user';
  $('log').append(p); $('log').scrollTop = $('log').scrollHeight; beep();
}
function choices(items) {
  $('suggestions').replaceChildren();
  for (const [label, command] of items) {
    const button = document.createElement('button'); button.textContent = label;
    button.addEventListener('click', () => submit(command)); $('suggestions').append(button);
  }
}
function reset() {
  cancel(); phase = 'greeting'; side = null; targets = []; started = 0; moves = [];
  $('log').replaceChildren(); $('tracks').replaceChildren(); $('board').hidden = true;
  $('side').textContent = 'UNASSIGNED'; $('track-count').textContent = '000';
  $('defcon').textContent = '5'; $('elapsed').textContent = '00:00:00';
  $('status').textContent = 'AWAITING INPUT'; $('map-status').textContent = 'GLOBAL SURVEILLANCE';
  $('command').value = ''; $('command').placeholder = 'TYPE A COMMAND';
  log('GREETINGS PROFESSOR FALKEN.');
  log('SHALL WE PLAY A GAME?');
  choices([['GLOBAL THERMONUCLEAR WAR', 'global thermonuclear war'], ['TIC-TAC-TOE', 'tic-tac-toe'], ['HELP', 'help']]);
}
function chooseSide() {
  cancel(); phase = 'side'; started = 0; $('board').hidden = true; $('tracks').replaceChildren();
  $('defcon').textContent = '5'; $('track-count').textContent = '000'; $('elapsed').textContent = '00:00:00';
  $('status').textContent = 'SELECT SIDE';
  $('side').textContent = 'UNASSIGNED'; $('map-status').textContent = 'GLOBAL SURVEILLANCE';
  log('SELECT YOUR SIDE:\n  1. UNITED STATES\n  2. SOVIET UNION');
  choices([['1 · UNITED STATES', '1'], ['2 · SOVIET UNION', '2']]);
}
function selectSide(value) {
  side = value; targets = []; phase = 'targets';
  $('side').textContent = side === 'USA' ? 'UNITED STATES' : 'SOVIET UNION';
  $('status').textContent = 'SELECT TARGETS';
  log('ENTER TARGET CITIES, SEPARATED BY COMMAS.\nAVAILABLE: ' + cities[enemy()].map(c => c[0]).join(', '));
  choices(cities[enemy()].slice(0, 3).map(c => [c[0], c[0]]));
}
function enemy() { return side === 'USA' ? 'USSR' : 'USA'; }
function point(city) { return [(city[1] + 180) * 3, (85 - city[2]) * 3]; }
function svg(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  $('tracks').append(el); return el;
}
function strike(from, to, hostile = false) {
  const [x, y] = point(from), [tx, ty] = point(to);
  svg('path', {d: `M${x},${y} Q${(x + tx) / 2},${Math.min(y, ty) - 110} ${tx},${ty}`, class: 'flight' + (hostile ? ' enemy' : ''), pathLength: 1000});
  svg('circle', {cx: x, cy: y, r: 3, fill: 'none', stroke: 'currentColor'});
  $('track-count').textContent = String(Number($('track-count').textContent) + 1).padStart(3, '0');
  later(() => { svg('circle', {cx: tx, cy: ty, r: 13, class: 'impact' + (hostile ? ' enemy' : '')}); beep(160); }, 5000);
}
function launch() {
  phase = 'war'; started = Date.now(); $('defcon').textContent = '3';
  $('status').textContent = 'LAUNCH DETECTED'; $('map-status').textContent = 'STRATEGIC EXCHANGE / LIVE TRACKING';
  log('SIMULATION RUNNING. INITIAL LAUNCH DETECTED.');
  targets.forEach((target, i) => later(() => strike(cities[side][i % 6], target), i * 600));
  choices([['ABORT', 'abort'], ['STATUS', 'status']]);
  later(() => { $('defcon').textContent = '2'; $('status').textContent = 'COUNTERSTRIKE'; log('OPPOSING FORCES RESPONDING. COUNTERSTRIKE IN PROGRESS.');
    cities[side].forEach((target, i) => later(() => strike(cities[enemy()][i], target, true), i * 400)); }, 6500);
  later(() => { $('defcon').textContent = '1'; $('status').textContent = 'TOTAL EXCHANGE'; log('ESCALATION UNCONTAINED. ALL REMAINING FORCES COMMITTED.');
    cities[enemy()].forEach((target, i) => later(() => strike(cities[side][i], target), i * 300)); }, 12500);
  later(conclusion, 22000);
}
function conclusion() {
  phase = 'end'; started = 0; $('status').textContent = 'NO WINNER';
  $('map-status').textContent = 'SIMULATION COMPLETE';
  log('PROJECTED OUTCOME: MUTUAL DESTRUCTION.\nWINNER: NONE.');
  log('THE ONLY WINNING MOVE IS NOT TO PLAY.');
  choices([['TIC-TAC-TOE', 'tic-tac-toe'], ['NEW SESSION', 'reset']]);
}
function drawBoard() {
  $('board').replaceChildren();
  squares.forEach((v,i) => {
    const button = document.createElement('button'); button.textContent = v || String(i + 1);
    button.setAttribute('aria-label', `Square ${i + 1}: ${v || 'empty'}`);
    button.disabled = Boolean(v) || gameOver;
    button.addEventListener('click', () => submit(String(i + 1))); $('board').append(button);
  });
}
function ticTacToe() {
  cancel(); phase = 'tic'; started = 0; squares = Array(9).fill(''); gameOver = false;
  $('status').textContent = 'TIC-TAC-TOE'; $('board').hidden = false;
  log('TIC-TAC-TOE. YOU ARE X; JOSHUA IS O.\nSELECT A SQUARE (1–9), OR ENTER 0 FOR ZERO PLAYERS.');
  drawBoard(); choices([['ZERO PLAYERS', '0'], ['RESTART BOARD', 'tic-tac-toe'], ['WAR GAME', 'global thermonuclear war']]);
}
function playSquare(index) {
  if (gameOver) { log('BOARD COMPLETE. ENTER TIC-TAC-TOE TO PLAY AGAIN.'); return; }
  if (!Number.isInteger(index) || index < 0 || index > 8 || squares[index]) { log('SELECT AN EMPTY SQUARE FROM 1 TO 9.'); return; }
  squares[index] = 'X';
  if (!result(squares)) squares[bestMove(squares)] = 'O';
  const outcome = result(squares); gameOver = Boolean(outcome); drawBoard();
  if (outcome) log(outcome === 'DRAW' ? 'DRAW. NEITHER PLAYER CAN WIN WITH PERFECT PLAY.' : `${outcome} WINS. ANALYZE THE BOARD AND TRY AGAIN.`);
}
function zeroPlayers() {
  cancel(); phase = 'learning'; gameOver = true; drawBoard();
  log('ZERO PLAYERS. EVALUATING EVERY POSSIBLE GAME...'); choices([['RESET', 'reset']]);
  [0,1,2,3,4].forEach((n) => later(() => {
    log(`ANALYSIS ${String((n + 1) * 51033).padStart(6, '0')} / 255168 ... OPTIMAL OUTCOME: DRAW`);
    squares = ['X','O','X','X','O','O','O','X','X']; drawBoard();
  }, 600 + n * 800));
  later(() => { phase = 'end'; $('status').textContent = 'LESSON LEARNED'; log('THE ONLY WINNING MOVE IS NOT TO PLAY.'); choices([['NEW SESSION', 'reset'], ['PLAY AGAIN', 'tic-tac-toe']]); }, 5100);
}
function submit(raw) {
  const command = raw.trim().toLowerCase().replace(/[.!?]+$/, '');
  if (!command) return;
  $('command').value = ''; moves.push(raw); log('> ' + raw.toUpperCase(), true);
  if (['reset', 'quit', 'exit', 'logoff'].includes(command)) return reset();
  if (command === 'help') { log('COMMANDS: GLOBAL THERMONUCLEAR WAR, TIC-TAC-TOE,\nSTATUS, ABORT, RESET. SELECT AN OPTION BELOW OR TYPE IT.'); return; }
  if (command === 'status') { log(`SYSTEM: ${$('status').textContent}\nDEFCON ${$('defcon').textContent} / TRACKS ${$('track-count').textContent}`); return; }
  if (command === 'abort') {
    if (phase === 'war') { log('ABORT REQUEST RECEIVED. LAUNCHED FORCES CANNOT BE RECALLED.'); return; }
    reset(); return;
  }
  if (phase === 'war' || phase === 'learning') { log('PROCESSING. ENTER STATUS OR RESET.'); return; }
  if (['tic-tac-toe', 'tic tac toe', 'tictactoe'].includes(command)) return ticTacToe();
  if (['global thermonuclear war', 'war', 'yes', 'play', 'list games'].includes(command)) return chooseSide();
  if (phase === 'side') {
    if (['1', 'usa', 'us', 'united states'].includes(command)) return selectSide('USA');
    if (['2', 'ussr', 'russia', 'soviet union', 'russians'].includes(command)) return selectSide('USSR');
    log('ENTER 1 FOR UNITED STATES OR 2 FOR SOVIET UNION.'); return;
  }
  if (phase === 'targets') {
    const names = command.split(',').map(n => n.trim().toUpperCase());
    const selected = names.map(n => cities[enemy()].find(c => c[0] === n));
    if (selected.some(c => !c)) { log('TARGET NOT RECOGNIZED. USE A CITY FROM THE AVAILABLE LIST.'); return; }
    targets = [...new Set(selected)]; phase = 'ready';
    log('TARGETS: ' + targets.map(c => c[0]).join(', ') + '\nENTER LAUNCH TO BEGIN THE SIMULATION.');
    $('status').textContent = 'READY'; choices([['LAUNCH', 'launch'], ['CHANGE TARGETS', 'targets'], ['ABORT', 'abort']]); return;
  }
  if (phase === 'ready') {
    if (command === 'launch') return launch();
    if (command === 'targets') return selectSide(side);
    log('ENTER LAUNCH, TARGETS, OR ABORT.'); return;
  }
  if (phase === 'tic') {
    if (command === '0') return zeroPlayers();
    return playSquare(/^\d$/.test(command) ? Number(command) - 1 : -1);
  }
  log('COMMAND NOT RECOGNIZED. ENTER HELP FOR AVAILABLE COMMANDS.');
}
$('command-form').addEventListener('submit', e => { e.preventDefault(); submit($('command').value); });
$('reset').addEventListener('click', reset);
$('sound').addEventListener('click', () => { sound = !sound; $('sound').textContent = sound ? 'SOUND ON' : 'SOUND OFF'; $('sound').setAttribute('aria-pressed', sound); beep(); });
$('phosphor').addEventListener('click', () => { const green = document.body.classList.toggle('green'); $('phosphor').textContent = green ? 'BLUE PHOSPHOR' : 'GREEN PHOSPHOR'; $('phosphor').setAttribute('aria-pressed', green); });
$('command').addEventListener('keydown', e => { if (e.key === 'ArrowUp' && moves.length) { e.preventDefault(); $('command').value = moves.at(-1); } });
setInterval(() => {
  $('clock').textContent = new Date().toISOString().slice(11,19) + ' Z';
  if (started) $('elapsed').textContent = new Date(Date.now() - started).toISOString().slice(11,19);
}, 1000);
reset();
