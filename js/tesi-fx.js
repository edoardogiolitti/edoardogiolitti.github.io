// Sfondi delle sezioni scure della pagina della tesi: il motivo della copertina.
// Gocce d'acqua grandi e trasparenti, orientate in direzioni diverse, che si sovrappongono come sulla copertina del volume;
// in più una grana leggera, come la carta stampata. Calcolato sulle coordinate della pagina, quindi continuo tra le sezioni.
// È fermo: si ridisegna solo se cambia la misura. Un solo contesto WebGL che copia il disegno su tele 2D (come js/lib-fx.js).
// Senza WebGL resta il petrolio pieno del CSS.
(() => {
  const sections = [...document.querySelectorAll('[data-tesi-fx]')];
  if (!sections.length) return;

  const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec2 res; uniform vec2 origin; uniform float scale; uniform vec3 base;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    // distanza (px) dal bordo di una goccia: cerchio di raggio r, punta a k*r dal centro, lungo +y
    float drop(vec2 p, float r, float k) {
      float h = r * k;
      vec2 q = vec2(abs(p.x), p.y);
      float yt = r * r / h;                       // dove il cono tocca il cerchio
      if (q.y < yt) return length(q) - r;
      if (q.y > h) return length(q - vec2(0.0, h));
      float sb = r / h, cb = sqrt(1.0 - sb * sb);
      return dot(q - vec2(0.0, h), vec2(cb, sb)); // lato del cono
    }

    void main() {
      vec2 q = origin + vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / scale;
      const float CELL = 460.0;
      vec2 c0 = floor(q / CELL);
      vec3 col = base;
      // ogni cella ha due gocce; si controllano le celle vicine, perché una goccia esce dalla sua
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 c = c0 + vec2(float(i), float(j));
        for (int n = 0; n < 2; n++) {
          vec2 sd = c * 1.7 + float(n) * 13.1;
          vec2 ctr = (c + vec2(hash(sd), hash(sd + 3.3))) * CELL;
          float r = 95.0 + 150.0 * hash(sd + 7.7);
          float a = (hash(sd + 9.1) - 0.5) * 3.6;   // orientamento: per lo più verso l'alto, alcune inclinate o rovesciate
          float s = sin(a), co = cos(a);
          vec2 p = q - ctr; p = vec2(co * p.x - s * p.y, s * p.x + co * p.y);
          float d = drop(vec2(p.x, -p.y), r, 2.1 + 0.5 * hash(sd + 1.9));
          float inside = 1.0 - smoothstep(-0.8, 0.8, d * scale) ;
          float tone = hash(sd + 5.5);
          vec3 tint = tone > 0.35 ? vec3(0.42, 0.53, 0.60) : vec3(0.06, 0.10, 0.13);  // gocce chiare (le più) e scure
          col = mix(col, tint, inside * (tone > 0.35 ? 0.085 : 0.16));
        }
      }
      col += (hash(floor(q)) - 0.5) * 0.014;      // grana della carta
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
  for (const n of ['res', 'origin', 'scale', 'base']) u[n] = gl.getUniformLocation(prog, n);

  const fx = sections.map((section) => {
    // colore della sezione; se è trasparente (la hero) si sale fino al primo colore pieno, di solito quello della pagina
    let m = [34, 50, 61];
    for (let e = section; e; e = e.parentElement) { const v = getComputedStyle(e).backgroundColor.match(/[\d.]+/g); if (v && (v.length < 4 || +v[3] > 0)) { m = v; break; } }
    const canvas = document.createElement('canvas');
    canvas.className = 'tesi-fx';
    canvas.setAttribute('aria-hidden', 'true');
    section.prepend(canvas);
    section.classList.add('has-fx');
    return { section, canvas, ctx: canvas.getContext('2d'), base: m.slice(0, 3).map((x) => x / 255) };
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
