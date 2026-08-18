import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * commerce-core-schema.sql의 DDL을 그대로 옮긴 초기 마이그레이션.
 * 이미 스키마가 존재하는 환경(프로덕션 Supabase)에서도 안전하게 실행되도록
 * 전부 멱등적으로(IF NOT EXISTS 등) 작성했다 — 실제로는 아무것도 바꾸지 않고
 * 마이그레이션 이력에만 편입된다.
 */
export class InitialSchema1787038003093 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE order_status AS ENUM ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS products (
        id BIGSERIAL PRIMARY KEY,
        category_id BIGINT NOT NULL REFERENCES categories(id),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        base_price INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS product_options (
        id BIGSERIAL PRIMARY KEY,
        product_id BIGINT NOT NULL REFERENCES products(id),
        size VARCHAR(20) NOT NULL,
        color VARCHAR(30) NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        sku VARCHAR(50) NOT NULL UNIQUE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id BIGSERIAL PRIMARY KEY,
        order_number VARCHAR(30) NOT NULL UNIQUE,
        status order_status NOT NULL DEFAULT 'PENDING',
        buyer_email VARCHAR(255) NOT NULL,
        buyer_name VARCHAR(100) NOT NULL,
        buyer_phone VARCHAR(30) NOT NULL,
        buyer_address VARCHAR(500) NOT NULL,
        total_amount INTEGER NOT NULL,
        payment_key VARCHAR(200),
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_key VARCHAR(200);`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_orders_buyer_email ON orders(buyer_email);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT NOT NULL REFERENCES orders(id),
        product_option_id BIGINT NOT NULL REFERENCES product_options(id),
        quantity INTEGER NOT NULL,
        price_at_order INTEGER NOT NULL
      );
    `);
  }

  /** 주의: 스키마 전체를 삭제한다 — 프로덕션에서는 절대 revert하지 말 것. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS order_items;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_order_number;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_buyer_email;`);
    await queryRunner.query(`DROP TABLE IF EXISTS orders;`);
    await queryRunner.query(`DROP TABLE IF EXISTS product_options;`);
    await queryRunner.query(`DROP TABLE IF EXISTS products;`);
    await queryRunner.query(`DROP TABLE IF EXISTS categories;`);
    await queryRunner.query(`DROP TYPE IF EXISTS order_status;`);
  }
}
