import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from '@/lib/mongodb';
import FaceDetection from '@/models/FaceDetection';

// Mock user database - in a real app, this would be a proper database
const userDatabase = [
  { id: "1", name: "John Doe", faceId: "person_001", luxandPersonId: "person_001" },
  { id: "2", name: "Jane Smith", faceId: "person_002", luxandPersonId: "person_002" },
  { id: "3", name: "Mike Johnson", faceId: "person_003", luxandPersonId: "person_003" },
]

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Try to find a user with the exact same face image (base64)
    const user = await FaceDetection.findOne({ face: image });

    if (user) {
      return NextResponse.json({
        recognized: true,
        user: user.name,
        userId: user._id,
        face: user.face,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json({
        recognized: false,
        faceDetected: false,
        message: "No matching face found in database",
        canRegister: true,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
