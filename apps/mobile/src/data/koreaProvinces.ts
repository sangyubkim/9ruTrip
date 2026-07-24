/** 국내 도(광역) → 도시 카탈로그 — 여행지 선택 UI용 */

export type ProvinceId =
  | "seoul"
  | "incheon"
  | "gyeonggi"
  | "gangwon"
  | "chungbuk"
  | "chungnam"
  | "daejeon"
  | "sejong"
  | "jeonbuk"
  | "jeonnam"
  | "gwangju"
  | "gyeongbuk"
  | "daegu"
  | "gyeongnam"
  | "busan"
  | "ulsan"
  | "jeju";

export type ProvinceMeta = {
  id: ProvinceId;
  nameKo: string;
  /** 약칭 (지도 셀) */
  shortKo: string;
  cityIds: string[];
  /** 간이 지도 그리드 위치 (row, col) */
  row: number;
  col: number;
  colSpan?: number;
};

export const KOREA_PROVINCES: ProvinceMeta[] = [
  { id: "gangwon", nameKo: "강원특별자치도", shortKo: "강원", cityIds: ["chuncheon", "gangneung", "sokcho"], row: 0, col: 2 },
  { id: "seoul", nameKo: "서울특별시", shortKo: "서울", cityIds: ["seoul"], row: 1, col: 1 },
  { id: "gyeonggi", nameKo: "경기도", shortKo: "경기", cityIds: ["suwon", "gapyeong", "yangpyeong"], row: 1, col: 2 },
  { id: "incheon", nameKo: "인천광역시", shortKo: "인천", cityIds: ["incheon"], row: 1, col: 0 },
  { id: "sejong", nameKo: "세종특별자치시", shortKo: "세종", cityIds: ["sejong"], row: 2, col: 0 },
  { id: "chungbuk", nameKo: "충청북도", shortKo: "충북", cityIds: ["cheongju", "daniyang"], row: 2, col: 1 },
  { id: "gyeongbuk", nameKo: "경상북도", shortKo: "경북", cityIds: ["gyeongju", "andong", "pohang"], row: 2, col: 2 },
  { id: "chungnam", nameKo: "충청남도", shortKo: "충남", cityIds: ["gongju", "boryeong", "taean"], row: 3, col: 0 },
  { id: "daejeon", nameKo: "대전광역시", shortKo: "대전", cityIds: ["daejeon"], row: 3, col: 1 },
  { id: "daegu", nameKo: "대구광역시", shortKo: "대구", cityIds: ["daegu"], row: 3, col: 2 },
  { id: "jeonbuk", nameKo: "전북특별자치도", shortKo: "전북", cityIds: ["jeonju", "gunsan"], row: 4, col: 0 },
  { id: "gyeongnam", nameKo: "경상남도", shortKo: "경남", cityIds: ["tongyeong", "geoje", "jinju"], row: 4, col: 2 },
  { id: "ulsan", nameKo: "울산광역시", shortKo: "울산", cityIds: ["ulsan"], row: 4, col: 3 },
  { id: "gwangju", nameKo: "광주광역시", shortKo: "광주", cityIds: ["gwangju"], row: 5, col: 0 },
  { id: "jeonnam", nameKo: "전라남도", shortKo: "전남", cityIds: ["yeosu", "suncheon", "mokpo"], row: 5, col: 1 },
  { id: "busan", nameKo: "부산광역시", shortKo: "부산", cityIds: ["busan"], row: 5, col: 2 },
  { id: "jeju", nameKo: "제주특별자치도", shortKo: "제주", cityIds: ["jeju", "seogwipo"], row: 6, col: 1, colSpan: 2 },
];

export function provinceById(id: ProvinceId | string): ProvinceMeta | undefined {
  return KOREA_PROVINCES.find((p) => p.id === id);
}

export function citiesForProvince(provinceId: ProvinceId | string): string[] {
  return provinceById(provinceId)?.cityIds ?? [];
}
