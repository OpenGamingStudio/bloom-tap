// Toutes les valeurs de réglage de Bloom Tap.
export const SAVE_KEY = 'bloomtap.save';
export const SAVE_VERSION = 1;

export const GRID = 4;
export const CELLS = GRID * GRID;
export const BASE_LIVES = 3;

/** Durée de vie d'une fleur (ms) : de LIFE_START à LIFE_END sur RAMP_MS. */
export const LIFE_START = 3000;
export const LIFE_END = 1600;
/** Écart entre deux apparitions (ms). */
export const GAP_START = 1000;
export const GAP_END = 420;
export const RAMP_MS = 120000;
export const FIRST_SPAWN = 400;

/** Combo : un tap qui suit le précédent de moins de COMBO_WINDOW ms prolonge la série. */
export const COMBO_WINDOW = 1100;
export const COMBO_STEP = 3;
export const MULT_MAX = 5;
export const BASE_POINTS = 10;

export const GOLD_CHANCE = 0.2;
export const GOLD_FACTOR = 2;
export const SLOW_FACTOR = 1.35;

/** Parts de la vie d'une fleur : bouton, puis fleur ouverte, puis fanée (dernier tiers). */
export const BUD_PART = 0.2;
export const WILT_PART = 0.67;
