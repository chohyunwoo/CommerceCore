---
description: 현재 브랜치의 커밋들을 분석해 PR 제목/설명을 작성하고 생성한다
---

현재 브랜치의 변경사항으로 Pull Request를 만드세요.

## 순서

1. 아래를 병렬로 실행해 브랜치 상태를 파악한다:
   - `git status`
   - 현재 브랜치가 원격 브랜치를 추적 중인지, push가 필요한지 확인
   - `git log [base-branch]...HEAD` — base 브랜치(보통 `main`)에서 갈라진 이후의 전체 커밋 로그
   - `git diff [base-branch]...HEAD` — 전체 변경 내용
2. **최신 커밋 하나만이 아니라, PR에 포함될 모든 커밋**을 분석해서 PR 제목과 설명을 작성한다.
   - 제목: 70자 이내, 무엇을 바꿨는지 간결하게
   - 설명: `## Summary`(변경 요약 1~3줄), `## Test plan`(검증 체크리스트) 구조
3. 원격에 push가 필요하면 사용자에게 먼저 알리고 진행한다 (`git push -u origin <branch>`).
4. `gh pr create --title "..." --body "$(cat <<'EOF' ... EOF)"` 형식으로 PR을 생성한다.
5. 생성된 PR URL을 사용자에게 알려준다.

## 주의사항

- base 브랜치(`main`)에는 직접 push하지 않는다.
- force push는 사용자가 명시적으로 요청하지 않는 한 사용하지 않는다.
- PR 생성은 되돌리기 어려운 공개 행동이므로, push/PR 생성 전에 항상 변경 요약을 보여주고 진행 여부를 확인받는다.
- 이미 열려있는 PR이 있는지 `gh pr list`로 먼저 확인하고, 있으면 새로 만들지 말고 알려준다.
