"use client"

import { useState } from "react"
import { UserPlus, Camera, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"

interface RegisterFaceModalProps {
  isOpen: boolean
  onClose: () => void
  capturedImage: string | null
  onRegister: (name: string, email?: string) => Promise<void>
}

export function RegisterFaceModal({ isOpen, onClose, capturedImage, onRegister }: RegisterFaceModalProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [isRegistering, setIsRegistering] = useState(false)
  const [registrationStep, setRegistrationStep] = useState<"form" | "success">("form")

  const handleRegister = async () => {
    if (!name.trim()) return

    setIsRegistering(true)
    try {
      await onRegister(name.trim(), email.trim() || undefined)
      setRegistrationStep("success")

      // Auto close after success
      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch (error) {
      console.error("Registration failed:", error)
      alert("Registration failed. Please try again.")
    } finally {
      setIsRegistering(false)
    }
  }

  const handleClose = () => {
    setName("")
    setEmail("")
    setRegistrationStep("form")
    setIsRegistering(false)
    onClose()
  }

  if (registrationStep === "success") {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Registration Successful!</h3>
            <p className="text-gray-600">Welcome to the system, {name}!</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Register New Face
          </DialogTitle>
          <DialogDescription>
            We detected a new face! Please provide your details to register in the system.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Captured Face Preview */}
          {capturedImage && (
            <Card>
              <CardContent className="p-4">
                <div className="text-sm font-medium mb-2">Captured Face:</div>
                <img
                  src={capturedImage || "/placeholder.svg"}
                  alt="Captured face"
                  className="w-full h-32 object-cover rounded-lg bg-gray-100"
                />
              </CardContent>
            </Card>
          )}

          {/* Registration Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="register-name">Full Name *</Label>
              <Input
                id="register-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                disabled={isRegistering}
              />
            </div>

            <div>
              <Label htmlFor="register-email">Email (Optional)</Label>
              <Input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                disabled={isRegistering}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isRegistering} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleRegister} disabled={!name.trim() || isRegistering} className="flex-1">
              {isRegistering ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Registering...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Register Face
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
