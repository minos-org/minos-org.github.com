/* respuesta effects: a dmenu line on top of the page, two answers side by side under it (What is minos? and How do
   I install it?), every other answer below. The core's contents list becomes the dmenu's entries; typing filters them
   by name, by each section's data-keys and by its text; Enter, a click or a tap opens the answer in the pane that is
   not focused, and the answer it replaces goes back to its place in the list below. */
MinosFX.register('respuesta', {
  mount: function (api) {
    'use strict';
    var d = document, html = d.documentElement, main = d.getElementById('main');
    var $ = function (id) { return d.getElementById(id); };
    var el = api.el;

    api.cls(html, 'resp-on');

    // ---------- the dmenu line: prompt, input, the core's contents as entries, the theme switcher ----------
    var bar = api.add(el('header', { class: 'dbar' }), d.body, $('site'));
    var form = bar.appendChild(el('form', { class: 'dm', role: 'search', autocomplete: 'off' }));
    form.appendChild(el('label', { class: 'prompt', for: 'q' }, 'minos'));
    var input = form.appendChild(el('input', {
      id: 'q', type: 'text', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'go',
      placeholder: 'ask', 'aria-label': 'Ask: type to filter the answers', 'aria-controls': 'toc'
    }));
    var toc = $('toc');
    api.move(toc, form);
    api.move($('switch'), form);
    var list = toc.querySelector('ul');
    var none = api.add(el('li', { class: 'nomatch', hidden: '' }, 'no answer'), list);

    var order = [], secs = {};
    var items = Array.prototype.map.call(list.querySelectorAll('a'), function (a) {
      var id = a.getAttribute('href').slice(1), sec = $(id);
      order.push(id);
      secs[id] = sec;
      var via = api.add(el('span', { class: 'via' }), a);
      // the question gets its short name, as dmenu would list it
      var h2 = sec.querySelector('h2');
      api.add(el('span', { class: 'k', 'aria-hidden': 'true' }, a.textContent), h2);
      return {
        a: a, li: a.parentNode, name: id, via: via,
        keys: (sec.getAttribute('data-keys') || '').split(' '),
        text: sec.textContent.replace(/\s+/g, ' ').toLowerCase()
      };
    });

    // ---------- two panes, like two i3 windows ----------
    var panes = api.add(el('div', { class: 'panes' }), main, main.firstChild);
    var slots = [panes.appendChild(el('div', { class: 'slot' })), panes.appendChild(el('div', { class: 'slot' }))];
    api.move(secs.about, slots[0]);
    api.move(secs.install, slots[1]);
    var after = api.frag('after').firstElementChild;
    if (after) api.add(after, main, panes.nextSibling);
    var focus = 1;

    function inSlot(id) {
      for (var i = 0; i < 2; i++) if (slots[i].firstElementChild === secs[id]) return i;
      return -1;
    }
    function mark() { items.forEach(function (it) { api.state(it.a, 'shown', inSlot(it.name) > -1); }); }
    function setFocus(i) {
      focus = i;
      slots[0].classList.toggle('focus', i === 0);
      slots[1].classList.toggle('focus', i === 1);
    }
    function open(id) {
      if (!secs[id]) return false;
      var where = inSlot(id);
      if (where < 0) {
        where = 1 - focus;
        var slot = slots[where];
        if (slot.firstElementChild) api.home(slot.firstElementChild);
        api.move(secs[id], slot);
        slot.classList.remove('fresh');
        void slot.offsetWidth;
        slot.classList.add('fresh');
      }
      setFocus(where);
      mark();
      input.value = '';
      filter();
      var top = slots[where].getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.5) slots[where].scrollIntoView({ block: 'start' });
      return true;
    }

    // ---------- filtering, as dmenu does: name first, then keywords, then the text ----------
    var matches = items.slice(), sel = 0;
    function filter() {
      var q = input.value.trim().toLowerCase(), ranked = [];
      items.forEach(function (it, i) {
        var score = -1, via = '';
        if (!q) score = i;
        else if (it.name.indexOf(q) === 0) score = i;
        else if (it.name.indexOf(q) > 0) score = 20 + i;
        else {
          for (var k = 0; k < it.keys.length; k++) if (it.keys[k].indexOf(q) === 0) { score = 40 + i; via = it.keys[k]; break; }
          if (score < 0 && it.text.indexOf(q) > -1) { score = 60 + i; via = q; }
        }
        api.attr(it.li, 'hidden', score < 0 ? '' : null);
        it.via.textContent = via ? ' ' + via : '';
        if (score >= 0) ranked.push({ it: it, score: score });
      });
      ranked.sort(function (a, b) { return a.score - b.score; });
      matches = ranked.map(function (r) { return r.it; });
      // best match first, as dmenu lists them; the entries go back to the core's order on unmount
      matches.forEach(function (it) { api.move(it.li, list); });
      list.appendChild(none);
      none.hidden = matches.length > 0;
      sel = 0;
      paint();
    }
    function paint() {
      items.forEach(function (it) { api.state(it.a, 'sel', !!input.value && it === matches[sel]); });
      if (matches[sel] && input.value) matches[sel].a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    function move(n) {
      if (!matches.length) return;
      sel = (sel + n + matches.length) % matches.length;
      paint();
    }

    api.on(input, 'input', filter);
    api.on(form, 'submit', function (e) {
      e.preventDefault();
      var it = input.value ? matches[sel] : null;
      if (it) open(it.name);
    });
    api.on(input, 'keydown', function (e) {
      var atEnd = input.selectionStart === input.value.length;
      if (e.key === 'ArrowRight' && atEnd && input.value) { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowLeft' && sel > 0) { e.preventDefault(); move(-1); }
      else if (e.key === 'Escape') {
        e.stopPropagation();
        if (input.value) { input.value = ''; filter(); } else input.blur();
      }
    });
    // any link to an answer opens it in a pane instead of jumping down the page
    api.on(d, 'click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.classList.contains('skip')) return;
      if (open(a.getAttribute('href').slice(1))) e.preventDefault();
    });
    api.on(window, 'hashchange', function () { open(location.hash.slice(1)); });
    // typing anywhere goes to the bar
    api.on(d, 'keydown', function (e) {
      if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || e.target === input) return;
      var t = e.target;
      if (t.closest && t.closest('button, input, select, textarea, .switch')) return;
      if (e.key.length === 1 && e.key !== ' ') input.focus();
    });

    setFocus(1);
    mark();
    filter();
    var start = location.hash.slice(1);
    if (start && secs[start] && start !== 'about' && start !== 'install') open(start);

    return null;
  }
});
