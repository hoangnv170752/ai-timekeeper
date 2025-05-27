import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from '@/lib/mongodb';
import FaceDetection from '@/models/FaceDetection';
import Checkin from '@/models/Checkin';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.LUXAND_API_KEY) {
      return NextResponse.json({ error: "Luxand API key not configured" }, { status: 500 });
    }

    const { image, roomId } = await request.json();

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Convert base64 to buffer for Luxand API
    const base64Data = image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Call Luxand API with a multipart/form-data approach that works in Node.js
    console.log("Calling Luxand API for face search...");
    
    // Create boundary for multipart form
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
    
    // Create the multipart form data manually
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="face.jpeg"\r\nContent-Type: image/jpeg\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    
    const body = Buffer.concat([
      Buffer.from(header, 'utf8'),
      imageBuffer,
      Buffer.from(footer, 'utf8')
    ]);

    const recognizeResponse = await fetch("https://api.luxand.cloud/photo/search/v2", {
      method: "POST",
      headers: {
        'token': process.env.LUXAND_API_KEY as string,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString()
      },
      body: body,
    });

    if (!recognizeResponse.ok) {
      const errorText = await recognizeResponse.text();
      console.error("Luxand recognition error:", errorText);
      return NextResponse.json({
        recognized: false,
        faceDetected: false,
        error: `Luxand recognition failed: ${recognizeResponse.status} - ${errorText}`,
        canRegister: false,
      }, { status: 500 });
    }

    const recognizeResult = await recognizeResponse.json();
    console.log("Luxand recognition result:", JSON.stringify(recognizeResult));

    // Check if any faces were detected using the search/v2 response format
    if (!recognizeResult || !recognizeResult.faces || recognizeResult.faces.length === 0) {
      return NextResponse.json({
        recognized: false,
        faceDetected: false,
        message: "No faces detected in the image",
        canRegister: false,
      });
    }

    // Check if any of the detected faces were recognized
    const recognizedFace = recognizeResult.faces.find((face: any) => 
      face.status === "success" && face.matches && face.matches.length > 0
    );

    if (recognizedFace && recognizedFace.matches && recognizedFace.matches.length > 0) {
      // Extract the best match information from the search/v2 response
      const bestMatch = recognizedFace.matches[0]; // First match is the best match
      const luxandPersonId = bestMatch.person_id;
      const similarity = bestMatch.similarity;
      const personName = bestMatch.name || luxandPersonId;
      
      // Connect to the database to get additional user information
      await connectToDatabase();
      const user = await FaceDetection.findOne({ luxandPersonId: luxandPersonId });

      if (user) {
        // If this is for the specific room (Event 27th May), record attendance
        if (roomId === "7e20a2de-3aa8-11f0-8493-0242ac160002") {
          try {
            // Record attendance in the database
            const checkin = new Checkin({
              userId: user._id,
              checkinTime: new Date(),
              note: `Automatic check-in via facial recognition for room ${roomId}`
            });
            
            await checkin.save();
            console.log("Attendance recorded for user:", user.name);
            
            return NextResponse.json({
              recognized: true,
              user: user.name,
              userId: user._id,
              luxandPersonId: luxandPersonId,
              confidence: similarity,
              timestamp: new Date().toISOString(),
              attendanceRecorded: true,
              roomId: roomId,
              message: `${user.name} checked in successfully to Event 27th May`,
              luxandResult: recognizeResult,
              rawMatches: recognizedFace.matches
            });
          } catch (attendanceError: any) {
            console.error("Failed to record attendance:", attendanceError);
            // Still return the recognition result even if attendance recording fails
            return NextResponse.json({
              recognized: true,
              user: user.name,
              userId: user._id,
              luxandPersonId: luxandPersonId,
              confidence: similarity,
              timestamp: new Date().toISOString(),
              attendanceRecorded: false,
              attendanceError: attendanceError.message,
              // Include the full Luxand recognition result for detailed display
              luxandResult: recognizeResult,
              rawMatches: recognizedFace.matches
            });
          }
        } else {
          // Regular response for other rooms
          return NextResponse.json({
            recognized: true,
            user: user.name,
            userId: user._id,
            luxandPersonId: luxandPersonId,
            confidence: similarity,
            timestamp: new Date().toISOString(),
            // Include the full Luxand recognition result for detailed display
            luxandResult: recognizeResult,
            rawMatches: recognizedFace.matches
          });
        }
      } else {
        // Face was recognized by Luxand but not found in our database
        return NextResponse.json({
          recognized: true,
          user: personName, // Use person name from Luxand if available
          luxandPersonId: luxandPersonId,
          confidence: similarity,
          timestamp: new Date().toISOString(),
          warning: "User recognized by Luxand but not found in local database",
          // Include the full Luxand recognition result for detailed display
          luxandResult: recognizeResult,
          rawMatches: recognizedFace.matches
        });
      }
    } else {
      // Face was detected but not recognized
      return NextResponse.json({
        recognized: false,
        faceDetected: true,
        message: "Face detected but not recognized",
        canRegister: true,
      });
    }
  } catch (error: any) {
    console.error("Face detection error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
