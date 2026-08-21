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
 * 상품 카탈로그를 20개 -> 50개로 확장 (신발/상의/하의 각 10개 추가) — 결정 32에서
 * 가정한 카탈로그 규모(최소 50개)에 맞춘다.
 * 이전 마이그레이션들과 동일하게, 각 상품마다 실제 무료 스톡 사진(Unsplash)을
 * 색상까지 맞춰 개별적으로 선정했다(각 URL은 HTTP 200 응답 확인 완료).
 * image_embedding은 여기서 계산하지 않음 — 기존과 동일하게
 * `npm run embeddings:compute`(오프라인 스크립트)로 별도 실행.
 * 이름 중복 시 건너뛰는 멱등 처리(WHERE NOT EXISTS)로 재실행 안전.
 */
const SEED_PRODUCTS: SeedProduct[] = [
  // ── 신발 (10) ──
  {
    name: '어그 부츠',
    categoryName: '신발',
    basePrice: 145000,
    imageUrl:
      'https://images.unsplash.com/photo-1586810679476-7e2e76421009?w=800&q=80',
    options: [
      { size: '250', color: '브라운', stock: 13, sku: 'SHOE-07-250-BRN' },
      { size: '260', color: '베이지', stock: 10, sku: 'SHOE-07-260-BEG' },
    ],
  },
  {
    name: '캔버스 로우탑',
    categoryName: '신발',
    basePrice: 79000,
    imageUrl:
      'https://images.unsplash.com/photo-1564735862904-d0cc7fc1bb36?w=800&q=80',
    options: [
      { size: '260', color: '블랙', stock: 20, sku: 'SHOE-08-260-BLK' },
      { size: '270', color: '화이트', stock: 17, sku: 'SHOE-08-270-WHT' },
    ],
  },
  {
    name: '트레킹 부츠',
    categoryName: '신발',
    basePrice: 139000,
    imageUrl:
      'https://images.unsplash.com/photo-1603735737928-1bc5b66c7522?w=800&q=80',
    options: [
      { size: '270', color: '카키', stock: 11, sku: 'SHOE-09-270-KHK' },
      { size: '280', color: '브라운', stock: 9, sku: 'SHOE-09-280-BRN' },
    ],
  },
  {
    name: '슬립온 스니커즈',
    categoryName: '신발',
    basePrice: 69000,
    imageUrl:
      'https://images.unsplash.com/photo-1562250186-e68367c47bba?w=800&q=80',
    options: [
      { size: '250', color: '네이비', stock: 16, sku: 'SHOE-10-250-NVY' },
      { size: '260', color: '그레이', stock: 14, sku: 'SHOE-10-260-GRY' },
    ],
  },
  {
    name: '정장 옥스포드 슈즈',
    categoryName: '신발',
    basePrice: 159000,
    imageUrl:
      'https://images.unsplash.com/photo-1668069226492-508742b03147?w=800&q=80',
    options: [
      { size: '260', color: '블랙', stock: 8, sku: 'SHOE-11-260-BLK' },
      { size: '270', color: '브라운', stock: 7, sku: 'SHOE-11-270-BRN' },
    ],
  },
  {
    name: '캔버스 하이탑 레드',
    categoryName: '신발',
    basePrice: 89000,
    imageUrl:
      'https://images.unsplash.com/photo-1617604250287-e36500f9e21b?w=800&q=80',
    options: [
      { size: '250', color: '레드', stock: 12, sku: 'SHOE-12-250-RED' },
      { size: '260', color: '블랙', stock: 15, sku: 'SHOE-12-260-BLK' },
    ],
  },
  {
    name: '스포츠 샌들',
    categoryName: '신발',
    basePrice: 49000,
    imageUrl:
      'https://images.unsplash.com/photo-1583473848882-f9a5bc7fd2ee?w=800&q=80',
    options: [
      { size: '260', color: '블랙', stock: 19, sku: 'SHOE-13-260-BLK' },
      { size: '270', color: '그레이', stock: 16, sku: 'SHOE-13-270-GRY' },
    ],
  },
  {
    name: '첼시 앵클부츠',
    categoryName: '신발',
    basePrice: 119000,
    imageUrl:
      'https://images.unsplash.com/photo-1777987601423-f350ac29b3e9?w=800&q=80',
    options: [
      { size: '230', color: '블랙', stock: 10, sku: 'SHOE-14-230-BLK' },
      { size: '240', color: '브라운', stock: 9, sku: 'SHOE-14-240-BRN' },
    ],
  },
  {
    name: '러닝화 라이트',
    categoryName: '신발',
    basePrice: 99000,
    imageUrl:
      'https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=800&q=80',
    options: [
      { size: '260', color: '화이트', stock: 18, sku: 'SHOE-15-260-WHT' },
      { size: '270', color: '블루', stock: 14, sku: 'SHOE-15-270-BLU' },
    ],
  },
  {
    name: '골프화 스파이크리스',
    categoryName: '신발',
    basePrice: 169000,
    imageUrl:
      'https://images.unsplash.com/photo-1767978362890-fa67c004b57a?w=800&q=80',
    options: [
      { size: '260', color: '화이트', stock: 6, sku: 'SHOE-16-260-WHT' },
      { size: '270', color: '네이비', stock: 5, sku: 'SHOE-16-270-NVY' },
    ],
  },
  // ── 상의 (10) ──
  {
    name: '린넨 셔츠',
    categoryName: '상의',
    basePrice: 59000,
    imageUrl:
      'https://images.unsplash.com/photo-1591357037205-166318b51afd?w=800&q=80',
    options: [
      { size: 'M', color: '화이트', stock: 18, sku: 'TOP-06-M-WHT' },
      { size: 'L', color: '베이지', stock: 15, sku: 'TOP-06-L-BEG' },
    ],
  },
  {
    name: '체크 셔츠',
    categoryName: '상의',
    basePrice: 52000,
    imageUrl:
      'https://images.unsplash.com/photo-1616588181775-138dc8ba4197?w=800&q=80',
    options: [
      { size: 'M', color: '레드', stock: 16, sku: 'TOP-07-M-RED' },
      { size: 'L', color: '블루', stock: 13, sku: 'TOP-07-L-BLU' },
    ],
  },
  {
    name: '브이넥 니트',
    categoryName: '상의',
    basePrice: 47000,
    imageUrl:
      'https://images.unsplash.com/photo-1553404633-859669c11246?w=800&q=80',
    options: [
      { size: 'M', color: '그레이', stock: 20, sku: 'TOP-08-M-GRY' },
      { size: 'L', color: '네이비', stock: 17, sku: 'TOP-08-L-NVY' },
    ],
  },
  {
    name: '플리스 자켓',
    categoryName: '상의',
    basePrice: 89000,
    imageUrl:
      'https://images.unsplash.com/photo-1449614115178-cb924f730780?w=800&q=80',
    options: [
      { size: 'L', color: '블랙', stock: 14, sku: 'TOP-09-L-BLK' },
      { size: 'XL', color: '카키', stock: 11, sku: 'TOP-09-XL-KHK' },
    ],
  },
  {
    name: '가디건',
    categoryName: '상의',
    basePrice: 55000,
    imageUrl:
      'https://images.unsplash.com/photo-1557445062-4a73f9edd11e?w=800&q=80',
    options: [
      { size: 'M', color: '아이보리', stock: 15, sku: 'TOP-10-M-IVR' },
      { size: 'L', color: '브라운', stock: 12, sku: 'TOP-10-L-BRN' },
    ],
  },
  {
    name: '카라 니트',
    categoryName: '상의',
    basePrice: 49000,
    imageUrl:
      'https://images.unsplash.com/photo-1759229874914-c1ffdb3ebd0c?w=800&q=80',
    options: [
      { size: 'S', color: '베이지', stock: 13, sku: 'TOP-11-S-BEG' },
      { size: 'M', color: '그린', stock: 11, sku: 'TOP-11-M-GRN' },
    ],
  },
  {
    name: '맨투맨',
    categoryName: '상의',
    basePrice: 39000,
    imageUrl:
      'https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?w=800&q=80',
    options: [
      { size: 'M', color: '그레이', stock: 23, sku: 'TOP-12-M-GRY' },
      { size: 'L', color: '블랙', stock: 20, sku: 'TOP-12-L-BLK' },
    ],
  },
  {
    name: '폴로 셔츠',
    categoryName: '상의',
    basePrice: 45000,
    imageUrl:
      'https://images.unsplash.com/photo-1571387670773-987a72a44e1a?w=800&q=80',
    options: [
      { size: 'M', color: '네이비', stock: 19, sku: 'TOP-13-M-NVY' },
      { size: 'L', color: '화이트', stock: 16, sku: 'TOP-13-L-WHT' },
    ],
  },
  {
    name: '슬리브리스 탑',
    categoryName: '상의',
    basePrice: 29000,
    imageUrl:
      'https://images.unsplash.com/photo-1599817878414-43ef36677cf0?w=800&q=80',
    options: [
      { size: 'S', color: '화이트', stock: 17, sku: 'TOP-14-S-WHT' },
      { size: 'M', color: '블랙', stock: 14, sku: 'TOP-14-M-BLK' },
    ],
  },
  {
    name: '야상 자켓',
    categoryName: '상의',
    basePrice: 99000,
    imageUrl:
      'https://images.unsplash.com/photo-1618342904964-d67eb25cc7ce?w=800&q=80',
    options: [
      { size: 'L', color: '카키', stock: 10, sku: 'TOP-15-L-KHK' },
      { size: 'XL', color: '블랙', stock: 8, sku: 'TOP-15-XL-BLK' },
    ],
  },
  // ── 하의 (10) ──
  {
    name: '슬랙스',
    categoryName: '하의',
    basePrice: 65000,
    imageUrl:
      'https://images.unsplash.com/photo-1593030089683-a9841767a610?w=800&q=80',
    options: [
      { size: 'M', color: '블랙', stock: 18, sku: 'BTM-05-M-BLK' },
      { size: 'L', color: '그레이', stock: 15, sku: 'BTM-05-L-GRY' },
    ],
  },
  {
    name: '카고 팬츠',
    categoryName: '하의',
    basePrice: 72000,
    imageUrl:
      'https://images.unsplash.com/photo-1758267928064-f159a683385d?w=800&q=80',
    options: [
      { size: 'M', color: '카키', stock: 16, sku: 'BTM-06-M-KHK' },
      { size: 'L', color: '블랙', stock: 13, sku: 'BTM-06-L-BLK' },
    ],
  },
  {
    name: '반바지',
    categoryName: '하의',
    basePrice: 39000,
    imageUrl:
      'https://images.unsplash.com/photo-1617951907145-53f6eb87a3a3?w=800&q=80',
    options: [
      { size: 'M', color: '네이비', stock: 21, sku: 'BTM-07-M-NVY' },
      { size: 'L', color: '베이지', stock: 18, sku: 'BTM-07-L-BEG' },
    ],
  },
  {
    name: '레깅스',
    categoryName: '하의',
    basePrice: 35000,
    imageUrl:
      'https://images.unsplash.com/photo-1585834830884-392089dfd9f6?w=800&q=80',
    options: [
      { size: 'S', color: '블랙', stock: 24, sku: 'BTM-08-S-BLK' },
      { size: 'M', color: '블랙', stock: 20, sku: 'BTM-08-M-BLK' },
    ],
  },
  {
    name: '미니 스커트',
    categoryName: '하의',
    basePrice: 42000,
    imageUrl:
      'https://images.unsplash.com/photo-1597724939852-d093e19a24b8?w=800&q=80',
    options: [
      { size: 'S', color: '블랙', stock: 15, sku: 'BTM-09-S-BLK' },
      { size: 'M', color: '데님', stock: 12, sku: 'BTM-09-M-DNM' },
    ],
  },
  {
    name: '롱 스커트',
    categoryName: '하의',
    basePrice: 55000,
    imageUrl:
      'https://images.unsplash.com/photo-1758186168047-00dd2621d27f?w=800&q=80',
    options: [
      { size: 'S', color: '베이지', stock: 11, sku: 'BTM-10-S-BEG' },
      { size: 'M', color: '블랙', stock: 9, sku: 'BTM-10-M-BLK' },
    ],
  },
  {
    name: '조거 스웨트팬츠',
    categoryName: '하의',
    basePrice: 45000,
    imageUrl:
      'https://images.unsplash.com/photo-1602573991155-21f0143bb45c?w=800&q=80',
    options: [
      { size: 'M', color: '그레이', stock: 22, sku: 'BTM-11-M-GRY' },
      { size: 'L', color: '블랙', stock: 19, sku: 'BTM-11-L-BLK' },
    ],
  },
  {
    name: '스키니진',
    categoryName: '하의',
    basePrice: 59000,
    imageUrl:
      'https://images.unsplash.com/photo-1567418514277-a28f5e9913c2?w=800&q=80',
    options: [
      { size: 'M', color: '블랙', stock: 17, sku: 'BTM-12-M-BLK' },
      { size: 'L', color: '블루', stock: 14, sku: 'BTM-12-L-BLU' },
    ],
  },
  {
    name: '벨보텀 팬츠',
    categoryName: '하의',
    basePrice: 79000,
    imageUrl:
      'https://images.unsplash.com/photo-1777223128713-00f0b056374d?w=800&q=80',
    options: [
      { size: 'M', color: '블랙', stock: 9, sku: 'BTM-13-M-BLK' },
      { size: 'L', color: '브라운', stock: 7, sku: 'BTM-13-L-BRN' },
    ],
  },
  {
    name: '트랙 팬츠',
    categoryName: '하의',
    basePrice: 49000,
    imageUrl:
      'https://images.unsplash.com/photo-1580906853305-5702e648164e?w=800&q=80',
    options: [
      { size: 'M', color: '블랙', stock: 20, sku: 'BTM-14-M-BLK' },
      { size: 'L', color: '화이트', stock: 16, sku: 'BTM-14-L-WHT' },
    ],
  },
];

export class ExpandCatalogTo50Products1787300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const product of SEED_PRODUCTS) {
      const existing = (await queryRunner.query(
        `SELECT 1 FROM products WHERE name = $1 LIMIT 1;`,
        [product.name],
      )) as unknown[];

      if (existing.length > 0) continue; // 이미 존재 — 건너뜀 (멱등)

      const inserted = (await queryRunner.query(
        `INSERT INTO products (category_id, name, base_price, image_url)
         VALUES ((SELECT id FROM categories WHERE name = $1), $2, $3, $4)
         RETURNING id;`,
        [
          product.categoryName,
          product.name,
          product.basePrice,
          product.imageUrl,
        ],
      )) as Array<{ id: number }>;

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
