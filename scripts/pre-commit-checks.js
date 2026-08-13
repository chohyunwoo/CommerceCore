#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');

const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
const CONFLICT_MARKERS = ['<<<<<<<', '=======', '>>>>>>>'];
const TEXT_EXTENSIONS = /\.(ts|tsx|js|jsx|json|md|yml|yaml|css|scss|html|sql|sh|env)$/i;

function getStagedFiles() {
  const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
    encoding: 'utf8',
  });
  return output.split('\n').filter(Boolean);
}

function main() {
  const files = getStagedFiles();
  const errors = [];

  for (const file of files) {
    if (!fs.existsSync(file)) continue;

    const stat = fs.statSync(file);
    if (stat.size > MAX_FILE_SIZE_BYTES) {
      errors.push(`[대용량 파일] ${file} (${(stat.size / 1024 / 1024).toFixed(2)}MB > 1MB)`);
      continue; // 큰 바이너리는 텍스트로 읽지 않음
    }

    if (!TEXT_EXTENSIONS.test(file)) continue;

    const content = fs.readFileSync(file, 'utf8');
    if (content.length === 0) continue;

    const lines = content.split('\n');

    for (const marker of CONFLICT_MARKERS) {
      if (lines.some((line) => line.startsWith(marker))) {
        errors.push(`[병합 충돌 마커] ${file}: "${marker}" 발견`);
        break;
      }
    }

    const trailingWhitespaceLines = [];
    lines.forEach((line, idx) => {
      if (/[ \t]+$/.test(line)) trailingWhitespaceLines.push(idx + 1);
    });
    if (trailingWhitespaceLines.length > 0) {
      errors.push(
        `[줄 끝 공백] ${file}: ${trailingWhitespaceLines.slice(0, 5).join(', ')}행${
          trailingWhitespaceLines.length > 5 ? ' 외' : ''
        }`
      );
    }

    if (content.length > 0 && !content.endsWith('\n')) {
      errors.push(`[파일 끝 개행 누락] ${file}`);
    }
  }

  if (errors.length > 0) {
    console.error('\n커밋 위생 검사 실패:\n');
    errors.forEach((e) => console.error(' - ' + e));
    console.error('\n위 항목을 수정한 뒤 다시 커밋하세요.\n');
    process.exit(1);
  }

  console.log('커밋 위생 검사 통과');
}

main();
