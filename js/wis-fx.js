// Sfondi animati della pagina WIS, nello stile di WIS (solo 2D, nessun oggetto 3D).
// data-wis-fx="hero":  arancione vivo e setoso, con la luce calda che parte dalla base della mascotte.
// data-wis-fx="visor": il vetro nero del visore, con un riflesso lento e il bagliore dei LED vicino alle parole chiave.
// Ogni sfondo si disegna solo quando la sezione è sullo schermo, a mezza risoluzione e a 30 fotogrammi al secondo.
// Senza WebGL resta lo sfondo CSS; con le animazioni ridotte viene disegnato un solo fotogramma.
(() => {
  const sections = [...document.querySelectorAll('[data-wis-fx]')];
  if (!sections.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
  const COMMON = `
    precision mediump float;
    uniform vec2 res; uniform float time; uniform vec2 focus; uniform float hasFocus;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
  `;
  const FRAG = {
    // arancione della hero (#ff4502): pieghe di luce lente, pozza di luce calda sotto la mascotte, grana fine
    hero: COMMON + `
      void main() {
        vec2 uv = gl_FragCoord.xy / res;
        float m = min(res.x, res.y);
        vec3 col = vec3(1.0, 0.271, 0.008);
        float silk = fbm(uv * vec2(2.4, 1.5) + vec2(time * 0.025, -time * 0.018));
        float silk2 = fbm(uv * vec2(5.0, 3.0) - vec2(time * 0.04, 0.0));
        col *= 0.955 + 0.075 * silk + 0.025 * silk2;
        float d = length((gl_FragCoord.xy - focus) / m);
        float pool = exp(-d * d * 7.0) * hasFocus;
        col = mix(col, vec3(1.0, 0.56, 0.24), pool * (0.42 + 0.06 * sin(time * 2.0)));
        col *= 1.0 - 0.06 * smoothstep(0.45, 1.15, length((uv - vec2(0.55, 0.5)) * vec2(1.1, 1.0)));
        col += (hash(gl_FragCoord.xy + fract(time) * 97.0) - 0.5) * 0.022;
        gl_FragColor = vec4(col, 1.0);
      }`,
    // vetro nero del visore (#141413 ai bordi, così le sezioni scure vicine si uniscono senza giunture)
    visor: COMMON + `
      void main() {
        vec2 uv = gl_FragCoord.xy / res;
        float m = min(res.x, res.y);
        vec3 base = vec3(0.078, 0.078, 0.075);
        float edge = smoothstep(0.0, 0.18, uv.y) * smoothstep(1.0, 0.82, uv.y);
        float cloud = fbm(uv * vec2(1.6, 2.2) + vec2(-time * 0.012, time * 0.008));
        vec3 col = base * (0.86 + 0.28 * cloud * edge);
        // mezzaluna di riflesso che scorre lentamente, come sul visore di WIS
        float band = (uv.x * 0.9 + (1.0 - uv.y) * 0.6) - (0.42 + 0.06 * sin(time * 0.15));
        float sheen = exp(-band * band * 26.0) * smoothstep(1.0, 0.25, uv.x) * edge;
        col += vec3(1.0) * sheen * 0.045;
        // bagliore dei LED vicino alle parole chiave
        float d = length((gl_FragCoord.xy - focus) / m);
        col += vec3(1.0, 0.36, 0.06) * exp(-d * d * 9.0) * 0.085 * hasFocus * edge * (0.85 + 0.15 * sin(time * 1.3));
        col += (hash(gl_FragCoord.xy + fract(time) * 97.0) - 0.5) * 0.018;
        gl_FragColor = vec4(col, 1.0);
      }`,
  };

  const fx = [];
  for (const section of sections) {
    const kind = section.dataset.wisFx;
    if (!FRAG[kind]) continue;
    const canvas = document.createElement('canvas');
    canvas.className = 'wis-fx';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) continue;
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG[kind]);
    if (!vs || !fs) continue;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) continue;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const focusEl = kind === 'hero' ? section.querySelector('.wis-hero__mascot') : section.querySelector('.kw');
    section.prepend(canvas);
    section.classList.add('has-fx');
    fx.push({
      section, canvas, gl, kind, focusEl, visible: false,
      u: { res: gl.getUniformLocation(prog, 'res'), time: gl.getUniformLocation(prog, 'time'), focus: gl.getUniformLocation(prog, 'focus'), hasFocus: gl.getUniformLocation(prog, 'hasFocus') },
    });
  }
  if (!fx.length) return;

  const SCALE = 0.5;
  const resize = (f) => {
    const w = Math.max(1, Math.round(f.section.clientWidth * SCALE)), h = Math.max(1, Math.round(f.section.clientHeight * SCALE));
    if (f.canvas.width !== w || f.canvas.height !== h) { f.canvas.width = w; f.canvas.height = h; f.gl.viewport(0, 0, w, h); }
  };
  const draw = (f, t) => {
    resize(f);
    const { gl, u, canvas } = f;
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1f(u.time, t);
    if (f.focusEl) {
      const s = f.section.getBoundingClientRect(), e = f.focusEl.getBoundingClientRect();
      // per la hero: il punto dove sta la base (in basso nell'immagine); per il visore: il centro della parola chiave
      const fx_ = e.left + e.width / 2 - s.left, fy_ = f.kind === 'hero' ? e.top + e.height * 0.78 - s.top : e.top + e.height / 2 - s.top;
      gl.uniform2f(u.focus, fx_ * SCALE, canvas.height - fy_ * SCALE);
      gl.uniform1f(u.hasFocus, 1);
    } else gl.uniform1f(u.hasFocus, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) { const f = fx.find((x) => x.section === en.target); if (f) { f.visible = en.isIntersecting; if (reduce && f.visible) draw(f, 4); } }
  }, { rootMargin: '100px 0px' });
  fx.forEach((f) => { io.observe(f.section); draw(f, 4); });
  addEventListener('resize', () => fx.forEach((f) => draw(f, 4)));
  if (reduce) return;

  const t0 = performance.now();
  let last = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (document.hidden || now - last < 33) return;   // ~30 fotogrammi al secondo bastano per un movimento così lento
    last = now;
    const t = (now - t0) / 1000;
    for (const f of fx) if (f.visible) draw(f, t);
  };
  requestAnimationFrame(loop);
})();
