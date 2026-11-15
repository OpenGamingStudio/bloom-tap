// Sons de Bloom Tap, synthétisés (Web Audio) : aucun fichier. Seuls les pièges sonnent pour l'instant.
const KEY = 'bloomtap.sound';

type Ctor = typeof AudioContext;
let ctx: AudioContext | null = null;
let on = true;
try {
  on = window.localStorage.getItem(KEY) !== 'off';
} catch {
  on = true;
}

export const soundOn = (): boolean => on;
export function setSound(v: boolean): void {
  on = v;
  try {
    window.localStorage.setItem(KEY, v ? 'on' : 'off');
  } catch {
    /* stockage indisponible : le choix vaut pour cette visite */
  }
}

function context(): AudioContext | null {
  if (!on) return null;
  if (!ctx) {
    const C: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(a: AudioContext, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = 0) {
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const v = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  v.gain.setValueAtTime(vol, t);
  v.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(v).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Mauvaise fleur : un bourdonnement grave et sec, deux notes descendantes. */
export function weedSound(): void {
  const a = context();
  if (!a) return;
  tone(a, 'square', 190, 120, 0.12, 0.12);
  tone(a, 'square', 140, 80, 0.16, 0.12, 0.11);
}

/** Bombe : un grondement de bruit filtré et un coup sourd, bien plus long et plus grave. */
export function bombSound(): void {
  const a = context();
  if (!a) return;
  const dur = 0.6;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1800, a.currentTime);
  lp.frequency.exponentialRampToValueAtTime(120, a.currentTime + dur);
  const v = a.createGain();
  v.gain.setValueAtTime(0.5, a.currentTime);
  v.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  src.connect(lp).connect(v).connect(a.destination);
  src.start();
  tone(a, 'sine', 120, 35, 0.5, 0.5);
}
