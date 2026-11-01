// === ページ先読み (Speculation Rules) ===
// サイドバー / お気に入りバーの科目のリンクを押し始めた時点で遷移先を裏で描画しておき，
// クリックした時点で表示する．対応ブラウザ (Chrome / Edge) のみ．

(function () {
  "use strict";

  if (window !== window.top) return;
  var ScriptEl = window.HTMLScriptElement;
  if (!ScriptEl || !ScriptEl.supports || !ScriptEl.supports("speculationrules")) return;

  var RULES = {
    prerender: [{
      where: {
        and: [
          // 科目のトップ（/portal/site/<サイト>）へのリンクに限る．ツールのリンク
          // （/portal/site/<サイト>/tool-reset/<配置>）は，開くだけでそのツールの
          // 状態を Sakai に初期化させるので，先読みしない
          { href_matches: { pathname: "/portal/site/:site" } },
          { selector_matches: "#portal-nav-sidebar a, #kulms-top-favbar a" },
          { not: { selector_matches: "[target], [download], [onclick]" } },
          { not: { href_matches: { pathname: "/portal/site/*", search: "*sakai_action*" } } }
        ]
      },
      // conservative: リンクを押し始めた時点（タッチ端末ではタッチを始めた時点）で
      // 先読みする．Sakai は先読みしたページも科目の訪問として記録するので，開く
      // 直前に限る
      eagerness: "conservative"
    }]
  };

  window.__kulmsSettingsReady.then(function (s) {
    if (s.linkPrerender === false) return;
    var script = document.createElement("script");
    script.type = "speculationrules";
    script.id = "kulms-speculation-rules";
    script.textContent = JSON.stringify(RULES);
    document.head.appendChild(script);
  });
})();
