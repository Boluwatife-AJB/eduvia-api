import { Module } from '@nestjs/common';
import { ApprovalWorkflowService } from './approval-workflow.service';

@Module({
  providers: [ApprovalWorkflowService],
  exports: [ApprovalWorkflowService],
})
export class ApprovalModule {}
