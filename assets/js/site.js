/* Navigation, Einblendungen und Kontaktformular */
(function () {
  'use strict';
  var html = document.documentElement;
  var CFG = window.HB_CONFIG || {};

  /* Mobiles Menü */
  var nav = document.getElementById('nav'), btn = document.getElementById('menuBtn');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  btn.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); btn.focus(); } });

  /* Kopfzeile im statischen Modus */
  if (!html.classList.contains('story-on')) {
    var tb = document.getElementById('topbar');
    var onScroll = function () { tb.classList.toggle('solid', window.pageYOffset > 40); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    [].forEach.call(document.querySelectorAll('[data-restart]'), function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); window.scrollTo(0, 0); });
    });
  }

  /* Einblenden beim Scrollen */
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && html.classList.contains('story-on')) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var el = en.target, sib = [].indexOf.call(el.parentNode.children, el);
          el.style.transitionDelay = Math.min(sib, 5) * 70 + 'ms';
          el.classList.add('in'); io.unobserve(el);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    [].forEach.call(items, function (el) { io.observe(el); });
  } else {
    [].forEach.call(items, function (el) { el.classList.add('in'); });
  }

  /* Kontaktformular → vorbereitete E-Mail */
  var form = document.getElementById('contactForm'), note = document.getElementById('formNote');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = true, first = null;
    [].forEach.call(form.querySelectorAll('[required]'), function (f) {
      var valid = f.type === 'checkbox' ? f.checked : f.value.trim() !== '' && (f.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim()));
      f.setAttribute('aria-invalid', valid ? 'false' : 'true');
      if (!valid && !first) first = f;
      ok = ok && valid;
    });
    note.classList.remove('error', 'ok');
    if (!ok) {
      note.textContent = 'Bitte füllen Sie die markierten Felder aus und bestätigen Sie die Datenschutzhinweise.';
      note.classList.add('error'); first.focus(); return;
    }
    if (!CFG.contactEmail) {
      note.textContent = 'Hinweis für die Vorschau: Die Kontaktadresse ist noch nicht hinterlegt (assets/js/config.js → contactEmail).';
      note.classList.add('error'); return;
    }
    var d = new FormData(form);
    var subject = 'Anfrage Telegram-Werbung' + (d.get('firma') ? ' – ' + d.get('firma') : '');
    var bodyTxt = 'Name: ' + d.get('name') + '\nE-Mail: ' + d.get('email') + (d.get('firma') ? '\nUnternehmen: ' + d.get('firma') : '') + '\n\n' + d.get('nachricht');
    window.location.href = 'mailto:' + CFG.contactEmail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(bodyTxt);
    note.textContent = 'Ihr E-Mail-Programm sollte sich jetzt öffnen. Falls nicht, schreiben Sie uns direkt an ' + CFG.contactEmail + '.';
    note.classList.add('ok');
  });
})();
