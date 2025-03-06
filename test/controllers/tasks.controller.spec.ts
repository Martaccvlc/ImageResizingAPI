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
import { TasksService } from '../../src/tasks/tasks.service';
import { CreateTaskDto } from '../../src/tasks/dto/create-task.dto';
import { TaskResponseDto } from '../../src/tasks/dto/task-response.dto';
import { HttpExceptionFilter } from '../../src/utils/filters/httpExceptions.filters';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('tasks')
@Controller('tasks')
@UseFilters(HttpExceptionFilter)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new processing image Task.' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Task created successfully',
    type: TaskResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid data provided',
  })
  async create(@Body() createTaskDto: CreateTaskDto): Promise<TaskResponseDto> {
    return this.tasksService.create(createTaskDto);
  }

  @Get(':taskId')
  @ApiOperation({ summary: 'Get information about the specific task.' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Task found',
    type: TaskResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Task not found',
  })
  async findOne(@Param('taskId') taskId: string): Promise<TaskResponseDto> {
    const task = await this.tasksService.findOne(taskId);
    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }
    return task;
  }
} 