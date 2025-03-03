import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

const DATABASE_URL = process.env.DATABASE_URL as string;

@Module({
    imports: [MongooseModule.forRoot(DATABASE_URL)],
})
export class DatabaseModule {}
