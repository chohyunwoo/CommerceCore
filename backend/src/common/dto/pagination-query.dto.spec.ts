import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

// 컨트롤러의 전역 ValidationPipe({ transform: true })와 동일한 변환을 재현한다.
async function validateQuery(query: Record<string, unknown>) {
  const dto = plainToInstance(PaginationQueryDto, query, {
    enableImplicitConversion: false,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('PaginationQueryDto', () => {
  it('page/limit이 없으면 통과하고 undefined로 남는다 (서비스 기본값 적용)', async () => {
    const { dto, errors } = await validateQuery({});
    expect(errors).toHaveLength(0);
    expect(dto.page).toBeUndefined();
    expect(dto.limit).toBeUndefined();
  });

  it('문자열 숫자를 정수로 변환한다', async () => {
    const { dto, errors } = await validateQuery({ page: '2', limit: '20' });
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(20);
  });

  it('limit이 상한(100)을 넘으면 거부한다', async () => {
    const { errors } = await validateQuery({ limit: '1000000' });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('limit');
  });

  it('숫자가 아닌 limit(NaN 유발)을 거부한다', async () => {
    const { errors } = await validateQuery({ limit: 'abc' });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('limit');
  });

  it('page가 1 미만이면 거부한다', async () => {
    const { errors } = await validateQuery({ page: '0' });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('page');
  });

  it('경계값 limit=100은 통과한다', async () => {
    const { dto, errors } = await validateQuery({ limit: '100' });
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(100);
  });
});
