/* Visit Vaal Marina (static preview build) — small progressive enhancements. Every page works without this file. */
(function () {
  'use strict';
  var base = (window.VM && window.VM.base) || '';

  /* mobile menu */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* submit the planner with Enter (Shift+Enter makes a new line) */
  document.querySelectorAll('.planner textarea').forEach(function (ta) {
    ta.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        if (ta.form.requestSubmit) { ta.form.requestSubmit(); } else { ta.form.submit(); }
      }
    });
  });

  /* trip planner: load results in place */
  var form = document.querySelector('[data-planner]');
  var results = document.getElementById('results');
  var plannerP = null;
  var loadPlanner = function () {
    if (!plannerP) {
      plannerP = fetch(base + '/assets/data/planner.json')
        .then(function (r) { if (!r.ok) { throw new Error('http ' + r.status); } return r.json(); })
        .then(function (d) { return new window.VMPlanner(d); });
      plannerP.catch(function () { plannerP = null; });
    }
    return plannerP;
  };
  if (form && results && window.fetch && window.VMPlanner) {
    var field = form.querySelector('textarea');
    var run = function (q, push) {
      results.innerHTML = '';
      results.appendChild(document.getElementById('plan-loading').content.cloneNode(true));
      var url = base + '/plan/?q=' + encodeURIComponent(q);
      loadPlanner()
        .then(function (p) { return p.render(p.plan(q), base); })
        .then(function (html) {
          results.innerHTML = html;
          if (push) { history.pushState({ q: q }, '', url); }
          results.focus({ preventScroll: true });
          results.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        })
        .catch(function () {
          results.innerHTML = '';
          results.appendChild(document.getElementById('plan-error').content.cloneNode(true));
        });
    };
    form.addEventListener('submit', function (ev) {
      var q = field.value.trim();
      if (!q) { return; }
      ev.preventDefault();
      run(q, true);
    });
    form.querySelectorAll('[data-example]').forEach(function (b) {
      b.addEventListener('click', function () {
        field.value = b.getAttribute('data-example');
        run(field.value, true);
      });
    });
    var startQ = new URLSearchParams(location.search).get('q') || '';
    if (startQ.trim()) { field.value = startQ; run(startQ.trim(), false); }
    window.addEventListener('popstate', function () {
      var q = new URLSearchParams(location.search).get('q') || '';
      field.value = q;
      if (q) { run(q, false); } else { results.innerHTML = ''; }
    });
  }

  /* preview: forms that need a server do not send */
  document.querySelectorAll('form[data-preview]').forEach(function (f) {
    f.addEventListener('submit', function (ev) { ev.preventDefault(); });
  });

  /* directory: filter the cards as you type */
  var filter = document.querySelector('[data-filter]');
  if (filter) {
    var cards = Array.prototype.slice.call(document.querySelectorAll(filter.getAttribute('data-filter')));
    var status = document.querySelector('.filter-status');
    var none = document.querySelector('.filter-none');
    filter.addEventListener('input', function () {
      var words = filter.value.toLowerCase().split(/\s+/).filter(Boolean);
      var shown = 0;
      cards.forEach(function (card) {
        var hay = card.getAttribute('data-search') || '';
        var hit = words.every(function (w) { return hay.indexOf(w) !== -1; });
        card.hidden = !hit;
        if (hit) { shown++; }
      });
      if (status) { status.textContent = words.length ? shown + (shown === 1 ? ' listing shown' : ' listings shown') : ''; }
      if (none) { none.hidden = shown !== 0; }
    });
  }
})();
