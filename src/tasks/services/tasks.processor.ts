import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

import { Task } from '../entities/task.entity';
import { ImageInfo } from '../../types/tasks/image-info';
import { TaskStatus } from '../../utils/enums/tasks/task-status.enum';
import { Image } from '../entities/image.entity';
import {
    calculateMD5,
    getFileExtension,
    ensureDirectoryExists,
} from '../../utils/files/file.utils';
import { taskResponseErrorMessages } from '../../utils/constants/tasks/task-messages.constants';
import { taskProcessingInfoMessages, taskProcessingErrorMessages } from '../../utils/constants/tasks/task-processing-messages.constants';
import { fileData } from '../../utils/constants/files/files-details.constants';

@Injectable()
export class TasksProcessor {
    private readonly resolutions = fileData.FILE_RESOLUTION;

    constructor(
        @InjectModel(Task.name) private taskModel: Model<Task>,
        @InjectModel(Image.name) private imageModel: Model<Image>,
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    async processTask(taskId: string): Promise<void> {
        this.logger.info(`${ taskProcessingInfoMessages.STARTING_TASK }${ taskId }`);

        try {
            // Get task
            const task = await this.taskModel.findById(taskId);
            if (!task) {
                throw new Error(`${taskResponseErrorMessages.NOT_FOUND}: ${taskId}`);
            }

            // Get original image
            const originalPath = task.originalPath;
            if (!fs.existsSync(originalPath)) {
                throw new Error(`${taskProcessingErrorMessages.FILE_NOT_FOUND} ${originalPath}`);
            }

            this.logger.debug(taskProcessingInfoMessages.PROCESSING_IMAGE, {
                taskId,
                originalPath,
                resolutions: this.resolutions,
            });

            // Process images
            const processedImages: ImageInfo[] = [];

            for (const resolution of this.resolutions) {
                try {
                    // Process image
                    this.logger.debug(taskProcessingInfoMessages.PROCESSING_RESOLUTION, {
                        taskId,
                        resolution,
                    });
                    const imageInfo = await this.processImage(
                        task,
                        originalPath,
                        resolution,
                    );
                    processedImages.push(imageInfo);
                    this.logger.debug(taskProcessingInfoMessages.PROCESSED_RESOLITION, {
                        taskId,
                        resolution,
                        path: imageInfo.path,
                    });
                } catch (error) {
                    this.logger.error(
                        `${taskProcessingErrorMessages.FAILED_PROCESSING_WITH_RES} ${resolution}`,
                        {
                            taskId,
                            error: error.message,
                            stack: error.stack,
                        },
                    );
                    throw error;
                }
            }

            // Update task status when completed
            await this.taskModel.findByIdAndUpdate(taskId, {
                status: TaskStatus.COMPLETED,
                images: processedImages,
            });

            this.logger.info(taskProcessingInfoMessages.COMPLETED, {
                taskId,
                imagesCount: processedImages.length,
            });
        } catch (error) {
            this.logger.error(`${taskProcessingErrorMessages.PROCESSING_ERROR}${taskId}`, {
                error: error.message,
                stack: error.stack,
            });
            // Update task status when failed
            await this.taskModel.findByIdAndUpdate(taskId, {
                status: TaskStatus.FAILED,
                errorMessage: error.message,
            });
        }
    }

    private async processImage(
        task: Task,
        originalPath: string,
        resolution: string,
    ): Promise<ImageInfo> {
        const outputDir =
            this.configService.get<string>('paths.output') ?? '/tmp/output';
        const originalFileName = path.basename(
            originalPath,
            getFileExtension(originalPath),
        );

        // Calculate MD5 of original file
        this.logger.debug(taskProcessingInfoMessages.HASH_CALCULATION, {
            taskId: task.id,
            filePath: originalPath,
        });
        const md5 = calculateMD5(originalPath);

        // Creating directory structure
        const outputPath = path.join(outputDir, originalFileName, resolution);
        ensureDirectoryExists(outputPath);

        // Final file name
        const finalFileName = `${md5}${getFileExtension(originalPath)}`;
        const finalPath = path.join(outputPath, finalFileName);

        this.logger.debug(taskProcessingInfoMessages.PROCESSING_IMAGE, {
            taskId: task._id,
            resolution,
            outputPath: finalPath,
        });

        // Process and save the image
        await sharp(originalPath)
            .resize({ width: parseInt(resolution), withoutEnlargement: true })
            .toFile(finalPath);

        // Save image in database
        const relativePath = `/output/${originalFileName}/${resolution}/${finalFileName}`;

        this.logger.debug(taskProcessingInfoMessages.DATABASE_SAVE, {
            taskId: task.id,
            path: relativePath,
            resolution,
            md5,
        });

        await this.imageModel.create({
            path: relativePath,
            resolution,
            md5,
            taskId: task.id,
        });

        return {
            resolution,
            path: relativePath,
        };
    }
}
