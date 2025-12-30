import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/AccountsWithHealth";
import LoginAccount from "./pages/LoginAccount";
import Videos from "./pages/Videos";
import Comments from "./pages/Comments";
import Jobs from "./pages/Jobs";
import BatchJobs from "./pages/BatchJobs";
import AdminDashboardLayout from "./components/AdminDashboardLayout";
import Logs from "./pages/Logs";

function Router() {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  // Redirect to dashboard if authenticated and on home page
  if (!loading && user && location === "/") {
    setLocation("/dashboard");
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/accounts" component={Accounts} />
      <Route path="/login-account" component={LoginAccount} />
      <Route path="/videos" component={Videos} />
      <Route path="/comments" component={Comments} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/batch" component={BatchJobs} />
      <Route path="/logs" component={Logs} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
