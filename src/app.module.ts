import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';

import { DatabaseModule } from './config/modules/database.module';
import { TasksModule } from './tasks/tasks.module';
import { HttpExceptionFilter } from './utils/filters/httpExceptions.filters';
import { LoggerModule } from './config/modules/logging.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule,
    DatabaseModule,
    TasksModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})

export class AppModule {} 

