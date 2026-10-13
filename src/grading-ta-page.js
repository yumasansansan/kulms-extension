// Page-world bridge for Sakai Grader properties.
(function () {
  "use strict";

  if (window.__kulmsTaPageBridgeInstalled) return;
  window.__kulmsTaPageBridgeInstalled = true;

  function serializeGrade(grade) {
    if (grade == null) return "";
    if (typeof grade === "string") return grade.trim();
    if (typeof grade === "number") return String(grade);
    return "";
  }

  function serializeStatus(status) {
    return typeof status === "string" ? status.trim() : "";
  }

  // ページの値は文字列（ID は有限の数も）のときだけ使い、ほかは空文字列にする。
  // オブジェクトや Symbol をそのまま渡すと、JSON にできずに例外になるか、
  // content script の側で文字列にできずに例外になる。
  function serializeText(value) {
    if (typeof value === "string") return value;
    if (typeof value === "number" && isFinite(value)) return String(value);
    return "";
  }

  // 提出 1 件を読む。ページのオブジェクトの getter や Proxy が投げたら、その提出は読まない
  function serializeSubmission(submission) {
    try {
      if (!submission || typeof submission !== "object") return null;
      var id = serializeText(submission.id) || serializeText(submission.submissionId);
      if (!id) {
        var match = serializeText(submission.reference).match(/\/([^/]+)$/);
        id = match ? match[1] : "";
      }

      return {
        id: id,
        firstSubmitterName: serializeText(submission.firstSubmitterName),
        status: serializeStatus(submission.status || submission.submissionStatus),
        submittedTime: serializeText(submission.submittedTime),
        submitted: !!submission.submitted,
        draft: !!submission.draft,
        hasHistory: !!submission.hasHistory,
        grade: serializeGrade(submission.grade),
        graded: !!submission.graded,
        returned: !!submission.returned
      };
    } catch (e) {
      return null;
    }
  }

  // 配列、Map、キーごとのオブジェクトだけを受ける。length の値を信じて反復すると、
  // 要素の無い length: 4294967294 のような値で何十億回も回ってしまう
  function normalizeSubmissions(source) {
    if (!source || typeof source !== "object") return [];
    if (Array.isArray(source)) return source;
    if (source instanceof Map) return Array.from(source.values());
    return Object.keys(source).map(function (key) {
      return source[key];
    });
  }

  window.addEventListener("kulms-ta-get-submissions", function (event) {
    var requestId = null;
    var submissions = [];
    try {
      var detail = parseBridgeDetail(event.detail);
      if (detail && typeof detail.requestId === "string") requestId = detail.requestId;
      var grader = document.querySelector('sakai-grader[id^="sakai-grader-"]') ||
        document.querySelector("sakai-grader");
      var source = grader && grader.originalSubmissions;
      normalizeSubmissions(source).forEach(function (item) {
        var submission = serializeSubmission(item);
        if (submission && submission.id) submissions.push(submission);
      });
    } catch (e) {
      // ページのオブジェクトが投げた例外。読めた提出だけを返す
    }
    window.dispatchEvent(new window.CustomEvent("kulms-ta-submissions", {
      detail: JSON.stringify({
        requestId: requestId,
        count: submissions.length,
        submissions: submissions
      })
    }));
  });

  function parseBridgeDetail(detail) {
    if (typeof detail === "string") {
      try {
        return JSON.parse(detail);
      } catch {
        return null;
      }
    }
    return detail && typeof detail === "object" ? detail : null;
  }
})();
