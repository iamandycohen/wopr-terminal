import { cities, result, bestMove } from '../game-core.js';

export class Session {
  constructor({ notify = () => {}, clock = Date.now, schedule = setTimeout, unschedule = clearTimeout, speed = 1 } = {}) {
    Object.assign(this, { notify, clock, schedule, unschedule, speed });
    this.timers = new Set();
    this.reset();
  }

  cancel() {
    for (const timer of this.timers) this.unschedule(timer);
    this.timers.clear();
  }

  later(fn, ms) {
    const timer = this.schedule(() => {
      this.timers.delete(timer);
      fn();
      this.notify();
    }, ms / this.speed);
    this.timers.add(timer);
  }

  say(text) {
    this.messages.push(...text.split('\n'));
    this.messages = this.messages.slice(-100);
    this.notify(text);
  }

  reset() {
    this.cancel();
    Object.assign(this, {
      phase: 'greeting', side: null, targets: [], tracks: [], board: null,
      started: null, finished: null, defcon: 5, status: 'AWAITING INPUT', messages: [],
      hint: 'WAR / TIC-TAC-TOE / HELP / QUIT',
    });
    this.say('GREETINGS PROFESSOR FALKEN.\nSHALL WE PLAY A GAME?');
  }

  get enemy() { return this.side === 'USA' ? 'USSR' : 'USA'; }
  get elapsed() {
    return this.started === null ? 0 : Math.max(0, ((this.finished ?? this.clock()) - this.started) * this.speed);
  }

  chooseSide() {
    this.cancel();
    Object.assign(this, {
      phase: 'side', side: null, targets: [], tracks: [], board: null,
      started: null, finished: null, defcon: 5, status: 'SELECT SIDE', hint: '1 UNITED STATES / 2 SOVIET UNION',
    });
    this.say('SELECT YOUR SIDE:\n  1. UNITED STATES\n  2. SOVIET UNION');
  }

  selectSide(side) {
    Object.assign(this, { side, targets: [], phase: 'targets', status: 'SELECT TARGETS', hint: 'CITY NAMES, SEPARATED BY COMMAS / ABORT' });
    this.say('ENTER TARGET CITIES, SEPARATED BY COMMAS.\nAVAILABLE: ' + cities[this.enemy].map(c => c[0]).join(', '));
  }

  strike(from, to, hostile = false) {
    this.tracks.push({ from, to, hostile, launched: this.clock() });
  }

  launch() {
    Object.assign(this, {
      phase: 'war', started: this.clock(), finished: null, defcon: 3,
      status: 'LAUNCH DETECTED', hint: 'STATUS / ABORT / RESET / QUIT',
    });
    this.targets.forEach((target, i) => this.later(() => this.strike(cities[this.side][i], target), i * 600));
    this.say('SIMULATION RUNNING. INITIAL LAUNCH DETECTED.');
    this.later(() => {
      this.defcon = 2; this.status = 'COUNTERSTRIKE';
      cities[this.side].forEach((target, i) => this.later(() => this.strike(cities[this.enemy][i], target, true), i * 400));
      this.say('OPPOSING FORCES RESPONDING. COUNTERSTRIKE IN PROGRESS.');
    }, 6500);
    this.later(() => {
      this.defcon = 1; this.status = 'TOTAL EXCHANGE';
      cities[this.enemy].forEach((target, i) => this.later(() => this.strike(cities[this.side][i], target), i * 300));
      this.say('ESCALATION UNCONTAINED. ALL REMAINING FORCES COMMITTED.');
    }, 12500);
    this.later(() => {
      this.phase = 'end'; this.finished = this.clock(); this.status = 'NO WINNER';
      this.hint = 'TIC-TAC-TOE / RESET / QUIT';
      this.say('PROJECTED OUTCOME: MUTUAL DESTRUCTION.\nWINNER: NONE.\nTHE ONLY WINNING MOVE IS NOT TO PLAY.');
    }, 22000);
  }

  ticTacToe() {
    this.cancel();
    Object.assign(this, {
      phase: 'tic', board: Array(9).fill(''), tracks: [], side: null, defcon: 5,
      started: null, finished: null, status: 'TIC-TAC-TOE', hint: 'SQUARE 1-9 / 0 ZERO PLAYERS / WAR / RESET',
    });
    this.say('TIC-TAC-TOE. YOU ARE X; JOSHUA IS O.\nSELECT A SQUARE (1-9), OR ENTER 0 FOR ZERO PLAYERS.');
  }

  play(index) {
    if (result(this.board)) return this.say('BOARD COMPLETE. ENTER TIC-TAC-TOE TO PLAY AGAIN.');
    if (!Number.isInteger(index) || index < 0 || index > 8 || this.board[index]) return this.say('SELECT AN EMPTY SQUARE FROM 1 TO 9.');
    this.board[index] = 'X';
    if (!result(this.board)) this.board[bestMove(this.board)] = 'O';
    const outcome = result(this.board);
    if (outcome) {
      this.status = outcome === 'DRAW' ? 'DRAW' : `${outcome} WINS`;
      this.say(outcome === 'DRAW' ? 'DRAW. NEITHER PLAYER CAN WIN WITH PERFECT PLAY.' : `${outcome} WINS. ANALYZE THE BOARD AND TRY AGAIN.`);
    }
  }

  zeroPlayers() {
    this.phase = 'learning'; this.status = 'ANALYZING'; this.hint = 'STATUS / RESET / QUIT';
    this.say('ZERO PLAYERS. EVALUATING POSSIBLE GAMES...');
    // Cinematic sequence; the on-screen count is not a live exhaustive search.
    for (let n = 0; n < 5; n++) this.later(() => {
      this.board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
      this.say(`ANALYSIS ${String(Math.round((n + 1) * 255168 / 5)).padStart(6, '0')} / 255168 ... OPTIMAL OUTCOME: DRAW`);
    }, 600 + n * 800);
    this.later(() => {
      this.phase = 'end'; this.status = 'LESSON LEARNED'; this.hint = 'TIC-TAC-TOE / WAR / RESET / QUIT';
      this.say('THE ONLY WINNING MOVE IS NOT TO PLAY.');
    }, 5100);
  }

  submit(raw) {
    // Never echo terminal escape/control sequences supplied through pasted input.
    raw = raw.replace(/[^\x20-\x7e]/g, '').slice(0, 200).trim();
    const command = raw.toLowerCase().replace(/[.!?]+$/, '');
    if (!command) return;
    this.say('> ' + raw.toUpperCase());
    if (['quit', 'exit', 'logoff'].includes(command)) { this.cancel(); return 'quit'; }
    if (command === 'reset') return this.reset();
    if (command === 'help') return this.say('COMMANDS: WAR, TIC-TAC-TOE, STATUS, ABORT, RESET, QUIT.\nWAR: SELECT A SIDE, ENTER CITIES, THEN LAUNCH.\nTIC-TAC-TOE: ENTER 1-9 TO MOVE, OR 0 FOR ZERO PLAYERS.\nUP/DOWN: COMMAND HISTORY. CTRL-C / CTRL-D: EXIT.');
    if (command === 'status') return this.say(`SYSTEM: ${this.status}\nDEFCON ${this.defcon} / TRACKS ${String(this.tracks.length).padStart(3, '0')}`);
    if (command === 'abort') {
      if (this.phase === 'war') return this.say('ABORT REQUEST RECEIVED. LAUNCHED FORCES CANNOT BE RECALLED.');
      return this.reset();
    }
    if (['war', 'learning'].includes(this.phase)) return this.say('PROCESSING. ENTER STATUS, RESET, OR QUIT.');
    if (['tic-tac-toe', 'tic tac toe', 'tictactoe'].includes(command)) return this.ticTacToe();
    if (['war', 'global thermonuclear war', 'yes', 'play', 'list games'].includes(command)) return this.chooseSide();
    if (this.phase === 'side') {
      if (['1', 'usa', 'us', 'united states'].includes(command)) return this.selectSide('USA');
      if (['2', 'ussr', 'russia', 'russians', 'soviet union'].includes(command)) return this.selectSide('USSR');
      return this.say('ENTER 1 FOR UNITED STATES OR 2 FOR SOVIET UNION.');
    }
    if (this.phase === 'targets') {
      const selected = command.split(',').map(n => cities[this.enemy].find(c => c[0] === n.trim().toUpperCase()));
      if (selected.some(c => !c)) return this.say('TARGET NOT RECOGNIZED.\nAVAILABLE: ' + cities[this.enemy].map(c => c[0]).join(', '));
      this.targets = [...new Set(selected)]; this.phase = 'ready'; this.status = 'READY';
      this.hint = 'LAUNCH / TARGETS / ABORT';
      return this.say('TARGETS: ' + this.targets.map(c => c[0]).join(', ') + '\nENTER LAUNCH TO BEGIN THE SIMULATION.');
    }
    if (this.phase === 'ready') {
      if (command === 'launch') return this.launch();
      if (command === 'targets') return this.selectSide(this.side);
      return this.say('ENTER LAUNCH, TARGETS, OR ABORT.');
    }
    if (this.phase === 'tic') {
      if (command === '0') return this.zeroPlayers();
      return this.play(/^[1-9]$/.test(command) ? Number(command) - 1 : -1);
    }
    this.say('COMMAND NOT RECOGNIZED. ENTER HELP FOR AVAILABLE COMMANDS.');
  }
}
