import { ApiProperty } from '@nestjs/swagger';

import { ImageInfo } from '../../types/tasks/image-info';
import { TaskStatus } from '../../utils/enums/tasks/task-status.enum';
import { fileErrorResponseMessages, fileExampleData, fileSwaggerSummaries } from '../../utils/constants/files/files-messages.constant';
import { taskSwaggerSummaries, taskExampleMessages } from 'src/utils/constants/tasks/task-messages.constants';

export class TaskResponseDto {
    @ApiProperty({
        description: taskSwaggerSummaries.TASK_ID_SUMMARY,
        example: taskExampleMessages.TASK_EXAMPLE_ID,
    })
    taskId: string;

    @ApiProperty({
        description: taskSwaggerSummaries.TASK_STATUS_INFO_SUMMARY,
        enum: TaskStatus,
        example: TaskStatus.PENDING,
    })
    status: TaskStatus;

    @ApiProperty({
        description: fileSwaggerSummaries.IMAGE_PRICE_SUMMARY,
        example: fileExampleData.EXAMPLE_PRICE,
    })
    price: number;

    @ApiProperty({
        description: fileSwaggerSummaries.IMAGE_INFO_SUMMARY,
        type: [Object],
        example: [
            {
                resolution: fileExampleData.EXAMPLE_RESOLUTION,
                path: fileExampleData.EXAMPLE_FULL_OUTPUT_PATH,
            },
        ],
        required: false,
    })
    images?: ImageInfo[];

    @ApiProperty({
        description: fileSwaggerSummaries.FAILURE_INFO_SUMMARY,
        required: false,
        example: fileErrorResponseMessages.FAILED_TO_PROCESS_IMAGE,
    })
    errorMessage?: string;
}
