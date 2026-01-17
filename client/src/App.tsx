import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import LoginAccount from "./pages/LoginAccount";
import Videos from "./pages/Videos";
import Comments from "./pages/Comments";
import Jobs from "./pages/Jobs";
import BatchJobs from "./pages/BatchJobs";
import AdminDashboardLayout from "./components/AdminDashboardLayout";
import Logs from "./pages/Logs";
import AIAutoComment from "./pages/AIAutoComment";

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  "/dashboard",
  "/login-account",
  "/videos",
  "/comments",
  "/jobs",
  "/batch",
  "/logs",
  "/ai-comment",
];

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/", "/login"];

function Router() {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  // Redirect to dashboard if authenticated and on home page
  useEffect(() => {
    if (!loading && user && location === "/") {
      setLocation("/dashboard");
    }
  }, [loading, user, location, setLocation]);

  // Protect routes - redirect to login if not authenticated
  useEffect(() => {
    if (loading) return; // Wait for auth check to complete

    const isProtectedRoute = PROTECTED_ROUTES.includes(location);

    // If trying to access protected route without auth, redirect to login
    if (isProtectedRoute && !user) {
      console.log(
        `[Router] Unauthenticated access to ${location}, redirecting to /login`
      );
      setLocation("/login");
      return;
    }

    // If authenticated and trying to access login page, redirect to dashboard
    if (location === "/login" && user) {
      setLocation("/dashboard");
      return;
    }
  }, [loading, user, location, setLocation]);

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/login-account" component={LoginAccount} />
      <Route path="/videos" component={Videos} />
      <Route path="/comments" component={Comments} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/batch" component={BatchJobs} />
      <Route path="/logs" component={Logs} />
      <Route path="/ai-comment" component={AIAutoComment} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
