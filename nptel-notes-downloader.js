/*
 * NPTEL Notes & Assignment Solutions Downloader
 * Browser-console utility for NPTEL course materials.
 *
 * Run this file from an open NPTEL course page. The utility asks whether
 * to download Lecture Notes or Assignment Solutions, then targets only
 * the matching sidebar entries.
 */

(async () => {
  "use strict";

  const CONFIG = {
    pageWaitMs: 2500,
    linkWaitMs: 12000,
    betweenItemsMs: 2200,
    retries: 2,
    filenamePrefix: "NPTEL"
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalize = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

  const log = (...args) => console.log("%c[NPTEL Downloader]", "color:#0891b2;font-weight:bold", ...args);
  const success = (...args) => console.log("%c[NPTEL Downloader] ✓", "color:#16a34a;font-weight:bold", ...args);
  const warn = (...args) => console.warn("%c[NPTEL Downloader]", "color:#d97706;font-weight:bold", ...args);
  const fail = (...args) => console.error("%c[NPTEL Downloader]", "color:#dc2626;font-weight:bold", ...args);

  // Ask for the download category before scanning or clicking the sidebar.
  const selection = window.prompt(
    "NPTEL Notes & Assignment Solutions Downloader\n\nWhat would you like to download?\n\n1 - Lecture Notes\n2 - Assignment Solutions\n\nEnter 1 or 2:",
    "1"
  );

  if (selection === null) {
    log("Cancelled. No course items were opened.");
    return;
  }

  const choice = normalize(selection).toLowerCase();
  let mode;

  if (["1", "note", "notes", "lecture note", "lecture notes"].includes(choice)) {
    mode = "notes";
  } else if (["2", "assignment", "assignments", "assignment solution", "assignment solutions"].includes(choice)) {
    mode = "assignments";
  } else {
    fail("Invalid selection. Run again and enter 1 for Lecture Notes or 2 for Assignment Solutions.");
    return;
  }

  const MODE = mode === "notes"
    ? {
        title: "Lecture Notes",
        sidebarDescription: "Lecture Notes",
        matches: (text) => {
          const value = normalize(text);
          return /^Week\s*\d+\s*:\s*Lecture\s*Notes?$/i.test(value) ||
            /^Lecture\s*Note[_\s-]*\d+\s+for\s+Week\s*\d+$/i.test(value);
        },
        downloadTextMatches: (text) => text.includes("lecture notes"),
        filenameDetail: (label) => {
          let detail = label.replace(/^Week\s*\d+\s*:\s*/i, "").trim();
          return detail || "Lecture Notes";
        }
      }
    : {
        title: "Assignment Solutions",
        sidebarDescription: "Assignment Solution",
        matches: (text) => {
          const value = normalize(text);
          return /^Week\s*\d+\s*:\s*Assignment\s*\d+\s*Solution$/i.test(value) ||
            /^Assignment\s*\d+\s*Solution\s+for\s+Week\s*\d+$/i.test(value);
        },
        downloadTextMatches: (text) => text.includes("assignment") || text.includes("solution"),
        filenameDetail: (label) => label.replace(/^Week\s*\d+\s*:\s*/i, "").trim()
      };

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
      if (rect.width < 140 || rect.height < 160 || rect.left > window.innerWidth * 0.55) continue;

      const text = normalize(element.innerText);
      if (!text || !/Week\s*\d+/i.test(text)) continue;

      const weekCount = (text.match(/Week\s*\d+/gi) || []).length;
      const targetCount = MODE.matchesTargetText
        ? (text.match(MODE.matchesTargetText) || []).length
        : MODE.sidebarDescription === "Lecture Notes"
          ? (text.match(/Lecture\s*Notes?/gi) || []).length
          : (text.match(/Assignment\s*\d+\s*Solution/gi) || []).length;

      if (!targetCount) continue;

      const score = Math.min(weekCount, 30) * 3 +
        Math.min(targetCount, 20) * 10 +
        (element.scrollHeight > element.clientHeight + 40 ? 12 : 0) -
        Math.max(0, rect.width - 450) / 20;

      if (score > bestScore) {
        best = element;
        bestScore = score;
      }
    }

    return best;
  }

  function collectTargetLabels(sidebar) {
    const labels = new Set();

    for (const element of sidebar.querySelectorAll("*")) {
      const label = normalize(element.innerText);
      if (label && label.length <= 120 && MODE.matches(label)) {
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

    // Prefer the smallest exact-text node, not the whole Week container.
    matches.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (ra.width * ra.height) - (rb.width * rb.height);
    });

    return matches[0];
  }

  async function expandWeek(sidebar, week) {
    const weekHeaderPattern = new RegExp("^Week\\s*" + week + "$", "i");
    const headers = [...sidebar.querySelectorAll("*")].filter((element) => {
      return normalize(element.innerText) === "Week " + week ||
        weekHeaderPattern.test(normalize(element.innerText));
    });

    if (!headers.length) return false;

    headers.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (ra.width * ra.height) - (rb.width * rb.height);
    });

    const header = headers[0];
    header.scrollIntoView({ block: "center", behavior: "instant" });
    await sleep(250);
    header.click();
    await sleep(650);
    return true;
  }

  async function clickTargetRow(label) {
    let sidebar = findSidebar();
    if (!sidebar) throw new Error("Course sidebar could not be identified.");

    let row = findExactRow(sidebar, label);

    if (!row) {
      const week = getWeek(label);
      if (week !== null) {
        log("Target row is not visible. Expanding Week", week);
        await expandWeek(sidebar, week);
      }

      sidebar = findSidebar();
      row = sidebar ? findExactRow(sidebar, label) : null;
    }

    if (!row) throw new Error("Could not find exact sidebar row: " + label);

    row.scrollIntoView({ block: "center", behavior: "instant" });
    await sleep(350);
    log("Clicking only the exact row:", label);
    row.click();
    await sleep(CONFIG.pageWaitMs);
  }

  function findDownloadAnchor() {
    const anchors = [...document.querySelectorAll("a[href]")];

    const byClickHere = anchors.find((anchor) => {
      const text = normalize(anchor.innerText || anchor.textContent).toLowerCase();
      return text.includes("click here") && text.includes("download");
    });
    if (byClickHere) return byClickHere;

    const byModeText = anchors.find((anchor) => {
      const text = normalize(anchor.innerText || anchor.textContent).toLowerCase();
      return text.includes("download") && MODE.downloadTextMatches(text);
    });
    if (byModeText) return byModeText;

    return anchors.find((anchor) => /drive\.google\.com|docs\.google\.com/i.test(anchor.href)) || null;
  }

  function extractDriveId(url) {
    if (!url) return null;

    let value = String(url);
    for (let i = 0; i < 2; i++) {
      try {
        const decoded = decodeURIComponent(value);
        if (decoded === value) break;
        value = decoded;
      } catch {
        break;
      }
    }

    const patterns = [
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
      /docs\.google\.com\/[^/]+\/d\/([a-zA-Z0-9_-]+)/i,
      /[?&]id=([a-zA-Z0-9_-]+)/i
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (match?.[1]) return match[1];
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
        /open|external|new tab|new window/i.test(label))) refs.push(href);
    }

    return [...new Set(refs)];
  }

  // Some NPTEL pages display a PDF viewer with an open/external control
  // in the top-right corner. Capture URLs opened through window.open()
  // when the control is part of the NPTEL document. Cross-origin iframe
  // contents remain inaccessible to this script.
  function captureEmbeddedViewerOpenUrl() {
    const viewers = [...document.querySelectorAll("iframe, embed, object")];
    const candidates = [];

    for (const viewer of viewers) {
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

          const rect = control.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;

          const nearTop = rect.top <= viewerRect.top + 90;
          const nearRight = rect.right >= viewerRect.right - 110;
          const labelled = /(open|new window|new tab|pop.?out|external|launch)/i.test(label);

          if (labelled || (nearTop && nearRight)) {
            candidates.push({
              control,
              score: (nearTop ? 2 : 0) + (nearRight ? 3 : 0) + (labelled ? 4 : 0) +
                (control.href ? 2 : 0)
            });
          }
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
      } catch {
        // Try the next likely control.
      } finally {
        window.open = originalOpen;
      }

      if (capturedUrl) return capturedUrl;
    }

    return null;
  }

  async function waitForDownloadTarget() {
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
    const detail = MODE.filenameDetail(label)
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return CONFIG.filenamePrefix + " - Week " + week + " - " + detail + ".pdf";
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
      fail("Run this utility from the NPTEL course page, not from a Google Drive tab.");
      return;
    }

    log("Selected download type:", MODE.title);
    log("Scanning the course sidebar for matching entries only...");

    const sidebar = findSidebar();
    if (!sidebar) {
      fail("Could not identify the course sidebar. Wait for the page to load and try again.");
      return;
    }

    const labels = collectTargetLabels(sidebar);
    if (!labels.length) {
      fail("No " + MODE.title + " entries were found. Scroll the sidebar to load all weeks, then run again.");
      return;
    }

    console.table(labels.map((label) => ({ week: getWeek(label), entry: label })));
    log("Found", labels.length, MODE.title, "entries. Other lesson types will be ignored.");

    const results = [];

    for (let index = 0; index < labels.length; index++) {
      const label = labels[index];
      log("[" + (index + 1) + "/" + labels.length + "] Opening only: " + label);

      let outcome = { success: false, label };

      for (let attempt = 1; attempt <= CONFIG.retries; attempt++) {
        try {
          await clickTargetRow(label);

          log("Current page:", location.href);
          log("Looking for the download link or an accessible embedded viewer reference...");

          const target = await waitForDownloadTarget();
          if (!target) {
            throw new Error("No download link or accessible Drive viewer reference was found on this page.");
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
          warn("Attempt " + attempt + "/" + CONFIG.retries + " failed for \"" + label + "\":", error.message);
          if (attempt < CONFIG.retries) await sleep(1600);
        }
      }

      results.push(outcome);
      if (index < labels.length - 1) await sleep(CONFIG.betweenItemsMs);
    }

    const successful = results.filter((item) => item.success);
    const failed = results.filter((item) => !item.success);

    console.log("\nNPTEL Downloader — " + MODE.title + " summary");
    console.table(results.map((item) => ({
      entry: item.label,
      status: item.success ? "Download requested" : "Failed",
      filename: item.filename || ""
    })));

    success(successful.length + " download(s) requested; " + failed.length + " item(s) failed.");
    if (failed.length) {
      warn("Review failed pages manually. Embedded cross-origin Drive viewers may not expose their final URL to a script running on NPTEL.");
    }
    log("Check Chrome Downloads (Ctrl+J). Allow multiple downloads if Chrome asks.");
  }

  await run();
})();
