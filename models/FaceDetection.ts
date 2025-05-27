import mongoose, { Schema, Document, models, model } from 'mongoose';

export interface IFaceDetection extends Document {
  face: string;
  name: string;
  age?: number;
  code?: string;
}

const FaceDetectionSchema = new Schema<IFaceDetection>({
  face: { type: String, required: true },
  name: { type: String, required: true },
  age: { type: Number },
  code: { type: String },
}, { timestamps: true });

export default models.FaceDetection || model<IFaceDetection>('FaceDetection', FaceDetectionSchema); 