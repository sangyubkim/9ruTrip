let baseUrl = "";

export function setApiClientBaseUrl(url: string) {
  baseUrl = url.replace(/\/$/, "");
}

export function getApiClientBaseUrl() {
  return baseUrl;
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (!baseUrl) throw new Error("API base URL not set");
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, init);
  return res;
}
