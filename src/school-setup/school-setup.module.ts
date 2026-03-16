import { Module } from '@nestjs/common';
import { SchoolSetupService } from './school-setup.service';
import { SchoolSetupController } from './school-setup.controller';

@Module({
  controllers: [SchoolSetupController],
  providers: [SchoolSetupService],
  exports: [SchoolSetupService], // Export the service to be used in other modules
})
export class SchoolSetupModule {}
