#!/usr/bin/env node
import readline from 'node:readline';
import { Session } from './cli/session.js';
import { frame, renderBoard } from './cli/display.js';

const flags = new Set(process.argv.slice(2));
const valid = new Set(['--help', '-h', '--plain', '--green', '--no-color', '--fast', '--ascii']);
const unknown = [...flags].find(flag => !valid.has(flag));
if (unknown) {
  console.error(`Unknown option: ${unknown}\nRun node cli.js --help for usage.`);
  process.exit(1);
}
if (flags.has('--help') || flags.has('-h')) {
  console.log(`WOPR / Global Thermonuclear War

Usage: node cli.js [options]
       npm run cli -- [options]

  --green     Green phosphor (default: blue)
  --ascii     Use the original ASCII map instead of Unicode graphics
  --no-color  Disable color; retain the interactive display
  --plain     Scrolling text, no full-screen display or animation
  --fast      Play cinematic sequences at 10x speed
  --help      Show this help

Type WAR or TIC-TAC-TOE to begin. HELP lists game commands.
Type QUIT, press Ctrl-C, or send EOF (Ctrl-D) to exit.
RESET starts over. Up/down arrows recall commands.
Non-interactive input/output and TERM=dumb use plain mode.
NO_COLOR disables color. No server or internet connection required.`);
  process.exit(0);
}

const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const fullscreen = interactive && !flags.has('--plain') && process.env.TERM !== 'dumb';
const color = fullscreen && process.env.NO_COLOR === undefined && !flags.has('--no-color');
const phosphor = color ? (flags.has('--green') ? '\x1b[92m' : '\x1b[96m') : '';
let session, rl, refresh, stopped = false, enteredScreen = false, lastBoard = '', lastRender = '';

function paint(force = false) {
  if (stopped || !session || !rl) return;
  if (!fullscreen) {
    if (session.board) {
      const board = renderBoard(session.board).join('\n');
      if (board !== lastBoard) { process.stdout.write(board + '\n'); lastBoard = board; }
    } else lastBoard = '';
    return;
  }
  const columns = process.stdout.columns || 80, rows = process.stdout.rows || 24;
  const lines = frame(session, columns, rows, {
    ascii: flags.has('--ascii'), color, green: flags.has('--green'),
    trueColor: /^(truecolor|24bit)$/i.test(process.env.COLORTERM || ''),
  });
  const width = Math.max(1, columns - 4);
  const offset = Math.max(0, rl.cursor - width + 1);
  const input = rl.line.slice(offset, offset + width);
  const prefix = offset ? '< ' : '> ';
  const display = lines.map(line => '\x1b[2K' + line).join('\r\n');
  const signature = `${columns}:${rows}:${rl.cursor}:${display}:${input}`;
  if (!force && signature === lastRender) return;
  lastRender = signature;
  process.stdout.write('\x1b[?25l\x1b[H' + phosphor + display + '\r\n\x1b[2K' + prefix + input + '\x1b[J');
  readline.cursorTo(process.stdout, Math.min(columns - 1, 2 + rl.cursor - offset), lines.length);
  process.stdout.write('\x1b[?25h');
}

function cleanup() {
  if (stopped) return;
  stopped = true;
  clearInterval(refresh);
  session?.cancel();
  if (enteredScreen) {
    process.stdout.write('\x1b[0m\x1b[?25h\x1b[?1049l');
    enteredScreen = false;
  }
}
function quit() {
  cleanup();
  rl?.close();
  process.stdin.pause();
}
process.on('exit', cleanup);
process.on('SIGINT', quit);
process.on('SIGTERM', quit);
process.stdout.on('error', error => {
  cleanup();
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});
if (fullscreen) { process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H'); enteredScreen = true; }
else process.stdout.write('WOPR / GLOBAL THERMONUCLEAR WAR\nSIMULATION ONLY. TYPE HELP FOR COMMANDS.\n\n');

session = new Session({
  speed: flags.has('--fast') ? 10 : 1,
  notify: text => {
    if (!fullscreen && text) process.stdout.write(text + '\n');
  },
});
rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: interactive, historySize: 100, prompt: '> ' });
rl.on('line', line => {
  if (session.submit(line) === 'quit') return quit();
  paint(true);
  if (!fullscreen && interactive) rl.prompt();
});
rl.on('SIGINT', quit);
rl.on('close', quit);
if (fullscreen) {
  process.stdin.on('keypress', () => setImmediate(() => paint(true)));
  process.stdout.on('resize', () => paint(true));
  refresh = setInterval(paint, 100);
} else {
  refresh = setInterval(paint, 100);
  if (interactive) rl.prompt();
}
paint();
