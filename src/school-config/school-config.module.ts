import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { SchoolConfigService } from './school-config.service';
import { GpaCalculatorService } from 'src/assessment/gpa-calculator.service';
import { SchoolConfigController } from './school-config.controller';

@Module({
  imports: [CacheModule.register({ isGlobal: true })],
  providers: [SchoolConfigService, GpaCalculatorService],
  exports: [SchoolConfigService, GpaCalculatorService],
  controllers: [SchoolConfigController],
})
export class SchoolConfigModule {}
