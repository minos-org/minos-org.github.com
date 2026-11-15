/* mesas effects: builds the minos desktop around the core and drives it like i3.

   Six workspaces, the first five named and filled as minos' /etc/i3/config does (set $w1…$w5, assign):
     1 www   the welcome screen: floating gxmessage windows with #about, #dev, #history, #source, and an mpv window
             playing a film (minos ships no browser; AltGr+w opens whatever x-www-browser the user installs);
             F1 opens minos-help
     2 fm    pcmanfm, one window with a tab per folder (#core, #desktop); an item opens its File Properties dialog
     3 mail  mutt       the principles and #config, one message each: the index over the pager
     4 im    irssi      #keys, a conversation with "minos"
     5 term  urxvt      #install (urgent until visited, like a window asking for you) and #images
     6 tv    mpv        twenty films of minos at work, one window each; the focused one plays
   Keys (the page has no Win key, so i3's bindings lose it): 1-6 desks (pressing the current one goes back, as minos'
   workspace_auto_back_and_forth does), ← → the next desk, h j k l focus, f fullscreen, Esc back; in fullscreen h l
   (← →) page through every window. The focused program takes its own keys first (mutt: j k; mpv: space, p, Enter,
   m). On a phone: the bar's six buttons, a sideways swipe, and the ⤢ button of each window.
   The bar's status is minos-statusbar's: the clock, / and /home, cpu, memory, battery, temperature, every 1.5 s.
   What the browser can tell is real (clock, this tab's busy time, its JavaScript heap, storage, battery); the rest
   is a made-up value that moves; each block's tooltip says which. */
MinosFX.register('mesas', {
  mount: function (api) {
    'use strict';
    var d = document, html = d.documentElement, main = d.getElementById('main');
    var $ = function (id) { return d.getElementById(id); };
    var el = api.el;
    var hover = window.matchMedia('(hover: hover)');
    var DAYS = 'Sun Mon Tue Wed Thu Fri Sat'.split(' ');
    var MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
    function pad(n, w, c) { n = String(n); while (n.length < w) n = (c || '0') + n; return n; }
    function padR(s, w) { s = String(s); while (s.length < w) s += ' '; return s.slice(0, w); }
    function hhmm(t) { return pad(t.getHours(), 2) + ':' + pad(t.getMinutes(), 2); }
    function svg(id) { return '<svg aria-hidden="true" focusable="false"><use href="#' + id + '"/></svg>'; }
    function html2node(s) { var t = d.createElement('template'); t.innerHTML = s; return t.content.firstChild; }

    api.cls(html, 'mesas-on');
    var sprite = api.frag('sprite').firstElementChild;
    if (sprite) api.add(sprite, d.body, d.body.firstChild);

    // ================= workspaces and windows =================
    var desks = api.add(el('div', { class: 'desks' }), main, main.firstChild);
    var DESKS = [
      { id: 'www', name: '1 www', what: 'what minos is', tiles: 'one' },
      { id: 'fm', name: '2 fm', what: 'what you get', tiles: 'one' },
      { id: 'mail', name: '3 mail', what: 'what it stands for', tiles: 'one' },
      { id: 'im', name: '4 im', what: 'how you drive it', tiles: 'one' },
      { id: 'term', name: '5 term', what: 'how to install it', tiles: 'two' },
      { id: 'tv', name: '6 tv', what: 'see it run', tiles: 'films' }
    ];
    var byId = {}, wins = [];
    var films = [];  // every mpv window's film, see "mpv" below
    var stamps = [];  // irssi's timestamps, set by tick()
    var params = null;
    try { params = new URLSearchParams(location.search); } catch (e) { params = null; /* no query to read: the defaults */ }
    DESKS.forEach(function (k) {
      k.el = el('section', { class: 'desk', id: k.id, tabindex: '-1', 'aria-labelledby': 'dn-' + k.id });
      k.el.appendChild(el('h2', { class: 'deskname', id: 'dn-' + k.id }, k.name + ': ' + k.what));
      k.tilesEl = k.el.appendChild(el('div', { class: 'tiles ' + k.tiles }));
      k.wins = [];
      desks.appendChild(k.el);
      byId[k.id] = k;
    });

    function makeWin(desk, title, kind, label) {
      var w = { desk: desk, label: label, keys: null, reveal: null };
      w.el = el('article', { class: 'win ' + kind, tabindex: '-1', 'aria-label': label });
      var bar = w.el.appendChild(el('div', { class: 'title' }));
      w.name = bar.appendChild(el('span', { class: 'tname' }, title));
      w.max = bar.appendChild(el('button', { type: 'button', class: 'max', 'aria-label': 'Fullscreen: ' + label, title: 'fullscreen (f)' }, '⤢'));
      w.body = w.el.appendChild(el('div', { class: 'wbody' }));
      desk.tilesEl.appendChild(w.el);
      w.max.addEventListener('click', function (e) { e.stopPropagation(); if (maxed === w) unmax(); else maximize(w, true); });
      w.el.addEventListener('mousedown', function () { focusWin(w, false); });
      w.el.addEventListener('focusin', function () { focusWin(w, false); });
      w.el.addEventListener('mouseenter', function () { if (hover.matches && !maxed) focusWin(w, false); });
      desk.wins.push(w);
      wins.push(w);
      return w;
    }

    // ---------- the map of the desktop, at the end of #about whatever runs on 1 www ----------
    var guide = el('nav', { class: 'guide', 'aria-label': 'Workspaces' });
    guide.appendChild(el('h3', null, 'this page is a minos desktop'));
    var gul = guide.appendChild(el('ul'));
    DESKS.forEach(function (k) {
      var li = gul.appendChild(el('li'));
      li.appendChild(el('a', { href: '#' + k.id }, k.name));
      li.appendChild(el('span', null, k.what));
    });
    api.add(guide, $('about'));

    // pcmanfm's tabs: role tab/tabpanel, arrow keys inside the tab list, the page shown follows the address
    function tabset(list, tabs, pages, onShow) {
      var cur = -1;
      function show(i) {
        cur = i;
        tabs.forEach(function (t, j) { t.setAttribute('aria-selected', String(j === i)); t.tabIndex = j === i ? 0 : -1; });
        pages.forEach(function (p, j) { p.hidden = j !== i; });
        if (onShow) onShow(i);
      }
      tabs.forEach(function (t, i) { t.addEventListener('click', function () { show(i); }); });
      list.addEventListener('keydown', function (e) {
        var i = tabs.indexOf(d.activeElement), to = null;
        if (i < 0) return;
        if (e.key === 'ArrowRight') to = i + 1; else if (e.key === 'ArrowLeft') to = i - 1;
        else if (e.key === 'Home') to = 0; else if (e.key === 'End') to = tabs.length - 1;
        if (to === null) return;
        e.preventDefault();
        e.stopPropagation();
        to = (to + tabs.length) % tabs.length;
        show(to);
        tabs[to].focus();
      });
      show(0);
      return {
        show: show,
        cur: function () { return cur; },
        reveal: function (node) { for (var i = 0; i < pages.length; i++) if (pages[i].contains(node)) { if (i !== cur) show(i); return; } }
      };
    }

    // ================= mpv: the films =================
    // The films of minos-org/videos, which GitHub Pages serves beside this site, at minos.io/videos/: the address is
    // relative, so they come from the site's own origin. Each plays in an mpv window titled the way mpv titles itself,
    // "<title> - mpv" (or "<file> - mpv" for a file without a title): the wide cut (-h, 1280 x 720) from 800 px up,
    // the tall one (-v, 720 x 1280) on a phone. A film loads nothing but its poster until it plays, and a desk's
    // posters load when the desk is first shown. A film plays only while its desk is shown, its window is on the screen
    // and the page is visible; on 6 tv only the focused window plays (focus follows the mouse, as in i3; on a phone,
    // the window scrolled into view), so only one film is ever heard. With prefers-reduced-motion nothing starts by
    // itself. mpv's keys work on the focused window: space or p stops and starts it, Enter starts it (so does a click
    // or a tap on its picture), m mutes and unmutes it. Sound is on by default: the speaker of every window
    // says so from the start. A browser plays a film by itself only muted, so until the visitor's first click, tap or
    // key the film plays muted, and that first gesture, anywhere on the page, brings its sound in.
    var FILM_DIR = 'videos/';
    // The films by file name, with the title each file carries: 1 www plays the first, 6 tv the other twenty in this
    // order. A film with no title ('') shows its file name, as mpv does.
    var FILM_LIST = [
      ['resumen-cinco-respuestas', 'minos in five answers'],
      ['resumen-antes-y-despues', 'ubuntu, then minos'],
      ['una-linea-funciona', 'one line installs it'],
      ['de-ubuntu-a-minos', 'from ubuntu to minos'],
      ['desde-el-livecd', 'from a live cd'],
      ['disco-en-blanco', 'onto a blank disk'],
      ['solo-core', 'just the core'],
      ['core-o-desktop', 'core or desktop'],
      ['arranque-mosaico', 'boot to a tiled desktop'],
      ['enfocado', 'one task, keys only'],
      ['bloquear-y-volver', 'lock and come back'],
      ['noche', 'the evening'],
      ['cambia-el-fondo', 'change the wallpaper'],
      ['alertas-de-bateria', 'battery alerts'],
      ['apagar-un-modulo', 'turn a module off'],
      ['wcd', 'jump with wcd'],
      ['vim-listo', 'vim, ready to go'],
      ['scripts', 'small scripts'],
      ['papelera', 'rm to the trash'],
      ['cmdfound-rapido', 'just type it'],
      ['captura', 'a screenshot by key']
    ];
    var tall = window.matchMedia('(max-width: 799px)');
    var calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    var seer = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.film.seen = e.isIntersecting && e.intersectionRatio >= 0.4; });
      followScroll();
      playFilms();
    }, { threshold: [0, 0.4, 0.8] }) : null;
    var heard = false;  // the visitor has clicked, tapped or typed on this page: films may sound

    function mpv(desk, film, kind) {
      var name = film[0], title = film[1];
      var w = makeWin(desk, '', 'mpv ' + (kind || ''), 'mpv: ' + (title || name));
      // quiet: the visitor muted it (m, the speaker); forced: the browser would only play it muted, until a gesture
      var f = { w: w, name: name, title: title, cut: '', armed: false, seen: !seer, held: false, asked: false, was: false, sound: null,
        quiet: false, forced: false, unmuted: 0 };
      f.v = w.body.appendChild(el('video', { preload: 'none', loop: '', playsinline: '', disablepictureinpicture: '',
        'aria-label': 'film: ' + (title || name) }));
      w.film = w.el.film = f;
      // mpv's on-screen controller, on the picture: the speaker and fullscreen at the bottom right; on 1 www, play in
      // the middle while the film is not playing (its one window could read as a picture; on 6 tv every window is a
      // film); the title bar is all "<title> - mpv"
      if (desk === byId.www) {
        f.play = w.body.appendChild(el('button', { type: 'button', class: 'play', title: 'play (space)', 'aria-label': 'Play: ' + (title || name) }));
        f.play.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 3l8 5-8 5z"/></svg>';
        f.play.addEventListener('click', function (e) { e.stopPropagation(); focusWin(w, false); f.held = false; f.asked = true; playFilms(); });
      }
      var osc = w.body.appendChild(el('div', { class: 'osc' }));
      f.mute = osc.appendChild(el('button', { type: 'button', class: 'mute', title: 'mute (m)' }));
      osc.appendChild(w.max);
      f.osd = w.body.appendChild(el('p', { class: 'osd', 'aria-live': 'polite', hidden: '' }));
      f.mute.addEventListener('click', function (e) { e.stopPropagation(); mute(f, !f.quiet); });
      // the play sign goes while the picture moves and comes back whenever it stops
      f.v.addEventListener('playing', function () { w.el.classList.add('playing'); });
      f.v.addEventListener('pause', function () {
        w.el.classList.remove('playing');
        // stopped right after its sound was let in, by a browser that did not count that event as a gesture (a touch's
        // first contact): it plays on muted, and the next gesture tries again
        if (performance.now() - f.unmuted < 1000 && wants(f)) { f.unmuted = 0; f.forced = true; start(f); }
      });
      // what the file holds is known once its header is read (or, where the browser does not say, from what it decodes)
      f.v.addEventListener('loadedmetadata', function () { hear(f); });
      // a click or a tap on the picture of the focused window stops or starts its film; on another window it focuses
      // that window and starts its film
      f.v.addEventListener('pointerdown', function () { f.was = focused === w; });
      f.v.addEventListener('click', function () { if (f.was) toggle(f); else { f.held = false; f.asked = true; playFilms(); } });
      w.keys = function (k, e) {
        if ((k !== ' ' && k !== 'p' && k !== 'm' && k !== 'Enter') || (e.target.closest && e.target.closest('button, a'))) return false;
        if (k === 'm') mute(f, !f.quiet);
        else if (k !== 'Enter' || f.v.paused) toggle(f);
        return true;
      };
      films.push(f);
      cut(f);
      sound(f);
      speaker(f);
      if (seer) seer.observe(w.el);
      return f;
    }
    // the file for this screen; the window's title is the film's, or the file's name when it has none
    function cut(f) {
      var c = tall.matches ? '-v' : '-h';
      if (c === f.cut) return;
      f.cut = c;
      f.w.name.textContent = (f.title || f.name + c + '.mp4') + ' - mpv';
      if (f.armed) f.v.poster = FILM_DIR + f.name + c + '.jpg';
      // a new source stops the old one; playFilms() starts it again
      if (f.v.hasAttribute('src')) f.v.src = FILM_DIR + f.name + c + '.mp4';
    }

    // ---------- sound: on unless the visitor mutes it (m, the speaker), as far as the browser allows ----------
    var SPEAKER = '<path d="M2 6h3l4-3.5v11L5 10H2z"/>';
    var ICON = {
      off: SPEAKER + '<path d="M11 6l4 4M15 6l-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      on: SPEAKER + '<path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3a7 7 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      none: SPEAKER + '<path d="M1 15L15 1" fill="none" stroke="currentColor" stroke-width="1.5"/>'
    };
    // the element is muted while the visitor wants it so, before their first gesture, or while the browser refuses it
    function sound(f) { f.v.muted = f.quiet || !heard || f.forced; }
    // whether the file has a sound track: true, false, or null while the browser cannot tell. Firefox and Safari say
    // so from the header; Chromium only through the sound it has decoded, read a second after the sound comes in
    function hasSound(v) {
      if (v.readyState < 1) return null;
      if (typeof v.mozHasAudio === 'boolean') return v.mozHasAudio;
      if (v.audioTracks && typeof v.audioTracks.length === 'number') return v.audioTracks.length > 0;
      return null;
    }
    function hear(f) {
      var s = hasSound(f.v);
      if (s !== null && s !== f.sound) { f.sound = s; speaker(f); }
    }
    function decoded(f) {
      if (f.sound !== null || typeof f.v.webkitAudioDecodedByteCount !== 'number') return;
      api.later(function () {
        if (f.v.muted || f.v.paused || f.sound !== null) return;
        f.sound = f.v.webkitAudioDecodedByteCount > 0;
        speaker(f);
        if (!f.sound) osd(f, 'Mute: no (no audio)');
      }, 1200);
    }
    // the speaker shows the visitor's choice, mpv's mute property: sound on unless they muted it
    function speaker(f) {
      var none = f.sound === false, quiet = f.quiet;
      f.mute.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' + ICON[none ? 'none' : quiet ? 'off' : 'on'] + '</svg>';
      f.mute.setAttribute('aria-pressed', String(quiet));
      f.mute.setAttribute('aria-label', 'Mute: ' + f.w.label + (none ? ' (no audio)' : ''));
      f.mute.title = none ? 'no audio (m)' : quiet ? 'unmute (m)' : 'mute (m)';
      f.mute.classList.toggle('none', none);
      f.w.el.classList.toggle('loud', !quiet && !none);
    }
    // mpv's OSD: one line at the top left of the picture for a moment
    function osd(f, text) {
      f.osd.textContent = text;
      f.osd.hidden = false;
      clearTimeout(f.osdT);
      f.osdT = api.later(function () { f.osd.hidden = true; }, 1500);
    }
    function mute(f, on) {
      f.quiet = on;
      f.forced = false;  // m and the speaker are gestures: the browser lets the sound in now
      if (!on) { f.held = false; f.asked = true; }  // unmuting asks for the film: its sound starts now
      sound(f);
      speaker(f);
      osd(f, 'Mute: ' + (on ? 'yes' : 'no') + (f.sound === false ? ' (no audio)' : ''));
      playFilms();
      if (!on) decoded(f);
    }
    // the first click, tap or key anywhere (and any later one, for a film the browser kept muted) brings in the sound
    // of the film that plays. The speaker and m are left to themselves: what they show is what they change
    function gesture(e) {
      if (!e.isTrusted || (e.type === 'keydown' && (e.key === 'Escape' || e.ctrlKey || e.metaKey || e.altKey))) return;
      heard = true;
      if (e.target && e.target.closest && e.target.closest('.mute')) return;
      if (e.type === 'keydown' && e.key === 'm' && focused && focused.film) return;
      films.forEach(function (f) {
        if (f.v.paused || f.quiet || !f.v.muted) return;
        f.forced = false;
        f.unmuted = performance.now();
        sound(f);
        // a browser that does not count this event as a gesture stops the film it was asked to unmute: muted again
        if (f.v.paused) { f.unmuted = 0; f.forced = true; start(f); } else decoded(f);
      });
    }
    ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(function (t) { api.on(window, t, gesture, true); });

    function wants(f) {
      var w = f.w;
      return !d.hidden && w.desk === curDesk && f.seen && !f.held && (f.asked || !calm.matches) &&
        (!maxed || maxed === w) && (w.desk !== byId.tv || focused === w);
    }
    function start(f) {
      // the file is named only when the film first plays: some browsers fetch a named file even with preload="none"
      if (!f.v.hasAttribute('src')) f.v.src = FILM_DIR + f.name + f.cut + '.mp4';
      sound(f);
      var p = f.v.play();
      if (p && p.then) {
        p.then(function () { if (!f.v.muted) decoded(f); }, function (err) {
          // a pause or a new source came first (AbortError): nothing to undo. A film the browser will not play with
          // its sound (Safari asks again for each film) plays muted until the next gesture. Otherwise the browser
          // would not play it at all (a data or power saver, a format it lacks): the poster stays, as if the visitor
          // had stopped it, until space, p, Enter or a tap asks again
          if (err && err.name === 'AbortError') return;
          if (err && err.name === 'NotAllowedError' && !f.v.muted) { f.forced = true; start(f); return; }
          f.held = true;
        });
      }
    }
    function playFilms() {
      films.forEach(function (f) {
        if (!f.armed && f.w.desk === curDesk) { f.armed = true; f.v.poster = FILM_DIR + f.name + f.cut + '.jpg'; }
        var on = f.armed && wants(f);
        if (on && f.v.paused) start(f);
        else if (!on && !f.v.paused) f.v.pause();
      });
    }
    function toggle(f) {
      if (f.v.paused) { f.held = false; f.asked = true; } else f.held = true;
      playFilms();
    }
    // on a phone the window scrolled into view takes the focus, as the window under the mouse does on a desktop
    function followScroll() {
      if (hover.matches || curDesk !== byId.tv || maxed || (focused && focused.film && focused.film.seen)) return;
      for (var i = 0; i < films.length; i++) {
        if (films[i].w.desk === byId.tv && films[i].seen) { focusWin(films[i].w, false); return; }
      }
    }
    api.on(tall, 'change', function () { films.forEach(cut); playFilms(); });
    api.on(calm, 'change', playFilms);
    api.on(d, 'visibilitychange', playFilms);

    // ================= 1 www: the welcome screen =================
    // minos ships no browser (AltGr+w opens whatever x-www-browser the user installs), so desk 1 is the first screen
    // after logging in: floating gxmessage windows, the kind minos-help opens, holding #about, #dev, #history and
    // #source, and beside dev an mpv window looping the short film of the five answers, on the same black as every
    // desk. From 1280 x 700 the five fit the screen with no scrolling (theme.css).
    // F1 opens minos-help with the real /etc/minos/help, as it does on minos.
    (function welcome() {
      var first = null;
      byId.www.parts = {};
      ['about', 'dev', 'history', 'source'].forEach(function (id) {
        var w = makeWin(byId.www, id, 'gx gx-' + id, 'gxmessage: ' + $(id).querySelector('h2').textContent);
        api.move($(id), w.body);
        first = first || w;
        byId.www.parts[id] = w;
      });
      byId.www.parts.film = mpv(byId.www, FILM_LIST[0], 'mpv-www').w;
      var help = makeWin(byId.www, 'gxmessage', 'gx gx-help', 'minos-help: the keys of minos');
      var pre = help.body.appendChild(el('pre', { class: 'helptext' }));
      pre.textContent = (api.frag('help').textContent || '').replace(/^\n+/, '');
      var got = help.body.appendChild(el('div', { class: 'gx-btns' })).appendChild(el('button', { type: 'button' }, 'got it'));
      help.el.hidden = true;
      function open() { help.el.hidden = false; focusWin(help, true); }
      function close() { help.el.hidden = true; focusWin(first, true); }
      got.addEventListener('click', close);
      // the map of the desks: under #about on a phone (the first thing read), under #source on a wider screen,
      // where about's window is full and source's has room
      var wide = window.matchMedia('(min-width: 800px)');
      function placeGuide() { (wide.matches ? $('source').parentNode : $('about')).appendChild(guide); }
      placeGuide();
      api.on(wide, 'change', placeGuide);
      api.on(d, 'keydown', function (e) {
        if (e.key === 'F1' && curDesk === byId.www) { e.preventDefault(); if (help.el.hidden) open(); else close(); }
        else if (e.key === 'Escape' && !help.el.hidden && !maxed) { e.preventDefault(); close(); }
      });
    })();

    // ================= 2 fm: pcmanfm, one window, a tab per folder =================
    // Location bar, side pane, detailed list. Opening an item (a click, a tap, Enter or Space on it) shows pcmanfm's
    // File Properties dialog with its whole description, floating as i3 floats every dialog; Esc or Close shuts it.
    (function pcmanfm() {
      var w = makeWin(byId.fm, 'minos-core', 'fm', 'pcmanfm: ' + $('h-core').textContent + ' ' + $('h-desktop').textContent);
      var folders = [['core', 'minos-core'], ['desktop', 'minos-desktop']];
      var KIND = { dir: 'folder (inode/directory)', run: 'program (application/x-executable)', cfg: 'settings (text/plain)' };
      var tabbar = w.body.appendChild(el('div', { class: 'fm-tabs', role: 'tablist', 'aria-label': 'pcmanfm tabs' }));
      var tool = w.body.appendChild(el('div', { class: 'fm-tool' }));
      tool.innerHTML = '<span class="glyph" aria-hidden="true">◂▸▴</span><span class="lb">location</span>';
      var path = tool.appendChild(el('span', { class: 'path' }));
      var body = w.body.appendChild(el('div', { class: 'fm-body' }));
      var places = body.appendChild(el('nav', { class: 'places', 'aria-label': 'Places' }));
      places.appendChild(el('h3', null, 'Places'));
      var view = body.appendChild(el('div', { class: 'fm-view' }));
      view.appendChild(el('div', { class: 'fm-cols', 'aria-hidden': 'true' })).innerHTML = '<span>Name</span><span>Description</span>';
      var sbar = w.body.appendChild(el('div', { class: 'fm-sbar' }));
      var count = sbar.appendChild(el('span'));

      // the File Properties dialog, one for every item
      var shade = api.add(el('div', { class: 'dlg-shade', hidden: '' }), d.body);
      var dlg = api.add(el('div', { class: 'win dlg focus', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-name', hidden: '' }), d.body);
      dlg.innerHTML = '<div class="title"><span class="tname">File Properties</span></div>' +
        '<div class="dlg-body"><div class="dlg-tabs" aria-hidden="true"><span class="on">General</span><span>Permissions</span></div>' +
        '<div class="dlg-head"><svg aria-hidden="true" focusable="false"><use href="#f-dir"/></svg><b id="dlg-name"></b></div>' +
        '<dl class="dlg-kv"><dt>Type:</dt><dd class="k-type"></dd><dt>Location:</dt><dd class="k-loc"></dd>' +
        '<dt>Description:</dt><dd class="k-desc"></dd></dl><div class="dlg-btns"><button type="button">Close</button></div></div>';
      var closeB = dlg.querySelector('.dlg-btns button'), opener = null;
      function openItem(dt, folder) {
        var kind = dt.getAttribute('data-kind') || 'run', desc = dlg.querySelector('.k-desc');
        dlg.querySelector('.dlg-head use').setAttribute('href', '#f-' + kind);
        dlg.querySelector('#dlg-name').textContent = dt.textContent.trim();
        dlg.querySelector('.k-type').textContent = KIND[kind] || kind;
        dlg.querySelector('.k-loc').textContent = '~/minos/' + folder + '/';
        desc.textContent = '';
        Array.prototype.forEach.call(dt.nextElementSibling.childNodes, function (n) { desc.appendChild(n.cloneNode(true)); });
        opener = dt;
        dlg.hidden = false;
        shade.hidden = false;
        w.el.classList.remove('focus');  // as in i3: the dialog has the focus, the pcmanfm under it does not
        closeB.focus();
      }
      function closeItem() {
        if (dlg.hidden) return;
        dlg.hidden = true;
        shade.hidden = true;
        focusWin(w, false);
        if (opener) opener.focus({ preventScroll: true });
      }
      closeB.addEventListener('click', closeItem);
      shade.addEventListener('click', closeItem);
      dlg.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeItem(); return; }
        if (e.key !== 'Tab') return;
        // a modal dialog keeps the focus: Tab goes round its links and its button
        var stops = Array.prototype.slice.call(dlg.querySelectorAll('a[href], button'));
        var i = stops.indexOf(d.activeElement), to = e.shiftKey ? i - 1 : i + 1;
        e.preventDefault();
        stops[(to + stops.length) % stops.length].focus();
      });

      var tabs = [], pages = [], leads = [], placeLinks = [];
      folders.forEach(function (f) {
        var sec = $(f[0]);
        var a = places.appendChild(el('a', { href: '#' + f[0] }));
        a.innerHTML = svg('f-dir');
        a.appendChild(d.createTextNode(f[1]));
        placeLinks.push(a);
        var page = view.appendChild(el('div', { class: 'fm-page', id: 'fmp-' + f[0], role: 'tabpanel', 'aria-labelledby': 'fmt-' + f[0] }));
        api.move(sec, page);
        var lead = sec.querySelector('.lead');
        api.move(lead, sbar);
        leads.push(lead);
        tabs.push(tabbar.appendChild(el('button', { type: 'button', class: 'fm-tab', role: 'tab', id: 'fmt-' + f[0], 'aria-controls': 'fmp-' + f[0] }, f[1])));
        pages.push(page);
        Array.prototype.forEach.call(sec.querySelectorAll('dt'), function (dt) {
          api.add(html2node(svg('f-' + (dt.getAttribute('data-kind') || 'run'))), dt, dt.firstChild);
          api.attr(dt, 'tabindex', '0');
          api.attr(dt, 'role', 'button');
          api.attr(dt, 'aria-haspopup', 'dialog');
        });
        function rowOf(e) {
          var row = e.target.closest('dt, dd');
          return row && !e.target.closest('a') ? (row.tagName === 'DT' ? row : row.previousElementSibling) : null;
        }
        api.on(sec, 'click', function (e) {
          var dt = rowOf(e);
          if (!dt) return;
          Array.prototype.forEach.call(sec.querySelectorAll('.sel'), function (x) { api.state(x, 'sel', false); });
          api.state(dt, 'sel', true);
          api.state(dt.nextElementSibling, 'sel', true);
          openItem(dt, f[1]);
        });
        api.on(sec, 'keydown', function (e) {
          if ((e.key === 'Enter' || e.key === ' ') && e.target.tagName === 'DT') { e.preventDefault(); e.target.click(); }
        });
      });
      var ts = tabset(tabbar, tabs, pages, function (i) {
        var sec = $(folders[i][0]);
        path.textContent = '~/minos/' + folders[i][1] + '/';
        w.name.textContent = folders[i][1];
        count.textContent = sec.querySelectorAll('dt').length + ' items ';
        leads.forEach(function (l, j) { api.attr(l, 'hidden', j === i ? null : ''); });
        placeLinks.forEach(function (a, j) { a.classList.toggle('here', j === i); if (j === i) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
      });
      w.reveal = ts.reveal;
    })();

    // ---------- 3 mail: mutt ----------
    var mutt = (function () {
      var pr = $('principles'), cf = $('config');
      var w = makeWin(byId.mail, 'mutt', 'mutt', 'mutt: ' + pr.querySelector('h2').textContent);
      var msgs = Array.prototype.map.call(pr.querySelectorAll('.principles > li'), function (li) {
        var name = li.querySelector('h3').textContent;
        return { el: li, short: name, subject: name + ': ' + li.querySelector('.line').textContent };
      });
      msgs.push({ el: cf, short: 'config', subject: cf.querySelector('h2').textContent });
      var help = w.body.appendChild(el('div', { class: 'mt-help', 'aria-hidden': 'true' }));
      help.innerHTML = '<span class="keyhelp">j:Next  k:Prev  Enter:Read  f:Fullscreen</span><span class="taphelp">tap a message to read it</span>';
      var top = w.body.appendChild(el('div', { class: 'mt-top' }));
      var side = top.appendChild(el('div', { class: 'mt-side', 'aria-hidden': 'true' }));
      var index = top.appendChild(el('div', { class: 'mt-index', role: 'group', 'aria-label': 'Messages' }));
      var status = w.body.appendChild(el('div', { class: 'mt-status', 'aria-hidden': 'true' }));
      var pager = w.body.appendChild(el('div', { class: 'mt-pager' }));
      var hdr = pager.appendChild(el('div', { class: 'mt-hdr', 'aria-hidden': 'true' }));
      api.move(pr, pager);
      api.move(cf, pager);
      pager.appendChild(el('div', { class: 'sig', 'aria-hidden': 'true' }, '-- \nMinimalism, stability, coherence, control, beauty.'));
      var pstatus = w.body.appendChild(el('div', { class: 'mt-pstatus', 'aria-hidden': 'true' }));
      var base = Date.now(), cur = -1;
      // the index as minos' muttrc writes it: index_format "%3C %Z %D %-15.15L (%?l?%4l&%4c?) %s",
      // date_format "%d/%m/%y at %I:%M%P", sorted newest first
      function mdate(t) {
        var h = t.getHours() % 12 || 12;
        return pad(t.getDate(), 2) + '/' + pad(t.getMonth() + 1, 2) + '/' + String(t.getFullYear()).slice(2) + ' at ' + pad(h, 2) + ':' + pad(t.getMinutes(), 2) + (t.getHours() < 12 ? 'am' : 'pm');
      }
      msgs.forEach(function (m, i) {
        m.when = new Date(base - (i * 7 + 2) * 60000);
        m.lines = Math.max(1, Math.ceil(m.el.textContent.replace(/\s+/g, ' ').trim().length / 70));
        m.unread = true;
        m.row = index.appendChild(el('button', { type: 'button', class: 'mt-row new', 'aria-label': m.subject }));
        m.row.innerHTML = '<span class="n">' + pad(i + 1, 3, ' ') + ' </span><span class="fl">N</span><span> </span>' +
          '<span class="dt">' + mdate(m.when) + ' </span><span class="fr">' + padR('minos', 15) + ' </span>' +
          '<span class="ln">(' + pad(m.lines, 4, ' ') + ') </span><span class="s"></span>';
        m.row.querySelector('.s').textContent = m.subject;
        m.row.addEventListener('click', function () { open(i, true); });
      });
      function unread() { return msgs.filter(function (m) { return m.unread; }).length; }
      function counts() {
        var n = unread();
        side.innerHTML = '';
        side.appendChild(el('div', n ? { class: 'new' } : null, padR('INBOX', 9) + pad(n ? n : '', 4, ' ')));
        status.innerHTML = '<span class="fill">' + new Array(300).join('═') + '</span><span></span>';
        status.lastChild.textContent = '[Folder:you/INBOX Msgs:' + msgs.length + (n ? ' New:' + n : '') + '] [all]';
        act();
      }
      function open(i, user) {
        if (i < 0 || i >= msgs.length) return;
        var m = msgs[i], focusRow = user && d.activeElement && d.activeElement.classList.contains('mt-row');
        cur = i;
        m.unread = false;
        m.row.classList.remove('new');
        m.row.querySelector('.fl').textContent = ' ';
        msgs.forEach(function (x, j) {
          x.row.setAttribute('aria-current', String(j === i));
          api.state(x.el, 'on', j === i);
        });
        api.state(pr, 'on', m.el !== cf);
        var t = m.when;
        hdr.innerHTML = '<div class="f">From: minos</div><div class="t">To: you</div><div class="d"></div><div class="s"></div>';
        hdr.querySelector('.d').textContent = 'Date: ' + DAYS[t.getDay()] + ', ' + pad(t.getDate(), 2) + ' ' + MONTHS[t.getMonth()] + ' ' + t.getFullYear() + ' ' + hhmm(t) + ':' + pad(t.getSeconds(), 2);
        hdr.querySelector('.s').textContent = 'Subject: ' + m.subject;
        // pager_format "-%Z- %C/%m: %-20.20n   %s%*  -- (%P)"
        pstatus.textContent = '---  ' + (i + 1) + '/' + msgs.length + ': ' + padR('minos', 20) + '   ' + m.short + '  -- (all)';
        counts();
        if (focusRow) m.row.focus();
        if (user) {
          var r = pager.getBoundingClientRect();
          if (!maxed && r.top > window.innerHeight * 0.75) window.scrollTo(0, window.scrollY + r.top - 80);
        }
      }
      w.keys = function (k) {
        if (k === 'j') { open(Math.min(cur + 1, msgs.length - 1), true); return true; }
        if (k === 'k') { open(Math.max(cur - 1, 0), true); return true; }
        return false;
      };
      w.reveal = function (node) {
        for (var i = 0; i < msgs.length; i++) if (msgs[i].el === node || msgs[i].el.contains(node)) { open(i, false); return; }
        if (node === pr) open(0, false);
      };
      open(0, false);
      return { unread: unread };
    })();

    // ---------- 4 im: irssi ----------
    var irssi = (function () {
      var sec = $('keys');
      var w = makeWin(byId.im, 'irssi', 'irc', 'irssi: ' + sec.querySelector('h2').textContent);
      var topic = w.body.appendChild(el('div', { class: 'ir-topic' }));
      api.move(sec.querySelector('.lead'), topic);
      var buf = w.body.appendChild(el('div', { class: 'ir-buf' }));
      api.move(sec, buf);
      // dark_winter: timestamp "%b[%N$*%b]%N", msgnick "%w<%R$0%N$1-%w>%n %|"
      function pre(nick, me) {
        var s = html2node('<span class="ir-pre" aria-hidden="true"><span class="ts"><span class="tb">[</span><span class="tm"></span><span class="tb">]</span> </span><span class="nb">&lt;</span><span class="' + (me ? 'me' : 'nk') + '"></span><span class="nb">&gt;</span> </span>');
        s.querySelector(me ? '.me' : '.nk').textContent = nick;
        stamps.push(s.querySelector('.tm'));
        return s;
      }
      var h2 = sec.querySelector('h2');
      api.add(pre('you', true), h2, h2.firstChild);
      Array.prototype.forEach.call(sec.querySelectorAll('dt'), function (dt) { api.add(pre('minos'), dt, dt.firstChild); });
      // what this page adds to irssi: two notices, as irssi prints its own ("~~~" is dark_winter's line_start)
      buf.appendChild(el('div', { class: 'ir-gap', 'aria-hidden': 'true' }));
      [
        hover.matches
          ? 'on this page: <b>1</b>…<b>5</b> or the bar change desks, <b>←</b> <b>→</b> step through them; <b>h j k l</b> move the focus; <b>f</b> or ⤢ fullscreen, <b>Esc</b> back'
          : 'on this page: tap the bar, or swipe sideways, to change desks; ⤢ on a title bar reads that window fullscreen',
        'the bar: the clock, cpu, memory and battery are what your browser says; the disks and the temperature are made up'
      ].forEach(function (text) {
        var line = buf.appendChild(el('p', { class: 'ir-info' }));
        line.innerHTML = '<span class="bang" aria-hidden="true">~~~ </span>' + text;
      });
      var sbar = w.body.appendChild(el('div', { class: 'ir-sbar', 'aria-hidden': 'true' }));
      var input = w.body.appendChild(el('div', { class: 'ir-input', 'aria-hidden': 'true' }));
      input.innerHTML = '<span class="br">[</span>minos<span class="br">]</span> <span class="cursor"></span>';
      return { sbar: sbar };
    })();
    // dark_winter's statusbar: sb " %b[%W$*%b]%n"; activity in green when 3 mail holds unread mail
    function act() {
      if (!irssi) return;
      var n = mutt ? mutt.unread() : 0, t = hhmm(new Date());
      irssi.sbar.innerHTML = '<span class="tb">[</span>' + t + '<span class="tb">]</span> <span class="tb">[</span>you<span class="tb">]</span> <span class="tb">[</span>2:minos<span class="tb">]</span>' +
        (n ? ' <span class="tb">[</span>Act: <span class="act">3</span><span class="tb">]</span>' : '');
    }

    // ---------- 5 term: two urxvt ----------
    function urxvt(secId, urgent) {
      var sec = $(secId);
      var w = makeWin(byId.term, 'urxvt', 'term', 'urxvt: ' + sec.querySelector('h2').textContent);
      api.move(sec, w.body);
      w.body.appendChild(el('div', { class: 'prompt', 'aria-hidden': 'true' })).innerHTML = '<b>~</b> $ <span class="cursor"></span>';
      if (urgent) w.el.classList.add('urgent');
      return w;
    }
    byId.term.parts = { install: urxvt('install', true), images: urxvt('images', false) };

    // ---------- 6 tv: twenty mpv windows, tiled; only the focused one plays ----------
    FILM_LIST.slice(1).forEach(function (film) { mpv(byId.tv, film); });

    var tvCur = null;  // the film 6 tv showed last: it gets the focus back, as i3 gives a workspace its window

    // ================= the bar =================
    var bar = api.add(el('nav', { class: 'bar', 'aria-label': 'Workspaces' }), d.body);
    var wsl = bar.appendChild(el('div', { class: 'wsl' }));
    DESKS.forEach(function (k) { k.btn = wsl.appendChild(el('a', { class: 'wsb', href: '#' + k.id, title: k.what }, k.name)); });
    byId.term.btn.classList.add('urgent');
    var maxnav = bar.appendChild(el('div', { class: 'maxnav' }));
    var prevB = maxnav.appendChild(el('button', { type: 'button', 'aria-label': 'Previous window' }, '‹'));
    var escB = maxnav.appendChild(el('button', { type: 'button', 'aria-label': 'Back from fullscreen' }, 'esc'));
    var nextB = maxnav.appendChild(el('button', { type: 'button', 'aria-label': 'Next window' }, '›'));
    var mname = maxnav.appendChild(el('span', { class: 'mname' }));
    prevB.addEventListener('click', function () { turn(-1); });
    nextB.addEventListener('click', function () { turn(1); });
    escB.addEventListener('click', function () { unmax(); });

    var skip = d.querySelector('.skip');
    var top = api.add(el('div', { class: 'top' }), d.body, skip ? skip.nextSibling : d.body.firstChild);
    var status = top.appendChild(el('div', { class: 'status', 'aria-hidden': 'true' }));
    api.move($('switch'), top);

    // ---------- the status: minos-statusbar's blocks and separators ----------
    function blk(icon, cls) {
      var b = status.appendChild(el('span', { class: 'blk ' + (cls || '') }));
      b.innerHTML = svg(icon);
      b.v = b.appendChild(el('span'));
      return b;
    }
    function sep(cls) { status.appendChild(el('i', { class: 'sep ' + (cls || '') }, '|')); }
    var B = {};
    B.time = blk('x-clock'); sep();
    B.root = blk('x-disk', 'opt nosep'); B.home = blk('x-disk', 'opt'); sep('opt');
    B.cpu = blk('x-cpu', 'nosep'); B.mem = blk('x-mem'); sep('bsep');
    B.bat = blk('x-bat', 'opt nosep'); B.temp = blk('x-temp');
    B.bat.hidden = true;

    function walk(v, lo, hi, step) { return Math.min(hi, Math.max(lo, v + (Math.random() - 0.5) * step)); }
    function small(x) { return x >= 10 ? String(Math.round(x)) : x >= 1 ? x.toFixed(1) : x > 0 ? x.toFixed(2) : '0'; }
    var rootV = 30 + Math.random() * 8, homeV = 48 + Math.random() * 10, memV = 32 + Math.random() * 10, tempV = 45 + Math.random() * 5;
    var storeV = null, battery = null, cores = navigator.hardwareConcurrency || 0;
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(function (e) { if (e && e.quota) storeV = 100 * (e.usage || 0) / e.quota; },
        function () { storeV = null; /* the browser refused: /home keeps its made-up figure */ });
    }
    if (navigator.getBattery) {
      navigator.getBattery().then(function (b) { battery = b; tick(); },
        function () { battery = null; /* no battery to read: the block stays hidden, as on a desktop */ });
    }
    // cpu: how long this tab's main thread kept a 200 ms timer waiting, over the last 1.5 s
    var last = performance.now(), busy = 0, span = 0;
    api.every(function () {
      var n = performance.now(), dt = n - last;
      last = n;
      if (d.hidden) return;
      span += dt;
      busy += Math.max(0, dt - 200);
    }, 200);
    api.on(d, 'visibilitychange', function () { last = performance.now(); busy = 0; span = 0; });

    B.time.title = 'date and time: your clock';
    B.root.title = '/: made up; a page cannot see your disk';
    B.temp.title = 'temperature: made up';
    function tick() {
      var n = new Date();
      B.time.v.textContent = hhmm(n) + ' ' + DAYS[n.getDay()] + '-' + pad(n.getDate(), 2) + '-' + MONTHS[n.getMonth()];
      rootV = walk(rootV, 28, 40, 0.12);
      B.root.v.textContent = Math.round(rootV) + '%';
      if (storeV !== null) {
        B.home.v.textContent = small(storeV) + '%';
        B.home.title = '/home: what this site keeps in your browser, of the room the browser gives it (navigator.storage.estimate)';
      } else {
        homeV = walk(homeV, 40, 70, 0.12);
        B.home.v.textContent = Math.round(homeV) + '%';
        B.home.title = '/home: made up';
      }
      var c = span ? Math.min(100, Math.round(100 * busy / span)) : 0;
      busy = 0; span = 0;
      B.cpu.v.textContent = c + '%';
      B.cpu.title = 'cpu: how busy this tab kept your browser in the last 1.5 s' + (cores ? '; it reports ' + cores + ' logical cores' : '');
      var pm = window.performance && performance.memory;
      if (pm && pm.usedJSHeapSize) {
        var total = navigator.deviceMemory ? navigator.deviceMemory * 1073741824 : pm.jsHeapSizeLimit;
        B.mem.v.textContent = small(100 * pm.usedJSHeapSize / total) + '%';
        B.mem.title = 'memory: this tab\'s JavaScript, ' + Math.round(pm.usedJSHeapSize / 1048576) + ' MB of ' +
          (navigator.deviceMemory ? navigator.deviceMemory + ' GB your browser reports' : 'what the browser allows it');
      } else {
        memV = walk(memV, 26, 56, 1.4);
        B.mem.v.textContent = Math.round(memV) + '%';
        B.mem.title = 'memory: made up; this browser does not tell';
      }
      if (battery) {
        var left = !battery.charging && isFinite(battery.dischargingTime) && battery.dischargingTime > 0
          ? ' ' + Math.floor(battery.dischargingTime / 3600) + 'h' + pad(Math.floor(battery.dischargingTime % 3600 / 60), 2) + 'm' : '';
        B.bat.v.textContent = Math.round(battery.level * 100) + '%' + left;
        B.bat.title = 'battery: your browser\'s battery API';
        B.bat.hidden = false;
      }
      tempV = walk(tempV, 42, 58, 0.9);
      B.temp.v.textContent = Math.round(tempV) + '°';
      var t = hhmm(n);
      stamps.forEach(function (s) { if (s.textContent !== t) s.textContent = t; });
      act();
    }
    tick();
    api.every(tick, 1500);  // minos-statusbar: update_interval 1.5

    // ================= i3 =================
    var curDesk = null, prevDesk = null, focused = null, maxed = null, backY = 0;

    function showDesk(k, dom) {
      if (!k) return;
      if (maxed && maxed.desk !== k) unmax(true);
      if (k !== curDesk) {
        prevDesk = curDesk;
        curDesk = k;
        DESKS.forEach(function (x) {
          x.el.classList.toggle('on', x === k);
          if (x === k) x.btn.setAttribute('aria-current', 'page'); else x.btn.removeAttribute('aria-current');
        });
        k.btn.classList.remove('urgent');
        if (!maxed) window.scrollTo(0, 0);
        fill(k);
      }
      // 6 tv comes back on the film it showed, as i3 gives a workspace back its focused window
      if (!focused || focused.desk !== k) focusWin(k === byId.tv && tvCur ? tvCur : k.wins[0], false);
      if (dom) k.el.focus({ preventScroll: true });
      playFilms();
    }
    function step(n) {
      var i = DESKS.indexOf(curDesk);
      showDesk(DESKS[(i + n + DESKS.length) % DESKS.length], true);
      setHash(curDesk.id);
    }
    function focusWin(w, dom) {
      if (!w) return;
      if (focused && focused !== w) focused.el.classList.remove('focus');
      w.el.classList.add('focus');
      focused = w;
      if (w.desk === curDesk) w.el.classList.remove('urgent');
      if (w.film && w.desk === byId.tv) tvCur = w;
      playFilms();
      if (dom) {
        w.el.focus({ preventScroll: true });
        var r = w.el.getBoundingClientRect();
        if (!maxed && (r.top < 0 || r.top > window.innerHeight - 120)) window.scrollTo(0, window.scrollY + r.top - 4);
      }
    }
    // the nearest window in a direction: the smallest gap first, then the closest edge
    function neighbour(dir) {
      var a = focused.el.getBoundingClientRect(), best = null, score = Infinity;
      curDesk.wins.forEach(function (t) {
        if (t === focused) return;
        var b = t.el.getBoundingClientRect(), gap, overlap, off;
        if (dir === 'h' || dir === 'l') {
          gap = dir === 'l' ? b.left - a.right : a.left - b.right;
          overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          off = Math.abs(b.top - a.top);
        } else {
          gap = dir === 'j' ? b.top - a.bottom : a.top - b.bottom;
          overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          off = Math.abs(b.left - a.left);
        }
        if (gap < -2 || overlap <= 0) return;
        var s = gap * 10000 + off;
        if (s < score) { score = s; best = t; }
      });
      return best;
    }

    // ---------- fullscreen: the frame grows to the screen, Esc brings it back (as Resumen did) ----------
    function full() { return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight - bar.offsetHeight }; }
    function zoom(from, to, done) {
      if (api.reduced) { done(); return; }
      var g = el('div', { class: 'ghost', 'aria-hidden': 'true' }), ended = false;
      function place(r) { g.style.top = r.top + 'px'; g.style.left = r.left + 'px'; g.style.width = r.width + 'px'; g.style.height = r.height + 'px'; }
      function end() { if (ended) return; ended = true; if (g.parentNode) g.parentNode.removeChild(g); done(); }
      place(from);
      d.body.appendChild(g);
      void g.offsetWidth;
      place(to);
      g.addEventListener('transitionend', end);
      api.later(end, 320);
    }
    function setMax(w, on) {
      w.el.classList.toggle('maxed', on);
      w.max.textContent = on ? 'esc' : '⤢';
      w.max.setAttribute('aria-label', (on ? 'Back from fullscreen: ' : 'Fullscreen: ') + w.label);
      api.state(html, 'maxed', on);
      playFilms();
    }
    function maximize(w, animate) {
      if (!w || maxed === w) return;
      if (maxed) { setMax(maxed, false); maxed = null; } else backY = window.scrollY;
      if (w.desk !== curDesk) showDesk(w.desk);
      focusWin(w, false);
      function go() {
        maxed = w;
        setMax(w, true);
        mname.textContent = w.label;
        w.el.scrollTop = 0;
        w.el.focus({ preventScroll: true });
      }
      if (animate) zoom(w.el.getBoundingClientRect(), full(), go); else go();
    }
    function unmax(quiet) {
      var w = maxed;
      if (!w) return;
      maxed = null;
      setMax(w, false);
      window.scrollTo(0, backY);
      if (quiet) return;
      zoom(full(), w.el.getBoundingClientRect(), function () { focusWin(w, true); });
    }
    function turn(n) {
      if (!maxed) return;
      var i = wins.indexOf(maxed) + n;
      while (i >= 0 && i < wins.length && wins[i].el.hidden) i += n;  // a closed floating window is skipped
      if (i < 0 || i >= wins.length) return;
      var w = wins[i];
      setMax(maxed, false);
      maxed = null;
      showDesk(w.desk);
      maximize(w, false);
    }

    // ---------- links, the address, keys and swipes ----------
    function setHash(id) {
      try { history.replaceState(history.state, '', '#' + id); } catch (e) { /* a sandboxed frame may refuse; the desk still shows */ }
    }
    function winOf(node) {
      for (var i = 0; i < wins.length; i++) if (wins[i].el.contains(node)) return wins[i];
      return null;
    }
    function route(id, user) {
      if (!id) return false;
      if (byId[id]) { showDesk(byId[id], user); return true; }
      var node = d.getElementById(id), w = node && winOf(node);
      if (!w) return false;
      if (maxed && maxed !== w) unmax(true);
      showDesk(w.desk);
      if (w.reveal) w.reveal(node);
      focusWin(w, user);
      return true;
    }
    api.on(d, 'click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.classList.contains('skip')) return;
      var id = a.getAttribute('href').slice(1);
      if (route(id, true)) { e.preventDefault(); setHash(id); }
    });
    api.on(window, 'hashchange', function () { route(location.hash.slice(1), false); });

    api.on(d, 'keydown', function (e) {
      if (e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
      var t = e.target, k = e.key;
      if (t.closest && t.closest('input, textarea, select, [contenteditable], .switch, [role="dialog"]')) return;
      if (focused && focused.keys && focused.keys(k, e)) { e.preventDefault(); return; }
      if (maxed) {
        if (k === 'Escape' || k === 'f') { e.preventDefault(); unmax(); }
        else if (k === 'h' || k === 'ArrowLeft') { e.preventDefault(); turn(-1); }
        else if (k === 'l' || k === 'ArrowRight') { e.preventDefault(); turn(1); }
        return;
      }
      if (k.length === 1 && k >= '1' && k <= String(DESKS.length)) {
        e.preventDefault();
        var x = DESKS[+k - 1];
        if (x === curDesk && prevDesk) x = prevDesk;  // workspace_auto_back_and_forth yes
        showDesk(x, true);
        setHash(x.id);
        return;
      }
      if (k === 'ArrowRight' || k === 'ArrowLeft') {
        if (t.closest && t.closest('[role="tablist"]')) return;
        e.preventDefault();
        step(k === 'ArrowRight' ? 1 : -1);
        return;
      }
      if (k.length === 1 && 'hjkl'.indexOf(k) > -1) { e.preventDefault(); focusWin(neighbour(k), true); return; }
      if (k === 'f') { e.preventDefault(); maximize(focused, true); }
    });

    // a sideways swipe is Win+← / Win+→, or a page turn in fullscreen
    var sx = 0, sy = 0;
    api.on(desks, 'touchstart', function (e) { var p = e.changedTouches[0]; sx = p.clientX; sy = p.clientY; }, { passive: true });
    api.on(desks, 'touchend', function (e) {
      var p = e.changedTouches[0], dx = p.clientX - sx, dy = p.clientY - sy;
      if (Math.abs(dx) < 70 || Math.abs(dx) < 1.8 * Math.abs(dy)) return;
      if (maxed) turn(dx < 0 ? 1 : -1); else step(dx < 0 ? 1 : -1);
    }, { passive: true });

    // ?desk= opens a desk the way #desk does, without the browser scrolling to it or focusing it: what a page that
    // frames this one (a gallery of its variants, say) needs, since a fragment would pull its focus and scroll it
    // ================= a desk fills its screen =================
    // From 1280 x 700 theme.css makes every desk exactly the screen and sizes its type to it (--fit). On 1 www and
    // 5 term that can leave the text short of its windows (a screen wider than 16:9, or larger than 1920 x 1080: the
    // windows fill the screen, the text does not). There the desk's type grows, measured, to the largest size at which
    // its fullest window is just full; on 1 www the film's window takes the width that makes its picture fill the top
    // row (16:9), the rest of that row going to about; on 5 term the two terminals share the width so that both run
    // about as tall. Where the stylesheet's own layout is already the fullest (1280 x 700), it stays as it is.
    // The type grows no larger than at 1920 x 1080 (the owner, 2026-11-18: 31 px on 1 www and 41 px on 5 term at
    // 2560 x 1440 was too much); past that the windows keep the room, as a real terminal on a larger screen does
    var fitScreen = window.matchMedia('(min-width: 1280px) and (min-height: 700px)');
    var TYPE_MAX = { www: 23, term: 30 };
    // the height a window needs: its title bar and borders, and its body down to the end of its last child
    function need(w) {
      var b = w.body, last = b.lastElementChild, top = b.getBoundingClientRect().top;
      var end = last ? last.getBoundingClientRect().bottom - top + parseFloat(getComputedStyle(b).paddingBottom) : 0;
      return w.el.offsetHeight - b.clientHeight + end;
    }
    function box(t) {
      var cs = getComputedStyle(t);
      return { w: t.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), h: t.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
        col: parseFloat(cs.columnGap) || 0, row: parseFloat(cs.rowGap) || 0 };
    }
    // the largest type in [lo, hi] at which fits() holds, to a quarter pixel; null when not even lo fits
    function largest(lo, hi, fits) {
      if (!fits(lo)) return null;
      while (hi - lo > 0.25) { var mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
      return lo;
    }
    var FILL = {
      www: function (t) {
        var p = byId.www.parts, g = box(t), W = g.w, gap = g.col;
        // each row's windows side by side at the widths asked, whatever the other row does: the grid gets a track
        // between every two edges of either row, and each window the tracks under it
        function lay(top, bottom) {
          var edges = [];
          [top, bottom].forEach(function (row) { var x = 0; row.slice(0, -1).forEach(function (c) { x += c[1]; edges.push(x); x += gap; }); });
          edges.sort(function (m, n) { return m - n; });
          var cuts = [], tracks = [], from = 0;
          edges.forEach(function (e) { if (!cuts.length || e - cuts[cuts.length - 1] > 2) cuts.push(e); });
          cuts.forEach(function (e) { tracks.push(Math.max(0, e - from)); from = e + gap; });
          tracks.push(Math.max(0, W - from));
          function names(row) {
            var ends = [], x = 0, at = 0;
            row.forEach(function (c) { x += c[1]; ends.push(x); x += gap; });
            return tracks.map(function (w) {
              var mid = at + w / 2, j = 0;
              at += w + gap;
              while (j < ends.length - 1 && mid > ends[j] + gap / 2) j++;
              return row[j][0];
            }).join(' ');
          }
          t.style.gridTemplateColumns = tracks.map(function (w) { return w.toFixed(1) + 'px'; }).join(' ');
          t.style.gridTemplateAreas = '"' + names(top) + '" "' + names(bottom) + '"';
        }
        function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
        // the share of two windows that makes them about as tall, from their heights at the current share
        function even(share, a, b) { return a * share / (a * share + b * (1 - share)); }
        // mode 'wide': the film's window as wide as a 16:9 picture as tall as its row; a number: at most that wide
        function fits(f, mode) {
          t.style.setProperty('--fit', f + 'px');
          var m = mode === 'wide' ? 0.24 * W : mode, q = 40 / 76, r = 0.30;  // film, about's share of the rest of the top row, history's of the bottom
          var chrome = p.film.el.offsetHeight - p.film.body.clientHeight;
          for (var i = 0; i < 4; i++) {
            var rest = W - m - 2 * gap, low = W - gap;
            lay([['mpv', m], ['about', q * rest], ['src', (1 - q) * rest]], [['dev', (1 - r) * low], ['hist', r * low]]);
            var ha = need(p.about), hs = need(p.source), hd = need(p.dev), hh = need(p.history);
            q = clamp(even(q, ha, hs), 0.35, 0.75);
            r = clamp(even(r, hh, hd), 0.2, 0.42);
            // the film's width for a 16:9 picture as tall as its row
            var aim = (Math.max(ha, hs) - chrome) * 16 / 9 + 2;
            m = mode === 'wide' ? clamp(aim, 0.18 * W, 0.42 * W) : Math.min(mode, Math.max(0.18 * W, aim));
          }
          rest = W - m - 2 * gap;
          lay([['mpv', m], ['about', q * rest], ['src', (1 - q) * rest]], [['dev', (1 - r) * low], ['hist', r * low]]);
          return Math.max(need(p.about), need(p.source)) + Math.max(need(p.dev), need(p.history)) + g.row <= g.h;
        }
        var base = parseFloat(getComputedStyle(p.about.body).fontSize), hi = Math.max(base, Math.min(base * 1.6, TYPE_MAX.www));
        // the film at 16:9 first (the top row's height is the film's), then the largest type
        var f = largest(base, hi, function (x) { return fits(x, 'wide'); });
        if (f !== null) { fits(f, 'wide'); return true; }
        // where a 16:9 film leaves the text no room at the stylesheet's size: the widest film that does, then the
        // largest type with it
        var lo = 0.24 * W, top = 0.42 * W;
        if (!fits(base, lo)) return false;
        while (top - lo > 4) { var mid = (lo + top) / 2; if (fits(base, mid)) lo = mid; else top = mid; }
        f = largest(base, hi, function (x) { return fits(x, lo); });
        fits(f, lo);
        return true;
      },
      term: function (t) {
        var p = byId.term.parts, g = box(t), avail = g.w - g.col;
        function cols(r) { t.style.gridTemplateColumns = 'minmax(0, ' + r + 'fr) minmax(0, ' + (1 - r) + 'fr)'; }
        function fits(f) {
          var lo = 0.25, hi = 0.75, share = 0.5;
          t.style.setProperty('--fit', f + 'px');
          // the terminal with less to say gets less width, so that both run about as tall: halve the range of the
          // split towards where install's height meets images' (its commands wrap in steps, not smoothly)
          for (var i = 0; i < 6; i++) {
            share = (lo + hi) / 2;
            cols(share);
            if (need(p.install) < need(p.images)) hi = share; else lo = share;
          }
          share = (lo + hi) / 2;
          cols(share);
          return Math.max(need(p.install), need(p.images)) <= g.h && avail > 0;
        }
        var base = parseFloat(getComputedStyle(p.install.body).fontSize);
        var f = largest(base, Math.max(base, Math.min(base * 1.6, TYPE_MAX.term)), fits);
        if (f === null) return false;
        fits(f);
        return true;
      }
    };
    // a desk measured once per screen size (and per font: the fallback's letters are wider than Inconsolata's)
    var PROPS = ['--fit', 'grid-template-columns', 'grid-template-areas'], filled = {};
    function fill(k) {
      var fn = FILL[k && k.id];
      if (!fn) return;
      var t = k.tilesEl, key = k.id + ' ' + window.innerWidth + 'x' + window.innerHeight + ' ' + (d.fonts ? d.fonts.status : '');
      PROPS.forEach(function (x) { t.style.removeProperty(x); });
      if (!fitScreen.matches || maxed || k !== curDesk || !t.isConnected) return;
      if (filled[key]) { PROPS.forEach(function (x, i) { if (filled[key][i]) t.style.setProperty(x, filled[key][i]); }); return; }
      if (!fn(t)) PROPS.forEach(function (x) { t.style.removeProperty(x); });
      filled[key] = PROPS.map(function (x) { return t.style.getPropertyValue(x); });
    }
    var refit = 0;
    api.on(window, 'resize', function () { clearTimeout(refit); refit = api.later(function () { fill(curDesk); }, 120); });
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { fill(curDesk); }, function () { fill(curDesk); /* the fallback font is what shows */ });

    if (!route(location.hash.slice(1), false) && !route(params && params.get('desk'), false)) showDesk(byId.www, false);

    return {
      unmount: function () {
        // a film taken out of the page would go on playing (and loading) on its own: stop it and drop its source
        if (seer) seer.disconnect();
        films.forEach(function (f) { f.v.pause(); f.v.removeAttribute('src'); f.v.load(); });
        window.scrollTo(0, 0);
      }
    };
  }
});
