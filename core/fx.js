/* MinosFX: the core's effects engine. A theme's effects.js registers itself here; the engine mounts one theme at a
   time and, when the visitor switches, takes it down and leaves the core page exactly as the server sent it.

   MinosFX.register('<slug>', { mount: function (api) { …; return { unmount: function () {} } } })
   MinosFX.fragments('<slug>', { name: '<html>' })   the theme's decorative HTML, read with api.frag(name)
   MinosFX.write(slug)    while the page is parsed: writes the theme's fragments.js and effects.js script tags
   MinosFX.load(slug)     after it: appends them, resolves when both have run
   MinosFX.mount(slug)    MinosFX.unmount()    MinosFX.current()

   Everything a theme does to the core goes through the api, so it can be undone:
     api.add(node, parent, before)      inserts a node of the theme's own; removed on unmount
     api.move(node, parent, before)     moves a core node; a comment keeps its place, and it goes back there on unmount
     api.home(node)                     puts a moved node back in its place now
     api.cls(node, name…)               adds classes; removed on unmount
     api.state(node, name, on)          toggles a class that changes while mounted; removed on unmount
     api.attr(node, name, value|null)   sets or removes an attribute; the original comes back on unmount
     api.on(target, type, fn, opts)     a listener; removed on unmount
     api.every(fn, ms), api.later(fn, ms)   timers; cleared on unmount
     api.el(tag, attrs, text)           a new element (not inserted)
     api.frag(name)                     a DocumentFragment from the theme's fragments
     api.reduced                        prefers-reduced-motion, read live
     api.load(key), api.save(key, v)    localStorage under minos.<slug>., silent when storage is blocked
   A theme never writes into the core's text and never sets inline styles on core nodes. */
(function () {
  'use strict';
  var defs = {}, frags = {}, mounted = null, loading = {};
  var reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function theme(slug) {
    var list = window.minosThemes.list;
    for (var i = 0; i < list.length; i++) if (list[i].slug === slug) return list[i];
    return null;
  }

  function makeState(slug) {
    var st = { slug: slug, adds: [], moves: [], classes: [], states: [], attrs: [], listeners: [], timers: [], intervals: [], instance: null };
    function attrRecord(node, name) {
      for (var i = 0; i < st.attrs.length; i++) if (st.attrs[i][0] === node && st.attrs[i][1] === name) return;
      st.attrs.push([node, name, node.hasAttribute(name) ? node.getAttribute(name) : null]);
    }
    st.api = {
      slug: slug,
      get reduced() { return reduceMQ.matches; },
      el: function (tag, attrs, text) {
        var e = document.createElement(tag);
        if (attrs) for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
        if (text !== undefined && text !== null) e.textContent = text;
        return e;
      },
      frag: function (name) {
        var t = document.createElement('template');
        t.innerHTML = (frags[slug] && frags[slug][name]) || '';
        return t.content;
      },
      add: function (node, parent, before) {
        parent.insertBefore(node, before || null);
        if (node.nodeType === 11) return node;  // a fragment's children are recorded by the caller
        st.adds.push(node);
        return node;
      },
      move: function (node, parent, before) {
        if (!node.__fxHome) {
          var c = document.createComment('fx:' + (node.id || node.className || node.nodeName));
          node.parentNode.insertBefore(c, node);
          node.__fxHome = c;
          st.moves.push(node);
        }
        parent.insertBefore(node, before || null);
        return node;
      },
      home: function (node) {
        var c = node.__fxHome;
        if (!c) return;
        c.parentNode.insertBefore(node, c);
        c.parentNode.removeChild(c);
        delete node.__fxHome;
        st.moves.splice(st.moves.indexOf(node), 1);
      },
      cls: function (node) {
        for (var i = 1; i < arguments.length; i++) {
          if (!node.classList.contains(arguments[i])) { node.classList.add(arguments[i]); st.classes.push([node, arguments[i]]); }
        }
        return node;
      },
      state: function (node, name, on) {
        node.classList.toggle(name, !!on);
        for (var i = 0; i < st.states.length; i++) if (st.states[i][0] === node && st.states[i][1] === name) return node;
        st.states.push([node, name]);
        return node;
      },
      attr: function (node, name, value) {
        attrRecord(node, name);
        if (value === null || value === undefined) node.removeAttribute(name); else node.setAttribute(name, value);
        return node;
      },
      on: function (target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        st.listeners.push([target, type, fn, opts]);
      },
      every: function (fn, ms) { var id = setInterval(fn, ms); st.intervals.push(id); return id; },
      later: function (fn, ms) { var id = setTimeout(fn, ms); st.timers.push(id); return id; },
      load: function (key) { try { return localStorage.getItem('minos.' + slug + '.' + key); } catch (e) { return null; } },
      save: function (key, v) { try { localStorage.setItem('minos.' + slug + '.' + key, v); } catch (e) { /* storage blocked: this visit only */ } }
    };
    return st;
  }

  function teardown(st) {
    try { if (st.instance && typeof st.instance.unmount === 'function') st.instance.unmount(); }
    catch (e) { console.error('MinosFX ' + st.slug + ': unmount failed', e); }
    st.listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    st.intervals.forEach(clearInterval);
    st.timers.forEach(clearTimeout);
    // moved nodes go home last-moved first, before the theme's own nodes (which may hold them) are removed
    for (var i = st.moves.length - 1; i >= 0; i--) {
      var n = st.moves[i], c = n.__fxHome;
      if (c && c.parentNode) { c.parentNode.insertBefore(n, c); c.parentNode.removeChild(c); }
      delete n.__fxHome;
    }
    st.adds.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    for (i = st.attrs.length - 1; i >= 0; i--) {
      var a = st.attrs[i];
      if (a[2] === null) a[0].removeAttribute(a[1]); else a[0].setAttribute(a[1], a[2]);
    }
    st.classes.forEach(function (c) { c[0].classList.remove(c[1]); });
    st.states.forEach(function (c) { c[0].classList.remove(c[1]); });
  }

  function scriptTag(src) { return '<script src="' + String(src).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"><\/script>'; }
  function append(src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = function () { s.remove(); fail(new Error('MinosFX: could not load ' + src)); };
      document.body.appendChild(s);
    });
  }

  window.MinosFX = {
    register: function (slug, def) { defs[slug] = def; },
    fragments: function (slug, map) { frags[slug] = map; },
    write: function (slug) {
      var t = theme(slug);
      if (!t) return;
      document.write((t.fragments ? scriptTag(t.fragments) : '') + (t.effects ? scriptTag(t.effects) : ''));
    },
    load: function (slug) {
      var t = theme(slug);
      if (!t) return Promise.reject(new Error('MinosFX: no theme ' + slug));
      if (defs[slug] || !t.effects) return Promise.resolve();
      if (!loading[slug]) {
        loading[slug] = (t.fragments ? append(t.fragments) : Promise.resolve()).then(function () { return append(t.effects); });
        loading[slug].catch(function () { delete loading[slug]; });
      }
      return loading[slug];
    },
    mount: function (slug) {
      if (mounted) this.unmount();
      var def = defs[slug];
      if (!def) return false;
      var st = makeState(slug);
      mounted = st;
      try { st.instance = def.mount(st.api) || null; }
      catch (e) { console.error('MinosFX ' + slug + ': mount failed', e); this.unmount(); return false; }
      return true;
    },
    unmount: function () {
      var st = mounted;
      mounted = null;
      if (st) teardown(st);
    },
    current: function () { return mounted ? mounted.slug : null; }
  };
})();
