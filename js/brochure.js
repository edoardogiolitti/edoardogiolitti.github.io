// Brochure di Torino Icons in 3D: si ruota trascinandola (o con le frecce) e si sfoglia con il cursore.
(() => {
  const stage = document.querySelector('[data-b3d]');
  if (!stage) return;
  const paper = stage.querySelector('.b3d__paper');
  const left = stage.querySelector('[data-panel="l"]');
  const right = stage.querySelector('[data-panel="r"]');
  const range = document.querySelector('[data-b3d-open]');
  const flip = document.querySelector('[data-b3d-flip]');
  let rx = 14, ry = -24;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const turn = () => {
    paper.style.setProperty('--rx', `${rx}deg`);
    paper.style.setProperty('--ry', `${ry}deg`);
  };
  // Un'anta vista di taglio è più scura: luce semplice in base all'angolo.
  const fold = (panel, angle) => {
    panel.style.setProperty('--a', `${angle}deg`);
    panel.style.setProperty('--shade', (0.72 + 0.28 * Math.abs(Math.cos(angle * Math.PI / 180))).toFixed(3));
  };
  // 0-50: si apre la copertina; 50-100: si apre l'anta interna.
  const open = (v) => {
    fold(left, 180 * (1 - clamp(v / 50, 0, 1)));
    fold(right, -180 * (1 - clamp((v - 50) / 50, 0, 1)));
  };

  range.addEventListener('input', () => open(Number(range.value)));
  flip.addEventListener('click', () => { ry += 180; turn(); });

  let start = null;
  stage.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY, rx, ry };
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('is-dragging');
  });
  stage.addEventListener('pointermove', (e) => {
    if (!start) return;
    ry = start.ry + (e.clientX - start.x) * 0.5;
    rx = clamp(start.rx - (e.clientY - start.y) * 0.4, -70, 70);
    turn();
  });
  const end = () => { start = null; stage.classList.remove('is-dragging'); };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  stage.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: [0, -15], ArrowRight: [0, 15], ArrowUp: [10, 0], ArrowDown: [-10, 0] }[e.key];
    if (!step) return;
    e.preventDefault();
    rx = clamp(rx + step[0], -70, 70); ry += step[1];
    turn();
  });

  open(0); turn();
})();
