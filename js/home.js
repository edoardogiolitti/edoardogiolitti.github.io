// Home di Edoardo Giolitti: il poco JavaScript che serve.
// Senza script la pagina funziona lo stesso: tutto il testo resta visibile.

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 0. Barra in alto: sempre visibile, si compatta appena si scorre; "Progetti" apre il menu dei progetti.
// Stesso ordine e stessi testi dell'indice in home: se cambia lì, va cambiato anche qui.
const PROGETTI = [
  { file: 'raceready.html', name: 'RaceReady', type: 'UX/UI', img: 'raceready/menu.jpg', text: 'Supporto alla scelta e organizzazione della gara, per i runner amatoriali.' },
  { file: 'wis.html', name: 'WIS Home Agent', type: 'UX/UI', img: 'wis/menu.jpg', text: "Un'assistente AI per la casa: progettare la relazione, non il comando." },
  { file: 'libraccio.html', name: 'Libraccio.it', type: 'UX/UI', img: 'libraccio/menu.jpg', text: 'Un checkout con meno attrito e un sistema di reward che fa tornare chi legge.' },
  { file: 'runso.html', name: 'Runso', type: 'Product design', img: 'runso/menu.jpg', text: 'Calze tecniche da running: identità visiva, collezione e packaging.' },
  { file: 'rubinetteria.html', name: 'Rubinetteria', type: 'Product design', img: 'rubinetteria/menu.jpg', text: 'Tesi triennale: sei suggestioni per un rubinetto più sostenibile e intuitivo.' },
  { file: 'eklettica.html', name: 'Eklettica', type: 'Product design', img: 'eklettica/menu.jpg', text: 'Bici pieghevole per il cicloturismo: compatta quando serve, pronta quando conta.' },
  { file: 'torino-icons.html', name: 'Torino Icons', type: 'Fashion design', img: 'foulard/menu.jpg', text: 'Quattro foulard dedicati ai luoghi iconici di Torino, con una mappa per scoprirli.' },
];
(() => {
  const bar = document.querySelector('.topbar');
  if (!bar) return;

  // la barra prende i colori della sezione che le passa sotto (fondo, testo, accento), così si fonde con la pagina:
  // chiara sulle sezioni chiare, scura su quelle scure. Con il menu aperto i colori restano fermi.
  const rgb = (c) => (c.startsWith('#') ? (c.length === 4 ? [...c.slice(1)].map((h) => parseInt(h + h, 16)) : [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))) : c.match(/[\d.]+/g).slice(0, 3).map(Number));
  const lum = (c) => rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  let tone = '';
  const retone = () => {
    if (bar.classList.contains('is-open')) return;
    const under = document.elementsFromPoint(1, Math.round(bar.offsetHeight / 2)).find((el) => !bar.contains(el) && !el.classList.contains('topbar__scrim'));
    let el = under;
    for (; el && el !== document.documentElement; el = el.parentElement) { const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > 0.5)) break; }
    if (!el || el === document.documentElement) el = document.body;
    const cs = getComputedStyle(el), v = (n) => cs.getPropertyValue(n).trim();
    const t = { '--bg': cs.backgroundColor, '--ink': cs.color, '--muted': v('--muted'), '--surface': v('--surface'), '--accent': v('--accent'), '--accent-ink': v('--accent-ink') };
    // se l'accento della sezione non si vede sul suo fondo (l'arancione della hero di WIS), bottone e chip passano al colore del testo
    if (!t['--accent'] || contrast(t['--accent'], t['--bg']) < 3) { t['--accent'] = t['--ink']; t['--accent-ink'] = t['--bg']; }
    const key = Object.values(t).join();
    if (key === tone) return;
    tone = key;
    for (const [k, val] of Object.entries(t)) if (val) bar.style.setProperty(k, val);
  };

  // compatta: basta un piccolo scorrimento
  let ticking = false;
  const compact = () => { bar.classList.toggle('is-compact', scrollY > 16); retone(); ticking = false; };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(compact); } }, { passive: true });
  addEventListener('resize', () => requestAnimationFrame(compact));
  addEventListener('load', compact);
  compact();

  // menu dei progetti, costruito qui così l'elenco sta in un posto solo
  const li = bar.querySelector('.topbar__menu');
  const trigger = li && li.querySelector('a');
  if (!trigger) return;
  const root = new URL('./', trigger.href);              // la cartella del sito, da qualsiasi pagina
  const here = location.pathname.split('/').pop();
  const inProgetti = /\/progetti\/[^/]*$/.test(location.pathname);
  const items = PROGETTI.map((p, i) => {
    const current = inProgetti && here === p.file ? ' aria-current="page"' : '';
    const kind = p.type === 'UX/UI' ? 'ux' : 'pd';
    return `<li><a class="menu__item" href="${new URL('progetti/' + p.file, root).href}" data-i="${i}"${current}><span class="menu__name">${p.name}</span><span class="work__type work__type--${kind}">${p.type}</span></a></li>`;
  }).join('');
  const figs = PROGETTI.map((p, i) => `<figure data-i="${i}"><img data-src="${new URL('assets/img/' + p.img, root).href}" width="800" height="450" alt=""><figcaption>${p.text}</figcaption></figure>`).join('');
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.id = 'menu-progetti';
  menu.innerHTML = `<ul class="menu__list" role="list">${items}</ul><div class="menu__preview" aria-hidden="true">${figs}</div><a class="menu__all link" href="${trigger.href}">Tutti i progetti in home</a>`;
  li.append(menu);
  trigger.classList.add('topbar__trigger');
  trigger.insertAdjacentHTML('beforeend', '<svg class="topbar__chev" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>');
  trigger.setAttribute('aria-controls', menu.id);
  trigger.setAttribute('aria-expanded', 'false');
  const scrim = document.createElement('div');
  scrim.className = 'topbar__scrim';
  bar.after(scrim);

  // anteprima: quella del progetto su cui passi; all'apertura, quella della pagina in cui sei
  const links = [...menu.querySelectorAll('.menu__item')];
  const frames = [...menu.querySelectorAll('figure')];
  const show = (i) => {
    links.forEach((a, n) => a.classList.toggle('is-active', n === i));
    frames.forEach((f, n) => f.classList.toggle('is-on', n === i));
  };
  const start = Math.max(0, links.findIndex((a) => a.hasAttribute('aria-current')));
  links.forEach((a, i) => { a.addEventListener('mouseenter', () => show(i)); a.addEventListener('focus', () => show(i)); });

  let open = false, timer;
  const set = (on) => {
    clearTimeout(timer);
    if (on === open) return;
    open = on;
    if (on) {
      menu.querySelectorAll('img[data-src]').forEach((img) => { img.src = img.dataset.src; img.removeAttribute('data-src'); }); // le immagini solo alla prima apertura
      show(start);
    }
    bar.classList.toggle('is-open', on);
    scrim.classList.toggle('is-on', on);
    trigger.setAttribute('aria-expanded', on);
    if (!on) retone();
  };
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  // con il mouse: si apre passando sopra, si chiude poco dopo che il mouse è uscito (così si arriva al pannello senza perderlo)
  li.addEventListener('mouseenter', () => { if (!hover.matches) return; clearTimeout(timer); timer = setTimeout(() => set(true), 60); });
  li.addEventListener('mouseleave', () => { if (!hover.matches) return; clearTimeout(timer); timer = setTimeout(() => set(false), 160); });
  // con il tocco: il primo tocco apre il menu, che contiene anche il link a tutti i progetti.
  // Con il mouse il clic su "Progetti" porta all'indice in home, come prima.
  trigger.addEventListener('click', (e) => { if (hover.matches) { set(false); return; } e.preventDefault(); set(!open); });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); }); // serve per i link alla stessa pagina
  scrim.addEventListener('click', () => set(false));
  // da tastiera: si apre quando il focus arriva su "Progetti", Esc chiude e torna lì
  li.addEventListener('focusin', (e) => { if (e.target.matches(':focus-visible')) set(true); });
  li.addEventListener('focusout', (e) => { if (!li.contains(e.relatedTarget) && !li.matches(':hover')) set(false); });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !open) return;
    if (li.contains(document.activeElement)) trigger.focus({ preventScroll: true });
    set(false);
  });
})();

// 1. Indice dei lavori: il progetto attivo cambia l'anteprima fissa
(() => {
  const items = document.querySelectorAll('.work__item');
  const frames = document.querySelectorAll('.work__frame [data-for]');
  if (!items.length) return;
  const activate = (item) => {
    items.forEach((el) => el.classList.toggle('is-active', el === item));
    frames.forEach((f) => f.classList.toggle('is-on', f.dataset.for === item.dataset.frame));
  };
  // Ritardo d'intenzione: la card cambia solo se il mouse resta sul nome per un attimo,
  // così passando veloce sull'elenco non c'è l'effetto a scatti.
  let timer;
  items.forEach((item) => {
    item.addEventListener('mouseenter', () => { clearTimeout(timer); timer = setTimeout(() => activate(item), 150); });
    item.addEventListener('mouseleave', () => clearTimeout(timer));
    item.addEventListener('focus', () => { clearTimeout(timer); activate(item); }); // da tastiera: subito
  });
})();

// 2. Schede di RaceReady (tab accessibili, anche con le frecce)
(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  if (!tabs.length) return;
  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  };
  tabs.forEach((tab, n) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      const next = tabs[(n + step + tabs.length) % tabs.length];
      select(next); next.focus();
    });
  });
})();

// 2b. Slider dei progetti: frecce, contatore, trascinamento col mouse, tastiera
(() => {
  const root = document.querySelector('.carousel');
  if (!root) return;
  const track = root.querySelector('.carousel__track');
  const cards = [...track.children];
  const [prev, next] = root.querySelectorAll('.carousel__btn');
  const count = root.querySelector('[data-count]');
  const step = () => cards[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0);
  const current = () => Math.round(track.scrollLeft / step());
  const go = (n) => track.scrollTo({ left: Math.max(0, Math.min(cards.length - 1, n)) * step(), behavior: reduce ? 'auto' : 'smooth' });
  const sync = () => {
    const i = Math.min(cards.length - 1, current());
    count.textContent = i + 1;
    prev.disabled = track.scrollLeft < 4;
    next.disabled = track.scrollLeft > track.scrollWidth - track.clientWidth - 4;
  };
  prev.addEventListener('click', () => go(current() - 1));
  next.addEventListener('click', () => go(current() + 1));
  track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(current() + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(current() - 1); }
  });
  // trascinamento con il mouse (su touch lo scorrimento è già nativo)
  let down = false, moved = false, x0 = 0, s0 = 0;
  track.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; moved = false; x0 = e.clientX; s0 = track.scrollLeft; });
  addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - x0;
    if (Math.abs(dx) > 5) { moved = true; track.classList.add('is-dragging'); }
    track.scrollLeft = s0 - dx;
  });
  addEventListener('pointerup', () => {
    if (!down) return;
    down = false; track.classList.remove('is-dragging');
    if (moved) go(current());
  });
  track.addEventListener('click', (e) => { if (moved) { e.preventDefault(); moved = false; } }, true);
  addEventListener('resize', sync);
  sync();
})();

// 3. Muro di immagini: le due ali si aprono mentre scorri
(() => {
  const wall = document.querySelector('.wall');
  if (!wall || reduce) return;
  let ticking = false;
  const update = () => {
    const r = wall.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, 1 - (r.top + r.height / 2) / (innerHeight + r.height / 2)));
    wall.style.setProperty('--wall-ry', `${34 - p * 22}deg`);
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();

// 4. Contatti. L'indirizzo email non è scritto nelle pagine: i programmi che raccolgono indirizzi per lo spam leggono il codice
//    e non lo trovano. Si ricompone qui, va nei link [data-mail-link] (con data-mail-show si vede anche scritto)
//    e nel riquadro per scrivere, che compone l'email con il messaggio.
(() => {
  const address = ['edoardogiolitti02', 'gmail.com'].join('@');
  document.querySelectorAll('[data-mail-link]').forEach((a) => {
    a.href = `mailto:${address}`;
    if (a.hasAttribute('data-mail-show')) a.textContent = address;
  });
  const form = document.querySelector('[data-mail]');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const body = form.querySelector('[name="body"]').value.trim();
    const subject = form.querySelector('[name="subject"]').value;
    location.href = `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
})();

// 5. Entrata delle sezioni, una volta sola. Non lascia mai contenuti nascosti.
(() => {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;
  if (!('IntersectionObserver' in window)) { targets.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  targets.forEach((el) => io.observe(el));
  addEventListener('load', () => setTimeout(() => {
    targets.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('is-in'); });
  }, 2500));
})();
