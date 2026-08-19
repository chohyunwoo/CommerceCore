import { MigrationInterface, QueryRunner } from 'typeorm';

interface SeedOption {
  size: string;
  color: string;
  stock: number;
  sku: string;
}

interface SeedProduct {
  name: string;
  categoryName: string;
  basePrice: number;
  imageUrl: string;
  options: SeedOption[];
}

/**
 * 상품 카탈로그를 5개 -> 20개로 확장 (신발 6개, 상의 5개, 하의 4개 추가).
 * 결정 32(이미지 시각적 유사도 검색) 데모 규모를 늘리기 위해, 각 상품마다
 * 실제 무료 스톡 사진(Unsplash)을 색상까지 맞춰 개별적으로 선정했다.
 * 임베딩(image_embedding)은 이 마이그레이션에서 계산하지 않음 —
 * 기존과 동일하게 `npm run embeddings:compute`(오프라인 스크립트)로 별도 실행해야 한다.
 * 이름 중복 시 건너뛰는 멱등 처리(WHERE NOT EXISTS)로 재실행 안전.
 */
const SEED_PRODUCTS: SeedProduct[] = [
  // ── 신발 (6) ──
  {
    name: '화이트 캔버스 스니커즈',
    categoryName: '신발',
    basePrice: 89000,
    imageUrl:
      'https://images.unsplash.com/photo-1627361673902-c80df14aecdd?w=800&q=80',
    options: [
      { size: '250', color: '화이트', stock: 20, sku: 'SHOE-01-250-WHT' },
      { size: '260', color: '화이트', stock: 15, sku: 'SHOE-01-260-WHT' },
    ],
  },
  {
    name: '블랙 첼시 부츠',
    categoryName: '신발',
    basePrice: 129000,
    imageUrl:
      'https://images.unsplash.com/photo-1534233812932-59b8fa1b780c?w=800&q=80',
    options: [
      { size: '260', color: '블랙', stock: 12, sku: 'SHOE-02-260-BLK' },
      { size: '270', color: '블랙', stock: 10, sku: 'SHOE-02-270-BLK' },
    ],
  },
  {
    name: '스웨이드 로퍼',
    categoryName: '신발',
    basePrice: 99000,
    imageUrl:
      'https://images.unsplash.com/photo-1676121270762-47c8d3a7b9d5?w=800&q=80',
    options: [
      { size: '270', color: '브라운', stock: 14, sku: 'SHOE-03-270-BRN' },
      { size: '250', color: '카멜', stock: 9, sku: 'SHOE-03-250-CML' },
    ],
  },
  {
    name: '러닝 트레이너',
    categoryName: '신발',
    basePrice: 119000,
    imageUrl:
      'https://images.unsplash.com/photo-1637437757614-6491c8e915b5?w=800&q=80',
    options: [
      { size: '260', color: '그레이', stock: 18, sku: 'SHOE-04-260-GRY' },
      { size: '280', color: '블랙', stock: 16, sku: 'SHOE-04-280-BLK' },
    ],
  },
  {
    name: '하이탑 스니커즈',
    categoryName: '신발',
    basePrice: 109000,
    imageUrl:
      'https://images.unsplash.com/photo-1562105962-2fbaaf107fe3?w=800&q=80',
    options: [
      { size: '250', color: '화이트', stock: 11, sku: 'SHOE-05-250-WHT' },
      { size: '270', color: '블랙', stock: 13, sku: 'SHOE-05-270-BLK' },
    ],
  },
  {
    name: '레더 더비슈즈',
    categoryName: '신발',
    basePrice: 149000,
    imageUrl:
      'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=800&q=80',
    options: [
      { size: '260', color: '브라운', stock: 8, sku: 'SHOE-06-260-BRN' },
      { size: '270', color: '블랙', stock: 7, sku: 'SHOE-06-270-BLK' },
    ],
  },
  // ── 상의 (5) ──
  {
    name: '옥스포드 셔츠',
    categoryName: '상의',
    basePrice: 49000,
    imageUrl:
      'https://images.unsplash.com/photo-1770058428099-f2d64ab34006?w=800&q=80',
    options: [
      { size: 'M', color: '화이트', stock: 20, sku: 'TOP-01-M-WHT' },
      { size: 'L', color: '블루', stock: 16, sku: 'TOP-01-L-BLU' },
    ],
  },
  {
    name: '크루넥 니트',
    categoryName: '상의',
    basePrice: 45000,
    imageUrl:
      'https://images.unsplash.com/photo-1604573824419-289a9a10672c?w=800&q=80',
    options: [
      { size: 'M', color: '아이보리', stock: 18, sku: 'TOP-02-M-IVR' },
      { size: 'L', color: '카키', stock: 14, sku: 'TOP-02-L-KHK' },
    ],
  },
  {
    name: '집업 후드',
    categoryName: '상의',
    basePrice: 69000,
    imageUrl:
      'https://images.unsplash.com/photo-1609885654455-f81e5a682c87?w=800&q=80',
    options: [
      { size: 'L', color: '블랙', stock: 15, sku: 'TOP-03-L-BLK' },
      { size: 'XL', color: '블랙', stock: 12, sku: 'TOP-03-XL-BLK' },
    ],
  },
  {
    name: '스트라이프 티셔츠',
    categoryName: '상의',
    basePrice: 35000,
    imageUrl:
      'https://images.unsplash.com/photo-1624124959348-86710fef6630?w=800&q=80',
    options: [
      { size: 'M', color: '네이비', stock: 22, sku: 'TOP-04-M-NVY' },
      { size: 'L', color: '화이트', stock: 19, sku: 'TOP-04-L-WHT' },
    ],
  },
  {
    name: '데님 셔츠',
    categoryName: '상의',
    basePrice: 55000,
    imageUrl:
      'https://images.unsplash.com/photo-1613752978317-afcfd1bba65a?w=800&q=80',
    options: [
      { size: 'M', color: '블루', stock: 13, sku: 'TOP-05-M-BLU' },
      { size: 'L', color: '블루', stock: 10, sku: 'TOP-05-L-BLU' },
    ],
  },
  // ── 하의 (4) ──
  {
    name: '와이드 데님 팬츠',
    categoryName: '하의',
    basePrice: 79000,
    imageUrl:
      'https://images.unsplash.com/photo-1616003471864-9abfeee24576?w=800&q=80',
    options: [
      { size: 'M', color: '블루', stock: 17, sku: 'BTM-01-M-BLU' },
      { size: 'L', color: '블랙', stock: 14, sku: 'BTM-01-L-BLK' },
    ],
  },
  {
    name: '코듀로이 팬츠',
    categoryName: '하의',
    basePrice: 69000,
    imageUrl:
      'https://images.unsplash.com/photo-1602987000658-55401b634b1f?w=800&q=80',
    options: [
      { size: 'M', color: '카키', stock: 12, sku: 'BTM-02-M-KHK' },
      { size: 'L', color: '베이지', stock: 10, sku: 'BTM-02-L-BEG' },
    ],
  },
  {
    name: '트레이닝 조거',
    categoryName: '하의',
    basePrice: 49000,
    imageUrl:
      'https://images.unsplash.com/photo-1715532098035-a343b26eaeaa?w=800&q=80',
    options: [
      { size: 'L', color: '블랙', stock: 21, sku: 'BTM-03-L-BLK' },
      { size: 'M', color: '블랙', stock: 18, sku: 'BTM-03-M-BLK' },
    ],
  },
  {
    name: '플리츠 스커트',
    categoryName: '하의',
    basePrice: 45000,
    imageUrl:
      'https://images.unsplash.com/photo-1778590328057-5cb7f6af0d2d?w=800&q=80',
    options: [
      { size: 'S', color: '블랙', stock: 16, sku: 'BTM-04-S-BLK' },
      { size: 'M', color: '블랙', stock: 13, sku: 'BTM-04-M-BLK' },
    ],
  },
];

export class ExpandCatalogTo20Products1787107210400 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const product of SEED_PRODUCTS) {
      const inserted = (await queryRunner.query(
        `INSERT INTO products (category_id, name, base_price, image_url)
         SELECT (SELECT id FROM categories WHERE name = $1), $2, $3, $4
         WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = $2)
         RETURNING id;`,
        [
          product.categoryName,
          product.name,
          product.basePrice,
          product.imageUrl,
        ],
      )) as Array<{ id: number }>;

      if (inserted.length === 0) continue; // 이미 존재 — 건너뜀 (멱등)

      const productId = inserted[0].id;
      for (const option of product.options) {
        await queryRunner.query(
          `INSERT INTO product_options (product_id, size, color, stock, sku)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (sku) DO NOTHING;`,
          [productId, option.size, option.color, option.stock, option.sku],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const product of SEED_PRODUCTS) {
      await queryRunner.query(
        `DELETE FROM product_options WHERE product_id = (SELECT id FROM products WHERE name = $1);`,
        [product.name],
      );
      await queryRunner.query(`DELETE FROM products WHERE name = $1;`, [
        product.name,
      ]);
    }
  }
}
