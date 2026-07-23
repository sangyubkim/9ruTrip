# 일본 대중교통 파트너 API (JP Transit)

Google Directions API는 **일본 대중교통(transit)을 지원하지 않습니다**.  
(`ZERO_RESULTS`가 흔함 → 앱은 하버사인 추정 + 외부 환승 앱 deep link로 보완)

9ruTrip은 아래 폴백 체인을 사용합니다.

1. **`JP_TRANSIT_PROVIDER=navitime`** + 자격증명 → NAVITIME `route_transit` 시도  
2. 실패/미설정 → **하버사인 추정** + **Yahoo / Google Maps transit deep link**

가짜 NAVITIME 응답을 “실측”처럼 넣지 않습니다. 키가 없으면 추정+딥링크가 정상 동작입니다.

---

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `JP_TRANSIT_PROVIDER` | 파트너 사용 시 | `navitime` 일 때만 파트너 호출 |
| `NAVITIME_API_KEY` | 파트너 사용 시 | API 키 / RapidAPI 키 |
| `NAVITIME_API_HOST` | 파트너 사용 시 | 예: 계약 HOST 또는 `navitime-route-totalnavi.p.rapidapi.com` |
| `NAVITIME_CID` | 직접 계약 시 | `{HOST}/{CID}/v1/route_transit` 경로 |
| `NAVITIME_RAPIDAPI_HOST` | RapidAPI 시 | `x-rapidapi-host` 헤더 (기본=API_HOST) |

예시 (`apps/api/.env` — **실키 커밋 금지**):

```env
JP_TRANSIT_PROVIDER=navitime
NAVITIME_API_KEY=
NAVITIME_API_HOST=
# NAVITIME_CID=
# NAVITIME_RAPIDAPI_HOST=navitime-route-totalnavi.p.rapidapi.com
```

HOST/CID가 없으면 키가 있어도 `{ ok:false, reason:'missing_host_or_cid' }` 로 **폴백**합니다.  
계약 후 HOST·CID(또는 RapidAPI 호스트)를 채우면 `engine: partner:navitime` 이 됩니다.

---

## 신청·문서 링크

### NAVITIME API 2.0

- 사양 인덱스: https://api-sdk.navitime.co.jp/api/specs/
- ルート検索(トータルナビ) `/route_transit`: https://api-sdk.navitime.co.jp/api/specs/api_guide/route_transit.html
- 요금·판매 형태: https://api-sdk.navitime.co.jp/api/specs/description/about_navitime_api.html
- 문의(직접 계약): 내비타임 재팬 법인 계약 필요 (유상, 초기 도입비 가능)
- API 마켓: [RapidAPI NAVITIME Route(totalnavi)](https://rapidapi.com/navitimejapan-navitimejapan/api/navitime-route-totalnavi) / SBI API Hub  
  - Rapid BASIC: 월 500콜까지 무료 티어 안내가 있으나 **플랜·한도는 변경될 수 있음** — 공식 요금표 재확인

### Yahoo!乗換案内 / Yahoo!地図

- Yahoo!地図 URL 스펙(환승 lat/lng): https://map.yahoo.co.jp/blog/archives/20220218_map_urlspec.html  
  - 앱 deep link: `https://map.yahoo.co.jp/route/train?from=...&to=...&fromLat=&fromLon=&toLat=&toLon=`
- 乗換案内 웹: https://transit.yahoo.co.jp/  
- **법인 파트너/유료 API**는 Yahoo! JAPAN 비즈니스/개발자 채널을 통해 별도 신청.  
  본 프로젝트는 우선 **공개 deep link**만 사용 (스크래핑·비공식 API 금지).

### Google

- Maps 앱 `travelmode=transit` 딥링크는 일본에서도 앱 UI로 환승을 열 수 있음  
- **Directions API transit 모드는 JP에서 사용 불가**에 가깝다고 가정하고 설계

---

## 응답 필드 (`TransportOption` transit)

| 필드 | 예 |
|------|----|
| `engine` | `haversine:transit` \| `partner:navitime` \| (`directions:transit` 는 드묾) |
| `deepLink` | Yahoo 기본 URL |
| `deepLinks.google` / `.yahoo` | 양사 환승 URL |
| `note` | 한국어 안내 문구 |

코드: `apps/api/lib/jp-transit.mjs` → `compareLegTransport` / enrich 경로에서 transit 옵션에 병합.

---

## 요금·운영 주의

- NAVITIME·Yahoo 법인 API는 **유료**인 경우가 많습니다. 트래픽·월콜 한도를 보고 도입하세요.
- Directions `ZERO_RESULTS`를 캐시해 반복 과금을 피합니다 (기존 transport 캐시).
- 파트너 키·HOST를 git에 넣지 마세요. `.env.example` 플레이스홀더만 유지합니다.

---

## 파트너 나중에 켜는 방법

1. NAVITIME(또는 RapidAPI) 계약·키 발급  
2. `apps/api/.env`에 `JP_TRANSIT_PROVIDER=navitime`, `NAVITIME_API_KEY`, `NAVITIME_API_HOST`(+CID 또는 Rapid host)  
3. API 재시작 → `POST /trip/compare-transport` 의 transit `engine` 이 `partner:navitime` 인지 확인  
4. 실패 시 `partnerFallbackReason` / 서버 로그의 `reason` (`missing_host_or_cid`, `http_401` 등) 확인 후 deep link 폴백이 유지되는지 점검

---

## 수동 QA

1. 키 없음: 비교 시트에 「추정」+ 안내 문구, **Yahoo 환승** / **Google 환승** 버튼 → 외부 앱/브라우저 오픈  
2. Plan/현장 **길안내**(대중교통): Google / Yahoo 선택 Alert  
3. `JP_TRANSIT_PROVIDER=navitime` 만 있고 HOST 없음 → 여전히 추정+딥링크 (크래시 없음)  
4. HOST+키 실계약 후 → `partner:navitime` + 분/요금 갱신
