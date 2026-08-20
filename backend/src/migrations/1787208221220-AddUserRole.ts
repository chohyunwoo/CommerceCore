import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 관리자 인증을 정적 공유 토큰(결정 16)에서 로그인 세션 + 역할(role) 기반으로
 * 전환하기 위한 컬럼 추가(이슈 #69, 결정 38). 기본값 'user' — 기존 계정은
 * 전부 일반 사용자로 남고, 관리자 계정은 배포 후 수동으로 승격한다.
 */
export class AddUserRole1787208221220 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('user', 'admin');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'user';`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS role;`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_role;`);
  }
}
