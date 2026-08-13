// commit-writer 스킬 규칙을 commitlint 규칙으로 그대로 매핑한 설정.
// 커밋 메시지 형식: "{type}: {한 줄 제목}"  (예: fix: 재고 차감 시 동시성 문제 방지)

module.exports = {
  rules: {
    // 1) 타입은 이 6개 중 정확히 하나만 허용 (commit-writer 스킬 §제약조건 4)
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'docs', 'test', 'chore'],
    ],
    'type-case': [0], // 소문자 강제 안 함 (영문 타입 자체는 항상 소문자로 쓰므로 굳이 강제 X)
    'type-empty': [2, 'never'],

    // 2) 제목(한글)은 대소문자 규칙 대상이 아니므로 subject-case 검사는 끔
    'subject-case': [0],
    'subject-empty': [2, 'never'],

    // 3) 헤더 전체 길이 제한 — "type: " 접두사(6자) + 한글 제목 50자 기준으로 여유 있게 72자
    //    (커밋 메시지 자체 내용 검토는 commit-writer 스킬이 작성 시점에 이미 담당)
    'header-max-length': [2, 'always', 72],

    // 4) 본문 사용 시 제목과 한 줄 띄우기 (Conventional Commits 표준)
    'body-leading-blank': [2, 'always'],
  },
};
