import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

import { TasksService } from '../../src/tasks/services/tasks.service';
import { TasksProcessor } from '../../src/tasks/services/tasks.processor';
import { Task } from '../../src/tasks/entities/task.entity';
import { Image } from '../../src/tasks/entities/image.entity';
import { TestContext } from 'test/types/test-context.types';

import { setupTestDatabase } from './database/test-database.utils';
import { setupTestDirectories, cleanupTestDirectories } from './directories/test-directories.utils';

export const setupTestModule = async (taskModel: Model<Task>, imageModel: Model<Image>): Promise<{
    module: TestingModule;
    service: TasksService;
    configService: ConfigService;
    tasksProcessor: TasksProcessor;
}> => {
    const module = await Test.createTestingModule({
        providers: [
            TasksService,
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
                useValue: {
                    get: jest.fn().mockImplementation((key) => {
                        if (key === 'paths.input') return './test-input';
                        if (key === 'paths.output') return './test-output';
                        return null;
                    }),
                },
            },
            {
                provide: TasksProcessor,
                useValue: {
                    processTask: jest.fn().mockResolvedValue(undefined),
                },
            },
            {
                provide: WINSTON_MODULE_PROVIDER,
                useValue: {
                    info: jest.fn(),
                    error: jest.fn(),
                    warn: jest.fn(),
                    debug: jest.fn(),
                },
            },
        ],
    }).compile();

    const service = module.get<TasksService>(TasksService);
    const configService = module.get<ConfigService>(ConfigService);
    const tasksProcessor = module.get<TasksProcessor>(TasksProcessor);

    return { module, service, configService, tasksProcessor };
};

export const setupTestContext = async (): Promise<TestContext> => {
    const { mongod, mongoConnection, taskModel, imageModel } = await setupTestDatabase();
    const { module, service, configService, tasksProcessor } = await setupTestModule(taskModel, imageModel);
    setupTestDirectories();

    return {
        module,
        mongod,
        mongoConnection,
        taskModel,
        imageModel,
        service,
        configService,
        tasksProcessor,
    };
};

export const cleanupTestContext = async (context: TestContext) => {
    await context.mongoConnection.close();
    await context.mongod.stop();
    cleanupTestDirectories();
}; 