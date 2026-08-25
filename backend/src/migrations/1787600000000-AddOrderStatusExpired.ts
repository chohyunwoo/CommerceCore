import { MigrationInterface, QueryRunner } from 'typeorm';

// order_status enum에 EXPIRED 값 추가(결정 45). 방치된 PENDING 주문을 만료 회수하며
// 부여하는 상태로, 재고를 반납하고 사용자·관리자 조회 뷰에서는 숨긴다.
// 결정 29 방식대로 멱등적(IF NOT EXISTS)으로 작성 — 이미 값이 있으면 no-op.
// PostgreSQL 12+는 트랜잭션 안에서 ADD VALUE를 허용한다(같은 트랜잭션에서 그 값을
// 사용만 못 할 뿐). 이 마이그레이션은 값만 추가하고 사용하지 않으므로 안전하다.
export class AddOrderStatusExpired1787600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'EXPIRED'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL은 enum 값 제거를 지원하지 않는다 — 되돌리려면 타입을 재생성해야 하므로 no-op.
  }
}
