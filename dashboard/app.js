// Token Radar's dashboard (model radar-3). It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board with search, category / chain / watchlist filters, sortable
// columns, a per-protocol detail drawer carrying the model's own arithmetic, the row's reason and
// its farm plan, a methodology panel with the peer-multiple table the prices came from, and a
// Method view stating the model, its data sources and how each farm plan is generated.
// No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', watchOnly: false, tab: 'pre-token', sort: 'rank', dir: 1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    if (n === null || n === undefined) return 'n/a';
    return n.toFixed(2) + 'x';
  }
  // The model in one function: the page recomputes a row from the snapshot figures and the peer
  // multiple the model used, and checks the number board.json carries, so the page's code and the
  // board's data are visibly the same arithmetic.
  function growthMultOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    return Math.round((1 + (growth / 100) * model.growth_weight) * 1e4) / 1e4;
  }
  function impliedOf(row, model) {
    return Math.max(1, Math.round(row.tvl_usd * row.peer_multiple * growthMultOf(row, model) * row.maturity_multiplier * model.pretoken_discount));
  }
  // A row's category entry in the multiples table: its live-peer count, raw median and any
  // diversity step-downs. data.js rows do not repeat these; the table is the one copy.
  function catEntry(row) {
    var key = row.category || 'Uncategorised';
    for (var i = 0; i < DATA.multiples.length; i++) if (DATA.multiples[i].category === key) return DATA.multiples[i];
    return null;
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watchOnly && !r.watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Uncategorised') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'multiple') { av = a.peer_multiple; bv = b.peer_multiple; }
      else if (key === 'implied') { av = a.implied_value_usd; bv = b.implied_value_usd; }
      else { av = a.rank; bv = b.rank; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Pre-token protocols, priced by their live peers' }),
        el('p', { html: 'Every protocol with no token on record is priced the way the market already prices its live peers: <b>TVL x the category\'s market-cap/TVL multiple</b>, adjusted for seven-day growth, time live with no token, and a pre-token discount. The watchlist (TVL at or above $' + Math.round(DATA.floor_usd / 1e6) + 'M, no token) is covered in full; the early radar adds the strongest pre-token protocols below that floor. Implied value is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'All-protocol median multiple' }), el('b', { text: fmtMult(DATA.global_median) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Uncategorised'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { state.category = catSelect.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var watchBtn = el('button', { type: 'button', 'aria-pressed': state.watchOnly ? 'true' : 'false', text: 'Watchlist only', onclick: function () { state.watchOnly = !state.watchOnly; render(); } });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; writeHash(); render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; writeHash(); render(); } });
    var method = el('button', { type: 'button', 'aria-pressed': state.tab === 'method' ? 'true' : 'false', text: 'Method', onclick: function () { state.tab = 'method'; writeHash(); render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Coverage' }), el('div', { class: 'tabs' }, watchBtn)),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live, method)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : state.tab === 'method' ? 'how the board is priced' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label, defaultDir) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = defaultDir; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category or chain to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchOnly = false; writeHash(); render(); } })
      ));
    }
    var max = 0;
    list.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
    max = max || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Uncategorised') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtMult(r.peer_multiple) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, r.watchlist
          ? el('span', { class: 'badge watch', text: 'watchlist' })
          : el('span', { class: 'badge early', text: 'early radar' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its pricing, its reason and its farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('rank', 'Rank', 1),
            sortHeader('name', 'Protocol', 1),
            sortHeader('tvl', 'TVL', -1),
            sortHeader('growth', '7d', -1),
            sortHeader('age', 'Age', -1),
            sortHeader('multiple', 'Peer multiple', -1),
            sortHeader('implied', 'Implied value', -1),
            el('th', { scope: 'col', text: 'Coverage' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Uncategorised') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: fmtMult(r.mcap_tvl) }),
        el('td', null, el('span', { class: 'badge early', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. Their market-cap/TVL ratios are the peer evidence the pre-token board is priced from; the full table is in the methodology below.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'MCap / TVL' }), el('th', { scope: 'col', text: 'Token' })))
          ,
          tbody
        )
      )
    );
  }

  function multiplesTable() {
    var multRows = DATA.multiples.map(function (x) {
      return el('tr', null,
        el('td', { text: x.category }),
        el('td', { class: 'num', text: String(x.peers) }),
        el('td', { class: 'num', text: x.median === null ? 'n/a' : fmtMult(x.median) }),
        el('td', { class: 'num', text: fmtMult(x.used) }),
        el('td', { class: 'num', text: x.quota_steps ? String(x.quota_steps) : '-' })
      );
    });
    return el('div', { class: 'mult-wrap' },
      el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null,
          el('th', { scope: 'col', text: 'Category' }),
          el('th', { scope: 'col', text: 'Live peers' }),
          el('th', { scope: 'col', text: 'Median MCap/TVL' }),
          el('th', { scope: 'col', text: 'Multiple used' }),
          el('th', { scope: 'col', text: 'Quota steps' })
        )),
        el('tbody', null, multRows)
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed (model ' + DATA.model_version + ')' }),
      el('p', { html: 'One function prices every row from the snapshot\'s own figures. <b>No protocol name is special-cased</b>, and the page recomputes each row from data.js to prove it carries the same number as board.json.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl x peer_multiple x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x maturity x ' + m.pretoken_discount + ' )'
      ),
      el('p', { html: '<b>Peer multiple.</b> For each category, the live-token protocols\' market cap / TVL ratios are the evidence. The multiple used is the category median shrunk toward the all-protocol median of ' + fmtMult(DATA.global_median) + ': n peers against K phantom median peers, where K is ' + m.shrinkage_k + ' at ' + m.small_sample_n + ' peers or more and grows by ' + m.small_sample_boost + ' for every peer below that, so a median of one or two ratios is mostly discounted. The result is clamped to [' + m.multiple_min + 'x, ' + m.multiple_max + 'x]. A category with no live peer is priced at the all-protocol median.' }),
      el('p', { html: '<b>Diversity quota.</b> No category may hold more than ' + m.quota_max + ' of the top ' + m.quota_top + ' places. While one would, its multiple steps down by x' + m.quota_step + ' and the board is repriced, before any row is written; the Quota steps column in the table below shows where that engaged. The full method, its data sources and the farm-plan generator are in the Method view.' }),
      el('p', { html: '<b>Growth.</b> Seven-day TVL change, clamped to [' + m.growth_floor + '%, +' + m.growth_cap + '%], moves the price by the stated weight; a protocol with no recorded change is neutral. <b>Maturity.</b> Days since first listing, capped at three years, scale a factor from ' + m.maturity_floor + ' to ' + (m.maturity_floor + m.maturity_range) + ': the longer a protocol has run with no token, the nearer and better proven its launch. An unrecorded listing date scores a flat x' + m.unknown_age_multiplier + '. <b>Pre-token discount.</b> A flat x' + m.pretoken_discount + ' prices the launch and liquidity risk a live peer has already shed.' }),
      el('p', { html: '<b>Coverage.</b> The board ranks every watchlist protocol (TVL at or above $' + Math.round(DATA.floor_usd / 1e6) + 'M, no token, not a wrapped or bridged product) and adds the ' + DATA.early_size + ' strongest independent pre-token protocols below the floor by implied value. Wrapped, staked and bridged products of tokens that already trade are not launches and are never ranked. Live-token protocols are set aside in the Live token view with the market\'s own values.' }),
      el('h3', { text: 'Peer multiples by category' }),
      multiplesTable(),
      el('p', { class: 'sub', text: 'Source: ' + DATA.source + '. Snapshot date ' + DATA.as_of + '. An implied value is an estimate built from these figures alone, not a price prediction.' })
    );
  }

  function methodPanel() {
    var m = DATA.model;
    var counts = {};
    DATA.rows.slice(0, m.quota_top).forEach(function (r) { var c = r.category || 'Uncategorised'; counts[c] = (counts[c] || 0) + 1; });
    var countChips = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || (a < b ? -1 : 1); }).map(function (c) {
      return el('span', { class: 'badge ' + (counts[c] >= m.quota_max ? 'watch' : 'early'), text: c + ': ' + counts[c] });
    });
    var stepped = DATA.multiples.filter(function (x) { return x.quota_steps > 0; });
    var steppedText = stepped.length
      ? stepped.map(function (x) { return x.category + ' took ' + x.quota_steps + ' step-down' + (x.quota_steps === 1 ? '' : 's') + ' (raw median ' + (x.median === null ? 'n/a' : fmtMult(x.median)) + ', multiple used ' + fmtMult(x.used) + ')'; }).join('; ') + '.'
      : 'No category needed a step-down on this snapshot.';
    return el('section', { class: 'panel model method' },
      el('h2', { text: 'Method: the estimate, the quota, the data, the plans' }),
      el('p', { html: 'Everything on this page is computed from <b>one sealed snapshot</b> by the one model stated here (version ' + DATA.model_version + '). No protocol name is special-cased, no figure is fetched live, and the page recomputes every row from data.js so the arithmetic below can be checked against the board it produced.' }),
      el('h3', { text: 'The estimate, in five steps' }),
      el('ol', { class: 'rules' },
        el('li', { html: '<b>Peer multiple.</b> Among protocols whose token already trades, market cap / TVL is what the market pays for a dollar of TVL. Each category\'s multiple is the median of that ratio over its live protocols, shrunk toward the all-protocol median of ' + fmtMult(DATA.global_median) + ' and clamped to [' + m.multiple_min + 'x, ' + m.multiple_max + 'x]. A category with no live peer is priced at the all-protocol median.' }),
        el('li', { html: '<b>Base value.</b> TVL x the category\'s multiple: what this protocol\'s TVL would be worth if the market priced it like its live peers.' }),
        el('li', { html: '<b>Growth and maturity.</b> Seven-day TVL change, clamped to [' + m.growth_floor + '%, +' + m.growth_cap + '%], moves the base by x(1 + change/100 x ' + m.growth_weight + '). Days live with no token scale a maturity factor from ' + m.maturity_floor + ' to ' + (m.maturity_floor + m.maturity_range) + ' over three years; an unrecorded listing date scores a flat x' + m.unknown_age_multiplier + '.' }),
        el('li', { html: '<b>Pre-token discount.</b> A flat x' + m.pretoken_discount + ' prices the launch and liquidity risk a live peer has already shed.' }),
        el('li', { html: '<b>Diversity quota.</b> No category may hold more than ' + m.quota_max + ' of the top ' + m.quota_top + ' places; the step-down that enforces this is described under its own heading below.' })
      ),
      el('div', { class: 'formula' },
        'implied = round( tvl x peer_multiple x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x maturity x ' + m.pretoken_discount + ' ),  multiple = (n x category median + K x global median) / (n + K)'
      ),
      el('h3', { text: 'Thin categories: why the shrinkage grows' }),
      el('p', { html: 'A median of forty ratios is evidence; a median of one is an anecdote. The shrinkage weight K is ' + m.shrinkage_k + ' once a category has ' + m.small_sample_n + ' live peers, and grows by ' + m.small_sample_boost + ' for every peer below that: K = ' + (m.shrinkage_k + 2 * m.small_sample_boost) + ' for a single peer (its own median then counts for 1/' + (1 + m.shrinkage_k + 2 * m.small_sample_boost) + ' of the multiple used) and K = ' + (m.shrinkage_k + m.small_sample_boost) + ' for two peers. On this snapshot that pulls the thinnest categories most of the way to the all-protocol median, which is where a sample that small belongs. The table is the evidence itself: every category on the board, its live peers, its raw median and the multiple actually used.' }),
      multiplesTable(),
      el('h3', { text: 'The diversity quota, and its result here' }),
      el('p', { html: 'A board whose head is one category repeated is a worse map of where launches will come from, whatever the raw values say, so the cap is a rule of the model, not a display choice: <b>at most ' + m.quota_max + ' of the top ' + m.quota_top + ' places per category</b>. It is enforced before any row is written: while a category holds more, its multiple steps down by x' + m.quota_step + ' and the whole board is repriced, until the cap holds. A category priced on the all-protocol median steps down from the median itself. Coverage is never traded for the cap: every watchlist protocol stays on the board, ranked by the value the final multiples give it.' }),
      el('p', { html: 'On this snapshot: ' + steppedText }),
      el('p', { text: 'The top ' + m.quota_top + ' as priced:' }),
      el('div', { class: 'chips' }, countChips),
      el('h3', { text: 'Data and sources' }),
      el('p', { html: 'The only input is the sealed snapshot named in the source line below: a DefiLlama protocol index frozen at ' + DATA.as_of + '. Each protocol record carries ten fields (slug, name, category, chains, TVL, seven-day TVL change, market cap, first listing date, CoinGecko id, symbol) and the model reads nothing else. The watchlist is the snapshot\'s own list of ' + DATA.watchlist_size + ' protocols at or above the $' + Math.round(DATA.floor_usd / 1e6) + 'M TVL floor with no token on record. The board ranks those ' + DATA.watchlist_size + ' plus the ' + DATA.early_size + ' strongest independent pre-token protocols below the floor; ' + DATA.live_size + ' live-token protocols are set aside in the Live token view, as evidence, never as entries.' }),
      el('h3', { text: 'How a farm plan is generated' }),
      el('p', { html: 'No plan is written by hand and none is copied between protocols: each is assembled from the protocol\'s own record. The category selects one of sixteen playbooks (decentralised exchange, lending, CDP, derivatives, risk curator, yield, real-world assets, restaking, bridge, chain, prediction market, insurance, launchpad, indexes, payments, stablecoin issuer) or a default deposit plan. The first chain names the gas token for the wallet step; TVL sets the capital tier ($50 below $10M, $100 to $100M, $150 to $1B, $250 above); a second chain earns a repeat step at half size; age sets the hold window (60 days under six months live, 45 under a year, otherwise 30; 30 when no date is recorded). Every plan then runs: fresh wallet, the playbook\'s core action, its second action, the optional second-chain repeat, the playbook\'s weekly action on a fixed weekday, the hold, the playbook\'s own watch-out, and a claim-and-log step that only ever claims from the protocol\'s own page. Each step states its cost and its time, and because every input differs by protocol, no two rows on the board carry the same plan.' }),
      el('h3', { text: 'Coverage and exclusions' }),
      el('p', { html: 'A protocol is pre-token when its record carries no market cap, no CoinGecko id and no symbol. Products of another protocol are not launches and are never ranked: the Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC, CEX and Anchor BTC categories, names ending in a version marker, and names carrying the word wrapped, staked or staking. What is left is ranked purely by implied value, strongest first, ranks 1 to ' + DATA.board_size + '.' }),
      el('p', { class: 'sub', text: 'Source: ' + DATA.source + '. Snapshot date ' + DATA.as_of + '. Model ' + DATA.model_version + '. An implied value is an estimate built from these figures alone, not a price prediction.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Uncategorised') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + ' · ' + (row.watchlist ? 'watchlist' : 'early radar') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    var recomputed = impliedOf(row, DATA.model);
    var entry = catEntry(row);
    var peerCount = entry ? entry.peers : 0;
    var catMedian = entry ? entry.median : null;
    var quotaSteps = entry ? entry.quota_steps : 0;
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Why this value' }),
      el('p', { text: row.reason }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Peer multiple (' + peerCount + (peerCount === 1 ? ' live peer' : ' live peers') + ')' }), el('b', { class: 'num', text: fmtMult(row.peer_multiple) })),
        el('div', null, el('span', { text: 'Category median MCap/TVL' }), el('b', { class: 'num', text: catMedian === null ? 'n/a' : fmtMult(catMedian) })),
        quotaSteps > 0 ? el('div', null, el('span', { text: 'Diversity step-downs (top-' + DATA.model.quota_top + ' quota)' }), el('b', { class: 'num', text: quotaSteps + ' x x' + DATA.model.quota_step })) : null,
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: 'x' + growthMultOf(row, DATA.model) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: 'x' + row.maturity_multiplier })),
        el('div', null, el('span', { text: 'Pre-token discount' }), el('b', { class: 'num', text: 'x' + DATA.model.pretoken_discount })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    if (state.tab === 'method') {
      shell.appendChild(methodPanel());
    } else {
      shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
      shell.appendChild(modelPanel());
    }
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
