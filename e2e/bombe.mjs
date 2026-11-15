// Contrôle e2e de la bombe. Usage : node e2e/bombe.mjs <url du build servi> <dossier de captures>
// Besoin : puppeteer-core (hors package.json) et Chrome : PUPPETEER=<chemin de puppeteer-core> BROWSER_URL=… ou CHROME=/usr/bin/google-chrome
import { join } from 'node:path';
const { default: puppeteer } = await import(process.env.PUPPETEER ?? 'puppeteer-core');
const [url, out] = process.argv.slice(2);
const b = process.env.BROWSER_URL
  ? await puppeteer.connect({ browserURL: process.env.BROWSER_URL })
  : await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: 'new' });
let bad = 0;
const ok = (c, m) => { console.log(c ? 'ok  ' : 'KO  ', m); if (!c) bad++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function scenario(reduced) {
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  if (reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  // Espion audio : compte les sources de bruit (bombe) et les oscillateurs (mauvaise fleur, bombe).
  await p.evaluateOnNewDocument(() => {
    window.__audio = { noise: 0, osc: 0 };
    const A = window.AudioContext;
    window.AudioContext = class extends A {
      createBufferSource() { window.__audio.noise++; return super.createBufferSource(); }
      createOscillator() { window.__audio.osc++; return super.createOscillator(); }
    };
  });
  await p.goto(url + '/?e2e', { waitUntil: 'load' });
  await p.click('#m-hard');
  const set = (cfg) => p.evaluate((cfg) => {
    const g = window.__bt.g;
    g.nextSpawn = 1e12; g.cells.fill(null); g.lives = 3; g.over = false;
    for (const [i, kind] of Object.entries(cfg)) g.cells[i] = { kind, age: 0, life: 1e9 };
    window.__audio.noise = 0; window.__audio.osc = 0;
  }, cfg);
  const tapCell = (i) => p.evaluate((i) => document.querySelectorAll('.cell')[i].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })), i);
  const tag = reduced ? ' (mouvements réduits)' : '';

  await set({ 5: 'bomb', 0: 'normal', 1: 'normal', 2: 'weed', 4: 'gold', 6: 'normal', 8: 'normal', 9: 'normal', 10: 'normal', 3: 'normal', 15: 'normal' });
  await wait(100);
  await tapCell(5);
  await wait(60);
  const s = await p.evaluate(() => ({
    lives: window.__bt.g.lives, over: window.__bt.g.over, score: window.__bt.g.score,
    left: window.__bt.g.cells.map((c, i) => (c ? i : -1)).filter((i) => i >= 0),
    boom: [...document.querySelectorAll('.cell.boom')].length,
    anim: getComputedStyle(document.querySelector('.cell.boom')).animationName,
    live: document.getElementById('live-lives').textContent,
    audio: window.__audio,
  }));
  ok(s.lives === 2 && !s.over, 'bombe : 1 vie perdue, la partie continue' + tag);
  ok(JSON.stringify(s.left) === '[3,15]', 'bombe : les 8 voisines effacées, les autres restent ' + JSON.stringify(s.left) + tag);
  ok(s.score === 0, 'bombe : aucun point' + tag);
  ok(s.boom === 9, 'bombe : 9 cases en flash (.boom)' + tag);
  ok(reduced ? s.anim === 'none' : s.anim !== 'none', `flash ${reduced ? 'statique' : 'animé'} (animation-name : ${s.anim})`);
  ok(/Bombe ! 8 fleurs effacées/.test(s.live), 'annonce lecteur d’écran : ' + s.live);
  ok(s.audio.noise === 1 && s.audio.osc === 1, 'son de bombe (bruit + coup sourd) ' + JSON.stringify(s.audio) + tag);
  await p.screenshot({ path: join(out, `bombe-${reduced ? 'reduit' : 'anime'}.png`) });
  await wait(800);
  ok(await p.evaluate(() => document.querySelectorAll('.cell.boom').length) === 0, 'le flash disparaît' + tag);

  await set({ 0: 'weed' });
  await tapCell(0);
  const w = await p.evaluate(() => ({ lives: window.__bt.g.lives, audio: window.__audio, boom: document.querySelectorAll('.cell.boom').length }));
  ok(w.lives === 2 && w.audio.noise === 0 && w.audio.osc === 2 && w.boom === 0, 'mauvaise fleur : son et effet distincts de la bombe ' + JSON.stringify(w.audio) + tag);

  await set({ 0: 'bomb' });
  await p.evaluate(() => { window.__bt.g.lives = 1; });
  await tapCell(0);
  await wait(100);
  ok(await p.evaluate(() => !document.getElementById('scr-over').hidden), 'bombe sur la dernière vie : écran de fin' + tag);
  ok(errs.length === 0, 'aucune erreur console ' + errs.join('|') + tag);
  await p.close();
}
await scenario(false);
await scenario(true);

for (const w of [320, 360, 390, 430]) {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: 700, hasTouch: true, isMobile: true });
  await p.goto(url + '/?e2e', { waitUntil: 'load' });
  await p.click('#m-hard');
  await p.evaluate(() => { const g = window.__bt.g; g.nextSpawn = 1e12; g.cells[5] = { kind: 'bomb', age: 0, life: 1e9 }; g.cells[6] = { kind: 'normal', age: 0, life: 1e9 }; });
  await p.evaluate(() => document.querySelectorAll('.cell')[5].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
  const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  ok(sw[0] <= sw[1], `pas de défilement horizontal à ${w} px (${sw})`);
  await p.close();
}
if (process.env.BROWSER_URL) await b.disconnect(); else await b.close();
process.exit(bad ? 1 : 0);
