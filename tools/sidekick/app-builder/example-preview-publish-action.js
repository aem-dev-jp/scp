/**
 * App Builder / Adobe I/O Runtime 用の参考実装（単一アクション）。
 * デプロイ後の URL を Sidekick のパレットに ?orchestrator= で渡すか、
 * config.json の url にクエリを付与して利用します。
 *
 * 環境変数例: ADMIN_API_AUTH_HEADER（Bearer … または x-api-key 等、プロジェクトの Admin API 契約に合わせる）
 *
 * @see https://www.aem.live/docs/admin.html
 */

const ADMIN = 'https://admin.hlx.page';

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

function adminPathSegments(webPath) {
  let p = (webPath || '/').trim();
  if (!p || p === '/') return 'index';
  if (p.startsWith('/')) p = p.slice(1);
  return p.split('/').filter(Boolean).map((s) => encodeURIComponent(s)).join('/');
}

async function postPreview(org, site, ref, webPath, authHeader) {
  const seg = adminPathSegments(webPath);
  const url = `${ADMIN}/preview/${encodeURIComponent(org)}/${encodeURIComponent(site)}/${encodeURIComponent(ref)}/${seg}`;
  return fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });
}

async function waitForPreview(org, site, ref, webPath, authHeader, attempt = 0) {
  if (attempt >= 18) {
    throw new Error('Preview did not become ready in time');
  }
  await sleep(1500);
  const seg = adminPathSegments(webPath);
  const statusUrl = `${ADMIN}/status/${encodeURIComponent(org)}/${encodeURIComponent(site)}/${encodeURIComponent(ref)}/${seg}`;
  const res = await fetch(statusUrl, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });
  if (res.ok) {
    const data = await res.json();
    if (data.preview?.status === 200) return data;
  }
  return waitForPreview(org, site, ref, webPath, authHeader, attempt + 1);
}

async function postLive(org, site, ref, webPath, authHeader) {
  const seg = adminPathSegments(webPath);
  const url = `${ADMIN}/live/${encodeURIComponent(org)}/${encodeURIComponent(site)}/${encodeURIComponent(ref)}/${seg}`;
  return fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });
}

function deriveLiveUrl(data, org, site, ref, webPath) {
  if (data.links?.live) return data.links.live;
  const wp = data.webPath || webPath;
  const path = typeof wp === 'string' && wp.startsWith('/') ? wp : `/${wp || ''}`;
  return `https://${ref}--${site}--${org}.aem.live${path === '//' ? '/' : path}`;
}

/**
 * I/O Runtime の main(params, logger) 形式を想定したエントリ。
 * params: { org, site, ref, path, ADMIN_API_AUTH_HEADER }
 * @param {object} params
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
async function main(params) {
  const {
    org,
    site,
    ref,
    path: webPath = '/',
    ADMIN_API_AUTH_HEADER: authHeader,
  } = params;

  if (!org || !site || !ref || !authHeader) {
    return {
      statusCode: 400,
      body: { error: 'Missing org, site, ref, or ADMIN_API_AUTH_HEADER' },
    };
  }

  const previewRes = await postPreview(org, site, ref, webPath, authHeader);
  if (!previewRes.ok) {
    return { statusCode: previewRes.status, body: { error: await previewRes.text() } };
  }

  await waitForPreview(org, site, ref, webPath, authHeader);

  const liveRes = await postLive(org, site, ref, webPath, authHeader);
  if (!liveRes.ok) {
    return { statusCode: liveRes.status, body: { error: await liveRes.text() } };
  }

  const liveData = await liveRes.json();
  const liveUrl = deriveLiveUrl(liveData, org, site, ref, webPath);
  return { statusCode: 200, body: { liveUrl } };
}

export default main;
