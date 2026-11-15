import { SAVE_KEY, SAVE_VERSION } from './config';
import { itemById, type PerkId } from './shop';

export interface SaveData {
  v: number;
  best: number;
  petals: number;
  games: number;
  owned: PerkId[];
}

/** Stockage minimal (localStorage ou un faux pour les tests). */
export interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export const freshSave = (): SaveData => ({ v: SAVE_VERSION, best: 0, petals: 0, games: 0, owned: [] });

const int = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);

/** Migrations en chaîne : migrate[n] passe la version n à n+1. */
export const migrate: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {};

/** Nettoie un objet lu : entiers ≥ 0, achats inconnus ou en double retirés. */
export function sanitize(raw: Record<string, unknown>): SaveData {
  const s = freshSave();
  s.best = int(raw.best);
  s.petals = int(raw.petals);
  s.games = int(raw.games);
  const owned = Array.isArray(raw.owned) ? raw.owned : [];
  for (const id of owned) {
    if (typeof id === 'string' && itemById(id) && !s.owned.includes(id as PerkId)) s.owned.push(id as PerkId);
  }
  return s;
}

export interface Loaded {
  data: SaveData;
  /** false : version future, on n'écrit pas par-dessus. */
  writable: boolean;
  /** true : le stockage est utilisable (sinon message « progression non sauvegardée »). */
  persistent: boolean;
}

export function load(store: Store | null): Loaded {
  if (!store) return { data: freshSave(), writable: true, persistent: false };
  let text: string | null;
  try {
    text = store.getItem(SAVE_KEY);
  } catch {
    return { data: freshSave(), writable: true, persistent: false };
  }
  if (text === null) return { data: freshSave(), writable: true, persistent: true };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('forme');
  } catch {
    try {
      store.setItem(SAVE_KEY + '.corrupt', text);
    } catch {
      /* rien de plus à faire */
    }
    return { data: freshSave(), writable: true, persistent: true };
  }
  let obj = raw as Record<string, unknown>;
  let v = int(obj.v);
  if (v === 0) v = 1;
  if (v > SAVE_VERSION) return { data: sanitize(obj), writable: false, persistent: true };
  while (v < SAVE_VERSION) {
    const m = migrate[v];
    if (!m) break;
    obj = m(obj);
    v++;
  }
  const data = sanitize(obj);
  data.v = SAVE_VERSION;
  return { data, writable: true, persistent: true };
}

/** Écrit la sauvegarde ; renvoie false si le stockage refuse (mode privé, quota). */
export function write(store: Store | null, loaded: Loaded): boolean {
  if (!store || !loaded.writable) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(loaded.data));
    return true;
  } catch {
    return false;
  }
}

/** Achat : renvoie false si déjà possédé ou pas assez de pétales. */
export function buy(d: SaveData, id: PerkId): boolean {
  const it = itemById(id);
  if (!it || d.owned.includes(id) || d.petals < it.price) return false;
  d.petals -= it.price;
  d.owned.push(id);
  return true;
}
