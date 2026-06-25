# 실제 계정 연결 가이드 (Supabase)

이 앱은 **Supabase** 가 설정되면 실제 이메일/비밀번호 + 구글·애플 로그인과
**클라우드 동기화**(어느 기기에서나 같은 포트폴리오)가 켜집니다.
설정하지 않으면 지금처럼 **로컬 데모 모드**로 그대로 동작하니, 천천히 진행해도 됩니다.

소요 시간: 약 10분. 비용: 무료 플랜으로 충분합니다.

---

## 1) Supabase 프로젝트 만들기
1. <https://supabase.com> 가입 → **New project**.
2. 이름/DB 비밀번호/리전(Region은 `Northeast Asia (Seoul)` 권장) 선택 후 생성.
3. 생성되면 **Project Settings → API** 에서 두 값을 복사해 둡니다.
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

## 2) 데이터베이스 테이블 + 보안정책(RLS) 만들기
좌측 메뉴 **SQL Editor → New query** 에 아래를 붙여넣고 **Run**.

```sql
-- 사용자별 포트폴리오 1행 (JSON 한 덩어리로 저장)
create table if not exists public.portfolios (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 행 단위 보안: 본인 데이터만 읽고 쓸 수 있음
alter table public.portfolios enable row level security;

create policy "portfolios_select_own" on public.portfolios
  for select using (auth.uid() = user_id);
create policy "portfolios_insert_own" on public.portfolios
  for insert with check (auth.uid() = user_id);
create policy "portfolios_update_own" on public.portfolios
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## 3) 인증(Auth) 기본 설정
**Authentication → Sign In / Providers → Email**
- 빠르게 테스트하려면 **"Confirm email" 끄기**(가입 즉시 로그인). 운영 시엔 켜두는 걸 권장.

**Authentication → URL Configuration**
- **Site URL**: 배포 주소 (예: `https://portfolio-heatmap-nine.vercel.app`)
- **Redirect URLs** 에 아래를 모두 추가 (OAuth·비밀번호 재설정·이메일 확인에 필요):
  - `http://localhost:5173`
  - `https://portfolio-heatmap-nine.vercel.app`
  - (사용하는 다른 배포 주소가 있으면 함께)

## 4) (선택) 구글 / 애플 로그인
지금도 이메일 로그인은 바로 됩니다. 소셜 로그인을 원하면:

**구글** — **Authentication → Providers → Google** 켜기
1. Google Cloud Console → "OAuth 동의 화면" 구성 → "사용자 인증 정보 → OAuth 클라이언트 ID(웹)".
2. 승인된 리디렉션 URI에 Supabase가 알려주는 `…/auth/v1/callback` 주소를 넣기.
3. 발급된 **Client ID / Secret** 을 Supabase Google 설정에 붙여넣고 저장.

**애플** — **Providers → Apple** (Apple Developer 멤버십 필요, 설정이 더 복잡).
당장은 구글만 켜고 애플은 나중에 해도 됩니다. (애플 버튼은 미설정 시 눌러도 에러만 납니다.)

## 5) 환경변수 넣기
**로컬 개발**: 프로젝트 루트에 `.env` 파일 생성 (`.env.example` 복사) →
```
VITE_SUPABASE_URL=https://YOUR-ref.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-anon-key
```

**Vercel 배포**: 프로젝트 → **Settings → Environment Variables** 에
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 두 개를 추가(Production/Preview/Development 모두 체크) → **Redeploy**.

> anon key는 클라이언트에 노출돼도 안전합니다(2번의 RLS가 데이터를 보호). 다만 `service_role` 키는 절대 클라이언트/깃허브에 올리지 마세요.

## 6) 확인
- 헤더 우측 사람 아이콘 → 회원가입 → 이메일/비밀번호로 가입 → 마이페이지에
  "**클라우드에 동기화돼요**" 초록 표시가 보이면 성공.
- 종목을 추가하면 1~2초 뒤 Supabase **Table Editor → portfolios** 에 행이 생기고 `data`가 채워집니다.
- 다른 브라우저/기기에서 같은 계정으로 로그인하면 동일한 포트폴리오가 불러와집니다.

## 동기화 동작 방식 (참고)
- 로그인 시: 클라우드에 데이터가 있으면 **클라우드를 불러오고**, 없으면 현재 로컬 데이터를 클라우드로 올립니다.
- 이후 편집은 1.5초 디바운스로 자동 업서트됩니다.
- 단순화를 위해 "로그인 시 클라우드 우선" 정책이라, 로그아웃 상태에서 새로 입력한 뒤 *다른 계정의 데이터가 이미 클라우드에 있는* 계정으로 로그인하면 그 클라우드 데이터가 우선합니다. (필요하면 updated_at 기준 최신 우선 머지로 고도화할 수 있어요.)
