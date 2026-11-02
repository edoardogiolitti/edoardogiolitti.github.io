// Modello 3D di WIS, ricostruito in codice dalla mascotte della hero (assets/img/wis/mascotte.png).
// Misure ricavate dai pixel del riferimento, con il raggio della testa = 1:
// testa quasi ellissoide 1.055 × 0.96 × 1 (silhouette misurata: larga 1.10 volte l'altezza, un po' più piena sotto),
// visore a "squircle" ±44° in azimut e da +36° a −44° in elevazione, orecchie a ±74°: un tappo piatto a filo della scocca,
// base di raggio 0.905 e alta 0.35, sospesa 0.265 sotto la testa. Nel riferimento la testa è girata di circa −10°.
// Il retro della testa e delle orecchie e il fondo della base non si vedono nell'immagine: sono dedotti per simmetria.
// Uso: const m = window.createWisModel(THREE, renderer) → { wis, body, base, baseLight, lights, environment, FACES, drawFace }.
window.createWisModel = function createWisModel(THREE, renderer) {
  const SX = 1.055, SY = 0.96, SZ = 1.0;              // proporzioni della testa
  const FULL = 0.05;                                  // la metà inferiore è un po' più piena (misurato sulla silhouette)
  const VIS_AZ = 0.775, VIS_EL0 = -0.07, VIS_EL = 0.70, VIS_N = 2.4; // visore: semi-ampiezze in radianti, esponente dello squircle
  const EAR_AZ = 1.29, EAR_EL = -0.1;                 // orecchie: 74° dal fronte, all'altezza del centro del visore

  // ---------- Materiali ----------
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xf7f4f0, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.16 });
  const rimMat = new THREE.MeshPhysicalMaterial({ color: 0xfbf9f6, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 });
  const orange = new THREE.MeshPhysicalMaterial({ color: 0xff6a00, emissive: 0xff4a00, emissiveIntensity: 0.35, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1 });
  const glowOrange = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.36, 0.06), toneMapped: false });

  const wis = new THREE.Group();   // tutto il personaggio
  const body = new THREE.Group();  // la testa che fluttua
  wis.add(body);

  // ---------- Testa ----------
  const fullness = (y) => 1 + FULL * Math.max(0, -y);
  const shape = (x, y, z, r = 1) => { const k = fullness(y); return new THREE.Vector3(SX * k * x * r, SY * y * r, SZ * k * z * r); };
  const headGeo = new THREE.SphereGeometry(1, 128, 96);
  const hp = headGeo.attributes.position;
  for (let k = 0; k < hp.count; k++) { const v = shape(hp.getX(k), hp.getY(k), hp.getZ(k)); hp.setXYZ(k, v.x, v.y, v.z); }
  headGeo.computeVertexNormals();
  const head = new THREE.Mesh(headGeo, shell);
  body.add(head);
  const onHead = (az, el, r) => shape(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el), r);

  // ---------- Visore: calotta a squircle sul fronte, con la faccia su una texture luminosa ----------
  const squircle = (u, v) => {          // dal quadrato [-1,1]² allo squircle, con raggio normalizzato m
    const m = Math.max(Math.abs(u), Math.abs(v));
    if (m === 0) return { x: 0, y: 0, m: 0 };
    const th = Math.atan2(v, u);
    const rb = Math.pow(Math.pow(Math.abs(Math.cos(th)), VIS_N) + Math.pow(Math.abs(Math.sin(th)), VIS_N), -1 / VIS_N);
    return { x: Math.cos(th) * m * rb, y: Math.sin(th) * m * rb, m };
  };
  const visorPoint = (x, y, m) => {
    const bulge = 0.016 + 0.035 * (1 - Math.pow(m, 3)); // il vetro sporge un po' più della scocca al centro
    return onHead(x * VIS_AZ, VIS_EL0 + y * VIS_EL, 1 + bulge);
  };
  const N = 72;
  const vPos = [], vUv = [], vIdx = [];
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const s = squircle(i / N * 2 - 1, j / N * 2 - 1);
      const p = visorPoint(s.x, s.y, s.m);
      vPos.push(p.x, p.y, p.z);
      vUv.push((s.x + 1) / 2, (s.y + 1) / 2);
    }
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      vIdx.push(a, b, d, a, d, c);
    }
  }
  const visorGeo = new THREE.BufferGeometry();
  visorGeo.setAttribute('position', new THREE.Float32BufferAttribute(vPos, 3));
  visorGeo.setAttribute('uv', new THREE.Float32BufferAttribute(vUv, 2));
  visorGeo.setIndex(vIdx);
  visorGeo.computeVertexNormals();

  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 1024; faceCanvas.height = 640;
  const fctx = faceCanvas.getContext('2d');
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 8;
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: faceTex, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 1.5,
    roughness: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.35, specularIntensity: 0.6,   // il riflesso principale lo dà il velo, non una macchia dura
  });
  body.add(new THREE.Mesh(visorGeo, visorMat));

  // Velo riflettente: la grande striatura morbida in alto a sinistra del vetro, come nel riferimento
  const sheenCanvas = document.createElement('canvas');
  sheenCanvas.width = 512; sheenCanvas.height = 320;
  const sctx = sheenCanvas.getContext('2d');
  // (la texture copre il visore: i bordi della tela sono i bordi del vetro, in alto a sinistra c'è l'angolo in alto a sinistra)
  // 1. mezzaluna luminosa lungo il bordo alto, più forte a sinistra (misurata sul riferimento: ~165/255)
  const tmp = document.createElement('canvas'); tmp.width = 512; tmp.height = 320;
  const tctx = tmp.getContext('2d');
  const vband = tctx.createLinearGradient(0, 6, 0, 62);
  vband.addColorStop(0, 'rgba(255,255,255,0)'); vband.addColorStop(0.25, 'rgba(255,255,255,0.72)'); vband.addColorStop(1, 'rgba(255,255,255,0)');
  tctx.fillStyle = vband; tctx.fillRect(0, 0, 512, 70);
  tctx.globalCompositeOperation = 'destination-in';
  const hband = tctx.createLinearGradient(30, 0, 400, 0);
  hband.addColorStop(0, 'rgba(0,0,0,0)'); hband.addColorStop(0.22, 'rgba(0,0,0,1)'); hband.addColorStop(0.55, 'rgba(0,0,0,0.85)'); hband.addColorStop(1, 'rgba(0,0,0,0)');
  tctx.fillStyle = hband; tctx.fillRect(0, 0, 512, 70);
  sctx.drawImage(tmp, 0, 0);
  // 2. velatura morbida sotto la mezzaluna
  const sg = sctx.createRadialGradient(170, 40, 4, 170, 40, 190);
  sg.addColorStop(0, 'rgba(255,255,255,0.16)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  sctx.fillStyle = sg; sctx.fillRect(0, 0, 512, 320);
  // 3. riflesso caldo della scocca lungo il bordo, più forte in basso a sinistra
  sctx.save();
  sctx.strokeStyle = 'rgba(255, 196, 160, 0.13)'; sctx.lineWidth = 16; sctx.shadowColor = 'rgba(255, 190, 150, 0.6)'; sctx.shadowBlur = 24;
  sctx.strokeRect(0, 0, 512, 320);
  const corner = sctx.createRadialGradient(40, 300, 0, 40, 300, 170);
  corner.addColorStop(0, 'rgba(255, 190, 150, 0.16)'); corner.addColorStop(1, 'rgba(255, 190, 150, 0)');
  sctx.shadowBlur = 0; sctx.fillStyle = corner; sctx.fillRect(0, 120, 260, 200);
  sctx.restore();
  const sheenTex = new THREE.CanvasTexture(sheenCanvas);
  sheenTex.colorSpace = THREE.SRGBColorSpace;
  const sheen = new THREE.Mesh(visorGeo, new THREE.MeshBasicMaterial({ map: sheenTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sheen.scale.setScalar(1.003);
  sheen.renderOrder = 2;
  body.add(sheen);

  // Cornice bianca in rilievo lungo il bordo del visore
  const rimPts = [];
  for (let k = 0; k < 200; k++) {
    const th = k / 200 * Math.PI * 2;
    const rb = Math.pow(Math.pow(Math.abs(Math.cos(th)), VIS_N) + Math.pow(Math.abs(Math.sin(th)), VIS_N), -1 / VIS_N);
    rimPts.push(onHead(Math.cos(th) * rb * VIS_AZ * 1.025, VIS_EL0 + Math.sin(th) * rb * VIS_EL * 1.025, 1.026));
  }
  const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 360, 0.048, 16, true), rimMat);
  body.add(rim);

  // ---------- Orecchie: mozzo bianco, anello arancione, cupola bianca con la scritta WIS ----------
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = labelCanvas.height = 256;
  const lctx = labelCanvas.getContext('2d');
  lctx.fillStyle = '#e8501f';
  lctx.font = '800 112px "Hanken Grotesk", "Arial Black", Arial, sans-serif';
  lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
  lctx.fillText('WIS', 128, 134);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const labelMat = new THREE.MeshPhysicalMaterial({ map: labelTex, transparent: true, roughness: 0.3, clearcoat: 1, polygonOffset: true, polygonOffsetFactor: -2 });

  // L'orecchio è un tappo piatto appoggiato "a corda" sulla scocca: il bordo tocca la superficie, il centro sta a 1.0 dall'asse.
  // Intorno, uno scalino arancione e un collare bianco in rilievo. Costruito lungo +X a partire dal centro della testa.
  const capProfile = [];
  const CR = 0.30, CF = 1.062, CB = 0.93, cr = 0.024;     // raggio del tappo, faccia esterna, fondo, raccordo del bordo
  capProfile.push(new THREE.Vector2(0.001, CB));
  capProfile.push(new THREE.Vector2(CR, CB));
  capProfile.push(new THREE.Vector2(CR, CF - cr));
  for (let k = 1; k <= 6; k++) { const t = k / 6 * Math.PI / 2; capProfile.push(new THREE.Vector2(CR - cr + cr * Math.cos(t), CF - cr + cr * Math.sin(t))); }
  capProfile.push(new THREE.Vector2(0.001, CF + 0.006));  // faccia appena bombata
  const capGeo = new THREE.LatheGeometry(capProfile, 96);
  capGeo.rotateZ(-Math.PI / 2);                            // l'asse del tornio (Y) diventa +X
  const buildEar = () => {
    const ear = new THREE.Group();
    const cap = new THREE.Mesh(capGeo, shell);
    const step = new THREE.Mesh(new THREE.CylinderGeometry(0.318, 0.318, 0.09, 96, 1, true), orange);
    step.rotation.z = -Math.PI / 2; step.position.x = 0.997;
    const floor = new THREE.Mesh(new THREE.RingGeometry(0.29, 0.37, 96), orange);
    floor.rotation.y = Math.PI / 2; floor.position.x = 0.982;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.026, 18, 120), rimMat);
    collar.rotation.y = Math.PI / 2; collar.position.x = 0.978;
    const label = new THREE.Mesh(new THREE.CircleGeometry(0.25, 48), labelMat);
    label.rotation.y = Math.PI / 2; label.position.x = CF + 0.008;
    ear.add(cap, step, floor, collar, label);
    return ear;
  };
  for (const side of [1, -1]) {
    const ear = buildEar();
    // asse a ±82° dal fronte e −6° in elevazione; nessun rollio, così "WIS" resta dritto su entrambi i lati
    ear.rotation.order = 'YZX';
    ear.rotation.set(0, side * EAR_AZ - Math.PI / 2, EAR_EL);
    body.add(ear);
  }

  // Linea luminosa sotto la testa (il riflesso arancione della base sul bordo inferiore)
  const underEl = -1.08;
  const under = new THREE.Mesh(new THREE.TorusGeometry(1, 0.016, 12, 160), glowOrange);
  under.rotation.x = Math.PI / 2;
  const ku = fullness(Math.sin(underEl));
  under.scale.set(SX * ku * Math.cos(underEl) * 1.004, SZ * ku * Math.cos(underEl) * 1.004, 1);
  under.position.y = SY * Math.sin(underEl);
  body.add(under);

  // ---------- Base: disco con bordi arrotondati, vasca luminosa, fascia e piastra inferiore, LED a pillola ----------
  const base = new THREE.Group();
  const BR = 0.905, BH = 0.33, rc = 0.072;
  const prof = [];
  prof.push(new THREE.Vector2(0.001, -BH));
  prof.push(new THREE.Vector2(BR - rc, -BH));
  for (let k = 1; k <= 8; k++) { const a = -Math.PI / 2 + k / 8 * Math.PI / 2; prof.push(new THREE.Vector2(BR - rc + rc * Math.cos(a), -BH + rc + rc * Math.sin(a))); }
  prof.push(new THREE.Vector2(BR, -rc));
  for (let k = 1; k <= 8; k++) { const a = k / 8 * Math.PI / 2; prof.push(new THREE.Vector2(BR - rc + rc * Math.cos(a), -rc + rc * Math.sin(a))); }
  prof.push(new THREE.Vector2(0.72, 0));
  prof.push(new THREE.Vector2(0.695, -0.02));
  prof.push(new THREE.Vector2(0.68, -0.045));
  prof.push(new THREE.Vector2(0.001, -0.045));
  base.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 160), shell));

  const dishCanvas = document.createElement('canvas');
  dishCanvas.width = dishCanvas.height = 256;
  const dctx = dishCanvas.getContext('2d');
  const dg = dctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  dg.addColorStop(0, '#fff0dc'); dg.addColorStop(0.5, '#ffc985'); dg.addColorStop(0.88, '#ff9844'); dg.addColorStop(1, '#ff7a24');
  dctx.fillStyle = dg; dctx.fillRect(0, 0, 256, 256);
  const dishTex = new THREE.CanvasTexture(dishCanvas);
  dishTex.colorSpace = THREE.SRGBColorSpace;
  const dish = new THREE.Mesh(new THREE.CircleGeometry(0.682, 96), new THREE.MeshBasicMaterial({ map: dishTex, toneMapped: false }));
  dish.rotation.x = -Math.PI / 2; dish.position.y = -0.043;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.705, 0.02, 14, 160), orange);
  lip.rotation.x = Math.PI / 2; lip.position.y = -0.006;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(BR + 0.003, BR + 0.003, 0.018, 160, 1, true), glowOrange);
  band.position.y = -BH + 0.05;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(BR - 0.06, BR - 0.08, 0.025, 128), orange);
  plate.position.y = -BH - 0.01;
  const pillGlow = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.085, 8, 20), orange);
  pillGlow.rotation.z = Math.PI / 2; pillGlow.position.set(0, -BH * 0.5, BR - 0.006);
  const pill = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.075, 8, 20), new THREE.MeshBasicMaterial({ color: 0xfff1df, toneMapped: false }));
  pill.rotation.z = Math.PI / 2; pill.position.set(0, -BH * 0.5, BR + 0.008);
  base.add(dish, lip, band, plate, pillGlow, pill);
  base.position.y = -SY - 0.265;
  wis.add(base);

  // Luce calda della base: illumina da sotto la testa
  const baseLight = new THREE.PointLight(0xff8a3a, 2.6, 3.2, 1.6);
  baseLight.position.set(0, base.position.y + 0.25, 0.15);
  wis.add(baseLight);

  // Alone morbido sopra la vasca (sprite additivo)
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = haloCanvas.height = 128;
  const hctx = haloCanvas.getContext('2d');
  const hg = hctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  hg.addColorStop(0, 'rgba(255,190,110,0.22)'); hg.addColorStop(1, 'rgba(255,120,30,0)');
  hctx.fillStyle = hg; hctx.fillRect(0, 0, 128, 128);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(haloCanvas), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.set(1.9, 0.55, 1);
  halo.position.y = base.position.y + 0.05;
  wis.add(halo);

  // ---------- Luci della scena e ambiente per i riflessi lucidi ----------
  const lights = new THREE.Group();
  // emisfero: il "terreno" caldo illumina le superfici rivolte in basso, come il bagliore della base nel riferimento
  lights.add(new THREE.HemisphereLight(0xffffff, 0xff9a58, 1.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(-1.5, 7, 3.5);
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xffe2cc, 0.7);
  fill.position.set(6, -0.5, 1.5);   // di lato e basso: schiarisce la scocca senza un secondo riflesso sul visore
  lights.add(fill);

  // Stanza con pannelli luminosi, solo per i riflessi (un "softbox" in alto a sinistra dà il riflesso sul visore)
  let environment = null;
  if (renderer) {
    const room = new THREE.Scene();
    const box = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: 0x74706c, side: THREE.BackSide }));
    room.add(box);
    const panel = (w, h, x, y, z, rgb) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); room.add(m);
    };
    panel(7, 5, -3.6, 3.6, 2, [8, 8, 8]);         // softbox principale in alto a sinistra: il riflesso largo sul visore
    panel(3, 4, 5.5, 1, 1, [2.2, 2.1, 2]);        // pannello laterale destro
    panel(9, 6, 0, 5.9, 0, [4, 4, 4]);            // luce dall'alto: la calotta della testa resta bianca
    panel(6, 6, 0, -5.8, 0, [2.4, 0.9, 0.25]);    // pavimento caldo: il riflesso arancione dal basso
    const pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(room, 0.04).texture;
    pmrem.dispose();
    renderer.toneMappingExposure = 1.45;
  }

  // ---------- Espressioni ----------
  // Proporzioni misurate sul riferimento: occhi a ±0.47 della semi-larghezza del visore, archi alti 0.23,
  // bocca 0.44 sotto il centro, larga ±0.21. o = aperto, ^ = felice, - = concentrato, O = stupore.
  const FACES = {
    smile:     { l: 'o', r: 'o', mouth: 'smile' },
    happy:     { l: '^', r: '^', mouth: 'smile' },
    wink:      { l: 'o', r: '^', mouth: 'smile' },
    surprised: { l: 'O', r: 'O', mouth: 'o' },
    focus:     { l: '-', r: '-', mouth: 'flat' },
  };
  const EYE_X = 198, EYE_Y = 300;
  const shapes = (f, open, inset = 1) => {
    const eye = (shape, x) => {
      fctx.beginPath();
      if (shape === '^') { fctx.arc(x, 360, 91, Math.PI * 1.1, Math.PI * 1.9); fctx.stroke(); return; }
      const h = { o: 150, O: 128, '-': 26 }[shape] * open * (inset < 1 ? 0.72 : 1);
      const w = ({ o: 72, O: 128, '-': 104 }[shape]) * inset;   // concentrato: due trattini orizzontali
      const hh = Math.max(h, 12);
      fctx.roundRect(x - w / 2, EYE_Y - hh / 2, w, hh, Math.min(w, hh) / 2);
      fctx.fill();
    };
    eye(f.l, 512 - EYE_X);
    eye(f.r === '^' ? '^' : f.r, 512 + EYE_X);
    fctx.beginPath();
    if (f.mouth === 'smile') fctx.arc(512, 231, 175, Math.PI * 0.339, Math.PI * 0.661);
    else if (f.mouth === 'o') fctx.arc(512, 420, 24, 0, Math.PI * 2);
    else { fctx.moveTo(452, 410); fctx.lineTo(572, 410); }
    fctx.stroke();
  };
  const drawFace = (face, open = 1) => {
    const f = FACES[face] || FACES.smile;
    fctx.globalCompositeOperation = 'source-over';
    fctx.shadowBlur = 0;
    fctx.fillStyle = '#040404';
    fctx.fillRect(0, 0, faceCanvas.width, faceCanvas.height);
    fctx.lineCap = 'round'; fctx.lineJoin = 'round';
    // tre passate: alone largo, tratto arancione, anima chiara (come i LED del riferimento)
    const passes = [
      { color: 'rgba(255, 96, 16, 0.35)', width: 34, blur: 30, glow: 'rgba(255, 90, 10, 0.85)' },
      { color: '#ff9a2e', width: 20, blur: 10, glow: 'rgba(255, 120, 30, 0.9)' },
      { color: '#ffd29a', width: 7, blur: 0, glow: 'transparent', inset: 0.42 },
    ];
    for (const p of passes) {
      fctx.strokeStyle = fctx.fillStyle = p.color;
      fctx.lineWidth = p.width;
      fctx.shadowColor = p.glow;
      fctx.shadowBlur = p.blur;
      shapes(f, open, p.inset || 1);
    }
    fctx.shadowBlur = 0;
    faceTex.needsUpdate = true;
  };

  return { wis, body, base, baseLight, lights, environment, FACES, drawFace };
};
