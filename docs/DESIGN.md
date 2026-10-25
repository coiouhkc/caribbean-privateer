# Pirates of the Caribbean

## Overview

This is a game about merchants in the Caribbean sea, transporting goods and fighting pirates.

This game is suitable for children from 6 years and up.

Features planned for later iterations are described in [DESIGN-FOLLOW-UP.md](DESIGN-FOLLOW-UP.md).

## Graphics

The graphic of this game should be colorful, cartoonish and suitable for the specified age (no blood o.s.).

The game features 2D isometrical graphics (similar to that of classic RTS and rogue-like of the late 1990s/ early 2000s).

The user is sailing in a procedurally generated world resembling the Caribbean Sea. The game contains ships (pirates, merchants, guards), islands with palms and ports (cities of different sizes offering and demanding different goods).

### Iteration 1 decisions

- **Projection:** classic 2:1 isometric projection. The simulation runs on a flat top-down plane; only rendering is projected (`src/core/iso.ts`).
- **Procedural art:** all graphics are drawn in code at start-up (no image files): islands, palms, houses, treasure chests, smoke puffs and waves. Ships are small extruded 3D models projected isometrically, so they look right at any heading instead of snapping to 8 sprite directions.
- **Child-friendly effects:** hits produce grey smoke puffs, misses produce splashes, defeated pirate ships sink quietly and leave a treasure chest. No crew, no blood.
- **Ships in iteration 1:** the player's merchant ship (white sails, blue flag) and pirate ships (dark sails with a cartoon skull, red stripe). Guard and merchant NPC ships come later.

## World

- **Size:** 4000 × 4000 world units. The player's ship sails at 130 units/s, so the longest port-to-port trip takes well under 60 s (checked by a unit test).
- **Generation:** seeded and deterministic (`src/world/worldgen.ts`). Each new game uses a random seed; `?seed=<number>` in the URL replays a specific map.
- **Islands:** 9 irregular islands with beaches, grass and palms, with enough open water between them to sail around.
- **Ports:** the 6 largest islands get a port: 2 big cities, 2 towns and 2 villages. Each port has a pier, houses, a flag and a name label that also shows the icons of the goods it wants.
- **Navigation:** a 40-unit grid of navigable water with A* path finding and path smoothing. The player never has to steer around islands manually.
- **Validation:** every generated map is checked: all ports must be reachable from each other, and every good must be produced somewhere and wanted somewhere else. Otherwise the generator tries the next seed.

## Gameplay

The user/gamer uses the mouse to point and click the direction of the ship to sail to.

The ship bears cannons and can only fire on each board side in a 120° angle.

The ship can only fire periodically on each board, the cooldown period depends on the vessels characteristics.

The user is a merchant ship trying to get rich the Caribbean Sea. The user has an initial amount of money to start the trading between the cities and ports on the map.

No quick-travel supported -- the map should be small enough to navigate between the islands within at most 1 minute.

The game should be simple enough for a child to play, no difficulty levels **SHOULD** be supported at first.

### Iteration 1 decisions

#### Controls

- Click or tap on the sea: the ship finds a route around islands and sails to that point. A pulsing ring marks the destination.
- Click or tap on a port (its island near the town, or right at its pier): the ship sails to the pier and the market opens on arrival.
- When the ship is near a pier, a large "Enter <port>" button appears as well.
- The minimap (bottom right) can also be clicked to sail to that point.
- Mouse and touch work the same way, so the game is fully playable on phones and tablets.

#### Trading

- The player starts at a village with **500 gold** and a ship that holds **20 units** of cargo.
- Six goods: bananas (base price 10), fish (16), cloth (30), cocoa (42), spices (60), tools (80).
- Each port **produces** goods (sold at 70 % of the base price, large stock), **wants** goods (bought at 150 % of the base price, not sold there) and trades everything else at normal prices with a small stock. Villages produce and want 1 good, towns 2/2, big cities 2/3.
- Ports buy goods for 85 % of their selling price, so buying and selling in the same port never pays off.
- Every unit bought raises the price there by 1 %, every unit sold lowers it by 1 %. Prices and stock slowly drift back to normal over time.
- To keep it simple for children, the market shows "Cheap here!" and "Wanted here!" badges, and for every good the ports that want it ("Wanted in: …").
- The game is paused while the market is open.
- **Goal:** collecting **5,000 gold** shows a celebration. After that the game simply continues (endless play).
- **Safety net:** a player who enters a port with less than 50 gold and no cargo gets 100 gold from the harbour master, so they can never get stuck.

#### Combat

- Cannons fire **automatically**: each board fires as soon as an enemy is inside its 120° arc, within range and the board is reloaded. The child only steers. Each board's reload state is shown in the HUD.
- Player ship: 100 HP, 3 cannons per board, 2.5 s reload, range 380, 8 damage per ball.
- Pirate ship: 60 HP, 2 cannons per board, 3.5 s reload, range 340, 5 damage per ball, less accurate, slightly slower than the player.
- Balls lead moving targets, fly in a visible arc, and splash into the water or puff on land when they miss.
- Damaged ships show a small health bar.

#### Pirates

- Up to 3 pirates sail the map (2 at the start). A defeated pirate is replaced after 25 s, far away from the player.
- Pirates patrol randomly, spot the player within 560 units, and then circle around the player's ship. Sailing in a circle around the target keeps one of their boards facing it.
- **Ports are safe zones** (420 units around each pier): pirates never enter them and never shoot at ships inside them. Fleeing to a port always works.
- A defeated pirate ship sinks and drops a **treasure chest** worth 80–200 gold, which is collected by sailing over it. Unclaimed chests disappear after 90 s.

#### Defeat

- When the player's ship runs out of HP there is no game over. The pirates take all cargo and 10 % of the gold, and a friendly ship tows the player to the nearest port, where the ship is fully repaired.
- Ships can be repaired in any port for 1 gold per HP.

## Tech. stack

The game **MUST** be cross-platform and support Windows, Linux, MacOS as well as iOS and Android.

The game **SHOULD** be browser-based.

The game **SHOULD** use an existing game engine.2

### Iteration 1 decisions

- **Engine:** [Phaser 3](https://phaser.io/) (3.90), rendering with WebGL and falling back to Canvas.
- **Language/build:** TypeScript (strict) with Vite. `npm run build` produces a static site in `dist/` with relative paths, so it can be hosted anywhere.
- **Platforms:** runs in any modern desktop or mobile browser. It adapts to any screen size and orientation, supports touch, and honours safe areas (notches). It ships a web app manifest, so it can be added to the home screen and played full-screen. Native store packages (e.g. Capacitor) are a follow-up.
- **UI:** the HUD, market, dialogs and messages are an HTML/CSS overlay above the Phaser canvas. That gives crisp localized text in any script, big touch-friendly buttons and responsive layout for free. The game world (sea, islands, ships, effects, port labels) is rendered by Phaser.
- **Tests:** game logic (world generation, navigation, economy, combat, movement, localization catalogs) is kept free of Phaser and covered by Vitest unit tests.

### Code structure

| Folder | Content |
| --- | --- |
| `src/core` | Math helpers, seeded RNG, isometric projection |
| `src/world` | Goods, economy, navigation grid, world generation |
| `src/game` | Ship movement, combat, pirate AI, player state |
| `src/render` | Procedural textures, ship and island drawing (Phaser) |
| `src/scenes` | Phaser scenes: `BootScene` (textures), `GameScene` (simulation and rendering) |
| `src/ui` | HTML overlay: HUD, minimap, port market, dialogs |
| `src/i18n` | Localization catalogs and helpers |
| `src/config.ts` | All gameplay tuning values in one place |

## Localization

The game **MUST** support localization. Initially Russian, English and German **MUST** be supported and switchable anytime in the game.

### Iteration 1 decisions

- Catalogs live in `src/i18n/{en,de,ru}.ts`. English is the reference: TypeScript requires the other catalogs to define exactly the same keys, and a unit test checks that placeholders match.
- The language switcher (EN / DE / RU) is always visible in the top right corner and stays usable while dialogs or the market are open. Everything updates immediately: HUD, open dialogs and market, port labels in the world and the page title.
- The initial language comes from the browser language (falling back to English). The player's choice is remembered in the browser.
- Port names are translated too (e.g. "Turtle Cove" / "Schildkrötenbucht" / "Черепаший залив"). Numbers are formatted per language.
