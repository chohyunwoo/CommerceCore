import { AppDataSource } from '../src/data-source';
import { Product } from '../src/products/entities/product.entity';

const CLIP_MODEL = 'Xenova/clip-vit-base-patch16';

/**
 * 결정 32: 카탈로그 이미지 임베딩은 프로덕션 요청 경로가 아니라
 * 이 오프라인 스크립트로 미리 계산해 DB에 저장한다.
 * 프론트엔드(브라우저)도 동일 모델(CLIP_MODEL)을 사용해야
 * 두 임베딩이 같은 벡터 공간에 있어 코사인 유사도가 의미를 가진다.
 */
async function main() {
  const { AutoProcessor, CLIPVisionModelWithProjection, RawImage } =
    await import('@huggingface/transformers');

  await AppDataSource.initialize();
  const productRepository = AppDataSource.getRepository(Product);

  const products = await productRepository.find();
  const targets = products.filter((p) => p.imageUrl);

  if (targets.length === 0) {
    console.log('image_url이 설정된 상품이 없습니다.');
    await AppDataSource.destroy();
    return;
  }

  console.log(`${CLIP_MODEL} 로딩 중...`);
  const processor = await AutoProcessor.from_pretrained(CLIP_MODEL);
  const visionModel =
    await CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL);

  for (const product of targets) {
    console.log(`[${product.id}] ${product.name} 임베딩 계산 중...`);
    const image = await RawImage.read(product.imageUrl!);
    const inputs = await processor(image);
    const { image_embeds } = await visionModel(inputs);
    const embedding = Array.from(image_embeds.tolist()[0] as number[]);

    product.imageEmbedding = embedding;
    await productRepository.save(product);
    console.log(`[${product.id}] ${product.name} 완료 (dim=${embedding.length})`);
  }

  await AppDataSource.destroy();
  console.log('모든 상품 임베딩 계산 완료.');
}

main().catch((err: unknown) => {
  console.error('임베딩 계산 실패:', err);
  process.exit(1);
});
