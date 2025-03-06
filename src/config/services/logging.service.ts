import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    new winston.transports.Console({ format: winston.format.combine(
      winston.format.timestamp(),
      nestWinstonModuleUtilities.format.nestLike('ImageAPI', {
        colors: true,
        prettyPrint: true,
      })
    ),
  }), // This will log the logging messages to console
    new winston.transports.File({ filename: 'logs/combined.log' }), // This will create a log file in a logs folder
  ],
  format: winston.format.json(),
});



@Injectable()
export class AppLoggingService implements LoggerService {
  log(message: any, ...optionalParams: any[]) {
    logger.log('info', message, ...optionalParams);
  }
  error(message: any, ...optionalParams: any[]) {
    logger.error(message, ...optionalParams);
  }
  warn(message: any, ...optionalParams: any[]) {
    logger.warn(message, ...optionalParams);
  }
  debug(message: any, ...optionalParams: any[]) {
    logger.debug(message, ...optionalParams);
  }
  verbose?(message: any, ...optionalParams: any[]) {
    logger.verbose(message, ...optionalParams);
  }
  fatal?(message: any, ...optionalParams: any[]) {
    logger.error(message, ...optionalParams);
  }
  setLogLevels?(levels: LogLevel[]) {
    if (levels && levels.length > 0) {
      const level = levels[0]; // Default to the first level in the array
      logger.level = level;
      logger.info(`Log level set to ${level}`);
    }
  }
}