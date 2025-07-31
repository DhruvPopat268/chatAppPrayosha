"use client"

import config from './config'

interface User {
  id: string
  username: string
  email: string
  avatar?: string
}

interface LoginResponse {
  token: string
  user: User
  sessionId: string
}

// Get token from localStorage with new key name
export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('user_token')
  }
  return null
}

// Set token in localStorage with new key name
export const setToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user_token', token)
  }
}

// Remove token from localStorage
export const removeToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user_token')
  }
}

// Get current user from localStorage
export const getCurrentUser = (): User | null => {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        return JSON.parse(userStr)
      } catch {
        return null
      }
    }
  }
  return null
}

// Set current user in localStorage
export const setCurrentUser = (user: User): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(user))
  }
}

// Remove current user from localStorage
export const removeCurrentUser = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user')
  }
}

// Signup function (admin only)
export const signup = async (username: string, email: string): Promise<void> => {
  const response = await fetch(`${config.getBackendUrl()}/api/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin': 'true', // For demo, mark as admin
    },
    body: JSON.stringify({ username, email }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Signup failed')
  }
}

// Updated login function with session management
export const login = async (username: string): Promise<LoginResponse> => {
  const response = await fetch(`${config.getBackendUrl()}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username }),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Login failed')
  }
  
  const data = await response.json()
  
  // Store token with new key name
  setToken(data.token)
  setCurrentUser(data.user)
  
  // Also store session ID for reference
  if (typeof window !== 'undefined') {
    localStorage.setItem('sessionId', data.sessionId)
  }
  
  return data
}

// Updated logout function
export const logout = async (): Promise<void> => {
  try {
    await fetch(`${config.getBackendUrl()}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
      },
    })
  } catch (error) {
    console.error('Logout error:', error)
  } finally {
    removeToken()
    removeCurrentUser()
    // Remove session ID
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sessionId')
    }
  }
}

// API call with authentication using new token key
export const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = getToken()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  // Handle 401 Unauthorized - redirect to login and clear storage
  if (response.status === 401) {
    console.log('Authentication failed (401), redirecting to login...')
    handleAuthError()
    throw new Error('Authentication failed. Please login again.')
  }

  return response
}

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  const token = getToken()
  const user = getCurrentUser()
  return !!(token && user)
}

// Handle authentication errors and redirect to login
export const handleAuthError = (): void => {
  removeToken()
  removeCurrentUser()
  if (typeof window !== 'undefined') {
    localStorage.removeItem('sessionId')
    window.location.href = '/login'
  }
}

// Enhanced API call with automatic error handling
export const apiCall = async (url: string, options: RequestInit = {}): Promise<Response> => {
  try {
    const response = await authenticatedFetch(url, options)
    
    // Handle 401 Unauthorized
    if (response.status === 401) {
      console.log('Authentication failed (401), redirecting to login...')
      handleAuthError()
      throw new Error('Authentication failed. Please login again.')
    }
    
    return response
  } catch (error) {
    // If it's already a 401 error, don't handle it again
    if (error instanceof Error && error.message.includes('Authentication failed')) {
      throw error
    }
    
    // For network errors or other issues, log and rethrow
    console.error('API call error:', error)
    throw error
  }
}

// Utility function to check if user has active session
export const checkSessionStatus = async (): Promise<boolean> => {
  try {
    const token = getToken()
    if (!token) {
      return false
    }

    const response = await fetch(`${config.getBackendUrl()}/api/auth/session-status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.status === 401) {
      handleAuthError()
      return false
    }

    return response.ok
  } catch (error) {
    console.error('Session status check failed:', error)
    return false
  }
} 