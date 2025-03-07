import { ApiProperty } from '@nestjs/swagger';
import { ImageInfo } from '../types/image-info.d';
import { TaskStatus } from '../enums/task-status.enum';

export class TaskResponseDto {
    @ApiProperty({
        description: 'Task ID',
        example: '65d4a54b89c5e342b2c2c5f6',
    })
    taskId: string;

    @ApiProperty({
        description: 'Task status: pending, completed, failed',
        enum: TaskStatus,
        example: TaskStatus.PENDING,
    })
    status: TaskStatus;

    @ApiProperty({
        description: 'Price of the processed image',
        example: 25.5,
    })
    price: number;

    @ApiProperty({
        description: 'Information about the original image',
        type: [Object],
        example: [
            {
                resolution: '1024',
                path: '/output/image1/1024/f322b730b287da77e1c519c7ffef4fc2.jpg',
            },
        ],
        required: false,
    })
    images?: ImageInfo[];

    @ApiProperty({
        description: 'Failure message',
        required: false,
        example: 'Failed to process the image',
    })
    errorMessage?: string;
}
