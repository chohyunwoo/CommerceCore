import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 회원가입/로그인 도입(이슈 #63). B2B 확장용 company_id는 아직 추가하지 않음
 * (결정 4와 같은 기준 — 필요해지는 시점에 nullable FK로 추가).
 */
export class CreateUsers1787194886423 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS users;`);
  }
}
