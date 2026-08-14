import { randomBytes } from 'crypto';

const SUFFIX_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SUFFIX_LENGTH = 6;

function randomSuffix(): string {
  const bytes = randomBytes(SUFFIX_LENGTH);
  let suffix = '';
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    suffix += SUFFIX_CHARS[bytes[i] % SUFFIX_CHARS.length];
  }
  return suffix;
}

export function generateOrderNumber(now: Date): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `ORD-${yyyy}${mm}${dd}-${randomSuffix()}`;
}
