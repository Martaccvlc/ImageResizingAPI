import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Inject,
  } from '@nestjs/common';
  import { Request, Response } from 'express';
  import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
  import { Logger } from 'winston';
  
  @Catch()
  export class HttpExceptionFilter implements ExceptionFilter {
    constructor(
      @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}
  
    catch(exception: unknown, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<Request>();
  
      const status =
        exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;
  
      const message =
        exception instanceof HttpException
          ? exception.message
          : 'Internal server error';
  
      const errorResponse = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message,
      };
  
      this.logger.error(
        `${request.method} ${request.url} ${status}`,
        {
          exception: exception instanceof Error ? exception.stack : String(exception),
          request: {
            url: request.url,
            method: request.method,
            body: request.body,
            params: request.params,
            query: request.query,
          },
          response: errorResponse,
        },
      );
  
      response.status(status).json(errorResponse);
    }
  } 