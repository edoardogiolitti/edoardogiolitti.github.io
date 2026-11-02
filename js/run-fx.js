// Sfondi delle sezioni della pagina Runso: la maglia della calza.
// Punto jersey (colonne di maglie a V, ogni filo con il suo spessore), nel colore della sezione:
// nero tecnico sulle sezioni nere, fluo sulle sezioni a colore pieno. Calcolata sulle coordinate della pagina,
// così continua senza giunture tra sezioni vicine. È ferma: si ridisegna solo se cambia la misura.
// Un solo contesto WebGL, fuori dalla pagina, che copia il disegno su tele 2D normali (come js/rr-fx.js e js/lib-fx.js).
// Senza WebGL resta il colore pieno del CSS.
(() => {
  const sections = [...document.querySelectorAll('[data-run-fx]')];
  if (!sections.length) return;

  const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec2 res; uniform vec2 origin; uniform float scale;
    uniform vec3 base;       // colore della sezione
    uniform float depth;     // quanto si vede la maglia (più sul nero, dove serve più contrasto relativo)

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    // una gamba della maglia: un'ellisse inclinata, con il profilo tondo del filo
    float leg(vec2 f, vec2 c, float a) {
      vec2 d = f - c;
      float s = sin(a), co = cos(a);
      d = vec2(co * d.x - s * d.y, s * d.x + co * d.y);
      float r = length(d / vec2(0.2, 0.5));
      return sqrt(max(0.0, 1.0 - r * r));
    }

    // luminosità della maglia jersey in un punto della pagina (px CSS)
    float knit(vec2 q) {
      vec2 cell = vec2(7.0, 5.6);                 // larghezza della colonna e altezza del rango
      vec2 t = q / cell;
      vec2 c = floor(t), f = fract(t);
      float yarn = 0.9 + 0.2 * hash(vec2(c.x, 1.0)) + 0.1 * (noise(vec2(c.x * 3.1, t.y * 0.05)) - 0.5);
      // le due gambe della V; quelle del rango sopra scendono un poco in questo
      float v = max(leg(f, vec2(0.3, 0.55), 0.5), leg(f, vec2(0.7, 0.55), -0.5));
      v = max(v, 0.8 * max(leg(f + vec2(0.0, 1.0), vec2(0.3, 0.55), 0.5), leg(f + vec2(0.0, 1.0), vec2(0.7, 0.55), -0.5)));
      return v * yarn;
    }

    void main() {
      vec2 q = origin + vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / scale;
      float o = 0.25 / scale;
      float k = (knit(q + vec2(-o, -o)) + knit(q + vec2(o, -o)) + knit(q + vec2(-o, o)) + knit(q + vec2(o, o))) * 0.25;
      // il tessuto non è mai teso uguale: ombre larghe e morbide
      float fold = 0.94 + 0.08 * noise(q / 420.0) + 0.03 * noise(q / 90.0);
      vec3 col = base * (1.0 - depth + depth * 1.35 * k) * fold;
      // sul nero il filo prende un filo di luce
      col += vec3(0.022) * k * step(max(base.r, max(base.g, base.b)), 0.1);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const glc = document.createElement('canvas');
  const gl = glc.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  if (!gl) return;
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
  for (const n of ['res', 'origin', 'scale', 'base', 'depth']) u[n] = gl.getUniformLocation(prog, n);

  const fx = sections.map((section) => {
    // il colore viene dal CSS della sezione, così la maglia ha sempre il colore giusto
    const m = getComputedStyle(section).backgroundColor.match(/[\d.]+/g) || [11, 11, 11];
    const base = m.slice(0, 3).map((x) => x / 255);
    const dark = Math.max(...base) < 0.1;
    const canvas = document.createElement('canvas');
    canvas.className = 'run-fx';
    canvas.setAttribute('aria-hidden', 'true');
    section.prepend(canvas);
    section.classList.add('has-fx');
    return { section, canvas, ctx: canvas.getContext('2d'), base, depth: dark ? 0.32 : 0.14 };
  });

  const draw = (f) => {
    if (gl.isContextLost()) return;
    const { canvas, ctx, section } = f;
    const k = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(section.clientWidth * k)), h = Math.max(1, Math.round(section.clientHeight * k));
    if (glc.width !== w || glc.height !== h) { glc.width = w; glc.height = h; }
    gl.viewport(0, 0, w, h);
    const r = section.getBoundingClientRect();
    gl.uniform2f(u.res, w, h);
    gl.uniform2f(u.origin, r.left + scrollX, r.top + scrollY);
    gl.uniform1f(u.scale, k);
    gl.uniform3fv(u.base, f.base);
    gl.uniform1f(u.depth, f.depth);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.drawImage(glc, 0, 0);
  };
  const drawAll = () => fx.forEach(draw);
  drawAll();
  addEventListener('load', drawAll);
  let rt;
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(drawAll, 120); }).observe(document.body);
})();
