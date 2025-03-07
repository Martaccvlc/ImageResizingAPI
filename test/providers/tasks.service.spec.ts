import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, connect, Model, Types, Schema } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

import { TasksService } from '../../src/tasks/tasks.service';
import { TasksProcessor } from '../../src/tasks/tasks.processor';
import { Task, TaskSchema, TaskStatus } from '../../src/tasks/entities/task.entity';
import { Image, ImageSchema } from '../../src/tasks/entities/image.entity';
import { CreateTaskDto } from '../../src/tasks/dto/create-task.dto';


describe('TasksService', () => {
  let service: TasksService;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let taskModel: Model<Task>;
  let imageModel: Model<Image>;
  let configService: ConfigService;
  let tasksProcessor: TasksProcessor;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    mongoConnection = (await connect(uri)).connection;
    taskModel = mongoConnection.model(Task.name, TaskSchema);
    imageModel = mongoConnection.model(Image.name, ImageSchema);

    // Crear directorios temporales para pruebas
    const testInputDir = './test-input';
    const testOutputDir = './test-output';
    
    if (!fs.existsSync(testInputDir)) {
      fs.mkdirSync(testInputDir, { recursive: true });
    }
    
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // Crear una imagen de prueba
    const sampleImageBuffer = Buffer.alloc(1024, 0);
    fs.writeFileSync(path.join(testInputDir, 'test-image.jpg'), sampleImageBuffer);
  });

  afterAll(async () => {
    await mongoConnection.close();
    await mongod.stop();
    
    // Limpiar directorios de prueba
    fs.rmSync('./test-input', { recursive: true, force: true });
    fs.rmSync('./test-output', { recursive: true, force: true });
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getModelToken(Task.name),
          useValue: taskModel,
        },
        {
          provide: getModelToken(Image.name),
          useValue: imageModel,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              if (key === 'paths.input') return './test-input';
              if (key === 'paths.output') return './test-output';
              return null;
            }),
          },
        },
        {
          provide: TasksProcessor,
          useValue: {
            processTask: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    configService = module.get<ConfigService>(ConfigService);
    tasksProcessor = module.get<TasksProcessor>(TasksProcessor);
    
    await taskModel.deleteMany({});
    await imageModel.deleteMany({});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a task with local path', async () => {
      const createTaskDto: CreateTaskDto = {
        localPath: './test-input/test-image.jpg',
      };

      const result = await service.create(createTaskDto);

      expect(result).toHaveProperty('taskId');
      expect(result.status).toEqual(TaskStatus.PENDING);
      expect(result.price).toBeGreaterThanOrEqual(5);
      expect(result.price).toBeLessThanOrEqual(50);
    });

    it('should throw an error if neither url nor localPath is provided', async () => {
      const createTaskDto: CreateTaskDto = {};
      
      await expect(service.create(createTaskDto)).rejects.toThrow();
    });
  });

  describe('findOne', () => {
    it('should return task details', async () => {
      // Create a task
      const task = await taskModel.create({
        status: TaskStatus.COMPLETED,
        price: 25.5,
        originalPath: '/test-input/test-image.jpg',
        images: [
          { resolution: '1024', path: '/output/test-image/1024/md5.jpg' },
          { resolution: '800', path: '/output/test-image/800/md5.jpg' },
        ],
      });

      // Use safe type assertion to handle _id
      const taskId = task._id ? task._id.toString() : '';
      const result = await service.findOne(taskId);

      expect(result.taskId).toEqual(taskId);
      expect(result.status).toEqual(TaskStatus.COMPLETED);
      expect(result.price).toEqual(25.5);
      expect(result.images).toHaveLength(2);
      expect(result.images && result.images[0].resolution).toEqual('1024');
    });

    it('should throw NotFoundException for non-existent task', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      
      await expect(service.findOne(nonExistentId)).rejects.toThrow();
    });
  });
}); 