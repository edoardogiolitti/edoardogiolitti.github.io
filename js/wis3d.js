// WIS in 3D: la mascotte accompagna la lettura della pagina WIS, come un piccolo avatar che fluttua.
// All'inizio prende il posto della testa della mascotte della hero (il modello combacia con l'immagine); la base resta lì,
// la testa si stacca e vola di tappa in tappa; tornando alla hero si riappoggia sulla sua base:
// le tappe sono gli elementi con data-wis-stop="hero|text|image|above" (titoli e immagini chiave) e data-wis-face.
// A ogni tappa si posa accanto al titolo o sull'angolo dell'immagine, guarda il contenuto e lo segue mentre la pagina scorre.
// Tra una tappa e l'altra vola su un arco morbido, inclinandosi nel verso del volo; all'arrivo fa un piccolo cenno.
// Su mobile, dopo la hero, resta piccolo in basso a destra. Con le animazioni ridotte resta fermo nell'angolo.
// Il modello sta in js/wis-model.js. Script normale (non "module"): funziona anche aprendo la pagina come file.
(async () => {
let THREE;
try { THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'); } catch { return; }

const host = document.querySelector('[data-wis3d]');
const stops = [...document.querySelectorAll('[data-wis-stop]')];
const heroImg = document.querySelector('[data-wis-stop="hero"]');
const hero = document.querySelector('.wis-hero');
const canWebGL = (() => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
})();
if (!host || !stops.length || !canWebGL || typeof window.createWisModel !== 'function') return;

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobileQuery = matchMedia('(max-width: 719px)');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- Scena ----------
// Solo la testa accompagna la lettura: la base resta nella hero (è quella dell'immagine, tagliata con clip-path).
// Il riquadro è tagliato attorno alla testa (setViewOffset) con la stessa inquadratura della mascotte della hero:
// così, a riposo nella hero, la testa 3D coincide con quella dell'immagine. CROP = porzione dell'immagine occupata dal riquadro.
const CROP = { x: 0.19, y: 0.10, w: 0.62, h: 0.58 };
const BASE_CLIP = 'inset(65.5% 0 0 0)';                  // nell'immagine la base comincia al 65,5% dell'altezza
const HW = 260, HH = Math.round(HW * CROP.h / CROP.w);      // dimensioni CSS del riquadro a scala 1
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
let pixelRatio = Math.min(devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(HW, HH, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
const camEl = 8 * Math.PI / 180, camTarget = new THREE.Vector3(0, -0.42, 0);
camera.position.set(0, camTarget.y + 7.6 * Math.sin(camEl), 7.6 * Math.cos(camEl));
camera.lookAt(camTarget);
camera.setViewOffset(1000, 1000, CROP.x * 1000, CROP.y * 1000, CROP.w * 1000, CROP.h * 1000);

const model = window.createWisModel(THREE, renderer);
const { wis, body, baseLight, FACES, drawFace } = model;
scene.add(wis, model.lights);
scene.environment = model.environment;
model.base.visible = false;                                 // la base 3D non serve: resta quella della hero
wis.traverse((o) => { if (o.isSprite) o.visible = false; }); // anche l'alone sopra la base
let dock = 1;                                               // 1 = appoggiato sulla base, 0 = in volo con te

let face = 'happy', faceSince = 0, winkOn = false, nextBlink = 2.5;
drawFace(face);

// ---------- Tappe: dove posarsi rispetto all'elemento ----------
const PAD = 12;
let W = 140, H = 140 * HH / HW;                            // dimensioni del riquadro mentre accompagna
const sizeFor = () => { W = mobileQuery.matches ? 82 : Math.round(clamp(innerWidth * 0.095, 112, 156)); H = W * HH / HW; };

// righe di testo vicine allo schermo, per non posarsi mai sopra una scritta
const textRects = () => {
  const out = [], range = document.createRange(), vh = innerHeight;
  const walker = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim() || !n.parentElement || n.parentElement.closest('.sr-only, [aria-hidden="true"]')) continue;
    const pr = n.parentElement.getBoundingClientRect();
    if (pr.bottom < -400 || pr.top > vh + 400 || pr.width === 0) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.width > 2) out.push(r);
  }
  return out;
};
const lastLine = (el) => {
  const range = document.createRange(); range.selectNodeContents(el);
  let best = null;
  for (const r of range.getClientRects()) {
    if (r.width < 4) continue;
    if (!best || r.bottom > best.bottom + 4 || (Math.abs(r.bottom - best.bottom) <= 4 && r.right > best.right)) best = r;
  }
  return best || el.getBoundingClientRect();
};
// sui lati si tiene un po' d'aria (il modello ondeggia), in alto e in basso il riquadro ha già margine trasparente
const hits = (box, rects) => rects.some((r) => r.left < box.x + box.w * 1.04 && r.right > box.x - box.w * 0.04 && r.top < box.y + box.h * 0.88 && r.bottom > box.y + box.h * 0.12);

// calcola, una volta per tappa, lo scostamento dal bordo dell'elemento (si aggiorna a ogni ridimensionamento)
const place = (stop) => {
  const el = stop.el, r = el.getBoundingClientRect(), vw = innerWidth;
  const type = stop.type, cands = [];
  if (type === 'image') {
    const right = r.left + r.width / 2 > vw / 2;
    const tr = { x: r.right - W * 0.62, y: r.top - H * 0.4 }, tl = { x: r.left - W * 0.38, y: r.top - H * 0.4 };
    const inTR = { x: r.right - W * 1.02, y: r.top + H * 0.02 }, inTL = { x: r.left + W * 0.02, y: r.top + H * 0.02 };
    // prima fuori dall'angolo (come l'ape sul fiore), poi di lato, poi dentro l'angolo dell'immagine se fuori non c'è posto
    cands.push(right ? tr : tl, right ? tl : tr, { x: r.right + W * 0.04, y: r.top + H * 0.1 }, { x: r.left - W * 1.04, y: r.top + H * 0.1 }, right ? inTR : inTL, right ? inTL : inTR);
  } else {
    const L = lastLine(el);
    if (type === 'above') cands.push({ x: r.left + r.width / 2 - W / 2, y: r.top - H * 0.98 });
    cands.push(
      { x: L.right + W * 0.18, y: L.top + L.height / 2 - H * 0.52 },
      { x: r.right + W * 0.14, y: L.top + L.height / 2 - H * 0.52 },
      { x: L.right - W * 0.7, y: r.top - H * 0.98 },
      { x: r.left - W * 0.1, y: r.top - H * 0.98 },
      { x: L.right - W * 0.5, y: r.bottom + 4 },
      { x: r.left, y: r.bottom + 4 },
    );
  }
  const rects = textRects();
  // ogni posizione viene riportata dentro lo schermo, poi si prende la prima che non tocca testo
  const inside = cands.map((c) => ({ x: clamp(c.x, -W * 0.05, vw - W * 0.95), y: c.y }));
  const pick = inside.find((c) => !hits({ x: c.x, y: c.y, w: W, h: H }, rects)) || inside[0];
  stop.dx = pick.x - r.left; stop.dy = pick.y - r.top; stop.w = W;
};

const S = stops.map((el) => ({ el, type: el.dataset.wisStop, face: el.dataset.wisFace || 'smile', dx: 0, dy: 0, w: 0 }));
const heroStop = S.find((s) => s.type === 'hero');
const keyY = (s, r) => r.top + Math.min(r.height, 240) / 2;

// ---------- Stato del volo ----------
const P = { x: innerWidth - 200, y: innerHeight - 260 }, V = { x: 0, y: 0 };
let scale = 0.5, cur = null, flight = null, alpha = 0, live = false, liveSince = 0, hover = 0;
let taken = false, attachV = 0, smoothScroll = scrollY, yaw = -0.175, pitch = 0, bank = 0, nod = 0, nodV = 0, lastScroll = scrollY, settledAt = 0;
const loadT = performance.now();

const pickStop = () => {
  const vh = innerHeight, readY = vh * 0.42;
  let best = null, bestD = Infinity, curD = Infinity;
  for (const s of S) {
    const r = s.el.getBoundingClientRect();
    if (r.bottom < vh * 0.08 || r.top > vh * 0.92 || r.width === 0) continue;
    const d = Math.abs(keyY(s, r) - readY);
    if (s === cur) curD = d;
    if (d < bestD) { bestD = d; best = s; }
  }
  if (!best) return cur && cur.el.getBoundingClientRect().bottom > 0 ? cur : null;
  if (cur && curD !== Infinity && bestD + 70 > curD) return cur; // un po' di isteresi: niente cambi nervosi
  return best;
};

const targetOf = (s) => {
  const r = s.el.getBoundingClientRect();
  if (s.type === 'hero') {
    const w = r.width * CROP.w;
    return { x: r.left + r.width * CROP.x, y: r.top + r.height * CROP.y, s: w / HW, clampY: false, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }
  const mobile = mobileQuery.matches || reduce;
  if (mobile) return { x: innerWidth - W * 0.9, y: innerHeight - H - 8, s: W / HW, clampY: false, cx: innerWidth * 0.3, cy: innerHeight * 0.5 };
  if (s.w !== W) place(s);
  const y = r.top + s.dy, yC = clamp(y, PAD - H * 0.1, innerHeight - H - PAD);
  return { x: clamp(r.left + s.dx, -W * 0.05, innerWidth - W * 0.95), y: yC, s: W / HW, clampY: yC !== y, cx: r.left + r.width / 2, cy: r.top + Math.min(r.height, 300) / 2 };
};

addEventListener('resize', () => { sizeFor(); for (const s of S) s.w = 0; });
mobileQuery.addEventListener('change', () => { sizeFor(); for (const s of S) s.w = 0; });
sizeFor();

// su mobile: se nell'angolo c'è testo, WIS si fa un po' trasparente
const coversText = (x, y, w, h) => {
  for (const fx of [0.3, 0.55, 0.8]) for (const fy of [0.35, 0.6, 0.85]) {
    const el = document.elementFromPoint(x + w * fx, y + h * fy);
    if (el && el.closest('p, h1, h2, h3, li, blockquote, a, figcaption') && !el.closest('img, figure, picture')) return true;
  }
  return false;
};
let dim = 1, lastDimCheck = 0;

// ---------- Animazione ----------
const clock = new THREE.Clock();
let running = true, prevT = 0;
document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { prevT = clock.getElapsedTime(); loop(); } });
const easeInOut = (f) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(f, 0, 1));

const loop = () => {
  if (!running) return;
  requestAnimationFrame(loop);
  const t = clock.getElapsedTime();
  const dt = clamp(t - prevT, 0.001, 0.05); prevT = t;
  const vh = innerHeight;

  // la mascotte della hero diventa viva solo quando il 3D è pronto e l'immagine ha finito la sua entrata
  const useHero = heroStop && !reduce && heroImg.complete;
  if (!live && performance.now() - loadT > 1100) { live = true; liveSince = t; }

  // tappa attiva
  let next = reduce ? null : pickStop();
  if (reduce) next = hero && hero.getBoundingClientRect().bottom < vh * 0.45 ? S.find((s) => s.type !== 'hero') : null;
  if (next === heroStop && !useHero) next = null;
  if (next && next !== cur) {
    const prev = cur; cur = next;
    host.dataset.stop = S.indexOf(cur);
    if (prev && !reduce) {
      const T = targetOf(cur), dist = Math.hypot(T.x - P.x, T.y - P.y);
      flight = { t0: t, D: clamp(dist / 520, 0.95, 1.9), sx: P.x, sy: P.y, faceDone: false };
      V.y += attachV;   // la velocità con cui seguiva la pagina continua nel volo: nessun angolo
    } else if (cur.face !== face) { face = cur.face; faceSince = t; winkOn = face === 'wink'; drawFace(face); }
  }

  // visibilità: comparsa morbida; scompare se non c'è nessuna tappa sullo schermo (per esempio nel footer)
  const want = live && next ? 1 : 0;
  alpha += (want * dim - alpha) * (1 - Math.exp(-dt * 4));
  host.style.opacity = alpha.toFixed(3);
  if (heroImg && useHero) {
    // dissolvenza incrociata con l'immagine della hero: si nasconde solo quando il 3D è ben visibile
    // dell'immagine resta solo la base: la testa ora è quella 3D
    if (alpha > 0.85 && !taken) { taken = true; heroImg.style.clipPath = BASE_CLIP; }
  }
  if (!cur) { if (alpha < 0.01) return; }

  if (cur) {
    const T = targetOf(cur);
    const isHero = cur === heroStop;
    // segue la pagina che scorre (quasi agganciato), così non resta indietro quando scorri veloce;
    // lo scroll è ammorbidito, così anche l'aggancio parte e si ferma senza scatti
    smoothScroll += (scrollY - smoothScroll) * (1 - Math.exp(-dt * 9));
    const scrolled = smoothScroll - lastScroll;
    attachV = !isHero && !T.clampY && !flight ? -scrolled * 0.85 / dt : 0;
    P.y += attachV * dt;
    lastScroll = smoothScroll;

    let gx = T.x, gy = T.y;
    if (flight) {
      const f = (t - flight.t0) / flight.D, e = easeInOut(f);
      const sx = flight.sx, sy = flight.sy;   // il volo parte da dove WIS si trova sullo schermo
      const dx = T.x - sx, dy = T.y - sy, len = Math.hypot(dx, dy) || 1;
      // arco morbido: per i voli verticali piega verso il bordo più vicino, per quelli orizzontali verso l'alto
      let px = -dy / len, py = dx / len;
      if (Math.abs(dy) > Math.abs(dx)) { const mid = (sx + T.x) / 2; if ((mid > innerWidth / 2) !== (px > 0)) { px = -px; py = -py; } }
      else if (py > 0) { px = -px; py = -py; }
      const bend = Math.min(len * 0.26, 220);
      const cx = (sx + T.x) / 2 + px * bend, cy = (sy + T.y) / 2 + py * bend;
      const u = 1 - e;
      gx = u * u * sx + 2 * u * e * cx + e * e * T.x;
      gy = u * u * sy + 2 * u * e * cy + e * e * T.y;
      if (f > 0.6 && !flight.faceDone) { flight.faceDone = true; if (cur.face !== face) { face = cur.face; faceSince = t; winkOn = face === 'wink'; drawFace(face); } }
      if (f >= 1) { flight = null; nodV += 2.4; settledAt = t; }       // arrivato: piccolo cenno con la testa
    }

    if (isHero && !flight) {
      // nella hero resta esattamente sopra l'immagine
      // la velocità reale resta memorizzata: quando si stacca dalla hero, parte senza scatti
      V.x = (gx - P.x) / dt; V.y = (gy - P.y) / dt; P.x = gx; P.y = gy;
    } else {
      // molla smorzata: movimento morbido e fluttuante, senza scatti
      const w0 = flight ? 5.2 : 3.4, z = 0.86;
      const ax = w0 * w0 * (gx - P.x) - 2 * z * w0 * V.x, ay = w0 * w0 * (gy - P.y) - 2 * z * w0 * V.y;
      V.x += ax * dt; V.y += ay * dt; P.x += V.x * dt; P.y += V.y * dt;
    }
    scale += (T.s - scale) * (isHero && !flight ? 1 : 1 - Math.exp(-dt * 2.6));
    hover += ((isHero && !flight ? 0 : 1) - hover) * (1 - Math.exp(-dt * 1.5));
    dock += ((isHero && !flight ? 1 : 0) - dock) * (1 - Math.exp(-dt * 2));

    // galleggiamento continuo (mai fermo del tutto)
    const bw = W, bh = H;
    const hx = reduce ? 0 : hover * (Math.sin(t * 0.83 + 1.3) * bw * 0.04 + Math.sin(t * 1.9) * bw * 0.012);
    const hy = reduce ? 0 : hover * (Math.sin(t * 1.27) * bh * 0.035 + Math.sin(t * 0.55 + 0.7) * bh * 0.02);
    host.style.transform = `translate3d(${(P.x + hx).toFixed(1)}px, ${(P.y + hy).toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;

    // dove guarda: verso il contenuto che indica; in volo, verso dove va
    const sp = Math.hypot(V.x, V.y), k = clamp(sp / 650, 0, 1);
    const mx = P.x + HW * scale / 2, my = P.y + HH * scale * 0.4;
    const yawLook = isHero ? -0.175 : clamp((T.cx - mx) / (W * 3.2), -1, 1) * 0.72;
    const yawFly = clamp(V.x / 480, -1, 1) * 0.95;
    const pitchLook = isHero ? 0 : clamp((T.cy - my) / (H * 5), -1, 1) * 0.22;
    const ease = 1 - Math.exp(-dt * 4.5);
    yaw += ((reduce ? -0.45 : yawLook * (1 - k) + yawFly * k) - yaw) * ease;
    pitch += ((reduce ? 0 : pitchLook + clamp(V.y / 2200, -0.22, 0.22)) - pitch) * ease;
    bank += ((reduce ? 0 : clamp(-V.x / 1500, -0.3, 0.3)) - bank) * ease;
    nodV += (-46 * nod - 7 * nodV) * dt; nod += nodV * dt;
    wis.rotation.set(pitch + nod * 0.12, yaw, bank, 'YXZ');

    // su mobile, se nell'angolo c'è testo, si fa un po' trasparente
    if ((mobileQuery.matches || reduce) && cur !== heroStop && t - lastDimCheck > 0.25) {
      lastDimCheck = t; dim = coversText(P.x, P.y, HW * scale, HH * scale) ? 0.6 : 1;
    } else if (!mobileQuery.matches && !reduce) dim = 1;

    // risoluzione proporzionata alla dimensione: nitido nella hero, leggero quando è piccolo
    const pr = Math.min(devicePixelRatio, 2) * clamp(scale * 1.15, 0.35, 1);
    if (Math.abs(pr - pixelRatio) / pixelRatio > 0.2) { pixelRatio = pr; renderer.setPixelRatio(pr); renderer.setSize(HW, HH, false); }
  }

  // la testa fluttua sopra la base, respira, la luce pulsa
  if (!reduce) {
    body.position.y = Math.sin(t * 1.6) * 0.07;
    body.rotation.z = Math.sin(t * 0.9) * 0.04 - bank * 0.25;
    body.rotation.x = Math.sin(t * 1.1) * 0.03;
    // la luce arancione della base illumina la testa da sotto: piena quando è appoggiata, più tenue in volo
    baseLight.intensity = (2.3 + Math.sin(t * 2) * 0.5) * (0.45 + 0.55 * dock);
  }

  // battito di ciglia; l'occhiolino si ripete ogni tanto
  if (face === 'wink' && !reduce) {
    if (winkOn && t - faceSince > 1.6) { winkOn = false; drawFace('smile'); }
    else if (!winkOn && t - faceSince > 5) { faceSince = t; winkOn = true; drawFace('wink'); }
  }
  const shown = face === 'wink' && !winkOn ? 'smile' : face;
  const f = FACES[shown];
  if (!reduce && !winkOn && f && f.l !== '^' && t > nextBlink) {
    const b = (t - nextBlink) / 0.16;
    if (b < 1) drawFace(shown, Math.abs(1 - 2 * b));
    else { drawFace(shown); nextBlink = t + 2.8 + Math.random() * 3; }
  }

  renderer.render(scene, camera);
};
loop();
})();
