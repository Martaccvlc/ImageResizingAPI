import { IsString, IsUrl, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import {
    fileErrorResponseMessages,
    fileExampleData,
    fileSwaggerSummaries,
} from '../../utils/constants/files/files-messages.constants';

export class CreateTaskDto {
    @ApiProperty({
        description: fileSwaggerSummaries.FILE_URL_SUMMARY,
        example: fileExampleData.URL,
    })
    @IsOptional()
    @IsUrl({}, { message: fileErrorResponseMessages.MALFORMED_URL })
    url?: string;

    @ApiProperty({
        description: fileSwaggerSummaries.LOCAL_PATH_SUMMARY,
        example: fileExampleData.LOCAL_PATH,
    })
    @IsOptional()
    @IsString()
    @Matches(/^\/.*\.(jpg|jpeg|png|gif)$/i, {
        message: fileErrorResponseMessages.INVALID_FILE_EXT,
    })
    localPath?: string;
}
