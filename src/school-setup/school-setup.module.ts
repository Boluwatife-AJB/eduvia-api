import { Module } from '@nestjs/common';
import { SchoolSetupService } from './school-setup.service';
import { SchoolSetupController } from './school-setup.controller';
import { GpaCalculatorService } from 'src/assessment/gpa-calculator.service';

@Module({
  controllers: [SchoolSetupController],
  providers: [SchoolSetupService, GpaCalculatorService],
  exports: [SchoolSetupService, GpaCalculatorService],
})
export class SchoolSetupModule {}
