import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, Model } from 'mongoose';

import { TasksService } from '../../src/tasks/services/tasks.service';
import { TasksProcessor } from '../../src/tasks/services/tasks.processor';
import { Task } from '../../src/tasks/entities/task.entity';
import { Image } from '../../src/tasks/entities/image.entity';
import {
    calculateMD5,
    getFileExtension,
} from '../../src/utils/files/file.utils';
import { Types } from 'mongoose';

export interface MockConfigService {
    get: jest.Mock;
}

export interface TestContext {
    module: TestingModule;
    mongod: MongoMemoryServer;
    mongoConnection: Connection;
    taskModel: Model<Task>;
    imageModel: Model<Image>;
    service: TasksService;
    configService: MockConfigService;
    tasksProcessor: TasksProcessor;
    utils: {
        calculateMD5: typeof calculateMD5;
        getFileExtension: typeof getFileExtension;
        generateObjectId: () => string;
    };
}
