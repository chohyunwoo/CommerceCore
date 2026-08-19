import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';

function buildPayload(overrides: Record<string, unknown> = {}) {
  return {
    buyerEmail: 'buyer@example.com',
    buyerName: '홍길동',
    buyerPhone: '010-1234-5678',
    postalCode: '06236',
    baseAddress: '서울시 강남구 테헤란로 123',
    detailAddress: '101동 202호',
    items: [{ productOptionId: 1, quantity: 1 }],
    ...overrides,
  };
}

describe('CreateOrderDto', () => {
  it('passes validation with a valid payload', async () => {
    const dto = plainToInstance(CreateOrderDto, buildPayload());
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes validation without detailAddress (optional)', async () => {
    const dto = plainToInstance(
      CreateOrderDto,
      buildPayload({ detailAddress: undefined }),
    );
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a postalCode that is not 5 digits', async () => {
    const dto = plainToInstance(
      CreateOrderDto,
      buildPayload({ postalCode: '123' }),
    );
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'postalCode')).toBe(true);
  });

  it('rejects a missing baseAddress', async () => {
    const dto = plainToInstance(
      CreateOrderDto,
      buildPayload({ baseAddress: undefined }),
    );
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'baseAddress')).toBe(true);
  });
});
