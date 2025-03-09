import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, connect, Model } from 'mongoose';
import { Task, TaskSchema } from '../../../src/tasks/entities/task.entity';
import { Image, ImageSchema } from '../../../src/tasks/entities/image.entity';

export const setupTestDatabase = async (): Promise<{
    mongod: MongoMemoryServer;
    mongoConnection: Connection;
    taskModel: Model<Task>;
    imageModel: Model<Image>;
}> => {
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    const mongoConnection = (await connect(uri)).connection;
    const taskModel = mongoConnection.model<Task>(Task.name, TaskSchema);
    const imageModel = mongoConnection.model<Image>(Image.name, ImageSchema);

    return { mongod, mongoConnection, taskModel, imageModel };
}; 