import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

import { TasksController } from '../controllers/tasks.controller';
import { TasksService } from '../services/tasks.service';
import { TasksProcessor } from '../services/tasks.processor';
import { Task, TaskSchema } from '../entities/task.entity';
import { Image, ImageSchema } from '../entities/image.entity';
import { LoggerModule } from '../../core/logging/logging.module';

@Module({
    imports: [
        ConfigModule,
        LoggerModule,
        MongooseModule.forFeature([
            { name: Task.name, schema: TaskSchema },
            { name: Image.name, schema: ImageSchema },
        ]),
    ],
    controllers: [TasksController],
    providers: [TasksService, TasksProcessor],
})
export class TasksModule {}
