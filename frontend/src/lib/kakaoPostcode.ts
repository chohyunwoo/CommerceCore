const SCRIPT_SRC =
  '//t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

interface KakaoPostcodeResult {
  zonecode: string;
  address: string;
  roadAddress: string;
  jibunAddress: string;
}

interface KakaoPostcodeConstructor {
  new (options: {
    oncomplete: (data: KakaoPostcodeResult) => void;
  }): { open: () => void };
}

declare global {
  interface Window {
    kakao?: { Postcode: KakaoPostcodeConstructor };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.kakao?.Postcode) return Promise.resolve();

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('우편번호 검색 스크립트를 불러오지 못했습니다.'));
      document.head.appendChild(script);
    });
  }

  return scriptPromise;
}

export async function openPostcodeSearch(
  onComplete: (result: { postalCode: string; baseAddress: string }) => void,
): Promise<void> {
  await loadScript();

  new window.kakao!.Postcode({
    oncomplete: (data) => {
      onComplete({
        postalCode: data.zonecode,
        baseAddress: data.roadAddress || data.jibunAddress || data.address,
      });
    },
  }).open();
}
