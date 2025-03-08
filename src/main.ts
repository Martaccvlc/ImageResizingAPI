import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const apiPath = 'api';
const swaggerOptions = new DocumentBuilder()
    .addBearerAuth()
    .setTitle('Image processing API')
    .setDescription(
        'The API manages image processing tasks and their current status.',
    )
    .setVersion('1.0')
    .build();

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Setting API Path
    app.setGlobalPrefix(apiPath);

    // Setting OpenAPI
    const document = SwaggerModule.createDocument(app, swaggerOptions);
    SwaggerModule.setup(`${apiPath}/docs`, app, document);

    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
