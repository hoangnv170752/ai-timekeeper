import { type NextRequest, NextResponse } from "next/server"
import { OpenAI } from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { userName, time, isDetected } = await request.json()

    const currentTime = new Date(time)
    const hour = currentTime.getHours()
    const dayOfWeek = currentTime.toLocaleDateString("en-US", { weekday: "long" })

    let timeOfDay = "morning"
    if (hour >= 12 && hour < 17) timeOfDay = "afternoon"
    else if (hour >= 17) timeOfDay = "evening"

    let prompt = ""
    if (isDetected) {
      prompt = `Generate a warm, personalized greeting for ${userName} who just checked in to work. 
      It's ${timeOfDay} on a ${dayOfWeek}. 
      Make it friendly, professional, and motivating. 
      Keep it under 50 words and include something about the day or time.
      Make it sound natural for text-to-speech.`
    } else {
      prompt = `Generate a friendly message for when no face is detected in the camera. 
      It's ${timeOfDay} on a ${dayOfWeek}. 
      Make it encouraging and guide the user to position themselves in front of the camera.
      Keep it under 30 words and make it sound natural for text-to-speech.`
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: isDetected
            ? "You are a friendly AI assistant that creates personalized workplace greetings. Be warm, professional, and encouraging."
            : "You are a helpful AI assistant that guides users to properly position themselves for face detection. Be friendly and encouraging.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 100,
      temperature: 0.7,
    })

    const greeting = completion.choices[0]?.message?.content || 
      (isDetected 
        ? `Good ${timeOfDay}, ${userName}! Welcome back!` 
        : "Please position yourself in front of the camera for detection.")

    return NextResponse.json({
      greeting,
      userName,
      timestamp: currentTime.toISOString(),
    })
  } catch (error) {
    console.error("Greeting generation error:", error)
    return NextResponse.json({ error: "Failed to generate greeting" }, { status: 500 })
  }
}
