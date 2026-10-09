/* Visit Vaal Marina: trip planner, run in the browser.
   A JavaScript port of the site's built-in keyword matching (app/search.php, keyword_plan),
   which understands everyday English and Afrikaans words. No outside service is used. */
(function (root) {
  'use strict';

  var W = '[\\p{L}\\p{N}_]';
  var B = '(?:(?<=' + W + ')(?!' + W + ')|(?<!' + W + ')(?=' + W + '))'; // Unicode word boundary, like PHP's \b with /u
  var LN = '[\\p{L}\\p{N}]';

  function re(src, flags) { return new RegExp(src.replace(/\\b/g, B), (flags || '') + 'u'); }
  function quote(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }
  function len(s) { return Array.from(s).length; }

  function normalizeQuery(q) {
    q = String(q).toLowerCase();
    q = q.replace(/[^\p{L}\p{N}&\-' ]+/gu, ' ');
    return q.replace(/\s+/gu, ' ').trim();
  }

  function detectGroupSize(q) {
    q = ' ' + normalizeQuery(q) + ' ';
    var words = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
      twee: 2, drie: 3, vier: 4, vyf: 5, ses: 6, sewe: 7, agt: 8, nege: 9, tien: 10 };
    q = q.replace(re('\\b(' + Object.keys(words).join('|') + ')\\b', 'g'), function (m, w) { return String(words[w]); });
    var people = 'people|persons|person|pax|guests|guest|adults|adult|of us|friends|mense|persone|volwassenes|gaste|sleeper';
    var kids = 'kids|kid|children|child|kinders|kind|teenagers|teens';
    var m;
    if ((m = q.match(re('\\b(\\d{1,2})\\s*(?:adults?|volwassenes?)\\b.{0,12}?\\b(\\d{1,2})\\s*(?:' + kids + ')\\b')))) { return +m[1] + +m[2]; }
    if ((m = q.match(re('\\b(\\d{1,2})\\s*(?:' + people + ')\\b')))) { return +m[1]; }
    if ((m = q.match(re('\\b(?:family|group|party|gesin|groep) (?:of|van) (\\d{1,2})\\b')))) { return +m[1]; }
    if ((m = q.match(re('\\b(?:sleeps?|sleep|slaap) (\\d{1,2})\\b')))) { return +m[1]; }
    if ((m = q.match(re('\\b(?:for|vir) (\\d{1,2})\\b(?! ?(?:nights?|days?|weeks?|hours?|nagte|dae|pm|am|h\\d))')))) { return +m[1]; }
    if (re('\\b(?:couple|paartjie)\\b').test(q)) { return 2; }
    return null;
  }

  function Planner(data) {
    this.all = data.businesses;
    this.svc = data.services;
    var phrases = [];
    Object.keys(this.svc).forEach(function (slug) {
      data.services[slug].words.forEach(function (w) { phrases.push([w.toLowerCase(), slug]); });
    });
    phrases.sort(function (a, b) { return len(b[0]) - len(a[0]); }); // stable, like PHP 8 usort
    this.phrases = phrases;
  }

  Planner.prototype.detectNeeds = function (q) {
    var text = ' ' + normalizeQuery(q) + ' ';
    var found = {}, order = [];
    this.phrases.forEach(function (p) {
      var phrase = p[0], slug = p[1];
      if (text.indexOf(phrase) === -1) { return; }
      var r = new RegExp('(?<!' + LN + ')' + quote(phrase) + '(?!' + LN + ')', 'u');
      var m = r.exec(text);
      if (m) {
        if (!(slug in found)) { order.push(slug); found[slug] = m.index; }
        else if (m.index < found[slug]) { found[slug] = m.index; }
        text = text.replace(new RegExp(r.source, 'gu'), function (x) { return ' '.repeat(x.length); });
      }
    });
    // asort: by position; ties keep insertion order
    return order.map(function (s, i) { return [s, found[s], i]; })
      .sort(function (a, b) { return a[1] - b[1] || a[2] - b[2]; })
      .map(function (x) { return x[0]; });
  };

  var STOP = ['the', 'and', 'for', 'with', 'want', 'need', 'get', 'some', 'any', 'our', 'can', 'where', 'find', 'near',
    'this', 'that', 'weekend', 'people', 'other', 'items', 'general', 'looking', 'would', 'like', 'have', 'from',
    'vaal', 'marina', 'dam', 'book', 'buy', 'please', 'good', 'best', 'nice', 'also', 'will', 'are', 'you',
    'ons', 'vir', 'die', 'wil', 'graag', 'met', 'soek', 'naweek', 'mense', 'kry', 'een', 'ook'];

  function prefixRe(t) { return new RegExp('(?<!' + LN + ')' + quote(t), 'u'); }

  function textScore(b, tokens) {
    var name = ' ' + normalizeQuery(b.name) + ' ';
    var mid = ' ' + normalizeQuery(b.tagline + ' ' + b.keywords) + ' ';
    var low = ' ' + normalizeQuery((b.description || '') + ' ' + b.address) + ' ';
    var score = 0;
    tokens.forEach(function (t) {
      var r = prefixRe(t);
      if (r.test(name)) { score += 3; } else if (r.test(mid)) { score += 2; } else if (r.test(low)) { score += 1; }
    });
    return score;
  }

  function cmp(x, y) {
    if (x.rank !== y.rank) { return x.rank < y.rank ? -1 : 1; }
    return x.b.name < y.b.name ? -1 : (x.b.name > y.b.name ? 1 : 0);
  }

  Planner.prototype.needLabel = function (slug, size) {
    var label = this.svc[slug] ? this.svc[slug].need : slug;
    if (size !== null && (slug === 'accommodation' || slug === 'camping')) { label += ' for ' + size; }
    return label;
  };

  Planner.prototype.plan = function (q) {
    q = String(q).replace(/\s+/gu, ' ').trim();
    q = Array.from(q).slice(0, 300).join('').trim();
    var self = this, all = this.all, svc = this.svc;
    var needs = this.detectNeeds(q);
    var size = detectGroupSize(q);
    var groups = [];
    needs.forEach(function (slug) {
      var items = [], maybe = false;
      all.forEach(function (b) {
        if (b.services.indexOf(slug) === -1) { return; }
        var note = '', rank = 1;
        if (slug === 'accommodation' || slug === 'camping') {
          var sleeps = b.sleeps;
          if (size !== null && sleeps !== null && sleeps < size) { return; }
          if (sleeps !== null) { note = 'Sleeps up to ' + sleeps; rank = 0; }
          else if (size !== null) { note = 'Ask whether it sleeps ' + size; }
        }
        items.push({ b: b, note: note, rank: rank - b.featured * 0.5 });
      });
      if (!items.length) {
        var generic = ['shop', 'shopping', 'food', 'store', 'drinks', 'room', 'rooms', 'function', 'party', 'property', 'tools', 'cash', 'bank', 'water', 'nature', 'walk'];
        var words = svc[slug].words.filter(function (w) { return len(w) >= 4 && generic.indexOf(w) === -1; });
        all.forEach(function (b) {
          var probe = { name: b.name, tagline: b.tagline, keywords: b.keywords, description: '', address: '' };
          if (textScore(probe, words) >= 2) { items.push({ b: b, note: '', rank: 1 }); maybe = true; }
        });
      }
      items.sort(cmp);
      groups.push({
        need: self.needLabel(slug, size),
        note: maybe ? 'No business is listed for exactly this yet. These may be able to help.' : '',
        maybe: maybe,
        items: items.slice(0, 8)
      });
    });

    var seen = {};
    var tokens = normalizeQuery(q).replace(/[&\-']/g, ' ').split(' ').filter(function (t) {
      if (len(t) < 3 || /^[0-9]+$/.test(t) || STOP.indexOf(t) !== -1 || seen[t]) { return false; }
      seen[t] = true; return true;
    });
    var scored = [];
    all.forEach(function (b) {
      var score;
      if (needs.length) {
        var nm = ' ' + normalizeQuery(b.name);
        score = tokens.filter(function (t) { return prefixRe(t).test(nm); }).length * 3;
      } else {
        score = textScore(b, tokens);
      }
      if (score >= (needs.length ? 6 : 2)) { scored.push({ b: b, note: '', rank: -score }); }
    });
    if (scored.length) {
      scored.sort(cmp);
      var group = { need: 'Listings that match your words', note: '', maybe: false, items: scored.slice(0, 8) };
      if (needs.length) { groups.push(group); } else { groups.unshift(group); }
    }
    var count = 0;
    groups.forEach(function (g) { count += g.items.length; });
    return { engine: 'keyword', summary: '', groups: groups, count: count, query: q };
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  /* Same markup as app/views/_results.php */
  Planner.prototype.render = function (r, base) {
    var h = '<div class="results" data-engine="' + esc(r.engine) + '">\n';
    if (!r.groups.length) {
      h += '<div class="results-empty">\n<h2>Nothing matched that yet</h2>\n<p>Try naming what you need in plain words, such as "a place to stay for six", "boat repairs" or "somewhere for breakfast". You can also <a href="' + base + '/directory/">browse the whole directory</a>.</p>\n</div>\n';
    } else {
      h += '<p class="results-summary">' + r.count + ' ' + (r.count === 1 ? 'listing matches' : 'listings match') + ' what you asked for.</p>\n';
      r.groups.forEach(function (g) {
        h += '<section class="need' + (g.items.length ? '' : ' need-empty') + '">\n<h2 class="need-title">' + esc(g.need) + '</h2>\n';
        if (g.note !== '') { h += '<p class="need-note">' + esc(g.note) + '</p>\n'; }
        if (g.items.length) {
          h += '<div class="cards cards-compact">\n';
          g.items.forEach(function (it) {
            var card = it.b.card;
            card = it.note !== '' ? card.replace('__NOTE__', esc(it.note)) : card.replace(/\s*<p class="card-note">__NOTE__<\/p>/, '');
            h += card;
          });
          h += '</div>\n';
        } else {
          h += '<p class="need-none">No business is listed for this yet. If you know one that should be here, <a href="' + base + '/list-your-business/">send us its details</a>.</p>\n';
        }
        h += '</section>\n';
      });
    }
    h += '<p class="results-foot">Matched from the listings on this site. Always confirm prices, opening times and availability with the business.</p>\n</div>\n';
    return h;
  };

  root.VMPlanner = Planner;
  root.VMNormalize = normalizeQuery;
  root.VMGroupSize = detectGroupSize;
  if (typeof module !== 'undefined' && module.exports) { module.exports = { Planner: Planner, normalizeQuery: normalizeQuery, detectGroupSize: detectGroupSize }; }
})(typeof window !== 'undefined' ? window : globalThis);
