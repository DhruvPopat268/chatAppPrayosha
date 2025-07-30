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
}

// Get token from localStorage
export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token')
  }
  return null
}

// Set token in localStorage
export const setToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token)
  }
}

// Remove token from localStorage
export const removeToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token')
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

// Login function (username only)
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
  setToken(data.token)
  setCurrentUser(data.user)
  return data
}

// Logout function
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
  }
}

// API call with authentication
export const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = getToken()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(url, {
    ...options,
    headers,
  })
} 