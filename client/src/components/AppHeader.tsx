import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Bell, Mail, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api";
import Avatar from "@/components/Avatar";
import { APP_NAME } from "@/lib/brand";

import { useIsMobile } from "@/hooks/use-mobile";

const AppHeader = () => {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  
  // Fetch unread notification count
  const { data: notificationData } = useQuery({
    queryKey: ['/api/notifications/unread-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return { count: 0 };
      try {
        const response = await fetch(getApiUrl(`/api/notifications/unread-count/${user.id}`));
        if (!response.ok) return { count: 0 };
        return response.json();
      } catch (error) {
        console.error("Error fetching notification count:", error);
        return { count: 0 };
      }
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
  
  // Fetch unread messages count
  const { data: messageData } = useQuery({
    queryKey: ['/api/messages/unread-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return { count: 0 };
      try {
        const response = await fetch(getApiUrl(`/api/messages/unread-count/${user.id}`));
        if (!response.ok) return { count: 0 };
        return response.json();
      } catch (error) {
        console.error("Error fetching message count:", error);
        return { count: 0 };
      }
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
  
  const handleSignOut = async () => {
    try {
      await logout();
      setLocation("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const isMobile = useIsMobile();
  
  return (
    <div>
      <header className="bg-dark-light py-3 px-4 border-b border-dark-lighter flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center" onClick={() => setLocation("/")} style={{ cursor: "pointer" }}>
          {/* A wordmark rather than an image, so renaming the app in
              client/src/lib/brand.ts is all it takes. Swap in an <img> here
              once you have a logo. */}
          <span className="text-xl font-bold tracking-tight text-primary">{APP_NAME}</span>
          <span className="ml-1 text-xs bg-dark-lighter rounded px-1 py-0.5 uppercase tracking-wider text-light">Beta</span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Notifications button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-gray-400 hover:text-primary transition rounded-full relative"
            onClick={() => setLocation("/notifications")}
          >
            <Bell className="h-5 w-5" />
            {/* Only show notification dot if there are unread notifications */}
            {notificationData?.count > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>
            )}
          </Button>
          
          {/* Messages button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-gray-400 hover:text-primary transition rounded-full relative"
            onClick={() => setLocation("/messages")}
          >
            <Mail className="h-5 w-5" />
            {/* Show notification dot if there are unread messages */}
            {messageData?.count > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
            )}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="p-0">
                <Avatar
                  src={user?.profileImageUrl}
                  alt={user?.username}
                  fallbackText={user?.username?.charAt(0).toUpperCase() || '?'}
                  size="sm"
                  className="border border-dark-lighter"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black border-dark-lighter">
              <DropdownMenuItem 
                className="text-gray-200 cursor-pointer"
                onClick={() => setLocation("/profile")}
              >
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-gray-200 cursor-pointer"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      
      {/* No header banner as requested */}
    </div>
  );
};

export default AppHeader;
