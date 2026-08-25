import { AppDataSource } from '../src/data-source';
import { Product } from '../src/products/entities/product.entity';

// 프론트엔드(frontend/src/lib/imageEmbedding.ts)와 반드시 같은 모델·같은 추출(CLS 토큰)을
// 써야 쿼리·카탈로그 임베딩이 같은 벡터 공간에 있어 코사인 유사도가 의미를 가진다.
// CLIP → DINOv2 전환(결정 32 개정).
const DINOV2_MODEL = 'Xenova/dinov2-small';

/**
 * 결정 32: 카탈로그 이미지 임베딩은 프로덕션 요청 경로가 아니라
 * 이 오프라인 스크립트로 미리 계산해 DB에 저장한다.
 * (모델을 바꾸면 기존 임베딩과 벡터 공간이 달라지므로 전 상품을 재계산해야 한다.)
 */
async function main() {
  const { pipeline } = await import('@huggingface/transformers');

  await AppDataSource.initialize();
  const productRepository = AppDataSource.getRepository(Product);

  const products = await productRepository.find();
  const targets = products.filter((p) => p.imageUrl);

  if (targets.length === 0) {
    console.log('image_url이 설정된 상품이 없습니다.');
    await AppDataSource.destroy();
    return;
  }

  console.log(`${DINOV2_MODEL} 로딩 중...`);
  const extractor = await pipeline('image-feature-extraction', DINOV2_MODEL, {
    dtype: 'q8',
  });

  let done = 0;
  let failed = 0;
  for (const product of targets) {
    console.log(`[${product.id}] ${product.name} 임베딩 계산 중...`);
    try {
      const feat = (await extractor(product.imageUrl!)) as unknown as {
        dims: number[];
        tolist: () => number[][] | number[][][];
      };
      const data = feat.tolist();
      // DINOv2 출력([1, seq, hidden])에서 CLS 토큰(index 0)을 제외한 패치 토큰들을
      // 평균(mean-pooling)해 전역 descriptor로 사용. 프론트(imageEmbedding.ts)의
      // extractMeanVector와 반드시 동일해야 쿼리·카탈로그가 같은 벡터 공간에 놓인다.
      let embedding: number[];
      if (feat.dims.length !== 3) {
        embedding = (data as number[][])[0];
      } else {
        const tokens = (data as number[][][])[0];
        const patches = tokens.slice(1);
        const hidden = patches[0].length;
        embedding = new Array<number>(hidden).fill(0);
        for (const p of patches) {
          for (let i = 0; i < hidden; i++) embedding[i] += p[i];
        }
        for (let i = 0; i < hidden; i++) embedding[i] /= patches.length;
      }

      product.imageEmbedding = embedding;
      await productRepository.save(product);
      done += 1;
      console.log(
        `[${product.id}] ${product.name} 완료 (dim=${embedding.length})`,
      );
    } catch (err) {
      // 이미지 URL이 깨진 상품(예: 지난 테스트 데이터) 하나 때문에 전체가 멈추지 않도록
      // 건너뛰고 계속한다.
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[${product.id}] ${product.name} 건너뜀 — ${message}`);
    }
  }

  await AppDataSource.destroy();
  console.log(`임베딩 계산 완료: 성공 ${done}건, 건너뜀 ${failed}건.`);
}

main().catch((err: unknown) => {
  console.error('임베딩 계산 실패:', err);
  process.exit(1);
});
