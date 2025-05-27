import { type NextRequest, NextResponse } from "next/server"

// Mock user database - in a real app, this would be a proper database
const userDatabase = [
  { id: "1", name: "John Doe", faceId: "person_001", luxandPersonId: "person_001" },
  { id: "2", name: "Jane Smith", faceId: "person_002", luxandPersonId: "person_002" },
  { id: "3", name: "Mike Johnson", faceId: "person_003", luxandPersonId: "person_003" },
]

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json()

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    if (!process.env.LUXAND_API_KEY) {
      console.error("LUXAND_API_KEY not found")
      return NextResponse.json({ error: "Luxand API key not configured" }, { status: 500 })
    }

    // Convert base64 to blob for Luxand API
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, "")

    console.log("Attempting face recognition...")

    // Use the correct Luxand API endpoint for face recognition
    const recognizeResponse = await fetch("https://api.luxand.cloud/photo/search", {
      method: "POST",
      headers: {
        token: process.env.LUXAND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        photo: base64Data,
        limit: 1,
        threshold: 0.7, // Confidence threshold
      }),
    })

    console.log("Recognition response status:", recognizeResponse.status)

    if (!recognizeResponse.ok) {
      console.log("Recognition failed, trying detect...")

      // If recognition fails, try to detect faces
      const detectResponse = await fetch("https://api.luxand.cloud/photo/detect", {
        method: "POST",
        headers: {
          token: process.env.LUXAND_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          photo: base64Data,
        }),
      })

      console.log("Detect response status:", detectResponse.status)

      if (detectResponse.ok) {
        const detectResult = await detectResponse.json()
        console.log("Detect result:", detectResult)

        if (detectResult.length > 0) {
          return NextResponse.json({
            recognized: false,
            faceDetected: true,
            faceCount: detectResult.length,
            message: "New face detected - ready for registration",
            canRegister: true,
          })
        }
      }

      return NextResponse.json({
        recognized: false,
        faceDetected: false,
        message: "No face detected",
        canRegister: false,
      })
    }

    const recognitionResult = await recognizeResponse.json()
    console.log("Recognition result:", recognitionResult)

    if (recognitionResult.length > 0) {
      const match = recognitionResult[0]

      // Find user in our database by Luxand person ID
      const recognizedUser = userDatabase.find((user) => user.luxandPersonId === match.id)

      if (recognizedUser) {
        console.log(`User ${recognizedUser.name} recognized with confidence ${match.similarity}`)

        return NextResponse.json({
          recognized: true,
          user: recognizedUser.name,
          userId: recognizedUser.id,
          confidence: match.similarity || 0.95,
          timestamp: new Date().toISOString(),
        })
      } else {
        // Face recognized but not in our local database
        return NextResponse.json({
          recognized: false,
          faceDetected: true,
          message: "Face recognized by Luxand but not in local database",
          canRegister: false,
          luxandPersonId: match.id,
        })
      }
    }

    // No matches found, but let's check if there's a face
    const detectResponse = await fetch("https://api.luxand.cloud/photo/detect", {
      method: "POST",
      headers: {
        token: process.env.LUXAND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        photo: base64Data,
      }),
    })

    if (detectResponse.ok) {
      const detectResult = await detectResponse.json()
      if (detectResult.length > 0) {
        return NextResponse.json({
          recognized: false,
          faceDetected: true,
          message: "Face detected but not in database - ready for registration",
          canRegister: true,
        })
      }
    }

    return NextResponse.json({
      recognized: false,
      faceDetected: false,
      message: "No face detected",
      canRegister: false,
    })
  } catch (error) {
    console.error("Face detection error:", error)
    return NextResponse.json(
      {
        error: `Face detection failed: ${error.message}`,
      },
      { status: 500 },
    )
  }
}
