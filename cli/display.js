import { readFileSync } from 'node:fs';

// Rasterize the bundled Natural Earth outlines; no network or image library needed.
const svg = readFileSync(new URL('../assets/world.svg', import.meta.url), 'utf8');
const outlines = [...svg.matchAll(/d="(M[^"]+)"/g)].map(match =>
  [...match[1].matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(p => [Number(p[1]) / 1080, Number(p[2]) / 450]));
let cached;
function line(grid, x, y, tx, ty, symbol) {
  const steps = Math.max(Math.abs(tx - x), Math.abs(ty - y), 1);
  for (let i = 0; i <= steps; i++) {
    const px = Math.round(x + (tx - x) * i / steps), py = Math.round(y + (ty - y) * i / steps);
    if (grid[py]?.[px] !== undefined) grid[py][px] = symbol;
  }
}
function baseMap(width, height) {
  if (cached?.width === width && cached?.height === height) return cached.grid.map(row => [...row]);
  const grid = Array.from({ length: height }, () => Array(width).fill(' '));
  for (const ring of outlines) for (let i = 1; i < ring.length; i++) {
    const [x, y] = ring[i - 1], [tx, ty] = ring[i];
    line(grid, Math.round(x * (width - 1)), Math.round(y * (height - 1)), Math.round(tx * (width - 1)), Math.round(ty * (height - 1)), '.');
  }
  cached = { width, height, grid };
  return grid.map(row => [...row]);
}
function renderAsciiMap(session, width, height) {
  const grid = baseMap(width, height);
  const project = city => [(city[1] + 180) / 360 * (width - 1), (85 - city[2]) / 150 * (height - 1)];
  for (const track of session.tracks) {
    const [x, y] = project(track.from), [tx, ty] = project(track.to);
    const cx = (x + tx) / 2, cy = Math.min(y, ty) - height * .3;
    const progress = Math.max(0, Math.min(1, (session.clock() - track.launched) * session.speed / 5000));
    const steps = width * 2;
    for (let i = 0; i <= Math.floor(progress * steps); i++) {
      const t = i / steps;
      const px = Math.round((1-t)**2*x + 2*(1-t)*t*cx + t*t*tx);
      const py = Math.max(0, Math.round((1-t)**2*y + 2*(1-t)*t*cy + t*t*ty));
      if (grid[py]?.[px] !== undefined) grid[py][px] = track.hostile ? '!' : '+';
    }
    if (progress === 1) grid[Math.round(ty)][Math.round(tx)] = '*';
  }
  return grid.map(row => row.join(''));
}
// Unicode Braille encodes a 2 x 4 pixel tile in one terminal cell.
// Bit layout: 1 4 / 2 5 / 3 6 / 7 8 (Unicode U+2800 onward).
const dots = [[1, 8], [2, 16], [4, 32], [64, 128]];
let coastCache;
function coastPixels(width, height) {
  if (coastCache?.width === width && coastCache?.height === height) return coastCache.pixels.slice();
  const pixels = new Uint8Array(width * height);
  const put = (x, y) => { if (x >= 0 && x < width && y >= 0 && y < height) pixels[y * width + x] = 1; };
  for (const ring of outlines) for (let i = 1; i < ring.length; i++) {
    const [a, b] = ring[i - 1], [c, d] = ring[i];
    const x = a * (width - 1), y = (.1 + b * .9) * (height - 1);
    const tx = c * (width - 1), ty = (.1 + d * .9) * (height - 1);
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(tx - x), Math.abs(ty - y))));
    for (let j = 0; j <= steps; j++) put(Math.round(x + (tx - x) * j / steps), Math.round(y + (ty - y) * j / steps));
  }
  coastCache = { width, height, pixels };
  return pixels.slice();
}

export function renderMap(session, width, height, { ascii = false, color = false, green = false, trueColor = false } = {}) {
  if (ascii) return renderAsciiMap(session, width, height);
  const pw = width * 2, ph = height * 4;
  const pixels = coastPixels(pw, ph), markers = [];
  const put = (x, y, value) => {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && x < pw && y >= 0 && y < ph) pixels[y * pw + x] = Math.max(value, pixels[y * pw + x]);
  };
  const project = city => [(city[1] + 180) / 360 * (pw - 1), (.1 + (85 - city[2]) / 150 * .9) * (ph - 1)];
  for (const track of session.tracks) {
    const [x,y] = project(track.from), [tx,ty] = project(track.to);
    const cx = (x + tx) / 2, cy = Math.max(0, Math.min(y, ty) - ph * .45);
    const age = Math.max(0, (session.clock() - track.launched) * session.speed);
    const progress = Math.min(1, age / 5000), kind = track.hostile ? 3 : 2;
    const curve = t => [(1-t)**2*x + 2*(1-t)*t*cx + t*t*tx, (1-t)**2*y + 2*(1-t)*t*cy + t*t*ty];
    const steps = pw * 2;
    for (let i = 0; i <= Math.floor(progress * steps); i++) put(...curve(i / steps), kind);
    const [hx, hy] = curve(progress);
    markers.push({ x: Math.min(width - 1, Math.floor(hx / 2)), y: Math.min(height - 1, Math.floor(hy / 4)), kind: progress === 1 ? 4 : kind, char: progress === 1 ? '✳' : track.hostile ? '◆' : '◇' });
    if (progress === 1 && age < 8000) {
      const radius = 1 + (age - 5000) / 3000 * Math.min(8, ph * .14);
      for (let t = 0; t < Math.PI * 2; t += .08) put(tx + Math.cos(t) * radius, ty + Math.sin(t) * radius, 4);
    }
  }
  const palette = trueColor
    ? ['', green ? '\x1b[38;2;73;142;89m' : '\x1b[38;2;73;139;172m', '\x1b[38;2;178;241;255m', '\x1b[38;2;255;185;91m', '\x1b[38;2;255;110;88m']
    : ['', green ? '\x1b[32m' : '\x1b[36m', '\x1b[96m', '\x1b[93m', '\x1b[91m'];
  const restore = green ? '\x1b[92m' : '\x1b[96m';
  const chars = [], kinds = [];
  for (let y = 0; y < height; y++) {
    chars[y] = []; kinds[y] = [];
    for (let x = 0; x < width; x++) {
      let bits = 0, kind = 0;
      for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 2; dx++) {
        const pixel = pixels[(y * 4 + dy) * pw + x * 2 + dx];
        if (pixel) { bits |= dots[dy][dx]; kind = Math.max(kind, pixel); }
      }
      chars[y][x] = bits ? String.fromCharCode(0x2800 + bits) : ' ';
      kinds[y][x] = kind;
    }
  }
  if (!session.tracks.length && width >= 65 && height >= 10) {
    for (const [label,x,y] of [['U S A',.20,.36],['U S S R',.67,.29]]) {
      const row = Math.floor(y * height), col = Math.floor(x * width);
      [...label].forEach((char,i) => { chars[row][col + i] = char; kinds[row][col + i] = 2; });
    }
  }
  for (const marker of markers) { chars[marker.y][marker.x] = marker.char; kinds[marker.y][marker.x] = marker.kind; }
  return chars.map((row,y) => {
    let previous = -1, text = '';
    row.forEach((char,x) => {
      const kind = kinds[y][x];
      if (color && kind && kind !== previous) { text += palette[kind]; previous = kind; }
      text += char;
    });
    return text + (color ? restore : '');
  });
}

export function renderBoard(board) {
  const row = i => `  ${board[i] || i+1} | ${board[i+1] || i+2} | ${board[i+2] || i+3}`;
  return [row(0), ' ---+---+---', row(3), ' ---+---+---', row(6)];
}
export function wrap(text, width) {
  if (!text) return [''];
  const rows = [];
  while (text.length > width) {
    let end = text.lastIndexOf(' ', width);
    if (end < width / 2) end = width;
    rows.push(text.slice(0, end)); text = text.slice(end).trimStart();
  }
  return [...rows, text];
}
export function frame(session, columns, rows, options = {}) {
  const width = Math.max(1, columns - 2), height = Math.max(1, rows - 3);
  const rule = options.ascii ? '-' : '─';
  const time = new Date(session.elapsed).toISOString().slice(11, 19);
  const header = width < 60 ? `WOPR / DEFCON ${session.defcon}` : 'WOPR / WAR OPERATION PLAN RESPONSE';
  if (height < 10) return [header, `${session.status} / ${time}`, ...session.messages.flatMap(s => wrap(s, width)).slice(-Math.max(1, height - 3))].slice(0, height).map(s => s.slice(0, width));
  const lines = [header, 'GLOBAL THERMONUCLEAR WAR / SIMULATION ONLY', rule.repeat(width),
    `DEFCON ${session.defcon}  TRACKS ${String(session.tracks.length).padStart(3,'0')}  ELAPSED ${time}`];
  if (session.board && height >= 16) lines.push(...renderBoard(session.board));
  else if (!session.board && height >= 19 && width >= 40) {
    const mapHeight = Math.min(24, Math.max(7, height - 14));
    if (options.ascii) {
      lines.push(...renderMap(session, width, mapHeight, options));
      lines.push('+ OUTBOUND   ! INBOUND   * IMPACT');
    } else {
      const title = ' STRATEGIC SURVEILLANCE ';
      lines.push('┌' + title + '─'.repeat(Math.max(0, width - title.length - 2)) + '┐');
      lines.push(...renderMap(session, width - 2, mapHeight - 2, options).map(row => '│' + row + '│'));
      lines.push('└' + '─'.repeat(width - 2) + '┘');
      lines.push('◇ OUTBOUND   ◆ INBOUND   ✳ IMPACT');
    }
  }
  lines.push(`SIDE: ${session.side || 'UNASSIGNED'} / ${session.status}`, rule.repeat(width), 'JOSHUA / INTERACTIVE SESSION');
  const budget = height - lines.length - 2;
  const logs = session.messages.flatMap(s => wrap(s, width)).slice(-Math.max(1, budget));
  lines.push(...logs);
  while (lines.length < height - 2) lines.push('');
  lines.push(rule.repeat(width), session.hint);
  // Map rows already have an exact visible width; preserve their ANSI sequences.
  return lines.slice(0, height).map(s => s.includes('\x1b[') ? s : s.slice(0, width));
}
