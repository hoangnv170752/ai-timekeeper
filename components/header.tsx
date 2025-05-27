"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Camera, Users, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'

export function Header() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <header className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center h-auto sm:h-16 gap-2 py-2 sm:py-0">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">CatchUp</h1>
              <p className="text-xs text-gray-500 dark:text-gray-300">AI-powered attendance system</p>
            </div>
          </div>

          {/* Navigation + Theme Switcher */}
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
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
            {/* Theme Switcher */}
            {mounted ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Toggle theme"
                className="ml-2"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-yellow-400" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-800" />
                )}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
