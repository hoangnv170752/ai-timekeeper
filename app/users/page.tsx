"use client"

import { useState, useRef } from "react"
import { Camera, UserPlus, Users, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function UsersPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [newUserName, setNewUserName] = useState("")
  const [isCapturing, setIsCapturing] = useState(false)
  const [users, setUsers] = useState([
    { id: "1", name: "John Doe", faceId: "face_001", addedAt: "2024-01-15" },
    { id: "2", name: "Jane Smith", faceId: "face_002", addedAt: "2024-01-16" },
    { id: "3", name: "Mike Johnson", faceId: "face_003", addedAt: "2024-01-17" },
  ])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
    }
  }

  const captureAndAddUser = async () => {
    if (!newUserName.trim()) {
      alert("Please enter a user name")
      return
    }

    setIsCapturing(true)

    try {
      // Capture frame
      const canvas = canvasRef.current
      const video = videoRef.current

      if (!canvas || !video) {
        alert("Camera not available")
        return
      }

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        alert("Canvas not available")
        return
      }

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)

      const imageData = canvas.toDataURL("image/jpeg", 0.8)

      // Use the same API route as the registration modal
      const response = await fetch("/api/register-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageData,
          name: newUserName.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Registration failed")
      }

      const result = await response.json()

      // Add to local state (in real app, save to database)
      const newUser = {
        id: result.user.id,
        name: result.user.name,
        faceId: result.user.faceId,
        addedAt: new Date().toISOString().split("T")[0],
      }

      setUsers((prev) => [...prev, newUser])
      setNewUserName("")
      alert(`User ${newUser.name} added successfully!`)
    } catch (error) {
      console.error("Error adding user:", error)
      alert(`Error adding user: ${error.message}`)
    } finally {
      setIsCapturing(false)
    }
  }

  const removeUser = (userId: string) => {
    setUsers((prev) => prev.filter((user) => user.id !== userId))
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4 min-h-full">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add New User */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Add New User
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="userName">User Name</Label>
                <Input
                  id="userName"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Enter user name"
                />
              </div>

              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-64 bg-black rounded-lg object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="flex gap-2">
                <Button onClick={startCamera} variant="outline" className="flex-1">
                  <Camera className="w-4 h-4 mr-2" />
                  Start Camera
                </Button>
                <Button onClick={captureAndAddUser} disabled={isCapturing || !newUserName.trim()} className="flex-1">
                  {isCapturing ? "Adding..." : "Capture & Add"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* User List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Registered Users ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-gray-500">Added: {user.addedAt}</div>
                    </div>
                    <Button onClick={() => removeUser(user.id)} variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                {users.length === 0 && <div className="text-center py-8 text-gray-500">No users registered yet</div>}
              </div>
            </CardContent>
          </Card>

          {/* Debug Panel */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Debug & Testing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/test-luxand")
                      const result = await response.json()
                      if (result.success) {
                        alert("✅ Luxand API connection successful!")
                      } else {
                        alert(`❌ Luxand API test failed: ${result.error}`)
                      }
                    } catch (error) {
                      alert(`❌ Test failed: ${error.message}`)
                    }
                  }}
                  variant="outline"
                >
                  Test Luxand Connection
                </Button>

                <Button
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/test-luxand")
                      const result = await response.json()
                      if (result.success) {
                        alert(`✅ Luxand API connected! Found ${result.subjectCount} registered faces.`)
                      } else {
                        alert(`❌ Luxand API test failed: ${result.error}`)
                      }
                    } catch (error) {
                      alert(`❌ Test failed: ${error.message}`)
                    }
                  }}
                  variant="outline"
                >
                  List Registered Faces
                </Button>
              </div>

              <div className="text-sm text-gray-600">
                <p>
                  <strong>Troubleshooting Tips:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>Ensure your face is well-lit and clearly visible</li>
                  <li>Look directly at the camera</li>
                  <li>Make sure the Luxand API key is correctly set</li>
                  <li>Check browser console for detailed error messages</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
