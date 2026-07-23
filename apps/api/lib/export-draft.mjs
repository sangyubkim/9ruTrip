/**
 * 여행 리뷰 → 9ruDocs BlogDraft 호환 페이로드
 * (모바일/9ruDocs publish API로 넘길 수 있는 형태)
 */
export function buildExportDraft(trip) {
  const now = new Date().toISOString();
  const cityName = trip?.cityName || "도쿄";
  const nights = Number(trip?.nights) || 0;
  const days = Number(trip?.days) || 0;
  const partySize = Number(trip?.partySize) || 1;
  const reviews = Array.isArray(trip?.reviews) ? trip.reviews : [];

  const sorted = [...reviews].sort(
    (a, b) => Number(a.order ?? 0) - Number(b.order ?? 0),
  );

  const steps = sorted.map((r, i) => {
    const place = r.placeName ? `[${r.placeName}] ` : "";
    const rating = r.rating ? ` ★${r.rating}` : "";
    return {
      id: String(r.id || `step-${i}`),
      imageUri: r.imageUri ?? null,
      caption: `${place}${String(r.caption || "").trim()}${rating}`.trim(),
      order: i,
    };
  });

  const body =
    steps.length === 0
      ? `# ${cityName} 여행\n\n아직 리뷰가 없습니다.\n`
      : [
          `# ${cityName} ${nights}박 ${days}일 여행 후기\n`,
          ...steps.map(
            (s, i) =>
              `## ${i + 1}. ${s.caption || "기록"}\n\n${s.imageUri ? "(사진 있음 — 업로드 시 첨부)\n" : ""}\n`,
          ),
        ].join("\n");

  return {
    id: `export-${trip?.id || Date.now()}`,
    title: `${cityName} ${nights}박 ${days}일 여행 후기`,
    steps,
    body,
    excerpt: `${cityName} 여행 기록 · ${partySize}명 · 9ruTrip`,
    tags: [cityName, "여행", "9ruTrip", String(trip?.cityId || "tokyo")],
    createdAt: now,
    updatedAt: now,
    /** 9ruDocs API로 이어갈 때 참고 */
    publishHint: {
      endpoint: "/blog/generate 또는 WordPress publish",
      compatibleWith: "@9rudocs/shared BlogDraft",
    },
  };
}
