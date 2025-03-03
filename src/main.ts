import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const apiPath = 'api';
const swaggerOptions = new DocumentBuilder()
.addBearerAuth()
.setTitle('Nest-js Swagger Example API')
.setDescription('Swagger Example API API description')
.setVersion('1.0')
.build();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Setting API Path
  app.setGlobalPrefix(apiPath);
  const document = SwaggerModule.createDocument(app, swaggerOptions);
  SwaggerModule.setup(`${apiPath}/docs`, app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
