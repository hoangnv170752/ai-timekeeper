import { type NextRequest, NextResponse } from "next/server"
import { OpenAI } from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { userName, time } = await request.json()

    if (!userName) {
      return NextResponse.json({ error: "No user name provided" }, { status: 400 })
    }

    const currentTime = new Date(time)
    const hour = currentTime.getHours()
    const dayOfWeek = currentTime.toLocaleDateString("en-US", { weekday: "long" })

    let timeOfDay = "morning"
    if (hour >= 12 && hour < 17) timeOfDay = "afternoon"
    else if (hour >= 17) timeOfDay = "evening"

    const prompt = `Generate a warm, personalized greeting for ${userName} who just checked in to work. 
    It's ${timeOfDay} on a ${dayOfWeek}. 
    Make it friendly, professional, and motivating. 
    Keep it under 50 words and include something about the day or time.
    Make it sound natural for text-to-speech.`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a friendly AI assistant that creates personalized workplace greetings. Be warm, professional, and encouraging.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 100,
      temperature: 0.7,
    })

    const greeting = completion.choices[0]?.message?.content || `Good ${timeOfDay}, ${userName}! Welcome back!`

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
