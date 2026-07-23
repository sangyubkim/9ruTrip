/** 9ruDocs apps/api/lib/wordpress.mjs 와 동일 패턴 */

function wpAuthHeader(username, appPassword) {
  const token = Buffer.from(`${username}:${appPassword}`).toString("base64");
  return `Basic ${token}`;
}

function wpBase(siteUrl) {
  return siteUrl.replace(/\/+$/, "");
}

async function wpFetch(siteUrl, username, appPassword, path, init = {}) {
  const url = `${wpBase(siteUrl)}/wp-json/wp/v2${path}`;
  const headers = {
    Authorization: wpAuthHeader(username, appPassword),
    ...(init.headers ?? {}),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.message ?? json?.code ?? `WordPress ${res.status}`;
    throw new Error(String(msg));
  }
  return json;
}

export async function uploadMedia(siteUrl, username, appPassword, image) {
  const buffer = Buffer.from(image.base64, "base64");
  const filename = image.filename ?? "image.jpg";
  const mime = image.mimeType ?? "image/jpeg";

  return wpFetch(siteUrl, username, appPassword, "/media", {
    method: "POST",
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
    body: buffer,
  });
}

export async function resolveTagIds(siteUrl, username, appPassword, tagNames) {
  const ids = [];
  for (const name of tagNames) {
    const trimmed = String(name).trim();
    if (!trimmed) continue;

    const found = await wpFetch(
      siteUrl,
      username,
      appPassword,
      `/tags?search=${encodeURIComponent(trimmed)}&per_page=5`,
    );

    const exact = Array.isArray(found)
      ? found.find((t) => t.name?.toLowerCase() === trimmed.toLowerCase())
      : null;

    if (exact?.id) {
      ids.push(exact.id);
      continue;
    }

    const created = await wpFetch(siteUrl, username, appPassword, "/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (created?.id) ids.push(created.id);
  }
  return [...new Set(ids)];
}

function buildSeoContent({ content, excerpt, seo }) {
  const summary = seo?.metaDescription ?? excerpt ?? "";
  const block = summary ? `> **요약:** ${summary}\n\n` : "";
  return block + content;
}

export async function publishToWordPress(body, env) {
  const siteUrl = body?.siteUrl?.trim() || env.wpSiteUrl;
  const username = body?.username?.trim() || env.wpUsername;
  const appPassword = body?.appPassword?.trim() || env.wpAppPassword;

  if (!siteUrl || !username || !appPassword) {
    throw new Error(
      "WordPress credentials missing. Set WP_SITE_URL, WP_USERNAME, WP_APP_PASSWORD in apps/api/.env",
    );
  }

  const title = String(body?.title ?? "").trim();
  const content = String(body?.content ?? body?.body ?? "").trim();
  if (!title || !content) {
    throw new Error("title and content are required");
  }

  const status = body?.status === "publish" ? "publish" : "draft";
  const excerpt = String(body?.excerpt ?? "").trim();
  const tagNames = Array.isArray(body?.tags) ? body.tags.map(String) : [];
  const images = Array.isArray(body?.images) ? body.images : [];
  const seo = body?.seo ?? {};

  const mediaIds = [];
  const mediaUrls = [];

  for (const img of images) {
    if (!img?.base64) continue;
    const media = await uploadMedia(siteUrl, username, appPassword, img);
    if (media?.id) mediaIds.push(media.id);
    if (media?.source_url) mediaUrls.push(media.source_url);
  }

  let finalContent = buildSeoContent({ content, excerpt, seo });

  if (mediaUrls.length) {
    const imgs = mediaUrls.map((u) => `![step](${u})`).join("\n\n");
    finalContent = `${finalContent}\n\n## 이미지\n\n${imgs}`;
  }

  const tagIds = tagNames.length
    ? await resolveTagIds(siteUrl, username, appPassword, tagNames)
    : [];

  const postPayload = {
    title,
    content: finalContent,
    excerpt,
    status,
    tags: tagIds,
  };

  if (mediaIds[0]) {
    postPayload.featured_media = mediaIds[0];
  }

  const post = await wpFetch(siteUrl, username, appPassword, "/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(postPayload),
  });

  return {
    postId: post.id,
    link: post.link,
    editLink: post.link ? `${post.link}?preview=true` : null,
    featuredMediaId: mediaIds[0] ?? null,
    tagIds,
    seoApplied: Boolean(excerpt || seo.metaDescription),
  };
}
