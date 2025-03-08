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
import { TasksService } from '../services/tasks.service';
import { CreateTaskDto } from '../dto/create-task.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { HttpExceptionFilter } from '../../core/filters/httpExceptions.filters';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('tasks')
@Controller('tasks')
@UseFilters(HttpExceptionFilter)
export class TasksController {
    constructor(private readonly tasksService: TasksService) {}

    @Post()
    @ApiOperation({ summary: 'Crear una nueva tarea de procesado de imagen' })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Tarea creada correctamente',
        type: TaskResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Datos no válidos',
    })
    async create(
        @Body() createTaskDto: CreateTaskDto,
    ): Promise<TaskResponseDto> {
        return this.tasksService.create(createTaskDto);
    }

    @Get(':taskId')
    @ApiOperation({ summary: 'Obtener información de una tarea específica' })
    @ApiParam({ name: 'taskId', description: 'ID de la tarea' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Información de la tarea',
        type: TaskResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Tarea no encontrada',
    })
    async findOne(@Param('taskId') taskId: string): Promise<TaskResponseDto> {
        const task = await this.tasksService.findOne(taskId);
        if (!task) {
            throw new NotFoundException(`Task with ID ${taskId} not found`);
        }
        return task;
    }
}
