import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

import { TasksProcessor } from '../../../src/tasks/services/tasks.processor';
import { TaskStatus } from '../../../src/utils/enums/tasks/task-status.enum';
import { taskProcessingErrorMessages } from '../../../src/utils/constants/tasks/task-processing-messages.constants';
import { TestContext } from '../../types/test-context';
import { setupTestContext, cleanupTestContext } from '../../utils/common.utils';
import { setupTestDirectories, cleanupTestDirectories } from '../../utils/directories/test-directories.utils';
import { fileData } from '../../../src/utils/constants/files/files-details.constants';
import { createTestImage } from '../../utils/images/test-image.utils';

describe('TasksProcessor', () => {
    let context: TestContext;
    let processor: TasksProcessor;
    let inputDir: string;
    let outputDir: string;

    beforeAll(async () => {
        context = await setupTestContext();
        processor = context.tasksProcessor;
        const testDirs = setupTestDirectories();
        inputDir = testDirs.testInputDir;
        outputDir = testDirs.testOutputDir;
    });

    afterAll(async () => {
        await cleanupTestContext(context);
    });

    beforeEach(() => {
        cleanupTestDirectories();
        const testDirs = setupTestDirectories();
        inputDir = testDirs.testInputDir;
        outputDir = testDirs.testOutputDir;
        
        // Ensure input directory exists
        if (!fs.existsSync(inputDir)) {
            fs.mkdirSync(inputDir, { recursive: true });
        }
    });

    it('should be defined', () => {
        expect(processor).toBeDefined();
    });

    describe('processTask', () => {
        it('should process an image successfully', async () => {
            const testImagePath = path.join(inputDir, 'test.jpg');
            
            console.log('Test image path:', testImagePath);
            console.log('Input directory exists:', fs.existsSync(inputDir));
            console.log('Parent directory exists:', fs.existsSync(path.dirname(testImagePath)));
            
            // Create test image
            await createTestImage(testImagePath, {
                width: 1024,
                height: 1024,
                background: { r: 255, g: 255, b: 255 }
            });

            console.log('After createTestImage');
            console.log('Test image exists:', fs.existsSync(testImagePath));
            console.log('Input directory exists:', fs.existsSync(inputDir));
            console.log('Parent directory exists:', fs.existsSync(path.dirname(testImagePath)));

            // Ensure the test image exists
            expect(fs.existsSync(testImagePath)).toBe(true);

            // Create task with the test image
            const task = await context.taskModel.create({
                status: TaskStatus.PENDING,
                price: 25,
                originalPath: path.resolve(testImagePath),
            });

            // Process the task
            await processor.processTask(task.id);

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
                    exists: fs.existsSync(testImagePath)
                });
            }

            // Verify task status and images
            expect(processedTask.status).toBe(TaskStatus.COMPLETED);
            expect(processedTask.images).toHaveLength(fileData.FILE_RESOLUTION.length);

            // Verify each resolution
            const resolutions = processedTask.images.map(img => img.resolution);
            expect(resolutions).toContain('800');
            expect(resolutions).toContain('1024');

            // Verify that the resized images exist and have correct dimensions
            for (const image of processedTask.images) {
                const md5 = context.utils.calculateMD5(testImagePath);
                const baseName = path.basename(testImagePath, context.utils.getFileExtension(testImagePath));
                const fullPath = path.join(outputDir, baseName, image.resolution, `${md5}${context.utils.getFileExtension(testImagePath)}`);
                
                expect(fs.existsSync(fullPath)).toBe(true);
                const metadata = await sharp(fullPath).metadata();
                const expectedWidth = parseInt(image.resolution);
                expect(metadata.width).toBeLessThanOrEqual(expectedWidth);
                expect(metadata.format).toBe('jpeg');
            }
        });

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
                originalPath: path.resolve(nonExistentPath),
            });

            await processor.processTask(task.id);

            const processedTask = await context.taskModel.findById(task.id);
            if (!processedTask) {
                throw new Error('Task not found after processing');
            }

            expect(processedTask.status).toBe(TaskStatus.FAILED);
            expect(processedTask.errorMessage).toContain(taskProcessingErrorMessages.FILE_NOT_FOUND);
            expect(processedTask.images).toHaveLength(0);
        });

        it('should handle invalid image format', async () => {
            const invalidImagePath = path.join(inputDir, 'invalid.jpg');
            fs.writeFileSync(invalidImagePath, 'invalid image data');

            const task = await context.taskModel.create({
                status: TaskStatus.PENDING,
                price: 25,
                originalPath: path.resolve(invalidImagePath),
            });

            await processor.processTask(task.id);

            const processedTask = await context.taskModel.findById(task.id);
            if (!processedTask) {
                throw new Error('Task not found after processing');
            }

            expect(processedTask.status).toBe(TaskStatus.FAILED);
            expect(processedTask.errorMessage).toContain('Input file contains unsupported image format');
            expect(processedTask.images).toHaveLength(0);
        });

        it('should process different image resolutions', async () => {
            const testImagePath = path.join(inputDir, 'test-large.jpg');
            
            // Create test image
            await createTestImage(testImagePath, {
                width: 2048,
                height: 2048,
                background: { r: 255, g: 255, b: 255 }
            });

            // Ensure the test image exists
            expect(fs.existsSync(testImagePath)).toBe(true);

            const task = await context.taskModel.create({
                status: TaskStatus.PENDING,
                price: 25,
                originalPath: path.resolve(testImagePath),
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
                    exists: fs.existsSync(testImagePath)
                });
            }

            expect(processedTask.status).toBe(TaskStatus.COMPLETED);
            expect(processedTask.images).toHaveLength(fileData.FILE_RESOLUTION.length);

            // Verify each resolution
            const resolutions = processedTask.images.map(img => img.resolution);
            expect(resolutions).toContain('800');
            expect(resolutions).toContain('1024');

            // Verify image dimensions
            for (const image of processedTask.images) {
                // Get the actual path from the image info
                const fullPath = path.join(outputDir, image.path.replace('/output/', ''));
                
                // Ensure output directory exists
                const outputResolutionDir = path.dirname(fullPath);
                if (!fs.existsSync(outputResolutionDir)) {
                    fs.mkdirSync(outputResolutionDir, { recursive: true });
                }
                
                expect(fs.existsSync(fullPath)).toBe(true);
                const metadata = await sharp(fullPath).metadata();
                const expectedWidth = parseInt(image.resolution);
                expect(metadata.width).toBeLessThanOrEqual(expectedWidth);
            }
        });
    });
}); 