import Phaser from 'phaser';
import {
  DEFEAT_GOLD_LOSS,
  DOCK_RADIUS,
  GOAL_GOLD,
  INITIAL_PIRATES,
  MAX_PIRATES,
  PIRATE_RESPAWN_SECONDS,
  PIRATE_STATS,
  PLAYER_STATS,
  REPAIR_COST_PER_HP,
  STARTER_GIFT,
  STARTER_GIFT_THRESHOLD,
  TREASURE_LIFETIME,
  TREASURE_MAX,
  TREASURE_MIN,
  TREASURE_PICKUP_RADIUS,
  WORLD_SIZE,
} from '../config';
import { toScreen, toWorld } from '../core/iso';
import { add, angleTo, clamp, dist, fromAngle, type Vec2 } from '../core/math';
import { createRng, randInt, randRange, type Rng } from '../core/rng';
import { ballHeight, type Cannonball, chooseTarget, fireVolley, hitsShip, SIDES } from '../game/combat';
import { pirateSpawnPoint, updatePirate } from '../game/pirateAI';
import { createPlayerState } from '../game/playerState';
import { Ship } from '../game/ship';
import { formatNumber, onLanguageChange, t } from '../i18n';
import { drawIsland } from '../render/islandArt';
import { drawShip, PIRATE_PALETTE, PLAYER_PALETTE } from '../render/shipArt';
import { HOUSE_TEXTURES } from '../render/textures';
import type { GameApi, HudState, MinimapState } from '../ui/api';
import { UI } from '../ui';
import { buy, sell, tickMarket, type TradeResult } from '../world/economy';
import { cargoUsed, emptyCargo, GOOD_INFO, type GoodId } from '../world/goods';
import { generateWorld, inSafeZone, isLand, type Port, type World } from '../world/worldgen';

/** Render order. Objects standing on the map use their screen y as depth (painter's algorithm). */
const DEPTH = {
  sea: -1000,
  waves: -900,
  wake: -850,
  island: -800,
  marker: -790,
  balls: 5000,
  effects: 5100,
  labels: 6000,
};

const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

interface Treasure {
  pos: Vec2;
  amount: number;
  age: number;
  image: Phaser.GameObjects.Image;
}

interface Wake {
  pos: Vec2;
  age: number;
}

function readSeed(): number {
  const param = new URLSearchParams(window.location.search).get('seed');
  const parsed = param === null ? NaN : Number.parseInt(param, 10);
  return Number.isFinite(parsed) ? parsed >>> 0 : Math.floor(Math.random() * 2 ** 31);
}

export class GameScene extends Phaser.Scene implements GameApi {
  world!: World;
  private rng!: Rng;
  private ui!: UI;
  private readonly state = createPlayerState();
  private player!: Ship;
  private pirates: Ship[] = [];
  private balls: Cannonball[] = [];
  private treasures: Treasure[] = [];
  private wakes: Wake[] = [];
  private readonly shipGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  private portLabels: Array<{ port: Port; name: Phaser.GameObjects.Text; wants: Phaser.GameObjects.Text }> = [];
  private waves!: Phaser.GameObjects.TileSprite;
  private wakeGraphics!: Phaser.GameObjects.Graphics;
  private markerGraphics!: Phaser.GameObjects.Graphics;
  private ballGraphics!: Phaser.GameObjects.Graphics;
  private readonly pauseReasons = new Set<string>();
  private clock = 0;
  private uiTimer = 0;
  private wakeTimer = 0;
  private pirateSpawnTimer = PIRATE_RESPAWN_SECONDS;
  private lastPirateWarning = -Infinity;
  private dockPort: Port | null = null;
  private openPortId: number | null = null;
  private autoOpenPortId: number | null = null;

  constructor() {
    super('game');
  }

  create(): void {
    const seed = readSeed();
    this.world = generateWorld(seed);
    this.rng = createRng(seed ^ 0x9e3779b9);
    console.info(`World seed: ${seed} (add ?seed=${seed} to the URL to replay this map)`);

    this.drawSea();
    this.drawIslands();
    this.wakeGraphics = this.add.graphics().setDepth(DEPTH.wake);
    this.markerGraphics = this.add.graphics().setDepth(DEPTH.marker);
    this.ballGraphics = this.add.graphics().setDepth(DEPTH.balls);

    const start = this.world.ports[this.world.startPortId];
    this.player = new Ship('player', PLAYER_STATS, start.dock, angleTo(start.shore, start.dock));
    this.addShipGraphics(this.player);
    for (let i = 0; i < INITIAL_PIRATES; i++) this.spawnPirate();

    const camera = this.cameras.main;
    camera.setBackgroundColor('#17699f');
    camera.setBounds(-WORLD_SIZE - 300, -400, WORLD_SIZE * 2 + 600, WORLD_SIZE + 800);
    this.renderShips();
    camera.startFollow(this.shipGraphics.get(this.player.id)!, true, 0.12, 0.12);
    this.applyZoom();
    this.scale.on('resize', () => this.applyZoom());

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.paused) return;
      const p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.sailTo(toWorld(p.x, p.y));
    });

    this.ui = new UI(document.getElementById('ui')!, this, () => this.showWelcome());
    onLanguageChange(() => this.refreshLabels());
    this.showWelcome();
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.clock += dt;
    if (!this.paused) this.step(dt);
    this.render();
    this.uiTimer -= dt;
    if (this.uiTimer <= 0) {
      this.uiTimer = 0.1;
      this.ui.update();
    }
  }

  private get paused(): boolean {
    return this.pauseReasons.size > 0;
  }

  // ---------------------------------------------------------------------------
  // GameApi (used by the HTML user interface)

  setPaused(reason: string, paused: boolean): void {
    if (paused) this.pauseReasons.add(reason);
    else this.pauseReasons.delete(reason);
  }

  hudState(): HudState {
    const { player, state } = this;
    return {
      gold: state.gold,
      cargoUsed: cargoUsed(state.cargo),
      capacity: state.capacity,
      hp: Math.max(0, player.hp),
      maxHp: player.stats.maxHp,
      reload: {
        left: 1 - player.reload.left / player.stats.reload,
        right: 1 - player.reload.right / player.stats.reload,
      },
      goal: GOAL_GOLD,
    };
  }

  minimapState(): MinimapState {
    return {
      player: { pos: this.player.pos, heading: this.player.heading },
      pirates: this.pirates.filter((p) => !p.dead).map((p) => p.pos),
      treasures: this.treasures.map((tr) => tr.pos),
      destination: this.player.destination,
    };
  }

  playerCargo() {
    return this.state.cargo;
  }

  /** Sails to a point; a click close to a port sails into that port. */
  sailTo(target: Vec2): void {
    if (this.paused || this.player.dead) return;
    const port = this.world.ports.find(
      (p) => dist(p.dock, target) < 80 || (dist(p.town, target) < 220 && isLand(this.world, target)),
    );
    const goal = port
      ? port.dock
      : { x: clamp(target.x, 60, WORLD_SIZE - 60), y: clamp(target.y, 60, WORLD_SIZE - 60) };
    const path = this.world.nav.findPath(this.player.pos, goal);
    if (!path) return;
    this.player.setPath(path);
    this.autoOpenPortId = port ? port.id : null;
  }

  enterPort(portId: number): void {
    if (this.openPortId !== null || this.player.dead) return;
    const port = this.world.ports[portId];
    this.openPortId = portId;
    this.autoOpenPortId = null;
    this.player.stop();
    this.player.speed = 0;
    this.setPaused('port', true);
    if (this.state.gold < STARTER_GIFT_THRESHOLD && cargoUsed(this.state.cargo) === 0) {
      this.state.gold += STARTER_GIFT;
      this.ui.toast(t('msg.gift', { amount: STARTER_GIFT }));
    }
    this.ui.openPort(port);
  }

  leavePort(): void {
    if (this.openPortId === null) return;
    this.openPortId = null;
    this.ui.closePort();
    this.setPaused('port', false);
  }

  buy(portId: number, good: GoodId, quantity: number): TradeResult {
    return buy(this.world.ports[portId].market, this.state, good, quantity);
  }

  sell(portId: number, good: GoodId, quantity: number): TradeResult {
    const result = sell(this.world.ports[portId].market, this.state, good, quantity);
    this.checkGoal();
    return result;
  }

  repairCost(): number {
    return Math.ceil((this.player.stats.maxHp - this.player.hp) * REPAIR_COST_PER_HP);
  }

  repair(): boolean {
    const missing = this.player.stats.maxHp - this.player.hp;
    const affordable = Math.min(missing, Math.floor(this.state.gold / REPAIR_COST_PER_HP));
    if (affordable <= 0) return false;
    this.player.hp += affordable;
    this.state.gold -= Math.ceil(affordable * REPAIR_COST_PER_HP);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Simulation

  private step(dt: number): void {
    const { world, player } = this;
    player.update(dt, world.nav);

    const playerTargetable = !player.dead && !inSafeZone(world, player.pos);
    for (const pirate of this.pirates) {
      if (!pirate.dead) {
        const event = updatePirate(pirate, { world, player, playerTargetable, rng: this.rng }, dt);
        if (event === 'spotted') this.warnAboutPirates();
      } else {
        pirate.sinkProgress = Math.min(1, pirate.sinkProgress + dt / 2.5);
      }
      pirate.update(dt, world.nav);
    }
    this.removeSunkPirates();
    this.updateCannons(dt, playerTargetable);
    this.updateBalls(dt);
    this.updateTreasures(dt);
    this.updateWakes(dt);
    for (const port of world.ports) tickMarket(port.market, dt);
    this.updateSpawning(dt);
    this.updateDocking();
  }

  private updateCannons(dt: number, playerTargetable: boolean): void {
    const alivePirates = this.pirates.filter((p) => !p.dead);
    for (const ship of [this.player, ...alivePirates]) {
      if (ship.dead) continue;
      for (const side of SIDES) {
        ship.reload[side] = Math.max(0, ship.reload[side] - dt);
        if (ship.reload[side] > 0) continue;
        const enemies = ship.faction === 'player' ? alivePirates : playerTargetable ? [this.player] : [];
        const target = chooseTarget(ship, side, enemies);
        if (!target) continue;
        const volley = fireVolley(ship, side, target, this.rng);
        this.balls.push(...volley);
        ship.reload[side] = ship.stats.reload;
        for (const ball of volley) this.puff(ball.pos, 10, 0xffffff, 0.7, 1);
      }
    }
  }

  private updateBalls(dt: number): void {
    const remaining: Cannonball[] = [];
    for (const ball of this.balls) {
      ball.pos = add(ball.pos, ball.vel, dt);
      ball.traveled += Math.hypot(ball.vel.x, ball.vel.y) * dt;
      const targets = ball.owner === 'player' ? this.pirates : [this.player];
      const hit = targets.find((ship) => !ship.dead && hitsShip(ball.pos, ship));
      if (hit) {
        this.puff(ball.pos, 14, 0x9a9a9a, 1.3, 3);
        this.damage(hit, ball.damage);
      } else if (isLand(this.world, ball.pos)) {
        this.puff(ball.pos, 4, 0xe8d39a, 1, 2);
      } else if (ball.traveled >= ball.flight) {
        this.splash(ball.pos);
      } else {
        remaining.push(ball);
      }
    }
    this.balls = remaining;
  }

  private damage(ship: Ship, amount: number): void {
    ship.hp -= amount;
    if (ship.faction === 'player') this.cameras.main.shake(120, 0.003);
    if (ship.hp > 0 || ship.dead) return;
    ship.hp = 0;
    ship.dead = true;
    ship.stop();
    if (ship.faction === 'pirate') {
      this.spawnTreasure(ship.pos);
      this.ui.toast(t('msg.pirateSunk'));
    } else {
      this.defeat();
    }
  }

  private defeat(): void {
    this.setPaused('defeat', true);
    const port = [...this.world.ports].sort((a, b) => dist(a.dock, this.player.pos) - dist(b.dock, this.player.pos))[0];
    const lost = Math.floor(this.state.gold * DEFEAT_GOLD_LOSS);
    this.tweens.add({
      targets: this.player,
      sinkProgress: 0.6,
      duration: 1200,
      onComplete: () =>
        this.ui.showDialog({
          icon: '🏴‍☠️',
          title: () => t('dialog.defeat.title'),
          paragraphs: () => [t('dialog.defeat.body', { gold: formatNumber(lost), port: t(port.nameKey) })],
          button: () => t('dialog.ok'),
          onClose: () => this.recoverAt(port, lost),
        }),
    });
  }

  /** After a defeat the ship is towed to a port: no game over for young players. */
  private recoverAt(port: Port, lostGold: number): void {
    const { player, state } = this;
    state.gold -= lostGold;
    state.cargo = emptyCargo();
    player.pos = { ...port.dock };
    player.heading = angleTo(port.shore, port.dock);
    player.speed = 0;
    player.hp = player.stats.maxHp;
    player.dead = false;
    player.sinkProgress = 0;
    player.reload = { left: 0, right: 0 };
    player.stop();
    this.balls = [];
    this.autoOpenPortId = null;
    for (const pirate of this.pirates) {
      pirate.brain.mode = 'patrol';
      pirate.brain.timer = 0;
    }
    this.renderShips();
    const s = toScreen(player.pos.x, player.pos.y);
    this.cameras.main.centerOn(s.x, s.y);
    this.setPaused('defeat', false);
  }

  private spawnPirate(): void {
    const pos = pirateSpawnPoint(this.world, this.player.pos, this.rng);
    if (!pos) return;
    const pirate = new Ship('pirate', PIRATE_STATS, pos, randRange(this.rng, -Math.PI, Math.PI));
    this.pirates.push(pirate);
    this.addShipGraphics(pirate);
  }

  private removeSunkPirates(): void {
    this.pirates = this.pirates.filter((pirate) => {
      if (pirate.sinkProgress < 1) return true;
      this.shipGraphics.get(pirate.id)?.destroy();
      this.shipGraphics.delete(pirate.id);
      return false;
    });
  }

  private updateSpawning(dt: number): void {
    if (this.pirates.filter((p) => !p.dead).length >= MAX_PIRATES) return;
    this.pirateSpawnTimer -= dt;
    if (this.pirateSpawnTimer <= 0) {
      this.pirateSpawnTimer = PIRATE_RESPAWN_SECONDS;
      this.spawnPirate();
    }
  }

  private warnAboutPirates(): void {
    if (this.clock - this.lastPirateWarning < 30) return;
    this.lastPirateWarning = this.clock;
    this.ui.toast(`🏴‍☠️ ${t('msg.pirates')}`);
  }

  private spawnTreasure(pos: Vec2): void {
    const s = toScreen(pos.x, pos.y);
    const image = this.add.image(s.x, s.y, 'chest').setOrigin(0.5, 0.85).setDepth(s.y + 1).setScale(0);
    this.tweens.add({ targets: image, scale: 1, duration: 400, delay: 500, ease: 'Back.Out' });
    this.tweens.add({ targets: image, y: s.y - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.treasures.push({ pos: { ...pos }, amount: randInt(this.rng, TREASURE_MIN, TREASURE_MAX), age: 0, image });
  }

  private updateTreasures(dt: number): void {
    this.treasures = this.treasures.filter((treasure) => {
      treasure.age += dt;
      if (!this.player.dead && dist(treasure.pos, this.player.pos) < TREASURE_PICKUP_RADIUS) {
        this.state.gold += treasure.amount;
        this.floatingText(treasure.pos, `+${formatNumber(treasure.amount)}`);
        this.ui.toast(`💰 ${t('msg.treasure', { amount: formatNumber(treasure.amount) })}`);
        treasure.image.destroy();
        this.checkGoal();
        return false;
      }
      if (treasure.age > TREASURE_LIFETIME) {
        this.tweens.add({ targets: treasure.image, alpha: 0, duration: 600, onComplete: () => treasure.image.destroy() });
        return false;
      }
      return true;
    });
  }

  private updateWakes(dt: number): void {
    for (const wake of this.wakes) wake.age += dt;
    this.wakes = this.wakes.filter((wake) => wake.age < 1.6);
    this.wakeTimer -= dt;
    if (this.wakeTimer > 0) return;
    this.wakeTimer = 0.08;
    for (const ship of [this.player, ...this.pirates]) {
      if (ship.dead || ship.speed < 25) continue;
      this.wakes.push({ pos: add(ship.pos, fromAngle(ship.heading), -ship.stats.length * 0.45), age: 0 });
    }
  }

  private updateDocking(): void {
    const near = this.player.dead
      ? null
      : this.world.ports.find((port) => dist(port.dock, this.player.pos) < DOCK_RADIUS) ?? null;
    if (near !== this.dockPort) {
      this.dockPort = near;
      this.ui.setDockPort(near);
    }
    if (near && this.autoOpenPortId === near.id && this.player.path.length === 0) this.enterPort(near.id);
  }

  private checkGoal(): void {
    if (this.state.goalReached || this.state.gold < GOAL_GOLD) return;
    this.state.goalReached = true;
    for (let i = 0; i < 12; i++) {
      const color = [0xff5a4f, 0xffd23f, 0x4cd964, 0x2d7dd2, 0xc86dd7][i % 5];
      this.time.delayedCall(i * 90, () => this.puff(add(this.player.pos, fromAngle(i, 40)), 40, color, 1.6, 2));
    }
    this.ui.showDialog({
      icon: '🏆',
      title: () => t('dialog.goal.title'),
      paragraphs: () => [t('dialog.goal.body', { amount: formatNumber(GOAL_GOLD) })],
      button: () => t('dialog.ok'),
    });
  }

  private showWelcome(): void {
    this.ui.showDialog({
      icon: '⛵',
      title: () => t('dialog.welcome.title'),
      paragraphs: () => [
        t('dialog.welcome.p1'),
        t('dialog.welcome.p2'),
        t('dialog.welcome.p3'),
        t('dialog.welcome.p4', { amount: formatNumber(GOAL_GOLD) }),
      ],
      button: () => t('dialog.start'),
    });
  }

  // ---------------------------------------------------------------------------
  // Rendering

  private applyZoom(): void {
    const { width, height } = this.scale;
    const zoom = clamp(Math.min(width, height * 1.5) / 1100, 0.5, 1.1);
    this.cameras.main.setZoom(zoom);
    this.waves.setSize(width / zoom + 512, height / zoom + 512);
  }

  private drawSea(): void {
    const s = WORLD_SIZE;
    const corners = [toScreen(0, 0), toScreen(s, 0), toScreen(s, s), toScreen(0, s)];
    const g = this.add.graphics().setDepth(DEPTH.sea);
    g.fillStyle(0x2aa5dd);
    g.fillPoints(corners, true);
    g.lineStyle(8, 0xffffff, 0.15);
    g.strokePoints(corners, true);
    this.waves = this.add.tileSprite(0, 0, 16, 16, 'waves').setOrigin(0, 0).setDepth(DEPTH.waves);
  }

  private drawIslands(): void {
    const decoRng = createRng(this.world.seed + 1);
    for (const island of this.world.islands) {
      const port = island.portId === null ? null : this.world.ports[island.portId];
      drawIsland(this.add.graphics().setDepth(DEPTH.island), island, port);

      for (const palm of island.palms) {
        const s = toScreen(palm.x, palm.y);
        const image = this.add.image(s.x, s.y, 'palm')
          .setOrigin(30 / 76, 76 / 82)
          .setDepth(s.y)
          .setScale(randRange(decoRng, 0.85, 1.15));
        this.tweens.add({
          targets: image,
          angle: { from: -2, to: 2 },
          duration: randRange(decoRng, 1600, 2400),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
          delay: randRange(decoRng, 0, 1000),
        });
      }
    }

    for (const port of this.world.ports) {
      for (const house of port.houses) {
        const s = toScreen(house.x, house.y);
        const texture = HOUSE_TEXTURES[randInt(decoRng, 0, HOUSE_TEXTURES.length - 1)];
        this.add.image(s.x, s.y, texture).setOrigin(0.5, 40 / 44).setDepth(s.y);
      }
      const town = toScreen(port.town.x, port.town.y);
      this.add.image(town.x - 30, town.y + 4, 'portflag').setOrigin(6 / 30, 51 / 54).setDepth(town.y + 4);

      const style: Phaser.Types.GameObjects.Text.TextStyle = {
        fontFamily: FONT,
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#1d3557',
        strokeThickness: 5,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      };
      const name = this.add.text(town.x, town.y - 70, '', style).setOrigin(0.5, 1).setDepth(DEPTH.labels);
      const wants = this.add
        .text(town.x, town.y - 68, '', { ...style, fontSize: '16px', strokeThickness: 4 })
        .setOrigin(0.5, 0)
        .setDepth(DEPTH.labels);
      this.portLabels.push({ port, name, wants });
    }
    this.refreshLabels();
  }

  private refreshLabels(): void {
    for (const { port, name, wants } of this.portLabels) {
      name.setText(t(port.nameKey));
      wants.setText(`${t('port.wants')} ${port.demands.map((good) => GOOD_INFO[good].icon).join(' ')}`);
    }
  }

  private addShipGraphics(ship: Ship): void {
    this.shipGraphics.set(ship.id, this.add.graphics());
  }

  private render(): void {
    this.renderWaves();
    this.renderShips();
    this.renderBalls();
    this.renderWakes();
    this.renderMarker();
  }

  private renderWaves(): void {
    const view = this.cameras.main.worldView;
    this.waves.setPosition(view.x - 256, view.y - 256);
    this.waves.tilePositionX = view.x - 256 + this.clock * 8;
    this.waves.tilePositionY = view.y - 256;
  }

  private renderShips(): void {
    for (const ship of [this.player, ...this.pirates]) {
      const g = this.shipGraphics.get(ship.id);
      if (!g) continue;
      const s = toScreen(ship.pos.x, ship.pos.y);
      g.setPosition(s.x, s.y).setDepth(s.y);
      drawShip(g, ship, ship.faction === 'player' ? PLAYER_PALETTE : PIRATE_PALETTE, this.clock);
    }
  }

  private renderBalls(): void {
    const g = this.ballGraphics;
    g.clear();
    for (const ball of this.balls) {
      const ground = toScreen(ball.pos.x, ball.pos.y);
      const z = ballHeight(ball);
      g.fillStyle(0x000000, 0.22);
      g.fillEllipse(ground.x, ground.y, 7, 3.5);
      g.fillStyle(0x2a2a2a);
      g.fillCircle(ground.x, ground.y - z, 3.8);
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(ground.x - 1.2, ground.y - z - 1.2, 1.1);
    }
  }

  private renderWakes(): void {
    const g = this.wakeGraphics;
    g.clear();
    for (const wake of this.wakes) {
      const s = toScreen(wake.pos.x, wake.pos.y);
      const r = 3 + wake.age * 7;
      g.fillStyle(0xffffff, 0.45 * (1 - wake.age / 1.6));
      g.fillEllipse(s.x, s.y, r * 2, r);
    }
  }

  private renderMarker(): void {
    const g = this.markerGraphics;
    g.clear();
    const destination = this.player.destination;
    if (!destination) return;
    const s = toScreen(destination.x, destination.y);
    const pulse = 1 + 0.15 * Math.sin(this.clock * 6);
    g.lineStyle(3, 0xffffff, 0.85);
    g.strokeEllipse(s.x, s.y, 44 * pulse, 22 * pulse);
    g.lineStyle(2, 0xffd23f, 0.9);
    g.strokeEllipse(s.x, s.y, 20 * pulse, 10 * pulse);
  }

  private puff(pos: Vec2, z: number, color: number, scale: number, count: number): void {
    const s = toScreen(pos.x, pos.y, z);
    for (let i = 0; i < count; i++) {
      const image = this.add
        .image(s.x + randRange(this.rng, -6, 6), s.y + randRange(this.rng, -4, 4), 'puff')
        .setTint(color)
        .setDepth(DEPTH.effects)
        .setScale(scale * 0.5)
        .setAlpha(0.9);
      this.tweens.add({
        targets: image,
        scale: scale * randRange(this.rng, 1.2, 1.8),
        alpha: 0,
        y: image.y - 12,
        duration: randRange(this.rng, 600, 900),
        onComplete: () => image.destroy(),
      });
    }
  }

  private splash(pos: Vec2): void {
    const s = toScreen(pos.x, pos.y);
    const ring = this.add.graphics().setDepth(s.y).setPosition(s.x, s.y);
    ring.lineStyle(2, 0xffffff, 0.9);
    ring.strokeEllipse(0, 0, 14, 7);
    this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
    this.puff(pos, 6, 0xd8f6ff, 0.6, 2);
  }

  private floatingText(pos: Vec2, text: string): void {
    const s = toScreen(pos.x, pos.y, 50);
    const label = this.add
      .text(s.x, s.y, text, {
        fontFamily: FONT,
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffd23f',
        stroke: '#5a3a1e',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.labels);
    this.tweens.add({ targets: label, y: s.y - 50, alpha: 0, duration: 1400, onComplete: () => label.destroy() });
  }
}
