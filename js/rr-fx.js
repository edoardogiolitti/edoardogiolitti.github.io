// Sfondi delle sezioni blu della pagina RaceReady: la mappa del percorso.
// Curve di livello come su una carta topografica (una più marcata ogni cinque), grana fine dell'asfalto
// e la luce arancione di RaceReady che illumina la mappa sotto i telefoni della hero e dietro al pettorale.
// La mappa è calcolata sulle coordinate della pagina, quindi continua senza giunture da una sezione all'altra.
// data-rr-fx="hero": le curve si muovono piano (solo nella hero); data-rr-fx="map": un solo disegno, ripetuto se cambia la misura.
// Senza WebGL resta il blu pieno del CSS; con le animazioni ridotte anche la hero è ferma.
(() => {
  const sections = [...document.querySelectorAll('[data-rr-fx]')];
  if (!sections.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
  const FRAG = `
    #extension GL_OES_standard_derivatives : enable
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec2 res;        // misura della tela in pixel
    uniform vec2 origin;     // posizione della sezione nella pagina (px CSS)
    uniform float scale;     // pixel della tela per pixel CSS
    uniform float time;
    uniform float moving;    // 1 nella hero animata
    uniform float calmY;     // sotto questa y della pagina le curve sono ferme (giunzione con la sezione dopo)
    uniform vec3 light1;     // luci arancioni: x, y nella pagina, raggio (px CSS)
    uniform vec3 light2;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * noise(p); p = p * 2.02 + 17.3; a *= 0.5; } return v; }

    float lamp(vec2 q, vec3 l) { if (l.z <= 0.0) return 0.0; float d = length(q - l.xy) / l.z; return exp(-d * d * 2.2); }

    void main() {
      // punto nella pagina, in px CSS
      vec2 q = origin + vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / scale;
      vec2 p = q / 560.0;

      // rilievo: rumore deformato, così le curve hanno l'andamento di un terreno vero e non di bolle
      vec2 w = vec2(fbm(p * 0.9 + 3.1), fbm(p * 0.9 - 7.7));
      float calm = moving * smoothstep(calmY, calmY - 420.0, q.y);
      w += calm * 0.16 * vec2(sin(time * 0.11 + p.y * 1.7), cos(time * 0.09 + p.x * 1.3));
      float h = fbm(p + 1.25 * w);

      // curve di livello: sottili, una ogni cinque più marcata (come sulle carte topografiche)
      float f = h * 22.0;
      float fw = max(fwidth(f), 1e-4);
      float g = abs(fract(f + 0.5) - 0.5) / fw / scale;   // distanza dalla curva in px CSS, uguale a ogni risoluzione
      float idx = step(abs(mod(floor(f + 0.5), 5.0)), 0.5);
      float line = 1.0 - smoothstep(0.35 + idx * 0.45, 1.25 + idx * 0.45, g);

      // luce arancione di RaceReady (#ff4502) che cade sulla mappa
      float l = max(lamp(q, light1), lamp(q, light2));

      vec3 navy = vec3(0.090, 0.125, 0.200);            // #172033
      vec3 ink = vec3(0.56, 0.62, 0.74);                // tratto delle curve sul blu
      vec3 orange = vec3(1.0, 0.36, 0.10);
      vec3 col = navy;
      col += vec3(1.0, 0.27, 0.01) * l * 0.045;         // appena un alone sul fondo: la luce si vede soprattutto sulle curve
      vec3 lineCol = mix(ink, orange, smoothstep(0.1, 0.75, l));
      float lineA = (0.055 + idx * 0.05) * (1.0 + l * 1.7);
      col = mix(col, lineCol, line * lineA);

      // grana dell'asfalto, ferma
      col += (hash(floor(q * 1.0)) - 0.5) * 0.018;
      gl_FragColor = vec4(col, 1.0);
    }`;

  // un solo contesto WebGL, fuori dalla pagina: disegna la mappa di ogni sezione e la copia su una tela 2D normale.
  // Così le mappe ferme restano anche se il browser libera la memoria della scheda grafica.
  const glc = document.createElement('canvas');
  const gl = glc.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  if (!gl || !gl.getExtension('OES_standard_derivatives')) return;
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = {};
  for (const n of ['res', 'origin', 'scale', 'time', 'moving', 'calmY', 'light1', 'light2']) u[n] = gl.getUniformLocation(prog, n);
  let lost = false;
  glc.addEventListener('webglcontextlost', () => { lost = true; });   // le tele 2D tengono l'ultimo disegno

  const fx = sections.map((section) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'rr-fx';
    canvas.setAttribute('aria-hidden', 'true');
    section.prepend(canvas);
    section.classList.add('has-fx');
    return { section, canvas, ctx: canvas.getContext('2d'), moving: section.dataset.rrFx === 'hero' && !reduce, visible: false };
  });

  // le luci: sotto il telefono centrale della hero e dietro al pettorale del prototipo
  const pageRect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; };
  let lights = [[0, 0, 0], [0, 0, 0]], calmY = 0;
  const measure = () => {
    const fan = document.querySelector('.phones-fan'), bib = document.querySelector('.bib');
    if (fan) { const r = pageRect(fan); lights[0] = [r.x + r.w / 2, r.y + r.h * 0.8, Math.max(340, r.w * 0.36)]; }
    if (bib) { const r = pageRect(bib); lights[1] = [r.x + r.w / 2, r.y + r.h * 0.55, Math.max(260, r.w * 0.9)]; }
    const hero = fx.find((f) => f.moving);
    calmY = hero ? pageRect(hero.section).y + hero.section.offsetHeight : 0;
  };

  const draw = (f, t) => {
    if (lost || gl.isContextLost()) return;
    const { canvas, ctx, section } = f;
    const k = f.moving ? 1 : Math.min(devicePixelRatio || 1, 1.5);   // la hero si ridisegna di continuo: risoluzione 1
    const w = Math.max(1, Math.round(section.clientWidth * k)), h = Math.max(1, Math.round(section.clientHeight * k));
    if (glc.width !== w || glc.height !== h) { glc.width = w; glc.height = h; }
    gl.viewport(0, 0, w, h);
    const r = pageRect(section);
    gl.uniform2f(u.res, w, h);
    gl.uniform2f(u.origin, r.x, r.y);
    gl.uniform1f(u.scale, k);
    gl.uniform1f(u.time, t);
    gl.uniform1f(u.moving, f.moving ? 1 : 0);
    gl.uniform1f(u.calmY, calmY);
    gl.uniform3fv(u.light1, lights[0]);
    gl.uniform3fv(u.light2, lights[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.drawImage(glc, 0, 0);
  };

  const t0 = performance.now();
  const now = () => (performance.now() - t0) / 1000;
  const drawAll = () => { measure(); fx.forEach((f) => draw(f, now())); };
  drawAll();
  // le immagini e i font cambiano le altezze: si ridisegna quando la pagina ha finito di caricare e a ogni cambio di misura
  addEventListener('load', drawAll);
  let rt;
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(drawAll, 120); }).observe(document.body);

  const animated = fx.filter((f) => f.moving);
  if (!animated.length) return;
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) { const f = fx.find((x) => x.section === en.target); if (f) f.visible = en.isIntersecting; }
  });
  animated.forEach((f) => io.observe(f.section));
  let last = 0;
  const loop = (ts) => {
    requestAnimationFrame(loop);
    if (document.hidden || ts - last < 33) return;   // ~30 fotogrammi al secondo bastano per un movimento così lento
    last = ts;
    for (const f of animated) if (f.visible) draw(f, now());
  };
  requestAnimationFrame(loop);
})();
