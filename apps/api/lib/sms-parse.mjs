/**
 * 한국 카드/은행 SMS 패턴 파서 (best-effort)
 * Expo에서 SMS 읽기 권한이 막혀도 붙여넣기 플로우와 동일 로직 공유
 */
export function parseKoreanCardSms(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return { ok: false, error: "empty SMS text" };
  }

  const normalized = raw.replace(/\u00a0/g, " ").replace(/,/g, "");

  // 금액: 12,000원 / 12000원 / KRW 12000 / 승인금액 12000
  const amountPatterns = [
    /(?:승인|이용|결제|출금|사용)?\s*(?:금액)?\s*(\d{3,9})\s*원/,
    /KRW\s*(\d{3,9})/i,
    /(\d{3,9})\s*원\s*(?:일시불|할부|승인|결제)?/,
    /₩\s*(\d{3,9})/,
  ];

  let amountKrw = null;
  for (const re of amountPatterns) {
    const m = normalized.match(re);
    if (m) {
      amountKrw = Number(m[1]);
      if (Number.isFinite(amountKrw) && amountKrw > 0) break;
      amountKrw = null;
    }
  }

  if (!amountKrw) {
    return { ok: false, error: "amount not found", raw };
  }

  // 가맹점: 흔히 금액 앞/뒤 한글·영문 상호
  let merchant = null;
  const merchantPatterns = [
    /(?:가맹점명|사용처|업체)\s*[:：]?\s*([^\n\r]{2,40})/,
    /\]\s*([가-힣A-Za-z0-9 &·.\-]{2,30})\s+(?:\d{3,9}\s*원|승인)/,
    /(\d{3,9}\s*원)\s+([가-힣A-Za-z0-9 &·.\-]{2,30})/,
    /([가-힣A-Za-z0-9 &·.\-]{2,30})\s+(\d{3,9}\s*원)/,
  ];

  for (const re of merchantPatterns) {
    const m = raw.replace(/,/g, "").match(re);
    if (!m) continue;
    const cand = (m[2] || m[1] || "").trim();
    if (
      cand &&
      !/^\d+$/.test(cand) &&
      !/원$/.test(cand) &&
      !/(승인|일시불|체크|신용|카드)$/.test(cand)
    ) {
      merchant = cand.replace(/\s{2,}/g, " ").slice(0, 40);
      break;
    }
  }

  if (!merchant) {
    // 카드사 태그 제거 후 짧은 한글 덩어리
    const cleaned = raw
      .replace(/\[[^\]]+\]/g, " ")
      .replace(/\d{3,9}\s*원/g, " ")
      .replace(/(승인|일시불|체크카드|신용카드|결제|이용)/g, " ")
      .replace(/\d{1,2}\/\d{1,2}|\d{2}:\d{2}/g, " ");
    const ko = cleaned.match(/[가-힣A-Za-z][가-힣A-Za-z0-9 &·.\-]{1,28}/);
    if (ko) merchant = ko[0].trim();
  }

  // JPY 추정 (도쿄 MVP): 단순 환율 약 0.1 — 표시용, 사용자 수정 가능
  const approxJpy = Math.round(amountKrw * 0.11);

  return {
    ok: true,
    amountKrw,
    amountJpyEstimate: approxJpy,
    merchant: merchant || "카드결제",
    currencyHint: "KRW",
    raw,
  };
}
