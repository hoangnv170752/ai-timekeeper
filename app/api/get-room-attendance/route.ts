import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    if (!process.env.LUXAND_API_KEY) {
      return NextResponse.json({ error: "Luxand API key not configured" }, { status: 500 });
    }

    // Get room UUID from the URL query parameters
    const { searchParams } = new URL(request.url);
    let roomId = searchParams.get('roomId');

    // Get the current hour to determine if we're in check-in or check-out mode
    const currentHour = new Date().getHours();
    const isCheckOutMode = currentHour >= 18; // After 6 PM is check-out time
    
    // Use fixed room IDs if no roomId is provided
    if (!roomId) {
      // Use the appropriate room ID based on time
      roomId = "7e20a2de-3aa8-11f0-8493-0242ac160002"; // Check-out room
    }
    
    // Check if the provided roomId is the check-out room
    const isCheckOutRoom: boolean = roomId === "237602cf-e844-11ee-8061-0242ac160003";

    console.log(`Fetching attendance for room: ${roomId} (${isCheckOutRoom ? 'check-out' : 'check-in'} room)`);

    // Call Luxand API to get room attendance
    const url = `https://api.luxand.cloud/attendance/room/${roomId}/presence`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        'token': process.env.LUXAND_API_KEY as string
      }
    });

    // Get the raw response text first for debugging
    const responseText = await response.text();
    console.log("Raw Luxand API response:", responseText);
    
    if (!response.ok) {
      console.error("Luxand room attendance error:", responseText);
      return NextResponse.json({
        success: false,
        error: `Luxand API error: ${response.status} - ${responseText}`
      }, { status: response.status });
    }

    // Try to parse the response as JSON with error handling and fallbacks
    let attendanceData;
    try {
      // First attempt: try to parse the response directly
      try {
        attendanceData = JSON.parse(responseText);
      } catch (initialParseError) {
        console.log("Initial JSON parse failed, trying fallback methods...");
        
        // Fallback 1: Try to fix common JSON syntax issues
        let cleanedResponse = responseText
          .replace(/([\{\,][\s\n]*['"]?[\w\-\_]+['"]?[\s\n]*:[^\,\}]*)[^\,\}\"\']([\s\n]*[\}\,])/g, '$1$2') // Fix missing quotes
          .replace(/,\s*}/g, '}') // Remove trailing commas
          .replace(/([\w\d\.]+)\:/g, '"$1":') // Ensure property names are quoted
          .trim();
        
        console.log("Cleaned response:", cleanedResponse);
        
        try {
          attendanceData = JSON.parse(cleanedResponse);
          console.log("Parsed JSON after cleaning");
        } catch (cleanedParseError) {
          // Fallback 2: If the response is empty or just whitespace, return an empty array
          if (!responseText.trim()) {
            console.log("Response is empty, returning empty array");
            attendanceData = [];
          } else {
            // Fallback 3: If it looks like an array but has issues, try to extract data
            if (responseText.trim().startsWith('[') && responseText.trim().endsWith(']')) {
              try {
                // Try to extract individual array items
                const itemRegex = /\{[^\{\}]*\}/g;
                const items = responseText.match(itemRegex) || [];
                attendanceData = items.map(item => {
                  try { return JSON.parse(item); } 
                  catch { return { raw: item }; }
                });
                console.log("Extracted array items:", attendanceData);
              } catch (arrayExtractError) {
                throw initialParseError; // If all else fails, throw the original error
              }
            } else {
              throw initialParseError;
            }
          }
        }
      }
      
      console.log("Luxand room attendance result:", JSON.stringify(attendanceData, null, 2));
    } catch (parseError: any) {
      console.error("All JSON parsing methods failed:", parseError.message);
      console.error("Raw response that caused the error:", responseText);
      
      // Return a fallback empty array with a warning
      return NextResponse.json({
        success: true,
        warning: `Could not parse Luxand API response: ${parseError.message}`,
        roomId: roomId,
        roomType: isCheckOutRoom ? 'check-out' : 'check-in',
        attendanceData: [],
        rawResponse: responseText
      });
    }

    // Return the attendance data with additional context
    return NextResponse.json({
      success: true,
      roomId: roomId,
      roomType: isCheckOutRoom ? 'check-out' : 'check-in',
      attendanceData: attendanceData
    });
  } catch (error: any) {
    console.error("Room attendance error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
