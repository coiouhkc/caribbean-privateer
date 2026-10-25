import { toScreen, toWorld } from '../core/iso';
import { t } from '../i18n';
import type { GameApi } from './api';

const WIDTH = 200;
const HEIGHT = 100;
const PADDING = 6;

/** Small isometric overview map; clicking it sends the ship there. */
export class Minimap {
  readonly canvas = document.createElement('canvas');
  private readonly background = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly scale: number;
  private readonly ratio = Math.min(window.devicePixelRatio || 1, 3);

  constructor(
    parent: HTMLElement,
    private readonly api: GameApi,
  ) {
    const size = api.world.size;
    this.scale = (WIDTH - PADDING * 2) / (size * 2);
    for (const canvas of [this.canvas, this.background]) {
      canvas.width = WIDTH * this.ratio;
      canvas.height = HEIGHT * this.ratio;
    }
    this.canvas.className = 'panel minimap';
    this.ctx = this.canvas.getContext('2d')!;
    this.drawBackground();
    this.canvas.addEventListener('click', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = ((event.clientX - rect.left) / rect.width) * WIDTH;
      const my = ((event.clientY - rect.top) / rect.height) * HEIGHT;
      const world = toWorld((mx - WIDTH / 2) / this.scale, (my - PADDING) / this.scale);
      api.sailTo(world);
    });
    parent.append(this.canvas);
    this.refreshTexts();
  }

  refreshTexts(): void {
    this.canvas.title = t('hud.minimap');
  }

  private project(x: number, y: number): { x: number; y: number } {
    const s = toScreen(x, y);
    return { x: WIDTH / 2 + s.x * this.scale, y: PADDING + s.y * this.scale };
  }

  private drawBackground(): void {
    const ctx = this.background.getContext('2d')!;
    ctx.scale(this.ratio, this.ratio);
    const size = this.api.world.size;
    const corners = [this.project(0, 0), this.project(size, 0), this.project(size, size), this.project(0, size)];
    ctx.fillStyle = '#2aa5dd';
    this.polygon(ctx, corners);
    ctx.fill();
    for (const island of this.api.world.islands) {
      ctx.fillStyle = '#f6dd94';
      this.polygon(ctx, island.poly.map((p) => this.project(p.x, p.y)));
      ctx.fill();
    }
    for (const port of this.api.world.ports) {
      const p = this.project(port.town.x, port.town.y);
      ctx.fillStyle = '#e0533d';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  private polygon(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>): void {
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
  }

  draw(): void {
    const { ctx } = this;
    const state = this.api.minimapState();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.background, 0, 0);
    ctx.scale(this.ratio, this.ratio);

    const dot = (x: number, y: number, r: number, color: string) => {
      const p = this.project(x, y);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    if (state.destination) {
      const p = this.project(state.destination.x, state.destination.y);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 5, 2.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const tr of state.treasures) dot(tr.x, tr.y, 3, '#ffd23f');
    for (const pirate of state.pirates) dot(pirate.x, pirate.y, 3.5, '#222222');
    dot(state.player.pos.x, state.player.pos.y, 5, '#ffffff');
    dot(state.player.pos.x, state.player.pos.y, 3.5, '#2d7dd2');
  }
}
