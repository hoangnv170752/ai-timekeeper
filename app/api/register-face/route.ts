import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    // Extract all parameters that might be passed from the client
    const { image, name, email, store, collections, unique } = await request.json()

    if (!image || !name) {
      return NextResponse.json({ error: "Image and name are required" }, { status: 400 })
    }

    if (!process.env.LUXAND_API_KEY) {
      console.error("LUXAND_API_KEY not found in environment variables")
      return NextResponse.json({ error: "Luxand API key not configured" }, { status: 500 })
    }

    // Properly format base64 data for Luxand API
    // Make sure to handle different possible formats of the incoming base64 data
    let base64Data = image;
    
    // If the image starts with a data URL prefix, remove it
    if (base64Data.startsWith('data:')) {
      base64Data = base64Data.replace(/^data:image\/[a-z]+;base64,/, "");
    }
    
    // Ensure there are no line breaks, spaces or other characters that could break JSON
    base64Data = base64Data.trim();
    
    // Generate a unique ID for this face
    const faceUuid = `face_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`


    console.log("Attempting to register face with Luxand...")

    // For Step 1, we use a simple JSON request with name parameter
    interface LuxandPersonRequest {
      name: string;
    }
    
    // Create the request body with proper typing for person creation
    const personRequestBody: LuxandPersonRequest = {
      name: name.trim()
    };
    
    // Step 1: Create a person entry with the correct parameter name (name, not subject)
    console.log("Step 1: Creating person entry with Luxand...")
    const createPersonResponse = await fetch("https://api.luxand.cloud/subject", {
      method: "POST",
      headers: {
        token: process.env.LUXAND_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(personRequestBody),
    })

    console.log("Person creation response status:", createPersonResponse.status)

    // Get the raw response text first for debugging
    const createPersonResponseText = await createPersonResponse.text()
    console.log("Raw create person response:", createPersonResponseText)
    
    if (!createPersonResponse.ok) {
      console.error("Luxand API error when creating person:", createPersonResponseText)
      return NextResponse.json(
        {
          error: `Failed to create person with Luxand: ${createPersonResponse.status} - ${createPersonResponseText}`,
        },
        { status: 500 },
      )
    }
    
    // Parse the create person response
    let createPersonResult
    try {
      createPersonResult = JSON.parse(createPersonResponseText)
      console.log("Person created:", createPersonResult)
    } catch (error: any) {
      console.error("Error parsing create person response:", error)
      return NextResponse.json(
        {
          error: `Error parsing Luxand create person response: ${error.message || 'Unknown error'}\nRaw response: ${createPersonResponseText}`,
        },
        { status: 500 },
      )
    }
    
    if (createPersonResult.status === 'failure') {
      console.error("Failed to create person:", createPersonResult.message)
      return NextResponse.json(
        {
          error: `Failed to create person: ${createPersonResult.message}`,
        },
        { status: 400 },
      )
    }
    
    // Make sure we have a valid ID
    if (!createPersonResult.id) {
      console.error("No ID returned from person creation")
      return NextResponse.json(
        {
          error: `No ID returned from Luxand API for person creation`,
        },
        { status: 500 },
      )
    }
    
    console.log("Step 2: Adding photo to the person with ID:", createPersonResult.id)
    
    // Create a multipart/form-data boundary
    const boundary = "----WebKitFormBoundary" + Math.random().toString(16).substring(2);
    
    // Create form parts
    const formParts = [];
    
    // Add store parameter if provided
    formParts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="store"\r\n\r\n` +
      `${store || "1"}\r\n`
    );
    
    // Add the photos part with the image file
    formParts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="photos"; filename="face.jpg"\r\n` +
      `Content-Type: image/jpeg\r\n\r\n`
    );
    
    // Create a Buffer for the base64 image data
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Create buffers for each part
    const textPartsBuffer = Buffer.from(formParts.join(''));
    const endBoundaryBuffer = Buffer.from(`\r\n--${boundary}--\r\n`);
    
    // Combine all buffers
    const requestBody = Buffer.concat([
      textPartsBuffer,
      imageBuffer,
      endBoundaryBuffer
    ]);
    
    // Use the exact endpoint from the example with the UUID, not the numeric ID
    const addPhotoResponse = await fetch(`https://api.luxand.cloud/v2/person/${createPersonResult.uuid}`, {
      method: "POST",
      headers: {
        token: process.env.LUXAND_API_KEY,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": requestBody.length.toString()
      },
      body: requestBody,
    })
    
    // Get the raw response text for debugging
    const addPhotoResponseText = await addPhotoResponse.text()
    console.log("Raw add photo response:", addPhotoResponseText)
    
    if (!addPhotoResponse.ok) {
      console.error("Luxand API error when adding photo:", addPhotoResponseText)
      return NextResponse.json(
        {
          error: `Failed to add photo to person: ${addPhotoResponse.status} - ${addPhotoResponseText}`,
        },
        { status: 500 },
      )
    }
    
    // Parse the add photo response
    let addPhotoResult
    try {
      addPhotoResult = JSON.parse(addPhotoResponseText)
      console.log("Photo added:", addPhotoResult)
    } catch (error: any) {
      console.error("Error parsing add photo response:", error)
      // Continue anyway as the person was created successfully
      console.log("Continuing with person creation even though photo addition parsing failed")
    }

    // Extract the person ID from the subject API response
    // This endpoint returns both a UUID and a numeric id
    let luxandPersonId = "";
    
    if (createPersonResult && typeof createPersonResult === 'object') {
      // IMPORTANT: Prioritize UUID over numeric ID as per the API docs
      luxandPersonId = createPersonResult.uuid || createPersonResult.id || createPersonResult.person_id;
      console.log("Created person with UUID:", createPersonResult.uuid);
      console.log("Created person with numeric ID:", createPersonResult.id);
    }
    
    // If we can't determine the ID, use our own UUID as fallback
    if (!luxandPersonId) {
      luxandPersonId = faceUuid;
      console.log("Using generated UUID as fallback ID:", luxandPersonId);
    }    
    const newUser = {
      id: Date.now().toString(),
      name: name.trim(),
      email: email?.trim() || null,
      faceId: luxandPersonId,
      luxandPersonId: luxandPersonId,
      registeredAt: new Date().toISOString(),
    }

    console.log("New user registered:", newUser)

    return NextResponse.json({
      success: true,
      user: newUser,
      message: `Successfully registered ${name}`,
    })
  } catch (error: any) {
    console.error("Face registration error:", error)
    return NextResponse.json(
      {
        error: `Face registration failed: ${error.message || 'Unknown error'}`,
      },
      { status: 500 }
    )
  }
}
