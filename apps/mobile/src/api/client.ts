let baseUrl = "";

export function setApiClientBaseUrl(url: string) {
  baseUrl = url.replace(/\/$/, "");
}

export function getApiClientBaseUrl() {
  return baseUrl;
}

/** 네트워크·주소 오류 시 사용자용 안내 (9ruDocs client 와 유사, 최소) */
export function formatApiConnectionError(
  e: unknown,
  apiBaseUrl?: string,
): string {
  const base = (apiBaseUrl ?? baseUrl).trim();
  const msg = e instanceof Error ? e.message : String(e);
  if (
    /network request failed|failed to fetch|fetch failed|network error|econnrefused|enotfound|etimedout|cleartext|ssl|certificate/i.test(
      msg,
    )
  ) {
    const addr = base || "http://192.168.x.x:3011";
    const cloudHint = /cloudwaysapps\.com|\/apps\/(trip-)?api/i.test(addr)
      ? "\n\nCloudways라면 URL 끝이 /apps/api (또는 /apps/trip-api) 인지 확인하세요.\n" +
        "9ruDocs API URL과는 별개입니다. 휴대폰 인터넷이 되는지도 확인하세요.\n" +
        "가이드: docs/CLOUDWAYS.md"
      : "\n\n1) PC·폰 같은 Wi-Fi (로컬 API)\n" +
        "2) 루트에서 npm run api (포트 3011)\n" +
        "3) 실기기: http://PC의IPv4:3011\n" +
        "4) 외부망: Cloudways HTTPS URL (docs/CLOUDWAYS.md)";
    return (
      "9ruTrip API에 연결할 수 없습니다.\n\n" +
      `현재 API 주소: ${addr}` +
      cloudHint
    );
  }
  return msg;
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (!baseUrl) {
    throw new Error(
      "API 주소가 없습니다. 설정에서 PC IP:3011 또는 Cloudways …/apps/api 를 입력하세요.",
    );
  }
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    return await fetch(url, init);
  } catch (e) {
    throw new Error(formatApiConnectionError(e, baseUrl));
  }
}
