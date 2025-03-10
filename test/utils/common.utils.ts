import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as path from 'path';

import { TasksService } from '../../src/tasks/services/tasks.service';
import { TasksProcessor } from '../../src/tasks/services/tasks.processor';
import { Task } from '../../src/tasks/entities/task.entity';
import { Image } from '../../src/tasks/entities/image.entity';
import { TestContext } from '../types/test-context';
import {
    calculateMD5,
    getFileExtension,
} from '../../src/utils/files/file.utils';
import { setupTestDatabase } from './database/test-database.utils';
import {
    setupTestDirectories,
    cleanupTestDirectories,
} from './directories/test-directories.utils';

export const setupTestModule = async (
    taskModel: Model<Task>,
    imageModel: Model<Image>,
): Promise<{
    module: TestingModule;
    service: TasksService;
    configService: ConfigService;
    tasksProcessor: TasksProcessor;
}> => {
    const mockConfigService = new ConfigService({
        paths: {
            input: './test-input',
            output: './test-output',
        },
    });

    const logger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    };

    const module = await Test.createTestingModule({
        providers: [
            TasksService,
            TasksProcessor,
            {
                provide: getModelToken(Task.name),
                useValue: taskModel,
            },
            {
                provide: getModelToken(Image.name),
                useValue: imageModel,
            },
            {
                provide: ConfigService,
                useValue: mockConfigService,
            },
            {
                provide: WINSTON_MODULE_PROVIDER,
                useValue: logger,
            },
        ],
    }).compile();

    const service = module.get<TasksService>(TasksService);
    const tasksProcessor = module.get<TasksProcessor>(TasksProcessor);

    return {
        module,
        service,
        configService: mockConfigService,
        tasksProcessor,
    };
};

export async function setupTestContext(): Promise<TestContext> {
    const { testInputDir, testOutputDir } = setupTestDirectories();

    const { mongod, mongoConnection, taskModel, imageModel } =
        await setupTestDatabase();

    const mockConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
            switch (key) {
                case 'paths.input':
                    return path.resolve(testInputDir);
                case 'paths.output':
                    return path.resolve(testOutputDir);
                default:
                    return null;
            }
        }),
    };

    const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
        providers: [
            TasksService,
            TasksProcessor,
            {
                provide: getModelToken(Task.name),
                useValue: taskModel,
            },
            {
                provide: getModelToken(Image.name),
                useValue: imageModel,
            },
            {
                provide: ConfigService,
                useValue: mockConfigService,
            },
            {
                provide: WINSTON_MODULE_PROVIDER,
                useValue: mockLogger,
            },
        ],
    }).compile();

    const tasksProcessor = module.get<TasksProcessor>(TasksProcessor);
    const service = module.get<TasksService>(TasksService);

    return {
        module,
        mongod,
        mongoConnection,
        taskModel,
        imageModel,
        service,
        configService: mockConfigService,
        tasksProcessor,
        utils: {
            calculateMD5,
            getFileExtension,
            generateObjectId: () => new Types.ObjectId().toString(),
        },
    };
}

export async function cleanupTestContext(context: TestContext): Promise<void> {
    await context.mongoConnection.close();
    await context.mongod.stop();
    cleanupTestDirectories();
}
