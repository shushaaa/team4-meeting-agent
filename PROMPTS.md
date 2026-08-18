# 최소 MVP 실행 프롬프트

## 1. 기초정보 준비

```text
profile/profile-template.md를 기준으로 samples/profile.md의 가상 인물 정보를 profile/profile.md에 옮겨줘.
명시된 값만 사용하고 빠진 항목은 비워 둬. 실제 개인정보는 추가하지 마.
```

## 2. 경로 A · 답변 없이 업무 기록

```text
samples/work-note.md를 경로 A로 처리해줘.
career-record를 호출한 뒤 career-verify를 호출해.
보완 질문은 최대 3개 생성하되 답변을 기다리며 중단하지 마.
결과는 records/<record_id>.md 한 파일에 저장하고 기본 이력서는 만들지 마.
```

## 3. 경로 B · 1차 기본 이력서

```text
경로 B로 profile/profile.md와 검증된 records/*.md만 사용해 output/base-resume.md를 만들어줘.
확인 정보만 사용하고 모든 사실 문장에 근거를 표시해.
```

## 4. 경로 A · 보완 답변 반영

```text
samples/answers.md와 samples/evidence.md를 기존 업무 기록에 반영해줘.
기존 record_id를 유지한 채 career-record → career-verify 순서로 다시 실행해.
덮어쓰기 전에 기존 기록과 이력서의 핵심 상태를 docs/test-result.md의 1차 결과에 적어줘.
```

## 5. 경로 B · 2차 기본 이력서

```text
갱신된 검증 기록으로 output/base-resume.md를 다시 만들어줘.
확인 정보만 사용하고 모든 사실 문장에 근거를 표시해.
1차와 2차의 확인 항목·미확인 항목·이력서 문장 차이를 docs/test-result.md에 기록해.
```
