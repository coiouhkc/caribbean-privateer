# Caribbean Privateer

A colourful, child-friendly (6+) 2D isometric trading game: sail between procedurally generated Caribbean islands, buy goods cheap, sell them where they are wanted, and fend off pirates. Runs in any modern desktop or mobile browser; English, German and Russian.

See [docs/DESIGN.md](docs/DESIGN.md) for the design and [docs/DESIGN-FOLLOW-UP.md](docs/DESIGN-FOLLOW-UP.md) for planned features.

## Getting started

Requires Node.js 20+.

```sh
npm install
npm run dev        # development server with hot reload, open the printed URL
npm test           # unit tests
npm run build      # type check + production build into dist/
npm run preview    # serve the production build
```

To try the game on a phone, run `npm run dev -- --host` and open the printed network URL on a device in the same network.

## Tips for development

- `?seed=1234` in the URL replays a specific map; the current seed is logged to the browser console.
- In development builds the Phaser game is available as `window.game`, e.g. `game.scene.getScene('game').state.gold = 4999`.
- All gameplay tuning values live in [src/config.ts](src/config.ts).
