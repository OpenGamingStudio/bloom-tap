// Contrôle e2e des vibrations. Usage : node e2e/vibrations.mjs <url du build servi>  (hook ?e2e : voir bombe.mjs)
const { default: puppeteer } = await import(process.env.PUPPETEER ?? 'puppeteer-core');
const [url] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: 'new' });
let bad = 0;
const ok = (c, m) => { console.log(c ? 'ok  ' : 'KO  ', m); if (!c) bad++; };

async function page(withVibrate) {
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
  await p.evaluateOnNewDocument((withVibrate) => {
    window.__vib = [];
    if (withVibrate) navigator.vibrate = (pat) => { window.__vib.push(pat); return true; };
    else Object.defineProperty(Navigator.prototype, 'vibrate', { value: undefined, configurable: true });
  }, withVibrate);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url + '/?e2e', { waitUntil: 'load' });
  return { p, errs };
}
const tapKind = (p, kind) => p.evaluate((kind) => {
  const g = window.__bt.g;
  g.nextSpawn = 1e12; g.cells.fill(null); g.lives = 3; g.over = false;
  g.cells[5] = { kind, age: 0, life: 1e9 };
  document.querySelectorAll('.cell')[5].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
  const v = window.__vib; window.__vib = []; return v;
}, kind);

let { p, errs } = await page(true);
ok(await p.evaluate(() => !document.getElementById('m-haptic').hidden), 'bouton Vibrations visible quand vibrate existe');
await p.click('#m-hard');
ok(JSON.stringify(await tapKind(p, 'weed')) === '[[60]]', 'mauvaise fleur : une secousse brève [60]');
ok(JSON.stringify(await tapKind(p, 'bomb')) === '[[80,40,160]]', 'bombe : trois coups [80,40,160]');
ok(JSON.stringify(await tapKind(p, 'normal')) === '[]', 'fleur normale : aucune vibration');
await p.click('#btn-pause'); await p.click('#p-quit');
await p.click('#m-haptic');
ok(await p.evaluate(() => document.getElementById('m-haptic').textContent) === 'Vibrations : non', 'bouton passé sur « non »');
await p.click('#m-hard');
ok(JSON.stringify(await tapKind(p, 'weed')) === '[]', 'désactivé : aucune vibration');
await p.reload({ waitUntil: 'load' });
ok(await p.evaluate(() => document.getElementById('m-haptic').getAttribute('aria-pressed')) === 'false', 'le choix est gardé après rechargement');
ok(errs.length === 0, 'aucune erreur console ' + errs.join('|'));
await p.close();

({ p, errs } = await page(false));
ok(await p.evaluate(() => document.getElementById('m-haptic').hidden), 'sans vibrate (ordinateur, iOS) : bouton masqué');
ok(errs.length === 0, 'aucune erreur console sans vibrate ' + errs.join('|'));
await p.close();
await b.close();
process.exit(bad ? 1 : 0);
