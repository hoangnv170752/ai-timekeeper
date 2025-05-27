import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Checkin from '@/models/Checkin';
import FaceDetection from '@/models/FaceDetection';

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { userId, checkinTime, note } = await request.json();
    if (!userId || !checkinTime) {
      return NextResponse.json({ error: 'userId and checkinTime are required' }, { status: 400 });
    }
    const checkin = await Checkin.create({ userId, checkinTime, note });
    return NextResponse.json({ success: true, data: checkin });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await connectToDatabase();
    const checkins = await Checkin.find().populate('userId', 'name face code').sort({ checkinTime: -1 });
    return NextResponse.json({ success: true, data: checkins });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 