/*
 * NPTEL Assignment Solutions Downloader
 * Browser-console utility for downloading NPTEL assignment-solution PDFs.
 *
 * Usage: Open the NPTEL course page, open DevTools Console, and paste
 * this complete file. Review detected entries before allowing downloads.
 *
 * This utility only targets sidebar items labelled "Week N: Assignment N Solution".
 * It ignores ordinary lecture, quiz, feedback, and assignment rows that are not labelled as solutions.
 */

(async () => {
  "use strict";

  const CONFIG = {
    pageWaitMs: 2200,
    linkWaitMs: 10000,
    betweenItemsMs: 1800,
    retries: 2,
    filenamePrefix: "NPTEL"
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalize = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const assignmentSolutionPattern = /^Week\\s*\\d+\\s*:\\s*Assignment\\s*\\d+\\s*Solution$/i;
  const alternateAssignmentSolutionPattern = /^Assignment\\s*\\d+\\s*Solution\\s+for\\s+Week\\s*\\d+$/i;

  const log = (...args) => console.log("%c[NPTEL Assignment Solutions]", "color:#0891b2;font-weight:bold", ...args);
  const success = (...args) => console.log("%c[NPTEL Assignment Solutions] ✓", "color:#16a34a;font-weight:bold", ...args);
  const warn = (...args) => console.warn("%c[NPTEL Assignment Solutions]", "color:#d97706;font-weight:bold", ...args);
  const fail = (...args) => console.error("%c[NPTEL Assignment Solutions]", "color:#dc2626;font-weight:bold", ...args);

  function isAssignmentSolutionLabel(text) {
    const value = normalize(text);
    return assignmentSolutionPattern.test(value) || alternateAssignmentSolutionPattern.test(value);
  }

  function getWeek(text) {
    const match = normalize(text).match(/Week\s*(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function findSidebar() {
    const candidates = [...document.querySelectorAll("*")];
    let best = null;
    let bestScore = -1;

    for (const element of candidates) {
      const rect = element.getBoundingClientRect();
      if (rect.width < 140 || rect.height < 180 || rect.left > window.innerWidth * 0.55) continue;

      const text = normalize(element.innerText);
      if (!text || !/Week\\s*\\d+/i.test(text) || !/Assignment/i.test(text)) continue;

      const weekCount = (text.match(/Week\\s*\\d+/gi) || []).length;
      const solutionCount = (text.match(/Assignment\\s*\\d+\\s*Solution/gi) || []).length;
      const score = Math.min(weekCount, 30) * 3 + Math.min(solutionCount, 20) * 10 +
        (element.scrollHeight > element.clientHeight + 40 ? 12 : 0) -
        Math.max(0, rect.width - 450) / 20;

      if (score > bestScore) {
        best = element;
        bestScore = score;
      }
    }

    return best;
  }

  function collectAssignmentSolutionLabels(sidebar) {
    const labels = new Set();

    for (const element of sidebar.querySelectorAll("*")) {
      const label = normalize(element.innerText);
      if (label && label.length <= 110 && isAssignmentSolutionLabel(label)) {
        labels.add(label);
      }
    }

    return [...labels].sort((a, b) => {
      const weekDiff = (getWeek(a) ?? 999) - (getWeek(b) ?? 999);
      return weekDiff || a.localeCompare(b, undefined, { numeric: true });
    });
  }

  function findExactRow(sidebar, label) {
    const matches = [...sidebar.querySelectorAll("*")].filter((element) => {
      if (!element.isConnected || normalize(element.innerText) !== label) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    if (!matches.length) return null;

    // Prefer the smallest exact-text node, not a Week-level wrapper.
    matches.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (ra.width * ra.height) - (rb.width * rb.height);
    });

    return matches[0];
  }

  function clickExactRow(sidebar, label) {
    const row = findExactRow(sidebar, label);
    if (!row) throw new Error("Could not find the exact sidebar row: " + label);

    row.scrollIntoView({ block: "center", behavior: "instant" });
    row.click();
  }

  function findDownloadAnchor() {
    const anchors = [...document.querySelectorAll("a[href]")];

    const byClickHere = anchors.find((anchor) => {
      const text = normalize(anchor.innerText || anchor.textContent).toLowerCase();
      return text.includes("click here") && text.includes("download");
    });
    if (byClickHere) return byClickHere;

    const byAssignmentText = anchors.find((anchor) => {
      const text = normalize(anchor.innerText || anchor.textContent).toLowerCase();
      return text.includes("download") &&
        (text.includes("assignment") || text.includes("solution"));
    });
    if (byAssignmentText) return byAssignmentText;

    return anchors.find((anchor) => /drive\\.google\\.com|docs\\.google\\.com/i.test(anchor.href)) || null;
  }

  function extractDriveId(url) {
    if (!url) return null;
    const patterns = [
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
      /docs\.google\.com\/[^/]+\/d\/([a-zA-Z0-9_-]+)/i,
      /[?&]id=([a-zA-Z0-9_-]+)/i
    ];

    for (const pattern of patterns) {
      const match = String(url).match(pattern);
      if (match?.[1]) return decodeURIComponent(match[1]);
    }
    return null;
  }

  function inspectViewerReferences() {
    const refs = [];

    for (const element of document.querySelectorAll("iframe[src], embed[src], object[data]")) {
      const value = element.src || element.data || element.getAttribute("src") || element.getAttribute("data");
      if (value) refs.push(value);
    }

    for (const anchor of document.querySelectorAll("a[href]")) {
      const href = anchor.href;
      const label = normalize(anchor.innerText || anchor.getAttribute("aria-label") || anchor.title);
      if (href && (/drive\.google\.com|docs\.google\.com/i.test(href) ||
        /open|external|new tab/i.test(label))) refs.push(href);
    }

    return [...new Set(refs)];
  }

  // Some NPTEL note pages show the PDF in an embedded viewer with a
  // small open-in-new-window control in the viewer's top-right corner.
  // When that control calls window.open(), capture its URL instead of
  // opening another tab. Cross-origin iframe contents remain inaccessible.
  function captureEmbeddedViewerOpenUrl() {
    const viewerElements = [...document.querySelectorAll("iframe, embed, object")];
    const candidates = [];

    for (const viewer of viewerElements) {
      let container = viewer.parentElement;

      for (let depth = 0; depth < 5 && container; depth++, container = container.parentElement) {
        const viewerRect = container.getBoundingClientRect();
        if (viewerRect.width < 100 || viewerRect.height < 100) continue;

        for (const control of container.querySelectorAll("a, button, [role='button']")) {
          const label = normalize(
            control.innerText + " " +
            (control.getAttribute("aria-label") || "") + " " +
            (control.getAttribute("title") || "") + " " +
            (control.getAttribute("data-tooltip") || "")
          ).toLowerCase();

          if (!/(open|new window|new tab|pop.?out|external|launch)/i.test(label)) continue;

          const rect = control.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;

          const nearTop = rect.top <= viewerRect.top + 90;
          const nearRight = rect.right >= viewerRect.right - 110;
          candidates.push({
            control,
            score: (nearTop ? 2 : 0) + (nearRight ? 3 : 0) + (control.href ? 2 : 0)
          });
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    for (const candidate of candidates) {
      const control = candidate.control;
      const directHref = control.href || control.getAttribute("href");
      if (directHref && extractDriveId(directHref)) return directHref;

      let capturedUrl = null;
      const originalOpen = window.open;

      try {
        window.open = function (url) {
          if (url) capturedUrl = new URL(String(url), location.href).href;
          return null;
        };
        control.click();
      } catch (error) {
        // Try the next likely viewer control.
      } finally {
        window.open = originalOpen;
      }

      if (capturedUrl) return capturedUrl;
    }

    return null;
  }

  async function waitForAssignmentDownloadTarget() {
    const started = Date.now();
    let triedViewerOpenControl = false;

    while (Date.now() - started < CONFIG.linkWaitMs) {
      const anchor = findDownloadAnchor();
      if (anchor) return { kind: "anchor", url: anchor.href };

      const refs = inspectViewerReferences();
      const driveRef = refs.find((url) => extractDriveId(url));
      if (driveRef) return { kind: "viewer", url: driveRef };

      if (!triedViewerOpenControl && Date.now() - started > 1200) {
        triedViewerOpenControl = true;
        const openedUrl = captureEmbeddedViewerOpenUrl();
        if (openedUrl) return { kind: "viewer-open-control", url: openedUrl };
      }

      await sleep(350);
    }

    return null;
  }

  function makeFilename(label) {
    const week = getWeek(label) ?? "Unknown";
    let detail = label.replace(/^Week\\s*\\d+\\s*:\\s*/i, "").trim();
    detail = detail.replace(/[<>:"/\\\\|?*\\x00-\\x1f]/g, "").replace(/\\s+/g, " ").trim();
    return `${CONFIG.filenamePrefix} - Week ${week} - ${detail}.pdf`;
  }

  function triggerDriveDownload(fileId, filename) {
    const url = "https://drive.google.com/uc?export=download&id=" + encodeURIComponent(fileId);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.target = "_blank";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return url;
  }

  async function run() {
    if (!/onlinecourses\.nptel\.ac\.in$/i.test(location.hostname)) {
      fail("Run this utility from the NPTEL course page, not from a Drive tab.");
      return;
    }

    log("Scanning the course sidebar for Assignment Solution entries only...");

    const sidebar = findSidebar();
    if (!sidebar) {
      fail("Could not identify the course sidebar. Wait for the page to load and run again.");
      return;
    }

    const labels = collectAssignmentSolutionLabels(sidebar);
    if (!labels.length) {
      fail("No Lecture Assignment Solution rows were found. Scroll the sidebar to load all weeks, then run again.");
      return;
    }

    console.table(labels.map((label) => ({ week: getWeek(label), entry: label })));
    log("Found", labels.length, "Assignment Solution entries. Ordinary lecture/assignment/quiz rows will be ignored.");

    const results = [];

    for (let index = 0; index < labels.length; index++) {
      const label = labels[index];
      log(`[${index + 1}/${labels.length}] Opening only: ${label}`);

      let outcome = { success: false, label };

      for (let attempt = 1; attempt <= CONFIG.retries; attempt++) {
        try {
          // The SPA keeps the sidebar mounted while the content pane changes.
          const currentSidebar = findSidebar();
          if (!currentSidebar) throw new Error("Sidebar is no longer available.");

          clickExactRow(currentSidebar, label);
          await sleep(CONFIG.pageWaitMs);

          const target = await waitForAssignmentDownloadTarget();
          if (!target) {
            throw new Error("No visible assignment-solution download link or accessible Drive viewer reference was found on this page.");
          }

          const fileId = extractDriveId(target.url);
          if (!fileId) {
            throw new Error("A download/viewer target was found, but it did not expose a recognizable Google Drive file ID: " + target.url);
          }

          const filename = makeFilename(label);
          const downloadUrl = triggerDriveDownload(fileId, filename);

          success("Assignment solution download requested:", filename);
          outcome = { success: true, label, filename, fileId, downloadUrl };
          break;
        } catch (error) {
          warn(`Attempt ${attempt}/${CONFIG.retries} failed for "${label}":`, error.message);
          if (attempt < CONFIG.retries) await sleep(1500);
        }
      }

      results.push(outcome);

      if (index < labels.length - 1) await sleep(CONFIG.betweenItemsMs);
    }

    const successful = results.filter((item) => item.success);
    const failed = results.filter((item) => !item.success);

    console.log("\nNPTEL Assignment Solutions Downloader — Summary");
    console.table(results.map((item) => ({
      entry: item.label,
      status: item.success ? "Download requested" : "Failed",
      filename: item.filename || ""
    })));

    success(`${successful.length} download(s) requested; ${failed.length} item(s) failed.`);
    if (failed.length) warn("Review the failed Assignment Solution pages manually. Embedded cross-origin Drive viewers may not expose their final URL to a script running on NPTEL.");
    log("Check Chrome Downloads (Ctrl+J). Allow multiple downloads if Chrome asks.");
  }

  await run();
})();
