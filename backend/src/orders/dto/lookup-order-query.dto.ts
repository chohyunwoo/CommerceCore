import { IsEmail, IsNotEmpty } from 'class-validator';

export class LookupOrderQueryDto {
  @IsNotEmpty()
  orderNumber: string;

  @IsEmail()
  email: string;
}
