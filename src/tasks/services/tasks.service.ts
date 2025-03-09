import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
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
import { taskResponseErrorMessages, taskInfoMessages } from '../../utils/constants/tasks/task-messages.constants';
import { fileErrorResponseMessages } from 'src/utils/constants/files/files-messages.constants';
import { taskProcessingErrorMessages } from 'src/utils/constants/tasks/task-processing-messages.constants';

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
                throw new Error(taskResponseErrorMessages.MISSING_PATH);
            }

            this.logger.info(taskInfoMessages.CREATING, {
                dto: createTaskDto,
            });

            // Generate a random price between 5 and 50
            const price = +(Math.random() * 45 + 5).toFixed(2);

            let originalPath: string;

            if (createTaskDto.url) {
                try {
                    // Validate URL format
                    new URL(createTaskDto.url);
                } catch (error) {
                    throw new BadRequestException(fileErrorResponseMessages.MALFORMED_URL);
                }
                // In case of an URL download the image
                const inputDir =
                    this.configService.get<string>('paths.input') ??
                    '/tmp/input';
                ensureDirectoryExists(inputDir);

                const fileName = `${uuidv4()}${path.extname(createTaskDto.url)}`;
                originalPath = path.join(inputDir, fileName);

                this.logger.debug(taskInfoMessages.DOWNLOADING_IMAGE, {
                    url: createTaskDto.url,
                    destination: originalPath,
                });
                await downloadImage(createTaskDto.url, originalPath);
            } else {
                originalPath = createTaskDto.localPath ?? '.';
                if (!fs.existsSync(originalPath)) {
                    const error = `${fileErrorResponseMessages.FILE_NOT_FOUND}: ${ originalPath }`;
                    this.logger.error(error);
                    throw new Error(error);
                }
            }

            // Create task in database
            const newTask = await this.taskModel.create({
                status: TaskStatus.PENDING,
                price,
                originalPath,
            });

            this.logger.info(taskInfoMessages.CREATED, {
                taskId: newTask.id.toString(),
                price: newTask.price,
            });

            // Start image processing
            this.tasksProcessor
                .processTask(newTask.id.toString())
                .catch((error) => {
                    this.logger.error(`${taskProcessingErrorMessages.PROCESSING_ERROR} ${newTask._id}`, {
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
            this.logger.error(taskResponseErrorMessages.ERROR_CREATING_TASK, {
                error: error.message,
                stack: error.stack,
                dto: createTaskDto,
            });
            throw error;
        }
    }

    async findOne(taskId: string): Promise<TaskResponseDto> {
        this.logger.debug(taskInfoMessages.SEARCHING_TASK, { taskId });

        if (!Types.ObjectId.isValid(taskId)) {
            this.logger.warn(taskResponseErrorMessages.INVALID_TASK_ID, { taskId });
            throw new NotFoundException(`${taskResponseErrorMessages.INVALID_TASK_ID}: ${taskId}`);
        }

        const task = await this.taskModel.findById(taskId);

        if (!task) {
            this.logger.warn(`${taskResponseErrorMessages.NOT_FOUND}, ${ taskId }`);
            throw new NotFoundException(`${taskResponseErrorMessages.NOT_FOUND}: ${taskId}`);
        }

        this.logger.debug(taskInfoMessages.FOUND, {
            taskId,
            status: task.status,
            imagesCount: task.images?.length || 0,
        });

        const response: TaskResponseDto = {
            taskId: task.id.toString(),
            status: task.status,
            price: task.price,
        };

        // If task is processed include images
        if (task.status === TaskStatus.COMPLETED) {
            response.images = task.images;
        }

        // If the task failed include error message
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
        this.logger.debug(taskInfoMessages.UPDATING_STATUS, {
            taskId,
            newStatus: status,
            imagesCount: images?.length || 0,
        });

        const updateData: any = { status };

        const task = await this.taskModel.findById(taskId);
        if (!task) {
            this.logger.warn(`${taskResponseErrorMessages.NOT_FOUND}, ${taskId}`);
            throw new NotFoundException(`${taskResponseErrorMessages.NOT_FOUND}: ${taskId}`);
        }

        if (status === TaskStatus.PENDING) {
            updateData.errorMessage = null;
            updateData.images = [];
        } else {
            if (images) {
                updateData.images = images;
            }

            if (errorMessage) {
                updateData.errorMessage = errorMessage;
                this.logger.error(`${taskResponseErrorMessages.FAILED_TASK} ${taskId}: ${errorMessage}`);
            }
        }

        await this.taskModel.findByIdAndUpdate(taskId, updateData);
        this.logger.info(taskInfoMessages.UPDATED_TASK, { taskId, status });
    }
}