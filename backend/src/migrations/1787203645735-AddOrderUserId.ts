import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 로그인 사용자와 주문을 연결하기 위한 컬럼 추가(이슈 #67). 게스트 체크아웃(결정 6)은
 * 그대로 유지되므로 nullable — 기존 주문/게스트 주문은 계속 user_id 없이 남는다.
 */
export class AddOrderUserId1787203645735 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_user_id;`);
    await queryRunner.query(
      `ALTER TABLE orders DROP COLUMN IF EXISTS user_id;`,
    );
  }
}
