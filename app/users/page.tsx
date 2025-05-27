"use client"

import { useState, useRef, useEffect } from "react"
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
  const [users, setUsers] = useState<any[]>([])
  const [showFacesModal, setShowFacesModal] = useState(false)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/face-detection")
        const data = await res.json()
        if (data.success) {
          setUsers(data.data)
        }
      } catch (error) {
        // Optionally handle error
      }
    }
    fetchUsers()
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (error: any) {
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

      // First, register the face with Luxand API via our API endpoint
      const luxandResponse = await fetch("/api/register-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageData,
          name: newUserName.trim(),
          store: "1",           // Use default store
          collections: "",      // No specific collections
          unique: "0"           // Allow duplicates
        }),
      })

      if (!luxandResponse.ok) {
        const errorText = await luxandResponse.text();
        console.error("Luxand API error response:", errorText);
        let errorMessage;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || "Luxand registration failed";
        } catch (parseError) {
          errorMessage = errorText || "Luxand registration failed";
        }
        
        throw new Error(errorMessage);
      }
      
      // Now safe to parse JSON response
      const luxandResult = await luxandResponse.json();
      
      console.log("Luxand registration successful:", luxandResult)
      
      const response = await fetch("/api/face-detection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          face: imageData,
          name: newUserName.trim(),
          luxandPersonId: luxandResult.luxandPersonId || luxandResult.id,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "MongoDB registration failed")
      }

      setNewUserName("")
      alert(`User ${result.data.name} added successfully to both Luxand and MongoDB!`)

      // Refetch users from MongoDB
      const res = await fetch("/api/face-detection")
      const data = await res.json()
      if (data.success) {
        setUsers(data.data)
      }
    } catch (error: any) {
      console.error("Error adding user:", error)
      alert(`Error adding user: ${error.message}`)
    } finally {
      setIsCapturing(false)
    }
  }

  const removeUser = (userId: string) => {
    setUsers((prev) => prev.filter((user) => user._id !== userId))
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-800 min-h-screen flex flex-col">
      <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col p-2 sm:p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
          {/* Add New User */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground dark:text-gray-100">
                <UserPlus className="w-5 h-5" />
                Add New User
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="userName" className="text-foreground dark:text-gray-200">User Name</Label>
                <Input
                  id="userName"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Enter user name"
                  className="text-foreground dark:text-gray-100"
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
              <CardTitle className="flex items-center gap-2 text-foreground dark:text-gray-100">
                <Users className="w-5 h-5" />
                Registered Users ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {users.map((user) => (
                  <div key={user._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      {user.face && (
                        <img
                          src={user.face}
                          alt={user.name}
                          className="w-10 h-10 rounded-full object-cover border border-gray-300 dark:border-gray-700"
                        />
                      )}
                      <div>
                        <div className="font-medium text-foreground dark:text-gray-100">{user.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-300">Added: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ''}</div>
                      </div>
                    </div>
                    <Button onClick={() => removeUser(user._id)} variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                {users.length === 0 && <div className="text-center py-8 text-gray-500 dark:text-gray-300">No users registered yet</div>}
              </div>
            </CardContent>
          </Card>

          {/* Debug Panel - only show in development */}
          {process.env.NODE_ENV !== 'production' && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground dark:text-gray-100">
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
                      } catch (error: any) {
                        alert(`❌ Test failed: ${error.message}`)
                      }
                    }}
                    variant="outline"
                  >
                    Test Luxand Connection
                  </Button>

                  <Button
                    onClick={() => setShowFacesModal(true)}
                    variant="outline"
                  >
                    List Registered Faces
                  </Button>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-300">
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
          )}
        </div>
      </div>

      {showFacesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 max-w-lg w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Registered Faces</h2>
              <Button size="sm" variant="outline" onClick={() => setShowFacesModal(false)}>Close</Button>
            </div>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {users.length === 0 && <div className="text-gray-500 dark:text-gray-300">No users registered yet</div>}
              {users.map((user) => (
                <div key={user._id} className="flex items-center gap-3 p-2 border-b border-gray-200 dark:border-gray-700">
                  {user.face && (
                    <img src={user.face} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-gray-300 dark:border-gray-700" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-300">Added: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ''}</div>
                    {user.code && <div className="text-xs text-gray-400">Code: {user.code}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
