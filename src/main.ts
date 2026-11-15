import './style.css';
import * as C from './config';
import { ITEMS, type PerkId } from './shop';
import { buy, load, write, type Loaded } from './save';
import { createGame, isTrap, multiplier, stageOf, tap, tick, type Ev, type Game } from './sim';
import { makeRng } from './rng';
import { bombSound, setSound, soundOn, weedSound } from './audio';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error('#' + id);
  return el as T;
};

let store: Storage | null = null;
try {
  store = window.localStorage;
} catch {
  store = null;
}
const save: Loaded = load(store);
const persist = () => write(store, save);

// ---------- Jardin (16 cases) ----------
const garden = $('garden');
const FLOWER_SVG =
  '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
  '<ellipse class="mound" cx="32" cy="55" rx="17" ry="6"/>' +
  '<g class="fl"><path d="M32 55V32" stroke="#2e9e5b" stroke-width="4" stroke-linecap="round" fill="none"/>' +
  '<path d="M32 46c-9 0-13-5-13-9 8 0 13 3 13 9z" fill="#2e9e5b"/>' +
  '<g class="petals"><circle cx="32" cy="15" r="8"/><circle cx="43" cy="26" r="8"/><circle cx="32" cy="37" r="8"/><circle cx="21" cy="26" r="8"/></g>' +
  '<circle class="core" cx="32" cy="26" r="7"/></g>' +
  '<g class="weed"><path d="M32 55V40" stroke="#1d1b2f" stroke-width="4" stroke-linecap="round" fill="none"/>' +
  '<path d="M32 8l6 10 11-4-4 11 10 6-11 3 2 11-10-6-10 6 2-11-11-3 10-6-4-11 11 4z" fill="#7a2fa0" stroke="#1d1b2f" stroke-width="3" stroke-linejoin="round"/>' +
  '<path d="M26 22l12 12M38 22L26 34" stroke="#fff8ea" stroke-width="4" stroke-linecap="round"/></g>' +
  '<g class="bomb"><circle cx="30" cy="38" r="17" fill="#1d1b2f"/><path d="M40 24l6-7" stroke="#1d1b2f" stroke-width="4" stroke-linecap="round"/>' +
  '<path d="M46 9v8M41 13h10M42 9l8 8M50 9l-8 8" stroke="#ffc93c" stroke-width="3" stroke-linecap="round"/>' +
  '<circle cx="23" cy="31" r="4" fill="#fff8ea"/><path d="M24 40l12 12M36 40L24 52" stroke="#ff6fa5" stroke-width="4" stroke-linecap="round"/></g></svg>';

const cells: HTMLButtonElement[] = [];
const shown: string[] = [];
for (let i = 0; i < C.CELLS; i++) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'cell';
  b.dataset.s = 'empty';
  b.tabIndex = i === 0 ? 0 : -1;
  b.innerHTML = FLOWER_SVG;
  b.dataset.i = String(i);
  garden.appendChild(b);
  cells.push(b);
  shown.push('');
}
const cellName = (i: number, s: string, gold: boolean, kind = ''): string => {
  const pos = `ligne ${Math.floor(i / C.GRID) + 1}, colonne ${(i % C.GRID) + 1}`;
  if (s === 'empty') return `${pos} : vide`;
  if (kind === 'bomb') return `${pos} : bombe, ne pas toucher`;
  if (kind === 'weed') return `${pos} : mauvaise fleur, ne pas toucher`;
  const what = s === 'bud' ? 'bouton' : s === 'bloom' ? 'fleur ouverte' : 'fleur qui fane';
  return `${pos} : ${what}${gold ? ' dorée' : ''}`;
};

// ---------- État ----------
type Mode = 'menu' | 'play' | 'pause' | 'over' | 'shop';
let mode: Mode = 'menu';
let g: Game = createGame({ gold: false, slow: false, life: false }, makeRng(1));
let last = 0;
let raf = 0;
let shopFrom: 'menu' | 'over' = 'menu';
let newRecord = false;
let hardMode = false;

const perks = () => ({
  gold: save.data.owned.includes('gold'),
  slow: save.data.owned.includes('slow'),
  life: save.data.owned.includes('life'),
});

// ---------- Annonces ----------
const liveScore = $('live-score');
const liveLives = $('live-lives');
let scoreTimer = 0;
let scorePending = false;
function announceScore(now: boolean) {
  const say = () => {
    scorePending = false;
    liveScore.textContent = `Score ${g.score}`;
    scoreTimer = window.setTimeout(() => {
      scoreTimer = 0;
      if (scorePending) say();
    }, 1500);
  };
  if (now && !scoreTimer) say();
  else scorePending = true;
}

// ---------- Affichage ----------
const hudScore = $('hud-score');
const hudLives = $('hud-lives');
const hudCombo = $('hud-combo');
let livesKey = '';
let comboKey = '';

const heart = (full: boolean) =>
  `<svg class="h-7 w-7" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C5 15.5 2.5 12 2.5 8.5A5 5 0 0 1 12 6a5 5 0 0 1 9.5 2.5C21.5 12 19 15.5 12 21z" fill="${full ? '#c2255c' : '#fff8ea'}" stroke="#1d1b2f" stroke-width="2.5" stroke-linejoin="round"/>${full ? '' : '<path d="M7 8l10 8" stroke="#1d1b2f" stroke-width="2.5" stroke-linecap="round"/>'}</svg>`;

function renderHud() {
  hudScore.textContent = String(g.score);
  const lk = `${g.lives}/${g.maxLives}`;
  if (lk !== livesKey) {
    livesKey = lk;
    hudLives.innerHTML = Array.from({ length: g.maxLives }, (_, i) => heart(i < g.lives)).join('');
  }
  const ck = g.combo >= 2 ? `${g.combo}` : '';
  if (ck !== comboKey) {
    comboKey = ck;
    hudCombo.textContent = ck ? `Combo ${g.combo} · points ×${multiplier(g.combo)}` : ' ';
  }
}

function renderCells() {
  for (let i = 0; i < C.CELLS; i++) {
    const f = g.cells[i];
    const s = f ? (isTrap(f.kind) ? 'trap' : stageOf(f)) : 'empty';
    const k = f ? f.kind : '';
    const key = s + k;
    if (shown[i] === key) continue;
    shown[i] = key;
    const el = cells[i];
    el.dataset.s = s;
    if (k) el.dataset.k = k;
    else delete el.dataset.k;
    el.setAttribute('aria-label', cellName(i, s, k === 'gold', k));
  }
}

function floatPts(i: number, text: string) {
  const el = cells[i];
  const p = document.createElement('span');
  p.className = 'pts';
  p.setAttribute('aria-hidden', 'true');
  p.textContent = text;
  el.appendChild(p);
  el.classList.remove('hit');
  void el.offsetWidth;
  el.classList.add('hit');
  window.setTimeout(() => {
    p.remove();
    el.classList.remove('hit');
  }, 600);
}

/** Explosion : la case de la bombe et les cases vidées prennent la classe .boom (flash, sans mouvement si mouvements réduits). */
function explode(i: number, cleared: number[]) {
  for (const k of [i, ...cleared]) {
    const el = cells[k];
    el.classList.remove('boom');
    void el.offsetWidth;
    el.classList.add('boom');
    window.setTimeout(() => el.classList.remove('boom'), 700);
  }
}

function handle(evs: Ev[]) {
  for (const e of evs) {
    if (e.t === 'bloom') {
      floatPts(e.i, `+${e.points}`);
      announceScore(false);
    } else if (e.t === 'trap') {
      floatPts(e.i, e.kind === 'bomb' ? 'BOUM −1 vie' : '−1 vie');
      if (e.kind === 'bomb') {
        bombSound();
        explode(e.i, e.cleared);
      } else weedSound();
      const what = e.kind === 'bomb' ? `Bombe ! ${e.cleared.length} fleur${e.cleared.length > 1 ? 's' : ''} effacée${e.cleared.length > 1 ? 's' : ''}.` : 'Mauvaise fleur !';
      liveLives.textContent = `${what} ${e.lives > 0 ? `Vies : ${e.lives} sur ${g.maxLives}.` : 'Partie finie.'}`;
      if (g.over) end();
    } else if (e.t === 'wilt') {
      liveLives.textContent = e.lives > 0 ? `Une fleur a fané. Vies : ${e.lives} sur ${g.maxLives}.` : 'Dernière fleur fanée.';
    } else if (e.t === 'over') {
      end();
    }
  }
}

// ---------- Boucle ----------
function frame(now: number) {
  raf = 0;
  if (mode !== 'play') return;
  const dt = Math.min(100, now - last);
  last = now;
  handle(tick(g, dt));
  if (mode !== 'play') return;
  renderCells();
  renderHud();
  raf = requestAnimationFrame(frame);
}
function run() {
  last = performance.now();
  if (!raf) raf = requestAnimationFrame(frame);
}

// ---------- Écrans ----------
const scr: Record<Exclude<Mode, 'play'>, HTMLElement> = {
  menu: $('scr-menu'),
  pause: $('scr-pause'),
  over: $('scr-over'),
  shop: $('scr-shop'),
};
const gameEl = $('game');
const firstFocus: Record<Exclude<Mode, 'play'>, string> = { menu: 'm-play', pause: 'p-resume', over: 'o-again', shop: 's-close' };

function show(m: Mode) {
  mode = m;
  for (const k of Object.keys(scr) as (keyof typeof scr)[]) scr[k].hidden = k !== m;
  gameEl.toggleAttribute('inert', m !== 'play');
  if (m === 'play') {
    const t = cells.find((c) => c.tabIndex === 0) ?? cells[0];
    t.focus({ preventScroll: true });
  } else {
    $(firstFocus[m]).focus({ preventScroll: true });
  }
}

function refreshMenu() {
  $('m-best').textContent = String(save.data.best);
  $('m-best-hard').textContent = String(save.data.bestHard);
  $('m-petals').textContent = String(save.data.petals);
  $('m-warn').hidden = save.persistent && persist();
}

function start(hard = hardMode) {
  hardMode = hard;
  g = createGame(perks(), makeRng((Date.now() ^ (Math.random() * 2 ** 31)) >>> 0), hard);
  newRecord = false;
  shown.fill('');
  livesKey = '';
  comboKey = '';
  liveScore.textContent = '';
  liveLives.textContent = `Vies : ${g.lives} sur ${g.maxLives}.`;
  renderCells();
  renderHud();
  show('play');
  run();
}

/** Verse la partie dans la sauvegarde : parties, record du mode, pétales. */
function bank() {
  save.data.games++;
  const bestKey = g.hard ? 'bestHard' : 'best';
  if (g.score > save.data[bestKey]) {
    save.data[bestKey] = g.score;
    newRecord = g.score > 0;
  }
  save.data.petals += g.petals;
  persist();
}

function end() {
  bank();
  const bestKey = g.hard ? 'bestHard' : 'best';
  renderCells();
  renderHud();
  liveScore.textContent = `Partie finie. Score ${g.score}.`;
  $('o-score').textContent = `${g.score} points`;
  $('o-best').textContent = String(save.data[bestKey]);
  $('o-mode').textContent = g.hard ? 'Mode difficile' : 'Mode facile';
  $('o-petals').textContent = String(g.petals);
  $('o-record').hidden = !newRecord;
  $('o-detail').textContent = `${g.blooms} fleurs écloses, meilleur combo ${g.bestCombo}.`;
  show('over');
}

function pause() {
  if (mode !== 'play') return;
  show('pause');
}
function resume() {
  show('play');
  run();
}

// ---------- Boutique ----------
function renderShop() {
  $('s-petals').textContent = String(save.data.petals);
  const list = $('s-list');
  list.textContent = '';
  for (const it of ITEMS) {
    const has = save.data.owned.includes(it.id);
    const missing = it.price - save.data.petals;
    const li = document.createElement('li');
    li.className = 'item';
    const h = document.createElement('h3');
    h.className = 'text-xl font-bold';
    h.textContent = it.name;
    const d = document.createElement('p');
    d.className = 'text-base';
    d.textContent = it.desc;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-petal';
    b.dataset.id = it.id;
    b.disabled = has || missing > 0;
    b.textContent = has ? 'Possédé' : missing > 0 ? `${it.price} pétales (il en manque ${missing})` : `Acheter, ${it.price} pétales`;
    li.append(h, d, b);
    list.appendChild(li);
  }
}
function openShop(from: 'menu' | 'over') {
  shopFrom = from;
  $('s-live').textContent = ' ';
  renderShop();
  show('shop');
}
function closeShop() {
  if (shopFrom === 'over') {
    show('over');
  } else {
    refreshMenu();
    show('menu');
  }
}
$('s-list').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  const id = b?.dataset.id as PerkId | undefined;
  if (!id || !buy(save.data, id)) return;
  persist();
  const name = ITEMS.find((x) => x.id === id)?.name ?? '';
  renderShop();
  $('s-live').textContent = `${name} acheté.`;
  $('s-list').querySelector<HTMLButtonElement>(`button[data-id="${id}"]`)?.focus();
  if (document.activeElement === document.body) $('s-close').focus();
});

// ---------- Entrées ----------
function onTap(i: number) {
  if (mode !== 'play') return;
  const ev = tap(g, i);
  if (ev) {
    handle([ev]);
    renderCells();
    renderHud();
  }
}
garden.addEventListener('pointerdown', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.cell');
  if (!b || e.button !== 0) return;
  e.preventDefault();
  b.focus({ preventScroll: true });
  setRoving(Number(b.dataset.i));
  onTap(Number(b.dataset.i));
});
garden.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.cell');
  if (b && e.detail === 0) onTap(Number(b.dataset.i)); // clavier (Entrée, Espace)
});

function setRoving(i: number) {
  cells.forEach((c, k) => (c.tabIndex = k === i ? 0 : -1));
}
garden.addEventListener('keydown', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.cell');
  if (!b) return;
  const i = Number(b.dataset.i);
  const r = Math.floor(i / C.GRID);
  const c = i % C.GRID;
  let n = -1;
  if (e.key === 'ArrowLeft') n = r * C.GRID + Math.max(0, c - 1);
  else if (e.key === 'ArrowRight') n = r * C.GRID + Math.min(C.GRID - 1, c + 1);
  else if (e.key === 'ArrowUp') n = Math.max(0, r - 1) * C.GRID + c;
  else if (e.key === 'ArrowDown') n = Math.min(C.GRID - 1, r + 1) * C.GRID + c;
  else if (e.key === 'Home') n = r * C.GRID;
  else if (e.key === 'End') n = r * C.GRID + C.GRID - 1;
  if (n < 0) return;
  e.preventDefault();
  setRoving(n);
  cells[n].focus({ preventScroll: true });
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (mode === 'play') {
      e.preventDefault();
      pause();
    } else if (mode === 'pause' && e.key === 'Escape') resume();
    else if (mode === 'shop' && e.key === 'Escape') closeShop();
  }
});
// Piège du focus dans l'écran ouvert (fenêtre modale)
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || mode === 'play') return;
  const btns = [...scr[mode].querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  if (btns.length === 0) return;
  const first = btns[0];
  const lastB = btns[btns.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    lastB.focus();
  } else if (!e.shiftKey && document.activeElement === lastB) {
    e.preventDefault();
    first.focus();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('blur', pause);

$('btn-pause').addEventListener('click', pause);
$('p-resume').addEventListener('click', resume);
$('p-quit').addEventListener('click', () => {
  g.over = true;
  bank(); // quitter ne fait pas perdre les pétales ni le record de la partie
  refreshMenu();
  show('menu');
});
$('m-play').addEventListener('click', () => start(false));
$('m-hard').addEventListener('click', () => start(true));
$('m-shop').addEventListener('click', () => openShop('menu'));
$('o-again').addEventListener('click', () => start());
$('o-shop').addEventListener('click', () => openShop('over'));
$('o-menu').addEventListener('click', () => {
  refreshMenu();
  show('menu');
});
$('s-close').addEventListener('click', closeShop);
const soundBtn = $('m-sound');
const paintSound = () => {
  soundBtn.setAttribute('aria-pressed', String(soundOn()));
  soundBtn.textContent = soundOn() ? 'Sons : oui' : 'Sons : non';
};
soundBtn.addEventListener('click', () => {
  setSound(!soundOn());
  paintSound();
});
paintSound();

// Hook des contrôles automatiques : seulement en dev ou dans un build `npm run build:e2e`, jamais en production
if ((import.meta.env.DEV || import.meta.env.MODE === 'e2e') && new URLSearchParams(location.search).has('e2e')) {
  (window as unknown as { __bt: unknown }).__bt = { get g() { return g; }, save };
}

refreshMenu();
show('menu');
