import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Zap, Trophy, Plus, MessageSquare, User, Users } from "lucide-react";
import FollowerListPopup from "./FollowerListPopup";
import { useAuth } from "@/hooks/useAuth";

const AppNavigation = () => {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [isFollowerListOpen, setIsFollowerListOpen] = useState(false);

  const isActive = (path: string) => location === path;

  const handleChatClick = () => {
    if (!user) {
      // If not logged in, go to auth page
      setLocation("/auth");
      return;
    }
    
    // Show follower list popup
    setIsFollowerListOpen(true);
  };

  return (
    <>
      <nav className="bg-dark-light py-2 border-t border-dark-lighter grid grid-cols-5 gap-1 sticky bottom-0 z-30">
        <Button
          className={`flex flex-col items-center py-1 h-auto ${isActive('/') ? 'text-primary' : 'text-gray-500'}`}
          variant="ghost"
          onClick={() => setLocation("/")}
        >
          <Zap className="h-5 w-5 mb-1" />
          <span className="text-xs">Swipe</span>
        </Button>
        
        <Button
          className={`flex flex-col items-center py-1 h-auto ${isActive('/leaderboard') ? 'text-primary' : 'text-gray-500'}`}
          variant="ghost"
          onClick={() => setLocation("/leaderboard")}
        >
          <Trophy className="h-5 w-5 mb-1" />
          <span className="text-xs">Top</span>
        </Button>
        
        <div className="flex flex-col items-center justify-center">
          <Button
            className="w-12 h-12 rounded-full bg-primary hover:bg-primary-dark flex items-center justify-center -mt-5"
            size="icon"
            onClick={() => setLocation("/upload")}
          >
            <Plus className="h-5 w-5 text-white" />
          </Button>
        </div>
        
        <Button
          className={`flex flex-col items-center py-1 h-auto ${isActive('/messages') ? 'text-primary' : 'text-gray-500'}`}
          variant="ghost"
          onClick={handleChatClick}
        >
          <Users className="h-5 w-5 mb-1" />
          <span className="text-xs">Chat</span>
        </Button>
        
        <Button
          className={`flex flex-col items-center py-1 h-auto ${location.startsWith('/profile') ? 'text-primary' : 'text-gray-500'}`}
          variant="ghost"
          onClick={() => setLocation("/profile")}
        >
          <User className="h-5 w-5 mb-1" />
          <span className="text-xs">Profile</span>
        </Button>
      </nav>

      {/* Follower List Popup */}
      <FollowerListPopup 
        isOpen={isFollowerListOpen}
        onClose={() => setIsFollowerListOpen(false)}
        listType="following"
      />
    </>
  );
};

export default AppNavigation;
