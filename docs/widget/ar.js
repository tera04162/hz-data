/* 에셋리포트 위젯 v2 — 시장체온계(thermo) · 투자 통계 연구소(events) · 종목 진단기(stocks)
   그리고 글 안에 넣는 단일 모드(event, signal, stock, mini, text). 의존성 없음.
   블로그 쪽에는 로더 한 줄만 있고, 화면과 계산 결과는 전부 이 저장소에서 나간다. */
(function () {
  'use strict';
  if (window.__AR_LOADED__) return;
  window.__AR_LOADED__ = true;

  var BASES = (window.AR_BASES || ['https://cdn.jsdelivr.net/gh/tera04162/hz-data@assetreport/docs', 'https://raw.githubusercontent.com/tera04162/hz-data/assetreport/docs']).map(function (b) { return b.replace(/\/$/, ''); });
  var HUB = window.AR_HUB || '/p/market-stats.html', THERMO = window.AR_THERMO || '/p/market-thermometer.html', STOCKS = window.AR_STOCKS || '/p/stock-check.html';
  var UP = '#e03131', DOWN = '#1c64f2', COLD = '#1d6fe0', HOT = '#e5383b', MID = '#8b8f97', INK = '#111827', MUT = '#5b6472', LINE = '#e5e7eb', OK = '#12805c';
  var HZ_NAME = { 5: '1주', 20: '1개월', 60: '3개월', 120: '6개월', 250: '1년' };
  var SRC = '자료: 네이버 금융·증권, CBOE, 나스닥, 미 연준·재무부, 코인베이스, Yahoo Finance(과거 이력) · 계산: 에셋리포트 · 투자 권유가 아니며 과거 통계는 미래를 보장하지 않습니다.';

  /* 블로그 테마가 제목·표·문단에 거는 스타일을 이 안에서는 전부 되돌린다 */
  var CSS = '.ar-root{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Malgun Gothic","Noto Sans KR",sans-serif!important;font-size:15px!important;line-height:1.55!important;color:' + INK + '!important;text-align:left;margin:18px 0;word-break:keep-all;font-variant-numeric:tabular-nums;letter-spacing:-.01em}' +
    '.ar-root *{box-sizing:border-box;font-family:inherit!important;line-height:inherit}' +
    '.ar-root p{margin:0 0 8px!important;padding:0!important;font-size:14px!important;line-height:1.6!important;color:' + INK + '}' +
    '.ar-root table{width:100%!important;border-collapse:collapse!important;border:0!important;margin:0!important;background:transparent!important}' +
    '.ar-root th,.ar-root td{border:0!important;border-bottom:1px solid ' + LINE + '!important;padding:9px 7px!important;font-size:13.5px!important;line-height:1.4!important;text-align:right;white-space:nowrap;background:#fff!important;color:' + INK + '}' +
    '.ar-root th{font-weight:600!important;font-size:12px!important;color:' + MUT + '!important;border-bottom:1px solid #cfd4dc!important;position:sticky;top:0;z-index:1}' +
    '.ar-root th:first-child,.ar-root td:first-child{text-align:left}.ar-root tr.ar-click{cursor:pointer}.ar-root tr.ar-click:hover td{background:#f5f7fa!important}.ar-root tr.ar-sel td{background:#eef4ff!important}' +
    '.ar-root a{color:' + INK + '!important;text-decoration:underline!important;text-underline-offset:2px;font-weight:600}' +
    '.ar-root ul{margin:0!important;padding:0!important;list-style:none!important}.ar-root li{margin:0 0 6px!important;padding:0!important;font-size:14px!important;line-height:1.5!important;list-style:none!important}' +
    '.ar-root button{font:inherit;line-height:1.3!important}' +
    '.ar-card{background:#fff;border:1px solid ' + LINE + ';border-radius:14px;padding:20px;margin:0 0 16px;box-shadow:0 1px 2px rgba(16,24,40,.04)}' +
    '.ar-h{font-size:18px;font-weight:800;margin:0 0 4px;color:' + INK + ';letter-spacing:-.02em;line-height:1.35!important}.ar-h2{font-size:15px;font-weight:700;margin:22px 0 8px}' +
    '.ar-sub{color:' + MUT + '!important;font-size:13px!important;margin:0 0 14px!important}.ar-note{font-size:12px!important;color:' + MUT + '!important;margin:10px 0 0!important}' +
    '.ar-brand{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 12px;font-size:12px;color:' + MUT + '}.ar-brand b{letter-spacing:.08em;color:' + INK + ';font-size:12px}.ar-live{display:inline-flex;align-items:center;gap:6px}.ar-live:before{content:"";width:7px;height:7px;border-radius:50%;background:' + OK + '}' +
    '.ar-hero{display:grid;grid-template-columns:minmax(220px,300px) 1fr;gap:24px;align-items:center}' +
    '.ar-big{font-size:68px;font-weight:800;line-height:1!important;letter-spacing:-.04em}.ar-big small{font-size:24px;font-weight:700;margin-left:2px}.ar-tag{display:inline-block;font-size:14px;font-weight:700;border-radius:999px;padding:4px 12px;margin-top:8px}' +
    '.ar-up{color:' + UP + '!important}.ar-dn{color:' + DOWN + '!important}.ar-mut{color:' + MUT + '!important}.ar-b{font-weight:700}' +
    '.ar-gauge{position:relative;height:44px;margin:12px 0 2px}.ar-gbar{position:absolute;left:0;right:0;top:12px;height:10px;border-radius:5px;background:linear-gradient(90deg,' + COLD + ',#9cc3f5 25%,#d9dce1 50%,#f3a5a6 75%,' + HOT + ')}' +
    '.ar-gpin{position:absolute;top:5px;width:4px;height:24px;margin-left:-2px;background:' + INK + ';border-radius:2px;box-shadow:0 0 0 2px #fff}.ar-glab{position:absolute;top:28px;font-size:11px;color:' + MUT + ';transform:translateX(-50%);white-space:nowrap}' +
    '.ar-chip{display:inline-block;font-size:12px;font-weight:700;border-radius:999px;padding:2px 9px;white-space:nowrap}' +
    '.ar-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:12px 0 0}.ar-kpi{border:1px solid ' + LINE + ';border-radius:10px;padding:10px 12px}.ar-kpi span{display:block;font-size:12px;color:' + MUT + '}.ar-kpi b{font-size:17px;font-weight:700}' +
    '.ar-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}.ar-btns{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}' +
    '.ar-btn{font-size:13px!important;padding:6px 13px;border-radius:999px;border:1px solid #cfd4dc;background:#fff;color:' + INK + ';cursor:pointer;font-weight:600}.ar-btn:hover{border-color:' + INK + '}.ar-btn[aria-pressed=true]{background:' + INK + ';color:#fff;border-color:' + INK + '}' +
    '.ar-chart{position:relative}.ar-chart svg{display:block;width:100%;height:auto;touch-action:pan-y}.ar-tip{position:absolute;pointer-events:none;background:' + INK + ';color:#fff;font-size:12px;padding:6px 9px;border-radius:7px;white-space:nowrap;transform:translate(-50%,-125%);z-index:5;display:none;line-height:1.4!important}' +
    '.ar-range{position:relative;height:6px;border-radius:3px;background:#e9ecf1;min-width:70px}.ar-range i{position:absolute;top:-3px;width:12px;height:12px;border-radius:50%;margin-left:-6px;background:' + INK + ';box-shadow:0 0 0 2px #fff}' +
    '.ar-row{display:grid;grid-template-columns:130px 1fr 78px;gap:12px;align-items:center;font-size:13.5px;padding:8px 0;border-bottom:1px solid ' + LINE + '}.ar-track{position:relative;height:8px;border-radius:4px;background:#eef0f4}.ar-dot{position:absolute;top:-4px;width:16px;height:16px;border-radius:50%;margin-left:-8px;box-shadow:0 0 0 2px #fff}.ar-dot2{position:absolute;top:-2px;width:12px;height:12px;border-radius:50%;margin-left:-6px;border:2px solid ' + INK + ';background:#fff}' +
    '.ar-alert{border-radius:10px;padding:10px 12px;margin:0 0 8px;font-size:14px;border-left:4px solid ' + HOT + ';background:#fff5f5}.ar-warn{background:#fff7e6;border:1px solid #f1d9a4;border-radius:10px;padding:9px 12px;font-size:13px;color:#6b4e00;margin:0 0 12px}' +
    '.ar-input{font:inherit;font-size:14px!important;padding:8px 12px;border:1px solid #cfd4dc;border-radius:10px;width:100%;max-width:280px;margin:0 0 12px}' +
    '.ar-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.ar-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:' + MUT + ';margin:6px 0 0}.ar-legend i{display:inline-block;width:14px;height:3px;border-radius:2px;vertical-align:middle;margin-right:5px}' +
    '@media(max-width:640px){.ar-card{padding:15px;border-radius:12px}.ar-hero{grid-template-columns:1fr;gap:12px}.ar-big{font-size:56px}.ar-two{grid-template-columns:1fr}.ar-row{grid-template-columns:100px 1fr 70px}.ar-h{font-size:17px}}';

  /* ---------- 기본 도구 ---------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function svg(tag, attrs) { var e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function fmt(v, d) { return v == null || isNaN(v) ? '–' : Number(v).toLocaleString('ko-KR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function pp(v, d) { return v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, d == null ? 1 : d) + '%'; }
  function arrow(v, d, unit) { if (v == null) return '–'; return (v > 0 ? '▲' : v < 0 ? '▼' : '') + fmt(Math.abs(v), d == null ? 2 : d) + (unit || ''); }
  function cls(v) { return v > 0 ? 'ar-up' : v < 0 ? 'ar-dn' : 'ar-mut'; }
  function kdate(s) { return s ? s.replace(/-/g, '.') : '–'; }
  function won(v) { return v == null ? '–' : fmt(v, 0) + '원'; }
  function eok(v) { if (v == null) return '–'; var a = Math.abs(v); return a >= 10000 ? fmt(v / 10000, a >= 100000 ? 0 : 1) + '조' : fmt(v, 0) + '억'; }
  function mix(a, b, p) { var o = '#'; for (var i = 1; i < 7; i += 2) { var x = parseInt(a.substr(i, 2), 16), y = parseInt(b.substr(i, 2), 16); o += ('0' + Math.round(x + (y - x) * p).toString(16)).slice(-2); } return o; }
  function tempColor(t) { return t < 50 ? mix(COLD, MID, t / 50) : mix(MID, HOT, (t - 50) / 50); }
  function tempBg(t) { return mix('#ffffff', tempColor(t), .16); }
  function tempInk(t) { return mix(tempColor(t), '#000000', .35); }
  function tempLabel(t) { return t < 20 ? '혹한' : t < 40 ? '쌀쌀' : t < 60 ? '평온' : t < 80 ? '따뜻' : '과열'; }
  function chip(t, text) { var c = el('span', 'ar-chip', text != null ? text : (t == null ? '–' : fmt(t, 0) + '도 ' + tempLabel(t))); if (t != null) { c.style.background = tempBg(t); c.style.color = tempInk(t); } else { c.style.background = '#f1f3f6'; c.style.color = MUT; } return c; }
  function tagChip(text, bg, fg) { var c = el('span', 'ar-chip', text); c.style.background = bg; c.style.color = fg; return c; }
  function h(text, sub) { var f = document.createDocumentFragment(); f.appendChild(el('div', 'ar-h', text)); if (sub) f.appendChild(el('p', 'ar-sub', sub)); return f; }
  function h2(text) { return el('div', 'ar-h2', text); }
  function card() { return el('div', 'ar-card'); }
  function note(t) { return el('p', 'ar-note', t); }
  function kpi(label, value, c) { var b = el('div', 'ar-kpi'); b.appendChild(el('span', null, label)); b.appendChild(el('b', c || null, value)); return b; }
  function goTo(node) { try { var y = node.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) - 70; window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' }); } catch (e) { node.scrollIntoView(); } }
  function setHash(v) { try { history.replaceState(null, '', '#' + v); } catch (e) { /* 무시 */ } }
  function table(head, rows) {
    var sc = el('div', 'ar-scroll'), t = el('table'), tr = el('tr');
    head.forEach(function (x) { tr.appendChild(el('th', null, x)); }); t.appendChild(tr);
    rows.forEach(function (r) { t.appendChild(r); }); sc.appendChild(t); return sc;
  }
  function row(cells, onclick) {
    var tr = el('tr'); if (onclick) { tr.className = 'ar-click'; tr.addEventListener('click', onclick); }
    cells.forEach(function (c) { var td = el('td'); if (c && c.nodeType) td.appendChild(c); else if (c && typeof c === 'object') { td.textContent = c.t; if (c.c) td.className = c.c; if (c.b) td.style.fontWeight = '700'; } else td.textContent = c == null ? '–' : c; tr.appendChild(td); });
    return tr;
  }
  function brand(name, date) { var b = el('div', 'ar-brand'); b.appendChild(el('b', null, 'ASSET REPORT · ' + name)); b.appendChild(el('span', 'ar-live', kdate(date) + ' 종가 기준 · 매일 자동 갱신')); return b; }
  function rangeBar(pos) { var r = el('div', 'ar-range'), i = el('i'); i.style.left = Math.max(0, Math.min(100, pos == null ? 50 : pos)) + '%'; r.appendChild(i); return r; }
  function fail(root, e) { root.textContent = ''; var c = card(); c.appendChild(el('p', 'ar-sub', '데이터를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.')); root.appendChild(c); if (window.console) console.warn('[AR]', e); }
  function shift(ds, days) { var t = new Date(ds + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + days); return t.toISOString().slice(0, 10); }
  function sma(v, n) { var out = [], s = 0; for (var i = 0; i < v.length; i++) { s += v[i]; if (i >= n) s -= v[i - n]; out.push(i >= n - 1 ? s / n : null); } return out; }
  /* 차트용 시계열은 최근 daily개만 매일 값이라, 이동평균은 그 구간에서만 낸다 */
  function maTail(v, n, daily) { var m = sma(v, n), cut = v.length - daily + n - 1; return m.map(function (x, i) { return i >= cut ? x : null; }); }

  /* ---------- 데이터 경로: 최신 데이터 커밋을 찾아 커밋 고정 CDN 주소에서 받는다 ---------- */
  var cache = {}, basesP = null;
  function resolveBases() {
    if (basesP) return basesP;
    var raw = BASES.filter(function (b) { return b.indexOf('raw.githubusercontent.com') >= 0; })[0];
    var cdn = BASES.filter(function (b) { return b.indexOf('@assetreport/') >= 0; })[0];
    if (!raw || !cdn) return (basesP = Promise.resolve(BASES));
    basesP = fetch(raw + '/data/version.json?v=' + Math.floor(Date.now() / 3e5)).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { if (!/^[0-9a-f]{40}$/.test(j.sha || '')) throw new Error('sha'); return [cdn.replace('@assetreport/', '@' + j.sha + '/')].concat(BASES); })
      .catch(function () { return BASES; });
    return basesP;
  }
  function getJSON(path) {
    if (cache[path]) return cache[path];
    return (cache[path] = resolveBases().then(function (bs) {
      function attempt(i) {
        var pinned = /@[0-9a-f]{40}\//.test(bs[i]);
        return fetch(bs[i] + path + (pinned ? '' : '?v=' + Math.floor(Date.now() / 1.08e7))).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
          .catch(function (e) { if (i + 1 < bs.length) return attempt(i + 1); throw e; });
      }
      return attempt(0);
    }));
  }
  function getLinks() { return getJSON('/data/links.json').catch(function () { return {}; }); }

  /* ---------- 시계열 차트: 기간 버튼 · 십자선 · 보조선 · 사건 표시 ---------- */
  function niceTicks(a, b, k) { var raw = (b - a) / k, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), nrm = raw / mag, st = (nrm < 1.5 ? 1 : nrm < 3 ? 2 : nrm < 7 ? 5 : 10) * mag, out = []; for (var x = Math.ceil(a / st) * st; x <= b; x += st) out.push(Math.round(x / st) * st); return out; }
  function chart(host, o) {
    // o: {d, v, digits, unit, name, color, lines:[{v,color,name}], marks:[날짜], markName, bands:[[lo,hi,color]], fixed:[min,max], ranges, def, h, label}
    host.textContent = '';
    var first = o.d[0], last = o.d[o.d.length - 1];
    var ranges = (o.ranges || [['3개월', 92], ['1년', 366], ['3년', 1096], ['10년', 3653], ['전체', 0]]).filter(function (r) { return !r[1] || shift(last, -r[1]) >= first; });
    var cur = Math.min(o.def == null ? 1 : o.def, ranges.length - 1), btns = el('div', 'ar-btns'), box = el('div', 'ar-chart');
    function draw() {
      var cut = ranges[cur][1] ? shift(last, -ranges[cur][1]) : '', i0 = 0;
      if (cut) { while (i0 < o.d.length - 2 && o.d[i0] < cut) i0++; }
      var D = o.d.slice(i0), V = o.v.slice(i0), n = D.length, narrow = (host.clientWidth || 720) < 560;
      var W = narrow ? 420 : 900, H = o.h ? (narrow ? Math.round(o.h * .78) : o.h) : (narrow ? 260 : 340), L = 8, R = narrow ? 54 : 64, T = 14, B = 26;
      var all = V.slice(); (o.lines || []).forEach(function (ln) { ln.v.slice(i0).forEach(function (x) { if (x != null) all.push(x); }); });
      var mn = o.fixed ? o.fixed[0] : Math.min.apply(null, all), mx = o.fixed ? o.fixed[1] : Math.max.apply(null, all);
      if (!o.fixed) { var pad = (mx - mn) * .07 || Math.abs(mx) * .05 || 1; mn -= pad; mx += pad; }
      var TS = D.map(function (x) { return Date.parse(x + 'T00:00:00Z'); }), t0 = TS[0], tspan = Math.max(1, TS[n - 1] - t0);
      var XT = function (ms) { return L + (ms - t0) / tspan * (W - L - R); }, X = function (i) { return XT(TS[i]); }, Y = function (v) { return T + (mx - v) / (mx - mn) * (H - T - B); };
      var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.label || '시계열 차트' });
      (o.bands || []).forEach(function (b) { s.appendChild(svg('rect', { x: L, y: Y(b[1]), width: W - L - R, height: Y(b[0]) - Y(b[1]), fill: b[2], opacity: .09 })); });
      var span = mx - mn, td = o.fixed ? 0 : span < 2 ? 2 : span < 20 ? 1 : 0;
      (o.fixed ? [0, 20, 50, 80, 100] : niceTicks(mn, mx, narrow ? 4 : 5)).forEach(function (g) {
        if (g < mn || g > mx) return;
        s.appendChild(svg('line', { x1: L, x2: W - R, y1: Y(g), y2: Y(g), stroke: '#eceef2', 'stroke-width': 1 }));
        var t = svg('text', { x: W - R + 6, y: Y(g) + 4, 'font-size': 11.5, fill: MUT }); t.textContent = fmt(g, td); s.appendChild(t);
      });
      var months = tspan / 2.63e9, maxT = narrow ? 4 : 7, y0 = +D[0].slice(0, 4), m0 = +D[0].slice(5, 7), ms1, lab;
      if (months > 30) { var ys = Math.ceil(months / 12 / maxT); for (var yy = y0 + 1; ; yy += ys) { ms1 = Date.UTC(yy, 0, 1); if (ms1 > TS[n - 1]) break; xl(ms1, String(yy)); } }
      else { var mstep = Math.max(1, Math.ceil(months / maxT)); for (var k = 1; ; k += mstep) { ms1 = Date.UTC(y0, m0 - 1 + k, 1); if (ms1 > TS[n - 1]) break; var dd = new Date(ms1); xl(ms1, String(dd.getUTCFullYear()).slice(2) + '.' + ('0' + (dd.getUTCMonth() + 1)).slice(-2)); } }
      function xl(ms, text) { s.appendChild(svg('line', { x1: XT(ms), x2: XT(ms), y1: H - B, y2: H - B + 4, stroke: '#cfd4dc', 'stroke-width': 1 })); var tx = svg('text', { x: XT(ms), y: H - 7, 'text-anchor': 'middle', 'font-size': 11.5, fill: MUT }); tx.textContent = text; s.appendChild(tx); }
      (o.lines || []).forEach(function (ln) {
        var p = '', pen = false; ln.v.slice(i0).forEach(function (x, i) { if (x == null) { pen = false; return; } p += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x).toFixed(1); pen = true; });
        if (p) s.appendChild(svg('path', { d: p, fill: 'none', stroke: ln.color, 'stroke-width': 1.5 }));
      });
      var path = ''; V.forEach(function (x, i) { path += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x).toFixed(1); });
      if (!o.fixed) s.appendChild(svg('path', { d: path + 'L' + X(n - 1).toFixed(1) + ' ' + (H - B) + 'L' + X(0).toFixed(1) + ' ' + (H - B) + 'Z', fill: o.color || INK, opacity: .05 }));
      s.appendChild(svg('path', { d: path, fill: 'none', stroke: o.color || INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
      (o.marks || []).forEach(function (md) {
        if (md < D[0]) return; var j = 0; while (j < n - 1 && D[j] < md) j++;
        s.appendChild(svg('circle', { cx: X(j), cy: Y(V[j]), r: narrow ? 4 : 5, fill: HOT, stroke: '#fff', 'stroke-width': 1.5 }));
      });
      var lv = V[n - 1];
      s.appendChild(svg('circle', { cx: X(n - 1), cy: Y(lv), r: 5, fill: o.fixed ? tempColor(lv) : (o.color || INK), stroke: '#fff', 'stroke-width': 2 }));
      var cross = svg('line', { y1: T, y2: H - B, stroke: MUT, 'stroke-width': 1, opacity: 0 }), dot = svg('circle', { r: 5, fill: o.color || INK, stroke: '#fff', 'stroke-width': 2, opacity: 0 });
      s.appendChild(cross); s.appendChild(dot);
      box.textContent = ''; var tip = el('div', 'ar-tip'); box.appendChild(s); box.appendChild(tip);
      function move(ev) {
        var b = s.getBoundingClientRect(), cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - b.left;
        var ms = t0 + (cx / b.width * W - L) / (W - L - R) * tspan, lo = 0, hi = n - 1; while (hi - lo > 1) { var md = (lo + hi) >> 1; if (TS[md] < ms) lo = md; else hi = md; } var i = Math.abs(TS[lo] - ms) <= Math.abs(TS[hi] - ms) ? lo : hi;
        cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('opacity', 1); dot.setAttribute('cx', X(i)); dot.setAttribute('cy', Y(V[i])); dot.setAttribute('opacity', 1);
        var txt = kdate(D[i]) + ' · ' + fmt(V[i], o.digits) + (o.unit || '');
        (o.lines || []).forEach(function (ln) { var x = ln.v[i0 + i]; if (x != null && ln.name) txt += ' · ' + ln.name + ' ' + fmt(x, o.digits); });
        tip.textContent = txt; tip.style.display = 'block'; tip.style.left = Math.max(90, Math.min(b.width - 90, X(i) / W * b.width)) + 'px'; tip.style.top = Math.max(34, Y(V[i]) / H * b.height) + 'px';
      }
      function leave() { cross.setAttribute('opacity', 0); dot.setAttribute('opacity', 0); tip.style.display = 'none'; }
      s.addEventListener('mousemove', move); s.addEventListener('touchstart', move, { passive: true }); s.addEventListener('touchmove', move, { passive: true }); s.addEventListener('mouseleave', leave); s.addEventListener('touchend', leave);
      Array.prototype.forEach.call(btns.children, function (b, i) { b.setAttribute('aria-pressed', String(i === cur)); });
    }
    ranges.forEach(function (r, i) { var b = el('button', 'ar-btn', r[0]); b.type = 'button'; b.addEventListener('click', function () { cur = i; draw(); }); btns.appendChild(b); });
    host.appendChild(btns); host.appendChild(box);
    var lg = [[o.color || INK, o.name]].concat((o.lines || []).map(function (l) { return [l.color, l.name]; })).filter(function (x) { return x[1]; });
    if (lg.length > 1 || (o.marks && o.marks.length)) {
      var legend = el('div', 'ar-legend');
      lg.forEach(function (x) { var sp = el('span'), i = el('i'); i.style.background = x[0]; sp.appendChild(i); sp.appendChild(document.createTextNode(x[1])); legend.appendChild(sp); });
      if (o.marks && o.marks.length) { var sp = el('span'), i = el('i'); i.style.cssText = 'width:9px;height:9px;border-radius:50%;background:' + HOT; sp.appendChild(i); sp.appendChild(document.createTextNode(o.markName || '신호 발생일')); legend.appendChild(sp); }
      host.appendChild(legend);
    }
    draw();
  }

  /* 막대 차트(실적) */
  function bars(host, labels, vals, est, fmtv) {
    host.textContent = '';
    var W = 420, H = 190, L = 6, R = 6, T = 22, B = 24, n = vals.length, nums = vals.filter(function (x) { return x != null; });
    if (!nums.length) { host.appendChild(el('p', 'ar-sub', '자료 없음')); return; }
    var mx = Math.max.apply(null, nums.concat([0])), mn = Math.min.apply(null, nums.concat([0])), span = mx - mn || 1;
    var Y = function (v) { return T + (mx - v) / span * (H - T - B - (mn < 0 ? 14 : 0)); }, bw = (W - L - R) / n * .6;
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
    s.appendChild(svg('line', { x1: L, x2: W - R, y1: Y(0), y2: Y(0), stroke: '#cfd4dc', 'stroke-width': 1 }));
    vals.forEach(function (v, i) {
      var cx = L + (i + .5) * (W - L - R) / n;
      var t = svg('text', { x: cx, y: H - 7, 'text-anchor': 'middle', 'font-size': 11.5, fill: MUT }); t.textContent = labels[i] + (est[i] ? ' 예상' : ''); s.appendChild(t);
      if (v == null) return;
      var y0 = Y(Math.max(v, 0)), hh = Math.max(2, Math.abs(Y(v) - Y(0)));
      s.appendChild(svg('rect', { x: cx - bw / 2, y: y0, width: bw, height: hh, rx: 4, fill: v >= 0 ? INK : DOWN, opacity: est[i] ? .3 : .88 }));
      var tv = svg('text', { x: cx, y: (v >= 0 ? y0 - 6 : y0 + hh + 13), 'text-anchor': 'middle', 'font-size': 11.5, 'font-weight': 700, fill: INK }); tv.textContent = fmtv(v); s.appendChild(tv);
    });
    host.appendChild(s);
  }
  function flowBars(host, flows) {
    host.textContent = ''; if (!flows || !flows.length) return;
    var W = 420, H = 232, n = flows.length, mx = 1; flows.forEach(function (f) { mx = Math.max(mx, Math.abs(f[1]), Math.abs(f[2])); });
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': '일별 순매수' });
    [['외국인', 1, 62], ['기관', 2, 166]].forEach(function (g) {
      var t = svg('text', { x: 0, y: g[2] - 48, 'font-size': 11.5, 'font-weight': 700, fill: INK }); t.textContent = g[0]; s.appendChild(t);
      s.appendChild(svg('line', { x1: 0, x2: W, y1: g[2], y2: g[2], stroke: '#cfd4dc', 'stroke-width': 1 }));
      flows.forEach(function (f, i) { var v = f[g[1]], hh = Math.abs(v) / mx * 44, bw = W / n * .7, x = i * W / n + W / n * .15; s.appendChild(svg('rect', { x: x, y: v >= 0 ? g[2] - hh : g[2], width: bw, height: Math.max(1, hh), rx: 2, fill: v >= 0 ? UP : DOWN })); });
    });
    var a = svg('text', { x: 0, y: H - 2, 'font-size': 11, fill: MUT }); a.textContent = kdate(flows[0][0]).slice(5); s.appendChild(a);
    var b = svg('text', { x: W, y: H - 2, 'text-anchor': 'end', 'font-size': 11, fill: MUT }); b.textContent = kdate(flows[n - 1][0]).slice(5); s.appendChild(b);
    host.appendChild(s);
  }
  function strip(host, rows, col, st, base) {
    host.textContent = '';
    var xs = rows.filter(function (r) { return r[col] != null; });
    if (!xs.length) { host.appendChild(el('p', 'ar-sub', '아직 이 기간이 지난 사례가 없습니다.')); return; }
    var narrow = (host.clientWidth || 720) < 560, W = narrow ? 420 : 900, H = 124, L = 14, R = 14, mid = 54;
    var lim = Math.max(5, Math.ceil(Math.max(Math.abs(st.min), Math.abs(st.max)) / 5) * 5), x = function (v) { return L + (v + lim) / (2 * lim) * (W - L - R); };
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': '사례별 이후 수익률 분포' });
    (narrow ? [-lim, 0, lim] : [-lim, -lim / 2, 0, lim / 2, lim]).forEach(function (g) {
      s.appendChild(svg('line', { x1: x(g), x2: x(g), y1: mid - 30, y2: mid + 30, stroke: g === 0 ? MUT : '#eceef2', 'stroke-width': 1 }));
      var t = svg('text', { x: x(g), y: H - 24, 'text-anchor': 'middle', 'font-size': 11.5, fill: MUT }); t.textContent = (g > 0 ? '+' : '') + g + '%'; s.appendChild(t);
    });
    s.appendChild(svg('rect', { x: x(st.p25), y: mid - 15, width: Math.max(1, x(st.p75) - x(st.p25)), height: 30, rx: 5, fill: INK, opacity: .08 }));
    var tip = el('div', 'ar-tip');
    xs.forEach(function (r, i) {
      var jit = ((i * 37) % 21 - 10) * 1.6, c = svg('circle', { cx: x(r[col]), cy: mid + jit, r: 5, fill: r[col] >= 0 ? UP : DOWN, opacity: .75, stroke: '#fff', 'stroke-width': 1.5 });
      c.addEventListener('mouseenter', function () { var b = s.getBoundingClientRect(); tip.textContent = kdate(r[0]) + ' 발생 → ' + pp(r[col], 2); tip.style.display = 'block'; tip.style.left = (x(r[col]) / W * b.width) + 'px'; tip.style.top = ((mid + jit) / H * b.height) + 'px'; });
      c.addEventListener('mouseleave', function () { tip.style.display = 'none'; }); s.appendChild(c);
    });
    s.appendChild(svg('line', { x1: x(st.median), x2: x(st.median), y1: mid - 36, y2: mid + 36, stroke: INK, 'stroke-width': 2 }));
    var t1 = svg('text', { x: x(st.median), y: 11, 'text-anchor': 'middle', 'font-size': 11.5, 'font-weight': 700, fill: INK }); t1.textContent = '중앙값 ' + pp(st.median); s.appendChild(t1);
    if (base) { s.appendChild(svg('line', { x1: x(base.median), x2: x(base.median), y1: mid - 30, y2: mid + 30, stroke: MUT, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' })); var t2 = svg('text', { x: x(base.median), y: H - 7, 'text-anchor': 'middle', 'font-size': 11.5, fill: MUT }); t2.textContent = '평소 ' + pp(base.median); s.appendChild(t2); }
    var box = el('div', 'ar-chart'); box.appendChild(s); box.appendChild(tip); host.appendChild(box);
  }

  /* ================= 시장체온계 ================= */
  function renderThermo(root, m) {
    root.textContent = '';
    var c = m.composite, detail = el('div');
    if (c) {
      var hero = card(); hero.appendChild(brand('시장체온계', c.date));
      var g = el('div', 'ar-hero'), left = el('div'), right = el('div');
      var big = el('div', 'ar-big'); big.style.color = tempInk(c.value); big.appendChild(document.createTextNode(fmt(c.value, 1))); big.appendChild(el('small', null, '도')); left.appendChild(big);
      var tg = el('span', 'ar-tag', c.label + ' 구간'); tg.style.background = tempBg(c.value); tg.style.color = tempInk(c.value); left.appendChild(tg);
      var meta = el('p'); meta.style.cssText = 'margin:10px 0 0!important;font-size:13px!important;color:' + MUT;
      meta.appendChild(document.createTextNode('1주 전보다 ')); meta.appendChild(el('b', cls(c.chg5), arrow(c.chg5, 1, '도'))); meta.appendChild(document.createTextNode(' · 1개월 전보다 ')); meta.appendChild(el('b', cls(c.chg20), arrow(c.chg20, 1, '도')));
      left.appendChild(meta);
      var gg = el('div', 'ar-gauge'); gg.appendChild(el('div', 'ar-gbar')); var pin = el('div', 'ar-gpin'); pin.style.left = c.value + '%'; gg.appendChild(pin);
      [['혹한', 10], ['쌀쌀', 30], ['평온', 50], ['따뜻', 70], ['과열', 90]].forEach(function (l) { var s = el('span', 'ar-glab', l[0]); s.style.left = l[1] + '%'; gg.appendChild(s); }); left.appendChild(gg);
      (m.headline || []).forEach(function (t, i) { var p = el('p', null, t); p.style.cssText = 'font-size:' + (i ? 15 : 17) + 'px!important;font-weight:' + (i ? 500 : 700) + ';margin:0 0 6px!important'; right.appendChild(p); });
      var k = el('div', 'ar-kpis');
      var k1 = kpi('단기 체온 · 요즘 열기', fmt(c.value, 0) + '도 · ' + c.label); k1.lastChild.style.color = tempInk(c.value); k.appendChild(k1);
      if (c.long != null) { var k2 = kpi('장기 온도 · 3년 흐름', fmt(c.long, 0) + '도 · ' + tempLabel(c.long)); k2.lastChild.style.color = tempInk(c.long); k.appendChild(k2); }
      if (c.pct != null) k.appendChild(kpi('지난 20년 중', '하위 ' + fmt(c.pct, 0) + '%'));
      right.appendChild(k); g.appendChild(left); g.appendChild(right); hero.appendChild(g);
      if (m.brief && m.brief.length > 1) {
        var bl = el('ul'); bl.style.cssText = 'margin:16px 0 0!important;padding:14px 0 0!important;border-top:1px solid ' + LINE + ';display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:6px 18px';
        m.brief.slice(1).forEach(function (x) { var li = el('li'), sig = /^신호/.test(x), up = /오른|최고가/.test(x), dn = /내린|최저가/.test(x); var d = el('b', null, sig ? '● ' : up ? '▲ ' : dn ? '▼ ' : '· '); d.style.color = sig ? HOT : up ? UP : dn ? DOWN : MUT; li.appendChild(d); li.appendChild(document.createTextNode(x.replace(/^신호 발생: /, '신호: '))); bl.appendChild(li); });
        hero.appendChild(bl);
      }
      hero.appendChild(note('단기 체온은 요즘 얼마나 달아올랐는지(200일선 대비 위치와 최근 석 달 변화)를, 장기 온도는 3년에 걸쳐 얼마나 올라와 있는지를 각 자산의 지난 20년과 견준 값입니다. 둘 다 주가가 비싼지 싼지(밸류에이션)를 재는 숫자는 아닙니다.'));
      root.appendChild(hero);
    }
    (m.active || []).forEach(function (e) {
      var a = el('div', 'ar-alert'), lk = el('a', null, e.title); lk.href = HUB + '#ev=' + e.id; a.appendChild(el('b', null, kdate(e.date).slice(5) + ' 신호 · ')); a.appendChild(lk);
      if (e.s60) a.appendChild(document.createTextNode(' — 과거 ' + e.s60.n + '번, 3개월 뒤 ' + e.target + ' 중앙값 ' + pp(e.s60.median) + ', 오른 비율 ' + fmt(e.s60.win, 0) + '%' + (e.b60 ? ' (평소 ' + fmt(e.b60.win, 0) + '%)' : '')));
      root.appendChild(a);
    });

    var ac = card(); ac.appendChild(h('자산별 한눈에', '줄을 누르면 가격 추이 차트가 열립니다 · 등락은 가격이면 %, 금리·VIX면 포인트'));
    var rows = m.assets.map(function (a) {
      var p = a.kind === 'price', u = p ? '%' : '';
      var nm = el('span'); nm.appendChild(el('b', null, a.name.replace(/\(.*\)/, ''))); if (a.stale) nm.appendChild(el('span', 'ar-mut', ' ' + kdate(a.date).slice(5)));
      var price = (a.unit === '$' ? '$' : '') + fmt(a.last, a.digits) + (a.unit && a.unit !== '$' && a.unit !== 'pt' ? a.unit : '');
      var tr = row([nm, { t: price, b: 1 }, { t: arrow(a.d1, 2, u), c: cls(a.d1) }, { t: arrow(a.d20, p ? 1 : 2, u), c: cls(a.d20) }, { t: arrow(a.d250, p ? 1 : 2, u), c: cls(a.d250) }, rangeBar(a.pos52), chip(a.temp), chip(a.long, a.long == null ? '–' : fmt(a.long, 0) + '도'), { t: arrow(a.d5, p ? 1 : 2, u), c: cls(a.d5) }, { t: arrow(a.ytd, p ? 1 : 2, u), c: cls(a.ytd) }, { t: arrow(a.d750, p ? 0 : 2, u), c: cls(a.d750) }],
        function () { Array.prototype.forEach.call(tr.parentNode.children, function (x) { x.classList.remove('ar-sel'); }); tr.classList.add('ar-sel'); assetDetail(detail, a, true); });
      return tr;
    });
    ac.appendChild(table(['자산', '현재', '전일', '1개월', '1년', '52주 범위', '단기 체온', '장기 온도', '1주', '연초 이후', '3년'], rows));
    ac.appendChild(note('52주 범위의 점은 최근 1년 최저(왼쪽)와 최고(오른쪽) 사이 현재 위치입니다. 기록이 짧은 자산은 온도를 내지 않습니다.'));
    root.appendChild(ac); root.appendChild(detail);
    var firstA = m.assets.filter(function (a) { return a.id === 'kospi'; })[0] || m.assets[0]; if (firstA) assetDetail(detail, firstA, false);

    if (c) {
      var hc = card(); hc.appendChild(h('시장 체온 추이', '붉은 띠는 과열(80도 이상), 푸른 띠는 혹한(20도 이하) 구간입니다'));
      var ch = el('div'); hc.appendChild(ch); root.appendChild(hc);
      chart(ch, { d: c.hist.map(function (x) { return x[0]; }), v: c.hist.map(function (x) { return x[1]; }), digits: 1, unit: '도', fixed: [0, 100], bands: [[80, 100, HOT], [0, 20, COLD]], ranges: [['1년', 366], ['5년', 1827], ['전체', 0]], def: 1, h: 280, label: '시장 체온 추이' });

      var cc = card(); cc.appendChild(h('체온을 만든 재료', '색 점은 단기 체온, 테두리 점은 장기 온도, 오른쪽 숫자는 단기 / 장기입니다. (역)은 높을수록 불안 신호라 뒤집어 넣은 자산입니다.'));
      c.components.forEach(function (k) {
        var r = el('div', 'ar-row'); r.appendChild(el('span', 'ar-b', k.name + (k.sign < 0 ? ' (역)' : '')));
        var tr = el('div', 'ar-track'); if (k.long != null) { var d2 = el('div', 'ar-dot2'); d2.style.left = k.long + '%'; tr.appendChild(d2); }
        var d1 = el('div', 'ar-dot'); d1.style.left = k.adj + '%'; d1.style.background = tempColor(k.adj); tr.appendChild(d1); r.appendChild(tr);
        var v = el('span'); v.style.textAlign = 'right'; v.appendChild(el('b', null, fmt(k.adj, 0))); v.appendChild(el('span', 'ar-mut', ' / ' + (k.long == null ? '–' : fmt(k.long, 0)))); r.appendChild(v); cc.appendChild(r);
      });
      cc.appendChild(note('비중: VIX 20%, S&P 500 15%, 코스피 15%, 나스닥 10%, 하이일드 채권 10%, 원/달러 10%, 비트코인 10%, 코스닥 5%, 유가 5%.'));
      root.appendChild(cc);
    }
    if (m.bands && m.bands.length) {
      var bc = card(); bc.appendChild(h('체온별로 이후 코스피는 어땠나', '과거 모든 날을 그날의 체온으로 나눠, 그날 코스피를 샀다면 얻었을 결과입니다. 색칠된 줄이 지금 구간입니다.'));
      bc.appendChild(table(['체온 구간', '해당 일수', '3개월 뒤 중앙값', '오른 비율', '1년 뒤 중앙값', '오른 비율', '1년 뒤 최악'], m.bands.map(function (r) {
        var k = (r.after || {}).kospi || {}, a = k['60'], y = k['250'];
        var tr = row([chip((r.lo + r.hi) / 2, r.name + ' ' + r.lo + '~' + r.hi + '도'), fmt(r.days, 0) + '일', { t: a ? pp(a.median) : '–', c: a ? cls(a.median) : '', b: 1 }, a ? fmt(a.win, 0) + '%' : '–', { t: y ? pp(y.median) : '–', c: y ? cls(y.median) : '', b: 1 }, y ? fmt(y.win, 0) + '%' : '–', { t: y ? pp(y.min) : '–', c: y ? cls(y.min) : '' }]);
        if (r.now) tr.className = 'ar-sel'; return tr;
      })));
      bc.appendChild(note('하루씩 밀어 가며 센 값이라 기간이 서로 겹칩니다. 구간 사이의 차이를 보는 용도이고, 어느 구간에서든 큰 손실은 있었습니다.'));
      root.appendChild(bc);
    }
    if (m.analogs && m.analogs.length) {
      var an = card(); an.appendChild(h('지금과 가장 닮은 과거', '자산별 온도 조합이 오늘과 가장 비슷했던 날들과 그 뒤 실제 수익률'));
      an.appendChild(table(['닮은 날', '당시 체온', '코스피 1개월', '코스피 3개월', '코스피 6개월', 'S&P 3개월', 'S&P 6개월'], m.analogs.map(function (r) {
        var k = r.after.kospi || {}, s = r.after.spx || {};
        return row([{ t: kdate(r.date), b: 1 }, chip(r.composite, fmt(r.composite, 1) + '도')].concat([k['20'], k['60'], k['120'], s['60'], s['120']].map(function (v) { return { t: pp(v), c: cls(v) }; })));
      })));
      an.appendChild(note('닮은 날은 다섯 개뿐이라 통계가 아니라 참고 사례입니다.'));
      root.appendChild(an);
    }
    root.appendChild(note(SRC));
  }
  function assetDetail(host, a, scroll) {
    host.textContent = ''; var c = card(); c.appendChild(el('p', 'ar-sub', '불러오는 중…')); host.appendChild(c);
    if (scroll) goTo(host);
    getJSON('/data/series/' + a.id + '.json').then(function (s) {
      c.textContent = ''; var p = a.kind === 'price', u = a.unit === 'pt' || a.unit === '$' ? '' : a.unit;
      var top = el('div'); top.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin:0 0 12px';
      var l = el('div'); l.appendChild(el('div', 'ar-h', a.name + ' 추이')); l.appendChild(el('span', 'ar-mut', kdate(s.d[0]) + ' ~ ' + kdate(a.date))); top.appendChild(l);
      var r = el('div'); r.style.textAlign = 'right'; var pr = el('div', null, (a.unit === '$' ? '$' : '') + fmt(a.last, a.digits) + u); pr.style.cssText = 'font-size:28px;font-weight:800;line-height:1.1'; r.appendChild(pr); r.appendChild(el('b', cls(a.d1), '전일 ' + arrow(a.d1, 2, p ? '%' : ''))); top.appendChild(r); c.appendChild(top);
      var ch = el('div'); c.appendChild(ch);
      chart(ch, { d: s.d, v: s.v, digits: a.digits, unit: u, name: a.name, lines: p ? [{ v: maTail(s.v, 200, 520), color: '#f08c00', name: '200일선' }] : [], def: 1, h: 360, label: a.name + ' 추이' });
      var k = el('div', 'ar-kpis');
      k.appendChild(kpi('52주 최고', fmt(a.hi52, a.digits))); k.appendChild(kpi('52주 최저', fmt(a.lo52, a.digits)));
      k.appendChild(kpi('52주 고점 대비', p ? pp(a.from_hi) : arrow(a.from_hi, 2), cls(a.from_hi)));
      if (a.ma200_gap != null) k.appendChild(kpi('200일선 대비', pp(a.ma200_gap), cls(a.ma200_gap)));
      [['3개월', a.d60, 1], ['1년', a.d250, 1], ['3년', a.d750, 0], ['5년', a.d1250, 0]].forEach(function (x) { k.appendChild(kpi(x[0], p ? pp(x[1], x[2]) : arrow(x[1], 2), cls(x[1]))); });
      if (a.temp != null) { var kt = kpi('단기 체온', fmt(a.temp, 0) + '도 · ' + tempLabel(a.temp)); kt.lastChild.style.color = tempInk(a.temp); k.appendChild(kt); }
      if (a.long != null) { var kl = kpi('장기 온도', fmt(a.long, 0) + '도 · ' + tempLabel(a.long)); kl.lastChild.style.color = tempInk(a.long); k.appendChild(kl); }
      c.appendChild(k);
    }).catch(function (e) { fail(host, e); });
  }

  /* ================= 투자 통계 연구소 ================= */
  function eventDetail(host, id, opt) {
    opt = opt || {}; host.textContent = ''; var c = card(); c.appendChild(el('p', 'ar-sub', '불러오는 중…')); host.appendChild(c);
    if (opt.scroll) goTo(host);
    getJSON('/data/events/' + encodeURIComponent(id) + '.json').then(function (e) {
      return getJSON('/data/series/' + e.source + '.json').catch(function () { return null; }).then(function (ser) { return [e, ser]; });
    }).then(function (r) {
      var e = r[0], ser = r[1]; if (opt.hash) setHash('ev=' + id);
      c.textContent = ''; c.appendChild(brand('투자 통계 연구소', ser ? ser.d[ser.d.length - 1] : e.last));
      c.appendChild(h(e.title, e.desc + ' · ' + kdate(e.first) + ' 이후 ' + e.n + '번 · 가장 최근 ' + kdate(e.last)));
      if (e.active) { var a = el('div', 'ar-alert'); a.textContent = kdate(e.last) + '에 이 조건이 충족됐습니다. 아래 통계에서 가장 새 사례이고, 이후 수익률은 아직 진행 중입니다.'; c.appendChild(a); }
      if (e.n < 10) c.appendChild(el('div', 'ar-warn', '사례가 ' + e.n + '번뿐입니다. 평균과 확률이 한두 번의 결과에 크게 흔들리니 참고만 하세요.'));
      if (ser) { c.appendChild(h2(e.source_name + ' 추이와 신호 발생일')); var ch = el('div'); c.appendChild(ch); chart(ch, { d: ser.d, v: ser.v, digits: ser.digits, name: e.source_name, marks: e.targets[0].rows.map(function (x) { return x[0]; }), def: 2, h: 360, label: e.source_name + ' 추이' }); }
      var body = el('div'); c.appendChild(body); var ti = 0, hz = 60;
      function draw() {
        body.textContent = ''; var t = e.targets[ti];
        body.appendChild(h2('신호 이후 ' + t.name + ' 수익률'));
        if (e.targets.length > 1) { var tb = el('div', 'ar-btns'); e.targets.forEach(function (x, i) { var b = el('button', 'ar-btn', x.name + ' 기준'); b.type = 'button'; b.setAttribute('aria-pressed', String(i === ti)); b.addEventListener('click', function () { ti = i; draw(); }); tb.appendChild(b); }); body.appendChild(tb); }
        body.appendChild(table(['이후 기간', '사례', '중앙값', '오른 비율', '평소 오른 비율', '차이', '최악', '최고'], e.horizons.map(function (H) {
          var s = t.stats[H], b = t.base[H]; if (!s) return row([{ t: HZ_NAME[H] + ' 뒤', b: 1 }, '–', '–', '–', '–', '–', '–', '–']);
          var dw = b ? Math.round(s.win) - Math.round(b.win) : null;
          return row([{ t: HZ_NAME[H] + ' 뒤', b: 1 }, s.n, { t: pp(s.median), c: cls(s.median), b: 1 }, { t: fmt(s.win, 0) + '%', b: 1 }, { t: b ? fmt(b.win, 0) + '%' : '–', c: 'ar-mut' }, { t: dw == null ? '–' : (dw > 0 ? '+' : '') + dw + '%p', c: cls(dw), b: 1 }, { t: pp(s.min), c: cls(s.min) }, { t: pp(s.max), c: cls(s.max) }]);
        })));
        body.appendChild(note('‘평소’는 같은 기간의 아무 날에 샀을 때입니다. 차이가 0에 가까우면 이 신호는 이후 방향에 대해 알려 주는 것이 없다는 뜻입니다.'));
        body.appendChild(h2('사례별 분포'));
        var hb = el('div', 'ar-btns'); e.horizons.forEach(function (H) { var b = el('button', 'ar-btn', HZ_NAME[H] + ' 뒤'); b.type = 'button'; b.setAttribute('aria-pressed', String(H === hz)); b.addEventListener('click', function () { hz = H; draw(); }); hb.appendChild(b); }); body.appendChild(hb);
        var st = el('div'); body.appendChild(st);
        if (t.stats[hz]) strip(st, t.rows, e.horizons.indexOf(hz) + 1, t.stats[hz], t.base[hz]); else st.appendChild(el('p', 'ar-sub', '아직 이 기간이 지난 사례가 없습니다.'));
        body.appendChild(note('점 하나가 사례 하나, 회색 띠는 가운데 절반이 몰린 구간, 굵은 선은 중앙값, 점선은 평소 중앙값입니다.'));
        body.appendChild(h2('발생일 기록'));
        var rows = t.rows.slice().reverse(), shown = 10, holder = el('div'); body.appendChild(holder);
        function fill() { holder.textContent = ''; holder.appendChild(table(['발생일'].concat(e.horizons.map(function (H) { return HZ_NAME[H] + ' 뒤'; })), rows.slice(0, shown).map(function (r) { return row([{ t: kdate(r[0]), b: 1 }].concat(r.slice(1).map(function (v) { return v == null ? { t: '진행 중', c: 'ar-mut' } : { t: pp(v), c: cls(v) }; }))); }))); if (rows.length > shown) { var more = el('button', 'ar-btn', '나머지 ' + (rows.length - shown) + '건 보기'); more.type = 'button'; more.style.marginTop = '10px'; more.addEventListener('click', function () { shown = rows.length; fill(); }); holder.appendChild(more); } }
        fill();
      }
      draw();
      if (opt.link) { var lk = el('a', null, '이 통계를 풀어 쓴 글 읽기'); lk.href = opt.link; lk.style.cssText = 'display:inline-block;margin-top:14px'; c.appendChild(lk); }
    }).catch(function (x) { fail(host, x); });
  }
  function renderEvents(root, data, links) {
    root.textContent = ''; links = links || {};
    var detail = el('div');
    function open(id, scroll) { eventDetail(detail, id, { scroll: scroll, hash: true, link: links[id] }); }
    var top = card(); top.appendChild(brand('투자 통계 연구소', data.asof));
    var act = data.events.filter(function (e) { return e.active; });
    top.appendChild(h('최근 발생한 신호', act.length ? '최근 5거래일 안에 조건이 충족된 이벤트입니다. 누르면 가격 차트와 과거 전 사례가 열립니다.' : '최근 5거래일 안에 새로 발생한 신호가 없습니다.'));
    act.forEach(function (e) {
      var t = e.targets[0], s = t.stats['60'], b = t.base['60'], a = el('div', 'ar-alert'); a.style.cursor = 'pointer';
      a.appendChild(el('b', null, kdate(e.last).slice(5) + ' 발생 · ' + e.title));
      if (s) a.appendChild(document.createTextNode(' — 과거 ' + e.n + '번, 3개월 뒤 ' + t.name + ' 중앙값 ' + pp(s.median) + ', 오른 비율 ' + fmt(s.win, 0) + '%' + (b ? ' (평소 ' + fmt(b.win, 0) + '%)' : '')));
      a.addEventListener('click', function () { open(e.id, true); }); top.appendChild(a);
    });
    root.appendChild(top);
    var lc = card(); lc.appendChild(h('이런 날 이후, 시장은 어땠나', '이벤트 ' + data.events.length + '종 · 줄을 누르면 가격 차트 위에 발생일이 찍히고 전 사례가 열립니다'));
    var groups = [['전체', '']], seen = {}; data.events.forEach(function (e) { if (!seen[e.source]) { seen[e.source] = 1; groups.push([e.source_name, e.source]); } });
    var btns = el('div', 'ar-btns'), holder = el('div'), curSrc = '';
    function list() {
      holder.textContent = '';
      var evs = data.events.filter(function (e) { return !curSrc || e.source === curSrc; }).sort(function (a, b) { return (b.active - a.active) || (a.last < b.last ? 1 : -1); });
      holder.appendChild(table(['이벤트', '횟수', '최근 발생', '3개월 뒤 중앙값', '오른 비율', '평소', '차이'], evs.map(function (e) {
        var t = e.targets[0], s = t.stats['60'], b = t.base['60'], dw = s && b ? Math.round(s.win) - Math.round(b.win) : null;
        var nm = el('span'); nm.appendChild(el('b', null, e.title)); if (e.active) { nm.appendChild(document.createTextNode(' ')); nm.appendChild(tagChip(kdate(e.last).slice(5) + ' 발생', HOT, '#fff')); }
        return row([nm, e.n, kdate(e.last), { t: s ? pp(s.median) : '–', c: s ? cls(s.median) : '', b: 1 }, s ? fmt(s.win, 0) + '%' : '–', { t: b ? fmt(b.win, 0) + '%' : '–', c: 'ar-mut' }, { t: dw == null ? '–' : (dw > 0 ? '+' : '') + dw + '%p', c: cls(dw), b: 1 }], function () { open(e.id, true); });
      })));
      Array.prototype.forEach.call(btns.children, function (x) { x.setAttribute('aria-pressed', String(x.dataset.s === curSrc)); });
    }
    groups.forEach(function (g) { var b = el('button', 'ar-btn', g[0]); b.type = 'button'; b.dataset.s = g[1]; b.addEventListener('click', function () { curSrc = g[1]; list(); }); btns.appendChild(b); });
    lc.appendChild(btns); lc.appendChild(holder);
    lc.appendChild(note('‘차이’는 신호 뒤 3개월 동안 오른 비율에서 아무 날의 오른 비율을 뺀 값입니다. 붉을수록 신호 뒤 성적이 평소보다 좋았고, 푸를수록 나빴습니다.'));
    root.appendChild(lc); list(); root.appendChild(detail);
    function fromHash(scroll) { var m = /ev=([a-z0-9_]+)/.exec(location.hash); var id = m && data.events.some(function (e) { return e.id === m[1]; }) ? m[1] : null; if (id) open(id, scroll); return id; }
    if (!fromHash(true)) { var f = (act[0] || data.events[0] || {}).id; if (f) eventDetail(detail, f, { link: links[f] }); }
    window.addEventListener('hashchange', function () { fromHash(true); });
    root.appendChild(note(SRC + ' 수익률은 종가 기준 단순 수익률(배당·환율·세금 제외).'));
  }

  /* ================= 종목 진단기 ================= */
  function stockDetail(host, code, opt, sj) {
    opt = opt || {}; host.textContent = ''; var c = card(); c.appendChild(el('p', 'ar-sub', '불러오는 중…')); host.appendChild(c);
    if (opt.scroll) goTo(host);
    getJSON('/data/stocks/' + encodeURIComponent(code) + '.json').then(function (d) {
      if (opt.hash) setHash('s=' + code);
      c.textContent = ''; c.appendChild(brand('종목 진단기', d.date));
      var top = el('div'); top.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin:0 0 12px';
      var l = el('div'); l.appendChild(el('div', 'ar-h', d.name)); l.appendChild(el('span', 'ar-mut', d.code + ' · ' + d.market)); top.appendChild(l);
      var r = el('div'); r.style.textAlign = 'right'; var pr = el('div', null, won(d.close)); pr.style.cssText = 'font-size:30px;font-weight:800;line-height:1.1'; r.appendChild(pr); r.appendChild(el('b', cls(d.d1), '전일 ' + arrow(d.d1, 2, '%'))); top.appendChild(r); c.appendChild(top);
      var k = el('div', 'ar-kpis'); k.style.margin = '0 0 14px';
      [['1주', d.d5], ['1개월', d.d20], ['3개월', d.d60], ['1년', d.d250], ['52주 고점 대비', d.from_hi]].forEach(function (x) { k.appendChild(kpi(x[0], pp(x[1]), cls(x[1]))); });
      var rb = el('div', 'ar-kpi'); rb.appendChild(el('span', null, '52주 ' + fmt(d.lo52, 0) + ' ~ ' + fmt(d.hi52, 0))); var rr = rangeBar(d.pos52); rr.style.marginTop = '12px'; rb.appendChild(rr); k.appendChild(rb); c.appendChild(k);

      if (sj) (d.sig_ids || []).forEach(function (sid) {
        var s = sj.signals.filter(function (x) { return x.id === sid; })[0]; if (!s) return;
        var a = el('div', 'ar-alert'); a.appendChild(el('b', null, '켜진 신호 · ' + s.name));
        a.appendChild(document.createTextNode(' — 대형주 과거 ' + fmt(s.n, 0) + '번, 1개월 뒤 코스피를 이긴 비율 ' + fmt(s.excess['20'].win, 0) + '% (평소 ' + fmt(sj.base['20'].win, 0) + '%), 주가가 오른 비율 ' + fmt(s.raw['20'].win, 0) + '%')); c.appendChild(a);
      });
      c.appendChild(h2('주가 추이'));
      var ch = el('div'); c.appendChild(ch);
      chart(ch, { d: d.px.d, v: d.px.c, digits: 0, unit: '원', name: '종가', lines: [{ v: maTail(d.px.c, 20, 750), color: '#f08c00', name: '20일선' }, { v: maTail(d.px.c, 60, 750), color: '#2f9e44', name: '60일선' }, { v: maTail(d.px.c, 200, 750), color: '#9c36b5', name: '200일선' }], ranges: [['3개월', 92], ['1년', 366], ['3년', 1096], ['10년', 0]], def: 1, h: 420, label: d.name + ' 주가' });

      var two = el('div', 'ar-two'); two.style.marginTop = '8px';
      var a1 = el('div'); a1.appendChild(h2('외국인 보유율 ' + (d.ratio_now == null ? '' : fmt(d.ratio_now, 2) + '%') + (d.ratio_d20 == null ? '' : ' (20일 ' + arrow(d.ratio_d20, 2, '%p') + ')')));
      var rd = [], rv = []; d.px.d.forEach(function (x, i) { if (d.px.r[i] != null) { rd.push(x); rv.push(d.px.r[i]); } });
      var c1 = el('div'); a1.appendChild(c1);
      var a2 = el('div'); a2.appendChild(h2('최근 20거래일 순매수'));
      if (d.flow20) { var fk = el('div', 'ar-kpis'); fk.style.cssText = 'margin:0 0 10px;grid-template-columns:repeat(3,1fr)'; [['외국인', d.flow20.foreign], ['기관', d.flow20.inst], ['개인', d.flow20.indiv]].forEach(function (x) { var v = x[1], t = v == null ? '–' : (v > 0 ? '+' : '') + (Math.abs(v) >= 10000 ? fmt(v / 10000, 0) + '만주' : fmt(v, 0) + '주'); fk.appendChild(kpi(x[0], t, cls(v))); }); a2.appendChild(fk); }
      var c2 = el('div'); a2.appendChild(c2); flowBars(c2, d.flows); a2.appendChild(note('막대는 하루 순매수 수량 (붉은색 순매수, 푸른색 순매도)'));
      two.appendChild(a1); two.appendChild(a2); c.appendChild(two);
      if (rv.length > 5) chart(c1, { d: rd, v: rv, digits: 2, unit: '%', color: DOWN, ranges: [['1년', 366], ['3년', 1096], ['10년', 0]], def: 1, h: 300, label: '외국인 보유율' });

      var fa = d.fin && d.fin.annual, fq = d.fin && d.fin.quarter;
      if (fa) {
        c.appendChild(h2('실적 추이 · 연간'));
        var labs = fa.periods.map(function (p) { return p.key.slice(0, 4); }), est = fa.periods.map(function (p) { return p.est; });
        var tw = el('div', 'ar-two'); [['매출액', eok], ['영업이익', eok], ['당기순이익', eok], ['ROE', function (v) { return fmt(v, 1) + '%'; }]].forEach(function (mt) { if (!fa.rows[mt[0]]) return; var b = el('div'); b.appendChild(el('div', 'ar-sub', mt[0])); var x = el('div'); b.appendChild(x); bars(x, labs, fa.rows[mt[0]], est, mt[1]); tw.appendChild(b); });
        c.appendChild(tw);
        var keys = ['영업이익률', '부채비율', 'EPS', 'BPS', '주당배당금'].filter(function (x) { return fa.rows[x]; });
        if (keys.length) c.appendChild(table(['지표'].concat(labs.map(function (x, i) { return x + (est[i] ? ' 예상' : ''); })), keys.map(function (kk) { var pct = /률|비율/.test(kk); return row([{ t: kk, b: 1 }].concat(fa.rows[kk].map(function (v) { return v == null ? '–' : fmt(v, pct ? 1 : 0) + (pct ? '%' : '원'); }))); })));
      }
      if (fq && fq.rows['영업이익']) {
        c.appendChild(h2('실적 추이 · 분기'));
        var ql = fq.periods.map(function (p) { return p.key.slice(2, 4) + '.' + p.key.slice(4); }), qe = fq.periods.map(function (p) { return p.est; });
        var tq = el('div', 'ar-two'); [['매출액', eok], ['영업이익', eok]].forEach(function (mt) { if (!fq.rows[mt[0]]) return; var b = el('div'); b.appendChild(el('div', 'ar-sub', mt[0])); var x = el('div'); b.appendChild(x); bars(x, ql, fq.rows[mt[0]], qe, mt[1]); tq.appendChild(b); }); c.appendChild(tq);
      }
      var f = d.fund || {}; c.appendChild(h2('밸류에이션'));
      var gg = el('div', 'ar-kpis'); [['PER', f.per == null ? '–' : fmt(f.per, 1) + '배'], ['예상 PER', f.cns_per == null ? '–' : fmt(f.cns_per, 1) + '배'], ['PBR', f.pbr == null ? '–' : fmt(f.pbr, 2) + '배'], ['ROE', f.roe == null ? '–' : fmt(f.roe, 1) + '%'], ['배당수익률', f.div_yield == null ? '–' : fmt(f.div_yield, 2) + '%'], ['증권사 목표가 평균', f.target == null ? '–' : won(f.target)], ['목표가까지', f.target_gap == null ? '–' : pp(f.target_gap)]].forEach(function (x) { gg.appendChild(kpi(x[0], x[1])); }); c.appendChild(gg);
      c.appendChild(note('실적과 예상치는 네이버 증권(증권사 전망 평균) 기준, 단위는 억 원입니다. 예상치와 목표가는 전망일 뿐 맞는다는 보장이 없습니다.'));

      c.appendChild(h2('다섯 가지 점검'));
      (d.checks || []).forEach(function (x) { var rw = el('div', 'ar-row'); rw.style.gridTemplateColumns = '24px 64px 1fr'; var mk = el('b', null, x.v === true ? '✔' : x.v === false ? '✖' : '–'); mk.style.color = x.v === true ? OK : x.v === false ? UP : MUT; rw.appendChild(mk); rw.appendChild(el('b', null, x.k)); rw.appendChild(el('span', null, x.note)); c.appendChild(rw); });
      if (d.disc && d.disc.length) { c.appendChild(h2('최근 공시')); d.disc.forEach(function (x) { var pz = el('p'); pz.style.cssText = 'margin:0 0 7px!important;font-size:13.5px!important;white-space:normal'; pz.appendChild(el('span', 'ar-mut', kdate(x.date).slice(5) + '  ')); if (x.tag) { pz.appendChild(x.tag === '주의' ? tagChip(x.tag, HOT, '#fff') : tagChip(x.tag, '#e6f6ef', OK)); pz.appendChild(document.createTextNode(' ')); } pz.appendChild(document.createTextNode(x.title)); c.appendChild(pz); }); }
    }).catch(function (x) { fail(host, x); });
  }
  function signalTable(sj, only) {
    var list = sj.signals.filter(function (x) { return !only || x.id === only; });
    if (only) { var x = list[0]; return table(['이후 기간', '코스피를 이긴 비율', '평소', '초과수익 중앙값', '단순 수익 중앙값', '오른 비율'], ['5', '20', '60'].map(function (H) { var e = x.excess[H], r = x.raw[H], b = sj.base[H]; return row([{ t: HZ_NAME[H] + ' 뒤', b: 1 }, { t: fmt(e.win, 0) + '%', b: 1 }, { t: fmt(b.win, 0) + '%', c: 'ar-mut' }, { t: pp(e.median, 2), c: cls(e.median) }, { t: pp(r.median, 2), c: cls(r.median) }, fmt(r.win, 0) + '%']); })); }
    return table(['신호', '사례 수', '1개월 뒤 코스피를 이긴 비율', '평소 대비', '초과수익 중앙값', '오른 비율', '지금 켜진 종목'], list.map(function (x) { var e = x.excess['20']; return row([{ t: x.name, b: 1 }, fmt(x.n, 0), { t: fmt(e.win, 0) + '%', b: 1 }, { t: (x.dwin > 0 ? '+' : '') + fmt(x.dwin, 1) + '%p', c: cls(x.dwin), b: 1 }, { t: pp(e.median, 2), c: cls(e.median) }, fmt(x.raw['20'].win, 0) + '%', x.active.length + '개']); }));
  }
  function renderStocks(root, j, sj) {
    root.textContent = '';
    var detail = el('div'), S = j.stocks;
    function open(code, scroll) { stockDetail(detail, code, { hash: true, scroll: scroll }, sj); }
    var top = card(); top.appendChild(brand('종목 진단기', j.asof));
    top.appendChild(h('오늘의 종목 스크리너', '코스피·코스닥 대형주 ' + S.length + '종목을 조건별로 추렸습니다. 종목을 누르면 차트·수급·실적이 열립니다.'));
    var sigCount = S.filter(function (x) { return (x.sig_ids || []).length; }).length;
    var presets = [
      ['신호 켜진 종목 ' + sigCount, function (x) { return (x.sig_ids || []).length; }, function (a, b) { return b.sig_ids.length - a.sig_ids.length; }, 'signals', '켜진 신호'],
      ['오늘 급락', function (x) { return x.d1 != null && x.d1 <= -3; }, function (a, b) { return a.d1 - b.d1; }, 'd5', '1주'],
      ['오늘 급등', function (x) { return x.d1 != null && x.d1 >= 3; }, function (a, b) { return b.d1 - a.d1; }, 'd5', '1주'],
      ['52주 고점 근처', function (x) { return x.from_hi != null && x.from_hi >= -5; }, function (a, b) { return b.from_hi - a.from_hi; }, 'from_hi', '고점 대비'],
      ['고점 대비 많이 빠진', function (x) { return x.from_hi != null && x.from_hi <= -30; }, function (a, b) { return a.from_hi - b.from_hi; }, 'from_hi', '고점 대비'],
      ['외국인이 사는', function (x) { return x.ratio_d20 != null && x.ratio_d20 > 0; }, function (a, b) { return b.ratio_d20 - a.ratio_d20; }, 'ratio_d20', '보유율 20일 변화'],
      ['외국인이 파는', function (x) { return x.ratio_d20 != null && x.ratio_d20 < 0; }, function (a, b) { return a.ratio_d20 - b.ratio_d20; }, 'ratio_d20', '보유율 20일 변화'],
      ['이익이 늘어난', function (x) { return x.op_yoy != null && x.op_yoy > 0; }, function (a, b) { return b.op_yoy - a.op_yoy; }, 'op_yoy', '분기 영업이익 증감'],
      ['PBR 낮은', function (x) { return x.pbr != null && x.pbr > 0; }, function (a, b) { return a.pbr - b.pbr; }, 'pbr', 'PBR'],
      ['배당 높은', function (x) { return x.div != null && x.div > 0; }, function (a, b) { return b.div - a.div; }, 'div', '배당수익률']
    ];
    var pb = el('div', 'ar-btns'), ph = el('div'), cur = sigCount ? 0 : 3;
    function special(x, key) {
      if (key === 'signals') return (x.signals || []).join(', ') || '–';
      if (key === 'd5') return { t: pp(x.d5), c: cls(x.d5), b: 1 };
      if (key === 'from_hi') return { t: pp(x.from_hi), c: cls(x.from_hi), b: 1 };
      if (key === 'ratio_d20') return { t: arrow(x.ratio_d20, 2, '%p'), c: cls(x.ratio_d20), b: 1 };
      if (key === 'op_yoy') return { t: pp(x.op_yoy, 0), c: cls(x.op_yoy), b: 1 };
      if (key === 'pbr') return { t: fmt(x.pbr, 2) + '배', b: 1 };
      if (key === 'div') return { t: fmt(x.div, 2) + '%', b: 1 };
      return '–';
    }
    function preset() {
      var p = presets[cur], rows = S.filter(p[1]).sort(p[2]).slice(0, 12); ph.textContent = '';
      if (!rows.length) ph.appendChild(el('p', 'ar-sub', '지금은 해당하는 종목이 없습니다.'));
      else ph.appendChild(table(['종목', '종가', '전일', p[4], '1개월', '52주 범위', 'PER'], rows.map(function (x) { return row([{ t: x.name, b: 1 }, fmt(x.close, 0), { t: arrow(x.d1, 2, '%'), c: cls(x.d1), b: 1 }, special(x, p[3]), { t: pp(x.d20), c: cls(x.d20) }, rangeBar(x.pos52), x.per == null ? '–' : fmt(x.per, 1)], function () { open(x.code, true); }); })));
      Array.prototype.forEach.call(pb.children, function (b, i) { b.setAttribute('aria-pressed', String(i === cur)); });
    }
    presets.forEach(function (p, i) { var b = el('button', 'ar-btn', p[0]); b.type = 'button'; b.addEventListener('click', function () { cur = i; preset(); }); pb.appendChild(b); });
    top.appendChild(pb); top.appendChild(ph); root.appendChild(top); preset();
    root.appendChild(detail);

    var lc = card(); lc.appendChild(h('전체 종목', '이름으로 찾거나 제목 줄을 눌러 정렬하세요'));
    var inp = el('input', 'ar-input'); inp.type = 'search'; inp.placeholder = '종목명 검색 (예: 삼성전자)'; lc.appendChild(inp);
    var holder = el('div'); lc.appendChild(holder); var sortK = 'cap', sortD = -1;
    var cols = [['name', '종목'], ['close', '종가'], ['d1', '전일'], ['d20', '1개월'], ['d250', '1년'], ['from_hi', '고점 대비'], ['ratio_d20', '외국인 20일'], ['per', 'PER'], ['pbr', 'PBR'], ['op_yoy', '영업이익 증감']];
    function all() {
      holder.textContent = ''; var q = inp.value.trim();
      var rows = S.filter(function (x) { return !q || x.name.indexOf(q) >= 0 || x.code.indexOf(q) >= 0; }).sort(function (a, b) { var x = a[sortK], y = b[sortK]; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * sortD; });
      var sc = table(cols.map(function (c) { return c[1] + (sortK === c[0] ? (sortD > 0 ? ' ▲' : ' ▼') : ''); }), rows.map(function (x) {
        var nm = el('span'); nm.appendChild(el('b', null, x.name)); if ((x.sig_ids || []).length) { nm.appendChild(document.createTextNode(' ')); nm.appendChild(tagChip('신호 ' + x.sig_ids.length, '#ffe3e3', '#b42318')); }
        return row([nm, { t: fmt(x.close, 0), b: 1 }, { t: arrow(x.d1, 2, '%'), c: cls(x.d1) }, { t: pp(x.d20), c: cls(x.d20) }, { t: pp(x.d250, 0), c: cls(x.d250) }, { t: pp(x.from_hi), c: cls(x.from_hi) }, { t: arrow(x.ratio_d20, 2, '%p'), c: cls(x.ratio_d20) }, x.per == null ? '–' : fmt(x.per, 1), x.pbr == null ? '–' : fmt(x.pbr, 2), { t: pp(x.op_yoy, 0), c: cls(x.op_yoy) }], function () { open(x.code, true); });
      }));
      Array.prototype.forEach.call(sc.querySelectorAll('th'), function (th, i) { th.style.cursor = 'pointer'; th.addEventListener('click', function () { var kx = cols[i][0]; sortD = sortK === kx ? -sortD : (kx === 'name' ? 1 : -1); sortK = kx; all(); }); });
      sc.style.maxHeight = '520px'; sc.style.overflowY = 'auto'; holder.appendChild(sc);
    }
    inp.addEventListener('input', all); all(); root.appendChild(lc);

    if (sj) {
      var vc = card(); vc.appendChild(h('신호는 얼마나 믿을 만한가', '유명한 매매 신호 ' + sj.signals.length + '가지를 대형주 ' + sj.universe + '종목의 과거로 검증했습니다. 신호가 켜진 날 샀을 때 같은 기간 코스피보다 더 올랐는지를 셌습니다.'));
      vc.appendChild(signalTable(sj, null));
      var bw = sj.signals.slice().sort(function (a, b) { return b.dwin - a.dwin; });
      var pz = el('p'); pz.style.marginTop = '12px'; pz.appendChild(el('b', null, '읽는 법 · ')); pz.appendChild(document.createTextNode('아무 날에 사도 한 달 뒤 코스피를 이기는 비율이 ' + fmt(sj.base['20'].win, 0) + '%입니다. 가장 나았던 신호는 ' + bw[0].name + '(' + fmt(bw[0].excess['20'].win, 0) + '%), 가장 나빴던 신호는 ' + bw[bw.length - 1].name + '(' + fmt(bw[bw.length - 1].excess['20'].win, 0) + '%)였고, 5%포인트 넘게 앞선 신호는 없었습니다. 신호는 오늘 들여다볼 종목을 고르는 거름망으로 쓰고, 판단은 위의 차트·수급·실적으로 하는 편이 기록에 맞습니다.')); vc.appendChild(pz);
      vc.appendChild(note('같은 종목에서 같은 신호가 ' + sj.cooldown + '거래일 안에 다시 켜지면 세지 않았습니다. 대상이 지금의 대형주라 과거에 탈락한 종목이 빠져 있다는 한계가 있습니다.'));
      root.appendChild(vc);
    }
    function fromHash(scroll) { var m = /s=(\d{6})/.exec(location.hash); if (m) open(m[1], scroll); return m; }
    if (!fromHash(true)) { var f0 = S.slice().sort(function (a, b) { return (b.cap || 0) - (a.cap || 0); })[0]; if (f0) stockDetail(detail, f0.code, {}, sj); }
    window.addEventListener('hashchange', function () { fromHash(true); });
    root.appendChild(note(SRC));
  }
  function renderSignal(root, sj, id) {
    root.textContent = ''; var x = sj.signals.filter(function (s) { return s.id === id; })[0]; if (!x) return;
    var c = card(); c.appendChild(brand('신호 검증', sj.asof)); c.appendChild(h(x.name + ' 검증 결과', x.desc + ' · 대형주 ' + sj.universe + '종목에서 ' + fmt(x.n, 0) + '번'));
    c.appendChild(signalTable(sj, id));
    c.appendChild(h2('지금 이 신호가 켜진 종목'));
    if (!x.active.length) c.appendChild(el('p', 'ar-sub', '최근 3거래일 안에 켜진 종목이 없습니다.'));
    else { var pz = el('p'); x.active.forEach(function (a, i) { var lk = el('a', null, a.name); lk.href = STOCKS + '#s=' + a.code; pz.appendChild(lk); if (i < x.active.length - 1) pz.appendChild(document.createTextNode(' · ')); }); c.appendChild(pz); }
    root.appendChild(c); root.appendChild(note(SRC));
  }
  function renderMini(root, m, links) {
    root.textContent = ''; var c = m.composite; if (!c) return;
    var cd = card(); cd.style.marginBottom = '0'; cd.appendChild(brand('시장체온계', c.date));
    var a = el('a'); a.href = THERMO; a.style.cssText = 'display:block;text-decoration:none!important';
    var big = el('div', 'ar-big'); big.style.fontSize = '46px'; big.style.color = tempInk(c.value); big.appendChild(document.createTextNode(fmt(c.value, 1))); big.appendChild(el('small', null, '도 · ' + c.label)); a.appendChild(big);
    var g = el('div', 'ar-gauge'); g.style.height = '28px'; g.appendChild(el('div', 'ar-gbar')); var pin = el('div', 'ar-gpin'); pin.style.left = c.value + '%'; g.appendChild(pin); a.appendChild(g); cd.appendChild(a);
    if (m.headline && m.headline[1]) cd.appendChild(el('p', null, m.headline[1]));
    (m.active || []).slice(0, 2).forEach(function (e) { var lk = el('a', null, e.title + ' 뒤 과거 통계'); lk.href = links[e.id] || (HUB + '#ev=' + e.id); lk.style.cssText = 'display:block;margin-top:6px;font-size:13px'; cd.appendChild(lk); });
    var more = el('a', null, '자산별 가격과 20년 추이 보기'); more.href = THERMO; more.style.cssText = 'display:block;margin-top:6px;font-size:13px'; cd.appendChild(more);
    root.appendChild(cd);
  }

  function boot() {
    if (!document.getElementById('ar-css')) { var st = document.createElement('style'); st.id = 'ar-css'; st.textContent = CSS; document.head.appendChild(st); }
    Array.prototype.forEach.call(document.querySelectorAll('[data-ar]'), function (root) {
      if (root.dataset.arDone) return; root.dataset.arDone = '1';
      var kind = root.getAttribute('data-ar'), id = root.getAttribute('data-id');
      if (kind === 'text') {   // 글 본문의 숫자 문단: 매일 다시 만든 문장으로 바꿔 끼운다(실패하면 원래 본문 그대로)
        getJSON('/data/text/' + encodeURIComponent(id) + '.json').then(function (t) { if (t && t.html) root.innerHTML = t.html; }).catch(function () { /* 그대로 둔다 */ });
        return;
      }
      root.classList.add('ar-root'); root.textContent = ''; var c = card(); c.appendChild(el('p', 'ar-sub', '최신 데이터를 불러오는 중…')); root.appendChild(c);
      var F = function (e) { fail(root, e); };
      if (kind === 'thermo') getJSON('/data/market.json').then(function (m) { renderThermo(root, m); }).catch(F);
      else if (kind === 'events') Promise.all([getJSON('/data/events.json'), getLinks()]).then(function (r) { renderEvents(root, r[0], r[1]); }).catch(F);
      else if (kind === 'event') { root.textContent = ''; var h0 = el('div'); root.appendChild(h0); eventDetail(h0, id, {}); root.appendChild(note(SRC)); }
      else if (kind === 'stocks') Promise.all([getJSON('/data/stocks/index.json'), getJSON('/data/stocks/signals.json').catch(function () { return null; })]).then(function (r) { renderStocks(root, r[0], r[1]); }).catch(F);
      else if (kind === 'stock') getJSON('/data/stocks/signals.json').catch(function () { return null; }).then(function (sj) { root.textContent = ''; var h1 = el('div'); root.appendChild(h1); stockDetail(h1, root.getAttribute('data-code'), {}, sj); root.appendChild(note(SRC)); });
      else if (kind === 'signal') getJSON('/data/stocks/signals.json').then(function (sj) { renderSignal(root, sj, id); }).catch(F);
      else if (kind === 'mini') Promise.all([getJSON('/data/market.json'), getLinks()]).then(function (r) { renderMini(root, r[0], r[1]); }).catch(F);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
