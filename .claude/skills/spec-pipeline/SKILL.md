---
name: spec-pipeline
description: 기획 문서를 받아 spec-writer(Sonnet)로 명세서를 작성하고, verify-spec(Opus)으로 검증한다. 최대 2회 수정 루프 후 implement-spec 또는 implement-agent 실행을 안내한다.
---

Recommended Model : Claude Sonnet
** 한국어 스타일 유지 **

## 언제 사용하나요?

- 자동으로 사용되지 않도록 한다.
- 기획 문서가 완성된 후 명세서 작성부터 검증까지 한 번에 진행할 때 사용한다.
- 호출 예: `/spec-pipeline @Docs/content-design/[content]20260414_facility_system_design.md`

## Instructions

이 스킬은 `spec-writer → verify-spec` 파이프라인을 오케스트레이션한다.

### 입력

사용자가 `/spec-pipeline` 호출 시 인자로 기획 문서 경로를 전달한다.
기획 문서를 찾지 못하면 "기획 문서 경로를 전달해주세요." 메시지를 출력하고 전달될 때까지 진행하지 않는다.

### 루프 제한 규칙

- 수정 횟수 카운터 `revision = 0`으로 초기화한다.
- verify-spec FAIL 후 명세서를 수정할 때마다 `revision += 1`한다.
- `revision >= 2`인 상태에서 FAIL이면 루프를 종료하고 사용자에게 결정을 요청한다.
- **최대 3회 verify-spec 실행** (초기 1회 + 수정 후 최대 2회)

### 실행 흐름

```
[1단계] 명세서 작성 (spec-writer 1~4단계, Sonnet)
    ↓
[2단계] 명세서 검증 (verify-spec, Opus sub-agent)
    ↓
PASS → [3단계-A] spec-writer 5단계 (구현 방식 추천) → 종료
FAIL + revision < 2 → [3단계-B] 수정 후 [2단계]로 복귀
FAIL + revision >= 2 → [3단계-C] 최종 FAIL 출력 → 사용자 결정 요청
```

---

### [1단계] 명세서 작성

`.claude/skills/spec-writer/SKILL.md`를 Read로 읽고 **1~4단계를 그대로 수행**한다.

- 1단계: 기획 문서 분석
- 2단계: 코드베이스 탐색
- 3단계: 기획 의도 확인 (사용자 확인 필요 시 중단)
- 4단계: 명세서 생성 (`Docs/spec/` 에 파일 저장)

**5단계(구현 방식 추천)는 이 시점에서 수행하지 않는다.** verify-spec PASS 후 수행한다.

---

### [2단계] 명세서 검증

명세서 파일이 생성되면 다음을 수행한다.

1. `.claude/skills/verify-spec/SKILL.md`를 Read로 읽어 지침 전문을 확인한다.
2. Opus sub-agent를 호출하여 검증을 수행한다:

```
Agent(
  subagent_type: "general-purpose",
  model: "opus",
  prompt: """
[verify-spec 스킬 지침 전문]

검증 대상:
- 기획 문서: {기획 문서 경로}
- 명세서: {명세서 파일 경로}
"""
)
```

3. sub-agent의 결과(PASS/FAIL + 이슈 목록)를 수신한다.

---

### [3단계-A] PASS 처리

`spec-writer` 5단계(구현 방식 추천 및 실행 안내)를 수행한다.

---

### [3단계-B] FAIL + 수정 가능 처리 (revision < 2)

1. 검증 결과의 이슈 목록과 수정 지시사항을 사용자에게 출력한다:

```
## 명세서 수정 필요 (수정 {revision + 1}/2회)

{verify-spec 결과 전문}

수정 지시사항을 반영하여 명세서를 업데이트합니다.
```

2. 수정 지시사항을 반영하여 명세서 파일을 수정한다 (spec-writer 4단계 재수행).
3. `revision += 1` 후 [2단계]로 돌아간다.

---

### [3단계-C] FAIL + 최대 수정 횟수 도달 처리 (revision >= 2)

다음 메시지를 출력하고 사용자에게 결정을 요청한다:

```
⚠️ 명세서 검증 최대 수정 횟수(2회)에 도달했습니다.

남은 이슈:
{이슈 목록}

선택지:
1. 현재 명세서로 구현 진행 (/implement-spec 또는 /implement-agent)
2. 기획 문서를 수정 후 /spec-pipeline 재실행
3. 명세서를 직접 수정 후 /verify-spec 으로 단독 재검증
```
