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
    // Make sure to handle both formats with and without data URI prefix
    let base64Data = image;
    if (base64Data.startsWith('data:')) {
      base64Data = base64Data.replace(/^data:image\/\w+;base64,/, "");
    }
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

    // Log the full response for debugging
    console.log("Full Luxand API response:", JSON.stringify(recognizeResult, null, 2));
    
    // Check if any faces were detected
    if (!recognizeResult) {
      return NextResponse.json({
        recognized: false,
        faceDetected: false,
        message: "Invalid response from Luxand API",
        canRegister: false,
        debug: { received: typeof recognizeResult }
      });
    }
    
    // Handle case where the API returns a failure status
    if (recognizeResult.status && recognizeResult.status === 'failure') {
      return NextResponse.json({
        recognized: false,
        faceDetected: false,
        message: recognizeResult.message || "Luxand API reported failure",
        canRegister: false,
        debug: { luxandResponse: recognizeResult }
      });
    }
    
    // IMPORTANT: Handle the array response format shown in the logs
    // If recognizeResult is an array, we need to process it differently
    if (Array.isArray(recognizeResult)) {
      console.log("Detected array response format from Luxand API");
      
      if (recognizeResult.length === 0) {
        return NextResponse.json({
          recognized: false,
          faceDetected: false,
          message: "No faces detected in the image",
          canRegister: false
        });
      }
      
      // Find any matches with probability > 95%
      const highConfidenceMatch = recognizeResult.find(match => 
        match.probability && match.probability > 0.95
      );
      
      if (highConfidenceMatch) {
        // We have a high confidence match, use it directly
        const luxandPersonId = highConfidenceMatch.uuid;
        const similarity = highConfidenceMatch.probability;
        const personName = highConfidenceMatch.name || luxandPersonId;
        
        // Connect to the database to get additional user information
        await connectToDatabase();
        const user = await FaceDetection.findOne({ luxandPersonId: luxandPersonId });
        
        if (user) {
          // Process user found case directly here
          // If this is for the specific room (Event 27th May), record attendance
          if (roomId === "7e20a2de-3aa8-11f0-8493-0242ac120002") {
            try {
              // Get current time to determine if it's check-in or check-out
              const currentTime = new Date();
              const currentHour = currentTime.getHours();
              
              // Determine which Luxand attendance endpoint to use based on time
              // After 18:00 (6 PM) use check-out, before that use check-in
              const isCheckOut = currentHour >= 18;
              const attendanceEndpoint = isCheckOut 
                ? "https://api.luxand.cloud/attendance/check/out"
                : "https://api.luxand.cloud/attendance/check/in";
              
              const attendanceRoomId = "7e20a2de-3aa8-11f0-8493-0242ac160002"; 
              
              console.log(`Recording ${isCheckOut ? 'check-out' : 'check-in'} attendance for ${user.name}`);
              
              // Create multipart form data for the Luxand attendance API
              const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
              

              const photoHeader = `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="face.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`;
              const photoFooter = `\r\n--${boundary}\r\n`;
              const roomHeader = `Content-Disposition: form-data; name="room"\r\n\r\n`;
              const roomFooter = `\r\n--${boundary}--\r\n`;
              
              const body = Buffer.concat([
                Buffer.from(photoHeader, 'utf8'),
                imageBuffer,
                Buffer.from(photoFooter, 'utf8'),
                Buffer.from(roomHeader, 'utf8'),
                Buffer.from(attendanceRoomId, 'utf8'),
                Buffer.from(roomFooter, 'utf8')
              ]);
              
              // Log the form data for debugging
              console.log('Multipart form data structure:');
              console.log(`- Photo part: name="photo", filename="face.jpg"`);
              console.log(`- Room part: name="room", value="${attendanceRoomId}"`);
              
              // Log the request details for debugging
              console.log(`Calling Luxand attendance API: ${attendanceEndpoint}`);
              console.log(`Using room ID: ${attendanceRoomId}`);
              console.log(`API Key available: ${!!process.env.LUXAND_API_KEY}`);
              
              // Variable to store the attendance result
              let attendanceResult: any = null;
              
              try {
                // Call Luxand attendance API
                const attendanceResponse = await fetch(attendanceEndpoint, {
                  method: "POST",
                  headers: {
                    'token': process.env.LUXAND_API_KEY as string,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': body.length.toString()
                  },
                  body: body,
                });
                
                console.log(`Attendance API response status: ${attendanceResponse.status}`);
                
                // Check if the response is OK
                if (!attendanceResponse.ok) {
                  const errorText = await attendanceResponse.text();
                  console.error(`Luxand attendance API error: ${attendanceResponse.status} - ${errorText}`);
                  throw new Error(`Attendance API error: ${attendanceResponse.status} - ${errorText}`);
                }
                
                attendanceResult = await attendanceResponse.json();
                console.log("Luxand attendance result:", JSON.stringify(attendanceResult, null, 2));
              } catch (apiError: any) {
                console.error("Error calling Luxand attendance API:", apiError.message);
                throw apiError;
              }
              
              // Also record in our local database
              const checkin = new Checkin({
                userId: user._id,
                checkinTime: currentTime,
                note: `Automatic ${isCheckOut ? 'check-out' : 'check-in'} via facial recognition for room ${roomId}`,
                isCheckOut: isCheckOut
              });
              
              await checkin.save();
              console.log("Attendance recorded in database for user:", user.name);
              
              return NextResponse.json({
                recognized: true,
                user: user.name,
                userId: user._id,
                luxandPersonId: luxandPersonId,
                confidence: similarity,
                timestamp: new Date().toISOString(),
                attendanceRecorded: true,
                attendanceType: currentHour >= 18 ? 'check-out' : 'check-in',
                attendanceRoomId: attendanceRoomId,
                roomId: roomId,
                message: `${user.name} ${currentHour >= 18 ? 'checked out' : 'checked in'} successfully`,
                luxandResult: recognizeResult,
                luxandAttendanceResult: attendanceResult
              });
            } catch (attendanceError: any) {
              console.error("Failed to record attendance:", attendanceError);
              // Still return the recognition result even if attendance recording fails
              const currentHour = new Date().getHours();
              return NextResponse.json({
                recognized: true,
                user: user.name,
                userId: user._id,
                luxandPersonId: luxandPersonId,
                confidence: similarity,
                timestamp: new Date().toISOString(),
                attendanceRecorded: false,
                attendanceType: currentHour >= 18 ? 'check-out' : 'check-in',
                attendanceError: attendanceError.message,
                message: `${user.name} recognized but attendance recording failed: ${attendanceError.message}`,
                luxandResult: recognizeResult
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
              luxandResult: recognizeResult
            });
          }
        } else {
          // Face was recognized by Luxand but not found in our database
          return NextResponse.json({
            recognized: true,
            user: personName,
            luxandPersonId: luxandPersonId,
            confidence: similarity,
            timestamp: new Date().toISOString(),
            warning: "User recognized by Luxand but not found in local database",
            luxandResult: recognizeResult
          });
        }
      } else {
        // Face detected but not with high enough confidence
        return NextResponse.json({
          recognized: false,
          faceDetected: true,
          message: "Face detected but confidence below threshold",
          canRegister: true,
          detectedFaces: recognizeResult
        });
      }
    }
    
    // If we get here, we're dealing with the original expected format with a faces array
    if (!recognizeResult.faces || !Array.isArray(recognizeResult.faces) || recognizeResult.faces.length === 0) {
      // If we have a bbox property directly in the result, there might be a face detected
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

    // Original format processing - check if any of the detected faces were recognized
    // Only consider it a match if the similarity/probability is greater than 95%
    const recognizedFace = recognizeResult.faces.find((face: any) => 
      face.status === "success" && face.matches && face.matches.length > 0 && 
      face.matches[0].similarity > 0.95 // Only consider matches with probability > 95%
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
