"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Phone, Video, Mic, MicOff, PhoneOff } from "lucide-react"
import socketManager from "@/lib/socket"
import WebRTCManager from "@/lib/webrtc"
import type { CallState } from "@/lib/webrtc"

export default function TestPage() {
  const [webrtcManager, setWebrtcManager] = useState<any>(null)
  const [callState, setCallState] = useState<CallState>({
    isIncoming: false,
    isOutgoing: false,
    isConnected: false,
    isMuted: false,
    isSpeakerOn: false,
    isVideoEnabled: true,
    localStream: null,
    remoteStream: null,
    callData: null
  })
  const [testUserId, setTestUserId] = useState("")
  const [logs, setLogs] = useState<string[]>([])
  const [deviceStatus, setDeviceStatus] = useState<any>(null)

  useEffect(() => {
    const socket = socketManager.connect()
    if (socket) {
      const webrtc = new WebRTCManager(socket)
      setWebrtcManager(webrtc)

      webrtc.onStateChange((state) => {
        setCallState(state)
        addLog(`Call state changed: ${JSON.stringify(state, null, 2)}`)
      })
    }

    // Test device permissions on load
    testDevicePermissions()
  }, [])

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testDevicePermissions = async () => {
    try {
      addLog("Testing device permissions...")
      
      // Test microphone
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStream.getTracks().forEach(track => track.stop())
      addLog("✓ Microphone access granted")
      
      // Test camera
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
      videoStream.getTracks().forEach(track => track.stop())
      addLog("✓ Camera access granted")
      
      setDeviceStatus({
        audio: true,
        video: true,
        message: "All devices working"
      })
    } catch (error) {
      addLog(`✗ Device test failed: ${error}`)
      setDeviceStatus({
        audio: false,
        video: false,
        message: `Error: ${error}`
      })
    }
  }

  const testVoiceCall = async () => {
    if (!testUserId.trim()) {
      addLog("Please enter a test user ID")
      return
    }

    addLog(`Testing voice call to: ${testUserId}`)
    addLog(`Socket status: ${JSON.stringify(socketManager.getConnectionStatus())}`)
    
    if (webrtcManager) {
      const success = await webrtcManager.startVoiceCall(testUserId)
      addLog(`Voice call result: ${success ? 'Success' : 'Failed'}`)
    } else {
      addLog("WebRTC manager not initialized")
    }
  }

  const testVideoCall = async () => {
    if (!testUserId.trim()) {
      addLog("Please enter a test user ID")
      return
    }

    addLog(`Testing video call to: ${testUserId}`)
    addLog(`Socket status: ${JSON.stringify(socketManager.getConnectionStatus())}`)
    
    if (webrtcManager) {
      const success = await webrtcManager.startVideoCall(testUserId)
      addLog(`Video call result: ${success ? 'Success' : 'Failed'}`)
    } else {
      addLog("WebRTC manager not initialized")
    }
  }

  const acceptCall = async () => {
    if (webrtcManager) {
      const success = await webrtcManager.acceptCall()
      addLog(`Accept call result: ${success ? 'Success' : 'Failed'}`)
    }
  }

  const rejectCall = () => {
    if (webrtcManager) {
      webrtcManager.rejectCall()
      addLog("Call rejected")
    }
  }

  const endCall = () => {
    if (webrtcManager) {
      webrtcManager.endCall()
      addLog("Call ended")
    }
  }

  const toggleMute = () => {
    if (webrtcManager) {
      webrtcManager.toggleMute()
      addLog("Mute toggled")
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">WebRTC Test Page</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Test Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="testUserId">Test User ID</Label>
              <Input
                id="testUserId"
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
                placeholder="Enter user ID to call"
              />
            </div>
            
            <div className="flex space-x-2">
              <Button onClick={testVoiceCall} disabled={!webrtcManager}>
                <Phone className="h-4 w-4 mr-2" />
                Test Voice Call
              </Button>
              <Button onClick={testVideoCall} disabled={!webrtcManager}>
                <Video className="h-4 w-4 mr-2" />
                Test Video Call
              </Button>
            </div>

            <div className="flex space-x-2">
              <Button onClick={acceptCall} disabled={!callState.isIncoming}>
                Accept Call
              </Button>
              <Button onClick={rejectCall} disabled={!callState.isIncoming} variant="outline">
                Reject Call
              </Button>
            </div>

            <div className="flex space-x-2">
              <Button onClick={endCall} disabled={!callState.isConnected} variant="destructive">
                <PhoneOff className="h-4 w-4 mr-2" />
                End Call
              </Button>
              <Button onClick={toggleMute} disabled={!callState.isConnected}>
                {callState.isMuted ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                {callState.isMuted ? 'Unmute' : 'Mute'}
              </Button>
            </div>

            <Button onClick={testDevicePermissions} variant="outline">
              Test Device Permissions
            </Button>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Connection Status</h3>
              <pre className="text-xs bg-gray-100 p-2 rounded">
                {JSON.stringify(socketManager.getConnectionStatus(), null, 2)}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Device Status</h3>
              <pre className="text-xs bg-gray-100 p-2 rounded">
                {JSON.stringify(deviceStatus, null, 2)}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Call State</h3>
              <pre className="text-xs bg-gray-100 p-2 rounded">
                {JSON.stringify(callState, null, 2)}
              </pre>
            </div>

            {webrtcManager && (
              <div>
                <h3 className="font-semibold mb-2">WebRTC Diagnostics</h3>
                <pre className="text-xs bg-gray-100 p-2 rounded">
                  {JSON.stringify(webrtcManager.getConnectionDiagnostics(), null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Logs */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Logs</CardTitle>
            <Button onClick={clearLogs} variant="outline" size="sm">
              Clear Logs
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-black text-green-400 p-4 rounded h-64 overflow-y-auto font-mono text-sm">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
            {logs.length === 0 && <div className="text-gray-500">No logs yet...</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 