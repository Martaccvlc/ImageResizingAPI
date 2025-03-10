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
        try {
            // Setup test context first
            context = await setupTestContext();
            console.log('Test context setup completed');

            const { testInputDir: inputDir, testOutputDir: outputDir } = setupTestDirectories();
            testInputDir = inputDir;
            testOutputDir = outputDir;
            console.log('Test directories setup completed:', {
                inputDir,
                outputDir,
                inputExists: fs.existsSync(inputDir),
                outputExists: fs.existsSync(outputDir)
            });

            // Create test image
            const testImagePath = path.join(testInputDir, 'test-image.jpg');
            await createTestImage(testImagePath, {
                width: 2048,
                height: 2048,
                background: { r: 255, g: 255, b: 255 }
            });
            console.log('Initial test image created:', {
                path: testImagePath,
                exists: fs.existsSync(testImagePath),
                stats: fs.existsSync(testImagePath) ? fs.statSync(testImagePath) : null
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
            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Setup failed:', {
                error: error.message,
                stack: error.stack,
                phase: 'beforeAll',
                contextExists: !!context,
                inputDirExists: testInputDir ? fs.existsSync(testInputDir) : false,
                outputDirExists: testOutputDir ? fs.existsSync(testOutputDir) : false
            });
            throw error;
        }
    }, 30000);

    afterAll(async () => {
        try {
            if (app) {
                await app.close();
                console.log('Application closed successfully');
            }
            if (context) {
                await cleanupTestContext(context);
                console.log('Test context cleaned up successfully');
            }
        } catch (error) {
            console.error('Cleanup failed:', {
                error: error.message,
                stack: error.stack,
                phase: 'afterAll'
            });
            throw error;
        }
    });

    beforeEach(async () => {
        try {
            // Clear database before each test
            await context.taskModel.deleteMany({});
            await context.imageModel.deleteMany({});
            console.log('Database cleared');

            // Wait for any pending operations to complete
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Reset test directories
            const { testInputDir: inputDir, testOutputDir: outputDir } = setupTestDirectories();
            testInputDir = inputDir;
            testOutputDir = outputDir;

            // Ensure directories exist
            expect(fs.existsSync(inputDir)).toBe(true);
            expect(fs.existsSync(outputDir)).toBe(true);

            console.log('Test directories reset:', {
                inputDir,
                outputDir,
                inputExists: fs.existsSync(inputDir),
                outputExists: fs.existsSync(outputDir)
            });

            // Create test image with retries
            const testImagePath = path.join(testInputDir, 'test-image.jpg');
            let imageCreated = false;
            let attempts = 0;
            const maxAttempts = 3;

            while (!imageCreated && attempts < maxAttempts) {
                try {
                    await createTestImage(testImagePath, {
                        width: 2048,
                        height: 2048,
                        background: { r: 255, g: 255, b: 255 }
                    });

                    // Wait for file creation to complete
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    if (fs.existsSync(testImagePath)) {
                        const stats = fs.statSync(testImagePath);
                        if (stats.size > 0) {
                            imageCreated = true;
                            console.log('Test image created successfully:', {
                                path: testImagePath,
                                size: stats.size,
                                attempt: attempts + 1
                            });
                        }
                    }
                } catch (error) {
                    console.error(`Failed to create test image (attempt ${attempts + 1}):`, {
                        error: error.message,
                        path: testImagePath
                    });
                }
                attempts++;
                if (!imageCreated && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            if (!imageCreated) {
                throw new Error('Failed to create test image after multiple attempts');
            }

            // Wait for file system operations to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error('Test setup failed:', {
                error: error.message,
                stack: error.stack,
                phase: 'beforeEach',
                inputDirExists: testInputDir ? fs.existsSync(testInputDir) : false,
                outputDirExists: testOutputDir ? fs.existsSync(testOutputDir) : false
            });
            throw error;
        }
    });

    afterEach(async () => {
        try {
            // Wait for any pending operations to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log('Test cleanup completed');
        } catch (error) {
            console.error('Test cleanup failed:', {
                error: error.message,
                stack: error.stack,
                phase: 'afterEach'
            });
            throw error;
        }
    });

    describe('POST /api/tasks', () => {
        it('should create a task with a local image', async () => {
            try {
                const testImagePath = path.join(testInputDir, 'test-image.jpg');
                
                // Verify test image exists before proceeding
                expect(fs.existsSync(testImagePath)).toBe(true);
                const imageStats = fs.statSync(testImagePath);
                expect(imageStats.size).toBeGreaterThan(0);

                console.log('Creating task with image:', {
                    path: testImagePath,
                    size: imageStats.size
                });

                const response = await request(app.getHttpServer())
                    .post('/api/tasks')
                    .send({
                        localPath: testImagePath,
                    })
                    .expect(201);

                expect(response.body).toHaveProperty('taskId');
                expect(response.body).toHaveProperty('status', TaskStatus.PENDING);
                expect(response.body).toHaveProperty('price');

                const taskId = response.body.taskId;
                console.log('Task created:', {
                    taskId,
                    status: response.body.status
                });

                // Wait for task processing with retries
                let finalStatus;
                let attempts = 0;
                const maxAttempts = 15;
                const retryDelay = 1000;

                while (attempts < maxAttempts) {
                    const taskResponse = await request(app.getHttpServer())
                        .get(`/api/tasks/${taskId}`)
                        .expect(200);

                    finalStatus = taskResponse.body.status;
                    console.log(`Task status check (attempt ${attempts + 1}):`, {
                        taskId,
                        status: finalStatus,
                        imagesCount: taskResponse.body.images?.length || 0
                    });

                    if (finalStatus === TaskStatus.COMPLETED) {
                        // Verify the processed images
                        expect(taskResponse.body.images).toHaveLength(2);
                        
                        // Check each processed image
                        for (const image of taskResponse.body.images) {
                            const processedImagePath = path.join(testOutputDir, image.path.replace('/output/', ''));
                            console.log('Verifying processed image:', {
                                resolution: image.resolution,
                                path: processedImagePath,
                                exists: fs.existsSync(processedImagePath)
                            });

                            expect(fs.existsSync(processedImagePath)).toBe(true);
                            const processedImageStats = fs.statSync(processedImagePath);
                            expect(processedImageStats.size).toBeGreaterThan(0);
                        }
                        break;
                    } else if (finalStatus === TaskStatus.FAILED) {
                        console.error('Task processing failed:', {
                            taskId,
                            error: taskResponse.body.errorMessage,
                            attempt: attempts + 1
                        });
                        throw new Error(`Task processing failed: ${taskResponse.body.errorMessage}`);
                    }

                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    attempts++;
                }

                if (attempts >= maxAttempts) {
                    console.error('Task processing timeout:', {
                        taskId,
                        attempts,
                        lastStatus: finalStatus
                    });
                    throw new Error('Task processing timeout');
                }

                expect(finalStatus).toBe(TaskStatus.COMPLETED);
            } catch (error) {
                console.error('Test failure:', {
                    error: error.message,
                    stack: error.stack,
                    inputDirContents: fs.existsSync(testInputDir) ? fs.readdirSync(testInputDir) : null,
                    outputDirContents: fs.existsSync(testOutputDir) ? fs.readdirSync(testOutputDir) : null
                });
                throw error;
            }
        }, 30000);

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
            try {
                await createTestImage(sampleImagePath, {
                    width: 2048,
                    height: 2048,
                    background: { r: 255, g: 255, b: 255 }
                });

                // Verify image was created
                expect(fs.existsSync(sampleImagePath)).toBe(true);
                const stats = fs.statSync(sampleImagePath);
                console.log('Test image created successfully:', {
                    path: sampleImagePath,
                    size: stats.size,
                    mode: stats.mode.toString(8)
                });

                const createResponse = await request(app.getHttpServer())
                    .post('/api/tasks')
                    .send({ localPath: sampleImagePath })
                    .expect(HttpStatus.CREATED);

                const taskId = createResponse.body.taskId;
                expect(taskId).toBeDefined();
                console.log('Task created successfully:', {
                    taskId,
                    status: createResponse.body.status,
                    price: createResponse.body.price
                });

                let finalStatus;
                let attempts = 0;
                const maxAttempts = 15; // Increased max attempts
                const retryDelay = 1000; // 1 second delay between attempts

                while (attempts < maxAttempts) {
                    const response = await request(app.getHttpServer())
                        .get(`/api/tasks/${taskId}`)
                        .expect(HttpStatus.OK);

                    finalStatus = response.body.status;
                    console.log(`Task status check (attempt ${attempts + 1}):`, {
                        taskId,
                        status: finalStatus,
                        imagesCount: response.body.images?.length || 0
                    });
                    
                    if (finalStatus !== TaskStatus.PENDING) {
                        break;
                    }

                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    attempts++;
                }

                if (attempts >= maxAttempts) {
                    console.error('Task processing timeout:', {
                        taskId,
                        attempts,
                        lastStatus: finalStatus
                    });
                    throw new Error('Task processing timeout');
                }

                const finalResponse = await request(app.getHttpServer())
                    .get(`/api/tasks/${taskId}`)
                    .expect(HttpStatus.OK);

                // Log final task state
                console.log('Final task state:', {
                    taskId,
                    status: finalResponse.body.status,
                    imagesCount: finalResponse.body.images?.length || 0,
                    errorMessage: finalResponse.body.errorMessage
                });

                expect(finalResponse.body.status).toBe(TaskStatus.COMPLETED);
                expect(finalResponse.body.images).toBeDefined();
                expect(finalResponse.body.images).toHaveLength(2);
                
                // Verify each processed image
                for (const image of finalResponse.body.images) {
                    expect(image).toHaveProperty('resolution');
                    expect(image).toHaveProperty('path');
                    expect(['800', '1024']).toContain(image.resolution);

                    // Verify the processed image exists
                    const processedImagePath = path.join(testOutputDir, image.path.replace('/output/', ''));
                    const exists = fs.existsSync(processedImagePath);
                    console.log('Processed image verification:', {
                        resolution: image.resolution,
                        path: processedImagePath,
                        exists
                    });
                    expect(exists).toBe(true);
                }
            } catch (error) {
                console.error('Test failure:', {
                    error: error.message,
                    stack: error.stack,
                    testImageExists: fs.existsSync(sampleImagePath),
                    testImageStats: fs.existsSync(sampleImagePath) ? fs.statSync(sampleImagePath) : null,
                    testDirContents: fs.existsSync(testInputDir) ? fs.readdirSync(testInputDir) : null,
                    outputDirContents: fs.existsSync(testOutputDir) ? fs.readdirSync(testOutputDir) : null
                });
                throw error;
            }
        }, 30000); // Increased timeout

        it('should handle invalid image processing', async () => {
            const invalidImagePath = path.join(testInputDir, 'invalid.jpg');
            try {
                // Create an invalid image file
                fs.writeFileSync(invalidImagePath, 'invalid image data');
                expect(fs.existsSync(invalidImagePath)).toBe(true);
                console.log('Invalid test file created:', {
                    path: invalidImagePath,
                    size: fs.statSync(invalidImagePath).size
                });

                const createResponse = await request(app.getHttpServer())
                    .post('/api/tasks')
                    .send({ localPath: invalidImagePath })
                    .expect(HttpStatus.CREATED);

                const taskId = createResponse.body.taskId;
                console.log('Task created for invalid image:', {
                    taskId,
                    status: createResponse.body.status
                });

                let finalStatus;
                let attempts = 0;
                const maxAttempts = 15;
                const retryDelay = 1000;

                while (attempts < maxAttempts) {
                    const response = await request(app.getHttpServer())
                        .get(`/api/tasks/${taskId}`)
                        .expect(HttpStatus.OK);

                    finalStatus = response.body.status;
                    console.log(`Invalid image task status check (attempt ${attempts + 1}):`, {
                        taskId,
                        status: finalStatus,
                        errorMessage: response.body.errorMessage
                    });
                    
                    if (finalStatus !== TaskStatus.PENDING) {
                        break;
                    }

                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    attempts++;
                }

                if (attempts >= maxAttempts) {
                    console.error('Invalid image task processing timeout:', {
                        taskId,
                        attempts,
                        lastStatus: finalStatus
                    });
                    throw new Error('Task processing timeout');
                }

                const finalResponse = await request(app.getHttpServer())
                    .get(`/api/tasks/${taskId}`)
                    .expect(HttpStatus.OK);

                console.log('Final invalid image task state:', {
                    taskId,
                    status: finalResponse.body.status,
                    errorMessage: finalResponse.body.errorMessage
                });

                expect(finalResponse.body.status).toBe(TaskStatus.FAILED);
                expect(finalResponse.body.errorMessage).toBeDefined();
            } catch (error) {
                console.error('Invalid image test failure:', {
                    error: error.message,
                    stack: error.stack,
                    invalidFileExists: fs.existsSync(invalidImagePath),
                    invalidFileStats: fs.existsSync(invalidImagePath) ? fs.statSync(invalidImagePath) : null,
                    testDirContents: fs.existsSync(testInputDir) ? fs.readdirSync(testInputDir) : null
                });
                throw error;
            }
        }, 30000); // Increased timeout
    });
}); 