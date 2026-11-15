import { describe, expect, it } from 'vitest';
import { buy, freshSave, load, sanitize, write, type Store } from '../src/save';
import { SAVE_KEY, SAVE_VERSION } from '../src/config';

const fake = (init: Record<string, string> = {}): Store & { m: Record<string, string> } => {
  const m = { ...init };
  return { m, getItem: (k) => m[k] ?? null, setItem: (k, v) => void (m[k] = v) };
};

describe('sauvegarde', () => {
  it('stockage vide : sauvegarde neuve', () => {
    const l = load(fake());
    expect(l.data).toEqual(freshSave());
    expect(l.persistent).toBe(true);
  });
  it('sans stockage : jouable, non persistant', () => {
    const l = load(null);
    expect(l.persistent).toBe(false);
    expect(write(null, l)).toBe(false);
  });
  it('aller-retour', () => {
    const s = fake();
    const l = load(s);
    l.data.best = 120;
    l.data.petals = 7;
    expect(write(s, l)).toBe(true);
    expect(load(s).data).toMatchObject({ best: 120, petals: 7, v: SAVE_VERSION });
  });
  it('JSON cassé : copie de secours et remise à zéro', () => {
    const s = fake({ [SAVE_KEY]: '{oups' });
    expect(load(s).data).toEqual(freshSave());
    expect(s.m[SAVE_KEY + '.corrupt']).toBe('{oups');
  });
  it('valeurs invalides nettoyées', () => {
    const d = sanitize({ best: -5, petals: 'x', games: 3.7, owned: ['gold', 'gold', 'bidon', 4] });
    expect(d).toMatchObject({ best: 0, petals: 0, games: 3, owned: ['gold'] });
  });
  it('version future : lue mais jamais écrasée', () => {
    const s = fake({ [SAVE_KEY]: JSON.stringify({ v: SAVE_VERSION + 1, best: 9 }) });
    const l = load(s);
    expect(l.data.best).toBe(9);
    expect(write(s, l)).toBe(false);
  });
  it('quota plein : écriture refusée sans planter', () => {
    const s: Store = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    expect(write(s, load(s))).toBe(false);
  });
});

describe('boutique', () => {
  it('achat : prix débité, une seule fois', () => {
    const d = freshSave();
    d.petals = 100;
    expect(buy(d, 'slow')).toBe(true);
    expect(d.petals).toBe(70);
    expect(buy(d, 'slow')).toBe(false);
    expect(d.owned).toEqual(['slow']);
  });
  it('pas assez de pétales : refusé', () => {
    const d = freshSave();
    d.petals = 59;
    expect(buy(d, 'life')).toBe(false);
    expect(d.petals).toBe(59);
  });
});
