// Contrôle e2e des mineurs V1.1. Usage : node e2e/mineurs.mjs <url build prod> <url build e2e>
// Build prod : `npm run build` (dist) ; build e2e : `npm run build:e2e` (dist-e2e). puppeteer-core hors package.json.
const { default: puppeteer } = await import(process.env.PUPPETEER ?? 'puppeteer-core');
const [prod, e2e] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: 'new' });
let bad = 0;
const ok = (c, m) => { console.log(c ? 'ok  ' : 'KO  ', m); if (!c) bad++; };

let p = await b.newPage();
await p.goto(prod + '/?e2e', { waitUntil: 'load' });
ok(await p.evaluate(() => typeof window.__bt === 'undefined'), 'build de production : pas de hook __bt même avec ?e2e');
await p.close();

p = await b.newPage();
await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
await p.goto(e2e + '/?e2e', { waitUntil: 'load' });
ok(await p.evaluate(() => typeof window.__bt === 'object'), 'build e2e : hook présent avec ?e2e');
await p.click('#m-play');
await p.evaluate(() => {
  const g = window.__bt.g;
  g.nextSpawn = 1e12; g.cells.fill(null);
  g.cells[0] = { kind: 'normal', age: 0, life: 1e9 }; g.cells[1] = { kind: 'gold', age: 0, life: 1e9 };
  const cs = document.querySelectorAll('.cell');
  for (const i of [0, 1]) cs[i].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
});
await p.click('#btn-pause');
await p.click('#p-quit');
const s = await p.evaluate(() => JSON.parse(localStorage.getItem('bloomtap.save')));
ok(s.petals === 3 && s.best > 0 && s.games === 1, 'Quitter garde les pétales, le record et la partie : ' + JSON.stringify(s));
ok(await p.evaluate(() => document.getElementById('m-petals').textContent) === '3', 'le menu affiche 3 pétales');
const c = await p.evaluate(() => {
  const cell = document.querySelector('.cell');
  cell.dataset.s = 'wilt';
  return [getComputedStyle(cell.querySelector('.petals circle')).fill, getComputedStyle(cell).backgroundColor];
});
const lum = (rgb) => { const v = rgb.match(/\d+/g).slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const [a, d] = [lum(c[0]), lum(c[1])];
const ratio = (Math.max(a, d) + 0.05) / (Math.min(a, d) + 0.05);
ok(ratio >= 3, 'contraste pétales fanés / fond ≥ 3:1 (' + c.join(' sur ') + ' : ' + ratio.toFixed(2) + ')');
await b.close();
process.exit(bad ? 1 : 0);
