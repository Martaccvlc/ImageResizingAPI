import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, connect, createConnection } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'winston';

import { AppModule } from '../../src/app.module';
import { Task, TaskSchema } from '../../src/tasks/entities/task.entity';
import { Image, ImageSchema } from '../../src/tasks/entities/image.entity';
import { TaskStatus } from '../../src/utils/enums/tasks/task-status.enum';
import { taskResponseErrorMessages } from '../../src/utils/constants/tasks/task-messages.constants';
import { fileErrorResponseMessages } from '../../src/utils/constants/files/files-messages.constants';

describe('Tasks Integration Tests', () => {
    let app: INestApplication;
    let mongod: MongoMemoryServer;
    let mongoConnection: Connection;
    let taskModel: any;
    let imageModel: any;
    let testInputDir: string;
    let testOutputDir: string;

    beforeAll(async () => {
        // Create test directories
        testInputDir = path.join(process.cwd(), 'test', 'test-input');
        testOutputDir = path.join(process.cwd(), 'test', 'test-output');
        fs.mkdirSync(testInputDir, { recursive: true });
        fs.mkdirSync(testOutputDir, { recursive: true });

        // Create test image
        const testImagePath = path.join(testInputDir, 'test-image.jpg');
        const testImageBuffer = Buffer.from('fake image data');
        fs.writeFileSync(testImagePath, testImageBuffer);

        // Start in-memory MongoDB
        mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();

        // Create test module
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    load: [
                        () => ({
                            mongodb: {
                                uri,
                            },
                            inputDir: testInputDir,
                            outputDir: testOutputDir,
                        }),
                    ],
                }),
                WinstonModule.forRoot({
                    level: 'error',
                    format: format.json(),
                    transports: [],
                }),
                AppModule,
            ],
        }).compile();

        // Create test app
        app = moduleFixture.createNestApplication();
        await app.init();

        // Connect to MongoDB
        mongoConnection = await createConnection(uri);

        // Get models
        taskModel = mongoConnection.model<Task>(Task.name, TaskSchema);
        imageModel = mongoConnection.model<Image>(Image.name, ImageSchema);
    });

    afterAll(async () => {
        // Clean up test directories
        fs.rmSync(testInputDir, { recursive: true, force: true });
        fs.rmSync(testOutputDir, { recursive: true, force: true });

        // Close connections
        await mongoConnection.close();
        await mongod.stop();
        await app.close();
    });

    beforeEach(async () => {
        // Clear database before each test
        await taskModel.deleteMany({});
        await imageModel.deleteMany({});
    });

    describe('POST /api/tasks', () => {
        it('should create a task with a local image', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/tasks')
                .send({
                    localPath: 'test/test-input/test-image.jpg',
                })
                .expect(201);

            expect(response.body).toBeDefined();
            expect(response.body.id).toBeDefined();
            expect(response.body.status).toBe(TaskStatus.PENDING);
            expect(response.body.price).toBeDefined();

            // Verify task was created in database
            const task = await taskModel.findById(response.body.id);
            expect(task).toBeDefined();
            expect(task.status).toBe(TaskStatus.PENDING);
        });

        it('should create a task with a URL', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/tasks')
                .send({
                    url: 'http://example.com/image.jpg',
                })
                .expect(201);

            expect(response.body).toBeDefined();
            expect(response.body.id).toBeDefined();
            expect(response.body.status).toBe(TaskStatus.PENDING);
            expect(response.body.price).toBeDefined();

            // Verify task was created in database
            const task = await taskModel.findById(response.body.id);
            expect(task).toBeDefined();
            expect(task.status).toBe(TaskStatus.PENDING);
        });

        it('should return 400 when no URL or local path is provided', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/tasks')
                .send({})
                .expect(400);

            expect(response.body.message).toBe('URL or local image path needed.');
        });

        it('should return 400 when local file does not exist', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/tasks')
                .send({
                    localPath: 'test/test-input/non-existent.jpg',
                })
                .expect(400);

            expect(response.body.message).toBe(fileErrorResponseMessages.FILE_NOT_FOUND);
        });

        it('should return 400 when URL is invalid', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/tasks')
                .send({
                    url: 'not-a-url',
                })
                .expect(400);

            expect(response.body.message).toBe('Malformed URL');
        });
    });

    describe('GET /api/tasks/:id', () => {
        it('should get a task by id', async () => {
            // Create a task first
            const createResponse = await request(app.getHttpServer())
                .post('/api/tasks')
                .send({
                    localPath: 'test/test-input/test-image.jpg',
                })
                .expect(201);

            const taskId = createResponse.body.id;

            // Get the task
            const response = await request(app.getHttpServer())
                .get(`/api/tasks/${taskId}`)
                .expect(200);

            expect(response.body).toBeDefined();
            expect(response.body.id).toBe(taskId);
            expect(response.body.status).toBe(TaskStatus.PENDING);
            expect(response.body.price).toBeDefined();
        });

        it('should return 404 when task is not found', async () => {
            const nonExistentId = '507f1f77bcf86cd799439011';

            const response = await request(app.getHttpServer())
                .get(`/api/tasks/${nonExistentId}`)
                .expect(404);

            expect(response.body.message).toBe(taskResponseErrorMessages.INVALID_TASK_ID);
        });

        it('should return 400 when task id is invalid', async () => {
            const invalidId = 'invalid-id';

            const response = await request(app.getHttpServer())
                .get(`/api/tasks/${invalidId}`)
                .expect(400);

            expect(response.body.message).toBe(taskResponseErrorMessages.INVALID_TASK_ID);
        });
    });

    describe('Task Processing Flow', () => {
        it('should process a task and generate resized images', async () => {
            // Create a task
            const createResponse = await request(app.getHttpServer())
                .post('/api/tasks')
                .send({
                    localPath: 'test/test-input/test-image.jpg',
                })
                .expect(201);

            const taskId = createResponse.body.id;

            // Wait for task to be processed (this might take a few seconds)
            await new Promise((resolve) => setTimeout(resolve, 5000));

            // Get the task status
            const response = await request(app.getHttpServer())
                .get(`/api/tasks/${taskId}`)
                .expect(200);

            expect(response.body.status).toBe(TaskStatus.COMPLETED);
            expect(response.body.imagesCount).toBe(2);

            // Verify images were created
            const task = await taskModel.findById(taskId).populate('images');
            expect(task.images).toHaveLength(2);
            expect(task.images[0].resolution).toBe('1024');
            expect(task.images[1].resolution).toBe('800');

            // Verify image files exist
            const image1Path = path.join(testOutputDir, task.images[0].path);
            const image2Path = path.join(testOutputDir, task.images[1].path);
            expect(fs.existsSync(image1Path)).toBe(true);
            expect(fs.existsSync(image2Path)).toBe(true);
        }, 10000); // Increase timeout for this test

        it('should handle processing errors gracefully', async () => {
            // Create a task with an invalid image
            const invalidImagePath = path.join(testInputDir, 'invalid.jpg');
            fs.writeFileSync(invalidImagePath, 'not an image');

            const createResponse = await request(app.getHttpServer())
                .post('/api/tasks')
                .send({
                    localPath: 'test/test-input/invalid.jpg',
                })
                .expect(201);

            const taskId = createResponse.body.id;

            // Wait for task to be processed
            await new Promise((resolve) => setTimeout(resolve, 5000));

            // Get the task status
            const response = await request(app.getHttpServer())
                .get(`/api/tasks/${taskId}`)
                .expect(200);

            expect(response.body.status).toBe(TaskStatus.FAILED);
            expect(response.body.imagesCount).toBe(0);
        }, 10000); // Increase timeout for this test
    });
}); 