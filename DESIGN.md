# 이직 도우미 최소 MVP 설계

## 결론

기존 6개 서브에이전트를 3개로 줄였습니다.

```text
기초정보: 고정 양식

A. 업무 기록
career-record → career-verify → records/<record_id>.md

B. 기본 이력서
profile.md + records/*.md → career-resume → base-resume.md
```

## 이전 검토본에서 제거한 것

| 제거 항목 | 대체 방식 |
| --- | --- |
| `career-onboard` | `profile-template.md` 최초 1회 입력 |
| `career-collect`·`career-refine` | `career-record`로 통합 |
| `career-integrate` | 검증 기록 파일 자체를 원본으로 사용 |
| `career-use` | 기본 이력서 전용 `career-resume`으로 축소 |
| `career-ledger.md` | 제거 |
| 단계별 결과 파일 | `records/<record_id>.md` 한 파일로 통합 |
| 추정 상태 | 제거, 확인되지 않으면 모두 `미확인` |
| version·change-log | 제거 |
| 중복 탐지·실행 로그 | 제거 |
| 여러 출력 문서 | `base-resume.md` 한 종류만 유지 |

## 유지한 품질 장치

1. 업무별 고유 `record_id`
2. 기록과 검증 에이전트 분리
3. 보완 질문 최대 3개
4. 수치는 근거가 있을 때만 확인
5. 기본 이력서에는 확인 정보만 사용
6. 모든 사실 문장에 출처 표시

## 담당

| 담당자 | 범위 |
| --- | --- |
| 은선 | `career-record` |
| 예진 | `career-verify`, `career-resume`, 지휘 규칙 |

`career-record`는 자주 실행되고, `career-resume`은 필요할 때만 실행되므로 실제 작업량은 단순 개수만큼 차이 나지 않습니다.

## 파일 구조

```text
.claude/agents/
├─ record.md
├─ verify.md
└─ resume.md

profile/
├─ profile-template.md
└─ profile.md              # 실행 후 생성

records/
└─ WORK-YYYYMMDD-NNN.md

output/
└─ base-resume.md

docs/
├─ record-format.md
├─ resume-format.md
└─ test-checklist.md
```

## 두 바퀴 테스트

### 1차

- 짧고 불완전한 업무 메모 입력
- 질문은 생성하지만 답변 없이 검증
- 역할·수치 일부가 미확인으로 남음
- 기본 이력서에는 확인된 사실만 반영

### 2차

- 동일 `record_id`에 답변과 수치 근거 추가
- 같은 기록 파일을 갱신하고 다시 검증
- 확인 항목 증가
- 같은 기본 이력서 파일의 문장이 구체화

## 통과 기준

- 에이전트 수: 3개
- 답변 없이 검증까지 완료: 성공
- ID 없는 업무 기록: 0개
- 근거 없는 수치가 이력서에 사용됨: 0건
- 미확인 정보가 확정 문장으로 사용됨: 0건
- 근거 표시가 없는 사실 문장: 0건

## 현재 상태

- 3개 에이전트 정의: 완료
- 최소 파일 계약: 완료
- 기본 이력서 단일 출력: 완료
- 한 화면 프로토타입: 완료
- Claude Code 실제 실행: 미실행
- 실행용 파일 구성: 완료
