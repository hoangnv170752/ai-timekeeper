import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from '@/lib/mongodb';
import FaceDetection from '@/models/FaceDetection';

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
    // Make sure to handle both formats with and without data URI prefix
    let base64Data = image;
    if (base64Data.startsWith('data:')) {
      base64Data = base64Data.replace(/^data:image\/\w+;base64,/, "");
    }
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Call Luxand API to recognize faces in the image using the correct endpoint
    console.log("Calling Luxand API for face search...");
    
    // In a Node.js environment, we need to use a different approach for multipart/form-data
    // Create a boundary for the multipart form data
    const boundary = "----WebKitFormBoundary" + Math.random().toString(16).substring(2);
    
    // Create the multipart form data manually
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="face.jpeg"\r\nContent-Type: image/jpeg\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    
    const body = Buffer.concat([
      Buffer.from(header, 'utf8'),
      imageBuffer,
      Buffer.from(footer, 'utf8')
    ]);
    
    // Use the correct endpoint as shown in the Python example: photo/search/v2
    const recognizeResponse = await fetch("https://api.luxand.cloud/photo/search/v2", {
      method: "POST",
      headers: {
        token: process.env.LUXAND_API_KEY as string,
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

    console.log("Full Luxand API response:", JSON.stringify(recognizeResult, null, 2));
    
    if (!recognizeResult) {
      return NextResponse.json({
        recognized: false,
        faceDetected: false,
        message: "Invalid response from Luxand API",
        canRegister: false,
        debug: { received: typeof recognizeResult }
      });
    }
    
    if (recognizeResult.status && recognizeResult.status === 'failure') {
      return NextResponse.json({
        recognized: false,
        faceDetected: false,
        message: recognizeResult.message || "Luxand API reported failure",
        canRegister: false,
        debug: { luxandResponse: recognizeResult }
      });
    }
    
    if (!recognizeResult.faces || !Array.isArray(recognizeResult.faces) || recognizeResult.faces.length === 0) {
      if (recognizeResult.bbox) {
        return NextResponse.json({
          recognized: false,
          faceDetected: true,
          message: "Face detected but not recognized",
          canRegister: true,
          faceLocation: recognizeResult.bbox
        });
      }
      
      return NextResponse.json({
        recognized: false,
        faceDetected: false,
        message: "No faces detected in the image",
        canRegister: false,
        debug: { luxandResponse: recognizeResult }
      });
    }

    // Check if any of the detected faces were recognized
    // The photo/search/v2 endpoint returns a different structure with a faces array
    // Only consider it a match if the similarity/probability is greater than 95%
    const recognizedFace = recognizeResult.faces.find((face: any) => 
      face.status === "success" && 
      face.matches && 
      face.matches.length > 0 && 
      face.matches[0].similarity > 0.95 // Only consider matches with probability > 95%
    );

    if (recognizedFace && recognizedFace.matches && recognizedFace.matches.length > 0) {
      // Extract the best match information
      const bestMatch = recognizedFace.matches[0]; // First match is the best match
      const luxandPersonId = bestMatch.person_id;
      const similarity = bestMatch.similarity;
      
      // Connect to the database to get additional user information
      await connectToDatabase();
      const user = await FaceDetection.findOne({ luxandPersonId: luxandPersonId });

      if (user) {
        // If this is for the specific room (Event 27th May), record attendance
        if (roomId === "7e20a2de-3aa8-11f0-8493-0242ac160002") {
          try {
            // Record attendance in the database
            const attendanceResponse = await fetch(new URL("/api/record-attendance", request.url).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: user._id,
                roomId: roomId
              })
            });
            
            const attendanceResult = await attendanceResponse.json();
            console.log("Attendance recorded:", attendanceResult);
            
            return NextResponse.json({
              recognized: true,
              user: user.name,
              userId: user._id,
              luxandPersonId: recognizedFace.name,
              confidence: recognizedFace.similarity,
              timestamp: new Date().toISOString(),
              attendanceRecorded: true,
              roomId: roomId,
              attendanceResult: attendanceResult
            });
          } catch (attendanceError: any) {
            console.error("Failed to record attendance:", attendanceError);
            // Still return the recognition result even if attendance recording fails
            return NextResponse.json({
              recognized: true,
              user: user.name,
              userId: user._id,
              luxandPersonId: recognizedFace.name,
              confidence: recognizedFace.similarity,
              timestamp: new Date().toISOString(),
              attendanceRecorded: false,
              attendanceError: attendanceError.message
            });
          }
        } else {
          // Regular response for other rooms
          return NextResponse.json({
            recognized: true,
            user: user.name,
            userId: user._id,
            luxandPersonId: recognizedFace.name,
            confidence: recognizedFace.similarity,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        // Face was recognized by Luxand but not found in our database
        return NextResponse.json({
          recognized: true,
          user: recognizedFace.name, // Use Luxand ID as name fallback
          luxandPersonId: recognizedFace.name,
          confidence: recognizedFace.similarity,
          timestamp: new Date().toISOString(),
          warning: "User recognized by Luxand but not found in local database",
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
