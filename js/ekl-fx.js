// Sfondi della pagina Eklettica, presi dai materiali della bici (tavola 5, componenti e materiali).
// data-ekl-fx="telaio": l'alluminio estruso del telaio, verniciato arancione. Righe di estrusione sottili nella direzione del tubo,
//   una lucentezza larga e morbida della vernice acrilica e la grana dell'anodizzazione.
// data-ekl-fx="gomma": la gomma dei copertoni da 20", con il battistrada a tasselli sfalsati illuminato dall'alto.
// Calcolato sulle coordinate della pagina, quindi continuo tra sezioni vicine. È fermo: si ridisegna solo se cambia la misura.
// Un solo contesto WebGL che copia il disegno su tele 2D (come js/tesi-fx.js). Senza WebGL resta il colore pieno del CSS.
(() => {
  const sections = [...document.querySelectorAll('[data-ekl-fx]')];
  if (!sections.length) return;

  const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec2 res; uniform vec2 origin; uniform vec2 size; uniform float scale; uniform vec3 base; uniform float mode;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float hash1(float x) { return fract(sin(x * 91.3458) * 47453.5453); }
    float vnoise(float x) { float i = floor(x), f = fract(x); return mix(hash1(i), hash1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
    float vnoise2(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    // tassello del battistrada: rettangolo arrotondato, distanza in px dal bordo (negativa dentro)
    float knob(vec2 p, vec2 h, float r) { vec2 d = abs(p) - h + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
    // tasselli piccoli e fitti come quelli del copertone nei render, sfalsati a righe alterne, ognuno un po' diverso
    const vec2 CELL = vec2(17.0, 12.0);
    float tread(vec2 q) {
      float row = floor(q.y / CELL.y);
      vec2 g = vec2(q.x / CELL.x + mod(row, 2.0) * 0.5, q.y / CELL.y);
      vec2 id = floor(g);
      vec2 p = (fract(g) - 0.5) * CELL - (vec2(hash(id + 2.3), hash(id + 8.7)) - 0.5) * 1.6;
      vec2 h = vec2(5.2, 3.4) + (vec2(hash(id), hash(id + 4.1)) - 0.5) * 1.2;
      return knob(p, h, 1.8);
    }

    void main() {
      vec2 q = origin + vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / scale;   // px della pagina
      vec2 l = q - origin;                                                       // px della sezione
      vec3 col = base;
      if (mode < 0.5) {
        // telaio: il tubo corre quasi in orizzontale, leggermente inclinato come il tubo orizzontale nei render
        vec2 d = normalize(vec2(1.0, -0.08));
        float u = dot(q, d), v = dot(q, vec2(-d.y, d.x));
        float die = (vnoise(v * 1.3 + vnoise(u * 0.006) * 2.0) - 0.5) * 0.55 + (vnoise(v * 0.31 + 7.0) - 0.5) * 0.45;
        float hv = (l.y + l.x * 0.22) / max(size.x, 1.0);                         // coordinata della lucentezza, in larghezze
        float sheen = 0.055 * exp(-pow((hv - 0.16) / 0.13, 2.0)) + 0.018 * exp(-pow((hv - 0.42) / 0.035, 2.0));
        float shade = -0.045 * smoothstep(0.3, 0.9, hv);
        float tint = (vnoise2(q / 420.0) - 0.5) * 0.03;                            // anodizzazione non uniforme
        col *= 1.0 + sheen + shade + tint + die * 0.022;
        col += (hash(floor(q)) - 0.5) * 0.012;                                     // grana della vernice
      } else {
        // gomma: tasselli più chiari in alto, bordo smussato con la luce che viene dall'alto, ombra nel solco sotto
        float s = tread(q);
        float e = 0.75;
        vec2 n = normalize(vec2(tread(q + vec2(e, 0.0)) - tread(q - vec2(e, 0.0)), tread(q + vec2(0.0, e)) - tread(q - vec2(0.0, e))) + 1e-5);
        float inside = 1.0 - smoothstep(-0.6, 0.6, s * scale);
        float bevel = inside * smoothstep(-2.0, -0.3, s);                         // fascia di 2 px lungo il bordo del tassello
        float lit = dot(n, vec2(0.0, 1.0));                                        // il bordo alto prende luce, quello basso no
        float shadow = (1.0 - inside) * (1.0 - smoothstep(0.0, 3.0, tread(q - vec2(0.0, 2.0))));   // ombra del tassello nel solco
        float wear = vnoise2(q / 260.0) * 0.6 + vnoise2(q / 70.0) * 0.4;           // usura: i tasselli si leggono a zone, non ovunque uguali
        float k = mix(0.35, 1.0, smoothstep(0.25, 0.75, wear));
        col *= 1.0 + k * (inside * 0.075 - shadow * 0.1);
        col += k * bevel * (-lit) * 0.012;
        col += (vnoise2(q * 0.9) - 0.5) * 0.01 + (hash(floor(q)) - 0.5) * 0.007;   // gomma stampata, opaca
      }
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
  for (const n of ['res', 'origin', 'size', 'scale', 'base', 'mode']) u[n] = gl.getUniformLocation(prog, n);

  const fx = sections.map((section) => {
    // colore della sezione; se è trasparente si sale fino al primo colore pieno
    let m = [20, 20, 19];
    for (let e = section; e; e = e.parentElement) { const v = getComputedStyle(e).backgroundColor.match(/[\d.]+/g); if (v && (v.length < 4 || +v[3] > 0)) { m = v; break; } }
    const canvas = document.createElement('canvas');
    canvas.className = 'ekl-fx';
    canvas.setAttribute('aria-hidden', 'true');
    section.prepend(canvas);
    section.classList.add('has-fx');
    return { section, canvas, ctx: canvas.getContext('2d'), base: m.slice(0, 3).map((x) => x / 255), mode: section.dataset.eklFx === 'gomma' ? 1 : 0 };
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
    gl.uniform2f(u.size, section.clientWidth, section.clientHeight);
    gl.uniform1f(u.scale, k);
    gl.uniform3fv(u.base, f.base);
    gl.uniform1f(u.mode, f.mode);
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
