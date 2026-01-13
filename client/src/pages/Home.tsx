import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { getLoginUrl } from "@/const";
import { Streamdown } from 'streamdown';

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  const { user, loading } = useAuth();
  
  // Check if we're in local dev mode (localhost)
  const isLocalhost = typeof window !== "undefined" && (
    window.location.hostname === "localhost" || 
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === ""
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  // If user is authenticated, the Router will redirect to /dashboard via useEffect
  // This page is only shown to unauthenticated users
  // In local dev mode, show a message indicating mock authentication
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-4xl font-bold text-gray-900">Comment Bot MVP</h1>
        <p className="text-lg text-gray-600">AI-powered comment automation for live streams</p>
        {isLocalhost ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              Local Dev Mode: Authentication is bypassed
            </p>
            <p className="text-sm text-gray-500">
              You will be automatically logged in as "Local Dev User"
            </p>
          </div>
        ) : (
          <Button 
            size="lg"
            onClick={() => window.location.href = getLoginUrl()}
          >
            Sign In to Continue
          </Button>
        )}
      </div>
    </div>
  );
}
