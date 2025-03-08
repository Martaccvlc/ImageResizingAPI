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

## Testing

The project includes both unit tests and end-to-end (e2e) tests.

```bash
# Run unit tests
npm test

# Run e2e tests
npm run test:e2e

# Generate test coverage
npm run test:cov
```

### Test Structure

- **Unit Tests**: Located in the `test/providers` and `test/controllers` directories.
- **E2E Tests**: Located in the `test/e2e` directory.

The tests use:
- Jest as the testing framework
- MongoDB memory server for database testing
- Mocked services for isolated testing


## Architecture

The project follows NestJS's module-based structure. 

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