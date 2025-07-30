// Environment configuration
export const config = {
  // Get backend URL from environment variable
  getBackendUrl: () => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL
    
    if (!backendUrl) {
      console.warn('NEXT_PUBLIC_BACKEND_URL not set, defaulting to localhost')
      return 'http://localhost:7000'
    }
    
    return backendUrl
  },
  
  // Get frontend URL (for reference)
  getFrontendUrl: () => {
    if (typeof window !== 'undefined') {
      return window.location.origin
    }
    return process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'
  },
  
  // Get current environment info
  getEnvironment: () => {
    const backendUrl = config.getBackendUrl()
    if (backendUrl.includes('localhost')) {
      return 'local'
    } else if (backendUrl.includes('onrender.com')) {
      return 'production'
    }
    return 'custom'
  }
}

export default config 