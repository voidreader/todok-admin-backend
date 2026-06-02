---
name: merge-changelog
description: changelog-fragments 디렉토리의 개별 fragment 파일들을 합산하여 CHANGELOG.md를 갱신한다. 릴리스 또는 정기 정리 시점에 사용한다.
---

Recommended Model : Claude Sonnet

** 한국어 스타일 유지 **

## 언제 사용하나요?

- 자동으로 사용되지 않도록 한다.
- 반드시 사용자의 호출에 의해서만 실행된다.
- 다음 시점에 사용한다:
  - 릴리스 브랜치 생성 전
  - main 머지 전
  - 정기적인 CHANGELOG 정리 시점
  - 사용자가 수동으로 CHANGELOG 합산을 요청할 때

---

## Instructions

### 1. Fragment 파일 수집

`Docs/changelog-fragments/` 디렉토리에서 모든 `.md` 파일을 수집한다.

- `.gitkeep` 등 비-마크다운 파일은 무시한다.
- fragment가 없으면 "합산할 changelog fragment가 없습니다." 메시지를 출력하고 종료한다.

### 2. Fragment 분석 및 정렬

각 fragment 파일을 읽고 다음을 추출한다:

- 파일명에서 날짜 추출 (예: `20260320_feature-name.md` → `2026-03-20`)
- 파일 내용 (변경 내역)

날짜 기준 **내림차순**으로 정렬한다 (최신이 먼저).

### 3. CHANGELOG.md 업데이트

파일 경로: `Docs/CHANGELOG.md`

기존 CHANGELOG.md의 **최상단 항목 위에** 새로운 내용을 삽입한다.

규칙:

- 같은 날짜의 fragment는 하나의 날짜 섹션으로 합친다.
- 기존 CHANGELOG에 이미 같은 날짜 섹션이 있으면 해당 섹션에 항목을 **추가**한다 (중복 방지).
- 기존 CHANGELOG 포맷을 유지한다.

포맷 예시:

```markdown
## 2026-03-20

### 로그인 기능 개선

- 토큰 갱신 로직 수정
- 세션 만료 처리 개선

### 버그 수정

- 특정 조건에서 발생하던 크래시 수정
```

### 4. Fragment 파일 삭제

CHANGELOG.md에 성공적으로 합산한 fragment 파일을 삭제한다.

```
git rm Docs/changelog-fragments/20260320_feature-name.md
```

- `.gitkeep` 파일은 삭제하지 않는다.

### 5. Git 커밋

변경된 파일들을 스테이징하고 커밋한다.

```
git add Docs/CHANGELOG.md
git commit -m "docs: CHANGELOG 합산 — {합산된 날짜 목록}"
```

- 커밋 메시지에 합산된 날짜 섹션들을 간략히 포함한다.
- fragment 파일은 4단계에서 `git rm`으로 이미 스테이징되어 있다.
- push는 하지 않는다.

### 6. 결과 출력

사용자에게 다음을 출력한다:

- 합산된 fragment 파일 목록
- CHANGELOG.md에 추가된 항목 요약
- 삭제된 fragment 파일 수
- 생성된 커밋 해시

---

## Fragment 파일 작성 규칙 (참고)

다른 스킬(`finalize-feature`, `finalize-minor-task`)이 fragment를 생성할 때 따르는 규칙:

파일 위치: `Docs/changelog-fragments/`

파일명: `YYYYMMDD_{scope}.md`

- 예: `20260320_login-improvement.md`
- 예: `20260320_crash-fix.md`

내용 포맷:

```markdown
### {제목}

- 변경 내용 1
- 변경 내용 2
```

- 사용자 관점에서 간단히 요약
- 기술 용어 유지
- 한국어 스타일 유지
