import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as sharp from 'sharp';
import { AppModule } from '../../src/app.module';
import { TaskStatus } from '../../src/utils/enums/tasks/task-status.enum';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, connect } from 'mongoose';

describe('Tasks API (e2e)', () => {
    let app: INestApplication;
    let mongod: MongoMemoryServer;
    let mongoConnection: Connection;
    let createdTaskId: string;
    let mockServer: http.Server;
    const testInputDir = './test-e2e-input';
    const testOutputDir = './test-e2e-output';
    const API_PREFIX = 'api';

    beforeAll(async () => {
        // Set up mock HTTP server
        mockServer = http.createServer((req, res) => {
            if (req.url === '/test.jpg') {
                // Create a valid JPEG image using sharp
                sharp({
                    create: {
                        width: 100,
                        height: 100,
                        channels: 3,
                        background: { r: 255, g: 255, b: 255 }
                    }
                })
                .jpeg()
                .toBuffer()
                .then(buffer => {
                    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
                    res.end(buffer);
                });
            } else {
                res.writeHead(404);
                res.end();
            }
        }).listen(3333);

        // Set up MongoDB in-memory server
        mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();

        process.env.DATABASE_URL = uri;

        // Create test directories
        if (!fs.existsSync(testInputDir)) {
            fs.mkdirSync(testInputDir, { recursive: true });
        }

        if (!fs.existsSync(testOutputDir)) {
            fs.mkdirSync(testOutputDir, { recursive: true });
        }

        // Create a valid test image
        await sharp({
            create: {
                width: 100,
                height: 100,
                channels: 3,
                background: { r: 255, g: 255, b: 255 }
            }
        })
        .jpeg()
        .toFile(path.join(testInputDir, 'test-image.jpg'));

        process.env.INPUT_PATH = testInputDir;
        process.env.OUTPUT_PATH = testOutputDir;

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix(API_PREFIX);
        await app.init();

        mongoConnection = (await connect(uri)).connection;
    });

    afterAll(async () => {
        await app.close();
        await mongoConnection.close();
        await mongod.stop();
        mockServer.close();

        if (fs.existsSync(testInputDir)) {
            fs.rmSync(testInputDir, { recursive: true, force: true });
        }

        if (fs.existsSync(testOutputDir)) {
            fs.rmSync(testOutputDir, { recursive: true, force: true });
        }
    });

    describe('/api/tasks (POST)', () => {
        it('should create a new task with local path', () => {
            return request(app.getHttpServer())
                .post('/api/tasks')
                .send({ localPath: path.join(testInputDir, 'test-image.jpg') })
                .expect(HttpStatus.CREATED)
                .expect((res) => {
                    expect(res.body).toHaveProperty('taskId');
                    expect(res.body.status).toBe(TaskStatus.PENDING);
                    expect(res.body.price).toBeGreaterThanOrEqual(5);
                    expect(res.body.price).toBeLessThanOrEqual(50);
                    createdTaskId = res.body.taskId;
                });
        });

        it('should return 400 when no URL or local path is provided', async () => {
                    const response = await request(app.getHttpServer())
                        .post('/api/tasks')
                        .send({})
                        .expect(400);
        
                    expect(response.body.message).toBe('URL or local image path needed.');
                });
    });

    describe('/api/tasks/:id (GET)', () => {
        it('should return task details when task exists', async () => {
            if (!createdTaskId) {
                console.warn('Skipping test because no task was created');
                return;
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));

            return request(app.getHttpServer())
                .get(`/api/tasks/${createdTaskId}`)
                .expect(HttpStatus.OK)
                .expect((res) => {
                    expect(res.body).toHaveProperty('taskId');
                    expect(res.body.taskId).toBe(createdTaskId);
                    expect([
                        TaskStatus.PENDING,
                        TaskStatus.COMPLETED,
                        TaskStatus.FAILED,
                    ]).toContain(res.body.status);
                });
        });

        it('should return 404 when task does not exist', () => {
            return request(app.getHttpServer())
                .get('/api/tasks/non-existent-id')
                .expect(HttpStatus.NOT_FOUND);
        });
    });

    describe('/api/tasks (POST) with URL', () => {
        it('should create a new task with URL', () => {
            return request(app.getHttpServer())
                .post('/api/tasks')
                .send({ url: 'http://localhost:3333/test.jpg' })
                .expect(HttpStatus.CREATED)
                .expect((res) => {
                    expect(res.body).toHaveProperty('taskId');
                    expect(res.body.status).toBe(TaskStatus.PENDING);
                    expect(res.body.price).toBeGreaterThanOrEqual(5);
                    expect(res.body.price).toBeLessThanOrEqual(50);
                });
        });

        it('should return 400 for invalid URL', () => {
            return request(app.getHttpServer())
                .post('/api/tasks')
                .send({ url: 'not-a-url' })
                .expect(HttpStatus.BAD_REQUEST);
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
