import { NextResponse } from "next/server"

export async function GET() {
  try {
    if (!process.env.LUXAND_API_KEY) {
      return NextResponse.json(
        {
          error: "LUXAND_API_KEY not found in environment variables",
        },
        { status: 500 },
      )
    }

    // Test the Luxand API connection by listing subjects
    const response = await fetch("https://api.luxand.cloud/subject", {
      method: "GET",
      headers: {
        token: process.env.LUXAND_API_KEY,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        {
          error: `Luxand API test failed: ${response.status} - ${errorText}`,
          status: response.status,
        },
        { status: 500 },
      )
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      message: "Luxand API connection successful",
      subjectCount: result.length || 0,
      data: result,
    })
  } catch (error) {
    console.error("Luxand test error:", error)
    return NextResponse.json(
      {
        error: `Luxand test failed: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    )
  }
}
