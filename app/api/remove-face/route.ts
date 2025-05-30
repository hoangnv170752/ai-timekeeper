import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { luxandPersonId } = await request.json()

    if (!luxandPersonId) {
      return NextResponse.json({ error: "Luxand person ID is required" }, { status: 400 })
    }

    if (!process.env.LUXAND_API_KEY) {
      return NextResponse.json({ error: "Luxand API key not configured" }, { status: 500 })
    }

    // Delete the person from Luxand
    const deleteResponse = await fetch(`https://api.luxand.cloud/subject/${luxandPersonId}`, {
      method: "DELETE",
      headers: {
        token: process.env.LUXAND_API_KEY,
      },
    })

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text()
      console.error("Luxand delete error:", errorText)
      return NextResponse.json(
        {
          error: `Failed to delete from Luxand: ${deleteResponse.status} - ${errorText}`,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: "User removed from Luxand successfully",
    })
  } catch (error) {
    console.error("Remove face error:", error)
    return NextResponse.json(
      {
        error: `Failed to remove face: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    )
  }
}
