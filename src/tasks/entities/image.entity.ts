import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Image extends Document {
    @Prop({ required: true })
    path: string;

    @Prop({ required: true })
    resolution: string;

    @Prop({ required: true })
    md5: string;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Task', required: true })
    taskId: MongooseSchema.Types.ObjectId;
}

export const ImageSchema = SchemaFactory.createForClass(Image);

// Creation of indexes
ImageSchema.index({ taskId: 1 });
ImageSchema.index({ path: 1 }, { unique: true });
ImageSchema.index({ md5: 1 });
