---
description: 변경 내용을 분석해 컨벤션에 맞는 커밋 메시지를 작성하고 커밋한다
---

변경된 파일을 분석해서 커밋 메시지를 작성하고 커밋하세요.

## 순서

1. `git status`, `git diff` (staged + unstaged), `git log --oneline -10`을 병렬로 실행해 현재 상태와 최근 커밋 스타일을 파악한다.
2. 아직 스테이징 안 된 변경이 있으면 어떤 파일을 커밋에 포함할지 사용자에게 보여주고 확인받는다. `git add -A`처럼 전체를 무조건 add하지 않는다 — 관련 있는 파일만 지목해서 add한다.
3. 커밋 메시지는 이 레포의 `commitlint.config.js` 규칙을 따른다:
   - 형식: `{type}: {한 줄 제목}`
   - `type`은 `feat`, `fix`, `refactor`, `docs`, `test`, `chore` 중 하나
   - 전체 헤더 72자 이내
   - 제목은 한국어로, 무엇을 했는지가 아니라 **왜 했는지**가 드러나게 작성 (코드만 봐도 알 수 있는 내용은 반복하지 않음)
4. 커밋 메시지는 반드시 heredoc으로 전달한다:
   ```bash
   git commit -m "$(cat <<'EOF'
   type: 제목
   EOF
   )"
   ```
5. `.husky/pre-commit`(위생 검사), `.husky/commit-msg`(commitlint) 훅이 자동으로 실행된다 — `--no-verify`로 건너뛰지 않는다. 훅이 실패하면 원인을 고치고 다시 시도한다.
6. 커밋 후 `git status`로 정상 커밋됐는지 확인하고, 무엇을 커밋했는지 한두 문장으로 요약한다.

## 하지 않는 것

- 사용자가 명시적으로 요청하지 않은 한 `git push`는 하지 않는다.
- 이미 만들어진 커밋을 `--amend`하지 않는다 (사용자가 명시적으로 요청한 경우 제외).
- 커밋 메시지에 커밋 내용과 무관한 광고성 문구(예: "Generated with Claude Code")는 이 프로젝트 컨벤션에 없으므로 넣지 않는다.
