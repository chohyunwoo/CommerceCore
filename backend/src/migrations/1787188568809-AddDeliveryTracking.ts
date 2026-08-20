import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 배송 추적(송장번호/택배사 + 배송 단계 타임라인) 기능 추가 (이슈 #59).
 * 기존 컨벤션(StructureOrderAddress 등)과 동일하게 멱등적으로 작성 — 이미 컬럼/테이블이
 * 있는 환경(로컬/프로덕션)에서는 아무것도 바꾸지 않고 마이그레이션 이력에만 편입된다.
 */
export class AddDeliveryTracking1787188568809 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE carrier AS ENUM ('CJ대한통운', '한진택배', '로젠택배', '우체국택배', '기타');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE delivery_stage AS ENUM ('COLLECTED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(50);`,
    );
    await queryRunner.query(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier carrier;`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS delivery_events (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT NOT NULL REFERENCES orders(id),
        stage delivery_stage NOT NULL,
        location VARCHAR(100),
        occurred_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_delivery_events_order_id ON delivery_events(order_id);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_delivery_events_order_id;`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS delivery_events;`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS carrier;`);
    await queryRunner.query(
      `ALTER TABLE orders DROP COLUMN IF EXISTS tracking_number;`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS delivery_stage;`);
    await queryRunner.query(`DROP TYPE IF EXISTS carrier;`);
  }
}
