import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { stripVTControlCharacters } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Session } from '../cli/session.js';
import { frame, renderMap } from '../cli/display.js';
import { bestMove, result } from '../game-core.js';

function fixture() {
  let now = 0, next = 0;
  const pending = new Map();
  const session = new Session({
    clock: () => now,
    schedule: (fn, ms) => { const id = ++next; pending.set(id, { fn, due: now + ms }); return id; },
    unschedule: id => pending.delete(id),
  });
  function advance(ms) {
    const end = now + ms;
    while (pending.size) {
      const [id, task] = [...pending].sort((a,b) => a[1].due - b[1].due)[0];
      if (task.due > end) break;
      pending.delete(id); now = task.due; task.fn();
    }
    now = end;
  }
  return { session, advance, pending };
}

for (const [side, target, name] of [['1', 'Moscow, Kiev, Moscow', 'USA'], ['2', 'Seattle, Las Vegas, Seattle', 'USSR']]) {
  test(`war flow for ${name}: validation, retaliation and unwinnable outcome`, () => {
    const { session: s, advance } = fixture();
    s.submit('war'); s.submit(side); s.submit('not a city');
    assert.equal(s.phase, 'targets');
    s.submit(target); assert.equal(s.targets.length, 2); assert.equal(s.side, name);
    s.submit('launch'); advance(600);
    assert.equal(s.tracks.length, 2);
    s.submit('abort'); assert.equal(s.phase, 'war');
    advance(8900); assert.equal(s.defcon, 2); assert.equal(s.tracks.filter(t => t.hostile).length, 6);
    advance(12500); assert.equal(s.defcon, 1); assert.equal(s.tracks.length, 14);
    assert.equal(s.status, 'NO WINNER'); assert.equal(s.elapsed, 22000);
    advance(10000); assert.equal(s.elapsed, 22000);
  });
}

test('reset cancels all pending war and learning events', () => {
  const { session: s, advance, pending } = fixture();
  s.submit('war'); s.submit('1'); s.submit('moscow'); s.submit('launch'); advance(7000);
  s.submit('reset'); advance(30000);
  assert.equal(s.status, 'AWAITING INPUT'); assert.equal(s.tracks.length, 0); assert.equal(pending.size, 0);
  s.submit('tic-tac-toe'); s.submit('0'); advance(1000); s.submit('reset'); advance(10000);
  assert.equal(s.board, null); assert.equal(s.status, 'AWAITING INPUT');
});

test('tic-tac-toe validates turns and completes the zero-player sequence', () => {
  const { session: s, advance } = fixture();
  s.submit('tic-tac-toe'); s.submit('1');
  assert.equal(s.board.filter(Boolean).length, 2);
  const before = [...s.board]; s.submit('1'); s.submit('word'); assert.deepEqual(s.board, before);
  s.submit('0'); advance(5100);
  assert.equal(s.status, 'LESSON LEARNED'); assert.equal(result(s.board), 'DRAW');
  assert.ok(s.messages.some(line => line.includes('255168 / 255168')));
});

test('Joshua cannot lose against any sequence of human moves', () => {
  let completed = 0;
  function visit(board) {
    for (let i = 0; i < 9; i++) if (!board[i]) {
      const next = [...board]; next[i] = 'X'; assert.notEqual(result(next), 'X');
      if (!result(next)) next[bestMove(next)] = 'O';
      if (result(next)) completed++; else visit(next);
    }
  }
  visit(Array(9).fill('')); assert.equal(completed, 635);
});

test('frames fit small and large terminal dimensions and render missile tracks', () => {
  const { session: s, advance } = fixture();
  s.submit('war'); s.submit('1'); s.submit('moscow'); s.submit('launch'); advance(3000);
  for (const [cols, rows] of [[20,10], [40,16], [80,24], [120,40]]) {
    const lines = frame(s, cols, rows);
    assert.ok(lines.length <= rows - 3); assert.ok(lines.every(line => line.length <= cols - 2));
  }
  assert.ok(renderMap(s, 78, 15, { ascii: true }).some(line => line.includes('+')));
  advance(3000); assert.ok(renderMap(s, 78, 15, { ascii: true }).some(line => line.includes('*')));
  s.submit('reset'); assert.ok(!renderMap(s, 78, 15, { ascii: true }).some(line => line.includes('*')));
});

test('Unicode renderer draws detailed coastlines, animated tracks and colored impacts within terminal bounds', () => {
  const { session: s, advance } = fixture();
  const coast = renderMap(s, 78, 15).join('\n');
  assert.match(coast, /[\u2801-\u28ff]/);
  assert.doesNotMatch(coast, /\x1b/);
  s.submit('war'); s.submit('2'); s.submit('seattle'); s.submit('launch'); advance(3000);
  const outbound = renderMap(s, 78, 15).join('\n');
  assert.match(outbound, /◇/); assert.notEqual(outbound, coast);
  advance(1000); assert.notEqual(renderMap(s, 78, 15).join('\n'), outbound);
  advance(3500);
  const colored = renderMap(s, 78, 15, { color: true }).join('\n');
  assert.match(colored, /◆/); assert.match(colored, /✳/);
  assert.match(colored, /\x1b\[93m/); assert.match(colored, /\x1b\[91m/);
  for (const size of [[40,16], [80,24], [110,36], [150,50]]) {
    for (const options of [{color:true}, {color:true,green:true,trueColor:true}, {ascii:true}, {}]) {
      const lines = frame(s, ...size, options).map(stripVTControlCharacters);
      assert.ok(lines.length <= size[1] - 3);
      assert.ok(lines.every(line => line.length <= size[0] - 2));
    }
  }
  s.submit('reset'); assert.equal(renderMap(s, 78, 15).join('\n'), coast);
});

const cli = fileURLToPath(new URL('../cli.js', import.meta.url));
test('CLI runs from another directory, handles piped commands and exits on EOF', () => {
  const child = spawnSync(process.execPath, [cli, '--plain'], {
    cwd: '/tmp', input: 'help\ntic-tac-toe\n1\n', encoding: 'utf8', timeout: 5000,
  });
  assert.equal(child.status, 0); assert.match(child.stdout, /JOSHUA IS O/);
  assert.match(child.stdout, /X \| 2 \| 3/); assert.doesNotMatch(child.stdout, /\x1b/);
});

test('CLI real timers finish a war, then quit cleanly', { timeout: 10000 }, async () => {
  const child = spawn(process.execPath, [cli, '--plain', '--fast']);
  let output = '', errors = '';
  child.stderr.on('data', data => { errors += data; });
  child.stdout.on('data', data => {
    output += data;
    if (output.includes('WINNER: NONE.') && !child.stdin.writableEnded) child.stdin.end('quit\n');
  });
  child.stdin.write('war\n2\nSeattle, Las Vegas\nlaunch\n');
  const watchdog = setTimeout(() => child.kill(), 6000);
  try {
    const [code] = await once(child, 'exit');
    assert.equal(code, 0, errors); assert.match(output, /COUNTERSTRIKE/);
    assert.match(output, /WINNER: NONE/); assert.match(output, /THE ONLY WINNING MOVE/);
    assert.doesNotMatch(output, /\x1b/);
  } finally { clearTimeout(watchdog); child.kill(); }
});

test('CLI rejects invalid options', () => {
  const child = spawnSync(process.execPath, [cli, '--unknown'], { encoding: 'utf8' });
  assert.equal(child.status, 1); assert.match(child.stderr, /Unknown option/);
});
