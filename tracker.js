/*
 * AIの使い方診断　数える仕組み（ページ側）
 *
 * 送るのは event / ref / type / item / sid の5つだけです。
 * 9問の答え・名前・メール・画面の文字・どこから来たか（referrer）・ブラウザの情報は送りません。
 * 送信に失敗しても、画面には何も起きません。
 */
(function () {
  'use strict';

  // ===== ここだけ差し替える（GASのウェブアプリURL。/exec で終わるもの） =====
  var API_URL = 'https://script.google.com/macros/s/AKfycbyOCySQUsVT0W5cltimxNF6yqdqBjIwkeOWXx0cac4ZwgM25ZhIgJo4A7Jk4t4CZ-lccQ/exec';
  // =========================================================================

  // ボタンと event の対応（index.html を書き換えなくても数えられるもの）
  var AUTO = [
    ['.go', 'quiz_start'],   // 「3分で診断する（無料）」ボタン（4か所）
    ['#line', 'line_click']  // 結果画面の LINE ボタン
  ];

  var EVENTS = ['lp_view', 'quiz_start', 'quiz_done', 'line_click', 'buy_click', 'note_click', 'brain_click', 'notify_click'];
  var K = { ref: 'aisk_ref', sid: 'aisk_sid', type: 'aisk_type', lp: 'aisk_lp' };

  function store(k, v) {
    try {
      if (v === undefined) return window.sessionStorage.getItem(k);
      window.sessionStorage.setItem(k, v);
    } catch (e) { /* 保存できない環境でも止めない */ }
    return v;
  }

  function clean(v, max) {
    return String(v == null ? '' : v).replace(/[^A-Za-z0-9_-]/g, '').slice(0, max);
  }

  function getRef() {
    var saved = store(K.ref);
    if (saved) return saved;
    var ref = '';
    try { ref = clean(new URLSearchParams(window.location.search).get('ref'), 20); } catch (e) {}
    return store(K.ref, ref || 'direct') || 'direct';
  }

  function getSid() {
    var sid = store(K.sid);
    if (sid && /^[a-z0-9]{6,16}$/.test(sid)) return sid;
    sid = '';
    try {
      var a = new Uint8Array(10);
      window.crypto.getRandomValues(a);
      for (var i = 0; i < a.length; i++) sid += (a[i] % 36).toString(36);
    } catch (e) {
      sid = Math.random().toString(36).slice(2, 10);
    }
    sid = (sid + 'aaaaaa').slice(0, 10);
    return store(K.sid, sid) || sid;
  }

  function send(body) {
    if (!API_URL || API_URL.indexOf('ここに') !== -1) return; // URL未設定なら送らない
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
        if (navigator.sendBeacon(API_URL, blob)) return;
      }
    } catch (e) {}
    try {
      // text/plain なのでプリフライトなし。返事は読まない（no-cors）
      fetch(API_URL, {
        method: 'POST', mode: 'no-cors', keepalive: true, credentials: 'omit',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: body
      }).catch(function () {});
    } catch (e) {}
  }

  /**
   * track(event, extra)
   *   extra.type … 結果タイプ 1〜5（quiz_done で渡すと、そのあとのボタンにも自動で付く）
   *   extra.item … 押した商品名（英数字と _ - だけ。例 guide_980 / torisetsu_1980）
   */
  function track(event, extra) {
    try {
      if (EVENTS.indexOf(event) === -1) return;
      extra = extra || {};
      var type = String(extra.type == null ? '' : extra.type);
      if (/^[1-5]$/.test(type)) store(K.type, type);
      else type = store(K.type) || '';
      if (event === 'lp_view' || event === 'quiz_start') type = '';
      send(JSON.stringify({
        event: event,
        ref: getRef(),
        type: type,
        item: clean(extra.item, 30),
        sid: getSid()
      }));
    } catch (e) { /* 画面には影響させない */ }
  }
  window.track = track;

  // クリックをまとめて拾う（data-track 属性、または AUTO の対応表）
  document.addEventListener('click', function (ev) {
    try {
      var t = ev.target;
      if (!t || !t.closest) return;
      var el = t.closest('[data-track]');
      if (el) { track(el.getAttribute('data-track'), { item: el.getAttribute('data-item') }); return; }
      for (var i = 0; i < AUTO.length; i++) {
        if (t.closest(AUTO[i][0])) { track(AUTO[i][1]); return; }
      }
    } catch (e) {}
  }, true);

  // LP の表示は、1回の訪問で1回だけ
  try {
    getRef(); // 最初に来たときの ref を先に保存
    if (!store(K.lp)) { store(K.lp, '1'); track('lp_view'); }
  } catch (e) {}
})();
