import * as C from './config';
import type { Rng } from './rng';

export type Kind = 'normal' | 'gold' | 'weed' | 'bomb';
export type Mode = 'easy' | 'hard';
export const isTrap = (k: Kind): boolean => k === 'weed' || k === 'bomb';
export type Stage = 'bud' | 'bloom' | 'wilt';

export interface Flower {
  kind: Kind;
  age: number;
  life: number;
}

export interface Perks {
  gold: boolean;
  slow: boolean;
  life: boolean;
}

export interface Game {
  cells: (Flower | null)[];
  lives: number;
  maxLives: number;
  score: number;
  combo: number;
  bestCombo: number;
  sinceTap: number;
  elapsed: number;
  nextSpawn: number;
  petals: number;
  blooms: number;
  over: boolean;
  hard: boolean;
  perks: Perks;
  rng: Rng;
}

export type Ev =
  | { t: 'spawn'; i: number }
  | { t: 'bloom'; i: number; points: number; combo: number; gold: boolean }
  | { t: 'wilt'; i: number; lives: number }
  | { t: 'trap'; i: number; kind: 'weed' | 'bomb'; lives: number; cleared: number[] }
  | { t: 'over' };

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ramp = (elapsed: number) => Math.min(1, Math.max(0, elapsed / C.RAMP_MS));

export const lifespan = (elapsed: number, perks: Perks): number =>
  lerp(C.LIFE_START, C.LIFE_END, ramp(elapsed)) * (perks.slow ? C.SLOW_FACTOR : 1);

export const spawnGap = (elapsed: number): number => lerp(C.GAP_START, C.GAP_END, ramp(elapsed));

/** Multiplicateur du combo : ×1 jusqu'à 3, ×2 de 4 à 6, etc., plafonné. */
export const multiplier = (combo: number): number =>
  Math.min(C.MULT_MAX, 1 + Math.floor(Math.max(0, combo - 1) / C.COMBO_STEP));

export function createGame(perks: Perks, rng: Rng, hard = false): Game {
  const lives = C.BASE_LIVES + (perks.life ? 1 : 0);
  return {
    cells: Array.from({ length: C.CELLS }, () => null),
    lives,
    maxLives: lives,
    score: 0,
    combo: 0,
    bestCombo: 0,
    sinceTap: Infinity,
    elapsed: 0,
    nextSpawn: C.FIRST_SPAWN,
    petals: 0,
    blooms: 0,
    over: false,
    hard,
    perks,
    rng,
  };
}

export function stageOf(f: Flower): Stage {
  if (isTrap(f.kind)) return 'bloom';
  const k = f.age / f.life;
  return k < C.BUD_PART ? 'bud' : k < C.WILT_PART ? 'bloom' : 'wilt';
}

/** Fait avancer la partie de dt ms ; renvoie ce qui s'est passé. */
export function tick(g: Game, dt: number): Ev[] {
  const ev: Ev[] = [];
  if (g.over) return ev;
  g.elapsed += dt;
  g.sinceTap += dt;
  if (g.sinceTap > C.COMBO_WINDOW) g.combo = 0;

  for (let i = 0; i < g.cells.length; i++) {
    const f = g.cells[i];
    if (!f) continue;
    f.age += dt;
    if (f.age >= f.life) {
      g.cells[i] = null;
      if (isTrap(f.kind)) continue; // un piège ignoré disparaît sans rien coûter
      g.combo = 0;
      g.lives--;
      ev.push({ t: 'wilt', i, lives: g.lives });
      if (g.lives <= 0) {
        g.over = true;
        ev.push({ t: 'over' });
        return ev;
      }
    }
  }

  while (g.elapsed >= g.nextSpawn) {
    const free: number[] = [];
    g.cells.forEach((c, i) => {
      if (!c) free.push(i);
    });
    if (free.length === 0) {
      g.nextSpawn = g.elapsed + 100;
      break;
    }
    const i = free[Math.floor(g.rng() * free.length)];
    let kind: Kind;
    if (g.hard && g.rng() < C.TRAP_CHANCE) kind = g.rng() < C.BOMB_SHARE ? 'bomb' : 'weed';
    else kind = g.perks.gold && g.rng() < C.GOLD_CHANCE ? 'gold' : 'normal';
    g.cells[i] = { kind, age: 0, life: lifespan(g.elapsed, g.perks) };
    g.nextSpawn += spawnGap(g.elapsed);
    ev.push({ t: 'spawn', i });
  }
  return ev;
}

/** Explosion en i : efface les fleurs des cases voisines (sans points ni vie perdue) ; renvoie les cases vidées. */
function blast(g: Game, i: number): number[] {
  const r0 = Math.floor(i / C.GRID);
  const c0 = i % C.GRID;
  const out: number[] = [];
  for (let r = Math.max(0, r0 - C.BOMB_RADIUS); r <= Math.min(C.GRID - 1, r0 + C.BOMB_RADIUS); r++) {
    for (let c = Math.max(0, c0 - C.BOMB_RADIUS); c <= Math.min(C.GRID - 1, c0 + C.BOMB_RADIUS); c++) {
      const k = r * C.GRID + c;
      if (k !== i && g.cells[k]) {
        g.cells[k] = null;
        out.push(k);
      }
    }
  }
  return out;
}

/** Un tap sur la case i : éclosion si une fleur y est, rien sinon. */
export function tap(g: Game, i: number): Ev | null {
  const f = g.cells[i];
  if (g.over || !f) return null;
  g.cells[i] = null;
  if (f.kind === 'weed' || f.kind === 'bomb') {
    g.combo = 0;
    g.sinceTap = Infinity;
    const cleared = f.kind === 'bomb' ? blast(g, i) : [];
    g.lives = Math.max(0, g.lives - (f.kind === 'bomb' ? C.BOMB_PENALTY : C.WEED_PENALTY));
    if (g.lives <= 0) g.over = true;
    return { t: 'trap', i, kind: f.kind, lives: g.lives, cleared };
  }
  g.combo = g.sinceTap <= C.COMBO_WINDOW ? g.combo + 1 : 1;
  g.sinceTap = 0;
  g.bestCombo = Math.max(g.bestCombo, g.combo);
  const gold = f.kind === 'gold';
  const points = C.BASE_POINTS * multiplier(g.combo) * (gold ? C.GOLD_FACTOR : 1);
  g.score += points;
  g.petals += gold ? 2 : 1;
  g.blooms++;
  return { t: 'bloom', i, points, combo: g.combo, gold };
}
