/**
 * Sidekick palette: Preview then Publish via AEM Admin API.
 * @see https://www.aem.live/docs/admin.html
 */

/* global chrome */

const ADMIN = 'https://admin.hlx.page';

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

/**
 * @param {string} webPath
 * @returns {string} Path segments for admin URL (no leading slash)
 */
function adminPathSegments(webPath) {
  let p = (webPath || '/').trim();
  if (!p || p === '/') return 'index';
  if (p.startsWith('/')) p = p.slice(1);
  return p.split('/').filter(Boolean).map((s) => encodeURIComponent(s)).join('/');
}

/**
 * Parse Sidekick passConfig / URL (ref, repo, owner, host).
 * @returns {{ ref: string, repo: string, owner: string }}
 */
function parseProjectParams() {
  const q = new URLSearchParams(window.location.search);
  const fromQuery = {
    ref: q.get('ref') || 'main',
    repo: q.get('repo') || '',
    owner: q.get('owner') || '',
  };

  const host = q.get('host') || '';
  if (host && (!fromQuery.repo || !fromQuery.owner)) {
    const m = host.match(/^([^-]+)--([^-]+)--([^.]+)\./);
    if (m) {
      const [, hRef, hRepo, hOwner] = m;
      return { ref: hRef, repo: hRepo, owner: hOwner };
    }
  }

  return fromQuery;
}

/**
 * @param {string} org
 * @param {string} site
 * @param {string} ref
 * @param {string} editUrl
 * @returns {Promise<string | null>}
 */
async function resolveWebPathFromEditUrl(org, site, ref, editUrl, candidates = ['index'], index = 0) {
  if (!editUrl || index >= candidates.length) return null;
  const seg = candidates[index];
  const url = new URL(`${ADMIN}/status/${encodeURIComponent(org)}/${encodeURIComponent(site)}/${encodeURIComponent(ref)}/${seg}`);
  url.searchParams.set('editUrl', editUrl);
  const res = await fetch(url.toString(), { credentials: 'include' });
  if (res.ok) {
    const data = await res.json();
    if (data.webPath) return data.webPath;
    if (typeof data.resourcePath === 'string') {
      return data.resourcePath.replace(/\.md$/i, '') || '/';
    }
  }
  return resolveWebPathFromEditUrl(org, site, ref, editUrl, candidates, index + 1);
}

/**
 * @param {string} org
 * @param {string} site
 * @param {string} ref
 * @param {string} webPath
 * @param {number} attempt
 * @returns {Promise<Response>}
 */
async function postPreview(org, site, ref, webPath, attempt = 0) {
  const seg = adminPathSegments(webPath);
  const url = `${ADMIN}/preview/${encodeURIComponent(org)}/${encodeURIComponent(site)}/${encodeURIComponent(ref)}/${seg}`;
  const res = await fetch(url, { method: 'POST', credentials: 'include' });
  if (res.status === 503 && attempt < 3) {
    await sleep(2000 * (attempt + 1));
    return postPreview(org, site, ref, webPath, attempt + 1);
  }
  return res;
}

/**
 * @param {string} org
 * @param {string} site
 * @param {string} ref
 * @param {string} webPath
 * @returns {Promise<object>}
 */
async function waitForPreviewReady(org, site, ref, webPath, attempt = 0) {
  const maxAttempts = 18;
  if (attempt >= maxAttempts) {
    throw new Error('プレビューが規定時間内に完了しませんでした。Path を確認するか、しばらく待ってから再試行してください。');
  }
  await sleep(1500);
  const seg = adminPathSegments(webPath);
  const statusUrl = `${ADMIN}/status/${encodeURIComponent(org)}/${encodeURIComponent(site)}/${encodeURIComponent(ref)}/${seg}`;
  const res = await fetch(statusUrl, { credentials: 'include' });
  if (res.ok) {
    const data = await res.json();
    if (data.preview?.status === 200) return data;
  }
  return waitForPreviewReady(org, site, ref, webPath, attempt + 1);
}

/**
 * @param {string} org
 * @param {string} site
 * @param {string} ref
 * @param {string} webPath
 * @returns {Promise<Response>}
 */
async function postLive(org, site, ref, webPath) {
  const seg = adminPathSegments(webPath);
  const url = `${ADMIN}/live/${encodeURIComponent(org)}/${encodeURIComponent(site)}/${encodeURIComponent(ref)}/${seg}`;
  return fetch(url, { method: 'POST', credentials: 'include' });
}

/**
 * @param {object} data
 * @param {string} org
 * @param {string} site
 * @param {string} ref
 * @param {string} webPath
 * @returns {string}
 */
function deriveLiveUrl(data, org, site, ref, webPath) {
  if (data.links?.live) return data.links.live;
  const wp = data.webPath || webPath;
  const path = typeof wp === 'string' && wp.startsWith('/') ? wp : `/${wp || ''}`;
  return `https://${ref}--${site}--${org}.aem.live${path === '//' ? '/' : path}`;
}

/**
 * @param {string} orchestratorUrl
 * @param {object} payload
 * @returns {Promise<{ liveUrl: string }>}
 */
async function runViaOrchestrator(orchestratorUrl, payload) {
  const res = await fetch(orchestratorUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Orchestrator ${res.status}`);
  }
  return res.json();
}

function closeSidekickPalette() {
  const extensionIds = [
    'igkmdomcgoebiipaifhmpfjhbjccggml',
    'ccfggkjabjahcjoljmgmklhpaccedipo',
  ];
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
  extensionIds.forEach((extensionId) => {
    try {
      chrome.runtime.sendMessage(extensionId, { id: 'preview-publish', action: 'closePalette' });
    } catch {
      /* ignore */
    }
  });
}

/**
 * @param {HTMLElement} logEl
 * @param {string} message
 * @param {boolean} isError
 */
function setLog(logEl, message, isError = false) {
  logEl.textContent = message;
  logEl.classList.toggle('pp-log-error', isError);
}

async function run() {
  const pathInput = document.querySelector('#pp-path');
  const runBtn = document.querySelector('#pp-run');
  const logEl = document.querySelector('#pp-log');

  if (!pathInput || !runBtn || !logEl) return;

  const q = new URLSearchParams(window.location.search);
  const orchestratorUrl = q.get('orchestrator')?.trim();
  const referrer = q.get('referrer') || '';

  const { ref, repo, owner } = parseProjectParams();
  if (!repo || !owner) {
    setLog(logEl, 'owner / repo を取得できませんでした。Sidekick の passConfig を有効にしてください。', true);
    return;
  }

  const org = owner;
  const site = repo;

  runBtn.disabled = true;
  setLog(logEl, '開始…');

  try {
    let webPath = pathInput.value.trim() || '/';

    if (orchestratorUrl) {
      setLog(logEl, 'サーバー経由で実行中…');
      const { liveUrl } = await runViaOrchestrator(orchestratorUrl, {
        org,
        site,
        ref,
        path: webPath,
        referrer,
      });
      if (liveUrl) window.open(liveUrl, '_blank', 'noopener');
      setLog(logEl, '完了しました。ライブを開きました。');
      closeSidekickPalette();
      return;
    }

    if (referrer && (webPath === '/' || webPath === '/index')) {
      setLog(logEl, '編集元 URL から path を解決…');
      const resolved = await resolveWebPathFromEditUrl(org, site, ref, referrer);
      if (resolved) {
        webPath = resolved.startsWith('/') ? resolved : `/${resolved}`;
        pathInput.value = webPath;
      }
    }

    setLog(logEl, 'プレビュー更新中…（数秒かかることがあります）');
    const previewRes = await postPreview(org, site, ref, webPath);
    if (!previewRes.ok) {
      const errText = await previewRes.text();
      throw new Error(errText || `プレビュー失敗 (${previewRes.status})`);
    }

    setLog(logEl, 'プレビュー反映を待機中…');
    await waitForPreviewReady(org, site, ref, webPath);

    setLog(logEl, '公開中…');
    const liveRes = await postLive(org, site, ref, webPath);
    if (!liveRes.ok) {
      const errText = await liveRes.text();
      throw new Error(errText || `公開失敗 (${liveRes.status})`);
    }

    const liveData = await liveRes.json();
    const liveUrl = deriveLiveUrl(liveData, org, site, ref, webPath);
    if (liveUrl) window.open(liveUrl, '_blank', 'noopener');
    setLog(logEl, '完了しました。ライブ（.aem.live）を開きました。');
    closeSidekickPalette();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setLog(
      logEl,
      `${msg}\n\nブラウザからの直接呼び出しがブロックされている場合は、App Builder の orchestrator URL をクエリ ?orchestrator= に付与してください。`,
      true,
    );
  } finally {
    runBtn.disabled = false;
  }
}

function init() {
  const runBtn = document.querySelector('#pp-run');
  const logEl = document.querySelector('#pp-log');
  if (runBtn) runBtn.addEventListener('click', () => run());
  if (logEl) {
    const { ref, repo, owner } = parseProjectParams();
    setLog(
      logEl,
      `準備完了（owner=${owner || '?'}, repo=${repo || '?'}, ref=${ref}）\n「プレビューして公開」をクリックしてください。`,
    );
  }
}

init();
