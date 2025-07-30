"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

interface User {
  id: string
  username: string
  email: string
  avatar: string
}

// Mock user database - in real app, this would be a database
const users: Array<User & { password: string }> = [
  {
    id: "1",
    username: "alice_johnson",
    email: "alice@example.com",
    password: "password123",
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "2",
    username: "bob_smith",
    email: "bob@example.com",
    password: "password123",
    avatar: "/placeholder.svg?height=40&width=40",
  },
]

export async function signUp(formData: FormData) {
  const username = formData.get("username") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  // Validation
  if (!username || !email || !password) {
    return { error: "All fields are required" }
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" }
  }

  // Check if user already exists
  const existingUser = users.find((u) => u.username === username || u.email === email)
  if (existingUser) {
    return { error: "Username or email already exists" }
  }

  // Create new user
  const newUser: User & { password: string } = {
    id: Date.now().toString(),
    username,
    email,
    password,
    avatar: `/placeholder.svg?height=40&width=40&query=${username}`,
  }

  users.push(newUser)

  // Create session
  const cookieStore = await cookies()
  cookieStore.set(
    "user",
    JSON.stringify({
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      avatar: newUser.avatar,
    }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  )

  redirect("/chat")
}

export async function signIn(formData: FormData) {
  const username = formData.get("username") as string
  const password = formData.get("password") as string

  if (!username || !password) {
    return { error: "Username and password are required" }
  }

  // Find user
  const user = users.find((u) => u.username === username && u.password === password)
  if (!user) {
    return { error: "Invalid username or password" }
  }

  // Create session
  const cookieStore = await cookies()
  cookieStore.set(
    "user",
    JSON.stringify({
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
    }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  )

  redirect("/chat")
}

export async function signOut() {
  const cookieStore = await cookies()
  cookieStore.delete("user")
  redirect("/login")
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const userCookie = cookieStore.get("user")

  if (!userCookie) {
    return null
  }

  try {
    return JSON.parse(userCookie.value)
  } catch {
    return null
  }
}
