/**
 * Provides error messages
 */
export const fileErrorResponseMessages = {
    MALFORMED_URL: 'Malformed URL',
    INVALID_FILE_EXT: 'The path must start with / and have a valid image extension',
    FAILED_TO_PROCESS_IMAGE: 'Failed to process image',
  };

/**
 * Provides summaries for the file for Swagger
 */
export const fileSwaggerSummaries = {
    FILE_URL_SUMMARY: 'Local path or URL of the original image',
    LOCAL_PATH_SUMMARY: 'Local path of the image',
    IMAGE_PRICE_SUMMARY: 'Price of the processed image',
    IMAGE_INFO_SUMMARY: 'Information about the original image',
    FAILURE_INFO_SUMMARY: 'Failure message',
};

/**
 * Provides examples for the file for Swagger
 */
export const fileExampleData = {
    URL: 'https://example.com/images/sample.jpg',
    LOCAL_PATH: '/input/sample.jpg',
    EXAMPLE_RESOLUTION: '1024',
    EXAMPLE_PRICE: 25.5,
    EXAMPLE_FULL_OUTPUT_PATH: '/output/image1/1024/f322b730b287da77e1c519c7ffef4fc2.jpg',
};
  