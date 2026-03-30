import { Module } from '@nestjs/common';
import { ApprovalModule } from 'src/approval/approval.module';
import { SchoolConfigModule } from 'src/school-config/school-config.module';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { GradingService } from './grading.service';
import { ResultEngineService } from 'src/result-engine/result-engine.service';
import { GpaCalculatorService } from './gpa-calculator.service';
import { GradingWorker } from './workers/grading.worker';

@Module({
  imports: [ApprovalModule, SchoolConfigModule],
  controllers: [AssessmentController],
  providers: [
    AssessmentService,
    GradingService,
    ResultEngineService,
    GpaCalculatorService,
    GradingWorker,
  ],
  exports: [
    AssessmentService,
    GradingService,
    ResultEngineService,
    GpaCalculatorService,
  ],
})
export class AssessmentModule {}
