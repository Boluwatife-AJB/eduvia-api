import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  IsOptional,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AllowanceItemDto {
  @ApiProperty({ example: 'Housing Allowance' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  @Min(0)
  amount: number;
}

export class SalaryStructureDto {
  @ApiProperty({
    example: 'TEACHER',
    description: 'Grade level identifier for this salary structure',
  })
  @IsString()
  @IsNotEmpty()
  grade_level: string;

  @ApiProperty({ example: 80000 })
  @IsNumber()
  @Min(0)
  basic_salary: number;

  @ApiPropertyOptional({ type: [AllowanceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllowanceItemDto)
  @IsOptional()
  allowances?: AllowanceItemDto[];

  @ApiPropertyOptional({ example: 7.5, description: 'Tax rate percentage' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_rate?: number;

  @ApiPropertyOptional({ example: 8, description: 'Pension rate percentage' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  pension_rate?: number;
}

export class SchedulePayrollDto {
  @ApiProperty({
    example: '2025-01',
    description: 'Month in YYYY-MM format',
  })
  @IsString()
  @IsNotEmpty()
  month: string;
}

export class ApproveLoanDto {
  @ApiProperty({ description: 'Loan ID to approve' })
  @IsString()
  @IsNotEmpty()
  loan_id: string;

  @ApiProperty({
    example: 12,
    description: 'Number of months for repayment',
    enum: [6, 12, 18, 24],
  })
  @IsIn([6, 12, 18, 24])
  @IsNotEmpty()
  duration_months: number;
}
