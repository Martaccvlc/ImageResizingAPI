import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, connect, createConnection } from 'mongoose';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as path from 'path';
import * as fs from 'fs';
import { format } from 'winston';
import * as sharp from 'sharp';

import { AppModule } from '../../src/app.module';
import { Task, TaskSchema } from '../../src/tasks/entities/task.entity';
import { Image, ImageSchema } from '../../src/tasks/entities/image.entity';
import { TaskStatus } from '../../src/utils/enums/tasks/task-status.enum';
import { taskResponseErrorMessages } from '../../src/utils/constants/tasks/task-messages.constants';
import { fileErrorResponseMessages } from '../../src/utils/constants/files/files-messages.constants';
import { createTestImage } from '../utils/images/test-image.utils';

describe('Tasks Integration Tests', () => {
    let app: INestApplication;
    let mongod: MongoMemoryServer;
    let mongoConnection: Connection;
    let taskModel: any;
    let imageModel: any;
    let testInputDir: string;
    let testOutputDir: string;
    let testImagePath: string;

    beforeAll(async () => {
        // Create test directories
        testInputDir = path.join(process.cwd(), 'test', 'test-input');
        testOutputDir = path.join(process.cwd(), 'test', 'test-output');
        fs.mkdirSync(testInputDir, { recursive: true });
        fs.mkdirSync(testOutputDir, { recursive: true });

        // Create test image
        testImagePath = path.join(testInputDir, 'test-image.jpg');
        await createTestImage(testImagePath, {
            width: 100,
            height: 100,
            background: { r: 255, g: 255, b: 255 }
        });


        // Verify the image was created
        if (!fs.existsSync(testImagePath)) {
            throw new Error('Failed to create test image');
        }

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
                            paths: {
                                input: testInputDir,
                                output: testOutputDir,
                            },
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
        app.setGlobalPrefix('api');
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
                    localPath: testImagePath,
                })
                .expect(201);

            expect(response.body).toHaveProperty('taskId');
            expect(response.body).toHaveProperty('status', TaskStatus.PENDING);
            expect(response.body).toHaveProperty('price');
            expect(response.body).toHaveProperty('images');

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

        it('should create a task with a URL', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/tasks')
                .send({
                    url: 'https://picsum.photos/800/600',
                })
                .expect(201);

            expect(response.body).toHaveProperty('taskId');
            expect(response.body).toHaveProperty('status', TaskStatus.PENDING);
            expect(response.body).toHaveProperty('price');
            expect(response.body).toHaveProperty('images');

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
                    localPath: testImagePath,
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
            await sharp({
                create: {
                    width: 100,
                    height: 100,
                    channels: 3,
                    background: { r: 255, g: 255, b: 255 }
                }
            })
            .jpeg()
            .toFile(sampleImagePath);

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