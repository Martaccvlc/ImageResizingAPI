import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, connect, Model, Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { NotFoundException } from '@nestjs/common';

import { TasksService } from '../../src/tasks/services/tasks.service';
import { TasksProcessor } from '../../src/tasks/services/tasks.processor';
import { Task, TaskSchema } from '../../src/tasks/entities/task.entity';
import { TaskStatus } from '../../src/utils/enums/tasks/task-status.enum';
import { Image, ImageSchema } from '../../src/tasks/entities/image.entity';
import { CreateTaskDto } from '../../src/tasks/dto/create-task.dto';
import { fileErrorResponseMessages } from '../../src/utils/constants/files/files-messages.constants';
import { taskResponseErrorMessages } from '../../src/utils/constants/tasks/task-messages.constants';

// Mock the file utils module
jest.mock('../../src/utils/files/file.utils', () => ({
    downloadImage: jest.fn().mockImplementation((url, path) => {
        if (url === 'https://example.com/test-image.jpg') {
            fs.writeFileSync(path, 'test image data');
            return path;
        }
        throw new Error('Failed to download image');
    }),
    ensureDirectoryExists: jest.fn(),
}));

describe('TasksService', () => {
    let service: TasksService;
    let mongod: MongoMemoryServer;
    let mongoConnection: Connection;
    let taskModel: Model<Task>;
    let imageModel: Model<Image>;
    let configService: ConfigService;
    let tasksProcessor: TasksProcessor;

    beforeAll(async () => {
        mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();
        mongoConnection = (await connect(uri)).connection;
        taskModel = mongoConnection.model<Task>(Task.name, TaskSchema);
        imageModel = mongoConnection.model<Image>(Image.name, ImageSchema);

        // Creating temporary dicts for test input and output
        const testInputDir = './test-input';
        const testOutputDir = './test-output';

        if (!fs.existsSync(testInputDir)) {
            fs.mkdirSync(testInputDir, { recursive: true });
        }

        if (!fs.existsSync(testOutputDir)) {
            fs.mkdirSync(testOutputDir, { recursive: true });
        }

        // Creating a new image for the test
        const sampleImageBuffer = Buffer.alloc(1024, 0);
        fs.writeFileSync(
            path.join(testInputDir, 'test-image.jpg'),
            sampleImageBuffer,
        );
    });

    afterAll(async () => {
        await mongoConnection.close();
        await mongod.stop();

        // Cleanining dicts for test input and output
        fs.rmSync('./test-input', { recursive: true, force: true });
        fs.rmSync('./test-output', { recursive: true, force: true });
    });

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
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

        service = module.get<TasksService>(TasksService);
        configService = module.get<ConfigService>(ConfigService);
        tasksProcessor = module.get<TasksProcessor>(TasksProcessor);

        await taskModel.deleteMany({});
        await imageModel.deleteMany({});
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create a task with local path', async () => {
            const createTaskDto: CreateTaskDto = {
                localPath: './test-input/test-image.jpg',
            };

            const result = await service.create(createTaskDto);

            expect(result).toHaveProperty('taskId');
            expect(result.status).toEqual(TaskStatus.PENDING);
            expect(result.price).toBeGreaterThanOrEqual(5);
            expect(result.price).toBeLessThanOrEqual(50);
        });

        it('should throw an error if neither url nor localPath is provided', async () => {
            const createTaskDto: CreateTaskDto = {};

            await expect(service.create(createTaskDto)).rejects.toThrow(taskResponseErrorMessages.MISSING_PATH);
        });

        it('should create a task with URL', async () => {
            const createTaskDto: CreateTaskDto = {
                url: 'https://example.com/test-image.jpg',
            };

            const result = await service.create(createTaskDto);

            expect(result).toHaveProperty('taskId');
            expect(result.status).toEqual(TaskStatus.PENDING);
            expect(result.price).toBeGreaterThanOrEqual(5);
            expect(result.price).toBeLessThanOrEqual(50);
        });

        it('should throw BadRequestException for invalid URL', async () => {
            const createTaskDto: CreateTaskDto = {
                url: 'invalid-url',
            };

            await expect(service.create(createTaskDto)).rejects.toThrow(fileErrorResponseMessages.MALFORMED_URL);
        });

        it('should throw error for non-existent local file', async () => {
            const createTaskDto: CreateTaskDto = {
                localPath: './test-input/non-existent.jpg',
            };

            await expect(service.create(createTaskDto)).rejects.toThrow(fileErrorResponseMessages.FILE_NOT_FOUND);
        });

        it('should throw error when URL download fails', async () => {
            const createTaskDto: CreateTaskDto = {
                url: 'https://example.com/non-existent.jpg',
            };

            await expect(service.create(createTaskDto)).rejects.toThrow('Failed to download image');
        });
    });

    describe('findOne', () => {
        it('should return task details for completed task', async () => {
            const task = await taskModel.create({
                status: TaskStatus.COMPLETED,
                price: 25.5,
                originalPath: '/test-input/test-image.jpg',
                images: [
                    {
                        resolution: '1024',
                        path: '/output/test-image/1024/md5.jpg',
                    },
                    {
                        resolution: '800',
                        path: '/output/test-image/800/md5.jpg',
                    },
                ],
            });

            const result = await service.findOne(task.id);

            expect(result.taskId).toEqual(task.id);
            expect(result.status).toEqual(TaskStatus.COMPLETED);
            expect(result.price).toEqual(25.5);
            expect(result.images).toHaveLength(2);
            expect(result.images && result.images[0].resolution).toEqual('1024');
            expect(result.images && result.images[1].resolution).toEqual('800');
        });

        it('should return task details for failed task', async () => {
            const errorMessage = 'Processing failed';
            const task = await taskModel.create({
                status: TaskStatus.FAILED,
                price: 25.5,
                originalPath: '/test-input/test-image.jpg',
                errorMessage,
            });

            const result = await service.findOne(task.id);

            expect(result.taskId).toEqual(task.id);
            expect(result.status).toEqual(TaskStatus.FAILED);
            expect(result.errorMessage).toEqual(errorMessage);
        });

        it('should throw NotFoundException for non-existent task', async () => {
            const nonExistentId = new Types.ObjectId().toString();

            await expect(service.findOne(nonExistentId)).rejects.toThrow(NotFoundException);
        });

        it('should throw NotFoundException for invalid ObjectId', async () => {
            await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
        });
    });

    describe('updateTaskStatus', () => {
        it('should update task status to COMPLETED with images', async () => {
            const task = await taskModel.create({
                status: TaskStatus.PENDING,
                price: 25,
                originalPath: '/test/path.jpg',
            });

            const images = [
                { resolution: '1024', path: '/output/1024/image.jpg' },
                { resolution: '800', path: '/output/800/image.jpg' },
            ];

            await service.updateTaskStatus(
                task.id,
                TaskStatus.COMPLETED,
                images
            );

            const updatedTask = await taskModel.findById(task.id);
            expect(updatedTask?.status).toBe(TaskStatus.COMPLETED);
            expect(updatedTask?.images).toHaveLength(2);
            expect(updatedTask?.images?.[0].resolution).toBe('1024');
            expect(updatedTask?.images?.[0].path).toBe('/output/1024/image.jpg');
        });

        it('should update task status to FAILED with error message', async () => {
            const task = await taskModel.create({
                status: TaskStatus.PENDING,
                price: 25,
                originalPath: '/test/path.jpg',
            });

            const errorMessage = 'Processing failed';
            await service.updateTaskStatus(
                task.id,
                TaskStatus.FAILED,
                undefined,
                errorMessage
            );

            const updatedTask = await taskModel.findById(task.id);
            expect(updatedTask?.status).toBe(TaskStatus.FAILED);
            expect(updatedTask?.errorMessage).toBe(errorMessage);
        });

        it('should handle non-existent task ID', async () => {
            const nonExistentId = new Types.ObjectId().toString();
            const images = [{ resolution: '1024', path: '/output/1024/image.jpg' }];

            await expect(
                service.updateTaskStatus(
                    nonExistentId,
                    TaskStatus.COMPLETED,
                    images
                )
            ).rejects.toThrow(NotFoundException);
        });

        it('should update task status to PENDING', async () => {
            const task = await taskModel.create({
                status: TaskStatus.FAILED,
                price: 25,
                originalPath: '/test/path.jpg',
                errorMessage: 'Previous error',
                images: [{ resolution: '1024', path: '/output/1024/image.jpg' }],
            });

            await service.updateTaskStatus(
                task.id,
                TaskStatus.PENDING
            );

            const updatedTask = await taskModel.findById(task.id);
            expect(updatedTask?.status).toBe(TaskStatus.PENDING);
            expect(updatedTask?.errorMessage).toBeNull();
            expect(updatedTask?.images).toHaveLength(0);
        });
    });
});
