/*
 * NPTEL Notes Downloader
 * Browser-console utility for downloading NPTEL lecture-note PDFs.
 *
 * Usage: Open the NPTEL course page, open DevTools Console, and paste
 * this complete file. Review detected entries before allowing downloads.
 *
 * This utility only targets sidebar items labelled "Lecture Notes".
 * It does not click ordinary lecture, assignment, quiz, or feedback rows.
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
  const notePattern = /^Week\s*\d+\s*:\s*Lecture\s*Notes?$/i;
  const numberedNotePattern = /^Lecture\s*Note[_\s-]*\d+\s+for\s+Week\s*\d+$/i;

  const log = (...args) => console.log("%c[NPTEL Notes]", "color:#0891b2;font-weight:bold", ...args);
  const success = (...args) => console.log("%c[NPTEL Notes] ✓", "color:#16a34a;font-weight:bold", ...args);
  const warn = (...args) => console.warn("%c[NPTEL Notes]", "color:#d97706;font-weight:bold", ...args);
  const fail = (...args) => console.error("%c[NPTEL Notes]", "color:#dc2626;font-weight:bold", ...args);

  function isNoteLabel(text) {
    const value = normalize(text);
    return notePattern.test(value) || numberedNotePattern.test(value);
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
      if (!text || !/Week\s*\d+/i.test(text) || !/Lecture/i.test(text)) continue;

      const weekCount = (text.match(/Week\s*\d+/gi) || []).length;
      const noteCount = (text.match(/Lecture\s*Notes?/gi) || []).length;
      const score = Math.min(weekCount, 30) * 3 + Math.min(noteCount, 20) * 8 +
        (element.scrollHeight > element.clientHeight + 40 ? 12 : 0) -
        Math.max(0, rect.width - 450) / 20;

      if (score > bestScore) {
        best = element;
        bestScore = score;
      }
    }

    return best;
  }

  function collectNoteLabels(sidebar) {
    const labels = new Set();

    for (const element of sidebar.querySelectorAll("*")) {
      const label = normalize(element.innerText);
      if (label && label.length <= 90 && isNoteLabel(label)) labels.add(label);
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

    // The visible wording supplied from the course page.
    const byText = anchors.find((anchor) => {
      const text = normalize(anchor.innerText || anchor.textContent).toLowerCase();
      return text.includes("click here") && text.includes("download");
    });
    if (byText) return byText;

    const byDownloadText = anchors.find((anchor) => {
      const text = normalize(anchor.innerText || anchor.textContent).toLowerCase();
      return text.includes("download lecture notes");
    });
    if (byDownloadText) return byDownloadText;

    // Some lesson pages expose a Drive URL directly.
    return anchors.find((anchor) => /drive\.google\.com|docs\.google\.com/i.test(anchor.href)) || null;
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

  async function waitForNoteDownloadTarget() {
    const started = Date.now();

    while (Date.now() - started < CONFIG.linkWaitMs) {
      const anchor = findDownloadAnchor();
      if (anchor) return { kind: "anchor", url: anchor.href };

      const refs = inspectViewerReferences();
      const driveRef = refs.find((url) => extractDriveId(url));
      if (driveRef) return { kind: "viewer", url: driveRef };

      await sleep(350);
    }

    return null;
  }

  function makeFilename(label) {
    const week = getWeek(label) ?? "Unknown";
    let detail = label.replace(/^Week\s*\d+\s*:\s*/i, "").trim();
    if (!detail || /^Lecture\s*Notes?$/i.test(detail)) detail = "Lecture Notes";
    detail = detail.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").replace(/\s+/g, " ").trim();
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

    log("Scanning the course sidebar for Lecture Notes entries only...");

    const sidebar = findSidebar();
    if (!sidebar) {
      fail("Could not identify the course sidebar. Wait for the page to load and run again.");
      return;
    }

    const labels = collectNoteLabels(sidebar);
    if (!labels.length) {
      fail("No Lecture Notes rows were found. Scroll the sidebar to load all weeks, then run again.");
      return;
    }

    console.table(labels.map((label) => ({ week: getWeek(label), entry: label })));
    log("Found", labels.length, "Notes entries. Ordinary lecture/assignment/quiz rows will be ignored.");

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

          const target = await waitForNoteDownloadTarget();
          if (!target) {
            throw new Error("No visible download link or accessible Drive viewer reference was found on this Notes page.");
          }

          const fileId = extractDriveId(target.url);
          if (!fileId) {
            throw new Error("A download/viewer target was found, but it did not expose a recognizable Google Drive file ID: " + target.url);
          }

          const filename = makeFilename(label);
          const downloadUrl = triggerDriveDownload(fileId, filename);

          success("Download requested:", filename);
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

    console.log("\nNPTEL Notes Downloader — Summary");
    console.table(results.map((item) => ({
      entry: item.label,
      status: item.success ? "Download requested" : "Failed",
      filename: item.filename || ""
    })));

    success(`${successful.length} download(s) requested; ${failed.length} item(s) failed.`);
    if (failed.length) warn("Review the failed Notes pages manually. Embedded cross-origin Drive viewers may not expose their final URL to a script running on NPTEL.");
    log("Check Chrome Downloads (Ctrl+J). Allow multiple downloads if Chrome asks.");
  }

  await run();
})();
