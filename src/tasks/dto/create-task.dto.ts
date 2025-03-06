import { IsString, IsUrl, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({
    description: 'Local path or URL of the original image',
    example: 'https://example.com/images/sample.jpg',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Malformed URL' })
  url?: string;

  @ApiProperty({
    description: 'Local path of the image',
    example: '/input/sample.jpg',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\/.*\.(jpg|jpeg|png|gif)$/i, {
    message: 'The path must start with / and have a valid image extension',
  })
  localPath?: string;
} 