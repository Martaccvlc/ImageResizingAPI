import { Module } from '@nestjs/common';
import { AppLoggingService } from '../services/logging.service';

@Module({
  providers: [AppLoggingService],
  exports: [AppLoggingService],
})
export class LoggerModule {}