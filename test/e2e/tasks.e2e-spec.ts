import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../../src/app.module';
import { TaskStatus } from '../../src/tasks/entities/task.entity';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, connect } from 'mongoose';

describe('Tasks API (e2e)', () => {
    let app: INestApplication;
    let mongod: MongoMemoryServer;
    let mongoConnection: Connection;
    let createdTaskId: string;
    const testInputDir = './test-e2e-input';
    const testOutputDir = './test-e2e-output';
    const API_PREFIX = 'api'; // Match the prefix in main.ts

    beforeAll(async () => {
        // Set up MongoDB in-memory server
        mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();

        // Set the DATABASE_URL environment variable for the test
        process.env.DATABASE_URL = uri;

        // Create test directories and sample image
        if (!fs.existsSync(testInputDir)) {
            fs.mkdirSync(testInputDir, { recursive: true });
        }

        if (!fs.existsSync(testOutputDir)) {
            fs.mkdirSync(testOutputDir, { recursive: true });
        }

        // Create a sample test image
        const sampleImageBuffer = Buffer.alloc(1024, 0);
        fs.writeFileSync(
            path.join(testInputDir, 'test-image.jpg'),
            sampleImageBuffer,
        );

        // Set up environment variables for the test
        process.env.INPUT_PATH = testInputDir;
        process.env.OUTPUT_PATH = testOutputDir;

        // Create and initialize the NestJS app
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();

        // Important: Set the global prefix to match the main.ts configuration
        app.setGlobalPrefix(API_PREFIX);

        await app.init();

        // Connect to the in-memory MongoDB
        mongoConnection = (await connect(uri)).connection;
    });

    afterAll(async () => {
        await app.close();
        await mongoConnection.close();
        await mongod.stop();

        // Clean up test directories
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

                    // Store the task ID for future tests
                    createdTaskId = res.body.taskId;
                });
        });

        it('should return 500 when neither URL nor local path is provided', () => {
            return request(app.getHttpServer())
                .post('/api/tasks')
                .send({})
                .expect(HttpStatus.INTERNAL_SERVER_ERROR);
        });
    });

    describe('/api/tasks/:id (GET)', () => {
        it('should return task details when task exists', async () => {
            // Only run this test if we have a valid task ID from the previous test
            if (!createdTaskId) {
                console.warn('Skipping test because no task was created');
                return;
            }

            // Wait a bit to give time for task processing
            await new Promise((resolve) => setTimeout(resolve, 1000));

            return request(app.getHttpServer())
                .get(`/api/tasks/${createdTaskId}`)
                .expect(HttpStatus.OK)
                .expect((res) => {
                    expect(res.body).toHaveProperty('taskId');
                    expect(res.body.taskId).toBe(createdTaskId);
                    // Status might be PENDING, COMPLETED, or FAILED depending on processing
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
});
