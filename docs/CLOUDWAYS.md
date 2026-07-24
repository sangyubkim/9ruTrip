# 9ruTrip Cloudways (외부망 API)

LAN 밖(휴대폰 데이터·다른 Wi‑Fi)에서 앱이 API에 붙으려면 **공개 HTTPS URL**이 필요합니다.  
9ruDocs와 **같은 Node 프로세스/URL을 공유하지 않습니다.**

## 왜 Docs URL을 쓰면 안 되나

| | 9ruDocs | 9ruTrip |
|--|---------|---------|
| 코드 | `D:\01_Project\9ruDocs\apps\api` | `D:\01_Project\9ruTrip\apps\api` |
| 기본 포트(로컬) | 3001 | **3011** |
| 라우트 | `/blog/*`, `/wordpress/*` 등 | **`/trip/*`**, `/wordpress/publish` |
| 예시 공개 URL | `https://phpstack-…cloudwaysapps.com/apps/api` | **별도 앱**의 `…/apps/api` |

Docs Cloudways URL은 Trip의 `POST /trip/itinerary` 등을 제공하지 않습니다.  
WordPress·Gemini **키 패턴**은 공유 가능하지만, **프로세스 URL은 반드시 분리**합니다.

## 권장 레이아웃 (안전)

**9ruDocs와 동일한 방식: Cloudways에 별도 Application**을 만들고, 그 안에서 Node로 `apps/api/server.mjs`를 띄운 뒤 Apache가 `/apps/api` → Node로 프록시합니다.

```
[휴대폰] --HTTPS--> Cloudways(9ruTrip 앱)
                      └── /apps/api  →  Node :PORT  (9ruTrip server.mjs)
                            ├── GET  /health
                            └── POST /trip/...
```

같은 서버에 Docs와 공존해야 하면 프록시 경로를 `/apps/trip-api`로 두고, 서버는 둘 다 strip합니다.  
**충돌·운영 실수를 줄이려면 별도 Application을 권장합니다.**

서버는 요청 path에서 다음 prefix를 제거한 뒤 라우팅합니다.

- `/apps/api` (Docs와 동일 패턴 · **별도 앱에서 권장**)
- `/apps/trip-api` (같은 호스트 공존 시)
- `/api`

## 제안 공개 URL 패턴

```
https://<9ruTrip-Cloudways-호스트>/apps/api
```

헬스체크:

```
GET https://<호스트>/apps/api/health
→ { "ok": true, "service": "9rutrip-api", ... }
```

모바일 `EXPO_PUBLIC_API_BASE_URL` / 설정 화면에는 **trailing slash 없이** base만 넣습니다.

```
https://<호스트>/apps/api
```

(앱이 `/health`, `/trip/...`를 붙입니다.)

---

## 앱 생성 직후 (지금 당장)

`9rutrip-api` 카드가 Applications 목록에 보이는 상태부터입니다.  
(9ruDocs 저장소에는 `.htaccess`/배포 스크립트가 **없고** 서버에만 설정돼 있었습니다. Trip은 아래 샘플로 Docs와 같은 `/apps/api` 패턴을 복제합니다.)

### 1) 앱 카드 → 접속 정보 확인

1. Cloudways → **Applications** → **`9rutrip-api`** 카드 클릭.
2. 왼쪽 **Access Details** (또는 Application Management 상단):
   - **Application URL** — `https://phpstack-….cloudwaysapps.com` 형태. 메모.
   - **SSH/SFTP** — Public IP, 사용자명(`master` 등), 비밀번호 또는 SSH 키.
   - **Application Path / Folder** — 예: `~/applications/<folder>/` (아래 `REPLACE_APP_FOLDER`).
3. **SSL Certificate**에서 Let’s Encrypt 등으로 HTTPS 활성화 (이미 켜져 있으면 유지).
4. **Application Settings → Stack**이 **Hybrid**인지 확인 (`.htaccess` 프록시용). Lightning이면 Docs 패턴과 다름.

공개 API base (나중에 모바일·curl에 사용):

```
https://<Application-URL-호스트>/apps/api
```

### 2) SSH 접속

Access Details의 호스트·계정으로 SSH (PuTTY / Windows Terminal / `ssh`).

```bash
# 예
ssh master@<PUBLIC_IP>
cd ~/applications/<REPLACE_APP_FOLDER>
pwd   # public_html 이 보이면 OK
```

### 3) 코드 배포 — Docs와 동일: Deployment via GIT

Docs 앱(`…/applications/<docs폴더>/git_repo`)은 SSH `mkdir`이 아니라  
Cloudways **Deployment via GIT**가 `git_repo`를 **root 권한**으로 만든 구조입니다.  
Trip도 **같은 방식**을 권장합니다. (앱 루트에서 `mkdir git_repo` → master Permission denied)

#### 3-A) GitHub에 Cloudways SSH 키 등록 (처음이면 필수)

기억이 없어도 **지금 등록하면 됩니다.** Docs용 키와 Trip용 키는 **앱마다 다를 수 있음**.

1. Cloudways → **`9rutrip-api`** → **Deployment via GIT** → **View SSH Keys**
2. 공개키 전체 복사 (`ssh-rsa AAAA…` 또는 `ssh-ed25519 AAAA…` 한 줄)
3. 브라우저에서 GitHub 저장소 열기: `https://github.com/sangyubkim/9ruTrip`
4. **Settings** → **Deploy keys** → **Add deploy key**
   - Title: `cloudways-9rutrip-api`
   - Key: 방금 복사한 공개키
   - Allow write access: **끄기** (pull만)
   - **Add key**
5. (선택) 예전에 Docs용으로 넣었는지 확인:  
   Docs 저장소 Settings → Deploy keys, 또는  
   GitHub → 프로필 → **Settings → SSH and GPG keys** (계정 전역 키)

> Deploy keys는 **저장소 Settings**에 있습니다. 계정 SSH keys와 위치가 다릅니다.

#### 3-B) Cloudways에서 Authenticate / Deploy

1. **GIT Remote Address** (HTTPS 금지 — `Invalid remote address` 남):
   ```
   git@github.com:sangyubkim/9ruTrip.git
   ```
2. **Authenticate** → 성공 후 branch (`main` 또는 `master`) 선택 → Deploy
3. SSH에서 확인:
   ```bash
   ls ~/applications/sppfcbbvnq/git_repo
   # package.json, apps/ 보이면 OK
   ```

#### 3-C) 대안: `tmp`에 수동 clone (패널 GIT 쓰기 어려울 때)

```bash
cd ~/applications/sppfcbbvnq/tmp
mkdir -p git_repo && cd git_repo
git clone https://github.com/sangyubkim/9ruTrip.git .
```

공개 저장소면 HTTPS clone 가능. 비공개면 PAT 또는 Deploy key + SSH URL.

### 4) Node · 의존성 · `.env`

```bash
node -v    # LTS(18+) 없으면 nvm/노드 설치 후 PATH 확인
cd ~/applications/<REPLACE_APP_FOLDER>/9ruTrip
npm install
npm run shared:build

cp apps/api/.env.example apps/api/.env
nano apps/api/.env   # 또는 vi
```

`apps/api/.env` 최소값:

| 키 | 예시 / 메모 |
|----|-------------|
| `PORT` | **`3011`** (같은 서버의 Docs API가 3001이면 **충돌 피함**) |
| `CORS_ORIGIN` | `*` 또는 모바일 origin |
| `GEMINI_API_KEY` 등 | 로컬·Docs와 동일 패턴 (실키만 서버에) |

수동 기동 테스트:

```bash
node apps/api/server.mjs
# 다른 SSH 세션에서:
curl -sS http://127.0.0.1:3011/health
curl -sS http://127.0.0.1:3011/apps/api/health
# → "service":"9rutrip-api"
```

### 5) Reverse proxy `/apps/api` → Node

샘플: [`docs/deploy/cloudways/apps-api.htaccess.sample`](deploy/cloudways/apps-api.htaccess.sample)

```bash
mkdir -p ~/applications/<REPLACE_APP_FOLDER>/public_html/apps/api
# 샘플을 .htaccess 로 복사한 뒤 PORT(3011)가 .env 와 같은지 확인
cp ~/applications/<REPLACE_APP_FOLDER>/9ruTrip/docs/deploy/cloudways/apps-api.htaccess.sample \
   ~/applications/<REPLACE_APP_FOLDER>/public_html/apps/api/.htaccess
```

`[P]` 플래그(프록시)가 실패하면 Cloudways 지원에 **mod_proxy / mod_proxy_http** 활성화를 요청하세요.  
Docs 앱의 `public_html/apps/api/.htaccess`가 있으면 **포트만 3011로 바꿔** Trip 앱에 그대로 복제해도 됩니다.

### 6) 프로세스 매니저 (PM2 권장)

SSH를 끊어도 API가 살아 있어야 합니다. Docs에서 PM2를 썼다면 동일.

```bash
npm install -g pm2   # 없으면
cd ~/applications/<REPLACE_APP_FOLDER>/9ruTrip
# 샘플 복사 후 cwd·PORT 수정
cp docs/deploy/cloudways/ecosystem.config.cjs.sample ecosystem.config.cjs
nano ecosystem.config.cjs

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # 출력된 명령 한 번 실행
pm2 status
```

### 7) 헬스체크 · 모바일 URL

브라우저 또는 PC에서:

```bash
curl -sS "https://<Application-URL-호스트>/apps/api/health"
```

기대: `"ok":true`, **`"service":"9rutrip-api"`**  
(`9rudocs` 등이면 **Docs URL을 넣은 것** — Trip Application URL로 교체.)

모바일 `apps/mobile/.env` (또는 설정 → 고급 → API Base URL):

```
EXPO_PUBLIC_API_BASE_URL=https://<Application-URL-호스트>/apps/api
```

trailing slash 없이. Expo 재시작 후 연결 테스트.

---

## 사용자 직접 수행 절차 (요약)

이 저장소만으로는 Cloudways 콘솔·SSH·SSL을 자동화할 수 없습니다. 상세는 위 **앱 생성 직후**를 따르세요.

### A. Cloudways에 9ruTrip API 배포 (체크리스트)

1. ~~새 Application 생성~~ → **`9rutrip-api` 완료**
2. SSH 후 `git clone` (또는 SFTP)으로 모노레포 배포
3. `npm install` + `npm run shared:build` + `apps/api/.env` (`PORT=3011`)
4. `public_html/apps/api/.htaccess` → `127.0.0.1:3011` (샘플 참고)
5. PM2로 `apps/api/server.mjs` 상시 실행
6. HTTPS + `GET …/apps/api/health` → `9rutrip-api`

### B. 서버 환경 변수 (`apps/api/.env`)

| 키 | 필수 | 설명 |
|----|------|------|
| `PORT` | 권장 | 프록시가 가리키는 포트 (로컬 기본 3011과 달라도 됨) |
| `CORS_ORIGIN` | 권장 | 모바일/웹 origin. 불확실하면 `*` 포함 가능 |
| `GEMINI_API_KEY` | 일정 AI | 없으면 폴백 코스 |
| `GEMINI_MODEL` | 선택 | 예: `gemini-flash-lite-latest` |
| `WP_SITE_URL` / `WP_USERNAME` / `WP_APP_PASSWORD` | WP 발행 시 | 9ruDocs·blog-pipeline과 동일 패턴 |
| `GOOGLE_MAPS_API_KEY` | 선택 | Directions 실측 |

### C. 모바일에서 공개 URL 지정

1. 빌드/실행 전 `apps/mobile/.env`:
   ```
   EXPO_PUBLIC_API_BASE_URL=https://<호스트>/apps/api
   ```
2. 또는 앱 **설정 → 고급 → API Base URL**에 동일 주소 저장 후 「다시 확인」.
3. `service`가 `9rutrip-api`인지 확인. Docs 응답이면 **URL이 잘못됨**.

### D. 헬스체크 (배포 검증)

```bash
curl -sS "https://<호스트>/apps/api/health"
```

기대: `"ok":true`, `"service":"9rutrip-api"`.

로컬에서 prefix strip 확인:

```bash
curl -sS "http://localhost:3011/apps/api/health"
curl -sS "http://localhost:3011/health"
```

둘 다 동일하게 ok 여야 합니다.

---

## 이 저장소에서 자동화되지 않는 것

- Cloudways 로그인·앱 생성·도메인·SSL·방화벽·SSH
- 서버에 실제 `.htaccess` / PM2 등록 (샘플만 제공)
- 실제 `.env` 비밀값 입력
- Expo/EAS 스토어 빌드에 URL 주입 (선택 시 `eas.json` / EAS secrets는 사용자가 설정)

코드·문서 측 준비: `apps/api/server.mjs`의 `requestPathname`, 모바일 힌트,  
`docs/deploy/cloudways/*.sample`, 본 문서 **앱 생성 직후**.
