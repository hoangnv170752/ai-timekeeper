"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Camera, Users, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Header() {
  const pathname = usePathname()

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Face Recognition Timekeeper</h1>
              <p className="text-xs text-gray-500">AI-powered attendance system</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex gap-2">
            <Button asChild variant={pathname === "/" ? "default" : "ghost"} size="sm">
              <Link href="/" className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Dashboard
              </Link>
            </Button>

            <Button asChild variant={pathname === "/users" ? "default" : "ghost"} size="sm">
              <Link href="/users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Users
              </Link>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  )
}
