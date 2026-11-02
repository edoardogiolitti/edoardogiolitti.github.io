// Sfondi delle sezioni verdi della pagina Libraccio: la tela da legatoria di un libro rilegato.
// Trama a tela (fili che passano sopra e sotto, ognuno con il suo spessore e i suoi nodi), tinta non uniforme
// come sulla tela vera e una luce morbida dall'alto. È ferma: si disegna una volta e si ridisegna solo se cambia la misura.
// Un solo contesto WebGL, fuori dalla pagina, che copia il disegno su tele 2D normali (come js/rr-fx.js).
// Senza WebGL resta il verde pieno del CSS.
(() => {
  const sections = [...document.querySelectorAll('[data-lib-fx]')];
  if (!sections.length) return;

  const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec2 res; uniform vec2 origin; uniform float scale;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }

    // luminosità della tela in un punto della pagina (px CSS)
    float cloth(vec2 q) {
      const float P = 3.4;                       // passo dei fili
      vec2 t = q / P;
      vec2 c = floor(t), f = fract(t);
      // ogni filo ha il suo spessore e dei nodi lungo la lunghezza (la "fiammatura" della tela)
      float warpW = 0.78 + 0.22 * hash(vec2(c.x, 3.0)) + 0.12 * (noise(vec2(c.x * 1.7, t.y * 0.09)) - 0.5);
      float weftW = 0.78 + 0.22 * hash(vec2(7.0, c.y)) + 0.12 * (noise(vec2(t.x * 0.09, c.y * 1.7)) - 0.5);
      float warp = smoothstep(0.0, 0.5 * warpW, 0.5 * warpW - abs(f.x - 0.5));   // profilo tondo del filo
      float weft = smoothstep(0.0, 0.5 * weftW, 0.5 * weftW - abs(f.y - 0.5));
      bool over = mod(c.x + c.y, 2.0) < 0.5;     // tela: un filo sopra, uno sotto
      float top = over ? warp : weft;
      float shade = over ? 0.04 * (hash(vec2(c.x, 1.0)) - 0.5) : 0.04 * (hash(vec2(2.0, c.y)) - 0.5);
      float gap = 1.0 - max(warp, weft);          // tra i fili si vede il fondo, più scuro
      return 0.5 + 0.5 * top + shade - 0.35 * gap;
    }

    void main() {
      vec2 q = origin + vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / scale;
      // quattro campioni per pixel: la trama è più fine dei pixel e senza media farebbe effetto moiré
      float o = 0.25 / scale;
      float w = (cloth(q + vec2(-o, -o)) + cloth(q + vec2(o, -o)) + cloth(q + vec2(-o, o)) + cloth(q + vec2(o, o))) * 0.25;

      vec3 green = vec3(0.008, 0.361, 0.259);    // #025c42, il verde Libraccio
      vec3 col = green * (0.9 + 0.16 * w);
      // tinta non uniforme, larga e morbida, come la tela tinta
      col *= 0.97 + 0.06 * fbm(q / 340.0);
      // fili un po' più chiari qua e là
      float slub = max(smoothstep(0.86, 1.0, noise(q / vec2(3.4, 46.0) + 5.0)), smoothstep(0.86, 1.0, noise(q / vec2(46.0, 3.4) - 9.0)));
      col += vec3(0.012, 0.03, 0.02) * slub * w;
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
  const u = { res: gl.getUniformLocation(prog, 'res'), origin: gl.getUniformLocation(prog, 'origin'), scale: gl.getUniformLocation(prog, 'scale') };

  const fx = sections.map((section) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'lib-fx';
    canvas.setAttribute('aria-hidden', 'true');
    section.prepend(canvas);
    section.classList.add('has-fx');
    return { section, canvas, ctx: canvas.getContext('2d') };
  });

  const draw = (f) => {
    if (gl.isContextLost()) return;
    const { canvas, ctx, section } = f;
    const k = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(section.clientWidth * k)), h = Math.max(1, Math.round(section.clientHeight * k));
    if (glc.width !== w || glc.height !== h) { glc.width = w; glc.height = h; }
    gl.viewport(0, 0, w, h);
    const r = section.getBoundingClientRect();
    gl.uniform2f(u.res, w, h);
    gl.uniform2f(u.origin, r.left + scrollX, r.top + scrollY);
    gl.uniform1f(u.scale, k);
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
