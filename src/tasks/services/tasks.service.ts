import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

import { Task } from '../entities/task.entity';
import { TaskStatus } from '../../utils/enums/tasks/task-status.enum';

import { Image } from '../entities/image.entity';
import { CreateTaskDto } from '../dto/create-task.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { downloadImage, ensureDirectoryExists } from '../../utils/files/file.utils';
import { TasksProcessor } from './tasks.processor';

@Injectable()
export class TasksService {
    constructor(
        @InjectModel(Task.name) private taskModel: Model<Task>,
        @InjectModel(Image.name) private imageModel: Model<Image>,
        private configService: ConfigService,
        private tasksProcessor: TasksProcessor,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    async create(createTaskDto: CreateTaskDto): Promise<TaskResponseDto> {
        try {
            // Check if URL or local path is provided
            if (!createTaskDto.url && !createTaskDto.localPath) {
                throw new Error('URL or local image path needed'); // TODO: Error messages should be moved to a constant file
            }

            this.logger.info('Creating a new processing task', {
                dto: createTaskDto,
            });

            // Generate a random price between 5 and 50
            const price = +(Math.random() * 45 + 5).toFixed(2);

            let originalPath: string;

            if (createTaskDto.url) {
                // In case of an URL download the image
                const inputDir =
                    this.configService.get<string>('paths.input') ??
                    '/tmp/input';
                ensureDirectoryExists(inputDir);

                const fileName = `${uuidv4()}${path.extname(createTaskDto.url)}`;
                originalPath = path.join(inputDir, fileName);

                this.logger.debug('Downloading image of URL', {
                    url: createTaskDto.url,
                    destination: originalPath,
                });
                await downloadImage(createTaskDto.url, originalPath);
            } else {
                // If it is a local pagth check whether it exists or not
                originalPath = createTaskDto.localPath ?? '.';
                if (!fs.existsSync(originalPath)) {
                    this.logger.error('File not found', { path: originalPath });
                    throw new Error(`File ${originalPath} does not exist`);
                }
            }

            // Create task in database
            const newTask = await this.taskModel.create({
                status: TaskStatus.PENDING,
                price,
                originalPath,
            });

            this.logger.info('Task created successfully', {
                taskId: newTask.id.toString(),
                price: newTask.price,
            });

            // Start image processing
            this.tasksProcessor
                .processTask(newTask.id.toString())
                .catch((error) => {
                    this.logger.error(`Error processing task ${newTask._id}`, {
                        error: error.message,
                        stack: error.stack,
                    });
                });

            // Return a response
            return {
                taskId: newTask.id.toString(),
                status: newTask.status,
                price: newTask.price,
            };
        } catch (error) {
            this.logger.error('Error creating task', {
                error: error.message,
                stack: error.stack,
                dto: createTaskDto,
            });
            throw error;
        }
    }

    async findOne(taskId: string): Promise<TaskResponseDto> {
        this.logger.debug('Searching for task', { taskId });

        if (!Types.ObjectId.isValid(taskId)) {
            this.logger.warn('Invalid Task ID', { taskId });
            throw new NotFoundException(`Invalid task ID: ${taskId}`);
        }

        const task = await this.taskModel.findById(taskId);

        if (!task) {
            this.logger.warn('Task not found', { taskId });
            throw new NotFoundException(`Task with ID ${taskId} not found`);
        }

        this.logger.debug('Tarea encontrada', {
            taskId,
            status: task.status,
            imagesCount: task.images?.length || 0,
        });

        const response: TaskResponseDto = {
            taskId: task.id.toString(),
            status: task.status,
            price: task.price,
        };

        // If task is process include images
        if (task.status === TaskStatus.COMPLETED) {
            response.images = task.images;
        }

        // If teh task failed include error message
        if (task.status === TaskStatus.FAILED) {
            response.errorMessage = task.errorMessage;
        }

        return response;
    }

    async updateTaskStatus(
        taskId: string,
        status: TaskStatus,
        images?: Array<{ resolution: string; path: string }>,
        errorMessage?: string,
    ): Promise<void> {
        this.logger.debug('Updating task status', {
            taskId,
            newStatus: status,
            imagesCount: images?.length || 0,
        });

        const updateData: any = { status };

        if (images) {
            updateData.images = images;
        }

        if (errorMessage) {
            updateData.errorMessage = errorMessage;
            this.logger.error('Failed task', { taskId, errorMessage });
        }

        await this.taskModel.findByIdAndUpdate(taskId, updateData);
        this.logger.info('Task updated', { taskId, status });
    }
}
