"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react'
import WebRTCManager from '@/lib/webrtc'
import socketManager from '@/lib/socket'

export default function WebRTCTest() {
  const [webrtcManager, setWebrtcManager] = useState<WebRTCManager | null>(null)
  const [callState, setCallState] = useState<any>(null)
  const [testUserId, setTestUserId] = useState('test-user-2')

  useEffect(() => {
    const socket = socketManager.connect()
    if (socket) {
      const webrtc = new WebRTCManager(socket)
      setWebrtcManager(webrtc)
      
      webrtc.onStateChange((state) => {
        setCallState(state)
        console.log('Call state changed:', state)
      })
    }

    return () => {
      if (webrtcManager) {
        webrtcManager.endCall()
      }
    }
  }, [])

  const startVoiceCall = async () => {
    if (webrtcManager) {
      const success = await webrtcManager.startVoiceCall(testUserId)
      console.log('Voice call started:', success)
    }
  }

  const acceptCall = async () => {
    if (webrtcManager) {
      const success = await webrtcManager.acceptCall()
      console.log('Call accepted:', success)
    }
  }

  const rejectCall = () => {
    if (webrtcManager) {
      webrtcManager.rejectCall()
    }
  }

  const endCall = () => {
    if (webrtcManager) {
      webrtcManager.endCall()
    }
  }

  const toggleMute = () => {
    if (webrtcManager) {
      webrtcManager.toggleMute()
    }
  }

  return (
    <div className="p-4 space-y-4">
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">WebRTC Voice Call Test</h2>
        
        <div className="space-y-2 mb-4">
          <label className="block text-sm font-medium">Test User ID:</label>
          <input
            type="text"
            value={testUserId}
            onChange={(e) => setTestUserId(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>

        <div className="space-y-2">
          <Button onClick={startVoiceCall} disabled={!webrtcManager || callState?.isIncoming || callState?.isOutgoing || callState?.isConnected}>
            <Phone className="h-4 w-4 mr-2" />
            Start Voice Call
          </Button>
          
          {callState?.isIncoming && (
            <div className="space-x-2">
              <Button onClick={acceptCall} className="bg-green-500 hover:bg-green-600">
                <Phone className="h-4 w-4 mr-2" />
                Accept Call
              </Button>
              <Button onClick={rejectCall} variant="destructive">
                <PhoneOff className="h-4 w-4 mr-2" />
                Reject Call
              </Button>
            </div>
          )}
          
          {(callState?.isOutgoing || callState?.isConnected) && (
            <Button onClick={endCall} variant="destructive">
              <PhoneOff className="h-4 w-4 mr-2" />
              End Call
            </Button>
          )}
          
          {callState?.isConnected && (
            <Button onClick={toggleMute}>
              {callState.isMuted ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
              {callState.isMuted ? 'Unmute' : 'Mute'}
            </Button>
          )}
        </div>

        {callState && (
          <div className="mt-4 p-3 bg-gray-100 rounded">
            <h3 className="font-medium mb-2">Call State:</h3>
            <pre className="text-xs">{JSON.stringify(callState, null, 2)}</pre>
          </div>
        )}
      </Card>
    </div>
  )
} 