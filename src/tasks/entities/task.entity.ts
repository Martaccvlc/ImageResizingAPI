import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { TaskStatus } from '../enums/task-status.enum';

// TODO: Move enums and interfaces to another folder


export interface ImageInfo {
    resolution: string;
    path: string;
}

@Schema({ timestamps: true })
export class Task extends Document {
    @Prop({ required: true, enum: TaskStatus, default: TaskStatus.PENDING })
    status: TaskStatus;

    @Prop({ required: true, type: Number })
    price: number;

    @Prop({ required: true })
    originalPath: string;

    @Prop({ type: [{ resolution: String, path: String }], default: [] })
    images: ImageInfo[];

    @Prop({ type: String })
    errorMessage?: string;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

// Creation of indexes
TaskSchema.index({ status: 1 });
TaskSchema.index({ createdAt: 1 });
