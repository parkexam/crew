# 발맞춤 — 함께 뛰는 러닝 크루

크루와 기록을 맞대고, 하루 목표를 채우고, 비어 있는 부위(가슴·등·어깨·팔·코어·하체·둔근)를 채우는
러닝 & 근력 밸런스 앱.

- 프로덕션: https://parkexam-crew.pages.dev/
- 스택: Vite + React 18 + TypeScript + Tailwind CSS v4 + wouter + recharts + lucide-react

## 화면

| 경로        | 화면                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| `/`         | 홈 — 오늘의 러닝, 일일 목표 링, 이번 주 그래프, 크루 순위, 부족한 부위    |
| `/run`      | 러닝 — GPS 러닝 타이머(위치 권한이 없으면 평균 페이스로 추정), 기록 직접 입력 |
| `/crew`     | 크루 — 주간 랭킹(거리/시간/페이스), 피드, 주간 공동 미션, 배지, 초대 코드 |
| `/goals`    | 목표 — 일일·주간 목표, 12주 활동 캘린더, 연속 기록, 개인 기록            |
| `/balance`  | 밸런스 — 부위별 레이더, 부족 부위 진단, 추천 루틴, 운동 라이브러리        |

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 타입 검사(tsc) + dist 생성
npm run preview  # 빌드 결과 미리보기
```

## 구조

```
src/
  main.tsx                 # 엔트리
  App.tsx                  # 세션 확인 → 온보딩/라우터 분기
  index.css                # Tailwind v4 테마(종이·잉크·트랙 컬러)
  pages/                   # Welcome, Home, Run, Crew, Goals, Balance, NotFound
  components/              # AppShell, ProgressRing, BodyRadar, Sheet, ActivityCalendar 등
  contexts/ThemeContext.tsx
  lib/
    trpc.ts                # tRPC + React Query 호환 훅(useQuery / useMutation / useUtils)
    api.ts                 # 도메인 로직(원래 server/service.ts)
    db.ts                  # localStorage 스토어 + 데모 크루/기록 시드
    session.ts             # 기기 세션 저장소
    utils.ts               # cn()
  shared/
    fitness.ts             # 부위·운동·밸런스 계산·포맷 (클라이언트/서버 공용)
    crew-rewards.ts        # 주간 배지·공동 미션 마일스톤
server/                    # 참고용 원본 Manus 서버 소스(빌드에 포함되지 않음)
```

## 데이터

서버 없이 동작한다. 러너 계정, 러닝 기록, 근력 기록, 크루 정보가 브라우저
`localStorage`에 저장되어 새로고침해도 유지되고, 앱 데이터를 지우면 계정도 사라진다.

- `balmatchum.db.v1` — 러너·크루·러닝·운동 기록
- `balmatchum.session.v1` — 기기 세션(handle + token)
- `balmatchum.theme.v1` — 테마

체험용 크루 `DAWN55`(한강 새벽런)와 지난 4주 데모 기록이 자동으로 채워져 랭킹이 살아 있는 상태로 시작한다.
