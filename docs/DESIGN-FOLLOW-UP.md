# Pirates of the Caribbean: follow-up design

Features that were deliberately left out of iteration 1 (see [DESIGN.md](DESIGN.md)), with a proposed design for later implementation. Values are starting points for tuning.

## 1. Guard ships

**Goal:** make the sea feel alive and give the player allies; this is the "guards" from the original design.

- Every big city and town owns one guard ship (navy colours: white hull stripe, blue sails with an anchor emblem). Guards patrol a circle of about 700 units around their port.
- Guards attack pirates within 600 units, using the same combat rules as everybody else (auto-fire, 120° arcs). Guard stats: 120 HP, 3 cannons per board, 3 s reload.
- Guards never attack the player. Pirate balls that hit a guard damage it normally. A sunk guard returns after 60 s.
- This extends the "safe zone" idea naturally. The hard safe-zone radius could then be reduced, so that ports feel protected by visible ships rather than an invisible rule.
- Implementation notes: add a `guard` faction to `Ship`. Generalize target selection from "player vs. pirates" to a faction hostility table. Add a `guardAI` next to `pirateAI` (patrol, chase pirates, return home).

## 2. Merchant NPC ships

**Goal:** decoration and a sense of a living trade network.

- 2–4 merchant ships (brown hulls, striped sails) sail between random ports along nav-grid paths, wait 10 s in port, and continue.
- Pirates may chase them as well (pirate target = nearest of player/merchant). Merchants flee towards the nearest port.
- Optional later: when an NPC merchant arrives at a port, it nudges prices there slightly (selling its cargo), so markets change over time.
- No interaction with the player in the first version.

## 3. Ship upgrades

**Goal:** give the player something to spend money on and a sense of progression.

- Shipyards in big cities sell bigger ships. The old ship is traded in for 50 % of its price. Cargo has to fit into the new ship.

| Ship | Price | Cargo | HP | Cannons/board | Reload | Speed |
| --- | --- | --- | --- | --- | --- | --- |
| Sloop (start) | – | 20 | 100 | 3 | 2.5 s | 130 |
| Brig | 2,500 | 40 | 160 | 4 | 2.3 s | 125 |
| Galleon | 8,000 | 80 | 260 | 6 | 2.0 s | 115 |

- Single upgrades as an alternative or addition: extra cargo hold (+10, 800 gold), reinforced hull (+30 HP, 600 gold), faster reload (−0.3 s, 1,000 gold).
- The goal could then be raised or turned into multiple trophies (first upgrade, 10,000 gold, first galleon).
- Visuals: `drawShip` already takes a palette and scales with `ShipStats.length`. Add a hull outline and mast count per ship type.
- Implementation notes: move `ShipStats` selection into a `shipTypes.ts` table and add a "Shipyard" tab to the port panel.

## 4. Save game

**Goal:** children can stop and continue later.

- Save automatically to `localStorage` whenever the player leaves a port, plus every 30 s at sea. No manual save/load UI, just a "Continue" / "New game" choice on start.
- Saved state: world seed (the map is regenerated deterministically from it), gold, cargo, ship type and HP, player position and heading, goal-reached flag, market state per port (stock and pressure), and a format version for migrations.
- Not saved: pirates, cannonballs, treasure chests (pirates are re-spawned far away on load).
- Implementation notes: add `serialize()` / `deserialize()` helpers next to `PlayerState` and `Market`. Validate on load and fall back to a new game if the data is corrupt or from an unknown version.

## 5. Further ideas collected during iteration 1

- **Sound and music:** cheerful sea shanty loop, wave ambience, cannon "boom" (soft), coin sound when trading, with a mute button in the HUD.
- **Native app packaging:** wrap the web build with Capacitor for the iOS App Store and Google Play, and optionally Tauri/Electron for desktop stores. The game is already a static site with relative paths and a web app manifest.
- **Offline support:** a service worker so the installed web app works without a network connection.
- **High-DPI rendering:** render the Phaser canvas at the device pixel ratio for sharper graphics on retina and phone screens.
- **Upgrade to Phaser 4:** Phaser 4 is available. Evaluate migrating once the first iterations are stable.
- **Tutorial hints:** a short guided first trade ("Buy bananas here, the arrow shows where they are wanted") instead of the welcome text only.
- **Weather and day/night:** purely visual at first (clouds, sunset tint). Later, wind could influence speed.
- **Quests:** simple delivery orders from ports ("Bring 10 fish to Pearl Town within 2 minutes") with bonus gold.
- **Map improvements:** reefs and small rocks as obstacles, and port icons on the minimap that show which goods are wanted.
