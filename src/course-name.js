// === サイドバー科目名の整理 + ピン留めソート ===

(function () {
  "use strict";

  // iframe内では実行しない
  if (window !== window.top) return;

  // [2026前期水２]固体電子工学 → [水２]固体電子工学
  var COURSE_RE =
    /^\s*\[\d{4}[^\]]*?([月火水木金土日]\s*[０-９0-9]+)\s*\]/;

  // ソート用
  var DAY_ORDER = { 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6, 日: 7 };
  // [2026前期月１] や [月１] の曜日と時限。一致は開き括弧の後の最初の ] で終わるので、
  // その前の「曜日 時限 ]」を先に探し、同じ括弧の中（前の ] から曜日まで）に、それを読む
  // 開き括弧（直後に年の 4 桁が続くもの、または曜日の直前のもの）があるかを確かめる。
  // どの括弧の中も一度しか見ない（開き括弧から一つの正規表現で探すと、開き括弧が長く
  // 続くとき、その一つ一つから ] まで探し直して入力長の 2 乗の時間がかかる。括弧を探す
  // のも括弧の中に限る。文字列の残り全体から探すと、曜日と時限が長く続くとき、同じく
  // 2 乗になる）
  var SORT_TAIL_RE = /([月火水木金土日])\s*([０-９0-9]+)\s*\]/g;

  // text.match(/\[(?:\d{4}[^\]]*?)?([月火水木金土日])\s*([０-９0-9]+)\s*\]/) と同じ曜日（[1]）と時限（[2]）
  function matchSort(text) {
    SORT_TAIL_RE.lastIndex = 0;
    var from = 0; // 前の「曜日 時限 ]」の後
    var t;
    while ((t = SORT_TAIL_RE.exec(text)) !== null) {
      var inside = text.slice(from, t.index);
      inside = inside.slice(inside.lastIndexOf("]") + 1);
      var day = inside.length; // inside の中での曜日の位置
      for (var p = inside.indexOf("["); p !== -1; p = inside.indexOf("[", p + 1)) {
        if (p === day - 1 || (p <= day - 5 && /^\d{4}$/.test(inside.slice(p + 1, p + 5)))) return t;
      }
      from = SORT_TAIL_RE.lastIndex;
    }
    return null;
  }

  function toHalfWidth(s) {
    return parseInt(
      s.replace(/[０-９]/g, function (ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 48);
      }),
      10
    );
  }

  function getSortKey(text) {
    var m = matchSort(text);
    if (!m) return Infinity;
    var day = DAY_ORDER[m[1]] || 99;
    var period = toHalfWidth(m[2]);
    return day * 100 + period;
  }

  function isCourseLink(a) {
    return (
      /\/portal\/site\//.test(a.href) &&
      !/\/tool\//.test(a.href) &&
      !/\/portal\/site\/~/.test(a.href)
    );
  }

  function cleanLink(a) {
    if (a.dataset.kulmsNameCleaned) return;
    var walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (COURSE_RE.test(node.textContent)) {
        node.textContent = node.textContent.replace(COURSE_RE, "[$1]");
        a.dataset.kulmsNameCleaned = "1";
      }
    }
  }

  function cleanAll() {
    document
      .querySelectorAll('a[href*="/portal/site/"]')
      .forEach(function (a) {
        if (a.dataset.kulmsNameCleaned) return;
        if (COURSE_RE.test(a.textContent)) cleanLink(a);
      });
  }

  // --- ピン留めソート ---
  var sorting = false;
  var sortTimer = null;
  var lastSortSignature = "";

  function sortPinned() {
    var list = document.querySelector("#pinned-site-list");
    if (!list) return;

    var items = Array.from(list.children);
    var entries = [];
    items.forEach(function (li) {
      var link = li.querySelector('a[href*="/portal/site/"]');
      if (!link || !isCourseLink(link)) return;
      entries.push({ el: li, key: getSortKey(link.textContent) });
    });

    if (entries.length < 2) return;

    var sig = entries.map(function (e) { return e.key; }).join(",");
    if (sig === lastSortSignature) return;

    entries.sort(function (a, b) { return a.key - b.key; });

    sorting = true;
    entries.forEach(function (e) {
      list.appendChild(e.el);
    });
    sorting = false;

    lastSortSignature = sig;
  }

  function scheduleSortPinned() {
    if (sorting || sortTimer) return;
    sortTimer = setTimeout(function () {
      sortTimer = null;
      sortPinned();
    }, 300);
  }

  // --- 授業中 NOW バッジ ---

  // 京大の時限: [開始時, 開始分, 終了時, 終了分]
  var PERIOD_TIMES = [
    [8, 45, 10, 15],   // 1限
    [10, 30, 12, 0],   // 2限
    [13, 15, 14, 45],  // 3限
    [15, 0, 16, 30],   // 4限
    [16, 45, 18, 15],  // 5限
  ];

  // JavaScript getDay(): 0=日, 1=月, ..., 6=土
  var JS_DAY_MAP = { 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6, 日: 0 };

  // 授業中は NOW、休み時間は次の時限に NEXT、1限は開始15分前から NEXT、5限後は非表示
  function getActivePeriod() {
    var now = new Date();
    var day = now.getDay();
    var mins = now.getHours() * 60 + now.getMinutes();

    var firstStart = PERIOD_TIMES[0][0] * 60 + PERIOD_TIMES[0][1];
    var lastEnd = PERIOD_TIMES[PERIOD_TIMES.length - 1][2] * 60 + PERIOD_TIMES[PERIOD_TIMES.length - 1][3];

    // 1限開始15分前より早い、または5限後は対象外
    if (mins < firstStart - 15 || mins >= lastEnd) return null;

    for (var i = 0; i < PERIOD_TIMES.length; i++) {
      var p = PERIOD_TIMES[i];
      var start = p[0] * 60 + p[1];
      var end = p[2] * 60 + p[3];
      if (mins >= start && mins < end) {
        return { day: day, period: i + 1, type: "now" };
      }
      if (mins < start) {
        return { day: day, period: i + 1, type: "next" };
      }
    }
    return null;
  }

  var updatingNowBadges = false;

  function updateNowBadges() {
    updatingNowBadges = true;
    var active = getActivePeriod();

    document.querySelectorAll(".site-list-item, .fav-sites-entry").forEach(function (li) {
      var link = li.querySelector('a[href*="/portal/site"]');
      if (!link || !isCourseLink(link)) return;

      var existing = li.querySelector(".kulms-now-badge");
      var targetType = null;

      if (active) {
        var m = matchSort(link.textContent);
        if (m && JS_DAY_MAP[m[1]] === active.day && toHalfWidth(m[2]) === active.period) {
          targetType = active.type;
        }
      }

      var currentType = existing
        ? (existing.classList.contains("is-next") ? "next" : "now")
        : null;

      if (targetType === currentType) return;

      if (existing) existing.remove();
      if (targetType) {
        var badge = document.createElement("span");
        badge.className = "kulms-now-badge";
        if (targetType === "next") {
          badge.classList.add("is-next");
          badge.textContent = "NEXT";
        } else {
          badge.textContent = "NOW";
        }
        var titleEl = li.querySelector(".sidebar-site-title") || link;
        titleEl.appendChild(badge);
      }
    });
    updatingNowBadges = false;
  }

  function startNowBadgeUpdater() {
    updateNowBadges();
    setInterval(updateNowBadges, 60000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) updateNowBadges();
    });
  }

  // --- 初期化 ---

  window.__kulmsSettingsReady.then(function (s) {
    if (s.courseNameCleanup !== false) cleanAll();
    if (s.pinSort !== false) setTimeout(sortPinned, 600);
    if (s.currentPeriodHighlight) setTimeout(startNowBadgeUpdater, 800);

    new MutationObserver(function () {
      if (sorting || updatingNowBadges) return;
      if (s.courseNameCleanup !== false) cleanAll();
      if (s.pinSort !== false) scheduleSortPinned();
      if (s.currentPeriodHighlight) updateNowBadges();
    }).observe(document.body, { childList: true, subtree: true });
  });
})();
