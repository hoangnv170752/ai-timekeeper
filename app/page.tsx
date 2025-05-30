"use client"

import { useState, useRef, useEffect } from "react"
import { Camera, Users, Clock, Mic, MicOff, Play, Square, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RegisterFaceModal } from "@/components/register-face-modal"
import { AttendanceList } from "@/components/attendance-list"
import { RoomAttendance } from "@/components/room-attendance"

export default function Dashboard() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [recognizedUser, setRecognizedUser] = useState<string | null>(null)
  const [greeting, setGreeting] = useState<string>("")
  const [isGeneratingGreeting, setIsGeneratingGreeting] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [detectionInterval, setDetectionInterval] = useState<NodeJS.Timeout | null>(null)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [capturedImageForRegistration, setCapturedImageForRegistration] = useState<string | null>(null)
  const [lastDetectionResult, setLastDetectionResult] = useState<any>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isManualDetecting, setIsManualDetecting] = useState(false)
  const [detectionHistory, setDetectionHistory] = useState<string[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([])

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Fetch attendance records function
  const fetchAttendanceRecords = async (roomId?: string) => {
    try {
      const url = new URL("/api/get-attendance", window.location.origin);
      if (roomId) {
        url.searchParams.append("roomId", roomId);
      }
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Failed to fetch attendance: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && data.attendanceRecords) {
        setAttendanceRecords(data.attendanceRecords);
        console.log("Fetched attendance records:", data.attendanceRecords);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  }

  // Initialize camera and fetch attendance on component mount
  useEffect(() => {
    startCamera();
    fetchAttendanceRecords("7e20a2de-3aa8-11f0-8493-0242ac160002"); // Fetch for Event 27th May
    
    return () => {
      stopCamera();
      if (detectionInterval) {
        clearInterval(detectionInterval);
      }
    };
  }, [])

  const startCamera = async () => {
    try {
      console.log("Starting camera...")

      // Stop existing stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsCameraActive(true)
        console.log("Camera started successfully")

        // Add to detection history
        setDetectionHistory((prev) => [`${new Date().toLocaleTimeString()}: Camera started`, ...prev.slice(0, 4)])
      }
    } catch (error: any) {
      console.error("Error accessing camera:", error)
      setIsCameraActive(false)
      setDetectionHistory((prev) => [
        `${new Date().toLocaleTimeString()}: Camera failed - ${error.message}`,
        ...prev.slice(0, 4),
      ])
      alert("Failed to access camera. Please ensure camera permissions are granted.")
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraActive(false)
    setDetectionHistory((prev) => [`${new Date().toLocaleTimeString()}: Camera stopped`, ...prev.slice(0, 4)])
    console.log("Camera stopped")
  }

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isCameraActive) {
      console.log("Camera not ready for capture")
      return null
    }

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      console.log("Canvas context not available")
      return null
    }

    // Ensure video is loaded and has dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log("Video not ready - no dimensions")
      return null
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    const imageData = canvas.toDataURL("image/jpeg", 0.8)
    console.log("Frame captured successfully")
    return imageData
  }

  const detectFace = async (isManual = false) => {
    console.log(`Starting ${isManual ? "manual" : "automatic"} face detection...`)

    if (isManual) {
      setIsManualDetecting(true)
    }

    if (!isCameraActive) {
      console.log("Camera not active, skipping detection")
      setDetectionHistory((prev) => [
        `${new Date().toLocaleTimeString()}: Detection failed - Camera not active`,
        ...prev.slice(0, 4),
      ])
      if (isManual) setIsManualDetecting(false)
      return
    }

    const imageData = captureFrame()
    if (!imageData) {
      console.log("Failed to capture frame")
      setDetectionHistory((prev) => [
        `${new Date().toLocaleTimeString()}: Detection failed - No frame captured`,
        ...prev.slice(0, 4),
      ])
      if (isManual) setIsManualDetecting(false)
      return
    }

    try {
      console.log("Sending image to detection API...")
      setDetectionHistory((prev) => [`${new Date().toLocaleTimeString()}: Analyzing frame...`, ...prev.slice(0, 4)])

      // Use the new v2 endpoint that correctly implements Luxand face recognition
      // Pass the roomId for Event 27th May to enable automatic attendance recording
      const response = await fetch("/api/detect-face-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          image: imageData,
          roomId: "7e20a2de-3aa8-11f0-8493-0242ac160002" // Event 27th May room ID
        }),
      })

      if (!response.ok) {
        throw new Error(`API response: ${response.status}`)
      }

      const result = await response.json()
      console.log("Detection result:", result)
      
      if (result.luxandResult) {
        if (Array.isArray(result.luxandResult)) {
          console.log("Processing array format Luxand result");
          result.luxandProcessedResult = result.luxandResult.map((match: any) => ({
            name: match.name,
            probability: match.probability,
            uuid: match.uuid,
            rectangle: match.rectangle || null
          }));
        }
        else if (result.luxandResult.faces && result.luxandResult.faces.length > 0) {
          console.log("Processing faces array format Luxand result");
          const faceWithMatches = result.luxandResult.faces.find((face: any) => 
            face.status === "success" && face.matches && face.matches.length > 0
          );
          
          if (faceWithMatches && faceWithMatches.matches && faceWithMatches.matches.length > 0) {
            result.luxandProcessedResult = faceWithMatches.matches.map((match: any) => ({
              name: match.name,
              probability: match.similarity,
              uuid: match.person_id,
              rectangle: faceWithMatches.bbox ? {
                left: faceWithMatches.bbox.x,
                top: faceWithMatches.bbox.y,
                right: faceWithMatches.bbox.x + faceWithMatches.bbox.width,
                bottom: faceWithMatches.bbox.y + faceWithMatches.bbox.height
              } : null
            }));
          }
        }
      }
      
      setLastDetectionResult(result)

      if (result.recognized && result.user) {
        setRecognizedUser(result.user)
        setLastDetectionResult(result)
        
        let statusMessage = `✅ Recognized ${result.user}`
        
        if (result.luxandResult && result.luxandResult.length > 0) {
          const match = result.luxandResult[0]
          if (match.probability !== undefined) {
            const confidence = (match.probability * 100).toFixed(2)
            statusMessage += ` (${confidence}% confidence)`
          }
          if (match.uuid) {
            statusMessage += ` [UUID: ${match.uuid}]`
          }
        }
        
        setDetectionHistory((prev) => [
          `${new Date().toLocaleTimeString()}: ${statusMessage}`,
          ...prev.slice(0, 4),
        ])
        
        // If attendance was recorded, refresh the attendance list
        if (result.attendanceRecorded) {
          fetchAttendanceRecords("7e20a2de-3aa8-11f0-8493-0242ac160002")
        }
        
        await generateGreeting(result.user, true)
        setShowRegisterModal(false)
      } else if (result.faceDetected && !result.recognized) {
        setRecognizedUser(null)
        setLastDetectionResult(result)
        setGreeting("")
        setCapturedImageForRegistration(imageData)
        setDetectionHistory((prev) => [
          `${new Date().toLocaleTimeString()}: 👤 Unknown face detected`,
          ...prev.slice(0, 4),
        ])
        setShowRegisterModal(true)
      } else if (result.error) {
        setRecognizedUser(null)
        setLastDetectionResult(result)
        setDetectionHistory((prev) => [
          `${new Date().toLocaleTimeString()}: ❌ Error: ${result.error}`,
          ...prev.slice(0, 4),
        ])
      } else {
        setRecognizedUser(null)
        setLastDetectionResult(result)
        setGreeting("")
        setShowRegisterModal(false)
        setDetectionHistory((prev) => [`${new Date().toLocaleTimeString()}: 🔍 No face detected`, ...prev.slice(0, 4)])
        await generateGreeting("", false)
      }
    } catch (error: any) {
      console.error("Face detection error:", error)
      setLastDetectionResult({ error: error.message })
      setDetectionHistory((prev) => [
        `${new Date().toLocaleTimeString()}: ❌ API Error: ${error.message}`,
        ...prev.slice(0, 4),
      ])
    } finally {
      if (isManual) {
        setIsManualDetecting(false)
      }
    }
  }

  const generateGreeting = async (userName: string, isDetected: boolean) => {
    setIsGeneratingGreeting(true)
    try {
      const response = await fetch("/api/generate-greeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userName, 
          time: new Date().toISOString(),
          isDetected 
        }),
      })

      const result = await response.json()
      setGreeting(result.greeting)

      // Auto-play the greeting
      await speakGreeting(result.greeting)
    } catch (error: any) {
      console.error("Greeting generation error:", error)
    } finally {
      setIsGeneratingGreeting(false)
    }
  }

  const speakGreeting = async (text: string) => {
    if (!text) return

    setIsSpeaking(true)
    try {
      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })

      if (response.ok) {
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)

        audio.onended = () => {
          setIsSpeaking(false)
          URL.revokeObjectURL(audioUrl)
        }

        await audio.play()
      }
    } catch (error: any) {
      console.error("Text-to-speech error:", error)
      setIsSpeaking(false)
    }
  }

  const handleRegisterFace = async (name: string, email?: string) => {
    if (!capturedImageForRegistration) {
      throw new Error("No captured image available")
    }

    try {
      const response = await fetch("/api/register-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: capturedImageForRegistration,
          name,
          email,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Registration failed")
      }

      const result = await response.json()
      setDetectionHistory((prev) => [`${new Date().toLocaleTimeString()}: ✅ Registered ${name}`, ...prev.slice(0, 4)])

      // Generate a welcome greeting for the new user
      await generateGreeting(name, true)
      setRecognizedUser(name)

      return result
    } catch (error: any) {
      console.error("Registration error:", error)
      setDetectionHistory((prev) => [
        `${new Date().toLocaleTimeString()}: ❌ Registration failed: ${error.message}`,
        ...prev.slice(0, 4),
      ])
      throw error
    }
  }

  const toggleDetection = () => {
    if (isDetecting) {
      if (detectionInterval) {
        clearInterval(detectionInterval)
        setDetectionInterval(null)
      }
      setIsDetecting(false)
      setDetectionHistory((prev) => [`${new Date().toLocaleTimeString()}: Auto-detection stopped`, ...prev.slice(0, 4)])
      console.log("Detection stopped")
    } else {
      if (!isCameraActive) {
        alert("Please start the camera first")
        return
      }

      console.log("Starting detection loop...")
      setDetectionHistory((prev) => [`${new Date().toLocaleTimeString()}: Auto-detection started (10 second interval)`, ...prev.slice(0, 4)])
      const interval = setInterval(() => detectFace(false), 10000) // Check every 10 seconds
      setDetectionInterval(interval)
      setIsDetecting(true)

      // Run first detection immediately
      detectFace(false)
    }
  }

  const handleCameraToggle = () => {
    if (isCameraActive) {
      stopCamera()
      // Also stop detection if running
      if (isDetecting) {
        toggleDetection()
      }
    } else {
      startCamera()
    }
  }

  const handleManualDetect = () => {
    detectFace(true) // Pass true to indicate manual detection
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-800 min-h-screen flex flex-col">
      <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col p-2 sm:p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
          {/* Main Camera View */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Live Camera
                  <Badge variant={isCameraActive ? "default" : "secondary"} className="ml-auto">
                    {isCameraActive ? "Active" : "Inactive"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-96 bg-black rounded-lg object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Detection Status Overlay */}
                  <div className="absolute top-4 left-4 flex gap-2">
                    <Badge variant={isDetecting ? "default" : "secondary"}>
                      {isDetecting ? "Auto-Detecting..." : "Auto-Detection Off"}
                    </Badge>
                    {isManualDetecting && (
                      <Badge variant="default" className="bg-blue-500">
                        Manual Detecting...
                      </Badge>
                    )}
                  </div>

                  {/* Recognition Status */}
                  {recognizedUser && (
                    <div className="absolute top-4 right-4">
                      <Badge variant="default" className="bg-green-500">
                        <Users className="w-4 h-4 mr-1" />
                        {recognizedUser}
                      </Badge>
                    </div>
                  )}

                  {/* Camera inactive overlay */}
                  {!isCameraActive && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                      <div className="text-white text-center">
                        <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Camera is not active</p>
                        <p className="text-sm opacity-75">Click "Start Camera" to begin</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 mt-4">
                  <Button
                    onClick={handleCameraToggle}
                    variant={isCameraActive ? "destructive" : "default"}
                    className="flex-1"
                  >
                    {isCameraActive ? (
                      <>
                        <Square className="w-4 h-4 mr-2" />
                        Stop Camera
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Camera
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={toggleDetection}
                    variant={isDetecting ? "destructive" : "default"}
                    disabled={!isCameraActive}
                    className="flex-1"
                  >
                    {isDetecting ? "Stop Auto-Detection" : "Start Auto-Detection"}
                  </Button>

                  <Button
                    onClick={handleManualDetect}
                    variant="outline"
                    disabled={!isCameraActive || isManualDetecting}
                    title="Capture and analyze a single frame for face detection"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {isManualDetecting ? "Detecting..." : "Manual Detect"}
                  </Button>
                </div>

                {/* Detection explanation */}
                <div className="mt-2 text-sm text-gray-600">
                  <p>
                    <strong>Manual Detect:</strong> Captures one frame and checks for faces immediately
                  </p>
                  <p>
                    <strong>Auto-Detection:</strong> Continuously checks for faces every 10 seconds
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6 mt-6 lg:mt-0">
            {/* Current Time */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Current Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono">{currentTime.toLocaleTimeString()}</div>
                <div className="text-sm text-gray-500">{currentTime.toLocaleDateString()}</div>
              </CardContent>
            </Card>

            {/* Recognition Status */}
            <Card>
              <CardHeader>
                <CardTitle>Recognition Status</CardTitle>
              </CardHeader>
              <CardContent>
                {!isCameraActive ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                      <span className="font-medium">Camera Inactive</span>
                    </div>
                    <p className="text-sm text-gray-600">Start the camera to begin face detection</p>
                  </div>
                ) : recognizedUser ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="font-medium">User Recognized</span>
                    </div>
                    <p className="text-sm text-gray-600">Welcome back, {recognizedUser}!</p>
                    {lastDetectionResult?.confidence && (
                      <p className="text-xs text-gray-500">
                        Confidence: {(lastDetectionResult.confidence * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                ) : lastDetectionResult?.faceDetected ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                      <span className="font-medium">Unknown Face Detected</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {showRegisterModal ? "Registration modal is open" : "Face detected but not in database"}
                    </p>
                    {!showRegisterModal && (
                      <Button size="sm" onClick={() => setShowRegisterModal(true)} className="w-full mt-2">
                        Register This Face
                      </Button>
                    )}
                  </div>
                ) : lastDetectionResult?.error ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="font-medium">Detection Error</span>
                    </div>
                    <p className="text-sm text-gray-600">{lastDetectionResult.error}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                      <span className="font-medium">No User Detected</span>
                    </div>
                    <p className="text-sm text-gray-600">Position yourself in front of the camera</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detection History */}
            <Card>
              <CardHeader>
                <CardTitle>Detection History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {detectionHistory.length > 0 ? (
                    detectionHistory.map((entry, index) => (
                      <div key={index} className="text-sm">{entry}</div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No detection history yet</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Room Attendance from Luxand API */}
            <RoomAttendance />

            {/* AI Greeting */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="w-5 h-5" />
                  AI Greeting
                  {isSpeaking && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isGeneratingGreeting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">Generating greeting...</span>
                  </div>
                ) : greeting ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <p className="text-sm transition-opacity duration-300">{greeting}</p>
                      {isSpeaking && (
                        <div className="absolute -right-2 -top-2 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
                      )}
                    </div>
                    <Button
                      onClick={() => speakGreeting(greeting)}
                      variant="outline"
                      size="sm"
                      disabled={isSpeaking}
                      className="w-full transition-all duration-300 hover:scale-105"
                    >
                      {isSpeaking ? (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                          <span>Speaking...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Mic className="w-4 h-4" />
                          <span>Replay Greeting</span>
                        </div>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">Greeting will appear when a user is recognized</p>
                    <div className="mt-2 flex justify-center gap-1">
                      <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0s" }}></div>
                      <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                      <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Attendance Records */}
            <AttendanceList />
          </div>
        </div>
      </div>
      {/* Registration Modal */}
      <RegisterFaceModal
        isOpen={showRegisterModal}
        onClose={() => {
          setShowRegisterModal(false)
          setCapturedImageForRegistration(null)
        }}
        capturedImage={capturedImageForRegistration}
        onRegister={handleRegisterFace}
      />
    </div>
  )
}
