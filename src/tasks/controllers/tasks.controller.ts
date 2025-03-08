import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    NotFoundException,
    HttpStatus,
    UseFilters,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

import { TasksService } from '../services/tasks.service';
import { CreateTaskDto } from '../dto/create-task.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { HttpExceptionFilter } from '../../core/filters/httpExceptions.filters';
import { taskResponseMessages, taskSwaggerSummaries } from '../../utils/constants/tasks/messages.constants';


@ApiTags('tasks')
@Controller('tasks')
@UseFilters(HttpExceptionFilter)
export class TasksController {
    constructor(private readonly tasksService: TasksService) {}

    @Post()
    @ApiOperation({ summary: taskSwaggerSummaries.TASK_CREATION_SUMMARY })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: taskResponseMessages.CREATED,
        type: TaskResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: taskResponseMessages.BAD_REQUEST,
    })
    async create(
        @Body() createTaskDto: CreateTaskDto,
    ): Promise<TaskResponseDto> {
        return this.tasksService.create(createTaskDto);
    }

    @Get(':taskId')
    @ApiOperation({ summary: taskSwaggerSummaries.TASK_INFO_SUMMARY })
    @ApiParam({ name: 'taskId', description: 'Task ID' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: taskResponseMessages.FOUND,
        type: TaskResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: taskResponseMessages.NOT_FOUND,
    })
    async findOne(@Param('taskId') taskId: string): Promise<TaskResponseDto> {
        const task = await this.tasksService.findOne(taskId);
        if (!task) {
            throw new NotFoundException(`${taskResponseMessages.NOT_FOUND}: ${taskId}`);
        }
        return task;
    }
}
