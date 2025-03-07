import { Module } from '@nestjs/common';
import { WinstonModule, utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const environment = configService.get('NODE_ENV') || 'development';
        const isProduction = environment === 'production';
        
        return {
          transports: [
            // Configuramos la salida por consola
            new winston.transports.Console({
              level: isProduction ? 'info' : 'debug',
              format: winston.format.combine(
                winston.format.timestamp(),
                nestWinstonModuleUtilities.format.nestLike('ImageAPI', {
                  colors: true,
                  prettyPrint: true,
                })
              ),
            }),
            
            // Log de todos los niveles en archivo
            new winston.transports.File({
              filename: 'logs/combined.log',
              level: 'info',
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
              ),
            }),
            
            // Archivo específico para errores
            new winston.transports.File({
              filename: 'logs/error.log',
              level: 'error',
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
              ),
            }),
          ],
        };
      },
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {} 