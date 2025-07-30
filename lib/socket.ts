"use client"

import { io, Socket } from 'socket.io-client'
import config from './config'
import { getToken } from './clientAuth'

class SocketManager {
  private socket: Socket | null = null
  private isConnected = false

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
      autoConnect: true
    })

    this.socket.on('connect', () => {
      console.log('Socket connected')
      this.isConnected = true
      
      // Authenticate the socket connection
      this.socket?.emit('authenticate', token)
    })

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected')
      this.isConnected = false
    })

    this.socket.on('auth_error', (error) => {
      console.error('Socket authentication failed:', error)
      this.disconnect()
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
    }
  }

  getSocket(): Socket | null {
    return this.socket
  }

  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true
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

  // Send typing indicator
  sendTypingStart(receiverId: string) {
    if (!this.socket || !this.isConnected) return

    this.socket.emit('typing_start', { receiverId })
  }

  sendTypingStop(receiverId: string) {
    if (!this.socket || !this.isConnected) return

    this.socket.emit('typing_stop', { receiverId })
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

  // Remove all listeners
  removeAllListeners() {
    if (!this.socket) return

    this.socket.removeAllListeners('new_message')
    this.socket.removeAllListeners('message_sent')
    this.socket.removeAllListeners('message_error')
    this.socket.removeAllListeners('user_typing')
    this.socket.removeAllListeners('user_stopped_typing')
  }
}

// Create a singleton instance
const socketManager = new SocketManager()

export default socketManager 