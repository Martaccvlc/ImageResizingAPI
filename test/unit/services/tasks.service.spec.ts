import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

import { TaskStatus } from '../../../src/utils/enums/tasks/task-status.enum';
import { fileErrorResponseMessages } from '../../../src/utils/constants/files/files-messages.constants';
import { taskResponseErrorMessages } from '../../../src/utils/constants/tasks/task-messages.constants';
import { TestContext } from '../../types/test-context';
import { setupTestContext, cleanupTestContext } from '../../utils/common.utils';
import { setupTestDirectories, cleanupTestDirectories } from '../../utils/directories/test-directories.utils';
import { createTestImage } from '../../utils/images/test-image.utils';

// Mock the file utils module
jest.mock('../../../src/utils/files/file.utils', () => ({
    calculateMD5: jest.fn().mockReturnValue('test-md5'),
    getFileExtension: jest.fn().mockReturnValue('.jpg'),
    downloadImage: jest.fn().mockImplementation((url: string, outputPath: string) => {
        if (url === 'https://example.com/image.jpg') {
            fs.writeFileSync(outputPath, 'test data');
            return outputPath;
        }
        throw new Error(taskResponseErrorMessages.ERROR_CREATING_TASK);
    }),
    ensureDirectoryExists: jest.fn(),
}));

describe('TasksService', () => {
    let context: TestContext;
    let inputDir: string;
    let outputDir: string;

    beforeAll(async () => {
        context = await setupTestContext();
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
    });

    describe('create', () => {
        it('should create a task with a local path', async () => {
            const testImagePath = path.join(inputDir, 'test-image.jpg');
            await createTestImage(testImagePath, {
                width: 100,
                height: 100,
                background: { r: 255, g: 255, b: 255 }
            });

            const createTaskDto = {
                localPath: testImagePath,
            };

            const result = await context.service.create(createTaskDto);

            expect(result).toBeDefined();
            expect(result.taskId).toBeDefined();
            expect(result.status).toBe(TaskStatus.PENDING);
        });

        it('should throw an error when neither URL nor local path is provided', async () => {
            const createTaskDto = {};

            await expect(context.service.create(createTaskDto)).rejects.toThrow(
                taskResponseErrorMessages.MISSING_PATH,
            );
        });

        it('should create a task with a URL', async () => {
            const createTaskDto = {
                url: 'https://example.com/image.jpg',
            };

            const result = await context.service.create(createTaskDto);

            expect(result).toBeDefined();
            expect(result.taskId).toBeDefined();
            expect(result.status).toBe(TaskStatus.PENDING);
        });

        it('should throw an error when local file does not exist', async () => {
            const createTaskDto = {
                localPath: path.join(inputDir, 'non-existent.jpg'),
            };

            await expect(context.service.create(createTaskDto)).rejects.toThrow(
                fileErrorResponseMessages.FILE_NOT_FOUND,
            );
        });

        it('should throw an error when URL download fails', async () => {
            const createTaskDto = {
                url: 'https://non-existent-domain.com/image.jpg',
            };

            await expect(context.service.create(createTaskDto)).rejects.toThrow(
                taskResponseErrorMessages.ERROR_CREATING_TASK,
            );
        });
    });

    describe('findOne', () => {
        it('should find a task by id', async () => {
            const testImagePath = path.join(inputDir, 'test-image.jpg');
            await createTestImage(testImagePath, {
                width: 100,
                height: 100,
                background: { r: 255, g: 255, b: 255 }
            });

            const createTaskDto = {
                localPath: testImagePath,
            };

            const createdTask = await context.service.create(createTaskDto);
            const result = await context.service.findOne(createdTask.taskId);

            expect(result.taskId).toBe(createdTask.taskId);
            expect(result.status).toBe(TaskStatus.PENDING);
        });

        it('should throw NotFoundException when task is not found', async () => {
            const nonExistentId = context.utils.generateObjectId();
            await expect(context.service.findOne(nonExistentId)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw NotFoundException when invalid ObjectId is provided', async () => {
            await expect(context.service.findOne('invalid-id')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('updateTaskStatus', () => {
        it('should update task status to PENDING', async () => {
            // Create a test file
            const testImagePath = path.join(inputDir, 'test-image.jpg');
            await createTestImage(testImagePath, {
                width: 100,
                height: 100,
                background: { r: 255, g: 255, b: 255 }
            });

            // Create a task with FAILED status
            const createTaskDto = {
                localPath: testImagePath,
            };

            const createdTask = await context.service.create(createTaskDto);
            await context.taskModel.findByIdAndUpdate(createdTask.taskId, {
                status: TaskStatus.FAILED,
                errorMessage: 'Previous error',
            });

            // Update status to PENDING
            await context.service.updateTaskStatus(createdTask.taskId, TaskStatus.PENDING);

            // Verify the update
            const updatedTask = await context.taskModel.findById(createdTask.taskId);
            if (!updatedTask) {
                throw new Error('Task not found after update');
            }

            expect(updatedTask.status).toBe(TaskStatus.PENDING);
            expect(updatedTask.errorMessage).toBeNull();
        });

        it('should throw NotFoundException when task is not found', async () => {
            const nonExistentId = context.utils.generateObjectId();
            await expect(
                context.service.updateTaskStatus(nonExistentId, TaskStatus.PENDING),
            ).rejects.toThrow(NotFoundException);
        });
    });
});
