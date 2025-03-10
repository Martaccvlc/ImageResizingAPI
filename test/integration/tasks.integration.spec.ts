import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as path from 'path';
import * as fs from 'fs';
import { MongooseModule } from '@nestjs/mongoose';
import { setupTestContext, cleanupTestContext } from '../utils/common.utils';
import { setupTestDirectories } from '../utils/directories/test-directories.utils';
import { createTestImage } from '../utils/images/test-image.utils';
import * as Transport from 'winston-transport';
import { TestContext } from '../types/test-context';

import { AppModule } from '../../src/app.module';
import { TaskStatus } from '../../src/utils/enums/tasks/task-status.enum';
import { taskResponseErrorMessages } from '../../src/utils/constants/tasks/task-messages.constants';
import { fileErrorResponseMessages } from '../../src/utils/constants/files/files-messages.constants';

// Create a null transport that does nothing
class NullTransport extends Transport {
    log(info: any, callback: () => void) {
        callback();
    }
}

describe('Tasks Integration Tests', () => {
    let app: INestApplication;
    let context: TestContext;
    let testInputDir: string;
    let testOutputDir: string;

    beforeAll(async () => {
        // Setup test context first
        context = await setupTestContext();
        const { testInputDir: inputDir, testOutputDir: outputDir } = setupTestDirectories();
        testInputDir = inputDir;
        testOutputDir = outputDir;

        // Create test image
        const testImagePath = path.join(testInputDir, 'test-image.jpg');
        await createTestImage(testImagePath, {
            width: 2048,
            height: 2048,
            background: { r: 255, g: 255, b: 255 }
        });

        // Create testing module
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    load: [
                        () => ({
                            mongodb: {
                                uri: context.mongod.getUri(),
                            },
                            paths: {
                                input: testInputDir,
                                output: testOutputDir,
                            },
                        }),
                    ],
                }),
                MongooseModule.forRoot(context.mongod.getUri()),
                WinstonModule.forRoot({
                    transports: [
                        new NullTransport({
                            level: 'error',
                            handleExceptions: true
                        })
                    ],
                    exitOnError: false
                }),
                AppModule,
            ],
        }).compile();

        // Create app instance
        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix('api');
        await app.init();
    }, 30000);

    afterAll(async () => {
        if (app) {
            await app.close();
        }
        if (context) {
            await cleanupTestContext(context);
        }
    });

    beforeEach(async () => {
        // Clear database before each test
        await context.taskModel.deleteMany({});
        await context.imageModel.deleteMany({});

        // Wait for any pending operations to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Reset test directories
        const { testInputDir: inputDir, testOutputDir: outputDir } = setupTestDirectories();
        testInputDir = inputDir;
        testOutputDir = outputDir;

        // Recreate test image
        const testImagePath = path.join(testInputDir, 'test-image.jpg');
        await createTestImage(testImagePath, {
            width: 2048,
            height: 2048,
            background: { r: 255, g: 255, b: 255 }
        });

        // Wait for file system operations to complete
        await new Promise(resolve => setTimeout(resolve, 500));
    });

    afterEach(async () => {
        // Wait for any pending operations to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    describe('POST /api/tasks', () => {
        it('should create a task with a local image', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/tasks')
                .send({
                    localPath: path.join(testInputDir, 'test-image.jpg'),
                })
                .expect(201);

            expect(response.body).toHaveProperty('taskId');
            expect(response.body).toHaveProperty('status', TaskStatus.PENDING);
            expect(response.body).toHaveProperty('price');

            // Wait for task processing to complete
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Get the task again to check its status
            const taskResponse = await request(app.getHttpServer())
                .get(`/api/tasks/${response.body.taskId}`)
                .expect(200);

            expect(taskResponse.body).toHaveProperty('status', TaskStatus.COMPLETED);
            expect(taskResponse.body).toHaveProperty('images');
            expect(taskResponse.body.images).toHaveLength(2);
        }, 10000);

        it('should return 400 when no URL or local path is provided', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/tasks')
                .send({})
                .expect(400);

            expect(response.body.message).toBe('URL or local image path needed.');
        });

        it('should return 404 when local file is not found', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/tasks')
                .send({
                    localPath: path.join(testInputDir, 'non-existent.jpg'),
                })
                .expect(404);

            expect(response.body.message).toBe(`${fileErrorResponseMessages.FILE_NOT_FOUND}: ${path.join(testInputDir, 'non-existent.jpg')}`);
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
                    localPath: path.join(testInputDir, 'test-image.jpg'),
                })
                .expect(201);

            const taskId = createResponse.body.taskId;

            // Get the task
            const response = await request(app.getHttpServer())
                .get(`/api/tasks/${taskId}`)
                .expect(200);

            expect(response.body).toBeDefined();
            expect(response.body.taskId).toBe(taskId);
            expect(response.body.status).toBe(TaskStatus.PENDING);
            expect(response.body.price).toBeDefined();
        });

        it('should return 404 when task is not found', async () => {
            const nonExistentId = '507f1f77bcf86cd799439011';

            const response = await request(app.getHttpServer())
                .get(`/api/tasks/${nonExistentId}`)
                .expect(404);

            expect(response.body.message).toBe(`${taskResponseErrorMessages.NOT_FOUND}: ${nonExistentId}`);
        });
    });

    describe('Task Processing Flow', () => {
        it('should complete the full task processing flow', async () => {
            // Create a valid test image
            const sampleImagePath = path.join(testInputDir, 'flow-test.jpg');
            await createTestImage(sampleImagePath, {
                width: 2048,
                height: 2048,
                background: { r: 255, g: 255, b: 255 }
            });

            const createResponse = await request(app.getHttpServer())
                .post('/api/tasks')
                .send({ localPath: sampleImagePath })
                .expect(HttpStatus.CREATED);

            const taskId = createResponse.body.taskId;
            expect(taskId).toBeDefined();

            let finalStatus;
            let attempts = 0;
            const maxAttempts = 10;

            while (attempts < maxAttempts) {
                const response = await request(app.getHttpServer())
                    .get(`/api/tasks/${taskId}`)
                    .expect(HttpStatus.OK);

                finalStatus = response.body.status;
                
                if (finalStatus !== TaskStatus.PENDING) {
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }

            const finalResponse = await request(app.getHttpServer())
                .get(`/api/tasks/${taskId}`)
                .expect(HttpStatus.OK);

            expect(finalResponse.body.status).toBe(TaskStatus.COMPLETED);
            expect(finalResponse.body.images).toBeDefined();
            expect(finalResponse.body.images).toHaveLength(2);
            
            finalResponse.body.images.forEach((image) => {
                expect(image).toHaveProperty('resolution');
                expect(image).toHaveProperty('path');
                expect(['800', '1024']).toContain(image.resolution);
            });
        });

        it('should handle invalid image processing', async () => {
            const invalidImagePath = path.join(testInputDir, 'invalid.jpg');
            fs.writeFileSync(invalidImagePath, 'invalid image data');

            const createResponse = await request(app.getHttpServer())
                .post('/api/tasks')
                .send({ localPath: invalidImagePath })
                .expect(HttpStatus.CREATED);

            const taskId = createResponse.body.taskId;

            let finalStatus;
            let attempts = 0;
            const maxAttempts = 10;

            while (attempts < maxAttempts) {
                const response = await request(app.getHttpServer())
                    .get(`/api/tasks/${taskId}`)
                    .expect(HttpStatus.OK);

                finalStatus = response.body.status;
                
                if (finalStatus !== TaskStatus.PENDING) {
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }

            const finalResponse = await request(app.getHttpServer())
                .get(`/api/tasks/${taskId}`)
                .expect(HttpStatus.OK);

            expect(finalResponse.body.status).toBe(TaskStatus.FAILED);
            expect(finalResponse.body.errorMessage).toBeDefined();
        });
    });
}); 