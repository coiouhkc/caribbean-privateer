import Phaser from 'phaser';
import { createRng, randRange } from '../core/rng';

export const HOUSE_TEXTURES = ['house-red', 'house-blue', 'house-orange', 'house-green'] as const;
const ROOF_COLORS = [0xe0533d, 0x3d7fe0, 0xf09a2a, 0x4caf50];

type G = Phaser.GameObjects.Graphics;

/** All art is generated at start-up, so the game needs no image files. */
export function generateTextures(scene: Phaser.Scene): void {
  const make = (key: string, width: number, height: number, draw: (g: G) => void) => {
    const g = scene.make.graphics({}, false);
    draw(g);
    g.generateTexture(key, width, height);
    g.destroy();
  };

  make('waves', 256, 256, drawWaves);
  make('palm', 76, 82, drawPalm);
  HOUSE_TEXTURES.forEach((key, i) => make(key, 40, 44, (g) => drawHouse(g, ROOF_COLORS[i])));
  make('chest', 36, 32, drawChest);
  make('puff', 32, 32, (g) => {
    for (let r = 16; r > 1; r -= 2) {
      g.fillStyle(0xffffff, 0.14);
      g.fillCircle(16, 16, r);
    }
  });
  make('portflag', 30, 54, drawPortFlag);
}

function drawWaves(g: G): void {
  const rng = createRng(7);
  g.lineStyle(2, 0xffffff, 0.3);
  for (let i = 0; i < 14; i++) {
    const x = randRange(rng, 24, 232);
    const y = randRange(rng, 24, 232);
    const r = randRange(rng, 6, 12);
    g.beginPath();
    g.arc(x, y, r, Math.PI * 1.15, Math.PI * 1.85);
    g.strokePath();
  }
}

function leafPoints(cx: number, cy: number, angle: number, length: number): Phaser.Math.Vector2[] {
  const top: Phaser.Math.Vector2[] = [];
  const bottom: Phaser.Math.Vector2[] = [];
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const droop = t * t * length * 0.45;
    const x = cx + dx * length * t;
    const y = cy + dy * length * t + droop;
    const w = Math.sin(Math.PI * t) * 6;
    top.push(new Phaser.Math.Vector2(x - dy * w, y + dx * w));
    bottom.push(new Phaser.Math.Vector2(x + dy * w, y - dx * w));
  }
  return [...top, ...bottom.reverse()];
}

function drawPalm(g: G): void {
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(30, 76, 30, 10);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    g.fillStyle(i % 2 === 0 ? 0x9b6a3a : 0x84552a);
    g.fillEllipse(30 + 9 * t * t, 76 - 52 * t, 10 - 3 * t, 8);
  }
  const top = { x: 39, y: 24 };
  const leaves = [-170, -130, -95, -50, -10, 30, 150].map((deg) => (deg * Math.PI) / 180);
  leaves.forEach((angle, i) => {
    g.fillStyle(i % 2 === 0 ? 0x3fae49 : 0x2f9a3e);
    g.fillPoints(leafPoints(top.x, top.y, angle, 26), true);
  });
  g.fillStyle(0x6b4423);
  g.fillCircle(36, 28, 3.5);
  g.fillCircle(42, 28, 3.5);
  g.fillCircle(39, 31, 3.5);
}

function drawHouse(g: G, roof: number): void {
  const left = { x: 6, y: 33 };
  const bottom = { x: 20, y: 40 };
  const right = { x: 34, y: 33 };
  const h = 14;
  g.fillStyle(0x000000, 0.15);
  g.fillEllipse(20, 37, 36, 12);
  g.fillStyle(0xfff1d6);
  g.fillPoints([left, bottom, { x: bottom.x, y: bottom.y - h }, { x: left.x, y: left.y - h }], true);
  g.fillStyle(0xe6cda6);
  g.fillPoints([bottom, right, { x: right.x, y: right.y - h }, { x: bottom.x, y: bottom.y - h }], true);
  // Window on the left wall, door on the right wall.
  g.fillStyle(0x5ab4e8);
  g.fillPoints([{ x: 10, y: 28 }, { x: 15, y: 30.5 }, { x: 15, y: 25.5 }, { x: 10, y: 23 }], true);
  g.fillStyle(0x8b5a2b);
  g.fillPoints([{ x: 25, y: 38 }, { x: 30, y: 35.5 }, { x: 30, y: 27.5 }, { x: 25, y: 30 }], true);
  const apex = { x: 20, y: 8 };
  g.fillStyle(roof);
  g.fillPoints([{ x: left.x - 2, y: left.y - h }, { x: bottom.x, y: bottom.y - h + 2 }, apex], true);
  g.fillStyle(Phaser.Display.Color.ValueToColor(roof).darken(20).color);
  g.fillPoints([{ x: bottom.x, y: bottom.y - h + 2 }, { x: right.x + 2, y: right.y - h }, apex], true);
}

function drawChest(g: G): void {
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(18, 28, 30, 8);
  g.fillStyle(0x8b5a2b);
  g.fillRect(5, 14, 26, 13);
  g.fillStyle(0xa86c34);
  g.fillRoundedRect(4, 6, 28, 10, 4);
  g.fillStyle(0xf5c542);
  g.fillRect(16, 6, 4, 21);
  g.fillRect(4, 14, 28, 2);
  g.fillStyle(0xd4a017);
  g.fillRect(14.5, 13, 7, 6);
  g.fillStyle(0xfff6b0);
  g.fillCircle(9, 5, 2);
  g.fillCircle(27, 3, 1.5);
}

function drawPortFlag(g: G): void {
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(6, 51, 10, 4);
  g.fillStyle(0x6b4423);
  g.fillRect(4, 4, 3, 48);
  g.fillStyle(0xe0533d);
  g.fillTriangle(7, 5, 28, 11, 7, 19);
  g.fillStyle(0xffffff);
  g.fillTriangle(7, 9, 19, 11.5, 7, 14);
}
