import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 로그인 사용자 장바구니 영구 보관용 테이블 추가(이슈 #65).
 * 게스트 장바구니(Redis, TTL 14일)와 달리 로그인 사용자는 신원에 묶인 지속 데이터라
 * DB에 영구 보관한다 — 로그인 시 게스트 카트를 이 테이블로 병합한다(결정 3의 트리거 해소).
 */
export class CreateCartItems1787201380910 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id),
        product_option_id BIGINT NOT NULL REFERENCES product_options(id),
        quantity INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE (user_id, product_option_id)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cart_items_user_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS cart_items;`);
  }
}
