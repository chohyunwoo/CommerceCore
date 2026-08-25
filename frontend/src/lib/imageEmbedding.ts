// 백엔드 오프라인 임베딩 스크립트(backend/scripts/compute-product-embeddings.ts)와
// 반드시 같은 모델·같은 추출(CLS 토큰)을 써야 두 임베딩이 같은 벡터 공간에 있어
// 코사인 유사도가 의미를 가진다. CLIP → DINOv2 전환(결정 32 개정): 순수 시각 유사도에서
// 카테고리 분리가 더 좋고(스파이크상 분리도 약 4배) 다운로드도 가볍다(q8 24MB vs 84MB).
const DINOV2_MODEL = 'Xenova/dinov2-small';

type FeatureExtractor = (input: unknown) => Promise<{
  dims: number[];
  tolist: () => number[][] | number[][][];
}>;

// 동적 import로 분리 — 이미지 검색을 쓰지 않는 사용자는 이 무거운 라이브러리를
// 아예 내려받지 않도록(코드 스플리팅) 한다.
let extractorPromise: Promise<FeatureExtractor> | null = null;

async function loadExtractorInternal(): Promise<FeatureExtractor> {
  const { pipeline } = await import('@huggingface/transformers');
  return (await pipeline('image-feature-extraction', DINOV2_MODEL, {
    dtype: 'q8',
  })) as unknown as FeatureExtractor;
}

function loadExtractor() {
  if (!extractorPromise) {
    extractorPromise = loadExtractorInternal();
  }
  return extractorPromise;
}

// DINOv2 출력([1, seq, hidden])에서 CLS 토큰(index 0)을 제외한 패치 토큰들을
// 평균(mean-pooling)해 전역 descriptor로 쓴다. 스파이크 실측(프로덕션 카탈로그 50개)에서
// CLS 토큰보다 이미지 리트리벌 품질이 더 좋았음 — 특히 같은 카테고리 내 세부 유사도.
// ⚠️ 카탈로그 임베딩(compute-product-embeddings.ts)도 반드시 같은 mean-pooling이어야
// 쿼리·카탈로그가 같은 벡터 공간에 놓여 코사인 유사도가 의미를 가진다.
function extractMeanVector(feat: {
  dims: number[];
  tolist: () => number[][] | number[][][];
}): number[] {
  const data = feat.tolist();
  // [1, seq, hidden] 기대. 혹시 [1, hidden] 형태면 그대로 사용(mean-pool 불가).
  if (feat.dims.length !== 3) return (data as number[][])[0];
  const tokens = (data as number[][][])[0];
  const patches = tokens.slice(1); // CLS 제외
  const hidden = patches[0].length;
  const pooled = new Array<number>(hidden).fill(0);
  for (const p of patches) {
    for (let i = 0; i < hidden; i++) pooled[i] += p[i];
  }
  for (let i = 0; i < hidden; i++) pooled[i] /= patches.length;
  return pooled;
}

/** 유휴 시간에 모델을 미리 받아 브라우저 캐시에 태워둔다 (첫 검색 시 지연 완화). */
export function prefetchImageEmbeddingModel(): void {
  const schedule =
    typeof requestIdleCallback === 'function'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 0);

  schedule(() => {
    loadExtractor().catch(() => {
      // 프리페치 실패는 조용히 무시 — 실제 검색 시점에 다시 시도된다.
    });
  });
}

export async function getImageEmbedding(file: File): Promise<number[]> {
  const [extractor, { RawImage }] = await Promise.all([
    loadExtractor(),
    import('@huggingface/transformers'),
  ]);
  const image = await RawImage.fromBlob(file);
  const feat = await extractor(image);
  return extractMeanVector(feat);
}
