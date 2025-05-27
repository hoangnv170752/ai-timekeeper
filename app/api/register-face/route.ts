import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { image, name, email } = await request.json()

    if (!image || !name) {
      return NextResponse.json({ error: "Image and name are required" }, { status: 400 })
    }

    if (!process.env.LUXAND_API_KEY) {
      console.error("LUXAND_API_KEY not found in environment variables")
      return NextResponse.json({ error: "Luxand API key not configured" }, { status: 500 })
    }

    // Convert base64 to blob for Luxand API
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, "")
    const uuid = `face_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    console.log("Attempting to detect face...")

    // First, detect if there's a face in the image using the correct endpoint
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

    if (!detectResponse.ok) {
      const errorText = await detectResponse.text()
      console.error("Luxand detect error:", errorText)
      return NextResponse.json(
        {
          error: `Face detection failed: ${detectResponse.status} - ${errorText}`,
        },
        { status: 400 },
      )
    }

    const detectResult = await detectResponse.json()
    console.log("Detect result:", detectResult)

    if (!detectResult || detectResult.length === 0) {
      return NextResponse.json(
        {
          error: "No face detected in the image. Please ensure your face is clearly visible and well-lit.",
        },
        { status: 400 },
      )
    }

    console.log("Face detected, attempting to save...")

    // Use the correct Luxand API endpoint for saving faces
    // First, we need to create a person/subject
    const createPersonResponse = await fetch("https://api.luxand.cloud/subject", {
      method: "POST",
      headers: {
        token: process.env.LUXAND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
        create_on_junk: false,
        create_on_ha: false,
        create_on_no_faces: false,
      }),
    })

    console.log("Create person response status:", createPersonResponse.status)

    if (!createPersonResponse.ok) {
      const errorText = await createPersonResponse.text()
      console.error("Luxand create person error:", errorText)
      return NextResponse.json(
        {
          error: `Failed to create person: ${createPersonResponse.status} - ${errorText}`,
        },
        { status: 500 },
      )
    }

    const personResult = await createPersonResponse.json()
    console.log("Person created:", personResult)

    // Now add the photo to the person
    const addPhotoResponse = await fetch(`https://api.luxand.cloud/subject/${personResult.id}`, {
      method: "POST",
      headers: {
        token: process.env.LUXAND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        photo: base64Data,
      }),
    })

    console.log("Add photo response status:", addPhotoResponse.status)

    if (!addPhotoResponse.ok) {
      const errorText = await addPhotoResponse.text()
      console.error("Luxand add photo error:", errorText)

      // Try to clean up the created person if photo addition fails
      try {
        await fetch(`https://api.luxand.cloud/subject/${personResult.id}`, {
          method: "DELETE",
          headers: {
            token: process.env.LUXAND_API_KEY,
          },
        })
      } catch (cleanupError) {
        console.error("Failed to cleanup person:", cleanupError)
      }

      return NextResponse.json(
        {
          error: `Failed to add photo to person: ${addPhotoResponse.status} - ${errorText}`,
        },
        { status: 500 },
      )
    }

    const photoResult = await addPhotoResponse.json()
    console.log("Photo added:", photoResult)

    // Create user object
    const newUser = {
      id: Date.now().toString(),
      name: name.trim(),
      email: email?.trim() || null,
      faceId: personResult.id, // Use the person ID as face ID
      luxandPersonId: personResult.id,
      registeredAt: new Date().toISOString(),
    }

    console.log("New user registered:", newUser)

    return NextResponse.json({
      success: true,
      user: newUser,
      message: `Successfully registered ${name}`,
    })
  } catch (error) {
    console.error("Face registration error:", error)
    return NextResponse.json(
      {
        error: `Face registration failed: ${error.message}`,
      },
      { status: 500 },
    )
  }
}
