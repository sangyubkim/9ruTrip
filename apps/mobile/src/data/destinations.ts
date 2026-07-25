/** 국가 → 도시 카탈로그 (여행 만들기 선택용) */

export type CountryId =
  | "kr"
  | "jp"
  | "th"
  | "vn"
  | "tw"
  | "sg"
  | "my"
  | "id"
  | "ph"
  | "hk"
  | "mo"
  | "cn"
  | "au"
  | "nz"
  | "us"
  | "ca"
  | "gb"
  | "fr"
  | "it"
  | "es"
  | "de"
  | "ch"
  | "nl"
  | "at"
  | "cz"
  | "hu"
  | "pt"
  | "gr"
  | "tr"
  | "ae"
  | "eg"
  | "mv"
  | "in";

export type CityCurrency = "JPY" | "KRW" | "USD" | "EUR" | "THB" | "VND" | "TWD" | "SGD" | "MYR" | "IDR" | "PHP" | "HKD" | "MOP" | "CNY" | "AUD" | "NZD" | "CAD" | "GBP" | "CHF" | "CZK" | "HUF" | "TRY" | "AED" | "EGP" | "MVR" | "INR";

export type CityId = string;

export type CountryMeta = {
  id: CountryId;
  nameKo: string;
  nameEn: string;
  flag: string;
  cityIds: string[];
};

export type DestinationCity = {
  id: string;
  nameKo: string;
  nameEn: string;
  countryId: CountryId;
  currency: CityCurrency;
  center: { lat: number; lng: number };
  timezone: string;
  mapProvider: "google" | "naver";
  region: "overseas" | "domestic";
};

const city = (
  id: string,
  nameKo: string,
  nameEn: string,
  countryId: CountryId,
  currency: CityCurrency,
  lat: number,
  lng: number,
  timezone: string,
  region: "overseas" | "domestic" = "overseas",
  mapProvider: "google" | "naver" = "google",
): DestinationCity => ({
  id,
  nameKo,
  nameEn,
  countryId,
  currency,
  center: { lat, lng },
  timezone,
  mapProvider,
  region,
});

export const CITIES: Record<string, DestinationCity> = {
  // 한국
  seoul: city("seoul", "서울", "Seoul", "kr", "KRW", 37.5665, 126.978, "Asia/Seoul", "domestic", "naver"),
  busan: city("busan", "부산", "Busan", "kr", "KRW", 35.1796, 129.0756, "Asia/Seoul", "domestic", "naver"),
  incheon: city("incheon", "인천", "Incheon", "kr", "KRW", 37.4563, 126.7052, "Asia/Seoul", "domestic", "naver"),
  daegu: city("daegu", "대구", "Daegu", "kr", "KRW", 35.8714, 128.6014, "Asia/Seoul", "domestic", "naver"),
  daejeon: city("daejeon", "대전", "Daejeon", "kr", "KRW", 36.3504, 127.3845, "Asia/Seoul", "domestic", "naver"),
  gwangju: city("gwangju", "광주", "Gwangju", "kr", "KRW", 35.1595, 126.8526, "Asia/Seoul", "domestic", "naver"),
  ulsan: city("ulsan", "울산", "Ulsan", "kr", "KRW", 35.5384, 129.3114, "Asia/Seoul", "domestic", "naver"),
  sejong: city("sejong", "세종", "Sejong", "kr", "KRW", 36.48, 127.289, "Asia/Seoul", "domestic", "naver"),
  // 경기도
  suwon: city("suwon", "수원", "Suwon", "kr", "KRW", 37.2636, 127.0286, "Asia/Seoul", "domestic", "naver"),
  seongnam: city("seongnam", "성남", "Seongnam", "kr", "KRW", 37.4200, 127.1265, "Asia/Seoul", "domestic", "naver"),
  uijeongbu: city("uijeongbu", "의정부", "Uijeongbu", "kr", "KRW", 37.7381, 127.0337, "Asia/Seoul", "domestic", "naver"),
  anyang: city("anyang", "안양", "Anyang", "kr", "KRW", 37.3943, 126.9568, "Asia/Seoul", "domestic", "naver"),
  bucheon: city("bucheon", "부천", "Bucheon", "kr", "KRW", 37.5034, 126.7660, "Asia/Seoul", "domestic", "naver"),
  gwangmyeong: city("gwangmyeong", "광명", "Gwangmyeong", "kr", "KRW", 37.4786, 126.8644, "Asia/Seoul", "domestic", "naver"),
  pyeongtaek: city("pyeongtaek", "평택", "Pyeongtaek", "kr", "KRW", 36.9921, 127.1129, "Asia/Seoul", "domestic", "naver"),
  dongducheon: city("dongducheon", "동두천", "Dongducheon", "kr", "KRW", 37.9034, 127.0604, "Asia/Seoul", "domestic", "naver"),
  ansan: city("ansan", "안산", "Ansan", "kr", "KRW", 37.3219, 126.8309, "Asia/Seoul", "domestic", "naver"),
  goyang: city("goyang", "고양", "Goyang", "kr", "KRW", 37.6584, 126.8320, "Asia/Seoul", "domestic", "naver"),
  gwacheon: city("gwacheon", "과천", "Gwacheon", "kr", "KRW", 37.4292, 126.9877, "Asia/Seoul", "domestic", "naver"),
  guri: city("guri", "구리", "Guri", "kr", "KRW", 37.5943, 127.1296, "Asia/Seoul", "domestic", "naver"),
  namyangju: city("namyangju", "남양주", "Namyangju", "kr", "KRW", 37.6360, 127.2165, "Asia/Seoul", "domestic", "naver"),
  osan: city("osan", "오산", "Osan", "kr", "KRW", 37.1498, 127.0772, "Asia/Seoul", "domestic", "naver"),
  siheung: city("siheung", "시흥", "Siheung", "kr", "KRW", 37.3801, 126.8029, "Asia/Seoul", "domestic", "naver"),
  gunpo: city("gunpo", "군포", "Gunpo", "kr", "KRW", 37.3616, 126.9352, "Asia/Seoul", "domestic", "naver"),
  uiwang: city("uiwang", "의왕", "Uiwang", "kr", "KRW", 37.3449, 126.9683, "Asia/Seoul", "domestic", "naver"),
  hanam: city("hanam", "하남", "Hanam", "kr", "KRW", 37.5393, 127.2148, "Asia/Seoul", "domestic", "naver"),
  yongin: city("yongin", "용인", "Yongin", "kr", "KRW", 37.2411, 127.1776, "Asia/Seoul", "domestic", "naver"),
  paju: city("paju", "파주", "Paju", "kr", "KRW", 37.7599, 126.7805, "Asia/Seoul", "domestic", "naver"),
  icheon: city("icheon", "이천", "Icheon", "kr", "KRW", 37.2720, 127.4350, "Asia/Seoul", "domestic", "naver"),
  anseong: city("anseong", "안성", "Anseong", "kr", "KRW", 37.0081, 127.2799, "Asia/Seoul", "domestic", "naver"),
  gimpo: city("gimpo", "김포", "Gimpo", "kr", "KRW", 37.6152, 126.7156, "Asia/Seoul", "domestic", "naver"),
  hwaseong: city("hwaseong", "화성", "Hwaseong", "kr", "KRW", 37.1996, 126.8312, "Asia/Seoul", "domestic", "naver"),
  gwangju_gyeonggi: city("gwangju_gyeonggi", "광주", "Gwangju (Gyeonggi)", "kr", "KRW", 37.4294, 127.2550, "Asia/Seoul", "domestic", "naver"),
  yangju: city("yangju", "양주", "Yangju", "kr", "KRW", 37.7853, 127.0458, "Asia/Seoul", "domestic", "naver"),
  pocheon: city("pocheon", "포천", "Pocheon", "kr", "KRW", 37.8949, 127.2003, "Asia/Seoul", "domestic", "naver"),
  yeoju: city("yeoju", "여주", "Yeoju", "kr", "KRW", 37.2982, 127.6372, "Asia/Seoul", "domestic", "naver"),
  gapyeong: city("gapyeong", "가평", "Gapyeong", "kr", "KRW", 37.8315, 127.5102, "Asia/Seoul", "domestic", "naver"),
  yangpyeong: city("yangpyeong", "양평", "Yangpyeong", "kr", "KRW", 37.4914, 127.4876, "Asia/Seoul", "domestic", "naver"),
  // 강원특별자치도
  chuncheon: city("chuncheon", "춘천", "Chuncheon", "kr", "KRW", 37.8813, 127.73, "Asia/Seoul", "domestic", "naver"),
  gangneung: city("gangneung", "강릉", "Gangneung", "kr", "KRW", 37.7519, 128.8761, "Asia/Seoul", "domestic", "naver"),
  donghae: city("donghae", "동해", "Donghae", "kr", "KRW", 37.5247, 129.1143, "Asia/Seoul", "domestic", "naver"),
  samcheok: city("samcheok", "삼척", "Samcheok", "kr", "KRW", 37.4499, 129.1652, "Asia/Seoul", "domestic", "naver"),
  sokcho: city("sokcho", "속초", "Sokcho", "kr", "KRW", 38.207, 128.5918, "Asia/Seoul", "domestic", "naver"),
  wonju: city("wonju", "원주", "Wonju", "kr", "KRW", 37.3422, 127.9202, "Asia/Seoul", "domestic", "naver"),
  taebaek: city("taebaek", "태백", "Taebaek", "kr", "KRW", 37.1641, 128.9856, "Asia/Seoul", "domestic", "naver"),
  // 충청북도
  cheongju: city("cheongju", "청주", "Cheongju", "kr", "KRW", 36.6424, 127.489, "Asia/Seoul", "domestic", "naver"),
  chungju: city("chungju", "충주", "Chungju", "kr", "KRW", 36.9910, 127.9259, "Asia/Seoul", "domestic", "naver"),
  jecheon: city("jecheon", "제천", "Jecheon", "kr", "KRW", 37.1326, 128.1909, "Asia/Seoul", "domestic", "naver"),
  daniyang: city("daniyang", "단양", "Danyang", "kr", "KRW", 36.9846, 128.3656, "Asia/Seoul", "domestic", "naver"),
  // 충청남도
  gyeryong: city("gyeryong", "계룡", "Gyeryong", "kr", "KRW", 36.2745, 127.2487, "Asia/Seoul", "domestic", "naver"),
  gongju: city("gongju", "공주", "Gongju", "kr", "KRW", 36.4465, 127.119, "Asia/Seoul", "domestic", "naver"),
  nonsan: city("nonsan", "논산", "Nonsan", "kr", "KRW", 36.1871, 127.0987, "Asia/Seoul", "domestic", "naver"),
  dangjin: city("dangjin", "당진", "Dangjin", "kr", "KRW", 36.8890, 126.6459, "Asia/Seoul", "domestic", "naver"),
  boryeong: city("boryeong", "보령", "Boryeong", "kr", "KRW", 36.3334, 126.6129, "Asia/Seoul", "domestic", "naver"),
  seosan: city("seosan", "서산", "Seosan", "kr", "KRW", 36.7845, 126.4503, "Asia/Seoul", "domestic", "naver"),
  asan: city("asan", "아산", "Asan", "kr", "KRW", 36.7898, 127.0018, "Asia/Seoul", "domestic", "naver"),
  cheonan: city("cheonan", "천안", "Cheonan", "kr", "KRW", 36.8151, 127.1139, "Asia/Seoul", "domestic", "naver"),
  taean: city("taean", "태안", "Taean", "kr", "KRW", 36.7456, 126.298, "Asia/Seoul", "domestic", "naver"),
  // 전북특별자치도
  jeonju: city("jeonju", "전주", "Jeonju", "kr", "KRW", 35.8242, 127.148, "Asia/Seoul", "domestic", "naver"),
  jeongeup: city("jeongeup", "정읍", "Jeongeup", "kr", "KRW", 35.5699, 126.8559, "Asia/Seoul", "domestic", "naver"),
  gunsan: city("gunsan", "군산", "Gunsan", "kr", "KRW", 35.9676, 126.7369, "Asia/Seoul", "domestic", "naver"),
  gimje: city("gimje", "김제", "Gimje", "kr", "KRW", 35.8036, 126.8809, "Asia/Seoul", "domestic", "naver"),
  namwon: city("namwon", "남원", "Namwon", "kr", "KRW", 35.4164, 127.3904, "Asia/Seoul", "domestic", "naver"),
  iksan: city("iksan", "익산", "Iksan", "kr", "KRW", 35.9483, 126.9576, "Asia/Seoul", "domestic", "naver"),
  // 전라남도
  yeosu: city("yeosu", "여수", "Yeosu", "kr", "KRW", 34.7604, 127.6622, "Asia/Seoul", "domestic", "naver"),
  suncheon: city("suncheon", "순천", "Suncheon", "kr", "KRW", 34.9506, 127.4872, "Asia/Seoul", "domestic", "naver"),
  mokpo: city("mokpo", "목포", "Mokpo", "kr", "KRW", 34.8118, 126.3922, "Asia/Seoul", "domestic", "naver"),
  gwangyang: city("gwangyang", "광양", "Gwangyang", "kr", "KRW", 34.9407, 127.6959, "Asia/Seoul", "domestic", "naver"),
  naju: city("naju", "나주", "Naju", "kr", "KRW", 35.0158, 126.7108, "Asia/Seoul", "domestic", "naver"),
  // 경상북도
  gyeongju: city("gyeongju", "경주", "Gyeongju", "kr", "KRW", 35.8562, 129.2247, "Asia/Seoul", "domestic", "naver"),
  gimcheon: city("gimcheon", "김천", "Gimcheon", "kr", "KRW", 36.1398, 128.1136, "Asia/Seoul", "domestic", "naver"),
  andong: city("andong", "안동", "Andong", "kr", "KRW", 36.5684, 128.7294, "Asia/Seoul", "domestic", "naver"),
  gumi: city("gumi", "구미", "Gumi", "kr", "KRW", 36.1195, 128.3446, "Asia/Seoul", "domestic", "naver"),
  yeongju: city("yeongju", "영주", "Yeongju", "kr", "KRW", 36.8057, 128.6241, "Asia/Seoul", "domestic", "naver"),
  yeongcheon: city("yeongcheon", "영천", "Yeongcheon", "kr", "KRW", 35.9733, 128.9386, "Asia/Seoul", "domestic", "naver"),
  sangju: city("sangju", "상주", "Sangju", "kr", "KRW", 36.4107, 128.1590, "Asia/Seoul", "domestic", "naver"),
  mungyeong: city("mungyeong", "문경", "Mungyeong", "kr", "KRW", 36.5865, 128.1868, "Asia/Seoul", "domestic", "naver"),
  gyeongsan: city("gyeongsan", "경산", "Gyeongsan", "kr", "KRW", 35.8251, 128.7412, "Asia/Seoul", "domestic", "naver"),
  pohang: city("pohang", "포항", "Pohang", "kr", "KRW", 36.019, 129.3435, "Asia/Seoul", "domestic", "naver"),
  // 경상남도
  changwon: city("changwon", "창원", "Changwon", "kr", "KRW", 35.2281, 128.6811, "Asia/Seoul", "domestic", "naver"),
  tongyeong: city("tongyeong", "통영", "Tongyeong", "kr", "KRW", 34.8544, 128.4331, "Asia/Seoul", "domestic", "naver"),
  geoje: city("geoje", "거제", "Geoje", "kr", "KRW", 34.8806, 128.6211, "Asia/Seoul", "domestic", "naver"),
  gimhae: city("gimhae", "김해", "Gimhae", "kr", "KRW", 35.2285, 128.8894, "Asia/Seoul", "domestic", "naver"),
  miryang: city("miryang", "밀양", "Miryang", "kr", "KRW", 35.5038, 128.7467, "Asia/Seoul", "domestic", "naver"),
  sacheon: city("sacheon", "사천", "Sacheon", "kr", "KRW", 35.0037, 128.0642, "Asia/Seoul", "domestic", "naver"),
  yangsan: city("yangsan", "양산", "Yangsan", "kr", "KRW", 35.3350, 129.0372, "Asia/Seoul", "domestic", "naver"),
  jinju: city("jinju", "진주", "Jinju", "kr", "KRW", 35.1802, 128.1076, "Asia/Seoul", "domestic", "naver"),
  jeju: city("jeju", "제주시", "Jeju City", "kr", "KRW", 33.4996, 126.5312, "Asia/Seoul", "domestic", "naver"),
  seogwipo: city("seogwipo", "서귀포", "Seogwipo", "kr", "KRW", 33.2541, 126.5601, "Asia/Seoul", "domestic", "naver"),
  // 일본
  tokyo: city("tokyo", "도쿄", "Tokyo", "jp", "JPY", 35.681236, 139.767125, "Asia/Tokyo"),
  osaka: city("osaka", "오사카", "Osaka", "jp", "JPY", 34.6937, 135.5023, "Asia/Tokyo"),
  kyoto: city("kyoto", "교토", "Kyoto", "jp", "JPY", 35.0116, 135.7681, "Asia/Tokyo"),
  fukuoka: city("fukuoka", "후쿠오카", "Fukuoka", "jp", "JPY", 33.5904, 130.4017, "Asia/Tokyo"),
  sapporo: city("sapporo", "삿포로", "Sapporo", "jp", "JPY", 43.0618, 141.3545, "Asia/Tokyo"),
  nagoya: city("nagoya", "나고야", "Nagoya", "jp", "JPY", 35.1815, 136.9066, "Asia/Tokyo"),
  hiroshima: city("hiroshima", "히로시마", "Hiroshima", "jp", "JPY", 34.3853, 132.4553, "Asia/Tokyo"),
  okinawa: city("okinawa", "오키나와", "Okinawa", "jp", "JPY", 26.2124, 127.6809, "Asia/Tokyo"),
  nagasaki: city("nagasaki", "나가사키", "Nagasaki", "jp", "JPY", 32.7503, 129.8777, "Asia/Tokyo"),
  // 태국
  bangkok: city("bangkok", "방콕", "Bangkok", "th", "THB", 13.7563, 100.5018, "Asia/Bangkok"),
  chiangmai: city("chiangmai", "치앙마이", "Chiang Mai", "th", "THB", 18.7883, 98.9853, "Asia/Bangkok"),
  phuket: city("phuket", "푸켓", "Phuket", "th", "THB", 7.8804, 98.3923, "Asia/Bangkok"),
  pattaya: city("pattaya", "파타야", "Pattaya", "th", "THB", 12.9236, 100.8825, "Asia/Bangkok"),
  krabi: city("krabi", "크라비", "Krabi", "th", "THB", 8.0863, 98.9063, "Asia/Bangkok"),
  kohsamui: city("kohsamui", "코사무이", "Koh Samui", "th", "THB", 9.512, 100.0136, "Asia/Bangkok"),
  // 베트남
  hanoi: city("hanoi", "하노이", "Hanoi", "vn", "VND", 21.0278, 105.8342, "Asia/Ho_Chi_Minh"),
  hochiminh: city("hochiminh", "호치민", "Ho Chi Minh", "vn", "VND", 10.8231, 106.6297, "Asia/Ho_Chi_Minh"),
  danang: city("danang", "다낭", "Da Nang", "vn", "VND", 16.0544, 108.2022, "Asia/Ho_Chi_Minh"),
  hoian: city("hoian", "호이안", "Hoi An", "vn", "VND", 15.8801, 108.338, "Asia/Ho_Chi_Minh"),
  nhatrang: city("nhatrang", "나트랑", "Nha Trang", "vn", "VND", 12.2388, 109.1967, "Asia/Ho_Chi_Minh"),
  dalat: city("dalat", "달랏", "Da Lat", "vn", "VND", 11.9404, 108.4583, "Asia/Ho_Chi_Minh"),
  phuquoc: city("phuquoc", "푸꾸옥", "Phu Quoc", "vn", "VND", 10.227, 103.967, "Asia/Ho_Chi_Minh"),
  // 대만
  taipei: city("taipei", "타이베이", "Taipei", "tw", "TWD", 25.033, 121.5654, "Asia/Taipei"),
  taichung: city("taichung", "타이중", "Taichung", "tw", "TWD", 24.1477, 120.6736, "Asia/Taipei"),
  kaohsiung: city("kaohsiung", "가오슝", "Kaohsiung", "tw", "TWD", 22.6273, 120.3014, "Asia/Taipei"),
  tainan: city("tainan", "타이난", "Tainan", "tw", "TWD", 22.9997, 120.227, "Asia/Taipei"),
  hualien: city("hualien", "화롄", "Hualien", "tw", "TWD", 23.9739, 121.6064, "Asia/Taipei"),
  // 싱가포르 / 홍콩 / 마카오
  singapore: city("singapore", "싱가포르", "Singapore", "sg", "SGD", 1.3521, 103.8198, "Asia/Singapore"),
  hongkong: city("hongkong", "홍콩", "Hong Kong", "hk", "HKD", 22.3193, 114.1694, "Asia/Hong_Kong"),
  macau: city("macau", "마카오", "Macau", "mo", "MOP", 22.1987, 113.5439, "Asia/Macau"),
  // 말레이시아
  kualalumpur: city("kualalumpur", "쿠알라룸푸르", "Kuala Lumpur", "my", "MYR", 3.139, 101.6869, "Asia/Kuala_Lumpur"),
  penang: city("penang", "페낭", "Penang", "my", "MYR", 5.4164, 100.3327, "Asia/Kuala_Lumpur"),
  langkawi: city("langkawi", "랑카위", "Langkawi", "my", "MYR", 6.35, 99.8, "Asia/Kuala_Lumpur"),
  kotakinabalu: city("kotakinabalu", "코타키나발루", "Kota Kinabalu", "my", "MYR", 5.9804, 116.0735, "Asia/Kuala_Lumpur"),
  malacca: city("malacca", "말라카", "Malacca", "my", "MYR", 2.1896, 102.2501, "Asia/Kuala_Lumpur"),
  // 인도네시아
  bali: city("bali", "발리", "Bali", "id", "IDR", -8.4095, 115.1889, "Asia/Makassar"),
  jakarta: city("jakarta", "자카르타", "Jakarta", "id", "IDR", -6.2088, 106.8456, "Asia/Jakarta"),
  yogyakarta: city("yogyakarta", "족자카르타", "Yogyakarta", "id", "IDR", -7.7956, 110.3695, "Asia/Jakarta"),
  lombok: city("lombok", "롬복", "Lombok", "id", "IDR", -8.65, 116.3249, "Asia/Makassar"),
  // 필리핀
  manila: city("manila", "마닐라", "Manila", "ph", "PHP", 14.5995, 120.9842, "Asia/Manila"),
  cebu: city("cebu", "세부", "Cebu", "ph", "PHP", 10.3157, 123.8854, "Asia/Manila"),
  boracay: city("boracay", "보라카이", "Boracay", "ph", "PHP", 11.9674, 121.9248, "Asia/Manila"),
  palawan: city("palawan", "팔라완", "Palawan", "ph", "PHP", 9.8349, 118.7384, "Asia/Manila"),
  bohol: city("bohol", "보홀", "Bohol", "ph", "PHP", 9.8499, 124.1435, "Asia/Manila"),
  // 중국
  beijing: city("beijing", "베이징", "Beijing", "cn", "CNY", 39.9042, 116.4074, "Asia/Shanghai"),
  shanghai: city("shanghai", "상하이", "Shanghai", "cn", "CNY", 31.2304, 121.4737, "Asia/Shanghai"),
  guangzhou: city("guangzhou", "광저우", "Guangzhou", "cn", "CNY", 23.1291, 113.2644, "Asia/Shanghai"),
  shenzhen: city("shenzhen", "선전", "Shenzhen", "cn", "CNY", 22.5431, 114.0579, "Asia/Shanghai"),
  xian: city("xian", "시안", "Xi'an", "cn", "CNY", 34.3416, 108.9398, "Asia/Shanghai"),
  chengdu: city("chengdu", "청두", "Chengdu", "cn", "CNY", 30.5728, 104.0668, "Asia/Shanghai"),
  hangzhou: city("hangzhou", "항저우", "Hangzhou", "cn", "CNY", 30.2741, 120.1551, "Asia/Shanghai"),
  zhangjiajie: city("zhangjiajie", "장자제", "Zhangjiajie", "cn", "CNY", 29.117, 110.479, "Asia/Shanghai"),
  // 호주 / 뉴질랜드
  sydney: city("sydney", "시드니", "Sydney", "au", "AUD", -33.8688, 151.2093, "Australia/Sydney"),
  melbourne: city("melbourne", "멜버른", "Melbourne", "au", "AUD", -37.8136, 144.9631, "Australia/Melbourne"),
  brisbane: city("brisbane", "브리즈번", "Brisbane", "au", "AUD", -27.4698, 153.0251, "Australia/Brisbane"),
  perth: city("perth", "퍼스", "Perth", "au", "AUD", -31.9505, 115.8605, "Australia/Perth"),
  cairns: city("cairns", "케언즈", "Cairns", "au", "AUD", -16.9186, 145.7781, "Australia/Brisbane"),
  goldcoast: city("goldcoast", "골드코스트", "Gold Coast", "au", "AUD", -28.0167, 153.4, "Australia/Brisbane"),
  auckland: city("auckland", "오클랜드", "Auckland", "nz", "NZD", -36.8485, 174.7633, "Pacific/Auckland"),
  queenstown: city("queenstown", "퀸스타운", "Queenstown", "nz", "NZD", -45.0312, 168.6626, "Pacific/Auckland"),
  christchurch: city("christchurch", "크라이스트처치", "Christchurch", "nz", "NZD", -43.5321, 172.6362, "Pacific/Auckland"),
  wellington: city("wellington", "웰링턴", "Wellington", "nz", "NZD", -41.2865, 174.7762, "Pacific/Auckland"),
  // 미국 / 캐나다
  newyork: city("newyork", "뉴욕", "New York", "us", "USD", 40.7128, -74.006, "America/New_York"),
  losangeles: city("losangeles", "로스앤젤레스", "Los Angeles", "us", "USD", 34.0522, -118.2437, "America/Los_Angeles"),
  sanfrancisco: city("sanfrancisco", "샌프란시스코", "San Francisco", "us", "USD", 37.7749, -122.4194, "America/Los_Angeles"),
  lasvegas: city("lasvegas", "라스베이거스", "Las Vegas", "us", "USD", 36.1699, -115.1398, "America/Los_Angeles"),
  seattle: city("seattle", "시애틀", "Seattle", "us", "USD", 47.6062, -122.3321, "America/Los_Angeles"),
  chicago: city("chicago", "시카고", "Chicago", "us", "USD", 41.8781, -87.6298, "America/Chicago"),
  miami: city("miami", "마이애미", "Miami", "us", "USD", 25.7617, -80.1918, "America/New_York"),
  hawaii: city("hawaii", "하와이", "Hawaii", "us", "USD", 21.3069, -157.8583, "Pacific/Honolulu"),
  vancouver: city("vancouver", "밴쿠버", "Vancouver", "ca", "CAD", 49.2827, -123.1207, "America/Vancouver"),
  toronto: city("toronto", "토론토", "Toronto", "ca", "CAD", 43.6532, -79.3832, "America/Toronto"),
  montreal: city("montreal", "몬트리올", "Montreal", "ca", "CAD", 45.5017, -73.5673, "America/Toronto"),
  quebec: city("quebec", "퀘벡", "Quebec", "ca", "CAD", 46.8139, -71.208, "America/Toronto"),
  calgary: city("calgary", "캘거리", "Calgary", "ca", "CAD", 51.0447, -114.0719, "America/Edmonton"),
  // 유럽
  london: city("london", "런던", "London", "gb", "GBP", 51.5074, -0.1278, "Europe/London"),
  edinburgh: city("edinburgh", "에든버러", "Edinburgh", "gb", "GBP", 55.9533, -3.1883, "Europe/London"),
  manchester: city("manchester", "맨체스터", "Manchester", "gb", "GBP", 53.4808, -2.2426, "Europe/London"),
  liverpool: city("liverpool", "리버풀", "Liverpool", "gb", "GBP", 53.4084, -2.9916, "Europe/London"),
  oxford: city("oxford", "옥스퍼드", "Oxford", "gb", "GBP", 51.752, -1.2577, "Europe/London"),
  paris: city("paris", "파리", "Paris", "fr", "EUR", 48.8566, 2.3522, "Europe/Paris"),
  nice: city("nice", "니스", "Nice", "fr", "EUR", 43.7102, 7.262, "Europe/Paris"),
  lyon: city("lyon", "리옹", "Lyon", "fr", "EUR", 45.764, 4.8357, "Europe/Paris"),
  marseille: city("marseille", "마르세유", "Marseille", "fr", "EUR", 43.2965, 5.3698, "Europe/Paris"),
  strasbourg: city("strasbourg", "스트라스부르", "Strasbourg", "fr", "EUR", 48.5734, 7.7521, "Europe/Paris"),
  rome: city("rome", "로마", "Rome", "it", "EUR", 41.9028, 12.4964, "Europe/Rome"),
  milan: city("milan", "밀라노", "Milan", "it", "EUR", 45.4642, 9.19, "Europe/Rome"),
  venice: city("venice", "베네치아", "Venice", "it", "EUR", 45.4408, 12.3155, "Europe/Rome"),
  florence: city("florence", "피렌체", "Florence", "it", "EUR", 43.7696, 11.2558, "Europe/Rome"),
  naples: city("naples", "나폴리", "Naples", "it", "EUR", 40.8518, 14.2681, "Europe/Rome"),
  barcelona: city("barcelona", "바르셀로나", "Barcelona", "es", "EUR", 41.3851, 2.1734, "Europe/Madrid"),
  madrid: city("madrid", "마드리드", "Madrid", "es", "EUR", 40.4168, -3.7038, "Europe/Madrid"),
  seville: city("seville", "세비야", "Seville", "es", "EUR", 37.3891, -5.9845, "Europe/Madrid"),
  valencia: city("valencia", "발렌시아", "Valencia", "es", "EUR", 39.4699, -0.3763, "Europe/Madrid"),
  granada: city("granada", "그라나다", "Granada", "es", "EUR", 37.1773, -3.5986, "Europe/Madrid"),
  berlin: city("berlin", "베를린", "Berlin", "de", "EUR", 52.52, 13.405, "Europe/Berlin"),
  munich: city("munich", "뮌헨", "Munich", "de", "EUR", 48.1351, 11.582, "Europe/Berlin"),
  frankfurt: city("frankfurt", "프랑크푸르트", "Frankfurt", "de", "EUR", 50.1109, 8.6821, "Europe/Berlin"),
  hamburg: city("hamburg", "함부르크", "Hamburg", "de", "EUR", 53.5511, 9.9937, "Europe/Berlin"),
  cologne: city("cologne", "쾰른", "Cologne", "de", "EUR", 50.9375, 6.9603, "Europe/Berlin"),
  zurich: city("zurich", "취리히", "Zurich", "ch", "CHF", 47.3769, 8.5417, "Europe/Zurich"),
  lucerne: city("lucerne", "루체른", "Lucerne", "ch", "CHF", 47.0502, 8.3093, "Europe/Zurich"),
  interlaken: city("interlaken", "인터라켄", "Interlaken", "ch", "CHF", 46.6863, 7.8632, "Europe/Zurich"),
  geneva: city("geneva", "제네바", "Geneva", "ch", "CHF", 46.2044, 6.1432, "Europe/Zurich"),
  zermatt: city("zermatt", "체르마트", "Zermatt", "ch", "CHF", 46.0207, 7.7491, "Europe/Zurich"),
  amsterdam: city("amsterdam", "암스테르담", "Amsterdam", "nl", "EUR", 52.3676, 4.9041, "Europe/Amsterdam"),
  rotterdam: city("rotterdam", "로테르담", "Rotterdam", "nl", "EUR", 51.9244, 4.4777, "Europe/Amsterdam"),
  hague: city("hague", "헤이그", "The Hague", "nl", "EUR", 52.0705, 4.3007, "Europe/Amsterdam"),
  vienna: city("vienna", "빈", "Vienna", "at", "EUR", 48.2082, 16.3738, "Europe/Vienna"),
  salzburg: city("salzburg", "잘츠부르크", "Salzburg", "at", "EUR", 47.8095, 13.055, "Europe/Vienna"),
  hallstatt: city("hallstatt", "할슈타트", "Hallstatt", "at", "EUR", 47.5622, 13.6493, "Europe/Vienna"),
  innsbruck: city("innsbruck", "인스브루크", "Innsbruck", "at", "EUR", 47.2692, 11.4041, "Europe/Vienna"),
  prague: city("prague", "프라하", "Prague", "cz", "CZK", 50.0755, 14.4378, "Europe/Prague"),
  ceskykrumlov: city("ceskykrumlov", "체스키크룸로프", "Cesky Krumlov", "cz", "CZK", 48.8127, 14.3175, "Europe/Prague"),
  brno: city("brno", "브르노", "Brno", "cz", "CZK", 49.1951, 16.6068, "Europe/Prague"),
  budapest: city("budapest", "부다페스트", "Budapest", "hu", "HUF", 47.4979, 19.0402, "Europe/Budapest"),
  lisbon: city("lisbon", "리스본", "Lisbon", "pt", "EUR", 38.7223, -9.1393, "Europe/Lisbon"),
  porto: city("porto", "포르투", "Porto", "pt", "EUR", 41.1579, -8.6291, "Europe/Lisbon"),
  faro: city("faro", "파루", "Faro", "pt", "EUR", 37.0194, -7.9304, "Europe/Lisbon"),
  athens: city("athens", "아테네", "Athens", "gr", "EUR", 37.9838, 23.7275, "Europe/Athens"),
  santorini: city("santorini", "산토리니", "Santorini", "gr", "EUR", 36.3932, 25.4615, "Europe/Athens"),
  mykonos: city("mykonos", "미코노스", "Mykonos", "gr", "EUR", 37.4467, 25.3289, "Europe/Athens"),
  // 중동 / 아프리카 / 남아시아
  istanbul: city("istanbul", "이스탄불", "Istanbul", "tr", "TRY", 41.0082, 28.9784, "Europe/Istanbul"),
  cappadocia: city("cappadocia", "카파도키아", "Cappadocia", "tr", "TRY", 38.6431, 34.8289, "Europe/Istanbul"),
  antalya: city("antalya", "안탈리아", "Antalya", "tr", "TRY", 36.8969, 30.7133, "Europe/Istanbul"),
  izmir: city("izmir", "이즈미르", "Izmir", "tr", "TRY", 38.4237, 27.1428, "Europe/Istanbul"),
  dubai: city("dubai", "두바이", "Dubai", "ae", "AED", 25.2048, 55.2708, "Asia/Dubai"),
  abudhabi: city("abudhabi", "아부다비", "Abu Dhabi", "ae", "AED", 24.4539, 54.3773, "Asia/Dubai"),
  cairo: city("cairo", "카이로", "Cairo", "eg", "EGP", 30.0444, 31.2357, "Africa/Cairo"),
  luxor: city("luxor", "룩소르", "Luxor", "eg", "EGP", 25.6872, 32.6396, "Africa/Cairo"),
  aswan: city("aswan", "아스완", "Aswan", "eg", "EGP", 24.0889, 32.8998, "Africa/Cairo"),
  hurghada: city("hurghada", "후르가다", "Hurghada", "eg", "EGP", 27.2579, 33.8116, "Africa/Cairo"),
  male: city("male", "말레", "Male", "mv", "MVR", 4.1755, 73.5093, "Indian/Maldives"),
  newdelhi: city("newdelhi", "뉴델리", "New Delhi", "in", "INR", 28.6139, 77.209, "Asia/Kolkata"),
  mumbai: city("mumbai", "뭄바이", "Mumbai", "in", "INR", 19.076, 72.8777, "Asia/Kolkata"),
  agra: city("agra", "아그라", "Agra", "in", "INR", 27.1767, 78.0081, "Asia/Kolkata"),
  jaipur: city("jaipur", "자이푸르", "Jaipur", "in", "INR", 26.9124, 75.7873, "Asia/Kolkata"),
  varanasi: city("varanasi", "바라나시", "Varanasi", "in", "INR", 25.3176, 82.9739, "Asia/Kolkata"),
};

const country = (
  id: CountryId,
  nameKo: string,
  nameEn: string,
  flag: string,
  cityIds: string[],
): CountryMeta => ({ id, nameKo, nameEn, flag, cityIds });

export const COUNTRIES: CountryMeta[] = [
  country("kr", "한국", "Korea", "🇰🇷", [
    "seoul", "busan", "incheon", "daegu", "daejeon", "gwangju", "ulsan", "sejong",
    "suwon", "seongnam", "uijeongbu", "anyang", "bucheon", "gwangmyeong", "pyeongtaek",
    "dongducheon", "ansan", "goyang", "gwacheon", "guri", "namyangju", "osan", "siheung",
    "gunpo", "uiwang", "hanam", "yongin", "paju", "icheon", "anseong", "gimpo", "hwaseong",
    "gwangju_gyeonggi", "yangju", "pocheon", "yeoju", "gapyeong", "yangpyeong",
    "chuncheon", "gangneung", "donghae", "samcheok", "sokcho", "wonju", "taebaek",
    "cheongju", "chungju", "jecheon", "daniyang",
    "gyeryong", "gongju", "nonsan", "dangjin", "boryeong", "seosan", "asan", "cheonan", "taean",
    "jeonju", "jeongeup", "gunsan", "gimje", "namwon", "iksan",
    "yeosu", "suncheon", "mokpo", "gwangyang", "naju",
    "gyeongju", "gimcheon", "andong", "gumi", "yeongju", "yeongcheon", "sangju", "mungyeong", "gyeongsan", "pohang",
    "changwon", "tongyeong", "geoje", "gimhae", "miryang", "sacheon", "yangsan", "jinju",
    "jeju", "seogwipo",
  ]),
  country("jp", "일본", "Japan", "🇯🇵", ["tokyo", "osaka", "kyoto", "fukuoka", "sapporo", "nagoya", "hiroshima", "okinawa", "nagasaki"]),
  country("th", "태국", "Thailand", "🇹🇭", ["bangkok", "chiangmai", "phuket", "pattaya", "krabi", "kohsamui"]),
  country("vn", "베트남", "Vietnam", "🇻🇳", ["hanoi", "hochiminh", "danang", "hoian", "nhatrang", "dalat", "phuquoc"]),
  country("tw", "대만", "Taiwan", "🇹🇼", ["taipei", "taichung", "kaohsiung", "tainan", "hualien"]),
  country("sg", "싱가포르", "Singapore", "🇸🇬", ["singapore"]),
  country("my", "말레이시아", "Malaysia", "🇲🇾", ["kualalumpur", "penang", "langkawi", "kotakinabalu", "malacca"]),
  country("id", "인도네시아", "Indonesia", "🇮🇩", ["bali", "jakarta", "yogyakarta", "lombok"]),
  country("ph", "필리핀", "Philippines", "🇵🇭", ["manila", "cebu", "boracay", "palawan", "bohol"]),
  country("hk", "홍콩", "Hong Kong", "🇭🇰", ["hongkong"]),
  country("mo", "마카오", "Macau", "🇲🇴", ["macau"]),
  country("cn", "중국", "China", "🇨🇳", ["beijing", "shanghai", "guangzhou", "shenzhen", "xian", "chengdu", "hangzhou", "zhangjiajie"]),
  country("au", "호주", "Australia", "🇦🇺", ["sydney", "melbourne", "brisbane", "perth", "cairns", "goldcoast"]),
  country("nz", "뉴질랜드", "New Zealand", "🇳🇿", ["auckland", "queenstown", "christchurch", "wellington"]),
  country("us", "미국", "USA", "🇺🇸", ["newyork", "losangeles", "sanfrancisco", "lasvegas", "seattle", "chicago", "miami", "hawaii"]),
  country("ca", "캐나다", "Canada", "🇨🇦", ["vancouver", "toronto", "montreal", "quebec", "calgary"]),
  country("gb", "영국", "UK", "🇬🇧", ["london", "edinburgh", "manchester", "liverpool", "oxford"]),
  country("fr", "프랑스", "France", "🇫🇷", ["paris", "nice", "lyon", "marseille", "strasbourg"]),
  country("it", "이탈리아", "Italy", "🇮🇹", ["rome", "milan", "venice", "florence", "naples"]),
  country("es", "스페인", "Spain", "🇪🇸", ["barcelona", "madrid", "seville", "valencia", "granada"]),
  country("de", "독일", "Germany", "🇩🇪", ["berlin", "munich", "frankfurt", "hamburg", "cologne"]),
  country("ch", "스위스", "Switzerland", "🇨🇭", ["zurich", "lucerne", "interlaken", "geneva", "zermatt"]),
  country("nl", "네덜란드", "Netherlands", "🇳🇱", ["amsterdam", "rotterdam", "hague"]),
  country("at", "오스트리아", "Austria", "🇦🇹", ["vienna", "salzburg", "hallstatt", "innsbruck"]),
  country("cz", "체코", "Czechia", "🇨🇿", ["prague", "ceskykrumlov", "brno"]),
  country("hu", "헝가리", "Hungary", "🇭🇺", ["budapest"]),
  country("pt", "포르투갈", "Portugal", "🇵🇹", ["lisbon", "porto", "faro"]),
  country("gr", "그리스", "Greece", "🇬🇷", ["athens", "santorini", "mykonos"]),
  country("tr", "튀르키예", "Türkiye", "🇹🇷", ["istanbul", "cappadocia", "antalya", "izmir"]),
  country("ae", "UAE", "UAE", "🇦🇪", ["dubai", "abudhabi"]),
  country("eg", "이집트", "Egypt", "🇪🇬", ["cairo", "luxor", "aswan", "hurghada"]),
  country("mv", "몰디브", "Maldives", "🇲🇻", ["male"]),
  country("in", "인도", "India", "🇮🇳", ["newdelhi", "mumbai", "agra", "jaipur", "varanasi"]),
];

export const DEFAULT_CITY_ID = "seoul";
/** 출발 도시 (국내 MVP) */
export const DEPARTURE_CITY_IDS = ["seoul", "busan"] as const;
export const MAX_SELECTED_CITIES = 6;

export function isKnownCityId(id: string | undefined | null): boolean {
  return Boolean(id && CITIES[id]);
}

export function getDestinationCity(cityId: string | undefined | null): DestinationCity {
  if (cityId && CITIES[cityId]) return CITIES[cityId];
  return CITIES[DEFAULT_CITY_ID];
}

export function getCountryForCity(cityId: string | undefined | null): CountryMeta | undefined {
  const cityMeta = getDestinationCity(cityId);
  return COUNTRIES.find((c) => c.id === cityMeta.countryId);
}

export function citiesInCountry(countryId: CountryId): DestinationCity[] {
  const countryMeta = COUNTRIES.find((c) => c.id === countryId);
  if (!countryMeta) return [];
  return countryMeta.cityIds.map((id) => CITIES[id]).filter(Boolean);
}
