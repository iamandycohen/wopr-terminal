import { cp, mkdir, rm } from 'node:fs/promises';

const output = new URL('../dist/', import.meta.url);
const browserFiles = ['index.html', 'style.css', 'app.js', 'game-core.js'];

await rm(output, { recursive: true, force: true });
await mkdir(new URL('assets/', output), { recursive: true });

await Promise.all([
  ...browserFiles.map((file) =>
    cp(new URL(`../${file}`, import.meta.url), new URL(file, output))
  ),
  cp(
    new URL('../assets/world.svg', import.meta.url),
    new URL('assets/world.svg', output)
  ),
  cp(
    new URL('../assets/wopr-terminal-cli.png', import.meta.url),
    new URL('assets/wopr-terminal-cli.png', output)
  ),
  cp(
    new URL('../assets/wopr-icon.svg', import.meta.url),
    new URL('assets/wopr-icon.svg', output)
  ),
]);

console.log('Built static web app in dist/');
