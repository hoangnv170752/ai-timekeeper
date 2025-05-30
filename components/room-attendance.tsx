"use client"

import { useState, useEffect } from "react"
import { Users, Clock, ArrowDownUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface RoomAttendanceProps {
  defaultRoomId?: string
}

export function RoomAttendance({ defaultRoomId = "7e20a2de-3aa8-11f0-8493-0242ac160002" }: RoomAttendanceProps) {
  // Room IDs
  const checkInRoomId = "7e20a2de-3aa8-11f0-8493-0242ac160002";
  const checkOutRoomId = "7e20a2de-3aa8-11f0-8493-0242ac160002";
  
  const [currentRoomId, setCurrentRoomId] = useState(defaultRoomId);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const fetchRoomAttendance = async (roomId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setWarning(null);
      
      const url = new URL("/api/get-room-attendance", window.location.origin);
      url.searchParams.append("roomId", roomId);
      
      console.log(`Fetching room attendance for room ID: ${roomId}`);
      const response = await fetch(url.toString());
      
      // Always get the response as text first for debugging
      const responseText = await response.text();
      console.log(`Room attendance API response (status ${response.status}):\n`, responseText);
      
      // Try to parse the response as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Error parsing API response:", parseError);
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
      }
      
      if (data.success) {
        setAttendanceData(data);
        console.log("Fetched room attendance:", data);
        
        // Check for warnings
        if (data.warning) {
          console.warn("API warning:", data.warning);
          setWarning(data.warning);
        }
      } else {
        // Handle API error response
        setError(data.error || "Failed to fetch room attendance");
        
        // If there's a raw response included, log it for debugging
        if (data.rawResponse) {
          console.log("Raw API response:", data.rawResponse);
        }
      }
    } catch (error: any) {
      console.error("Error fetching room attendance:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch attendance data when component mounts or room ID changes
  useEffect(() => {
    fetchRoomAttendance(currentRoomId);
  }, [currentRoomId]);

  const handleTabChange = (value: string) => {
    const roomId = value === "check-in" ? checkInRoomId : checkOutRoomId;
    setCurrentRoomId(roomId);
  };

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return timestamp;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Room Attendance
          </div>
          <Badge variant="outline" className="ml-2">
            {attendanceData?.roomType === 'check-out' ? 'Check-out Room' : 'Check-in Room'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="check-in" onValueChange={handleTabChange} className="mb-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="check-in">Check-in Room</TabsTrigger>
            <TabsTrigger value="check-out">Check-out Room</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="font-medium text-red-500">Error loading attendance data</p>
            <p className="text-sm text-red-400 mt-1">{error}</p>
            <div className="mt-4 p-2 bg-gray-50 rounded-md text-left">
              <p className="text-xs text-gray-500 mb-1">Debugging information:</p>
              <p className="text-xs text-gray-600">Room ID: {currentRoomId}</p>
              <p className="text-xs text-gray-600">
                Room type: {currentRoomId === checkOutRoomId ? 'Check-out' : 'Check-in'}
              </p>
              <p className="text-xs text-gray-600">Time: {new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        ) : attendanceData?.attendanceData?.length > 0 ? (
          <>
            {warning && (
              <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-xs text-yellow-700 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {warning}
                </p>
              </div>
            )}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {attendanceData.attendanceData.map((person: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 rounded bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div>
                    <div className="font-medium">{person.name || person.uuid}</div>
                    {person.check_in_time && (
                      <div className="text-xs text-gray-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatTime(person.check_in_time)}
                      </div>
                    )}
                  </div>
                  <Badge 
                    variant={attendanceData.roomType === 'check-out' ? "destructive" : "default"}
                    className="text-xs"
                  >
                    {attendanceData.roomType === 'check-out' ? "Checked Out" : "Checked In"}
                  </Badge>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <Users className="w-10 h-10 text-gray-300 mb-2" />
            {warning ? (
              <>
                <p className="text-sm text-yellow-600">Data may be incomplete</p>
                <p className="text-xs text-yellow-500 mt-1">{warning}</p>
                <p className="text-xs text-gray-400 mt-3">
                  Try refreshing or selecting a different room
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500">No attendance records in this room</p>
                <p className="text-xs text-gray-400 mt-1">
                  {attendanceData?.roomType === 'check-out' 
                    ? 'No one has checked out yet' 
                    : 'No one has checked in yet'}
                </p>
              </>
            )}
          </div>
        )}
        
        <Button 
          size="sm" 
          variant="outline" 
          onClick={() => fetchRoomAttendance(currentRoomId)} 
          disabled={isLoading}
          className="w-full mt-4">
          {isLoading ? "Refreshing..." : "Refresh Attendance"}
        </Button>
      </CardContent>
    </Card>
  );
}
