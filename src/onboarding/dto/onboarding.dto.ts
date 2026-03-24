import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { OnboardingStatus } from 'src/generated/prisma/enums';

export class RegisterSchoolDto {
  @ApiProperty({ example: 'Greenfield Academy' })
  @IsString()
  @IsNotEmpty()
  school_name: string;

  @ApiProperty({
    example: 'greenfield-academy',
    description:
      'Unique URL slug for the school. Lowercase letters, numbers and hyphens only.',
  })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers and hyphens',
  })
  @MinLength(3)
  school_slug: string;

  @ApiProperty({ example: 'Amaka' })
  @IsString()
  @IsNotEmpty()
  owner_first_name: string;

  @ApiProperty({ example: 'Okonkwo' })
  @IsString()
  @IsNotEmpty()
  owner_last_name: string;

  @ApiProperty({ example: 'amaka@greenfieldacademy.edu.ng' })
  @IsEmail()
  owner_email: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @IsNotEmpty()
  owner_phone: string;

  @ApiProperty({ example: '12 Admiralty Way, Lekki Phase 1' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'Victoria Island' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: '10001' })
  @IsString()
  @IsNotEmpty()
  zip: string;

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ example: 'Nigeria' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({
    example: '101-500',
    enum: ['1-100', '101-500', '501-1000', '1000+'],
  })
  @IsIn(['1-100', '101-500', '501-1000', '1000+'])
  student_count: string;

  @ApiProperty({
    example: 'basic',
    enum: ['basic', 'standard', 'premium'],
  })
  @IsIn(['basic', 'standard', 'premium'])
  plan: string;
}

export class VerifyEmailDto {
  @ApiProperty({ example: 'abc123def456' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class CheckSlugDto {
  @ApiProperty({ example: 'greenfield-academy' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers and hyphens',
  })
  @MinLength(3)
  slug: string;
}

export class ReviewRegistrationDto {
  @ApiProperty({ enum: OnboardingStatus })
  @IsIn(Object.values(OnboardingStatus))
  @IsNotEmpty()
  decision: OnboardingStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsNotEmpty()
  reason?: string; // required if REJECTED
}
