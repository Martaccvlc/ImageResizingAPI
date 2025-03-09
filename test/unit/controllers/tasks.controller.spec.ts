import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, NotFoundException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

import { TasksController } from '../../src/tasks/controllers/tasks.controller';
import { TasksService } from '../../src/tasks/services/tasks.service';
import { CreateTaskDto } from '../../src/tasks/dto/create-task.dto';
import { TaskResponseDto } from '../../src/tasks/dto/task-response.dto';
import { TaskStatus } from '../../src/utils/enums/tasks/task-status.enum';
import { HttpExceptionFilter } from '../../src/core/filters/httpExceptions.filters';

describe('TasksController', () => {
    let controller: TasksController;

    const mockTasksService = {
        create: jest.fn(),
        findOne: jest.fn(),
    };

    const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [TasksController],
            providers: [
                {
                    provide: TasksService,
                    useValue: mockTasksService,
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: mockLogger,
                },
            ],
        })
            .overrideProvider(HttpExceptionFilter)
            .useValue({})
            .compile();

        controller = module.get<TasksController>(TasksController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('create', () => {
        it('should create a task', async () => {
            const createTaskDto: CreateTaskDto = {
                localPath: './test-image.jpg',
            };

            const expectedResponse: TaskResponseDto = {
                taskId: 'test-id',
                status: TaskStatus.PENDING,
                price: 25,
            };

            mockTasksService.create.mockResolvedValue(expectedResponse);

            const result = await controller.create(createTaskDto);

            expect(result).toEqual(expectedResponse);
            expect(mockTasksService.create).toHaveBeenCalledWith(createTaskDto);
        });
    });

    describe('findOne', () => {
        it('should return a task when it exists', async () => {
            const taskId = 'test-id';
            const expectedResponse: TaskResponseDto = {
                taskId,
                status: TaskStatus.COMPLETED,
                price: 25,
                images: [
                    {
                        resolution: '1024',
                        path: '/output/test-image/1024/md5.jpg',
                    },
                ],
            };

            mockTasksService.findOne.mockResolvedValue(expectedResponse);

            const result = await controller.findOne(taskId);

            expect(result).toEqual(expectedResponse);
            expect(mockTasksService.findOne).toHaveBeenCalledWith(taskId);
        });

        it('should throw NotFoundException when task does not exist', async () => {
            const taskId = 'non-existent-id';

            mockTasksService.findOne.mockResolvedValue(null);

            await expect(controller.findOne(taskId)).rejects.toThrow(
                NotFoundException,
            );
            expect(mockTasksService.findOne).toHaveBeenCalledWith(taskId);
        });
    });
});
