/* The core's own behaviour, whatever the theme: the flavour toggle of "How do I install it?", the theme switcher, and
   the first mount of the theme the head's bootstrap chose. Without JavaScript none of this exists and the page reads
   top to bottom.

   MinosSwitch.apply(slug) -> Promise: loads the theme's stylesheet (enabled only once loaded, in the same moment the
   old one goes), its fonts, fragments and effects; unmounts the old theme, mounts the new one, and remembers the
   choice (localStorage minos.theme; a ?theme= in the address is kept in step). */
(function () {
  'use strict';
  var d = document, html = d.documentElement;
  var themes = window.minosThemes.list;
  var KEY = 'minos.theme';

  function theme(slug) { for (var i = 0; i < themes.length; i++) if (themes[i].slug === slug) return themes[i]; return null; }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* storage blocked: the choice lasts this visit */ } }

  // ---------- the flavour: a toggle, not a multiple choice; it rewrites the one-liner ----------
  var flav = d.querySelector('#install .flav');
  if (flav) {
    var one = d.getElementById('one'), note = d.getElementById('flavnote');
    var buttons = Array.prototype.slice.call(flav.querySelectorAll('button[data-f]'));
    var setFlavour = function (f) {
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-f') === f)); });
      Array.prototype.forEach.call(d.querySelectorAll('#install code[data-f]'), function (c) {
        var on = c.getAttribute('data-f') === f;
        c.classList.toggle('on', on);
        c.classList.toggle('off', !on);
      });
      one.textContent = f;
      note.textContent = f === 'core' ? 'servers, terminals' : 'i3 desktop, includes minos-core';
    };
    buttons.forEach(function (b) { b.addEventListener('click', function () { setFlavour(b.getAttribute('data-f')); }); });
    flav.hidden = false;
    setFlavour('desktop');
  }

  // ---------- the theme switcher: a disclosure with one radio per theme ----------
  var sw = d.getElementById('switch'), btn = sw.querySelector('.switch-btn'), panel = d.getElementById('switch-panel');
  var cur = sw.querySelector('.switch-cur');
  themes.forEach(function (t) {
    var label = d.createElement('label'), input = d.createElement('input');
    label.className = 'switch-opt';
    input.type = 'radio';
    input.name = 'theme';
    input.value = t.slug;
    label.appendChild(input);
    label.appendChild(d.createTextNode(' ' + t.name));
    panel.appendChild(label);
  });
  function sync() {
    var slug = html.getAttribute('data-theme'), t = theme(slug);
    cur.textContent = t ? t.name : slug;
    Array.prototype.forEach.call(panel.querySelectorAll('input'), function (r) { r.checked = r.value === slug; });
  }
  function setOpen(open) {
    btn.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  }
  btn.addEventListener('click', function () { setOpen(panel.hidden); });
  d.addEventListener('click', function (e) { if (!panel.hidden && !sw.contains(e.target)) setOpen(false); });
  sw.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) { e.preventDefault(); e.stopPropagation(); setOpen(false); btn.focus(); }
  });
  panel.addEventListener('change', function (e) {
    if (e.target.name === 'theme' && e.target.checked) apply(e.target.value).catch(function (err) { console.error(err); sync(); });
  });

  // Resolves with the new <link>, loaded but still disabled (media "not all"), right after `after`.
  function stylesheet(href, after) {
    return new Promise(function (ok, fail) {
      var l = d.createElement('link');
      l.rel = 'stylesheet';
      l.media = 'not all';
      l.href = href;
      l.onload = function () { ok(l); };
      l.onerror = function () { l.remove(); fail(new Error('MinosSwitch: could not load ' + href)); };
      after.after(l);
    });
  }
  function setFonts(href) {
    var l = d.getElementById('theme-fonts');
    if (!href) { if (l) l.remove(); return; }
    if (!l) { l = d.createElement('link'); l.id = 'theme-fonts'; l.rel = 'stylesheet'; d.getElementById('theme-css').before(l); }
    if (l.getAttribute('href') !== href) l.setAttribute('href', href);
  }

  var seq = 0;
  function apply(slug) {
    var t = theme(slug), mine = ++seq;
    if (!t) return Promise.reject(new Error('MinosSwitch: no theme ' + slug));
    if (slug === html.getAttribute('data-theme') && window.MinosFX.current() === slug) return Promise.resolve();
    var css = d.getElementById('theme-css');
    return Promise.all([stylesheet(t.css, css), window.MinosFX.load(slug)]).then(function (r) {
      var fresh = r[0];
      if (mine !== seq) { fresh.remove(); return; }  // a later pick won
      var hadFocus = sw.contains(d.activeElement);
      // one synchronous step: no frame is painted with the old theme's effects on the new theme's look
      window.MinosFX.unmount();
      css.remove();
      fresh.media = 'all';
      fresh.id = 'theme-css';
      setFonts(t.fonts);
      html.setAttribute('data-theme', slug);
      window.minosTheme = slug;
      window.MinosFX.mount(slug);
      save(slug);
      try {
        var u = new URL(location.href);
        if (u.searchParams.has('theme')) { u.searchParams.set('theme', slug); history.replaceState(history.state, '', u.toString()); }
      } catch (e) { /* an address that cannot be rewritten keeps its old ?theme=; the saved choice still wins after it */ }
      sync();
      setOpen(false);
      if (hadFocus) btn.focus({ preventScroll: true });
    });
  }

  window.MinosSwitch = { apply: apply };

  // ---------- this page load ----------
  sw.hidden = false;
  sync();
  window.MinosFX.mount(window.minosTheme);
  html.classList.remove('fx-wait');
})();
