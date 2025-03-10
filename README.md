# Image Resizing API

A NestJS application that provides a REST API for image resizing and processing. The service accepts images (via URL or local path), processes them in different resolutions, and returns the processed images.

## Installation

```bash
# Clone the repository
git clone https://github.com/Martaccvlc/ImageResizingAPI.git
cd ImageResizingAPI

# Install dependencies
npm install
```

## Environment Variables

Create a `.env` file in the root directory based on the `.env.example` file replacing the example values.

## Running the Application

```bash
# Development mode
npm run start

# Watch mode
npm run start:dev

# Production mode
npm run start:prod
```

The API will be available at `http://localhost:3000/api` (or the port specified in your environment variables).

## API Endpoints

### Create a Task

You can find more information in the docs located at `http://localhost:3000/api/docs/`

```
POST /api/tasks
```

Request body:
```json
{
 "url": "https://example.com/image.jpg"
}
```

OR

```json
{
 "localPath": "/path/to/local/image.jpg"
}
```

Response:
```json
{
 "taskId": "taskId123",
 "status": "pending",
 "price": 25.50,
 "createdAt": "2023-01-01T00:00:00.000Z"
}
```

### Get Task Status

```
GET /api/tasks/:id
```

Response:
```json
{
 "taskId": "taskId123",
 "status": "completed",
 "price": 25.50,
 "createdAt": "2023-01-01T00:00:00.000Z",
 "completedAt": "2023-01-01T00:05:00.000Z",
 "images": [
   {
     "resolution": "1024",
     "url": "/output/image/1024/filename.jpg"
   },
   {
     "resolution": "800",
     "url": "/output/image/800/filename.jpg"
   }
 ]
}
```

## Architecture

The project follows NestJS's module-based structure providing a testable, scalable, loosely coupled and easily maintainable application. 

### Technical Stack

- **Framework**: NestJS v11
- **Database**: MongoDB v8 with Mongoose
- **Image Processing**: Sharp v0.33
- **Logging**: nest-winston
- **API Documentation**: Swagger/OpenAPI
- **Testing**: Jest with MongoDB Memory Server
- **Configuration**: Environment-based using @nestjs/config

### Project Structure

```
src/
├── core/                # Core modules and utilities
│   ├── database/        # Database configuration
│   ├── logging/         # Logging setup
│   └── filters/         # Global exception filters
├── tasks/               # Tasks module
│   ├── controllers/     # API endpoints
│   ├── services/        # Business logic
│   ├── entities/        # Database models
│   └── dto/             # Data transfer objects
├── utils/               # Shared utilities
│   ├── constants/       # Application constants
│   ├── enums/           # Shared enumerations
│   └── files/           # File handling utilities
└── types/               # TypeScript interfaces
```

### Core Components

1. **Application Module (`AppModule`)**
   - Root module that bootstraps the application
   - Configures global settings and imports core modules
   - Implements global exception handling

2. **Database Module (`DatabaseModule`)**
   - Manages MongoDB connection using Mongoose
   - Configures database settings through environment variables
   - Implements connection pooling and error handling

3. **Logger Module (`LoggerModule`)**
   - Implements Winston logger for structured logging
   - Supports multiple transport layers (console, file)
   - Provides different log levels based on environment
   - Outputs to:
     - Console (development)
     - combined.log (all levels)
     - error.log (error level only)

4. **Tasks Module (`TasksModule`)**
   - Core business logic for image processing
   - Components:
     - `TasksController`: REST API endpoints
     - `TasksService`: Business logic and task management
     - `TasksProcessor`: Image processing using Sharp
     - MongoDB schemas for Tasks and Images

### Test Structure

### Directory Structure
```
test/
├── integration/          # Integration tests
│   └── tasks.integration.spec.ts
├── unit/                # Unit tests
│   └── services/
│       └── tasks.processor.spec.ts
│       └── tasks.service.spec.ts
├── utils/               # Test utilities
│   ├── common.utils.ts
│   ├── directories/
│   │   └── test-directories.utils.ts
│   └── images/
│       └── test-image.utils.ts
└── types/               # Test type definitions
    └── test-context.ts
```

### Test Components

#### Integration Tests (`tasks.integration.spec.ts`)
Tests the complete API functionality including:
- Task creation with local images
- Error handling for invalid inputs
- Task status retrieval
- Full task processing flow
- Invalid image handling

#### Key Test Cases:
1. `POST /api/tasks`
   - Creating tasks with valid local images
   - Handling missing URL/path
   - Handling non-existent files
   - Handling invalid URLs

2. `GET /api/tasks/:id`
   - Retrieving task status
   - Handling non-existent tasks

3. Task Processing Flow
   - Complete task processing verification
   - Invalid image processing handling

### Unit Tests (`tasks.processor.spec.ts`)
Tests the Tasks services in isolation.

#### Key Test Cases:
1. Basic Processing
   - Successful image processing
   - Multiple resolution handling
   - Task status transitions

2. Error Handling
   - Non-existent tasks
   - Missing files
   - Invalid image formats

### Test Image Creation (`test-image.utils.ts`)
Creates test images for testing purposes with the following features:
- Configurable dimensions and background color
- Retry mechanism for reliability
- Proper file permissions handling
- Directory creation and cleanup

```typescript
interface TestImageOptions {
    width: number;
    height: number;
    background: {
        r: number;
        g: number;
        b: number;
        alpha?: number;
    };
}
```

### Directory Management (`test-directories.utils.ts`)
Manages test directories with:
- Automatic workspace detection
- Directory creation with proper permissions
- Cleanup functionality
- Error handling

### Test Context

The test suite uses a shared test context that provides:
- MongoDB test instance
- Task and Image models
- Processor instance
- Utility functions

### Running Tests

#### Commands
```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/integration/tasks.integration.spec.ts

# Run with coverage
npm run test:cov
```

### Test Environment
- Test directories: `test/test-input` and `test/test-output`
- MongoDB: In-memory instance
- Image resolutions: 800px, 1024px
- Default timeout: 30000ms

### Test Image Defaults
- Width: 2048px
- Height: 2048px
- Format: JPEG
- Quality: 90
- Background: White 