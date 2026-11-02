// Sfondi della pagina Torino Icons, presi dal materiale dei foulard: la seta.
// data-fou-fx: pieghe lunghe e morbide come il foulard appeso nei mockup, la lucentezza del raso sul lato della piega
//   che prende luce e la trama diagonale del twill di seta, appena percettibile da vicino.
// Il colore è quello della sezione (bruno, o il nero del foulard Piazza San Carlo sotto la brochure).
// Calcolato sulle coordinate della pagina, quindi continuo tra sezioni vicine. È fermo: si ridisegna solo se cambia la misura.
// Un solo contesto WebGL che copia il disegno su tele 2D (come js/ekl-fx.js). Senza WebGL resta il colore pieno del CSS.
(() => {
  const sections = [...document.querySelectorAll('[data-fou-fx]')];
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
    float vnoise2(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    void main() {
      vec2 q = origin + vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / scale;   // px della pagina
      // le pieghe scendono quasi in verticale, come il foulard appeso alla barra; non sono mai dritte
      vec2 dir = normalize(vec2(1.0, 0.24));
      float u = dot(q, dir), v = dot(q, vec2(-dir.y, dir.x));
      u += (vnoise2(vec2(v / 560.0, u / 1300.0)) - 0.5) * 220.0 + (vnoise2(q / 190.0) - 0.5) * 36.0;
      // pendenza della stoffa: una piega larga, una media e una stretta; le pieghe nascono e si spengono lungo la caduta
      float slope = 0.56 * cos(u / 50.0) + 0.3 * cos(u / 23.0 + 1.7) + 0.14 * cos(u / 12.0 + 0.4);
      slope *= mix(0.3, 1.0, smoothstep(0.2, 0.8, vnoise2(vec2(u / 600.0, v / 800.0) + 3.1)));
      // la luce arriva da sinistra: il fianco che la guarda si schiarisce, il fondo della piega si scurisce
      float sheen = exp(-pow((slope - 0.45) / 0.3, 2.0));                         // il riflesso morbido del raso
      float hollow = smoothstep(-0.25, -0.8, slope);                             // il fondo della piega
      // twill: righe diagonali di 3 px, più visibili dove la seta riflette
      float t = abs(fract((q.x + q.y) / 3.0) - 0.5) * 2.0 - 0.5;
      vec3 col = base * (1.0 + slope * 0.07 - hollow * 0.1 + t * (0.012 + sheen * 0.03));
      col += (base * 0.45 + vec3(0.034, 0.03, 0.022)) * sheen * 0.55;
      col += (hash(floor(q * scale)) - 0.5) * 0.008;                             // grana del filato
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
    // colore della sezione; se è trasparente si sale fino al primo colore pieno
    let m = [43, 38, 33];
    for (let e = section; e; e = e.parentElement) { const v = getComputedStyle(e).backgroundColor.match(/[\d.]+/g); if (v && (v.length < 4 || +v[3] > 0)) { m = v; break; } }
    const canvas = document.createElement('canvas');
    canvas.className = 'fou-fx';
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
