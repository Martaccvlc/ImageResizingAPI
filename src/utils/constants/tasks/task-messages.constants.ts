/**
 * Error messages raised by the task
 */
export const taskResponseErrorMessages = {
    MISSING_PATH: 'URL or local image path needed.',
    ERROR_CREATING_TASK: 'Error creating the task ',
    INVALID_TASK_ID: 'Invalid task ID',
    NOT_FOUND: 'Task not found',
    FAILED_TASK: 'Failed task',
    BAD_REQUEST: 'Invalid data',
};

/**
 * Information messages to give feedback about the task
 */
export const taskInfoMessages = {
    CREATING: 'Creating a new processing task...',
    DOWNLOADING_IMAGE: 'Downloading image of URL',
    SEARCHING_TASK: 'Searching for task...',
    UPDATING_STATUS: 'Updating task status...',
    UPDATED_TASK: 'Task successfully updated',
    FOUND: 'Task found',
    CREATED: 'Task created successfully',
};

/**
 * Provides summaries for the task for Swagger
 */
export const taskSwaggerSummaries = {
    TASK_CREATION_SUMMARY: 'Create a new image processing task',
    TASK_INFO_SUMMARY: 'Get specific information about a task',
    TASK_STATUS_INFO_SUMMARY: 'Task status: pending, completed, failed',
    TASK_ID_SUMMARY: 'Generated Task ID (MD5)',
};

/**
 * Provides examples for the task for Swagger
 */
export const taskExampleMessages = {
    TASK_EXAMPLE_ID: '65d4a54b89c5e342b2c2c5f6',
};
