import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

import { TasksProcessor } from '../../../src/tasks/services/tasks.processor';
import { TaskStatus } from '../../../src/utils/enums/tasks/task-status.enum';
import { taskProcessingErrorMessages } from '../../../src/utils/constants/tasks/task-processing-messages.constants';
import { TestContext } from '../../types/test-context';
import { setupTestContext, cleanupTestContext } from '../../utils/common.utils';
import { setupTestDirectories } from '../../utils/directories/test-directories.utils';
import { fileData } from '../../../src/utils/constants/files/files-details.constants';
import { createTestImage } from '../../utils/images/test-image.utils';

describe('TasksProcessor', () => {
    let context: TestContext;
    let processor: TasksProcessor;
    let inputDir: string;
    let outputDir: string;

    beforeAll(async () => {
        try {
            context = await setupTestContext();
            processor = context.tasksProcessor;
            const testDirs = setupTestDirectories();
            inputDir = testDirs.testInputDir;
            outputDir = testDirs.testOutputDir;

            // Ensure directories exist
            expect(fs.existsSync(inputDir)).toBe(true);
            expect(fs.existsSync(outputDir)).toBe(true);

            console.log('Test setup completed:', {
                inputDir,
                outputDir,
                inputExists: fs.existsSync(inputDir),
                outputExists: fs.existsSync(outputDir),
            });
        } catch (error) {
            console.error('beforeAll setup failed:', {
                error: error.message,
                stack: error.stack,
                inputDir,
                outputDir,
            });
            throw error;
        }
    });

    afterAll(async () => {
        try {
            await cleanupTestContext(context);
            console.log('Test cleanup completed');
        } catch (error) {
            console.error('afterAll cleanup failed:', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    });

    beforeEach(async () => {
        try {
            const testDirs = setupTestDirectories();
            inputDir = testDirs.testInputDir;
            outputDir = testDirs.testOutputDir;

            // Ensure directories exist
            expect(fs.existsSync(inputDir)).toBe(true);
            expect(fs.existsSync(outputDir)).toBe(true);

            // Wait for directory setup to complete
            await new Promise((resolve) => setTimeout(resolve, 1000));

            console.log('Test directories setup:', {
                inputDir,
                outputDir,
                inputExists: fs.existsSync(inputDir),
                outputExists: fs.existsSync(outputDir),
            });
        } catch (error) {
            console.error('beforeEach setup failed:', {
                error: error.message,
                stack: error.stack,
                inputDir,
                outputDir,
            });
            throw error;
        }
    });

    afterEach(async () => {
        try {
            // Wait for any pending operations to complete
            await new Promise((resolve) => setTimeout(resolve, 2000));
            console.log('Test cleanup completed');
        } catch (error) {
            console.error('afterEach cleanup failed:', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    });

    it('should be defined', () => {
        expect(processor).toBeDefined();
    });

    describe('processTask', () => {
        it('should process an image successfully', async () => {
            const testImagePath = path.join(inputDir, 'test.jpg');

            try {
                console.log('Starting image processing test:', {
                    testImagePath,
                    inputDirExists: fs.existsSync(inputDir),
                    parentDirExists: fs.existsSync(path.dirname(testImagePath)),
                });

                // Create test image with retries
                let imageCreated = false;
                let attempts = 0;
                const maxAttempts = 3;

                while (!imageCreated && attempts < maxAttempts) {
                    try {
                        await createTestImage(testImagePath, {
                            width: 2048,
                            height: 2048,
                            background: { r: 255, g: 255, b: 255 },
                        });

                        // Wait for file creation to complete
                        await new Promise((resolve) =>
                            setTimeout(resolve, 1000),
                        );

                        if (fs.existsSync(testImagePath)) {
                            imageCreated = true;
                            console.log('Test image created successfully:', {
                                path: testImagePath,
                                size: fs.statSync(testImagePath).size,
                                attempt: attempts + 1,
                            });
                        }
                    } catch (error) {
                        console.error(
                            `Failed to create test image (attempt ${attempts + 1}):`,
                            {
                                error: error.message,
                                path: testImagePath,
                            },
                        );
                        attempts++;
                        if (attempts < maxAttempts) {
                            await new Promise((resolve) =>
                                setTimeout(resolve, 1000),
                            );
                        }
                    }
                }

                if (!imageCreated) {
                    throw new Error(
                        'Failed to create test image after multiple attempts',
                    );
                }

                // Ensure the test image exists
                expect(fs.existsSync(testImagePath)).toBe(true);
                const imageStats = fs.statSync(testImagePath);
                expect(imageStats.size).toBeGreaterThan(0);

                // Create task with the test image
                const task = await context.taskModel.create({
                    status: TaskStatus.PENDING,
                    price: 25,
                    originalPath: testImagePath,
                });

                console.log('Task created:', {
                    taskId: task.id,
                    status: task.status,
                    originalPath: task.originalPath,
                });

                // Process the task
                await processor.processTask(task.id);

                // Wait for processing to complete with increased timeout
                await new Promise((resolve) => setTimeout(resolve, 2000));

                // Verify the task was processed
                const processedTask = await context.taskModel.findById(task.id);
                if (!processedTask) {
                    throw new Error('Task not found after processing');
                }

                if (processedTask.status === TaskStatus.FAILED) {
                    console.error('Task processing failed:', {
                        errorMessage: processedTask.errorMessage,
                        taskId: task.id,
                        originalPath: testImagePath,
                        exists: fs.existsSync(testImagePath),
                        stats: fs.existsSync(testImagePath)
                            ? fs.statSync(testImagePath)
                            : null,
                        outputDirContents: fs.existsSync(outputDir)
                            ? fs.readdirSync(outputDir)
                            : null,
                    });
                    throw new Error(
                        `Task processing failed: ${processedTask.errorMessage}`,
                    );
                }

                // Verify task status and images
                expect(processedTask.status).toBe(TaskStatus.COMPLETED);
                expect(processedTask.images).toHaveLength(
                    fileData.FILE_RESOLUTION.length,
                );

                // Verify each processed image
                for (const image of processedTask.images) {
                    expect(image.resolution).toBeDefined();
                    expect(image.path).toBeDefined();
                    expect(fileData.FILE_RESOLUTION).toContain(
                        image.resolution,
                    );

                    const processedImagePath = path.join(
                        outputDir,
                        image.path.replace('/output/', ''),
                    );
                    console.log('Verifying processed image:', {
                        resolution: image.resolution,
                        path: processedImagePath,
                        exists: fs.existsSync(processedImagePath),
                    });

                    expect(fs.existsSync(processedImagePath)).toBe(true);
                    const processedImageStats = fs.statSync(processedImagePath);
                    expect(processedImageStats.size).toBeGreaterThan(0);
                }
            } catch (error) {
                console.error('Test failure:', {
                    error: error.message,
                    stack: error.stack,
                    testImageExists: fs.existsSync(testImagePath),
                    testImageStats: fs.existsSync(testImagePath)
                        ? fs.statSync(testImagePath)
                        : null,
                    inputDirContents: fs.existsSync(inputDir)
                        ? fs.readdirSync(inputDir)
                        : null,
                    outputDirContents: fs.existsSync(outputDir)
                        ? fs.readdirSync(outputDir)
                        : null,
                });
                throw error;
            }
        }, 30000);

        it('should handle non-existent task', async () => {
            const nonExistentId = context.utils.generateObjectId();
            await processor.processTask(nonExistentId);

            const task = await context.taskModel.findById(nonExistentId);
            expect(task).toBeNull();
        });

        it('should handle missing original file', async () => {
            const nonExistentPath = path.join(inputDir, 'non-existent.jpg');

            const task = await context.taskModel.create({
                status: TaskStatus.PENDING,
                price: 25,
                originalPath: nonExistentPath,
            });

            await processor.processTask(task.id);

            const processedTask = await context.taskModel.findById(task.id);
            if (!processedTask) {
                throw new Error('Task not found after processing');
            }

            expect(processedTask.status).toBe(TaskStatus.FAILED);
            expect(processedTask.errorMessage).toContain(
                taskProcessingErrorMessages.FILE_NOT_FOUND,
            );
            expect(processedTask.images).toHaveLength(0);
        });

        it('should handle invalid image format', async () => {
            const invalidImagePath = path.join(inputDir, 'invalid.jpg');
            fs.writeFileSync(invalidImagePath, 'invalid image data');

            const task = await context.taskModel.create({
                status: TaskStatus.PENDING,
                price: 25,
                originalPath: invalidImagePath,
            });

            await processor.processTask(task.id);

            const processedTask = await context.taskModel.findById(task.id);
            if (!processedTask) {
                throw new Error('Task not found after processing');
            }

            expect(processedTask.status).toBe(TaskStatus.FAILED);
            expect(processedTask.errorMessage).toContain(
                'Input file contains unsupported image format',
            );
            expect(processedTask.images).toHaveLength(0);
        });

        it('should process different image resolutions', async () => {
            const testImagePath = path.join(inputDir, 'test-large.jpg');

            // Create test image
            await createTestImage(testImagePath, {
                width: 2048,
                height: 2048,
                background: { r: 255, g: 255, b: 255 },
            });

            // Ensure the test image exists
            expect(fs.existsSync(testImagePath)).toBe(true);

            const task = await context.taskModel.create({
                status: TaskStatus.PENDING,
                price: 25,
                originalPath: testImagePath,
            });

            await processor.processTask(task.id);

            const processedTask = await context.taskModel.findById(task.id);
            if (!processedTask) {
                throw new Error('Task not found after processing');
            }

            if (processedTask.status === TaskStatus.FAILED) {
                console.error('Task processing failed:', {
                    errorMessage: processedTask.errorMessage,
                    taskId: task.id,
                    originalPath: testImagePath,
                    exists: fs.existsSync(testImagePath),
                });
            }

            expect(processedTask.status).toBe(TaskStatus.COMPLETED);
            expect(processedTask.images).toHaveLength(
                fileData.FILE_RESOLUTION.length,
            );

            // Verify each resolution
            const resolutions = processedTask.images.map(
                (img) => img.resolution,
            );
            expect(resolutions).toContain('800');
            expect(resolutions).toContain('1024');

            // Verify image dimensions
            for (const image of processedTask.images) {
                const fullPath = path.join(
                    outputDir,
                    image.path.replace('/output/', ''),
                );

                expect(fs.existsSync(fullPath)).toBe(true);
                const metadata = await sharp(fullPath).metadata();
                const expectedWidth = parseInt(image.resolution);
                expect(metadata.width).toBeLessThanOrEqual(expectedWidth);
            }
        });
    });
});
