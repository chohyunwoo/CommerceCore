import { MigrationInterface, QueryRunner } from 'typeorm';

// SKU 소프트 삭제 유니크 대안 B(이슈 #92). 상품을 소프트 삭제하면(products.is_active=false)
// 그 옵션의 SKU가 전역 UNIQUE(sku)에 계속 남아 재사용할 수 없었다. 활성 옵션에만 유니크를
// 적용하는 부분 유니크 인덱스로 바꿔, 소프트 삭제된 SKU는 재사용을 허용한다.
// 부분 인덱스는 product_options 컬럼만 참조할 수 있어 옵션에도 is_active를 둔다.
// 결정 29 방식대로 멱등적으로 작성.
export class AddProductOptionIsActiveAndPartialUniqueSku1787553393000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE product_options ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true`,
    );
    // 이미 소프트 삭제된 상품의 옵션을 비활성으로 동기화(현재는 없지만 안전하게).
    await queryRunner.query(
      `UPDATE product_options po SET is_active = false
       FROM products p WHERE po.product_id = p.id AND p.is_active = false`,
    );
    // 전역 UNIQUE(sku) 제거 후 활성 옵션에만 적용되는 부분 유니크 인덱스로 대체.
    await queryRunner.query(
      `ALTER TABLE product_options DROP CONSTRAINT IF EXISTS product_options_sku_key`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_product_options_active_sku
       ON product_options (sku) WHERE is_active`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS uq_product_options_active_sku`,
    );
    await queryRunner.query(
      `ALTER TABLE product_options ADD CONSTRAINT product_options_sku_key UNIQUE (sku)`,
    );
    await queryRunner.query(
      `ALTER TABLE product_options DROP COLUMN IF EXISTS is_active`,
    );
  }
}
