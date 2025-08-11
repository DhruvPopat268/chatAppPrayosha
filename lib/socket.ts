"use client"

import { io, Socket } from 'socket.io-client'
import config from './config'
import { getToken } from './clientAuth'

class SocketManager {
  private socket: Socket | null = null
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  connect() {
    if (this.socket && this.isConnected) {
      return this.socket
    }

    const token = getToken()
    if (!token) {
      console.error('No token available for socket connection')
      return null
    }

    this.socket = io(config.getBackendUrl(), {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      timeout: 20000
    })

    this.socket.on('connect', () => {
      console.log('Socket connected')
      this.isConnected = true
      this.reconnectAttempts = 0
      
      // Authenticate the socket connection
      this.socket?.emit('authenticate', token)
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      this.isConnected = false
      
      // Attempt to reconnect if it's not a manual disconnect
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        console.log('Manual disconnect, not attempting to reconnect')
      } else {
        console.log('Unexpected disconnect, attempting to reconnect...')
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      this.isConnected = false
      this.reconnectAttempts++
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached')
        alert('Connection to server failed. Please refresh the page and try again.')
      }
    })

    this.socket.on('auth_error', (error) => {
      console.error('Socket authentication failed:', error)
      this.disconnect()
      // Import and use handleAuthError
      import('./clientAuth').then(({ handleAuthError }) => {
        handleAuthError()
      })
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
      this.reconnectAttempts = 0
    }
  }

  getSocket(): Socket | null {
    return this.socket
  }

  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true
  }

  // Check if socket is ready for WebRTC calls
  isReadyForCalls(): boolean {
    return this.isSocketConnected() && this.socket?.id !== undefined
  }

  // Send a message
  sendMessage(receiverId: string, content: string, type: string = 'text', fileName?: string, fileSize?: string) {
    if (!this.socket || !this.isConnected) {
      console.error('Socket not connected')
      return
    }

    this.socket.emit('send_message', {
      receiverId,
      content,
      type,
      fileName,
      fileSize
    })
  }

  // Listen for new messages
  onNewMessage(callback: (message: any) => void) {
    if (!this.socket) return

    this.socket.on('new_message', callback)
  }

  // Listen for message sent confirmation
  onMessageSent(callback: (message: any) => void) {
    if (!this.socket) return

    this.socket.on('message_sent', callback)
  }

  // Listen for message errors
  onMessageError(callback: (error: string) => void) {
    if (!this.socket) return

    this.socket.on('message_error', callback)
  }

  // Send typing indicators
  sendTypingStart(receiverId: string) {
    if (!this.socket || !this.isConnected) return

    this.socket.emit('typing_start', { receiverId })
  }

  sendTypingStop(receiverId: string) {
    if (!this.socket || !this.isConnected) return

    this.socket.emit('typing_stop', { receiverId })
  }

  // 🔥 NEW: Send chat opened event for read receipts
  sendChatOpened(senderId: string) {
    if (!this.socket || !this.isConnected) return

    console.log(`📖 Sending chat_opened event for sender: ${senderId}`)
    this.socket.emit('chat_opened', { senderId })
  }

  // 🔥 NEW: Request read receipts after reconnection
  requestReadReceipts(lastSeen: number) {
    if (!this.socket || !this.isConnected) return

    console.log(`📖 Requesting read receipts since: ${new Date(lastSeen).toISOString()}`)
    this.socket.emit('request_read_receipts', { lastSeen })
  }

  // Listen for typing indicators
  onUserTyping(callback: (data: { userId: string }) => void) {
    if (!this.socket) return

    this.socket.on('user_typing', callback)
  }

  onUserStoppedTyping(callback: (data: { userId: string }) => void) {
    if (!this.socket) return

    this.socket.on('user_stopped_typing', callback)
  }

  // 🔥 NEW: Listen for read receipts
  onMessagesReadByReceiver(callback: (data: { 
    receiverId: string, 
    messageCount: number, 
    timestamp: Date,
    isOfflineUpdate?: boolean 
  }) => void) {
    if (!this.socket) return

    this.socket.on('messages_read_by_receiver', callback)
  }

  // 🔥 NEW: Listen for chat opened confirmation
  onChatOpenedConfirmation(callback: (data: { 
    senderId: string, 
    messageCount: number 
  }) => void) {
    if (!this.socket) return

    this.socket.on('chat_opened_confirmation', callback)
  }

  // 🔥 NEW: Listen for chat opened errors
  onChatOpenedError(callback: (error: string) => void) {
    if (!this.socket) return

    this.socket.on('chat_opened_error', callback)
  }

  // Remove all listeners
  removeAllListeners() {
    if (!this.socket) return

    this.socket.removeAllListeners('new_message')
    this.socket.removeAllListeners('message_sent')
    this.socket.removeAllListeners('message_error')
    this.socket.removeAllListeners('user_typing')
    this.socket.removeAllListeners('user_stopped_typing')
    // 🔥 NEW: Remove read receipt listeners
    this.socket.removeAllListeners('messages_read_by_receiver')
    this.socket.removeAllListeners('chat_opened_confirmation')
    this.socket.removeAllListeners('chat_opened_error')
  }

  // Get connection status for debugging
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      socketConnected: this.socket?.connected || false,
      socketId: this.socket?.id,
      readyForCalls: this.isReadyForCalls(),
      reconnectAttempts: this.reconnectAttempts
    }
  }
}

// Create a singleton instance
const socketManager = new SocketManager()

export default socketManager 