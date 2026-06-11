---
name: finalize-minor-task
description: 명세서 없이 수행된 소규모 백엔드 작업을 정리하고 아카이브 및 커밋을 생성한다. MinorTasks 아카이브에 변경 내역을 기록한다.
disable-model-invocation: true
---

Recommended Model : Codex Sonnet

** 한국어 스타일 유지 **

## 언제 사용하나요?

- 자동으로 사용되지 않도록 한다.
- 반드시 사용자의 호출에 의해서만 실행된다.
- 다음과 같은 **소규모 작업 완료 후 사용된다**:

예:

- 버그 수정
- 코드 리뷰 피드백 반영
- 설정/환경변수 값 수정
- 로그·에러 메시지 보정
- 작은 리팩토링

다음 경우에는 **절대 사용하지 않는다**:

- 신규 기능 개발
- 시스템/모듈 구조 변경
- 아키텍처 변경
- DB 스키마 변경(마이그레이션 동반)

위 경우는 반드시 `spec-writer` → `implement-agent` → `finalize-feature` 프로세스를 사용한다.

---

# Instructions

## 1. 현재 작업 변경 사항 분석

먼저 현재 작업 상태를 분석한다.

- `git status` 로 변경 파일 확인
- `git diff` 로 실제 변경 내용 분석
- 변경 목적을 추론한다

다음 항목을 식별한다:

- 변경된 파일 목록
- 변경 유형 (신규 / 수정 / 삭제)
- 작업 목적 (버그 수정 / 설정 변경 등)

소규모 작업이라도 테스트가 영향을 받는다면 `npm test`(또는 `npx vitest run`) 통과 여부를
확인하고, 타입 변경이 있으면 `npx tsc --noEmit` 를 확인한다.

---

## 2. scope 결정

소규모 작업의 scope 는 다음 기준으로 결정한다.

우선순위:

1. 현재 세션의 사용자 요청 내용
2. 변경된 파일 이름
3. 변경된 코드 내용

scope 는 **짧고 명확하게 작성한다**.

예:

```
auth-null-fix
config-timeout-tune
refund-error-message
order-service-refactor
```

---

## 3. MinorTasks 아카이브 생성

아카이브 위치:

```
Docs/Archive/MinorTasks
```

다음 형식의 폴더를 생성한다.

```
YYYYMMDD_scope
```

예:

```
Docs/Archive/MinorTasks/20260602_auth-null-fix/
```

---

## 4. plan.md 생성

아카이브 폴더에 `plan.md` 파일을 생성한다.

포맷:

```markdown
# {scope} 수정 내역

Skill used : finalize-minor-task

## 변경 파일 목록

| 파일            | 변경 유형 | 설명           |
| --------------- | --------- | -------------- |
| src/...         | 수정      | 변경 내용 요약 |

## 수정 내용

- 수행한 변경 사항
- 수정한 로직 설명

## 수정 사유

- 왜 이 변경이 필요했는지 설명

## 특이사항

- 구현 중 발생한 이슈
- 향후 참고사항
- 새 환경변수 추가 시 배포 환경 설정 갱신 필요 여부 명시
```

작성 규칙:

- 실제 변경된 파일만 기록한다
- 기술적인 용어 유지
- 한국어 스타일 유지

---

## 5. AGENTS.md 업데이트 (조건부)

다음 **갱신 트리거 체크리스트** 중 하나라도 해당하면 AGENTS.md를 업데이트한다:

- [ ] 새 모듈 추가 또는 모듈 경계/계층 구조 변경
- [ ] 새 외부 연동(외부 API·큐·캐시) 추가
- [ ] 인증/권한 정책 변경
- [ ] 새 환경변수/설정 키 추가
- [ ] 코딩 컨벤션 또는 금지 사항 변경

해당하지 않으면 AGENTS.md를 수정하지 않는다 (단순 버그 수정, 값 조정, 메시지 보정 등).

> 스키마 변경·API 계약 변경처럼 구조에 영향을 주는 작업은 소규모 작업이 아니다.
> `finalize-feature` 프로세스를 사용한다.

업데이트 규칙:

- 파일 전체를 재작성하지 않는다
- 관련 섹션을 찾아 append 한다

---

## 6. CHANGELOG Fragment 생성

**Docs/CHANGELOG.md를 직접 수정하지 않는다.** 대신 개별 fragment 파일을 생성한다.

파일 위치: `Docs/changelog-fragments/`

파일명: `YYYYMMDD_{scope}.md`

- 예: `20260602_auth-null-fix.md`

내용 포맷:

```markdown
### {제목}

- 변경 내용 1
- 변경 내용 2
```

작성 규칙:

- API 소비자/운영 관점에서 간단히 요약
- 기술 용어 유지
- 한국어 스타일 유지

> fragment 합산은 `merge-changelog` 스킬로 별도 수행한다.

---

## 7. 커밋 메시지 생성

기존 커밋 스타일을 확인한 후 prefix 선택:

- `fix:` — 버그 수정
- `refactor:` — 리팩토링
- `chore:` — 설정 변경

커밋 형식:

```
{prefix}: {scope} 수정 — {핵심요약1/핵심요약2}

- 변경 내용 상세
- 변경 내용 상세
```

작성 규칙:

- 요약 라인은 2~5개의 핵심 항목
- 실제 변경 내용만 작성
- 변경되지 않은 내용 작성 금지
- 기술적인 용어 유지
- 한국어 스타일 유지
- **AI 서명·자동 생성 트레일러(Co-Authored-By 등)를 넣지 않는다.** 사람이 직접 쓴 것처럼 자연스럽게 작성한다.

---

## 8. git 커밋 수행

변경 파일을 **개별적으로 스테이징한다**.

```
git add path/to/file
```

주의:

- `git add .` 사용 금지
- `.gitignore` 대상 파일 포함 금지
- `.env` 파일은 절대 스테이징하지 않는다

HEREDOC 방식으로 커밋 작성:

```bash
git commit -m "$(cat <<'EOF'
fix: {scope} 수정 — {핵심요약}

- 상세 내용
EOF
)"
```

중요:

- **git push 는 절대 수행하지 않는다**

---

## 9. 결과 출력

사용자에게 다음 정보를 출력한다:

- 생성된 커밋 메시지
- 커밋된 파일 목록
- 생성된 MinorTasks 아카이브 경로
- 새 환경변수 추가 시 배포 환경 설정 갱신 안내

또한 다음 안내 메시지를 출력한다:

```
커밋이 완료되었습니다.
push가 필요하시면 직접 git push 를 수행해주세요.
```

---

# Minor Task Workflow

소규모 작업의 전체 흐름:

```
소규모 작업 수행
   ↓
finalize-minor-task 실행
   ↓
MinorTasks 아카이브 생성
   ↓
CHANGELOG Fragment 생성
   ↓
git commit
```

이 스킬은 **소규모 작업 기록과 커밋 정리를 자동화하기 위한 전용 스킬이다.**
