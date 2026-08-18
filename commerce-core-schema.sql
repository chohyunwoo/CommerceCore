-- ============================================================
-- CommerceCore Schema + Seed Data
-- Supabase SQL Editor에서 전체 선택 후 실행하세요
-- ============================================================

-- 1. ENUM 타입
CREATE TYPE order_status AS ENUM ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- 2. 카테고리
CREATE TABLE categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

-- 3. 상품
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES categories(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    base_price INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- 4. 상품 옵션 (재고 관리, 비관적 락 대상)
CREATE TABLE product_options (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    size VARCHAR(20) NOT NULL,
    color VARCHAR(30) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    sku VARCHAR(50) NOT NULL UNIQUE
);

-- 5. 주문
CREATE TABLE orders (
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

CREATE INDEX idx_orders_buyer_email ON orders(buyer_email);
CREATE INDEX idx_orders_order_number ON orders(order_number);

-- 6. 주문 항목
CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    product_option_id BIGINT NOT NULL REFERENCES product_options(id),
    quantity INTEGER NOT NULL,
    price_at_order INTEGER NOT NULL
);

-- ============================================================
-- Seed Data
-- ============================================================

-- 카테고리
INSERT INTO categories (name) VALUES
    ('신발'),
    ('상의'),
    ('하의');

-- 상품 (category_id: 1=신발, 2=상의, 3=하의)
INSERT INTO products (category_id, name, description, base_price) VALUES
    (1, '에어맥스 90', '클래식한 디자인의 러닝화. 쿠셔닝이 뛰어나 일상 착용에 적합합니다.', 150000),
    (2, '베이직 반팔티', '부드러운 면 소재의 기본 반팔 티셔츠. 다양한 코디에 활용 가능합니다.', 35000),
    (2, '클래식 후드티', '두꺼운 기모 소재로 가을·겨울에 적합한 후드 티셔츠입니다.', 69000),
    (3, '슬림 치노 팬츠', '깔끔한 핏의 치노 팬츠. 캐주얼과 세미 포멀 모두 소화 가능합니다.', 59000),
    (3, '조거 팬츠', '편안한 착용감의 조거 팬츠. 활동성이 뛰어납니다.', 49000);

-- 상품 옵션
-- 에어맥스 90 (product_id=1)
INSERT INTO product_options (product_id, size, color, stock, sku) VALUES
    (1, '260', '블랙', 10,  'AM90-260-BLK'),
    (1, '270', '화이트', 1,  'AM90-270-WHT');   -- ★ 재고 1개: 동시성 락 테스트용

-- 베이직 반팔티 (product_id=2)
INSERT INTO product_options (product_id, size, color, stock, sku) VALUES
    (2, 'S', '화이트', 50, 'BST-S-WHT'),
    (2, 'M', '블랙',   0,  'BST-M-BLK');        -- ★ 재고 0개: 품절 응답 테스트용

-- 클래식 후드티 (product_id=3)
INSERT INTO product_options (product_id, size, color, stock, sku) VALUES
    (3, 'M', '그레이', 30, 'CHD-M-GRY'),
    (3, 'L', '네이비', 30, 'CHD-L-NVY');

-- 슬림 치노 팬츠 (product_id=4)
INSERT INTO product_options (product_id, size, color, stock, sku) VALUES
    (4, '30', '베이지', 20, 'SCP-30-BEI'),
    (4, '32', '블랙',   20, 'SCP-32-BLK');

-- 조거 팬츠 (product_id=5)
INSERT INTO product_options (product_id, size, color, stock, sku) VALUES
    (5, 'M', '블랙', 15, 'JGP-M-BLK'),
    (5, 'L', '그레이', 15, 'JGP-L-GRY');
