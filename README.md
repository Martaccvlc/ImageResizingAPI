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


## Project Structure

TODO: This will be tweaked in another branch to improve the architecture. There are some TODOs in the code specifying some of the parts which need a rework. - The project will use hexagonal architecture
Why? I was making my first steps in nest and now that I have more or less clear how the framework works it is time to refactor the code.

## Error Handling

The API implements comprehensive error handling:

- HTTP exceptions with appropriate status codes
- Detailed error messages
- Error logging with stack traces
- Custom exception filters

## Logging

The application uses Winston for logging with multiple log levels:
- ERROR: For critical errors
- WARN: For warning conditions
- INFO: For informational messages
- DEBUG: For detailed debug information
- VERBOSE: For highly detailed traces

Once the app has been started, the log files can be found in the generated log folder:
- combined.log: Logs everything happening in the app.
- error.log: Shows only the errors.