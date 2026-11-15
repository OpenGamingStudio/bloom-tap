import { describe, expect, it } from 'vitest';
import { createGame, lifespan, multiplier, spawnGap, stageOf, tap, tick, type Perks } from '../src/sim';
import { makeRng } from '../src/rng';
import * as C from '../src/config';

const none: Perks = { gold: false, slow: false, life: false };
const mk = (p: Perks = none, seed = 1) => createGame(p, makeRng(seed));
const firstFlower = (g: ReturnType<typeof mk>) => g.cells.findIndex((c) => c !== null);

describe('rythme', () => {
  it('une fleur dure 2 à 3 s, la vitesse monte peu à peu', () => {
    expect(lifespan(0, none)).toBe(3000);
    expect(lifespan(C.RAMP_MS, none)).toBe(1600);
    expect(lifespan(C.RAMP_MS * 5, none)).toBe(1600);
    expect(lifespan(60000, none)).toBeLessThan(lifespan(1000, none));
    expect(spawnGap(60000)).toBeLessThan(spawnGap(0));
  });
  it('la fleur lente prolonge la vie', () => {
    expect(lifespan(0, { ...none, slow: true })).toBeCloseTo(3000 * C.SLOW_FACTOR);
  });
  it('apparition après FIRST_SPAWN, sur une case libre', () => {
    const g = mk();
    expect(tick(g, C.FIRST_SPAWN - 1)).toEqual([]);
    const ev = tick(g, 1);
    expect(ev[0]?.t).toBe('spawn');
    expect(g.cells.filter(Boolean)).toHaveLength(1);
  });
  it('jamais plus de 16 fleurs', () => {
    const g = mk(none);
    g.lives = 1e9;
    for (let i = 0; i < 400; i++) tick(g, 50);
    expect(g.cells.filter(Boolean).length).toBeLessThanOrEqual(C.CELLS);
  });
  it('stades : bouton, ouverte, fanée', () => {
    expect(stageOf({ kind: 'normal', age: 0, life: 1000 })).toBe('bud');
    expect(stageOf({ kind: 'normal', age: 400, life: 1000 })).toBe('bloom');
    expect(stageOf({ kind: 'normal', age: 800, life: 1000 })).toBe('wilt');
  });
});

describe('éclosion et combo', () => {
  it('tap sur une case vide ne fait rien', () => {
    const g = mk();
    expect(tap(g, 0)).toBeNull();
    expect(g.score).toBe(0);
  });
  it('un tap fait éclore : points, pétale', () => {
    const g = mk();
    tick(g, C.FIRST_SPAWN);
    const i = firstFlower(g);
    const ev = tap(g, i);
    expect(ev).toMatchObject({ t: 'bloom', points: 10, combo: 1, gold: false });
    expect(g.score).toBe(10);
    expect(g.petals).toBe(1);
    expect(g.cells[i]).toBeNull();
  });
  it('multiplicateur par paliers, plafonné', () => {
    expect([1, 3, 4, 6, 7, 100].map(multiplier)).toEqual([1, 1, 2, 2, 3, C.MULT_MAX]);
  });
  it('taps rapides = combo, tap tardif = retour à 1', () => {
    const g = mk();
    g.cells[0] = { kind: 'normal', age: 0, life: 3000 };
    g.cells[1] = { kind: 'normal', age: 0, life: 3000 };
    g.cells[2] = { kind: 'normal', age: 0, life: 3000 };
    tap(g, 0);
    tick(g, 300);
    expect(tap(g, 1)).toMatchObject({ combo: 2 });
    tick(g, C.COMBO_WINDOW + 10);
    expect(g.combo).toBe(0);
    expect(tap(g, 2)).toMatchObject({ combo: 1 });
    expect(g.bestCombo).toBe(2);
  });
  it('fleur dorée = x2 et 2 pétales', () => {
    const g = mk();
    g.cells[5] = { kind: 'gold', age: 0, life: 3000 };
    expect(tap(g, 5)).toMatchObject({ points: 20, gold: true });
    expect(g.petals).toBe(2);
  });
  it('la fleur dorée n\'apparaît que si elle est achetée', () => {
    const g = mk(none, 7);
    g.lives = 1e9;
    for (let i = 0; i < 200; i++) tick(g, 100);
    expect(g.cells.some((c) => c?.kind === 'gold')).toBe(false);
    const h = mk({ ...none, gold: true }, 7);
    h.lives = 1e9;
    let gold = 0;
    for (let i = 0; i < 400; i++) {
      tick(h, 100);
      for (const c of h.cells) if (c?.kind === 'gold') gold++;
    }
    expect(gold).toBeGreaterThan(0);
  });
});

describe('vies', () => {
  it('3 vies, 4 avec le perk', () => {
    expect(mk().lives).toBe(3);
    expect(mk({ ...none, life: true }).lives).toBe(4);
  });
  it('une fleur fanée coûte une vie et casse le combo', () => {
    const g = mk();
    g.combo = 5;
    g.sinceTap = 0;
    g.cells[3] = { kind: 'normal', age: 0, life: 1000 };
    const ev = tick(g, 1000);
    expect(ev).toContainEqual({ t: 'wilt', i: 3, lives: 2 });
    expect(g.combo).toBe(0);
  });
  it('fin de partie à 0 vie, puis plus rien ne bouge', () => {
    const g = mk();
    g.lives = 1;
    g.cells[0] = { kind: 'normal', age: 0, life: 100 };
    g.cells[1] = { kind: 'normal', age: 0, life: 3000 };
    const ev = tick(g, 100);
    expect(ev.map((e) => e.t)).toEqual(['wilt', 'over']);
    expect(g.over).toBe(true);
    expect(tick(g, 1000)).toEqual([]);
    expect(tap(g, 1)).toBeNull();
  });
});
