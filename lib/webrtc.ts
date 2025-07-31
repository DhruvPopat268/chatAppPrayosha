"use client"

export interface CallData {
  callerId: string
  receiverId: string
  callType: 'voice' | 'video'
  roomId: string
}

export interface CallState {
  isIncoming: boolean
  isOutgoing: boolean
  isConnected: boolean
  isMuted: boolean
  isSpeakerOn: boolean
  isVideoEnabled: boolean
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  callData: CallData | null
}

class WebRTCManager {
  private socket: any
  private peerConnection: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private onCallStateChange: ((state: CallState) => void) | null = null
  private callStartTime: number = 0
  private currentCallState: CallState = {
    isIncoming: false,
    isOutgoing: false,
    isConnected: false,
    isMuted: false,
    isSpeakerOn: false,
    isVideoEnabled: true,
    localStream: null,
    remoteStream: null,
    callData: null
  }

  constructor(socket: any) {
    this.socket = socket
    this.setupSocketListeners()
    this.initializePeerConnection()
  }

  private setupSocketListeners() {
    if (!this.socket) return

    // Handle incoming call
    this.socket.on('incoming_call', (data: CallData) => {
      console.log('Incoming call:', data)
      this.currentCallState.isIncoming = true
      this.currentCallState.callData = data
      this.notifyStateChange()
    })

    // Handle call accepted
    this.socket.on('call_accepted', async (data: CallData) => {
      console.log('Call accepted:', data)
      this.currentCallState.isOutgoing = false
      this.currentCallState.callData = data
      
      // Create and send offer
      try {
        if (this.peerConnection && this.peerConnection.signalingState === 'stable') {
          const offer = await this.peerConnection.createOffer()
          await this.peerConnection.setLocalDescription(offer)
          this.socket.emit('offer', { offer, roomId: data.roomId })
        } else {
          console.log('Cannot create offer - peer connection not in stable state:', this.peerConnection?.signalingState)
        }
      } catch (error) {
        console.error('Error creating offer:', error)
        this.resetCallState()
      }
      
      this.notifyStateChange()
    })

    // Handle call rejected
    this.socket.on('call_rejected', () => {
      console.log('Call rejected')
      this.resetCallState()
    })

    // Handle call ended
    this.socket.on('call_ended', () => {
      console.log('Call ended')
      this.endCall()
    })

    // Handle WebRTC signaling
    this.socket.on('offer', async (data: { offer: RTCSessionDescriptionInit, roomId: string }) => {
      console.log('Received offer')
      try {
        if (this.peerConnection && this.peerConnection.signalingState === 'stable') {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
          const answer = await this.peerConnection.createAnswer()
          await this.peerConnection.setLocalDescription(answer)
          this.socket.emit('answer', { answer, roomId: data.roomId })
        } else {
          console.log('Ignoring offer - peer connection not in stable state:', this.peerConnection?.signalingState)
        }
      } catch (error) {
        console.error('Error handling offer:', error)
        // Don't reset call state for signaling errors, just log them
        if ((error as any).name === 'InvalidStateError') {
          console.log('Signaling state error, continuing call...')
        } else {
          this.resetCallState()
        }
      }
    })

    this.socket.on('answer', async (data: { answer: RTCSessionDescriptionInit, roomId: string }) => {
      console.log('Received answer')
      try {
        if (this.peerConnection && this.peerConnection.signalingState !== 'stable') {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
        } else {
          console.log('Ignoring answer - peer connection in stable state')
        }
      } catch (error) {
        console.error('Error handling answer:', error)
        // Don't reset call state for signaling errors, just log them
        if ((error as any).name === 'InvalidStateError') {
          console.log('Signaling state error, continuing call...')
        } else {
          this.resetCallState()
        }
      }
    })

    this.socket.on('ice_candidate', async (data: { candidate: RTCIceCandidateInit, roomId: string }) => {
      console.log('Received ICE candidate')
      try {
        if (this.peerConnection && this.peerConnection.remoteDescription) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
        } else {
          console.log('Ignoring ICE candidate - no remote description set')
        }
      } catch (error) {
        console.error('Error adding ICE candidate:', error)
        // Don't reset call state for ICE errors, just log them
        if ((error as any).name === 'InvalidStateError') {
          console.log('ICE candidate error, continuing call...')
        }
      }
    })
  }

  private initializePeerConnection() {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    }

    this.peerConnection = new RTCPeerConnection(configuration)

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.currentCallState.callData) {
        console.log('Sending ICE candidate')
        this.socket.emit('ice_candidate', {
          candidate: event.candidate,
          roomId: this.currentCallState.callData.roomId
        })
      }
    }

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState
      console.log('Connection state changed to:', state)
      
      if (state === 'connected') {
        console.log('WebRTC connection established successfully')
        this.currentCallState.isConnected = true
        this.callStartTime = Date.now()
        
        // Delay state notification to prevent audio element re-render issues
        setTimeout(() => {
          this.notifyStateChange()
        }, 300)
        
      } else if (state === 'disconnected' || state === 'failed') {
        console.log('WebRTC connection lost or failed')
        // Only end call if it was actually connected for more than 1 second
        if (this.currentCallState.isConnected && (Date.now() - this.callStartTime) > 1000) {
          this.endCall()
        } else {
          console.log('Call ended too quickly, resetting state')
          this.resetCallState()
        }
      } else if (state === 'connecting') {
        console.log('WebRTC connection in progress...')
      }
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('Received remote stream')
      this.remoteStream = event.streams[0]
      this.currentCallState.remoteStream = this.remoteStream
      
      // Delay state notification to prevent audio element re-render issues
      setTimeout(() => {
        this.notifyStateChange()
      }, 400)
      
      // Ensure the call stays connected even if audio fails
      setTimeout(() => {
        if (this.currentCallState.isConnected && !this.remoteStream) {
          console.log('Remote stream not received, but keeping call active')
        }
      }, 2000)
    }
  }

  // Improved device availability check
  private async checkDeviceAvailability(): Promise<{ audio: boolean; video: boolean }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      return {
        audio: audioDevices.length > 0,
        video: videoDevices.length > 0
      };
    } catch (error) {
      console.error('Error checking device availability:', error);
      // Assume devices are available if we can't check
      return { audio: true, video: true };
    }
  }

  // Improved permission and media access with better error handling
  private async getUserMediaWithFallback(audio: boolean, video: boolean): Promise<MediaStream> {
    try {
      // First try to get media directly without permission checks
      const constraints: MediaStreamConstraints = {
        audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
      };

      console.log('Requesting media with constraints:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Media stream obtained successfully');
      
      return stream;
    } catch (error) {
      console.error('Error getting user media:', error);
      
      // Try fallback with audio only for video calls
      if (video && audio) {
        console.log('Trying fallback with audio only...');
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true }, 
            video: false 
          });
          console.log('Audio-only fallback successful');
          return audioOnlyStream;
        } catch (audioError) {
          console.error('Audio-only fallback also failed:', audioError);
        }
      }
      
      // Try with minimal constraints
      try {
        console.log('Trying with minimal constraints...');
        const minimalStream = await navigator.mediaDevices.getUserMedia({
          audio: audio,
          video: video
        });
        console.log('Minimal constraints successful');
        return minimalStream;
      } catch (minimalError) {
        console.error('Minimal constraints also failed:', minimalError);
      }
      
      throw error;
    }
  }

  // Simplified device permission check
  async checkDevicePermissions(): Promise<{ audio: boolean; video: boolean; message: string }> {
    try {
      // Try to get a test stream to check permissions
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      testStream.getTracks().forEach(track => track.stop());
      
      return {
        audio: true,
        video: true, // Assume video is available
        message: 'Devices ready for calls.'
      };
    } catch (error) {
      console.error('Error checking device permissions:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          return {
            audio: false,
            video: false,
            message: 'Microphone and camera access denied. Please allow access to these devices.'
          };
        } else if (error.name === 'NotFoundError') {
          return {
            audio: false,
            video: false,
            message: 'No microphone or camera found. Please connect devices and refresh the page.'
          };
        } else if (error.name === 'NotReadableError') {
          return {
            audio: false,
            video: false,
            message: 'Microphone or camera is already in use by another application.'
          };
        }
      }
      
      return {
        audio: false,
        video: false,
        message: 'Error checking device permissions. Please refresh the page.'
      };
    }
  }

  // Simplified device access test
  async testDeviceAccess(audio: boolean, video: boolean): Promise<boolean> {
    try {
      // Try to get media directly
      const testStream = await navigator.mediaDevices.getUserMedia({
        audio: audio,
        video: video
      });
      
      // Stop the test stream
      testStream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (error) {
      console.error('Error testing device access:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          alert('Camera or microphone access denied. Please allow access and try again.');
        } else if (error.name === 'NotFoundError') {
          alert('No camera or microphone found. Please connect the required devices and try again.');
        } else if (error.name === 'NotReadableError') {
          alert('Camera or microphone is already in use by another application. Please close other apps using these devices.');
        } else {
          alert('Error testing device access: ' + error.message);
        }
      }
      
      return false;
    }
  }

  async startVoiceCall(receiverId: string): Promise<boolean> {
    try {
      console.log('Starting voice call...');
      
      // Check if socket is connected
      if (!this.socket || !this.socket.connected) {
        alert('Not connected to server. Please refresh the page and try again.');
        return false;
      }
      
      // Always create a new peer connection for each call
      this.initializePeerConnection();
      
      // Get user media with proper error handling
      this.localStream = await this.getUserMediaWithFallback(true, false);
      
      if (!this.localStream) {
        throw new Error('Failed to get audio stream');
      }

      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.peerConnection.signalingState !== 'closed') {
          this.peerConnection.addTrack(track, this.localStream!);
          console.log('Added audio track to peer connection');
        }
      });

      // Update call state
      this.currentCallState.isOutgoing = true;
      this.currentCallState.localStream = this.localStream;
      this.currentCallState.callData = {
        callerId: this.getCurrentUserId(),
        receiverId,
        callType: 'voice',
        roomId: this.generateRoomId()
      };

      // Send call request
      this.socket.emit('start_call', this.currentCallState.callData);
      this.notifyStateChange();

      console.log('Voice call started successfully');
      return true;
    } catch (error) {
      console.error('Error starting voice call:', error);
      
      // Reset state on error
      this.resetCallState();
      
      // Show user-friendly error message
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          alert('No microphone found. Please connect a microphone and try again.');
        } else if (error.name === 'NotAllowedError') {
          alert('Microphone access denied. Please allow microphone access and try again.');
        } else if (error.name === 'NotReadableError') {
          alert('Microphone is already in use by another application. Please close other apps using the microphone.');
        } else {
          alert('Failed to start voice call: ' + error.message);
        }
      }
      
      return false;
    }
  }

  async startVideoCall(receiverId: string): Promise<boolean> {
    try {
      console.log('Starting video call...');
      
      // Check if socket is connected
      if (!this.socket || !this.socket.connected) {
        alert('Not connected to server. Please refresh the page and try again.');
        return false;
      }
      
      // Always create a new peer connection for each call
      this.initializePeerConnection();
      
      // Get user media with proper error handling
      this.localStream = await this.getUserMediaWithFallback(true, true);
      
      if (!this.localStream) {
        throw new Error('Failed to get media stream');
      }

      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.peerConnection.signalingState !== 'closed') {
          this.peerConnection.addTrack(track, this.localStream!);
          console.log('Added track to peer connection:', track.kind);
        }
      });

      // Update call state
      this.currentCallState.isOutgoing = true;
      this.currentCallState.localStream = this.localStream;
      this.currentCallState.callData = {
        callerId: this.getCurrentUserId(),
        receiverId,
        callType: 'video',
        roomId: this.generateRoomId()
      };

      // Send call request
      this.socket.emit('start_call', this.currentCallState.callData);
      this.notifyStateChange();

      console.log('Video call started successfully');
      return true;
    } catch (error) {
      console.error('Error starting video call:', error);
      
      // Reset state on error
      this.resetCallState();
      
      // Show user-friendly error message
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          alert('No camera or microphone found. Please connect a camera and microphone and try again.');
        } else if (error.name === 'NotAllowedError') {
          alert('Camera or microphone access denied. Please allow camera and microphone access and try again.');
        } else if (error.name === 'NotReadableError') {
          alert('Camera or microphone is already in use by another application. Please close other apps using the camera or microphone.');
        } else {
          alert('Failed to start video call: ' + error.message);
        }
      }
      
      return false;
    }
  }

  async acceptCall(): Promise<boolean> {
    try {
      if (!this.currentCallState.callData) return false;

      console.log('Accepting call...');

      // Check if socket is connected
      if (!this.socket || !this.socket.connected) {
        alert('Not connected to server. Please refresh the page and try again.');
        return false;
      }

      // Always create a new peer connection for each call
      this.initializePeerConnection();
      
      // Get user media with proper error handling
      const isVideoCall = this.currentCallState.callData.callType === 'video';
      this.localStream = await this.getUserMediaWithFallback(true, isVideoCall);
      
      if (!this.localStream) {
        throw new Error('Failed to get media stream');
      }

      console.log('Local media stream obtained');

      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.peerConnection.signalingState !== 'closed') {
          this.peerConnection.addTrack(track, this.localStream!);
          console.log('Added track to peer connection:', track.kind);
        }
      });

      // Accept the call FIRST before updating state
      this.socket.emit('accept_call', {
        callerId: this.currentCallState.callData.callerId,
        roomId: this.currentCallState.callData.roomId,
        callType: this.currentCallState.callData.callType
      });

      // Update call state
      this.currentCallState.isIncoming = false;
      this.currentCallState.localStream = this.localStream;
      this.notifyStateChange();

      console.log('Call accepted successfully');
      return true;
    } catch (error) {
      console.error('Error accepting call:', error);
      
      // Reset state on error
      this.resetCallState();
      
      // Show user-friendly error message
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          alert('No microphone or camera found. Please connect the required devices and try again.');
        } else if (error.name === 'NotAllowedError') {
          alert('Microphone or camera access denied. Please allow access and try again.');
        } else if (error.name === 'NotReadableError') {
          alert('Microphone or camera is already in use by another application. Please close other apps using these devices.');
        } else {
          alert('Failed to accept call: ' + error.message);
        }
      }
      
      return false;
    }
  }

  rejectCall() {
    if (this.currentCallState.callData) {
      this.socket.emit('reject_call', this.currentCallState.callData)
    }
    this.resetCallState()
  }

  endCall() {
    if (this.currentCallState.callData) {
      this.socket.emit('end_call', this.currentCallState.callData)
    }
    this.resetCallState()
  }

  private resetCallState() {
    console.log('Resetting call state...')
    
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
      this.localStream = null
    }

    // Reset call state
    this.currentCallState = {
      isIncoming: false,
      isOutgoing: false,
      isConnected: false,
      isMuted: false,
      isSpeakerOn: false,
      isVideoEnabled: true,
      localStream: null,
      remoteStream: null,
      callData: null
    }

    // Only close and nullify peerConnection, do not re-initialize here
    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    this.callStartTime = 0
    this.notifyStateChange()
    console.log('Call state reset complete')
  }

  onStateChange(callback: (state: CallState) => void) {
    this.onCallStateChange = callback
  }

  private notifyStateChange() {
    if (this.onCallStateChange) {
      this.onCallStateChange({ ...this.currentCallState })
    }
  }

  getCallState(): CallState {
    return { ...this.currentCallState }
  }

  isCallInProgress(): boolean {
    return this.currentCallState.isIncoming || 
           this.currentCallState.isOutgoing || 
           this.currentCallState.isConnected
  }

  isCallStable(): boolean {
    return this.peerConnection?.connectionState === 'connected'
  }

  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        this.currentCallState.isMuted = !audioTrack.enabled
        this.notifyStateChange()
      }
    }
  }

  toggleSpeaker() {
    this.currentCallState.isSpeakerOn = !this.currentCallState.isSpeakerOn
    this.notifyStateChange()
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        this.currentCallState.isVideoEnabled = videoTrack.enabled
        this.notifyStateChange()
      }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      return true
    } catch (error) {
      console.error('Media access test failed:', error)
      return false
    }
  }

  getConnectionDiagnostics() {
    return {
      peerConnectionState: this.peerConnection?.connectionState,
      iceConnectionState: this.peerConnection?.iceConnectionState,
      localStream: !!this.localStream,
      remoteStream: !!this.remoteStream,
      callState: this.currentCallState
    }
  }

  private getCurrentUserId(): string {
    // Get user ID from localStorage or auth context
    try {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        const user = JSON.parse(userStr)
        return user.id || user._id || 'unknown-user'
      }
    } catch (error) {
      console.error('Error getting current user ID:', error)
    }
    
    // Fallback: try to get from sessionStorage or other sources
    try {
      const token = localStorage.getItem('user_token') // Updated to use new key
      if (token) {
        // Extract user ID from JWT token if possible
        const payload = JSON.parse(atob(token.split('.')[1]))
        return payload.userId || payload.id || 'unknown-user'
      }
    } catch (error) {
      console.error('Error extracting user ID from token:', error)
    }
    
    return 'unknown-user'
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }
}

export default WebRTCManager 