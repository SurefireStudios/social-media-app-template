import React, { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "./lib/queryClient";
import Home from "@/pages/Home";
import Leaderboard from "@/pages/Leaderboard";
import Upload from "@/pages/Upload";
import Profile from "@/pages/Profile";
import PostDetail from "@/pages/PostDetail";
import Messages from "@/pages/Messages";
import Notifications from "@/pages/Notifications";
import Auth from "@/pages/Auth";
import AdminDashboard from "@/pages/AdminDashboard";
import TermsOfService from "@/pages/TermsOfService";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import NotFound from "@/pages/not-found";
import AppNavigation from "@/components/AppNavigation";
import AppHeader from "@/components/AppHeader";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { loadTheme } from "./lib/theme";

function Router() {
  const [location] = useLocation();
  const showNav = location !== "/auth";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-dark text-light">
      {showNav && <AppHeader />}
      
      <main className="flex-1 overflow-hidden relative">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/upload" component={Upload} />
          <Route path="/profile/:id?" component={Profile} />
          <Route path="/post/:id" component={PostDetail} />
          <Route path="/messages" component={Messages} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/auth" component={Auth} />
          {/* Sign in and registration */}
          <Route path="/__/auth/handler" component={Auth} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/terms" component={TermsOfService} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route component={NotFound} />
        </Switch>
      </main>
      
      {showNav && <AppNavigation />}
    </div>
  );
}

function App() {
  // Load saved theme on app startup
  useEffect(() => {
    loadTheme();
  }, []);
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
