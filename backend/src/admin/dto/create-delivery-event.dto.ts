import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DeliveryStage } from '../../orders/entities/delivery-stage.enum';

export class CreateDeliveryEventDto {
  @ApiProperty({ enum: DeliveryStage, example: DeliveryStage.IN_TRANSIT })
  @IsEnum(DeliveryStage)
  stage: DeliveryStage;

  @ApiProperty({ example: '서울 동부 터미널', required: false })
  @IsOptional()
  @IsString()
  location?: string;
}
