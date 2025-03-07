import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

import { ImageInfo, Task, TaskStatus } from '../entities/task.entity';
import { Image } from '../entities/image.entity';
import {
    calculateMD5,
    getFileExtension,
    ensureDirectoryExists,
} from '../../utils/files/file.utils';

@Injectable()
export class TasksProcessor {
    private readonly resolutions = ['1024', '800']; // TODO: Move to a constant folder.

    constructor(
        @InjectModel(Task.name) private taskModel: Model<Task>,
        @InjectModel(Image.name) private imageModel: Model<Image>,
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    async processTask(taskId: string): Promise<void> {
        this.logger.info('Starting to process task ', { taskId });

        try {
            // Get task
            const task = await this.taskModel.findById(taskId);
            if (!task) {
                throw new Error(`Task ${taskId} not found`);
            }

            // Get original image
            const originalPath = task.originalPath;
            if (!fs.existsSync(originalPath)) {
                throw new Error(`File ${originalPath} does not exist`);
            }

            this.logger.debug('Processing image...', {
                taskId,
                originalPath,
                resolutions: this.resolutions,
            });

            // Process images
            const processedImages: ImageInfo[] = [];

            for (const resolution of this.resolutions) {
                try {
                    // Procesar imagen
                    this.logger.debug('Procesando resolución', {
                        taskId,
                        resolution,
                    });
                    const imageInfo = await this.processImage(
                        task,
                        originalPath,
                        resolution,
                    );
                    processedImages.push(imageInfo);
                    this.logger.debug('Resolution processed successfully', {
                        taskId,
                        resolution,
                        path: imageInfo.path,
                    });
                } catch (error) {
                    this.logger.error(
                        `Error processing image with the resolution ${resolution}`,
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

            this.logger.info('Image processed successfully', {
                taskId,
                imagesCount: processedImages.length,
            });
        } catch (error) {
            this.logger.error(`Error processing task ${taskId}`, {
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
        this.logger.debug('Calculating hash', {
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

        this.logger.debug('Processing image....', {
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

        this.logger.debug('Saving image information in database...', {
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
