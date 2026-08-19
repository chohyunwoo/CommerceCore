import { useEffect, useState } from 'react';
import {
  createProduct,
  fetchCategories,
  uploadProductImage,
} from '../api/admin';
import { ApiError } from '../api/client';
import { getImageEmbedding } from '../lib/imageEmbedding';
import type { CategoryItem, CreateProductOptionPayload } from '../api/types';

interface OptionRow extends CreateProductOptionPayload {
  key: number;
}

let nextOptionKey = 1;
function emptyOptionRow(): OptionRow {
  return { key: nextOptionKey++, size: '', color: '', stock: 0, sku: '' };
}

interface Props {
  onAuthError: () => void;
}

export function AdminProductForm({ onAuthError }: Props) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [options, setOptions] = useState<OptionRow[]>([emptyOptionRow()]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories()
      .then((items) => {
        setCategories(items);
        setCategoryId((prev) => prev ?? items[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.statusCode === 401) onAuthError();
      });
  }, [onAuthError]);

  function handleFileChange(selected: File | null) {
    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  function updateOption(key: number, patch: Partial<CreateProductOptionPayload>) {
    setOptions((prev) =>
      prev.map((option) => (option.key === key ? { ...option, ...patch } : option)),
    );
  }

  function addOption() {
    setOptions((prev) => [...prev, emptyOptionRow()]);
  }

  function removeOption(key: number) {
    setOptions((prev) => (prev.length > 1 ? prev.filter((o) => o.key !== key) : prev));
  }

  function resetForm() {
    setName('');
    setDescription('');
    setBasePrice('');
    setFile(null);
    setPreviewUrl(null);
    setOptions([emptyOptionRow()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || categoryId === null) return;

    setSubmitting(true);
    setError(null);
    setSuccessName(null);

    try {
      setStatusMessage('브라우저에서 이미지 분석 중...');
      const imageEmbedding = await getImageEmbedding(file);

      setStatusMessage('이미지 업로드 중...');
      const { url: imageUrl } = await uploadProductImage(file);

      setStatusMessage('상품 등록 중...');
      const created = await createProduct({
        categoryId,
        name,
        description: description || undefined,
        basePrice: Number(basePrice),
        imageUrl,
        imageEmbedding,
        options: options.map(({ key: _key, ...option }) => option),
      });

      setSuccessName(created.name);
      resetForm();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.statusCode === 401) {
        onAuthError();
        return;
      }
      setError(
        err instanceof ApiError ? err.message : '상품 등록에 실패했습니다.',
      );
    } finally {
      setStatusMessage(null);
      setSubmitting(false);
    }
  }

  const canSubmit =
    !submitting &&
    file !== null &&
    categoryId !== null &&
    name.trim() !== '' &&
    basePrice !== '' &&
    options.every((o) => o.size && o.color && o.sku);

  return (
    <section id="admin-product-form">
      <p className="admin-section-title">상품 등록</p>

      <form className="checkout-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">카테고리</label>
          <select
            className="form-input"
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(Number(e.target.value))}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">상품명</label>
          <input
            className="form-input"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">설명 (선택)</label>
          <input
            className="form-input"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">가격</label>
          <input
            className="form-input"
            type="number"
            min={0}
            required
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">이미지</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
          {previewUrl && (
            <div className="image-search-preview">
              <img src={previewUrl} alt="업로드할 상품 이미지 미리보기" />
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">옵션 (사이즈 / 색상 / 재고 / SKU)</label>
          {options.map((option) => (
            <div key={option.key} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                className="form-input"
                type="text"
                placeholder="사이즈 (예: 270)"
                value={option.size}
                onChange={(e) => updateOption(option.key, { size: e.target.value })}
              />
              <input
                className="form-input"
                type="text"
                placeholder="색상 (예: 블랙)"
                value={option.color}
                onChange={(e) => updateOption(option.key, { color: e.target.value })}
              />
              <input
                className="form-input"
                type="number"
                min={0}
                placeholder="재고"
                value={option.stock}
                onChange={(e) => updateOption(option.key, { stock: Number(e.target.value) })}
              />
              <input
                className="form-input"
                type="text"
                placeholder="SKU"
                value={option.sku}
                onChange={(e) => updateOption(option.key, { sku: e.target.value })}
              />
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => removeOption(option.key)}
                disabled={options.length === 1}
              >
                삭제
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={addOption}>
            옵션 추가
          </button>
        </div>

        {error && <p className="error" style={{ marginBottom: '16px' }}>{error}</p>}
        {successName && (
          <p style={{ color: 'var(--text-sub)', marginBottom: '16px' }}>
            {successName} 등록 완료
          </p>
        )}

        <button type="submit" className="form-submit" disabled={!canSubmit}>
          {submitting ? statusMessage ?? '등록 중...' : '상품 등록'}
        </button>
      </form>
    </section>
  );
}
