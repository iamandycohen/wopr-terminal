# WOPR terminal

A movie-inspired, playable recreation of the Global Thermonuclear War terminal in *WarGames* (1983). Includes a browser version and a native command-line version. No runtime dependencies, accounts, or external requests.

Requires Node.js 20 or later. No installation step is needed.

## Command-line version

```sh
npm run cli
```

Or run `node cli.js` / `./cli.js` directly. This opens a resizable, full-screen terminal with a detailed Unicode coastline map, colored missile trajectories with moving heads and expanding impact rings, DEFCON and elapsed-time displays, a command prompt, and tic-tac-toe. The map uses Unicode Braille cells (2 × 4 drawing points per character) for eight times the plotting resolution of an ASCII map. Outbound tracks are cyan, inbound tracks amber, and impacts red; distinct markers also identify them in monochrome. True-color shading is used when `COLORTERM=truecolor` or `24bit`, with standard ANSI colors otherwise. A terminal around 100 columns by 35 rows gives the map more detail; small terminals switch to a compact layout.

Example commands, pressing Enter after each:

```text
war
2
Seattle, Las Vegas
launch
```

Use `tic-tac-toe` to play Joshua, then enter square numbers `1`–`9`. Enter `0` for the zero-player learning sequence. `help` lists commands, `reset` cancels the current session, and `quit` exits. Ctrl-C and EOF (Ctrl-D) also exit and restore the terminal. Up/down arrows navigate command history. Unlike the browser version, `quit` exits the app instead of resetting it.

Options:

```sh
npm run cli -- --green       # Green phosphor
npm run cli -- --ascii       # Original ASCII graphics for older terminals/fonts
npm run cli -- --plain       # Scrolling text, without screen control or animation
npm run cli -- --fast        # Cinematic sequences at 10x speed
node cli.js --help           # Full usage
```

`--no-color` or the `NO_COLOR` environment variable disables color. Piped input/output and `TERM=dumb` automatically select plain mode. EOF exits immediately and cancels any pending simulation; keep stdin open to watch a scripted exchange finish.

## Browser version

Run:

```sh
npm start
```

Open http://localhost:3000. Set `PORT` to use another port. You can also open `index.html` with any static web server.

Choose Global Thermonuclear War, select a side, enter one or more listed cities separated by commas, and enter `LAUNCH`. The scripted exchange takes about 22 seconds and has no winning outcome. `ABORT` before launch resets the session; after launch, the simulation continues. `RESET` always starts over and cancels pending events.

Tic-tac-toe has an unbeatable minimax opponent. Enter `0` for the cinematic zero-player learning sequence. Its displayed analysis counter is theatrical, not a live exhaustive calculation. Click suggestions or type commands; up-arrow recalls the last command. Sound is optional and off by default. A green phosphor option and reduced-motion support are included.

This is an unofficial interpretation, not a frame-exact reproduction. The film does not specify a complete playable ruleset; the command flow and escalation fill those gaps. There are no real-world weapon connections or targeting calculations.

## References and assets

- Film terminal reference: https://mw.rat.bz/wgterm/ (visual reference only; no fonts or images copied).
- Map outlines: Natural Earth, 1:110m land, public domain: https://www.naturalearthdata.com/about/terms-of-use/ . `assets/world.svg` is projected from https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson .

## Validation

`npm run check` checks JavaScript syntax; `npm test` runs ten tests covering both sides, target validation, escalation, reset cancellation, tic-tac-toe, all 635 human playthroughs against Joshua, terminal dimensions, Unicode graphics and ANSI color widths, piped input/EOF, real-time CLI playback, and option errors.

The full-screen CLI was also checked in a real pseudoterminal for Unicode graphics, blue/green and monochrome rendering, ASCII fallback, war and tic-tac-toe playthroughs, resizing, partially entered commands, Ctrl-C, and terminal restoration. Browser checks cover both sides, target validation, launch and conclusion, reset cancellation, tic-tac-toe, and small-screen layout.
