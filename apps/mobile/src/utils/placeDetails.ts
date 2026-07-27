import type { ItineraryPlace } from "../types";

type DetailPlace = Pick<
  ItineraryPlace,
  | "category"
  | "openingHours"
  | "restDate"
  | "phone"
  | "address"
  | "officialMenu"
  | "signatureFood"
  | "admissionFee"
  | "checkInTime"
  | "checkOutTime"
  | "reservationUrl"
  | "reservationInfo"
>;

/**
 * 장소 상세 한 줄들 — 값이 있을 때만. "없음" 문구는 쓰지 않음.
 */
export function placeDetailLines(
  place: DetailPlace,
  { maxLines = 4 }: { maxLines?: number } = {},
): string[] {
  const lines: string[] = [];
  if (place.category === "food") {
    if (place.openingHours) lines.push(`영업 ${place.openingHours}`);
    if (place.restDate) lines.push(`휴무 ${place.restDate}`);
    if (place.phone) lines.push(`전화 ${place.phone}`);
    if (place.address) lines.push(place.address);
    const menu = place.officialMenu || place.signatureFood;
    if (menu) lines.push(`메뉴 ${menu}`);
  } else if (place.category === "attraction") {
    if (place.openingHours) lines.push(`이용 ${place.openingHours}`);
    if (place.restDate) lines.push(`휴무 ${place.restDate}`);
    if (place.admissionFee) lines.push(`입장 ${place.admissionFee}`);
    if (place.phone) lines.push(`문의 ${place.phone}`);
    if (place.address) lines.push(place.address);
  } else if (place.category === "hotel") {
    const check = [
      place.checkInTime ? `체크인 ${place.checkInTime}` : "",
      place.checkOutTime ? `체크아웃 ${place.checkOutTime}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    if (check) lines.push(check);
    if (place.phone) lines.push(`전화 ${place.phone}`);
    const reservation = place.reservationUrl || place.reservationInfo;
    if (reservation) lines.push(`예약 ${reservation}`);
    if (place.address) lines.push(place.address);
  }
  return lines.slice(0, Math.max(1, maxLines));
}
