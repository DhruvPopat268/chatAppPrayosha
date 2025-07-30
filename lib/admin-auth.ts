// Mock admin authentication system
// In a real app, this would connect to your database

interface Admin {
  id: string
  username: string
  email: string
  password: string
  createdAt: string
}

interface User {
  id: string
  username: string
  email: string
  avatar: string
  createdAt: string
  lastActive: string
  status: "online" | "offline"
  bio?: string
}

// Mock data storage (in real app, use database)
const admins: Admin[] = [
  {
    id: "admin-1",
    username: "admin",
    email: "admin@example.com",
    password: "admin123", // In real app, this would be hashed
    createdAt: new Date().toISOString(),
  },
]

const users: User[] = [
  {
    id: "user-1",
    username: "john_doe",
    email: "john@example.com",
    avatar: "/placeholder.svg",
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
    lastActive: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    status: "online",
    bio: "Software developer and tech enthusiast",
  },
  {
    id: "user-2",
    username: "jane_smith",
    email: "jane@example.com",
    avatar: "/placeholder.svg",
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
    lastActive: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    status: "offline",
    bio: "Designer and creative professional",
  },
  {
    id: "user-3",
    username: "mike_wilson",
    email: "mike@example.com",
    avatar: "/placeholder.svg",
    createdAt: new Date().toISOString(), // Today
    lastActive: new Date().toISOString(), // Now
    status: "online",
    bio: "Marketing specialist",
  },
]

// Cookie helpers
const ADMIN_COOKIE_NAME = "admin_session"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function setCookie(name: string, value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  const sameSite = "; SameSite=Lax"
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}${secure}${sameSite}`
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null

  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null
  }
  return null
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT`
}

// Admin authentication functions
export async function signUpAdmin(data: {
  username: string
  password: string
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin-auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: data.username, password: data.password })
    });
    const result = await response.json();
    if (!response.ok) {
      return { error: result.error || "Signup failed" };
    }
    return { success: true };
  } catch (error) {
    return { error: "Signup failed. Please try again." };
  }
}

export async function signInAdmin(username: string, password: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin-auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const result = await response.json();
    if (!response.ok) {
      return { error: result.error || "Login failed" };
    }
    
    // Store admin authentication data in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('adminUsername', username);
      localStorage.setItem('adminLoggedIn', 'true');
      localStorage.setItem('adminLoginTime', new Date().toISOString());
      
      // Optional: Also set a cookie for additional security
      setCookie(ADMIN_COOKIE_NAME, 'admin-1', COOKIE_MAX_AGE);
    }
    
    return { success: true };
  } catch (error) {
    return { error: "Login failed. Please try again." };
  }
}

export async function getCurrentAdmin(): Promise<Admin | null> {
  // First check localStorage for client-side authentication state
  if (typeof window !== 'undefined') {
    const adminUsername = localStorage.getItem('adminUsername');
    const isLoggedIn = localStorage.getItem('adminLoggedIn');
    const loginTime = localStorage.getItem('adminLoginTime');
    
    if (adminUsername && isLoggedIn === 'true') {
      // Check if login is not too old (optional: 24 hours expiry)
      if (loginTime) {
        const loginDate = new Date(loginTime);
        const now = new Date();
        const hoursDiff = (now.getTime() - loginDate.getTime()) / (1000 * 60 * 60);
        
        // If login is older than 24 hours, clear it
        if (hoursDiff > 24) {
          localStorage.removeItem('adminUsername');
          localStorage.removeItem('adminLoggedIn');
          localStorage.removeItem('adminLoginTime');
          return null;
        }
      }
      
      // Return a mock admin object based on localStorage
      return {
        id: 'admin-1',
        username: adminUsername,
        email: `${adminUsername}@example.com`,
        password: '', // Don't return password
        createdAt: loginTime || new Date().toISOString()
      };
    }
  }

  // Fallback to cookie check (for server-side or if localStorage fails)
  const adminId = getCookie(ADMIN_COOKIE_NAME)
  if (!adminId) {
    return null
  }

  const admin = admins.find((a) => a.id === adminId)
  return admin || null
}

export async function signOutAdmin(): Promise<void> {
  // Clear localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('adminUsername');
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('adminLoginTime');
  }
  
  // Clear cookies
  deleteCookie(ADMIN_COOKIE_NAME)
}

// User management functions
export async function getAllUsers(): Promise<User[]> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    if (!response.ok) {
      // Return mock data if API fails
      return users.map((u: any) => ({ ...u, id: u.id }));
    }
    const apiUsers = await response.json();
    // Map _id to id for frontend compatibility
    return apiUsers.map((u: any) => ({ ...u, id: u._id }));
  } catch {
    // Return mock data if API fails
    return users.map((u: any) => ({ ...u, id: u.id }));
  }
}

export async function createUser(data: {
  username: string
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin": "true"
      },
      body: JSON.stringify({ username: data.username })
    });
    const result = await response.json();
    if (!response.ok) {
      return { error: result.error || "User creation failed" };
    }
    return { success: true };
  } catch (error) {
    return { error: "User creation failed. Please try again." };
  }
}

export async function deleteUser(userId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/${userId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-admin": "true"
      }
    });
    const result = await response.json();
    if (!response.ok) {
      return { error: result.error || "User deletion failed" };
    }
    return { success: true };
  } catch (error) {
    return { error: "User deletion failed. Please try again." };
  }
}

export async function updateUser(userId: string, data: Partial<User>): Promise<{ success?: boolean; error?: string }> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  const userIndex = users.findIndex((user) => user.id === userId)

  if (userIndex === -1) {
    return { error: "User not found" }
  }

  users[userIndex] = { ...users[userIndex], ...data }
  return { success: true }
}