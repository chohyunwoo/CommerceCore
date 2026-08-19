import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 이미지 기반 상품 시각적 유사도 검색(CLAUDE.md 결정 32) 준비.
 * image_embedding은 오프라인 스크립트(scripts/compute-product-embeddings.ts)가 채우므로
 * 여기서는 컬럼만 추가한다. image_url은 로컬/데모용 테스트 데이터 5개에 한해
 * 이름으로 매칭해 채워 넣는다(이미 값이 있으면 덮어쓰지 않음 — 결정 22의 데이터 백필 패턴과 동일).
 */
export class AddProductImageColumns1787102971288 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);`,
    );
    await queryRunner.query(
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS image_embedding JSONB;`,
    );

    const seedImages: Array<[string, string]> = [
      [
        '에어맥스 90',
        'https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=800&q=80',
      ],
      [
        '베이직 반팔티',
        'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&q=80',
      ],
      [
        '오버핏 후드티',
        'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80',
      ],
      [
        '스트레이트 데님 팬츠',
        'https://images.unsplash.com/photo-1602293589930-45aad59ba3ab?w=800&q=80',
      ],
      [
        '와이드 슬랙스',
        'https://images.unsplash.com/photo-1632282005753-29f80ed13c93?w=800&q=80',
      ],
    ];

    for (const [name, url] of seedImages) {
      await queryRunner.query(
        `UPDATE products SET image_url = $1 WHERE name = $2 AND image_url IS NULL;`,
        [url, name],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE products DROP COLUMN IF EXISTS image_embedding;`,
    );
    await queryRunner.query(
      `ALTER TABLE products DROP COLUMN IF EXISTS image_url;`,
    );
  }
}
