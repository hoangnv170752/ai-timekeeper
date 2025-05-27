import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from '@/lib/mongodb';
import FaceDetection from '@/models/FaceDetection';
import Checkin from '@/models/Checkin';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const { userId, roomId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Find the user in the database
    const user = await FaceDetection.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create a new check-in record
    const checkin = new Checkin({
      userId: user._id,
      checkinTime: new Date(),
      note: `Automatic check-in via facial recognition for room ${roomId || 'unknown'}`
    });

    await checkin.save();

    return NextResponse.json({
      success: true,
      message: `${user.name} checked in successfully`,
      checkin: {
        id: checkin._id,
        userId: checkin.userId,
        checkinTime: checkin.checkinTime,
        note: checkin.note
      }
    });
  } catch (error: any) {
    console.error("Attendance recording error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
