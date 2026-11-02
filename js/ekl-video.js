// Video 3D di Eklettica: muto e in loop, parte da solo quando è in vista e si ferma fuori vista. 16:9, sui telefoni 4:5.
// Il bottone è la maniglia del giunto: mette in pausa o riprende.
// Con le animazioni ridotte o il risparmio dati non parte da solo: resta l'immagine di attesa finché non si preme il bottone.
// Senza JS restano i controlli del browser.
(() => {
  const fig = document.querySelector('[data-ekl-video]');
  if (!fig) return;
  const video = fig.querySelector('video');
  const btn = fig.querySelector('.ekl-video__btn');
  const label = btn.querySelector('.ekl-video__label');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches || (navigator.connection && navigator.connection.saveData);
  let userPaused = false;

  // sui telefoni il browser sceglie il 4:5 (source con media): stessa scelta per l'immagine di attesa
  const phone = video.querySelector('source[media]');
  if (phone && matchMedia(phone.media).matches) video.poster = video.dataset.posterPhone;
  video.removeAttribute('controls');
  btn.hidden = false;

  const update = () => {
    fig.dataset.state = video.paused ? 'paused' : 'playing';
    label.textContent = !video.paused ? 'Pausa' : video.currentTime > 0 ? 'Riprendi' : 'Guarda il video';
  };
  ['play', 'pause'].forEach((e) => video.addEventListener(e, update));

  btn.addEventListener('click', () => {
    userPaused = !video.paused;
    if (userPaused) video.pause();
    else video.play().catch(() => {});
  });

  if (!calm && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!userPaused) video.play().catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    }, { threshold: 0.6 }).observe(video);
  }
  update();
})();
