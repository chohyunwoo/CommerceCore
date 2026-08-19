// 백엔드 오프라인 임베딩 스크립트(backend/scripts/compute-product-embeddings.ts)와
// 반드시 같은 모델을 써야 두 임베딩이 같은 벡터 공간에 있어 코사인 유사도가 의미를 가진다.
const CLIP_MODEL = 'Xenova/clip-vit-base-patch16';

// 동적 import로 분리 — 이미지 검색을 쓰지 않는 사용자는 이 무거운 라이브러리를
// 아예 내려받지 않도록(코드 스플리팅) 한다.
let modelPromise: ReturnType<typeof loadModelInternal> | null = null;

async function loadModelInternal() {
  const { AutoProcessor, CLIPVisionModelWithProjection } = await import(
    '@huggingface/transformers'
  );
  const [processor, visionModel] = await Promise.all([
    AutoProcessor.from_pretrained(CLIP_MODEL),
    CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL, {
      dtype: 'q8',
    }),
  ]);
  return { processor, visionModel };
}

function loadModel() {
  if (!modelPromise) {
    modelPromise = loadModelInternal();
  }
  return modelPromise;
}

/** 유휴 시간에 모델을 미리 받아 브라우저 캐시에 태워둔다 (첫 검색 시 지연 완화). */
export function prefetchImageEmbeddingModel(): void {
  const schedule =
    typeof requestIdleCallback === 'function'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 0);

  schedule(() => {
    loadModel().catch(() => {
      // 프리페치 실패는 조용히 무시 — 실제 검색 시점에 다시 시도된다.
    });
  });
}

export async function getImageEmbedding(file: File): Promise<number[]> {
  const [{ processor, visionModel }, { RawImage }] = await Promise.all([
    loadModel(),
    import('@huggingface/transformers'),
  ]);
  const image = await RawImage.fromBlob(file);
  const inputs = await processor(image);
  const { image_embeds } = (await visionModel(inputs)) as {
    image_embeds: { tolist(): number[][] };
  };
  return image_embeds.tolist()[0];
}
