import { dist, type Vec2 } from '../core/math';

const SQRT2 = Math.SQRT2;
const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** Coarse grid of navigable water cells with A* path finding. The outermost ring is always blocked. */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly blocked: Uint8Array;

  constructor(
    readonly size: number,
    readonly cell: number,
    isBlocked: (p: Vec2) => boolean,
  ) {
    this.cols = Math.ceil(size / cell);
    this.rows = Math.ceil(size / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const edge = cx === 0 || cy === 0 || cx === this.cols - 1 || cy === this.rows - 1;
        this.blocked[cy * this.cols + cx] = edge || isBlocked(this.center(cx, cy)) ? 1 : 0;
      }
    }
  }

  center(cx: number, cy: number): Vec2 {
    return { x: (cx + 0.5) * this.cell, y: (cy + 0.5) * this.cell };
  }

  private blockedCell(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return true;
    return this.blocked[cy * this.cols + cx] === 1;
  }

  isFree(p: Vec2): boolean {
    return !this.blockedCell(Math.floor(p.x / this.cell), Math.floor(p.y / this.cell));
  }

  lineOfSight(a: Vec2, b: Vec2): boolean {
    const steps = Math.ceil(dist(a, b) / (this.cell * 0.25));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      if (!this.isFree({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
    }
    return true;
  }

  /** Returns `p` if it is navigable, otherwise the closest free cell center (or null if none nearby). */
  nearestFree(p: Vec2, maxRadius = 40): Vec2 | null {
    if (this.isFree(p)) return p;
    const pcx = Math.floor(p.x / this.cell);
    const pcy = Math.floor(p.y / this.cell);
    for (let r = 1; r <= maxRadius; r++) {
      let best: Vec2 | null = null;
      let bestDist = Infinity;
      for (let cy = pcy - r; cy <= pcy + r; cy++) {
        for (let cx = pcx - r; cx <= pcx + r; cx++) {
          if (Math.max(Math.abs(cx - pcx), Math.abs(cy - pcy)) !== r || this.blockedCell(cx, cy)) continue;
          const c = this.center(cx, cy);
          const d = dist(c, p);
          if (d < bestDist) {
            bestDist = d;
            best = c;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** Finds a smoothed path of waypoints from `from` to (the water nearest to) `to`, excluding the start. */
  findPath(from: Vec2, to: Vec2): Vec2[] | null {
    const start = this.nearestFree(from);
    const goal = this.nearestFree(to);
    if (!start || !goal) return null;
    if (this.lineOfSight(start, goal)) return start === from ? [goal] : [start, goal];

    const cols = this.cols;
    const s = Math.floor(start.y / this.cell) * cols + Math.floor(start.x / this.cell);
    const g = Math.floor(goal.y / this.cell) * cols + Math.floor(goal.x / this.cell);
    const gx = g % cols;
    const gy = Math.floor(g / cols);
    const n = cols * this.rows;
    const cost = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const heap = new MinHeap();
    const heuristic = (i: number) => {
      const dx = Math.abs((i % cols) - gx);
      const dy = Math.abs(Math.floor(i / cols) - gy);
      return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
    };

    cost[s] = 0;
    heap.push(s, heuristic(s));
    while (heap.size > 0) {
      const cur = heap.pop();
      if (closed[cur]) continue;
      if (cur === g) break;
      closed[cur] = 1;
      const cx = cur % cols;
      const cy = Math.floor(cur / cols);
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (this.blockedCell(nx, ny)) continue;
        // Do not cut corners of land diagonally.
        if (dx !== 0 && dy !== 0 && (this.blockedCell(cx + dx, cy) || this.blockedCell(cx, cy + dy))) continue;
        const ni = ny * cols + nx;
        if (closed[ni]) continue;
        const next = cost[cur] + (dx !== 0 && dy !== 0 ? SQRT2 : 1);
        if (next < cost[ni]) {
          cost[ni] = next;
          came[ni] = cur;
          heap.push(ni, next + heuristic(ni));
        }
      }
    }
    if (g !== s && came[g] === -1) return null;

    const cells: Vec2[] = [];
    for (let i = came[g]; i !== -1 && i !== s; i = came[i]) {
      cells.push(this.center(i % cols, Math.floor(i / cols)));
    }
    cells.reverse();
    return this.smooth([start, ...cells, goal], start !== from);
  }

  /** Greedy string pulling: skip waypoints as long as there is a straight line of water. */
  private smooth(points: Vec2[], keepStart: boolean): Vec2[] {
    const out: Vec2[] = keepStart ? [points[0]] : [];
    const last = points.length - 1;
    let anchor = 0;
    while (anchor < last) {
      let next = anchor + 1;
      while (next < last && this.lineOfSight(points[anchor], points[next + 1])) next++;
      out.push(points[next]);
      anchor = next;
    }
    return out;
  }
}

class MinHeap {
  private items: number[] = [];
  private priorities: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, priority: number): void {
    this.items.push(item);
    this.priorities.push(priority);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.priorities[parent] <= this.priorities[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop()!;
    const lastPriority = this.priorities.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.priorities[0] = lastPriority;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.items.length && this.priorities[l] < this.priorities[smallest]) smallest = l;
        if (r < this.items.length && this.priorities[r] < this.priorities[smallest]) smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.priorities[a], this.priorities[b]] = [this.priorities[b], this.priorities[a]];
  }
}
