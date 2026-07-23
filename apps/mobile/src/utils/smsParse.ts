/**
 * 한국 카드 SMS 파서 — API와 동일 규칙 (오프라인 폴백)
 */
export type ParsedSms = {
  ok: boolean;
  amountKrw?: number;
  amountJpyEstimate?: number;
  merchant?: string;
  error?: string;
};

export function parseKoreanCardSmsLocal(text: string): ParsedSms {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, error: "빈 문자" };

  const normalized = raw.replace(/\u00a0/g, " ").replace(/,/g, "");
  const amountPatterns = [
    /(?:승인|이용|결제|출금|사용)?\s*(?:금액)?\s*(\d{3,9})\s*원/,
    /KRW\s*(\d{3,9})/i,
    /(\d{3,9})\s*원\s*(?:일시불|할부|승인|결제)?/,
    /₩\s*(\d{3,9})/,
  ];

  let amountKrw: number | null = null;
  for (const re of amountPatterns) {
    const m = normalized.match(re);
    if (m) {
      amountKrw = Number(m[1]);
      if (Number.isFinite(amountKrw) && amountKrw > 0) break;
      amountKrw = null;
    }
  }
  if (!amountKrw) return { ok: false, error: "금액을 찾지 못했습니다" };

  let merchant: string | null = null;
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

  return {
    ok: true,
    amountKrw,
    amountJpyEstimate: Math.round(amountKrw * 0.11),
    merchant: merchant || "카드결제",
  };
}
