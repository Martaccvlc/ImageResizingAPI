import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

import { TasksProcessor } from '../../src/tasks/services/tasks.processor';
import { Task } from '../../src/tasks/entities/task.entity';
import { Image } from '../../src/tasks/entities/image.entity';
import { TaskStatus } from '../../src/utils/enums/tasks/task-status.enum';
import { taskProcessingErrorMessages } from '../../src/utils/constants/tasks/task-processing-messages.constants';

describe('TasksProcessor', () => {
    let processor: TasksProcessor;
    let testInputDir: string;
    let testOutputDir: string;

    const mockTaskModel = {
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
    };

    const mockImageModel = {
        create: jest.fn(),
    };

    const mockConfigService = {
        get: jest.fn(),
    };

    const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    };

    beforeAll(() => {
        testInputDir = path.join(__dirname, '../test-input');
        testOutputDir = path.join(__dirname, '../test-output');
        fs.mkdirSync(testInputDir, { recursive: true });
        fs.mkdirSync(testOutputDir, { recursive: true });

        // Create test directories for each resolution
        ['800', '1024'].forEach(resolution => {
            fs.mkdirSync(path.join(testOutputDir, resolution), { recursive: true });
        });
    });

    afterAll(() => {
        fs.rmSync(testInputDir, { recursive: true, force: true });
        fs.rmSync(testOutputDir, { recursive: true, force: true });
    });

    beforeEach(async () => {
        jest.clearAllMocks();

        mockConfigService.get.mockImplementation((key: string) => {
            switch (key) {
                case 'paths.output':
                    return testOutputDir;
                default:
                    return null;
            }
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TasksProcessor,
                {
                    provide: getModelToken(Task.name),
                    useValue: mockTaskModel,
                },
                {
                    provide: getModelToken(Image.name),
                    useValue: mockImageModel,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        processor = module.get<TasksProcessor>(TasksProcessor);
    });

    it('should be defined', () => {
        expect(processor).toBeDefined();
    });

    describe('processTask', () => {
        it('should process an image successfully', async () => {
            // Create a test image using sharp
            const testImagePath = path.join(testInputDir, 'test.jpg');
            await sharp({
                create: {
                    width: 100,
                    height: 100,
                    channels: 3,
                    background: { r: 255, g: 255, b: 255 }
                }
            })
            .jpeg()
            .toFile(testImagePath);

            const mockTask = {
                _id: 'test-id',
                originalPath: testImagePath,
                status: TaskStatus.PENDING,
            };

            mockTaskModel.findById.mockResolvedValue(mockTask);
            mockTaskModel.findByIdAndUpdate.mockResolvedValue(mockTask);

            await processor.processTask('test-id');

            expect(mockTaskModel.findById).toHaveBeenCalledWith('test-id');
            expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
                'test-id',
                expect.objectContaining({
                    status: TaskStatus.COMPLETED,
                    images: expect.any(Array)
                })
            );

            // Verify that images were created for each resolution
            const updateCall = mockTaskModel.findByIdAndUpdate.mock.calls[0][1];
            expect(updateCall.images).toHaveLength(2);
            expect(updateCall.images[0]).toHaveProperty('resolution');
            expect(updateCall.images[0]).toHaveProperty('path');
        });

        it('should handle non-existent task', async () => {
            mockTaskModel.findById.mockResolvedValue(null);
            mockTaskModel.findByIdAndUpdate.mockImplementation(() => {
                throw new Error('Task not found');
            });

            await expect(async () => {
                await processor.processTask('non-existent');
            }).rejects.toThrow('not found');

            expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
                'non-existent',
                expect.objectContaining({
                    status: TaskStatus.FAILED,
                    errorMessage: expect.stringContaining('not found')
                })
            );
        });

        it('should handle missing original file', async () => {
            const mockTask = {
                _id: 'test-id',
                originalPath: '/non/existent/path.jpg',
                status: TaskStatus.PENDING,
            };

            mockTaskModel.findById.mockResolvedValue(mockTask);
            mockTaskModel.findByIdAndUpdate.mockImplementation(() => {
                throw new Error(taskProcessingErrorMessages.FILE_NOT_FOUND);
            });

            await expect(async () => {
                await processor.processTask('test-id');
            }).rejects.toThrow(taskProcessingErrorMessages.FILE_NOT_FOUND);

            expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
                'test-id',
                expect.objectContaining({
                    status: TaskStatus.FAILED,
                    errorMessage: expect.stringContaining(taskProcessingErrorMessages.FILE_NOT_FOUND)
                })
            );
        });

        it('should handle image processing errors', async () => {
            // Create an invalid image file
            const testImagePath = path.join(testInputDir, 'invalid.jpg');
            fs.writeFileSync(testImagePath, 'invalid image data');

            const mockTask = {
                _id: 'test-id',
                originalPath: testImagePath,
                status: TaskStatus.PENDING,
            };

            mockTaskModel.findById.mockResolvedValue(mockTask);
            mockTaskModel.findByIdAndUpdate.mockImplementation(() => {
                throw new Error('Image processing failed');
            });

            await expect(async () => {
                await processor.processTask('test-id');
            }).rejects.toThrow();

            expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
                'test-id',
                expect.objectContaining({
                    status: TaskStatus.FAILED,
                    errorMessage: expect.any(String)
                })
            );
        });

        it('should process different image resolutions', async () => {
            // Create a test image using sharp with specific dimensions
            const testImagePath = path.join(testInputDir, 'test-large.jpg');
            await sharp({
                create: {
                    width: 2048,
                    height: 2048,
                    channels: 3,
                    background: { r: 255, g: 255, b: 255 }
                }
            })
            .jpeg()
            .toFile(testImagePath);

            const mockTask = {
                _id: 'test-id',
                originalPath: testImagePath,
                status: TaskStatus.PENDING,
            };

            mockTaskModel.findById.mockResolvedValue(mockTask);
            mockTaskModel.findByIdAndUpdate.mockResolvedValue(mockTask);

            await processor.processTask('test-id');

            const updateCall = mockTaskModel.findByIdAndUpdate.mock.calls[0][1];
            expect(updateCall.images).toHaveLength(2);

            // Verify each resolution
            const resolutions = updateCall.images.map(img => img.resolution);
            expect(resolutions).toContain('800');
            expect(resolutions).toContain('1024');
        });
    });
}); 