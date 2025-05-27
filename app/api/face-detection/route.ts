import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import FaceDetection from '@/models/FaceDetection';

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { face, name, age, code } = await request.json();
    if (!face || !name) {
      return NextResponse.json({ error: 'face and name are required' }, { status: 400 });
    }
    const newFace = await FaceDetection.create({ face, name, age, code });
    return NextResponse.json({ success: true, data: newFace });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await connectToDatabase();
    const faces = await FaceDetection.find().sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: faces });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 