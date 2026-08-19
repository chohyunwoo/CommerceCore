import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 배송지를 우편번호/기본주소/상세주소로 구조화 (이슈 #52).
 * 기존 `buyer_address`(자유 텍스트)는 과거 주문 표시/하위호환을 위해 그대로 둔다 —
 * 신규 컬럼은 nullable로 추가하고, 신규 주문부터는 3개 필드와 buyer_address(합친 문자열)를
 * 함께 저장한다(애플리케이션 레벨에서 처리, orders.service.ts 참고).
 */
export class StructureOrderAddress1787121849614 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);`,
    );
    await queryRunner.query(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS base_address VARCHAR(255);`,
    );
    await queryRunner.query(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS detail_address VARCHAR(255);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE orders DROP COLUMN IF EXISTS detail_address;`,
    );
    await queryRunner.query(
      `ALTER TABLE orders DROP COLUMN IF EXISTS base_address;`,
    );
    await queryRunner.query(
      `ALTER TABLE orders DROP COLUMN IF EXISTS postal_code;`,
    );
  }
}
