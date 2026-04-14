import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaymentCategory } from 'src/generated/prisma/enums';

export class InitiatePaymentDto {
  @ApiProperty({ description: 'Fee item ID' })
  @IsString()
  @IsNotEmpty()
  fee_item_id: string;

  @ApiPropertyOptional({ description: 'Student ID' })
  @IsString()
  @IsOptional()
  student_id: string;
}

export class CreateFeeItemDto {
  @ApiProperty({ example: 'First Term Tuition 2024/2025' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: PaymentCategory })
  @IsEnum(PaymentCategory)
  category: PaymentCategory;

  @ApiProperty({ example: 75000 })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional({
    description: 'Scope to a specific class. Leave empty for school-wide.',
  })
  @IsString()
  @IsOptional()
  class_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  term_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  session_id?: string;

  @ApiPropertyOptional({ example: '2025-10-15T00:00:00.000Z' })
  @IsString()
  @IsOptional()
  due_date?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  is_optional?: boolean;
}

export class WaivePaymentDto {
  @ApiProperty({ description: 'Payment ID to waive' })
  @IsString()
  @IsNotEmpty()
  payment_id: string;

  @ApiProperty({ example: 'Scholarship recipient' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class PaystackWebhookDto {
  @ApiProperty()
  event: string;

  @ApiProperty()
  data: {
    reference: string;
    id: number;
    status: string;
    amount: number;
    currency: string;
    customer: { email: string };
    metadata: Record<string, any>;
  };
}
