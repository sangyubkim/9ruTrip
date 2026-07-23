# SMS 경비 입력 (Android)

Expo Go에서는 **SMS 인박스 자동 읽기가 불가**합니다. 실사용 경로는 아래입니다.

## 권장: 붙여넣기 / 공유

1. 카드사 SMS를 길게 눌러 **복사**
2. 9ruTrip → 경비 → **클립보드에서 붙여넣기** → SMS 파싱
3. 또는 SMS 앱 **공유** → 9ruTrip (커스텀/dev 빌드에서 `text/plain` intent 수신)

`app.config.js`에 Android `SEND` / `text/plain` intentFilter가 있습니다.
**Expo Go에서는 공유 타깃으로 나타나지 않을 수 있습니다.** 개발 빌드(`expo-dev-client`) 또는 `eas build` 후 확인하세요.

## 풀 인박스 읽기 (선택·보류)

| 방식 | 비고 |
|------|------|
| Expo Go | 불가 |
| expo-dev-client + SMS 권한 플러그인 | 커스텀 네이티브 모듈 필요 |
| 붙여넣기/공유 (현재) | 동작·보안·스토어 심사에 유리 |

네이티브 인박스 스캐폴드를 넣을 경우에도 **기본은 OFF**, README에 “커스텀 빌드 필요”를 명시하세요.

## 파서

- API: `POST /trip/parse-sms`
- 오프라인 폴백: `apps/mobile/src/utils/smsParse.ts`
