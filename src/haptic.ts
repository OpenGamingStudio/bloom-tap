// Retour haptique optionnel (navigator.vibrate) : absent sur ordinateur et sur iOS, le bouton est alors masqué.
const KEY = 'bloomtap.haptic';

let on = true;
try {
  on = window.localStorage.getItem(KEY) !== 'off';
} catch {
  on = true;
}

export const hapticAvailable = (): boolean => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
export const hapticOn = (): boolean => on;
export function setHaptic(v: boolean): void {
  on = v;
  try {
    window.localStorage.setItem(KEY, v ? 'on' : 'off');
  } catch {
    /* stockage indisponible : le choix vaut pour cette visite */
  }
}

/** Durées en ms (vibration, pause, vibration…) : mauvaise fleur sèche, bombe en trois coups, fleur fanée très brève. */
export const PATTERNS = { weed: [60], bomb: [80, 40, 160], wilt: [25] } as const;

export function buzz(kind: keyof typeof PATTERNS): void {
  // Avant tout geste de la personne, vibrate est refusé et logge une erreur : on attend l'activation.
  if (!on || !hapticAvailable() || !navigator.userActivation?.hasBeenActive) return;
  navigator.vibrate([...PATTERNS[kind]]);
}
