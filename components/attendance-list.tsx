"use client"

import { useState, useEffect } from "react"
import { Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface AttendanceRecord {
  id: string
  userId: string
  userName: string
  checkinTime: string
  note: string
  timestamp: string
  isCheckOut?: boolean
}

export function AttendanceList({ roomId = "7e20a2de-3aa8-11f0-8493-0242ac160002" }) {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchAttendanceRecords = async () => {
    try {
      setIsLoading(true)
      const url = new URL("/api/get-attendance", window.location.origin)
      if (roomId) {
        url.searchParams.append("roomId", roomId)
      }
      
      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error(`Failed to fetch attendance: ${response.status}`)
      }
      
      const data = await response.json()
      if (data.success && data.attendanceRecords) {
        setAttendanceRecords(data.attendanceRecords)
        console.log("Fetched attendance records:", data.attendanceRecords)
      }
    } catch (error) {
      console.error("Error fetching attendance:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch attendance records on component mount
  useEffect(() => {
    fetchAttendanceRecords()
  }, [roomId])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Attendance Records
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : attendanceRecords.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {attendanceRecords.map((record) => (
              <div key={record.id} className="flex items-center justify-between p-2 rounded bg-gray-50 hover:bg-gray-100 transition-colors">
                <div>
                  <div className="font-medium">{record.userName}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(record.checkinTime).toLocaleString()}
                  </div>
                </div>
                <Badge 
                  variant={record.isCheckOut ? "destructive" : "default"} 
                  className="text-xs"
                >
                  {record.isCheckOut ? "Check-out" : "Check-in"}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <Users className="w-10 h-10 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No attendance records yet</p>
            <p className="text-xs text-gray-400 mt-1">Records will appear here when faces are recognized</p>
          </div>
        )}
        <Button 
          size="sm" 
          variant="outline" 
          onClick={fetchAttendanceRecords} 
          disabled={isLoading}
          className="w-full mt-2">
          {isLoading ? "Refreshing..." : "Refresh Attendance List"}
        </Button>
      </CardContent>
    </Card>
  )
}
