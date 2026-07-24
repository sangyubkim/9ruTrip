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
  jeju: city("jeju", "제주", "Jeju", "kr", "KRW", 33.4996, 126.5312, "Asia/Seoul", "domestic", "naver"),
  gyeongju: city("gyeongju", "경주", "Gyeongju", "kr", "KRW", 35.8562, 129.2247, "Asia/Seoul", "domestic", "naver"),
  incheon: city("incheon", "인천", "Incheon", "kr", "KRW", 37.4563, 126.7052, "Asia/Seoul", "domestic", "naver"),
  gangneung: city("gangneung", "강릉", "Gangneung", "kr", "KRW", 37.7519, 128.8761, "Asia/Seoul", "domestic", "naver"),
  jeonju: city("jeonju", "전주", "Jeonju", "kr", "KRW", 35.8242, 127.148, "Asia/Seoul", "domestic", "naver"),
  yeosu: city("yeosu", "여수", "Yeosu", "kr", "KRW", 34.7604, 127.6622, "Asia/Seoul", "domestic", "naver"),
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
  country("kr", "한국", "Korea", "🇰🇷", ["seoul", "busan", "jeju", "gyeongju", "incheon", "gangneung", "jeonju", "yeosu"]),
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

export const DEFAULT_CITY_ID = "tokyo";
export const MAX_SELECTED_CITIES = 2;

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
