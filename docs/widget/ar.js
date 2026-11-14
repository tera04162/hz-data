/* 에셋리포트 위젯 — 시장체온계(data-ar="thermo")와 투자 통계 연구소(data-ar="events").
   의존성 없음. 데이터는 같은 저장소의 docs/data/*.json. 블로그 쪽에는 로더 한 줄만 둔다. */
(function () {
  'use strict';
  if (window.__AR_LOADED__) return;
  window.__AR_LOADED__ = true;
  var BASE = (window.AR_BASE || 'https://raw.githubusercontent.com/tera04162/hz-data/assetreport/docs').replace(/\/$/, '');
  var UP = '#d93a3a', DOWN = '#2a6fd6', COLD = '#2a78d6', HOT = '#e34948', MID = '#8a8a86';
  var HZ_NAME = { 5: '1주', 20: '1개월', 60: '3개월', 120: '6개월', 250: '1년' };

  var CSS = '.ar-root{--s:#fcfcfb;--s2:#f3f2ef;--line:#e3e2dd;--t1:#111;--t2:#52514e;--t3:#8a8a86;color:var(--t1);font-size:15px;line-height:1.55;text-align:left;margin:18px 0;word-break:keep-all}' +
    '.ar-root *{box-sizing:border-box}.ar-card{background:var(--s);border:1px solid var(--line);border-radius:12px;padding:16px;margin:0 0 14px}' +
    '.ar-h{font-size:17px;font-weight:700;margin:0 0 4px}.ar-sub{color:var(--t2);font-size:13px;margin:0 0 12px}' +
    '.ar-hero{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.ar-big{font-size:52px;font-weight:800;line-height:1;letter-spacing:-1px}.ar-tag{font-size:20px;font-weight:700}' +
    '.ar-meta{color:var(--t2);font-size:13px}.ar-up{color:' + UP + '}.ar-dn{color:' + DOWN + '}.ar-mut{color:var(--t3)}' +
    '.ar-gauge{position:relative;height:46px;margin:14px 0 4px}.ar-gbar{position:absolute;left:0;right:0;top:14px;height:12px;border-radius:6px;background:linear-gradient(90deg,' + COLD + ' 0%,#9ec5f4 25%,#d9d8d3 50%,#f0a3a2 75%,' + HOT + ' 100%)}' +
    '.ar-gpin{position:absolute;top:6px;width:4px;height:28px;margin-left:-2px;background:var(--t1);border-radius:2px;box-shadow:0 0 0 2px var(--s)}.ar-glab{position:absolute;top:30px;font-size:11px;color:var(--t3);transform:translateX(-50%);white-space:nowrap}' +
    '.ar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:10px}.ar-a{background:var(--s);border:1px solid var(--line);border-radius:10px;padding:11px 12px}' +
    '.ar-a b{font-size:13px;font-weight:600;color:var(--t2);display:block}.ar-a .v{font-size:19px;font-weight:700;margin:1px 0}.ar-a .r{font-size:12px;display:flex;gap:8px;flex-wrap:wrap}.ar-a svg{display:block;margin-top:6px;width:100%;height:34px}' +
    '.ar-chip{display:inline-block;font-size:11px;font-weight:700;border-radius:20px;padding:1px 8px;border:1px solid var(--line);color:var(--t2);background:var(--s2)}' +
    '.ar-row{display:grid;grid-template-columns:118px 1fr 44px;gap:10px;align-items:center;font-size:13px;padding:5px 0}.ar-track{position:relative;height:8px;border-radius:4px;background:var(--s2)}.ar-dot{position:absolute;top:-3px;width:14px;height:14px;border-radius:50%;margin-left:-7px;box-shadow:0 0 0 2px var(--s)}' +
    '.ar-tbl{width:100%;border-collapse:collapse;font-size:13px}.ar-tbl th,.ar-tbl td{padding:7px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.ar-tbl th:first-child,.ar-tbl td:first-child{text-align:left}.ar-tbl th{color:var(--t2);font-weight:600;font-size:12px}' +
    '.ar-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}.ar-btns{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}' +
    '.ar-btn{font:inherit;font-size:13px;padding:5px 11px;border-radius:18px;border:1px solid var(--line);background:var(--s);color:var(--t2);cursor:pointer}.ar-btn[aria-pressed=true]{background:var(--t1);color:#fff;border-color:var(--t1)}' +
    '.ar-ev{display:block;width:100%;text-align:left;font:inherit;background:var(--s);border:1px solid var(--line);border-radius:10px;padding:12px;cursor:pointer;color:inherit}.ar-ev:hover,.ar-ev:focus{border-color:var(--t2);outline:none}.ar-ev h4{margin:0 0 3px;font-size:15px}.ar-ev p{margin:0;font-size:12px;color:var(--t2)}' +
    '.ar-evgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}.ar-on{border-color:' + HOT + '!important}.ar-live{color:#fff;background:' + HOT + ';border-color:' + HOT + '}' +
    '.ar-chart{position:relative}.ar-chart svg{display:block;width:100%;height:auto;touch-action:pan-y}.ar-tip{position:absolute;pointer-events:none;background:#111;color:#fff;font-size:12px;padding:5px 8px;border-radius:6px;white-space:nowrap;transform:translate(-50%,-120%);z-index:5;display:none}' +
    '.ar-note{font-size:12px;color:var(--t3);margin:8px 0 0}.ar-warn{background:#fff6e5;border:1px solid #f0d9a8;border-radius:8px;padding:8px 10px;font-size:13px;color:#6b4e00;margin:0 0 10px}' +
    '.ar-link{color:var(--t1);font-weight:600;text-decoration:underline;cursor:pointer;background:none;border:0;font:inherit;padding:0}' +
    '@media(max-width:480px){.ar-big{font-size:44px}.ar-row{grid-template-columns:96px 1fr 40px}.ar-card{padding:13px}}';

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function svg(tag, attrs) { var e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function fmt(v, d) { return v == null ? '–' : Number(v).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function signed(v, d, unit) { if (v == null) return '–'; return (v > 0 ? '▲' : v < 0 ? '▼' : '') + fmt(Math.abs(v), d) + (unit || ''); }
  function cls(v) { return v > 0 ? 'ar-up' : v < 0 ? 'ar-dn' : 'ar-mut'; }
  function tempColor(t) {
    function mix(a, b, p) { var o = '#'; for (var i = 1; i < 7; i += 2) { var x = parseInt(a.substr(i, 2), 16), y = parseInt(b.substr(i, 2), 16); o += ('0' + Math.round(x + (y - x) * p).toString(16)).slice(-2); } return o; }
    return t < 50 ? mix(COLD, MID, t / 50) : mix(MID, HOT, (t - 50) / 50);
  }
  function getJSON(path) {
    var bust = Math.floor(Date.now() / 6e5);
    return fetch(BASE + path + '?v=' + bust).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function kdate(s) { return s ? s.replace(/-/g, '.') : '–'; }
  function fail(root, e) { root.textContent = ''; var c = el('div', 'ar-card'); c.appendChild(el('p', 'ar-sub', '데이터를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.')); root.appendChild(c); if (window.console) console.warn('[AR]', e); }

  /* ---------- 공용 차트 ---------- */
  function spark(vals, up) {
    var w = 160, h = 34, mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), r = mx - mn || 1, d = '';
    vals.forEach(function (v, i) { d += (i ? 'L' : 'M') + (i / (vals.length - 1) * w).toFixed(1) + ' ' + (h - 3 - (v - mn) / r * (h - 6)).toFixed(1); });
    var s = svg('svg', { viewBox: '0 0 ' + w + ' ' + h, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    s.appendChild(svg('path', { d: d, fill: 'none', stroke: up ? UP : DOWN, 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' }));
    return s;
  }

  function lineChart(host, pts, opt) {
    // pts: [[날짜, 값]], y축 고정 0~100
    host.textContent = '';
    var narrow = (host.clientWidth || 720) < 520;
    var W = narrow ? 400 : 720, H = narrow ? 230 : 260, L = 30, R = 10, T = 10, B = 24, n = pts.length;
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opt.label });
    var x = function (i) { return L + i / Math.max(1, n - 1) * (W - L - R); }, y = function (v) { return T + (100 - v) / 100 * (H - T - B); };
    s.appendChild(svg('rect', { x: L, y: y(100), width: W - L - R, height: y(80) - y(100), fill: HOT, opacity: .07 }));
    s.appendChild(svg('rect', { x: L, y: y(20), width: W - L - R, height: y(0) - y(20), fill: COLD, opacity: .07 }));
    [0, 20, 50, 80, 100].forEach(function (g) {
      s.appendChild(svg('line', { x1: L, x2: W - R, y1: y(g), y2: y(g), stroke: '#e3e2dd', 'stroke-width': 1 }));
      var t = svg('text', { x: L - 6, y: y(g) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#8a8a86' }); t.textContent = g; s.appendChild(t);
    });
    var lastYear = '';
    var step = Math.ceil(n / (narrow ? 4 : 7));
    pts.forEach(function (p, i) {
      if (i % step === 0 || i === n - 1) {
        var lab = n > 400 ? p[0].slice(0, 4) : p[0].slice(2, 7).replace('-', '.');
        if (lab === lastYear) return; lastYear = lab;
        var t = svg('text', { x: x(i), y: H - 6, 'text-anchor': i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle', 'font-size': 11, fill: '#8a8a86' }); t.textContent = lab; s.appendChild(t);
      }
    });
    var d = ''; pts.forEach(function (p, i) { d += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[1]).toFixed(1); });
    s.appendChild(svg('path', { d: d, fill: 'none', stroke: '#111', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    var cross = svg('line', { y1: T, y2: H - B, stroke: '#52514e', 'stroke-width': 1, opacity: 0 }), dot = svg('circle', { r: 4.5, fill: '#111', stroke: '#fcfcfb', 'stroke-width': 2, opacity: 0 });
    s.appendChild(cross); s.appendChild(dot);
    s.appendChild(svg('circle', { cx: x(n - 1), cy: y(pts[n - 1][1]), r: 4.5, fill: tempColor(pts[n - 1][1]), stroke: '#fcfcfb', 'stroke-width': 2 }));
    var tip = el('div', 'ar-tip'); host.appendChild(s); host.appendChild(tip);
    function move(ev) {
      var b = s.getBoundingClientRect(), cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - b.left;
      var i = Math.round((cx / b.width * W - L) / (W - L - R) * (n - 1)); i = Math.max(0, Math.min(n - 1, i));
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('opacity', 1);
      dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(pts[i][1])); dot.setAttribute('opacity', 1);
      tip.textContent = kdate(pts[i][0]) + ' · ' + fmt(pts[i][1], 1) + '도';
      tip.style.display = 'block'; tip.style.left = (x(i) / W * b.width) + 'px'; tip.style.top = (y(pts[i][1]) / H * b.height) + 'px';
    }
    function leave() { cross.setAttribute('opacity', 0); dot.setAttribute('opacity', 0); tip.style.display = 'none'; }
    s.addEventListener('mousemove', move); s.addEventListener('touchstart', move, { passive: true }); s.addEventListener('touchmove', move, { passive: true });
    s.addEventListener('mouseleave', leave); s.addEventListener('touchend', leave);
  }

  function stripChart(host, rows, col, st, base) {
    // 발생 사례별 이후 수익률을 한 줄에 점으로. 중앙값·평소 평균 표시.
    host.textContent = '';
    var xs = rows.filter(function (r) { return r[col] != null; });
    if (!xs.length) { host.appendChild(el('p', 'ar-sub', '아직 이 기간이 지난 사례가 없습니다.')); return; }
    var narrow = (host.clientWidth || 720) < 520;
    var W = narrow ? 400 : 720, H = 120, L = 14, R = 14, mid = 52;
    var lim = Math.max(5, Math.ceil(Math.max(Math.abs(st.min), Math.abs(st.max)) / 5) * 5);
    var x = function (v) { return L + (v + lim) / (2 * lim) * (W - L - R); };
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': '사례별 이후 수익률 분포' });
    s.appendChild(svg('line', { x1: L, x2: W - R, y1: mid, y2: mid, stroke: '#e3e2dd', 'stroke-width': 1 }));
    (narrow ? [-lim, 0, lim] : [-lim, -lim / 2, 0, lim / 2, lim]).forEach(function (g) {
      s.appendChild(svg('line', { x1: x(g), x2: x(g), y1: mid - 30, y2: mid + 30, stroke: g === 0 ? '#52514e' : '#e3e2dd', 'stroke-width': 1 }));
      var t = svg('text', { x: x(g), y: H - 22, 'text-anchor': 'middle', 'font-size': 11, fill: '#8a8a86' }); t.textContent = (g > 0 ? '+' : '') + g + '%'; s.appendChild(t);
    });
    s.appendChild(svg('rect', { x: x(st.p25), y: mid - 14, width: Math.max(1, x(st.p75) - x(st.p25)), height: 28, rx: 4, fill: '#111', opacity: .08 }));
    var tip = el('div', 'ar-tip');
    xs.forEach(function (r, i) {
      var jit = ((i * 37) % 21 - 10) * 1.6;
      var c = svg('circle', { cx: x(r[col]), cy: mid + jit, r: 5, fill: r[col] >= 0 ? UP : DOWN, opacity: .72, stroke: '#fcfcfb', 'stroke-width': 1.5 });
      c.addEventListener('mouseenter', function () { var b = s.getBoundingClientRect(); tip.textContent = kdate(r[0]) + ' 발생 → ' + (r[col] > 0 ? '+' : '') + fmt(r[col], 2) + '%'; tip.style.display = 'block'; tip.style.left = (x(r[col]) / W * b.width) + 'px'; tip.style.top = ((mid + jit) / H * b.height) + 'px'; });
      c.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
      s.appendChild(c);
    });
    s.appendChild(svg('line', { x1: x(st.median), x2: x(st.median), y1: mid - 36, y2: mid + 36, stroke: '#111', 'stroke-width': 2 }));
    var t1 = svg('text', { x: x(st.median), y: 10, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#111' }); t1.textContent = '중앙값 ' + (st.median > 0 ? '+' : '') + fmt(st.median, 1) + '%'; s.appendChild(t1);
    if (base) {
      s.appendChild(svg('line', { x1: x(base.median), x2: x(base.median), y1: mid - 30, y2: mid + 30, stroke: '#52514e', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }));
      var t2 = svg('text', { x: x(base.median), y: H - 6, 'text-anchor': 'middle', 'font-size': 11, fill: '#52514e' }); t2.textContent = '평소 중앙값 ' + (base.median > 0 ? '+' : '') + fmt(base.median, 1) + '%'; s.appendChild(t2);
    }
    host.appendChild(s); host.appendChild(tip);
  }

  /* ---------- 시장체온계 ---------- */
  function renderThermo(root, m) {
    root.textContent = '';
    var c = m.composite;
    if (c) {
      var card = el('div', 'ar-card');
      card.appendChild(el('h3', 'ar-h', '오늘의 시장 체온'));
      card.appendChild(el('p', 'ar-sub', kdate(c.date) + ' 종가 기준 · 0도(혹한) ~ 100도(과열)'));
      var hero = el('div', 'ar-hero');
      var big = el('span', 'ar-big', fmt(c.value, 1)); hero.appendChild(big); hero.appendChild(el('span', 'ar-tag', '도 · ' + c.label));
      card.appendChild(hero);
      var meta = el('p', 'ar-meta');
      meta.appendChild(document.createTextNode('1주 전보다 '));
      var a = el('b', cls(c.chg5), signed(c.chg5, 1, '도')); meta.appendChild(a);
      meta.appendChild(document.createTextNode(' · 1개월 전보다 '));
      meta.appendChild(el('b', cls(c.chg20), signed(c.chg20, 1, '도')));
      if (c.pct != null) meta.appendChild(document.createTextNode(' · 지난 20년 중 ' + fmt(c.pct, 0) + '%의 날보다 높음'));
      card.appendChild(meta);
      var g = el('div', 'ar-gauge'); g.appendChild(el('div', 'ar-gbar'));
      var pin = el('div', 'ar-gpin'); pin.style.left = c.value + '%'; g.appendChild(pin);
      [['혹한', 10], ['쌀쌀', 30], ['평온', 50], ['따뜻', 70], ['과열', 90]].forEach(function (l) { var s = el('span', 'ar-glab', l[0]); s.style.left = l[1] + '%'; g.appendChild(s); });
      card.appendChild(g);
      root.appendChild(card);
    }

    if (m.active && m.active.length) {
      var ac = el('div', 'ar-card'); ac.appendChild(el('h3', 'ar-h', '지금 켜진 신호'));
      ac.appendChild(el('p', 'ar-sub', '최근 5거래일 안에 조건이 충족된 이벤트와, 과거 같은 일이 있은 뒤의 실제 결과입니다.'));
      m.active.forEach(function (e) {
        var p = el('p'); p.style.margin = '0 0 8px';
        p.appendChild(el('span', 'ar-chip ar-live', kdate(e.date))); p.appendChild(document.createTextNode(' '));
        p.appendChild(el('b', null, e.title));
        if (e.s60) p.appendChild(document.createTextNode(' — 과거 ' + e.s60.n + '번, 3개월 뒤 ' + e.target + ' 중앙값 ' + (e.s60.median > 0 ? '+' : '') + fmt(e.s60.median, 1) + '% (오른 비율 ' + fmt(e.s60.win, 0) + '%' + (e.b60 ? ', 평소 ' + fmt(e.b60.win, 0) + '%' : '') + ')'));
        ac.appendChild(p);
      });
      root.appendChild(ac);
    }

    if (c) {
      var hc = el('div', 'ar-card'); hc.appendChild(el('h3', 'ar-h', '시장 체온 추이'));
      var btns = el('div', 'ar-btns'), chart = el('div', 'ar-chart');
      var ranges = [['1년', 250], ['5년', 0], ['전체', -1]];
      function draw(k) {
        var pts = c.hist;
        if (k === 250) pts = pts.slice(-250);
        else if (k === 0) { var cut = (parseInt(c.date.slice(0, 4), 10) - 5) + c.date.slice(4); pts = pts.filter(function (p) { return p[0] >= cut; }); }
        lineChart(chart, pts, { label: '시장 체온 추이' });
        Array.prototype.forEach.call(btns.children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.k == k)); });
      }
      ranges.forEach(function (r) { var b = el('button', 'ar-btn', r[0]); b.type = 'button'; b.dataset.k = r[1]; b.addEventListener('click', function () { draw(r[1]); }); btns.appendChild(b); });
      hc.appendChild(btns); hc.appendChild(chart);
      hc.appendChild(el('p', 'ar-note', '붉은 띠(80도 이상)는 과열, 푸른 띠(20도 이하)는 혹한 구간입니다. 1년 이전 구간은 주 1회 값으로 그렸습니다.'));
      root.appendChild(hc); draw(250);

      var cc = el('div', 'ar-card'); cc.appendChild(el('h3', 'ar-h', '체온을 만든 재료'));
      cc.appendChild(el('p', 'ar-sub', '각 자산이 자기 과거 20년과 견줘 얼마나 뜨거운지입니다. VIX와 원/달러 환율은 높을수록 불안 신호라 뒤집어(역) 반영합니다.'));
      c.components.forEach(function (k) {
        var r = el('div', 'ar-row'); r.appendChild(el('span', null, k.name + (k.sign < 0 ? ' (역)' : '')));
        var tr = el('div', 'ar-track'), d = el('div', 'ar-dot'); d.style.left = k.adj + '%'; d.style.background = tempColor(k.adj); tr.appendChild(d); r.appendChild(tr);
        var v = el('b', null, fmt(k.adj, 0)); v.style.textAlign = 'right'; r.appendChild(v); cc.appendChild(r);
      });
      root.appendChild(cc);
    }

    var gc = el('div', 'ar-card'); gc.appendChild(el('h3', 'ar-h', '자산별 한눈에'));
    gc.appendChild(el('p', 'ar-sub', '종가 기준 · 등락은 전일 / 1개월 / 연초 대비'));
    var grid = el('div', 'ar-grid');
    m.assets.forEach(function (a) {
      var pct = a.kind === 'price', u = pct ? '%' : (a.unit === '%' ? '%p' : ''), d = pct ? 2 : 2;
      var b = el('div', 'ar-a'); b.appendChild(el('b', null, a.name));
      b.appendChild(el('div', 'v', (a.unit === '$' ? '$' : '') + fmt(a.last, a.digits) + (a.unit && a.unit !== '$' && a.unit !== 'pt' ? a.unit : '')));
      var r = el('div', 'r');
      [['전일', a.d1], ['1개월', a.d20], ['연초', a.ytd]].forEach(function (x) { var s = el('span', cls(x[1]), x[0] + ' ' + signed(x[1], d, u)); r.appendChild(s); });
      b.appendChild(r);
      if (a.spark && a.spark.length > 2) b.appendChild(spark(a.spark, a.spark[a.spark.length - 1] >= a.spark[0]));
      var foot = el('div', 'r'); foot.style.marginTop = '6px';
      if (a.temp != null) { var ch = el('span', 'ar-chip', pct ? '온도 ' + fmt(a.temp, 0) + ' · ' + a.label : '과거 대비 높이 ' + fmt(a.temp, 0)); foot.appendChild(ch); }
      else foot.appendChild(el('span', 'ar-chip', '이력 10년 미만'));
      foot.appendChild(el('span', 'ar-mut', kdate(a.date).slice(5) + (a.stale ? ' (갱신 지연)' : '')));
      b.appendChild(foot); grid.appendChild(b);
    });
    gc.appendChild(grid); root.appendChild(gc);

    if (m.analogs && m.analogs.length) {
      var an = el('div', 'ar-card'); an.appendChild(el('h3', 'ar-h', '지금과 가장 닮은 과거'));
      an.appendChild(el('p', 'ar-sub', '자산별 온도 조합이 오늘과 가장 비슷했던 날들과, 그 뒤 실제로 벌어진 일입니다.'));
      var sc = el('div', 'ar-scroll'), t = el('table', 'ar-tbl'), hr = el('tr');
      ['닮은 날', '당시 체온', '코스피 1개월', '코스피 3개월', '코스피 6개월', 'S&P 3개월', 'S&P 6개월'].forEach(function (h) { hr.appendChild(el('th', null, h)); });
      t.appendChild(hr);
      m.analogs.forEach(function (r) {
        var tr = el('tr'); tr.appendChild(el('td', null, kdate(r.date))); tr.appendChild(el('td', null, fmt(r.composite, 1) + '도'));
        var k = r.after.kospi || {}, s = r.after.spx || {};
        [k['20'], k['60'], k['120'], s['60'], s['120']].forEach(function (v) { tr.appendChild(el('td', cls(v), v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 1) + '%')); });
        t.appendChild(tr);
      });
      sc.appendChild(t); an.appendChild(sc);
      an.appendChild(el('p', 'ar-note', '닮은 날은 다섯 개뿐이라 통계가 아니라 참고 사례입니다. 같은 온도에서도 결과는 크게 갈렸습니다.'));
      root.appendChild(an);
    }
    root.appendChild(el('p', 'ar-note', '자료: 네이버 금융, CBOE, 나스닥, 미 연준·재무부·에너지정보청, 코인베이스 · 계산: 에셋리포트 · 마지막 계산 ' + m.updated.replace('T', ' ').replace('Z', ' UTC') + ' · 투자 권유가 아니며 과거 통계는 미래를 보장하지 않습니다.'));
  }

  /* ---------- 투자 통계 연구소 ---------- */
  function renderEvents(root, data) {
    root.textContent = '';
    var listCard = el('div', 'ar-card'), detail = el('div');
    listCard.appendChild(el('h3', 'ar-h', '이런 날 이후, 시장은 어땠나'));
    listCard.appendChild(el('p', 'ar-sub', kdate(data.asof) + ' 기준 · 이벤트를 누르면 과거 모든 사례와 이후 수익률이 열립니다.'));
    var groups = [['전체', null]], seen = {};
    data.events.forEach(function (e) { if (!seen[e.source_name]) { seen[e.source_name] = 1; groups.push([e.source_name, e.source]); } });
    var btns = el('div', 'ar-btns'), grid = el('div', 'ar-evgrid');
    function list(src) {
      grid.textContent = '';
      data.events.filter(function (e) { return !src || e.source === src; }).sort(function (a, b) { return (b.active - a.active) || (a.last < b.last ? 1 : -1); }).forEach(function (e) {
        var b = el('button', 'ar-ev' + (e.active ? ' ar-on' : '')); b.type = 'button';
        var h = el('h4'); h.textContent = e.title + ' '; if (e.active) h.appendChild(el('span', 'ar-chip ar-live', '진행 중')); b.appendChild(h);
        var t = e.targets[0], s = t.stats['60'];
        b.appendChild(el('p', null, '과거 ' + e.n + '번 · 최근 ' + kdate(e.last) + (s ? ' · 3개월 뒤 ' + t.name + ' 중앙값 ' + (s.median > 0 ? '+' : '') + fmt(s.median, 1) + '%' : '')));
        b.addEventListener('click', function () { open(e.id, true); }); grid.appendChild(b);
      });
      Array.prototype.forEach.call(btns.children, function (x) { x.setAttribute('aria-pressed', String((x.dataset.s || '') === (src || ''))); });
    }
    groups.forEach(function (g) { var b = el('button', 'ar-btn', g[0]); b.type = 'button'; b.dataset.s = g[1] || ''; b.addEventListener('click', function () { list(g[1]); }); btns.appendChild(b); });
    listCard.appendChild(btns); listCard.appendChild(grid);
    root.appendChild(detail); root.appendChild(listCard); list(null);

    function open(id, scroll) {
      detail.textContent = ''; var c = el('div', 'ar-card'); c.appendChild(el('p', 'ar-sub', '불러오는 중…')); detail.appendChild(c);
      getJSON('/data/events/' + encodeURIComponent(id) + '.json').then(function (e) {
        try { history.replaceState(null, '', '#ev=' + id); } catch (x) { /* 무시 */ }
        c.textContent = '';
        var h = el('h3', 'ar-h'); h.textContent = e.title + ' '; if (e.active) h.appendChild(el('span', 'ar-chip ar-live', '진행 중')); c.appendChild(h);
        c.appendChild(el('p', 'ar-sub', e.desc + ' · ' + kdate(e.first) + ' 이후 ' + e.n + '번 · 가장 최근 ' + kdate(e.last) + ' · 같은 신호가 ' + e.cooldown + '거래일 안에 반복되면 한 번으로 셉니다.'));
        if (e.n < 10) c.appendChild(el('div', 'ar-warn', '사례가 ' + e.n + '번뿐입니다. 평균과 확률이 한두 번의 결과에 크게 흔들리니 숫자를 그대로 믿지 마세요.'));
        var body = el('div'); c.appendChild(body);
        var ti = 0, hz = 60;
        function draw() {
          body.textContent = '';
          var t = e.targets[ti];
          if (e.targets.length > 1) {
            var tb = el('div', 'ar-btns');
            e.targets.forEach(function (x, i) { var b = el('button', 'ar-btn', x.name + ' 기준'); b.type = 'button'; b.setAttribute('aria-pressed', String(i === ti)); b.addEventListener('click', function () { ti = i; draw(); }); tb.appendChild(b); });
            body.appendChild(tb);
          }
          var sc = el('div', 'ar-scroll'), tbl = el('table', 'ar-tbl'), hr = el('tr');
          ['이후 기간', '사례 수', '평균', '중앙값', '오른 비율', '최악', '최고', '평소 평균', '평소 오른 비율'].forEach(function (x) { hr.appendChild(el('th', null, x)); });
          tbl.appendChild(hr);
          e.horizons.forEach(function (H) {
            var s = t.stats[H], b = t.base[H], tr = el('tr'); tr.appendChild(el('td', null, HZ_NAME[H] + ' 뒤'));
            if (!s) { for (var i = 0; i < 8; i++) tr.appendChild(el('td', 'ar-mut', '–')); tbl.appendChild(tr); return; }
            function pc(v) { return (v > 0 ? '+' : '') + fmt(v, 1) + '%'; }
            tr.appendChild(el('td', null, s.n)); tr.appendChild(el('td', cls(s.mean), pc(s.mean)));
            var md = el('td', cls(s.median), pc(s.median)); md.style.fontWeight = '700'; tr.appendChild(md);
            tr.appendChild(el('td', null, fmt(s.win, 0) + '%')); tr.appendChild(el('td', cls(s.min), pc(s.min))); tr.appendChild(el('td', cls(s.max), pc(s.max)));
            tr.appendChild(el('td', 'ar-mut', b ? pc(b.mean) : '–')); tr.appendChild(el('td', 'ar-mut', b ? fmt(b.win, 0) + '%' : '–'));
            tbl.appendChild(tr);
          });
          sc.appendChild(tbl); body.appendChild(sc);
          body.appendChild(el('p', 'ar-note', '‘평소’는 같은 기간의 아무 날에 샀을 때의 결과입니다. 이벤트 뒤 숫자가 평소와 비슷하면 그 신호는 별 의미가 없다는 뜻입니다.'));

          var h2 = el('h3', 'ar-h', '사례별 분포 — ' + t.name); h2.style.marginTop = '16px'; body.appendChild(h2);
          var hb = el('div', 'ar-btns');
          e.horizons.forEach(function (H) { var b = el('button', 'ar-btn', HZ_NAME[H] + ' 뒤'); b.type = 'button'; b.setAttribute('aria-pressed', String(H === hz)); b.addEventListener('click', function () { hz = H; draw(); }); hb.appendChild(b); });
          body.appendChild(hb);
          var ch = el('div', 'ar-chart'); body.appendChild(ch);
          var col = e.horizons.indexOf(hz) + 1;
          if (t.stats[hz]) stripChart(ch, t.rows, col, t.stats[hz], t.base[hz]); else ch.appendChild(el('p', 'ar-sub', '아직 이 기간이 지난 사례가 없습니다.'));
          body.appendChild(el('p', 'ar-note', '점 하나가 사례 하나입니다. 회색 띠는 가운데 절반(25~75%)이 몰린 구간, 굵은 선은 중앙값, 점선은 평소 중앙값입니다.'));

          var h3 = el('h3', 'ar-h', '발생일 전체 기록'); h3.style.marginTop = '16px'; body.appendChild(h3);
          var sc2 = el('div', 'ar-scroll'), t2 = el('table', 'ar-tbl'), r0 = el('tr'); r0.appendChild(el('th', null, '발생일'));
          e.horizons.forEach(function (H) { r0.appendChild(el('th', null, HZ_NAME[H] + ' 뒤')); }); t2.appendChild(r0);
          var rows = t.rows.slice().reverse(), shown = 12;
          function fill() {
            while (t2.rows.length > 1) t2.deleteRow(1);
            rows.slice(0, shown).forEach(function (r) { var tr = el('tr'); tr.appendChild(el('td', null, kdate(r[0]))); for (var i = 1; i < r.length; i++) tr.appendChild(el('td', cls(r[i]), r[i] == null ? '진행 중' : (r[i] > 0 ? '+' : '') + fmt(r[i], 1) + '%')); t2.appendChild(tr); });
          }
          fill(); sc2.appendChild(t2); body.appendChild(sc2);
          if (rows.length > shown) { var more = el('button', 'ar-link', '나머지 ' + (rows.length - shown) + '건 모두 보기'); more.type = 'button'; more.style.marginTop = '8px'; more.addEventListener('click', function () { shown = rows.length; fill(); more.remove(); }); body.appendChild(more); }
        }
        draw();
        if (scroll && c.scrollIntoView) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }).catch(function (x) { fail(detail, x); });
    }
    var m = /ev=([a-z0-9_]+)/.exec(location.hash);
    var first = m && data.events.some(function (e) { return e.id === m[1]; }) ? m[1] : (data.events.filter(function (e) { return e.active; })[0] || data.events[0] || {}).id;
    if (first) open(first, false);
    root.appendChild(el('p', 'ar-note', '자료: 네이버 금융, CBOE, 나스닥, 미 연준·재무부·에너지정보청, 코인베이스 · 계산: 에셋리포트 · 수익률은 종가 기준 단순 수익률(배당·환율·세금 제외) · 투자 권유가 아니며 과거 통계는 미래를 보장하지 않습니다.'));
  }

  function boot() {
    if (!document.getElementById('ar-css')) { var st = document.createElement('style'); st.id = 'ar-css'; st.textContent = CSS; document.head.appendChild(st); }
    Array.prototype.forEach.call(document.querySelectorAll('[data-ar]'), function (root) {
      if (root.dataset.arDone) return; root.dataset.arDone = '1'; root.classList.add('ar-root');
      var kind = root.getAttribute('data-ar');
      root.textContent = ''; var c = el('div', 'ar-card'); c.appendChild(el('p', 'ar-sub', '최신 데이터를 불러오는 중…')); root.appendChild(c);
      if (kind === 'thermo') getJSON('/data/market.json').then(function (m) { renderThermo(root, m); }).catch(function (e) { fail(root, e); });
      else if (kind === 'events') getJSON('/data/events.json').then(function (d) { renderEvents(root, d); }).catch(function (e) { fail(root, e); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
