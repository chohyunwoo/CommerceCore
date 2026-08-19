import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 이전 마이그레이션(1787102971288-AddProductImageColumns)의 이미지 시드가
 * 로컬 개발 DB의 상품명(오버핏 후드티/스트레이트 데님 팬츠/와이드 슬랙스) 기준이었는데,
 * 프로덕션(Supabase) 테스트 데이터는 같은 자리의 상품명이 달라(클래식 후드티/슬림 치노 팬츠/조거 팬츠)
 * 5개 중 2개만 채워졌던 것을 확인(2026-08-19)해 추가한다.
 * 기존과 동일하게 image_url이 비어있을 때만 채우는 멱등 UPDATE.
 */
export class SeedMoreProductImages1787106033962 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const seedImages: Array<[string, string]> = [
      [
        '클래식 후드티',
        'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80',
      ],
      [
        '슬림 치노 팬츠',
        'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&q=80',
      ],
      [
        '조거 팬츠',
        'https://images.unsplash.com/photo-1656991483595-8a11da8d2bde?w=800&q=80',
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
      `UPDATE products SET image_url = NULL WHERE name IN ('클래식 후드티', '슬림 치노 팬츠', '조거 팬츠');`,
    );
  }
}
