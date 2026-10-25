import type Phaser from 'phaser';
import { toScreen } from '../core/iso';
import { add, fromAngle, type Vec2 } from '../core/math';
import type { Island, Port } from '../world/worldgen';

/** Draws the flat parts of an island (shallows, beach, grass, pier) in screen coordinates. */
export function drawIsland(g: Phaser.GameObjects.Graphics, island: Island, port: Port | null): void {
  const ring = (scale: number, dy = 0) =>
    island.poly.map((p) => {
      const s = toScreen(
        island.center.x + (p.x - island.center.x) * scale,
        island.center.y + (p.y - island.center.y) * scale,
      );
      return { x: s.x, y: s.y + dy };
    });

  g.fillStyle(0x7fe0e8, 0.3);
  g.fillPoints(ring(1.3), true);
  g.fillStyle(0xa6f2ee, 0.45);
  g.fillPoints(ring(1.12), true);

  if (port) drawPier(g, port);

  g.fillStyle(0xcaa463);
  g.fillPoints(ring(1, 6), true);
  g.fillStyle(0xf6dd94);
  g.fillPoints(ring(1), true);
  g.fillStyle(0x7ccf52);
  g.fillPoints(ring(0.8), true);
  g.fillStyle(0x66bd43);
  g.fillPoints(ring(0.5), true);
}

function drawPier(g: Phaser.GameObjects.Graphics, port: Port): void {
  const dir = Math.atan2(port.dock.y - port.shore.y, port.dock.x - port.shore.x);
  const side = fromAngle(dir + Math.PI / 2, 9);
  const start = add(port.shore, fromAngle(dir, -20));
  const end = add(port.dock, fromAngle(dir, -24));
  const quad = [add(start, side), add(end, side), add(end, side, -1), add(start, side, -1)];
  const screen = (p: Vec2, dy = 0) => {
    const s = toScreen(p.x, p.y);
    return { x: s.x, y: s.y + dy };
  };

  g.fillStyle(0x6b4423);
  g.fillPoints(quad.map((p) => screen(p, 4)), true);
  g.fillStyle(0xb07a43);
  g.fillPoints(quad.map((p) => screen(p)), true);
  g.lineStyle(1, 0x7a5230, 0.8);
  const planks = 8;
  for (let i = 1; i < planks; i++) {
    const c = add(start, { x: end.x - start.x, y: end.y - start.y }, i / planks);
    const a = screen(add(c, side));
    const b = screen(add(c, side, -1));
    g.lineBetween(a.x, a.y, b.x, b.y);
  }
}
