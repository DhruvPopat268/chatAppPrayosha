import { Shield } from "lucide-react"

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-4 p-3 bg-blue-100 rounded-full w-fit mx-auto">
          <Shield className="h-8 w-8 text-blue-600 animate-pulse" />
        </div>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 text-sm">Loading admin panel...</p>
      </div>
    </div>
  )
}
