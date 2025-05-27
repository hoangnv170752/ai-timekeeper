import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from '@/lib/mongodb';
import Checkin from '@/models/Checkin';
import FaceDetection from '@/models/FaceDetection';

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    // Get query parameters
    const url = new URL(request.url);
    const roomId = url.searchParams.get('roomId');
    
    // Base query - sort by most recent check-ins first
    const query: any = {};
    
    // Add roomId filter if provided
    if (roomId) {
      query.note = { $regex: roomId, $options: 'i' };
    }
    
    // Get check-ins with populated user data
    const checkins = await Checkin.find(query)
      .sort({ checkinTime: -1 })
      .limit(50)
      .lean();
    
    // Fetch user details for each check-in
    const checkinResults = await Promise.all(
      checkins.map(async (checkin: any) => {
        const user = await FaceDetection.findById(checkin.userId).lean() as any;
        return {
          id: checkin._id,
          userId: checkin.userId,
          userName: user && user.name ? user.name : 'Unknown User',
          checkinTime: checkin.checkinTime,
          note: checkin.note,
          timestamp: checkin.createdAt
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      attendanceRecords: checkinResults,
      count: checkinResults.length
    });
  } catch (error: any) {
    console.error("Error fetching attendance records:", error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
