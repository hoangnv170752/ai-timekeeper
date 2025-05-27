import mongoose, { Schema, Document, models, model, Types } from 'mongoose';

export interface ICheckin extends Document {
  userId: Types.ObjectId;
  checkinTime: Date;
  note?: string;
}

const CheckinSchema = new Schema<ICheckin>({
  userId: { type: Schema.Types.ObjectId, ref: 'FaceDetection', required: true },
  checkinTime: { type: Date, required: true },
  note: { type: String },
}, { timestamps: true });

export default models.Checkin || model<ICheckin>('Checkin', CheckinSchema); 