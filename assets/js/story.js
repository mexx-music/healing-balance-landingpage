/* ==========================================================================
   Healing & Balance – scrollgesteuerte Geschichte
   Ohne Bibliotheken: Jede Szene erhält aus der Scrollposition einen Fortschritt
   t (0…1). Daraus werden Kamera, Überblendungen und Effekte berechnet –
   vorwärts wie rückwärts identisch.
   ========================================================================== */
(function () {
  'use strict';

  var html = document.documentElement;
  var CFG = window.HB_CONFIG || {};
  var STORY = html.classList.contains('story-on');
  // Intro als Film (Standard) oder komplett scrollgesteuert (Vergleich: ?modus=scroll)
  // Modi: "szenen" (Standard: jede Scrollbewegung startet eine vollständige Szene),
  //       "film" (Szenen 1–3 laufen automatisch), "scroll" (alles direkt scrollgesteuert)
  var mq = /[?&]modus=(szenen|film|scroll)/.exec(location.search);
  var MODE = mq ? mq[1] : (CFG.introMode || 'szenen');
  var FILM = MODE === 'film', STEP = MODE === 'szenen';
  html.classList.add(STEP ? 'step-mode' : FILM ? 'film-mode' : 'scroll-mode');
  var SEEN_KEY = 'hb-intro-gesehen';
  function introSeen() { try { return !!localStorage.getItem(SEEN_KEY); } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(SEEN_KEY, new Date().toISOString().slice(0, 10)); } catch (e) {} }
  var forceIntro = /[?&]intro=1/.test(location.search);
  var deepLink = !!location.hash || /[?&]u=/.test(location.search);
  var autoIntro = forceIntro || (!introSeen() && !deepLink);
  var story = document.getElementById('story');
  var stage = document.getElementById('stage');
  if (!story || !stage) return;

  /* ---------- Hilfsfunktionen ---------- */
  function clamp(v, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function seg(t, a, b) { return clamp((t - a) / (b - a)); }
  function ease(t) { return t * t * (3 - 2 * t); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  var AR = 1672 / 941;
  var fmt = (window.Intl && Intl.NumberFormat) ? new Intl.NumberFormat('de-DE') : { format: String };
  var smallScreen = Math.min(screen.width, screen.height) < 600;

  /* ---------- Bilder laden ---------- */
  function loadImg(img, lazy) {
    if (img.getAttribute('data-loaded')) return;
    img.setAttribute('data-loaded', '1');
    img.decoding = 'async';
    if (lazy) img.loading = 'lazy';
    var base = img.getAttribute('data-src');
    if (base) {
      img.sizes = STORY ? '(max-aspect-ratio: 16/9) 178vh, 100vw' : '(min-width: 1280px) 1232px, 100vw';
      img.srcset = base + '-960.webp 960w, ' + base + '.webp 1672w';
      img.src = base + '.webp';
    } else if (img.getAttribute('data-src-raw')) {
      img.src = img.getAttribute('data-src-raw');
    }
  }

  var layered = (!!CFG.streetPlate || /[?&]ebenen=test/.test(location.search)) && !/[?&]ebenen=aus/.test(location.search);
  var horsesOn = layered && !!CFG.horseSprite && !/[?&]pferde=aus/.test(location.search);
  var plateImg = null, plateRatio = 1;
  if (layered) {
    var firstImg = document.querySelector('#sc-kutsche .pane .bg');
    var plate = CFG.streetPlate || 'assets/img/s1-kutsche-nah';
    if (/\.(webp|jpe?g|png|avif)$/i.test(plate)) { firstImg.removeAttribute('data-src'); firstImg.setAttribute('data-src-raw', plate); }
    else firstImg.setAttribute('data-src', plate);
    document.getElementById('coach').hidden = false;
    plateImg = firstImg;
    if (CFG.streetRatio && CFG.streetPlate) { plateRatio = CFG.streetRatio / AR; plateImg.classList.add('plate'); plateImg.style.setProperty('--par', plateRatio.toFixed(4)); }
    if (horsesOn) {
      var hz = document.querySelector('#coach .horses');
      hz.hidden = false; hz.style.backgroundImage = 'url(' + CFG.horseSprite + ')';
      document.querySelector('#coach .coach-base').setAttribute('data-src-raw', 'assets/img/c-kutsche-ohne-pferde.webp');
    }
    [].forEach.call(document.querySelectorAll('#sc-kutsche .pane:first-child .glow'), function (g) { g.remove(); });
  }

  /* ---------- Statischer Modus (reduzierte Bewegung) ---------- */
  if (!STORY) {
    [].forEach.call(stage.querySelectorAll('img[data-src], img[data-src-raw]'), function (img) { loadImg(img, true); });
    if (FILM || STEP) setupCalmIntro();
    var mt = document.getElementById('motionToggle2');
    if (mt) {
      mt.textContent = 'Animationen einschalten';
      mt.addEventListener('click', function () {
        try { localStorage.setItem('hb-motion', 'an'); } catch (e) {}
        location.href = location.pathname + '?bewegung=an';
      });
    }
    return;
  }

  /* ---------- Ruhige Kurzfassung des Intros (reduzierte Bewegung) ---------- */
  function setupCalmIntro() {
    var slides = [
      ['assets/img/s1-kutsche-nah', 'Kapitel 1 · Die Postkutsche', 'Vom Telegramm zur digitalen Reichweite.'],
      ['assets/img/s2-uebergabe', 'Kapitel 2 · Die Übergabe', 'Ihre Nachricht verdient Reichweite.'],
      ['assets/img/s3-zerfall', 'Kapitel 3 · Die Verwandlung', 'Aus Papier wird Licht.']
    ];
    var box = document.createElement('div');
    box.className = 'calm-intro'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Kurzes Intro');
    box.innerHTML = slides.map(function (sl, i) {
      return '<figure class="calm-slide" data-i="' + i + '"><img alt="" src="' + sl[0] + '-960.webp" srcset="' + sl[0] + '-960.webp 960w, ' + sl[0] + '.webp 1672w" sizes="100vw"><figcaption><p class="kicker">' + sl[1] + '</p><p class="calm-text">' + sl[2] + '</p></figcaption></figure>';
    }).join('') + '<button type="button" class="btn btn--gold film-skip calm-skip">Intro überspringen</button>';
    var timer = 0, idx = -1;
    function show(i) {
      idx = i;
      [].forEach.call(box.querySelectorAll('.calm-slide'), function (f, j) { f.classList.toggle('on', j === i); });
      if (i < slides.length - 1) timer = setTimeout(function () { show(i + 1); }, 2600);
      else timer = setTimeout(close, 2800);
    }
    function close() {
      clearTimeout(timer); markSeen();
      box.classList.add('out');
      html.classList.remove('calm-playing');
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 650);
    }
    function play() {
      clearTimeout(timer);
      box.classList.remove('out');
      if (!box.parentNode) document.body.appendChild(box);
      html.classList.add('calm-playing');
      window.scrollTo(0, 0);
      show(0);
      box.querySelector('.calm-skip').focus();
    }
    box.querySelector('.calm-skip').addEventListener('click', close);
    box.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    [].forEach.call(document.querySelectorAll('[data-restart], [data-replay]'), function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); e.stopImmediatePropagation(); play(); });
    });
    if (autoIntro) play();
  }

  /* ==========================================================================
     Animierter Modus
     ========================================================================== */
  var OV = 30; // Überblendung zwischen Szenen (in vh-Einheiten)

  // Kamera: [t, Fokus-x, Fokus-y, Zoom] – L = Querformat, P = Hochformat
  var CAM = {
    'sc-kutsche':   { L: [[0, .42, .5, 1.2], [.56, .6, .55, 1.06], [.68, .5, .52, 1.12], [1, .44, .5, 1]],
                      P: [[0, .3, .5, 1], [.56, .66, .5, 1], [.68, .4, .5, 1.04], [1, .33, .5, 1]] },
    'sc-telegramm': { L: [[0, .4, .28, 1.06], [.17, .55, .6, 1.3], [.5, .55, .6, 1.32], [.6, .5, .45, 1], [1, .52, .42, 1.06]],
                      P: [[0, .38, .3, 1], [.17, .56, .6, 1.08], [.5, .56, .6, 1.1], [.58, .3, .5, 1], [.655, .76, .4, 1], [1, .74, .4, 1]] },
    'sc-wechsel':   { L: [[0, .5, .42, 1.16], [1, .55, .42, 1]],
                      P: [[0, .12, .4, 1], [.35, .47, .5, 1], [.7, .78, .4, 1], [1, .93, .35, 1]] },
    'sc-ton':       { L: [[0, .5, .42, 1.14], [.46, .5, .42, 1], [.54, .52, .42, 1.06], [1, .52, .44, 1]],
                      P: [[0, .2, .35, 1], [.22, .52, .45, 1], [.44, .88, .45, 1], [.54, .2, .4, 1], [.78, .55, .45, 1], [1, .85, .4, 1]] },
    'sc-ads':       { L: [[0, .56, .34, 1.2], [.5, .56, .4, 1.06], [1, .52, .55, 1]],
                      P: [[0, .3, .4, 1], [.3, .66, .38, 1], [.6, .8, .38, 1], [1, .52, .7, 1]] },
    'sc-budget':    { L: [[0, .62, .22, 1.22], [.45, .6, .4, 1.05], [1, .56, .48, 1]],
                      P: [[0, .62, .2, 1], [.28, .35, .4, 1], [.55, .6, .45, 1], [.8, .85, .45, 1], [1, .9, .5, 1]] },
    'sc-loesung':   { L: [[0, .56, .45, 1.04], [.4, .55, .4, 1.1], [1, .55, .42, 1]],
                      P: [[0, .56, .45, 1], [1, .55, .42, 1]] }
  };

  if (layered && CFG.streetPlate) CAM['sc-kutsche'] = {
    L: [[0, .5, .62, 1.1], [.52, .5, .6, 1], [.6, .5, .55, 1.06], [.68, .5, .52, 1.12], [1, .44, .5, 1]],
    P: [[0, .3, .6, 1], [.52, .5, .6, 1], [.6, .42, .5, 1], [.68, .4, .5, 1.04], [1, .33, .5, 1]]
  };
  CAM['sc-willkommen'] = { L: [CAM['sc-wechsel'].L[0].slice()], P: [CAM['sc-wechsel'].P[0].slice()] };
  var allScenes = [].map.call(stage.querySelectorAll('.scene'), function (el) {
    return {
      el: el, id: el.id, len: +el.getAttribute('data-len') || 200,
      frame: el.querySelector('.frame'), anims: parseAnims(el), loaded: false, on: false, op: -1
    };
  });
  var FILM_IDS = ['sc-kutsche', 'sc-telegramm'];
  var filmScenes = FILM ? allScenes.filter(function (s) { return FILM_IDS.indexOf(s.id) >= 0; }) : [];
  var scenes = allScenes.filter(function (s) { return FILM ? FILM_IDS.indexOf(s.id) < 0 : s.id !== 'sc-willkommen'; });
  if (STEP) allScenes.forEach(function (sc) { sc.anims = sc.anims.filter(function (A) { return !A.n.classList.contains('step-hide'); }); });
  var telScene = allScenes.filter(function (s) { return s.id === 'sc-telegramm'; })[0];
  var fTotal = 0;
  filmScenes.forEach(function (s) { s.start = fTotal; fTotal += s.len; s.end = fTotal; });
  if (FILM) {
    // Im Film: Titel bleibt länger stehen, Scroll-Hinweise/Zwischentexte entfallen
    allScenes[0].anims.forEach(function (A) { if (A.n.classList.contains('hero-title')) A.b = .45; });
  }
  var total = 0;
  scenes.forEach(function (s) { s.start = total; total += s.len; s.end = total; });
  story.style.setProperty('--len', total);

  function parseAnims(root) {
    return [].map.call(root.querySelectorAll('[data-t]'), function (n) {
      var p = n.getAttribute('data-t').split(',');
      var fx = n.getAttribute('data-fx') || 'up';
      var a = parseFloat(p[0]), b = p[1] === undefined || p[1] === '' ? null : parseFloat(p[1]);
      var f = p[2] ? parseFloat(p[2]) : .06;
      if (fx === 'hl' && b === null) b = a + .08;
      var item = { n: n, a: a, b: b, f: f, fx: fx, last: -1 };
      if (fx === 'count') { item.count = +n.getAttribute('data-count'); item.suffix = n.getAttribute('data-suffix') || ''; }
      if (fx === 'path') { item.path = document.getElementById(n.getAttribute('data-path')); }
      var flap = n.querySelector('[data-flap]');
      if (flap) { item.flap = flap; item.flapText = flap.getAttribute('data-flap'); }
      return item;
    });
  }

  /* ---------- Maße ---------- */
  var W = 0, H = 0, fw = 0, fh = 0, unitPx = 1, storyTop = 0, storyEnd = 0, portrait = false, dpr = 1;
  var canvas = document.getElementById('fx'), ctx = canvas.getContext('2d');

  function measure() {
    W = stage.clientWidth; H = stage.clientHeight;
    portrait = W / H < 1;
    fw = Math.max(W, H * AR); fh = fw / AR;
    stage.style.setProperty('--fw', fw + 'px');
    stage.style.setProperty('--fh', fh + 'px');
    var r = story.getBoundingClientRect();
    storyTop = r.top + window.pageYOffset;
    unitPx = STEP ? 1 : (story.offsetHeight - H) / total;
    storyEnd = STEP ? storyTop + story.offsetHeight : storyTop + story.offsetHeight - H;
    dpr = Math.min(window.devicePixelRatio || 1, smallScreen ? 1.5 : 1.75);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    tg.measured = false; morph.ready = false; flight.ready = false; gears.built && layoutGears();
    if (typeof prepMorph === 'function' && document.readyState === 'complete') prepMorph();
    needs = true;
  }

  /* ---------- Kamera ---------- */
  function camAt(id, t) {
    var k = (portrait ? CAM[id].P : CAM[id].L);
    if (t <= k[0][0]) return { fx: k[0][1], fy: k[0][2], z: k[0][3] };
    for (var i = 1; i < k.length; i++) {
      if (t <= k[i][0]) {
        // kubische Hermite-Kurve mit Catmull-Rom-Tangenten: keine Zwischenstopps, weiche Richtungswechsel
        var a = k[i - 1], b = k[i], h = b[0] - a[0], x = (t - a[0]) / h;
        var p0 = k[i - 2] || a, p3 = k[i + 1] || b;
        var h00 = 2 * x * x * x - 3 * x * x + 1, h10 = x * x * x - 2 * x * x + x, h01 = -2 * x * x * x + 3 * x * x, h11 = x * x * x - x * x;
        var out = [];
        for (var j = 1; j <= 3; j++) {
          var m0 = (i - 2 >= 0) ? (b[j] - p0[j]) / (b[0] - p0[0]) * h : 0;
          var m1 = (i + 1 < k.length) ? (p3[j] - a[j]) / (p3[0] - a[0]) * h : 0;
          var v = h00 * a[j] + h10 * m0 + h01 * b[j] + h11 * m1;
          var lo = Math.min(a[j], b[j]), hi = Math.max(a[j], b[j]);
          out.push(clamp(v, lo - (hi - lo) * .15, hi + (hi - lo) * .15));
        }
        return { fx: out[0], fy: out[1], z: out[2] };
      }
    }
    var l = k[k.length - 1];
    return { fx: l[1], fy: l[2], z: l[3] };
  }
  function camXY(c) {
    var x = W / 2 - c.fx * fw * c.z, y = H / 2 - c.fy * fh * c.z;
    x = clamp(x, W - fw * c.z, 0); y = clamp(y, H - fh * c.z, 0);
    return { x: x, y: y, z: c.z };
  }
  function toScreen(cxy, fx, fy) { return { x: cxy.x + fx * fw * cxy.z, y: cxy.y + fy * fh * cxy.z }; }

  /* ---------- generische Animationen (data-t) ---------- */
  var FLAPCHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789€';
  function runAnims(s, t) {
    for (var i = 0; i < s.anims.length; i++) {
      var A = s.anims[i], v = seg(t, A.a, A.a + A.f);
      if (A.b !== null) v *= 1 - seg(t, A.b, A.b + A.f);
      if (A.fx !== 'path' && A.fx !== 'count' && A.fx !== 'bar' && A.fx !== 'var') v = ease(v);
      if (Math.abs(v - A.last) < .0005) continue;
      A.last = v;
      var n = A.n;
      n.style.setProperty('--v', v.toFixed(4));
      if (A.fx === 'up' || A.fx === 'fade' || A.fx === 'pop') n.style.visibility = v < .002 ? 'hidden' : '';
      if (A.fx === 'count') n.textContent = fmt.format(Math.round(easeOut(v) * A.count / 10) * 10) + A.suffix;
      else if (A.fx === 'path' && A.path) {
        var L = A.len || (A.len = A.path.getTotalLength()), p = A.path.getPointAtLength(ease(v) * L);
        n.setAttribute('cx', p.x.toFixed(1)); n.setAttribute('cy', p.y.toFixed(1));
      }
      if (A.flap) {
        var tx = A.flapText, k = Math.floor(seg(v, .25, 1) * tx.length), out = '';
        for (var c = 0; c < tx.length; c++) out += (c < k || tx[c] === ' ') ? tx[c] : FLAPCHARS[(Math.random() * FLAPCHARS.length) | 0];
        A.flap.textContent = out;
      }
    }
  }

  /* ---------- Szene 1: Kutsche (Staub, Rütteln, Ebenen-Modus) ---------- */
  var dust = [];
  var coach = document.getElementById('coach');
  var lastHF = -1;
  function coachW() { return (portrait && CFG.coachWidthPortrait) || CFG.coachWidth || 46; }
  function updKutsche(s, t, cxy, dt) {
    var moving = clamp(speed / 60) * (1 - seg(t, .78, .96));
    var drive = layered ? easeOut(seg(t, 0, .52)) : 0;
    if (layered && t < .62) {
      // Kamera folgt der Kutsche (vor allem im Hochformat)
      var ccx = lerp(-28, CFG.coachStop || 50, drive) / 100;
      var cam = camAt(s.id, clamp(t, 0, 1));
      var follow = portrait ? .9 : .25;
      var grp = ccx + coachW() / 100 * (portrait ? .1 : .42);   // Mitte von Kutsche (+ Pferden)
      cam.fx = lerp(cam.fx, clamp(grp, .2, .8), follow * (1 - seg(t, .52, .62)));
      cxy = camXY(cam);
      if (plateImg && plateRatio > 1) plateImg.style.setProperty('--px', (-(1 - 1 / plateRatio) * 100 * lerp(.08, .5, drive)).toFixed(3) + '%');
    }
    var shake = moving * (smallScreen ? 1.2 : 1.8) * Math.sin(now / 38);
    s.frame.style.transform = 'translate3d(' + cxy.x.toFixed(1) + 'px,' + (cxy.y + shake).toFixed(1) + 'px,0) scale(' + cxy.z.toFixed(4) + ')';

    if (layered) {
      var d = easeOut(seg(t, 0, .55));
      var cx = lerp(-28, CFG.coachStop || 50, d);
      var bob = Math.sin(cx * 1.7) * .25 * (1 - d * d);
      if (horsesOn) {
        var hf = Math.floor(Math.abs(cx) / 2.2) % (CFG.horseFrames || 8);
        if (d >= .999) hf = 2;
        if (hf !== lastHF) { coach.querySelector('.horses').style.setProperty('--hf', (hf / ((CFG.horseFrames || 8) - 1) * 100).toFixed(3) + '%'); lastHF = hf; }
      }
      coach.style.setProperty('--cx', cx.toFixed(2));
      coach.style.width = coachW() + '%';
      coach.style.setProperty('--cy', ((CFG.streetLevel || 88) + bob).toFixed(2));
      coach.style.setProperty('--rot', (cx * 48).toFixed(1) + 'deg');
    }
    // Staub an Rädern und Hufen
    var pts = t < .62 ? [[.22, .8], [.4, .83], [.56, .86], [.7, .86]] : [[.17, .8], [.42, .83], [.66, .89], [.82, .89]];
    if (layered && t < .6) { var cxp = parseFloat(coach.style.getPropertyValue('--cx')) / 100; pts = [[cxp - .2, .87], [cxp - .06, .88], [cxp + .08, .88], [cxp + .18, .88]]; }
    var rate = moving * (smallScreen ? 70 : 140) * dt;
    while (rate > 0 && dust.length < 220) {
      if (rate < 1 && Math.random() > rate) break;
      rate -= 1;
      var p = pts[(Math.random() * pts.length) | 0], sp = toScreen(cxy, p[0], p[1]);
      dust.push({ x: sp.x + (Math.random() - .5) * 30, y: sp.y + (Math.random() - .5) * 10, vx: -20 - Math.random() * 60, vy: -10 - Math.random() * 26, r: 3 + Math.random() * 9, life: 0, max: 1.2 + Math.random() * 1.4 });
    }
  }
  function drawDust(dt) {
    for (var i = dust.length - 1; i >= 0; i--) {
      var d = dust[i]; d.life += dt;
      if (d.life > d.max) { dust.splice(i, 1); continue; }
      d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= .985; d.vy *= .985; d.r += 6 * dt;
      var a = Math.sin(Math.PI * d.life / d.max) * .22;
      ctx.fillStyle = 'rgba(226,182,120,' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(d.x * dpr, d.y * dpr, d.r * dpr, 0, 6.2832); ctx.fill();
    }
  }

  /* ---------- Szene 2/3: Umschlag, Telegramm, Partikel, Flug ---------- */
  var env = document.getElementById('env'), envSeal = env.querySelector('.env-seal'), envFlash = env.querySelector('.env-flash');
  var tgEl = document.getElementById('tg'), tgMsg = document.getElementById('tgMsg'), tgDim = document.getElementById('tgDim');
  var tg = { measured: false };
  var envClosed = env.querySelector('.env-closed'), envOpen = env.querySelector('.env-img');
  if (CFG.closedEnvelope) { envClosed.hidden = false; envClosed.setAttribute('data-src-raw', CFG.closedEnvelope); }
  var chars = [];
  (function splitMsg() {
    var txt = tgMsg.textContent; tgMsg.textContent = '';
    tgMsg.setAttribute('aria-label', txt);
    for (var i = 0; i < txt.length; i++) {
      var sp = document.createElement('span'); sp.className = 'ch'; sp.textContent = txt[i]; sp.setAttribute('aria-hidden', 'true');
      tgMsg.appendChild(sp); chars.push(sp);
    }
  })();
  var shownChars = -1;

  var flight = { ready: false, svg: document.getElementById('flight'), wide: document.getElementById('trailWide'), core: document.getElementById('trailCore'), plane: document.getElementById('plane') };
  var morph = { ready: false, P: [] };
  var PLANE = [[[100, 28], [0, 46], [33, 57]], [[100, 28], [33, 57], [44, 84]], [[33, 57], [49, 66], [100, 28]]];
  var PLANE_FX = .8, PLANE_FY = .26, PLANE_W = .2, PLANE_ROT = 0;

  function planeScale(cxy) { return Math.min(PLANE_W * fw * cxy.z, W * (portrait ? .5 : .3)) / 100; }
  function measureTg() {
    tg.w = tgEl.offsetWidth; tg.h = tgEl.offsetHeight;
    tg.ew = env.offsetWidth; tg.eh = env.offsetHeight;
    tg.measured = true;
  }

  function buildMorph(cxy) {
    var N = smallScreen ? 520 : 1100;
    // Quellpunkte: Text des Telegramms (gerendert) + Papierfläche
    var cw = Math.ceil(tg.w), ch = Math.ceil(tg.h);
    var oc = document.createElement('canvas'); oc.width = cw; oc.height = ch;
    var o = oc.getContext('2d');
    o.fillStyle = '#000'; o.textBaseline = 'middle';
    [].forEach.call(tgEl.querySelectorAll('.tg-title, .tg-no, .tg-meta span, .tg-foot span, .ch'), function (el) {
      var cs = getComputedStyle(el);
      o.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      // Layout-Position (unabhängig von der aktuellen 3D-Drehung/Skalierung der Karte)
      var x = 0, y = 0, n = el;
      while (n && n !== tgEl) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      o.fillText(el.textContent, x, y + el.offsetHeight / 2);
    });
    var data = o.getImageData(0, 0, cw, ch).data, ink = [];
    for (var y = 0; y < ch; y += 2) for (var x = 0; x < cw; x += 2) if (data[(y * cw + x) * 4 + 3] > 120) ink.push([x, y]);
    // Zielpunkte: Papierflieger
    var pc = document.createElement('canvas'); pc.width = 100; pc.height = 100;
    var q = pc.getContext('2d'); q.fillStyle = '#000';
    PLANE.forEach(function (tri) { q.beginPath(); q.moveTo(tri[0][0], tri[0][1]); q.lineTo(tri[1][0], tri[1][1]); q.lineTo(tri[2][0], tri[2][1]); q.closePath(); q.fill(); });
    var pd = q.getImageData(0, 0, 100, 100).data, tgt = [];
    for (var yy = 0; yy < 100; yy++) for (var xx = 0; xx < 100; xx++) if (pd[(yy * 100 + xx) * 4 + 3] > 100) tgt.push([xx - 55, yy - 50]);
    var P = [];
    for (var i = 0; i < N; i++) {
      var src, fromInk = i < N * .62 && ink.length;
      if (fromInk) { var k = ink[(Math.random() * ink.length) | 0]; src = [k[0] - cw / 2, k[1] - ch / 2]; }
      else src = [(Math.random() - .5) * cw, (Math.random() - .5) * ch];
      var tp = tgt[(Math.random() * tgt.length) | 0];
      P.push({
        sx: src[0], sy: src[1], tx: tp[0], ty: tp[1],
        c1x: (Math.random() - .3) * W * .5, c1y: (Math.random() - .6) * H * .6,
        c2x: (Math.random() - .5) * 120, c2y: (Math.random() - .5) * 120,
        d: Math.random() * .38, s: fromInk ? 1.8 + Math.random() * 1.8 : 1.2 + Math.random() * 1.6,
        ph: Math.random() * 6.28, ink: !!fromInk
      });
    }
    morph.P = P; morph.ready = true;
  }

  function buildFlight(cxy) {
    var S = toScreen(cxy, PLANE_FX, PLANE_FY);
    function P(x, y) { return x.toFixed(1) + ' ' + y.toFixed(1); }
    // Start in Flugrichtung, große Schleife durch die Szene, Ausflug oben rechts
    var d = 'M' + P(S.x, S.y) +
      ' C' + P(S.x + W * .16, S.y - H * .03) + ' ' + P(W * .99, H * .62) + ' ' + P(W * .68, H * .74) +
      ' S' + P(W * .1, H * .8) + ' ' + P(W * .32, H * .5) +
      ' S' + P(W * .82, H * .02) + ' ' + P(W * 1.16, -H * .2);
    flight.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    flight.wide.setAttribute('d', d); flight.core.setAttribute('d', d);
    flight.len = flight.core.getTotalLength();
    [flight.wide, flight.core].forEach(function (p) { p.style.strokeDasharray = flight.len + ' ' + flight.len; });
    flight.start = S;
    flight.ready = true;
  }

  function updTelegramm(s, t, cxy) {
    s.frame.style.transform = 'translate3d(' + cxy.x.toFixed(1) + 'px,' + cxy.y.toFixed(1) + 'px,0) scale(' + cxy.z.toFixed(4) + ')';
    if (!tg.measured) measureTg();

    // Abdunkeln
    var dim = .74 * ease(seg(t, .16, .26)) - .5 * ease(seg(t, .5, .6)) + .22 * ease(seg(t, .68, .76));
    tgDim.style.opacity = dim.toFixed(3);

    // Umschlag
    var a = easeOut(seg(t, .17, .28)), drop = seg(t, .33, .43);
    var eo = Math.min(1, a * 3) * (1 - seg(t, .36, .43));
    env.style.opacity = eo.toFixed(3);
    if (eo > 0) {
      var ex = lerp(W * .32, 0, a), ey = lerp(H * .6, 0, a) + drop * drop * H * .7;
      var es = lerp(.35, 1, a) * (1 - .12 * drop), er = lerp(14, -3, a) + drop * 8;
      env.style.transform = 'translate3d(calc(-50% + ' + ex.toFixed(1) + 'px), calc(-50% + ' + ey.toFixed(1) + 'px), 0) rotate(' + er.toFixed(2) + 'deg) scale(' + es.toFixed(4) + ')';
      if (CFG.closedEnvelope) {
        var op = ease(seg(t, .292, .318));
        envClosed.style.opacity = (1 - op).toFixed(3);
        envOpen.style.opacity = op.toFixed(3); envSeal.style.opacity = op.toFixed(3);
      }
      var sb = seg(t, .28, .33);
      envSeal.style.transform = 'translate(-50%,-50%) rotate(' + (Math.sin(sb * Math.PI * 3) * 6 * (1 - sb)).toFixed(2) + 'deg) scale(' + (1 + .16 * Math.sin(Math.PI * sb)).toFixed(3) + ')';
      var fl = seg(t, .28, .33);
      envFlash.style.setProperty('--fs', (ease(fl) * 1.8).toFixed(3));
      envFlash.style.setProperty('--fo', Math.sin(Math.PI * fl).toFixed(3));
    }

    // Telegramm
    var c = easeInOut(seg(t, .31, .4));
    var co = seg(t, .305, .33) * (1 - seg(t, .535, .548));
    tgEl.style.opacity = co.toFixed(3);
    tgEl.style.visibility = co < .002 ? 'hidden' : '';
    if (co > 0) {
      var s0 = (tg.ew * .78) / tg.w;
      var cy0 = -tg.eh * .22, cy1 = -H * .02;
      var sc = lerp(s0, 1, c), y = lerp(cy0, cy1, c), rx = lerp(62, 0, c);
      var burn = seg(t, .52, .545);
      tgEl.style.transform = 'translate3d(-50%, calc(-50% + ' + y.toFixed(1) + 'px), 0) perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) scale(' + (sc * (1 + burn * .03)).toFixed(4) + ')';
      tgEl.style.filter = burn > 0 ? 'brightness(' + (1 + burn * .8).toFixed(2) + ') sepia(' + (burn * .5).toFixed(2) + ')' : '';
    }
    var n = Math.round(seg(t, .38, .47) * chars.length);
    if (n !== shownChars) {
      for (var i = 0; i < chars.length; i++) chars[i].style.opacity = i < n ? '1' : '0';
      shownChars = n;
    }

    // Partikel: Telegramm zerfällt und formt den Papierflieger
    var m = seg(t, .535, .665), pf = 1 - seg(t, .652, .69);
    morph.active = t > .535 && pf > 0;
    morph.t = t; morph.m = m; morph.pf = pf;
    if (morph.active) {
      if (!morph.ready) buildMorph(cxy);
      var tc = toScreen(cxy, PLANE_FX, PLANE_FY);
      morph.cx = W / 2; morph.cy = H / 2 - H * .02; morph.tx = tc.x; morph.ty = tc.y;
      morph.scale = planeScale(cxy);
    }

    // Flug
    var pa = seg(t, .645, .675), fpRaw = seg(t, .68, .92), fp = easeInOut(fpRaw);
    var planeOn = pa > 0 && fpRaw < 1;
    flight.plane.style.opacity = (pa * (1 - seg(fpRaw, .9, 1))).toFixed(3);
    var trailOp = seg(t, .675, .7) * (1 - .55 * seg(t, .94, 1));
    flight.wide.style.opacity = (trailOp * .22).toFixed(3);
    flight.core.style.opacity = (trailOp * .95).toFixed(3);
    if (planeOn || trailOp > 0) {
      if (!flight.ready) buildFlight(camXY(camAt(s.id, .68)));
      var L = flight.len, pos = fp * L;
      flight.wide.style.strokeDashoffset = (L - pos).toFixed(1);
      flight.core.style.strokeDashoffset = (L - pos).toFixed(1);
      var scale = planeScale(cxy) * lerp(1, smallScreen ? .8 : .7, seg(fpRaw, 0, .3));
      var px, py, ang;
      if (fpRaw <= 0) { var st = toScreen(cxy, PLANE_FX, PLANE_FY); px = st.x; py = st.y; ang = PLANE_ROT; }
      else {
        var p1 = flight.core.getPointAtLength(pos), p2 = flight.core.getPointAtLength(Math.min(L, pos + 2));
        px = p1.x; py = p1.y;
        var tang = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
        ang = lerp(PLANE_ROT, tang + 6, seg(fpRaw, 0, .06));
      }
      flight.plane.setAttribute('transform', 'translate(' + px.toFixed(1) + ' ' + py.toFixed(1) + ') rotate(' + ang.toFixed(1) + ') scale(' + scale.toFixed(3) + ')');
    }
  }

  function drawMorph() {
    var P = morph.P, m = morph.m, pf = morph.pf, sc = morph.scale;
    var r = PLANE_ROT * Math.PI / 180, cr = Math.cos(r), sr = Math.sin(r);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < P.length; i++) {
      var p = P[i], k = clamp((m - p.d) / .62); k = easeInOut(k);
      var sx = morph.cx + p.sx, sy = morph.cy + p.sy;
      var txl = p.tx * sc, tyl = p.ty * sc;
      var tx = morph.tx + txl * cr - tyl * sr, ty = morph.ty + txl * sr + tyl * cr;
      var u = 1 - k;
      var x = u * u * u * sx + 3 * u * u * k * (sx + p.c1x) + 3 * u * k * k * (tx + p.c2x) + k * k * k * tx;
      var y = u * u * u * sy + 3 * u * u * k * (sy + p.c1y) + 3 * u * k * k * (ty + p.c2y) + k * k * k * ty;
      var tw = .65 + .35 * Math.sin(now / 160 + p.ph);
      var R = Math.round(lerp(255, 120, k)), G = Math.round(lerp(p.ink ? 190 : 214, 246, k)), B = Math.round(lerp(p.ink ? 110 : 150, 240, k));
      var a = pf * tw * (k < .02 ? Math.min(1, (m - p.d + .02) * 40) : 1) * (p.ink ? 1 : .7);
      if (a <= 0) continue;
      ctx.fillStyle = 'rgba(' + R + ',' + G + ',' + B + ',' + a.toFixed(3) + ')';
      var sz = p.s * dpr * (1 + Math.sin(Math.PI * k) * .9);
      ctx.fillRect(x * dpr - sz / 2, y * dpr - sz / 2, sz, sz);
      if (i % 3 === 0) { ctx.globalAlpha = .18; ctx.fillRect(x * dpr - sz * 1.5, y * dpr - sz * 1.5, sz * 3, sz * 3); ctx.globalAlpha = 1; }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- Szene 8: Zahnräder werden zur Zentrale ---------- */
  var gears = { built: false, el: document.getElementById('gears'), list: [] };
  var GEARS = [ // x, y (Anteil), Radius (Anteil der kleineren Seite), Zähne, Richtung
    [.12, .22, .2, 14, 1], [.3, .62, .15, 12, -1], [.08, .78, .13, 10, -1], [.5, .2, .11, 10, -1], [.66, .7, .19, 16, 1],
    [.86, .26, .16, 13, 1], [.92, .7, .12, 10, -1], [.42, .9, .1, 9, 1], [.73, .4, .08, 8, -1], [.24, .4, .07, 8, 1]
  ];
  function gearPath(r, n) {
    var d = '', ri = r * .82, rh = r * .3, step = Math.PI * 2 / n;
    for (var i = 0; i < n; i++) {
      var a = i * step, pts = [[ri, a - step * .3], [r, a - step * .17], [r, a + step * .17], [ri, a + step * .3]];
      pts.forEach(function (p, j) { var x = Math.cos(p[1]) * p[0], y = Math.sin(p[1]) * p[0]; d += (i === 0 && j === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1); });
      var a2 = a + step * .7; d += 'A' + ri.toFixed(1) + ' ' + ri.toFixed(1) + ' 0 0 1 ' + (Math.cos(a2) * ri).toFixed(1) + ' ' + (Math.sin(a2) * ri).toFixed(1);
    }
    d += 'Z M' + rh + ' 0 A' + rh + ' ' + rh + ' 0 1 0 ' + (-rh) + ' 0 A' + rh + ' ' + rh + ' 0 1 0 ' + rh + ' 0Z';
    return d;
  }
  function buildGears() {
    var ns = 'http://www.w3.org/2000/svg';
    gears.el.innerHTML = '<defs><radialGradient id="gBrass" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffe7a8"/><stop offset=".35" stop-color="#c8913a"/><stop offset=".75" stop-color="#7a4f17"/><stop offset="1" stop-color="#3d260a"/></radialGradient></defs>';
    GEARS.forEach(function (g) {
      var grp = document.createElementNS(ns, 'g'), path = document.createElementNS(ns, 'path'), ring = document.createElementNS(ns, 'circle');
      path.setAttribute('fill-rule', 'evenodd'); path.setAttribute('fill', 'url(#gBrass)'); path.setAttribute('stroke', '#4fe3e0'); path.setAttribute('stroke-width', '2.5');
      ring.setAttribute('fill', 'none'); ring.setAttribute('stroke-width', '2');
      grp.appendChild(path); grp.appendChild(ring); gears.el.appendChild(grp);
      gears.list.push({ g: g, grp: grp, path: path, ring: ring });
    });
    gears.built = true; layoutGears();
  }
  function layoutGears() {
    var m = Math.min(W, H);
    gears.el.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    gears.list.forEach(function (o) {
      var r = o.g[2] * m * (portrait ? 1.25 : 1);
      o.r = r; o.x = o.g[0] * W; o.y = o.g[1] * H;
      o.path.setAttribute('d', gearPath(r, o.g[3]));
      o.ring.setAttribute('r', (r * .58).toFixed(1));
    });
  }
  function updLoesung(s, t, cxy, u) {
    s.frame.style.transform = 'translate3d(' + cxy.x.toFixed(1) + 'px,' + cxy.y.toFixed(1) + 'px,0) scale(' + cxy.z.toFixed(4) + ')';
    if (!gears.built) buildGears();
    var vis = ease(seg(t, -.1, .05)) * (1 - ease(seg(t, .28, .42)));
    gears.el.style.opacity = vis.toFixed(3);
    gears.el.style.visibility = vis < .002 ? 'hidden' : '';
    if (vis <= 0) return;
    var k = easeInOut(seg(t, .14, .38));
    var cx = W / 2, cy = H * .36;
    gears.list.forEach(function (o, i) {
      var rot = u * (40 / (o.g[2] * 10)) * o.g[4];
      var x = lerp(o.x, cx, k), y = lerp(o.y, cy, k), sc = lerp(1, .12, k);
      o.grp.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + rot.toFixed(1) + ') scale(' + sc.toFixed(3) + ')');
      o.path.setAttribute('fill-opacity', (1 - ease(seg(k, .1, .6))).toFixed(3));
      o.path.setAttribute('stroke-opacity', (.15 + .85 * ease(seg(k, .05, .5))).toFixed(3));
      o.ring.setAttribute('stroke', k > .3 ? '#8ff6f1' : '#3d260a'); o.ring.setAttribute('stroke-opacity', (.35 + .5 * k).toFixed(2));
    });
  }

  /* ---------- Kapitelnavigation ---------- */
  var chapNav = document.getElementById('chapters'), chapters = [];
  (function buildChapters() {
    var ol = document.createElement('ol');
    scenes.forEach(function (s) {
      chapters.push({ label: s.el.getAttribute('data-chapter'), u: s.start === 0 ? 0 : s.start + OV });
      var c2 = s.el.getAttribute('data-chapter2');
      if (c2) { var p = c2.split('|'); chapters.push({ label: p[1], u: s.start + parseFloat(p[0]) * s.len + 20 }); }
    });
    chapters.forEach(function (c, i) {
      var li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.innerHTML = '<span>' + (i + 1) + ' · ' + c.label + '</span><i></i>';
      b.setAttribute('aria-label', 'Kapitel ' + (i + 1) + ': ' + c.label);
      b.addEventListener('click', function () { if (STEP) stepChapter(c.u); else jumpTo(c.u); });
      li.appendChild(b); ol.appendChild(li); c.btn = b;
    });
    if (FILM || STEP) {
      var rb = document.createElement('button');
      rb.type = 'button'; rb.className = 'chapter-replay'; rb.setAttribute('data-replay', '');
      rb.innerHTML = '<span>Intro ansehen</span><i aria-hidden="true">▶</i>';
      chapNav.insertBefore(rb, chapNav.firstChild);
    }
    chapNav.appendChild(ol);
  })();
  function jumpTo(u) { window.scrollTo(0, Math.round(storyTop + u * unitPx) + 1); }
  var curChap = -1;

  /* ---------- Hauptschleife ---------- */
  var raf = 0, lastU = -1, needs = true, now = 0, lastNow = 0, speed = 0, lastY = -1;
  var progressBar = document.getElementById('progressBar');
  var topbar = document.getElementById('topbar');
  var body = document.body;
  var canvasDirty = false;

  // Film-Zeitachse: [Sekunde, Position in der Geschichte] (Einheiten wie im Scroll-Modus)
  var FILM_KEYS = [[0, 0], [2.8, 125], [3.5, 172], [4.5, 222], [5.1, 285], [5.9, 340], [6.5, 405], [7.5, 500],
                   [8.1, 530], [9.3, 628], [10.6, 760], [11.2, 788], [12, 800]];
  var FILM_FADE = 11.2, FILM_END = 12;
  var film = { active: false, sec: 0, u: 0, lastU: 0, speed: 0, cleared: true };
  function filmU(sec) {
    for (var i = 1; i < FILM_KEYS.length; i++) if (sec <= FILM_KEYS[i][0]) {
      var a = FILM_KEYS[i - 1], b = FILM_KEYS[i];
      return lerp(a[1], b[1], (sec - a[0]) / (b[0] - a[0]));
    }
    return FILM_KEYS[FILM_KEYS.length - 1][1];
  }

  function renderScene(s, u, isFirst, isLast, mul, dt) {
    var vis = (u >= s.start - OV - 1 && (isLast || u <= s.end + OV)) || (isFirst && u < s.end + OV);
    var op = (isFirst ? 1 : ease(seg(u, s.start - OV, s.start + OV))) * mul;
    if (vis && mul <= 0) vis = false;
    if (vis && !s.loaded) loadSceneObj(s);
    if (vis !== s.on) { s.on = vis; s.el.classList.toggle('on', vis); }
    if (!vis) return;
    if (Math.abs(op - s.op) > .0005) { s.el.style.opacity = op.toFixed(4); s.op = op; }
    var t = (u - s.start) / s.len;
    var cxy = camXY(camAt(s.id, clamp(t, -.2, 1.2)));
    if (s.id === 'sc-kutsche') updKutsche(s, t, cxy, dt);
    else if (s.id === 'sc-telegramm') updTelegramm(s, t, cxy);
    else if (s.id === 'sc-loesung') updLoesung(s, t, cxy, u);
    else s.frame.style.transform = 'translate3d(' + cxy.x.toFixed(1) + 'px,' + cxy.y.toFixed(1) + 'px,0) scale(' + cxy.z.toFixed(4) + ')';
    runAnims(s, t);
  }

  function tick(ts) {
    raf = 0;
    now = ts || performance.now();
    var dt = lastNow ? Math.min(.05, (now - lastNow) / 1000) : .016; lastNow = now;
    var y = window.pageYOffset;
    if (STEP && step.playing) {
      step.el += dt;
      var kk = clamp(step.el / step.dur);
      step.u = lerp(step.from, step.to, easeSine(kk));
      stepNext.style.setProperty('--p', (step.to > step.from ? kk : 1 - kk).toFixed(3));
      if (kk >= 1) finishBeat();
    }
    var u = STEP ? step.u : (y - storyTop) / unitPx;
    var du = lastU < 0 ? 0 : Math.abs(u - lastU);
    var inStory = y < storyEnd + H * .5;

    if (STEP) {
      body.classList.toggle('in-story', step.engaged);
      topbar.classList.toggle('solid', !step.engaged && y > 10);
    } else {
      body.classList.toggle('in-story', y < storyEnd - 10);
      topbar.classList.toggle('solid', y > storyEnd - 10);
    }

    // --- Film (Szenen 1–3, zeitgesteuert)
    if (film.active) {
      if (film.started) film.sec += dt;
      film.u = filmU(film.sec);
      film.speed = lerp(film.speed, Math.abs(film.u - film.lastU) / dt, .25);
      film.lastU = film.u;
      speed = film.speed;
      var fEnd = FILM_END_OVERRIDE || FILM_END;
      var fade = 1 - ease(seg(film.sec, film.fadeFrom, fEnd));
      for (var f = 0; f < filmScenes.length; f++) renderScene(filmScenes[f], film.u, f === 0, f === filmScenes.length - 1, fade, dt);
      if (!telScene.on) morph.active = false;
      progressBar.style.transform = 'scaleX(' + clamp(film.sec / FILM_END).toFixed(4) + ')';
      film.cleared = false;
      if (film.sec >= fEnd) endFilm();
    } else if (!film.cleared) {
      filmScenes.forEach(function (fs) { fs.on = false; fs.el.classList.remove('on'); fs.op = -1; });
      morph.active = false; dust.length = 0; film.cleared = true; needs = true;
    }
    if (!film.active) speed = lerp(speed, du / dt, .18);

    // --- Scrollgesteuerte Szenen
    if (inStory && (u !== lastU || needs || film.active || (STEP && step.playing) || dust.length || morph.active || speed > .5)) {
      lastU = u; needs = false;
      if (!film.active) progressBar.style.transform = 'scaleX(' + clamp(u / total).toFixed(4) + ')';
      for (var i = 0; i < scenes.length; i++) {
        renderScene(scenes[i], u, i === 0, i === scenes.length - 1, 1, dt);
        if (scenes[i].on && i + 1 < scenes.length) loadSceneObj(scenes[i + 1]);
      }
      if (!FILM && !telScene.on) morph.active = false;

      // Kapitel
      var cc = 0;
      for (var c = 0; c < chapters.length; c++) if (u >= chapters[c].u - OV - 2) cc = c;
      if (cc !== curChap) {
        chapters.forEach(function (ch, j) {
          if (j === cc) ch.btn.setAttribute('aria-current', 'step'); else ch.btn.removeAttribute('aria-current');
          ch.btn.classList.toggle('done', j < cc);
        });
        curChap = cc;
      }
    }

    // Leinwand
    if (dust.length || morph.active || canvasDirty) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvasDirty = false;
      if (dust.length) { drawDust(dt); canvasDirty = true; }
      if (morph.active && morph.ready) { drawMorph(); canvasDirty = true; }
    }

    if (film.active || (STEP && step.playing) || (inStory && (Math.abs(y - lastY) > 0 || dust.length || morph.active || speed > .5 || needs))) schedule();
    lastY = y;
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(tick); }
  function loadScene(i) { loadSceneObj(scenes[i]); }
  function loadSceneObj(s) {
    if (!s || s.loaded) return; s.loaded = true;
    [].forEach.call(s.el.querySelectorAll('img[data-src], img[data-src-raw]'), function (img) { loadImg(img, false); });
  }

  /* ---------- Bedienung ---------- */
  function goToContent() {
    var t = document.getElementById('inhalt');
    window.scrollTo(0, t.getBoundingClientRect().top + window.pageYOffset - (topbar.offsetHeight - 1));
  }
  /* ---------- Film steuern ---------- */
  var filmSkipBtn = document.getElementById('filmSkip');
  var prevFocus = null;
  function blockScroll(e) {
    if (!film.active) return;
    if (e.type === 'keydown') {
      if (e.key === 'Escape') { e.preventDefault(); skipFilm(); return; }
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].indexOf(e.key) < 0 || e.target.closest('button, a')) return;
    }
    e.preventDefault();
    filmSkipBtn.classList.remove('nudge'); void filmSkipBtn.offsetWidth; filmSkipBtn.classList.add('nudge');
  }
  window.addEventListener('wheel', blockScroll, { passive: false });
  window.addEventListener('touchmove', blockScroll, { passive: false });
  window.addEventListener('keydown', blockScroll);

  function playFilm() {
    if (!FILM) return;
    window.scrollTo(0, 0);
    film.active = true; film.started = false; film.sec = 0; film.fadeFrom = FILM_FADE; film.speed = 0; film.lastU = 0;
    filmScenes.forEach(function (fs) { fs.op = -1; fs.anims.forEach(function (A) { A.last = -1; }); });
    shownChars = -1; dust.length = 0; morph.ready = false;
    html.classList.add('film-playing');
    stage.setAttribute('aria-live', 'off');
    prevFocus = document.activeElement;
    filmSkipBtn.hidden = false;
    filmSkipBtn.focus({ preventScroll: true });
    // kurz auf Bilder der ersten Szenen warten (max. 2,5 s), dann starten
    filmScenes.forEach(loadSceneObj); loadSceneObj(scenes[0]);
    var imgs = [].slice.call(filmScenes[0].el.querySelectorAll('img')).concat([].slice.call(filmScenes[1].el.querySelectorAll('img')));
    var ready = Promise.all(imgs.map(function (im) { return im.decode ? im.decode().catch(function () {}) : null; }));
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([Promise.all([ready, fonts]), new Promise(function (r) { setTimeout(r, 2500); })]).then(function () {
      if (film.active) { film.started = true; lastNow = 0; }
    });
    measure(); schedule();
  }
  function skipFilm() {
    if (!film.active) return;
    film.started = true;
    film.fadeFrom = Math.min(film.fadeFrom, film.sec);
    film.sec = Math.max(film.sec, film.fadeFrom);
    // schnelles Ausblenden (0,45 s)
    FILM_END_OVERRIDE = film.sec + .45;
  }
  var FILM_END_OVERRIDE = 0;
  function endFilm() {
    film.active = false; FILM_END_OVERRIDE = 0;
    html.classList.remove('film-playing');
    filmSkipBtn.hidden = true;
    markSeen();
    window.scrollTo(0, 0);
    var wt = document.getElementById('welcomeTitle');
    if (wt && (!document.activeElement || document.activeElement === filmSkipBtn || document.activeElement === document.body)) wt.focus({ preventScroll: true });
    measure(); needs = true; schedule();
  }
  filmSkipBtn.addEventListener('click', skipFilm);
  document.getElementById('skipIntro').addEventListener('click', function () { if (STEP) skipIntroStep(); else if (film.active) skipFilm(); else goToContent(); });
  [].forEach.call(document.querySelectorAll('[data-restart], [data-replay]'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); if (STEP) restartStep(); else if (FILM) playFilm(); else window.scrollTo(0, 0); });
  });
  function motionOff() {
    try { localStorage.setItem('hb-motion', 'aus'); } catch (e) {}
    location.href = location.pathname + '?bewegung=aus';
  }
  document.getElementById('motionToggle').addEventListener('click', motionOff);
  var mt2 = document.getElementById('motionToggle2');
  if (mt2) mt2.addEventListener('click', motionOff);

  // Tastatur: Pfeiltasten/Bild-Tasten springen kapitelweise (nur innerhalb der Geschichte)
  document.addEventListener('keydown', function (e) {
    if (STEP || film.active || !body.classList.contains('in-story') || e.target.closest('input, textarea, select')) return;
    if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault();
      var nxt = curChap + (e.key === 'PageDown' ? 1 : -1);
      if (nxt >= chapters.length) goToContent(); else if (nxt >= 0) jumpTo(chapters[nxt].u);
    }
  });

  var rT = 0;
  window.addEventListener('resize', function () { clearTimeout(rT); rT = setTimeout(function () { measure(); schedule(); }, 120); });
  window.addEventListener('orientationchange', function () { setTimeout(function () { measure(); schedule(); }, 300); });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('load', function () { measure(); schedule(); preloadAll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { tg.measured = false; morph.ready = false; needs = true; schedule(); prepMorph(); });


  /* ==========================================================================
     Szenenmodus: Eine Scroll-/Wischbewegung startet eine vollständige Szene,
     die zeitgesteuert bis zum nächsten Ruhepunkt abläuft.
     ========================================================================== */
  // Ruhepunkte (Position in der Geschichte) und Dauer der Abschnitte dazwischen (Sekunden)
  var RESTS = [0, 205, 510, 765, 957, 1113, 1246, 1372, 1478, 1707, 1980];
  var DURS  = [4.4, 4.6, 4.6, 3.6, 3.2, 3.4, 3.0, 3.0, 4.0, 4.6];
  var step = { u: 0, idx: 0, playing: false, pending: false, engaged: false, el: 0, dur: 1, from: 0, to: 0, target: 0, cool: 0, releasing: 0 };
  var stepCtl = document.getElementById('stepControls'), stepNext = document.getElementById('stepNext'),
      stepBack = document.getElementById('stepBack'), stepSkipB = document.getElementById('stepSkip'), veil = document.getElementById('veil');
  function easeSine(x) { return -(Math.cos(Math.PI * x) - 1) / 2; }
  function scenesBetween(a, b) {
    var lo = Math.min(a, b) - OV - 2, hi = Math.max(a, b) + OV + 2;
    return scenes.filter(function (sc) { return sc.end >= lo && sc.start <= hi; });
  }
  function decodeScenes(list, timeout) {
    var imgs = [];
    list.forEach(function (sc) { loadSceneObj(sc); imgs = imgs.concat([].slice.call(sc.el.querySelectorAll('img'))); });
    var all = Promise.all(imgs.map(function (im) { return im.decode ? im.decode().catch(function () {}) : null; }));
    return timeout ? Promise.race([all, new Promise(function (r) { setTimeout(r, timeout); })]) : all;
  }
  function updateStepUI() {
    if (!STEP) return;
    stepCtl.hidden = !step.engaged;
    var last = step.idx >= RESTS.length - 1;
    stepNext.querySelector('.lbl').textContent = step.idx === 0 && !step.playing ? 'Reise starten' : last && !step.playing ? 'Zur Website' : 'Weiter';
    stepNext.classList.toggle('busy', step.playing || step.pending);
    stepNext.setAttribute('aria-disabled', step.playing || step.pending ? 'true' : 'false');
    if (!step.playing) stepNext.style.setProperty('--p', '0');
    stepBack.hidden = step.idx === 0 && !step.playing;
    html.classList.toggle('step-locked', step.engaged);
  }
  function nudge() { stepNext.classList.remove('nudge'); void stepNext.offsetWidth; stepNext.classList.add('nudge'); }
  function stepGo(dir) {
    if (!STEP || !step.engaged) return false;
    if (step.playing || step.pending || performance.now() < step.cool) { nudge(); return false; }   // keine Warteschlange
    if (dir > 0 && step.idx >= RESTS.length - 1) { leaveStory(true); return true; }
    if (dir < 0 && step.idx <= 0) return false;
    var to = step.idx + dir;
    step.pending = true; updateStepUI();
    decodeScenes(scenesBetween(RESTS[step.idx], RESTS[to]), 900).then(function () {
      step.pending = false;
      if (!step.engaged) { updateStepUI(); return; }
      step.from = step.u; step.to = RESTS[to]; step.target = to; step.el = 0;
      step.dur = dir > 0 ? DURS[step.idx] : DURS[to] * .55;
      step.playing = true; lastNow = 0;
      updateStepUI(); schedule();
    });
    return true;
  }
  function finishBeat() {
    step.playing = false; step.idx = step.target; step.u = step.to;
    step.cool = performance.now() + 250;
    updateStepUI(); preloadAhead();
  }
  function preloadAhead() { decodeScenes(scenesBetween(RESTS[step.idx], RESTS[Math.min(RESTS.length - 1, step.idx + 2)])); }
  function engage() {
    if (!STEP || step.engaged) return;
    step.engaged = true; gest.used = true;
    updateStepUI(); needs = true; schedule();
  }
  function disengage() {
    step.engaged = false; step.releasing = performance.now() + 1200;
    updateStepUI(); needs = true; schedule();
  }
  function leaveStory(smooth) {
    disengage();
    var t = document.getElementById('inhalt');
    window.scrollTo({ top: t.getBoundingClientRect().top + window.pageYOffset - (topbar.offsetHeight - 1), behavior: smooth ? 'smooth' : 'auto' });
  }
  function withVeil(fn) {
    veil.classList.add('on');
    setTimeout(function () {
      fn();
      needs = true; schedule();
      requestAnimationFrame(function () { requestAnimationFrame(function () { veil.classList.remove('on'); }); });
    }, 280);
  }
  function setRest(i) {
    step.playing = false; step.pending = false; step.idx = i; step.u = RESTS[i];
    dust.length = 0; morph.active = false;
  }
  function skipIntroStep() {
    withVeil(function () { setRest(RESTS.length - 1); leaveStory(false); });
  }
  function restartStep() {
    withVeil(function () { window.scrollTo(0, 0); setRest(0); step.releasing = 0; engage(); });
  }
  function stepChapter(cu) {
    var i = 0;
    for (var r = 0; r < RESTS.length; r++) if (RESTS[r] <= cu - OV + 1) i = r;
    withVeil(function () { setRest(i); engage(); });
    if (cu > OV) setTimeout(function () { stepGo(1); }, 650);   // Kapitel-Szene anschließend abspielen
  }

  // --- Eingaben: Mausrad/Trackpad (eine zusammenhängende Bewegung = ein Schritt)
  var gest = { last: 0, used: false };
  window.addEventListener('wheel', function (e) {
    if (!STEP || e.ctrlKey) return;
    var t = performance.now(), fresh = t - gest.last > 240;
    gest.last = t; if (fresh) gest.used = false;
    if (!step.engaged) {
      if (window.pageYOffset <= 1 && e.deltaY < 0 && t > step.releasing) { e.preventDefault(); engage(); }
      return;
    }
    e.preventDefault();
    if (gest.used || Math.abs(e.deltaY) < 2) return;
    gest.used = true;
    stepGo(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  // --- Touch: ein Wisch = höchstens ein Schritt
  var tch = null;
  window.addEventListener('touchstart', function (e) {
    if (!STEP || !step.engaged || e.touches.length > 1) { tch = null; return; }
    tch = { x: e.touches[0].clientX, y: e.touches[0].clientY, fired: false };
  }, { passive: true });
  window.addEventListener('touchmove', function (e) {
    if (!STEP || !step.engaged) return;
    if (e.target.closest && e.target.closest('.nav.open')) return;
    e.preventDefault();
    if (!tch || tch.fired) return;
    var dy = tch.y - e.touches[0].clientY, dx = tch.x - e.touches[0].clientX;
    if (Math.abs(dy) > 42 && Math.abs(dy) > Math.abs(dx) * 1.2) { tch.fired = true; stepGo(dy > 0 ? 1 : -1); }
  }, { passive: false });
  window.addEventListener('touchend', function () { tch = null; }, { passive: true });

  // --- Tastatur
  window.addEventListener('keydown', function (e) {
    if (!STEP || !step.engaged || e.target.closest('input, textarea, select')) return;
    var k = e.key, onCtl = e.target.closest('button, a, summary');
    if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !onCtl)) { e.preventDefault(); if (!e.repeat) stepGo(1); }
    else if (k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); if (!e.repeat) stepGo(-1); }
    else if (k === 'Home' || k === 'End') e.preventDefault();
  });

  // --- Zurück an den Seitenanfang gescrollt → Geschichte übernimmt wieder
  window.addEventListener('scroll', function () {
    if (STEP && !step.engaged && window.pageYOffset <= 0 && performance.now() > step.releasing) engage();
  }, { passive: true });

  // --- Sprunglinks (Menü, Kontakt …) geben die Seite sofort frei
  document.addEventListener('click', function (e) {
    if (!STEP || !step.engaged) return;
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute('data-restart') || a.hasAttribute('data-replay')) return;
    var id = a.getAttribute('href').slice(1);
    if (!id || id === 'top' || id === 'story') return;
    disengage();
  }, true);

  if (STEP) {
    stepNext.addEventListener('click', function () { if (stepNext.getAttribute('aria-disabled') === 'true') { nudge(); return; } stepGo(1); });
    stepBack.addEventListener('click', function () { stepGo(-1); });
    stepSkipB.addEventListener('click', skipIntroStep);
    var hint = document.querySelector('.hero-title .scroll-hint');
    if (hint) hint.lastChild.textContent = 'Scrollen oder wischen Sie – jede Bewegung startet die nächste Szene';
  }

  // Alle Szenenbilder nach dem Laden im Hintergrund nacheinander vorbereiten (gegen spätes Aufploppen)
  function preloadAll() {
    var i = 0;
    (function next() { if (i >= scenes.length) return; decodeScenes([scenes[i++]]).then(function () { setTimeout(next, 60); }); })();
    allScenes.forEach(function (sc) { if (scenes.indexOf(sc) < 0 && FILM) loadSceneObj(sc); });
  }
  // Partikel des Telegramms vorab berechnen, solange nichts läuft
  function prepMorph() {
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 200); };
    idle(function () { if (!tg.measured) measureTg(); if (!morph.ready && tg.w) buildMorph(); });
  }

  if (FILM && autoIntro && 'scrollRestoration' in history) history.scrollRestoration = 'manual';
  measure();
  loadScene(0); loadScene(1);
  if (FILM && autoIntro) playFilm();
  if (STEP) {
    if (window.pageYOffset <= 1 && !location.hash) engage();
    else updateStepUI();
    setTimeout(function () { if (STEP && !step.engaged && window.pageYOffset <= 0 && !location.hash) engage(); }, 120);
  }
  // Szene per Adresse anspringen, z. B. index.html#kapitel-3
  var mH = /^#kapitel-(\d+)$/.exec(location.hash);
  if (mH && chapters[+mH[1] - 1]) setTimeout(function () { jumpTo(chapters[+mH[1] - 1].u); }, 50);
  schedule();

  // Zum Testen: ?u=123 springt an eine Stelle der Geschichte (vh-Einheiten)
  var mU = /[?&]u=([\d.]+)/.exec(location.search);
  if (mU) setTimeout(function () { jumpTo(parseFloat(mU[1])); }, 60);
  window.HB_STORY = { jumpTo: jumpTo, total: total, film: FILM, playFilm: playFilm, skipFilm: skipFilm,
    filmState: function () { return { active: film.active, sec: film.sec, u: film.u }; },
    seekFilm: function (sec) { film.started = true; film.sec = sec; schedule(); },
    pauseFilm: function () { film.started = false; },
    mode: MODE, stepState: function () { return { idx: step.idx, u: step.u, playing: step.playing, pending: step.pending, engaged: step.engaged }; },
    stepGo: function (d) { return stepGo(d); }, rests: RESTS,
    scenes: scenes.map(function (s) { return { id: s.id, start: s.start, len: s.len }; }) };
})();
