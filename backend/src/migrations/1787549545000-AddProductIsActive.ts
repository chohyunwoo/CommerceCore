import { MigrationInterface, QueryRunner } from 'typeorm';

// 상품 소프트 삭제용 is_active 컬럼(이슈 #88). 하드 삭제는 order_items FK로 주문 이력을
// 깨뜨리므로, 삭제는 is_active=false로 처리하고 고객/재고 화면에서 숨긴다.
// 결정 29 방식대로 멱등적(IF NOT EXISTS)으로 작성 — 이미 컬럼이 있는 환경에선 아무것도 안 함.
export class AddProductIsActive1787549545000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE products DROP COLUMN IF EXISTS is_active`,
    );
  }
}
