import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Avatar from "@/components/Avatar";

// Default locations for users without a location
const DEFAULT_LOCATIONS = [
  "Somewhere out there 🌌",
  "Off the grid",
  "Location classified 🕵️",
  "Lost in the void",
  "[Redacted]",
  "Quantum position uncertain",
  "Somewhere on Earth (probably)",
  "Wherever the Wi-Fi is",
  "Somewhere on-chain",
  "Behind 7 proxies and a VPN",
  "Chillin' in the cryptoverse"
];

interface LeaderboardItemProps {
  user: User;
  rank: number;
}

const LeaderboardItem = ({ user, rank }: LeaderboardItemProps) => {
  const [, setLocation] = useLocation();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [followCount, setFollowCount] = useState<number>(
    parseInt(localStorage.getItem('followCount') || '0')
  );
  const [lastFollowReset, setLastFollowReset] = useState<number>(
    parseInt(localStorage.getItem('lastFollowReset') || '0')
  );
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  
  // Check if current user is following this user
  // TEMPORARILY DISABLED - using server-side follow status instead
  /*
  useEffect(() => {
    // If the user object already has isFollowing property (from leaderboard endpoint), use it
    if ('isFollowing' in user && typeof user.isFollowing === 'boolean') {
      setIsFollowing(user.isFollowing);
      return;
    }
    
    // Otherwise, fall back to individual API call (for backwards compatibility)
    if (currentUser && user.id) {
      const checkFollowStatus = async () => {
        try {
          const response = await apiRequest("GET", `/api/follows/${currentUser.id}/${user.id}`);
          setIsFollowing(!!response);
        } catch (error) {
          console.error("Error checking follow status:", error);
        }
      };
      checkFollowStatus();
    }
  }, [currentUser, user.id]);
  */

  // TEMPORARY: Use isFollowing from user object if available, otherwise default to false
  useEffect(() => {
    console.log('🔍 LeaderboardItem for user:', user.username, 'isFollowing:', user.isFollowing);
    if ('isFollowing' in user && typeof user.isFollowing === 'boolean') {
      setIsFollowing(user.isFollowing);
    } else {
      setIsFollowing(false); // Default when no follow status available
    }
  }, [user]);
  
  const [randomLocation, setRandomLocation] = useState<string>("");
  
  // Set a random location when the user changes
  useEffect(() => {
    if (!user.location) {
      setRandomLocation(DEFAULT_LOCATIONS[Math.floor(Math.random() * DEFAULT_LOCATIONS.length)]);
    }
  }, [user.id]);
  
  // Reset follow count if an hour has passed
  const checkAndResetFollowCount = () => {
    const currentTime = Date.now();
    // If it's been more than an hour since last reset
    if (currentTime - lastFollowReset > 60 * 60 * 1000) {
      setFollowCount(0);
      localStorage.setItem('followCount', '0');
      localStorage.setItem('lastFollowReset', currentTime.toString());
      setLastFollowReset(currentTime);
      return 0;
    }
    return followCount;
  };

  const followMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/follows", {
        followerId: currentUser?.id,
        followedId: user.id
      });
    },
    onSuccess: () => {
      setIsFollowing(true);
      toast({
        title: "Success!",
        description: `You are now following ${user.displayName || user.username}`,
      });
      
      // Update count in state and localStorage
      const currentCount = checkAndResetFollowCount() + 1;
      setFollowCount(currentCount);
      localStorage.setItem('followCount', currentCount.toString());
      
      // Update queryClient to refresh data everywhere
      const currentUserId = currentUser?.id;
      if (currentUserId) {
        queryClient.invalidateQueries({ queryKey: [`/api/users/${currentUserId}/following`] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/leaderboard'] });
      // Also invalidate the specific user data if viewing profile
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}`] });
      
      // Dispatch a custom event to notify other components of follow status change
      const followEvent = new CustomEvent('followStatusChange', { 
        detail: { userId: user.id, isFollowing: true } 
      });
      document.dispatchEvent(followEvent);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to follow user",
        variant: "destructive"
      });
    }
  });

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/follows/${currentUser?.id}/${user.id}`);
    },
    onSuccess: () => {
      setIsFollowing(false);
      toast({
        title: "Unfollowed",
        description: `You have unfollowed ${user.displayName || user.username}`,
      });
      
      // Update queryClient to refresh data everywhere
      const currentUserId = currentUser?.id;
      if (currentUserId) {
        queryClient.invalidateQueries({ queryKey: [`/api/users/${currentUserId}/following`] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/leaderboard'] });
      // Also invalidate the specific user data if viewing profile
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}`] });
      
      // Dispatch a custom event to notify other components of follow status change
      const followEvent = new CustomEvent('followStatusChange', { 
        detail: { userId: user.id, isFollowing: false } 
      });
      document.dispatchEvent(followEvent);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unfollow user",
        variant: "destructive"
      });
    }
  });

  const getRankStyle = () => {
    if (rank === 1) return "bg-primary text-white";
    if (rank === 2) return "bg-secondary text-white";
    if (rank === 3) return "bg-gray-600 text-white";
    return "bg-dark-lighter text-white";
  };

  const handleFollowClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation to profile
    
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please sign in to follow users",
        variant: "destructive"
      });
      return;
    }
    
    // Check follow limit for following
    if (!isFollowing) {
      const currentCount = checkAndResetFollowCount();
      if (currentCount >= 100) {
        toast({
          title: "Follow limit reached",
          description: "You can only follow 100 users per hour. Please try again later.",
          variant: "destructive"
        });
        return;
      }
    }

    // Handle follow/unfollow via API
    if (isFollowing) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
    }
  };

  return (
    <div className="relative mb-4">
      <div 
        className="bg-dark-light rounded-lg p-3 flex items-center hover:bg-dark-lighter/50 transition relative"
      >
        <div 
          className="flex items-center flex-1 cursor-pointer"
          onClick={() => setLocation(`/profile/${user.id}`)}
        >
          <div className={`w-8 h-8 flex items-center justify-center font-semibold rounded-full ${getRankStyle()} mr-3`}>
            {rank}
          </div>
          
          <Avatar
            src={user.profileImageUrl}
            alt={user.displayName || user.username.replace(/^user_/, '')}
            size="md"
            fallbackText={(user.displayName || user.username.replace(/^user_/, '')).charAt(0).toUpperCase()}
            className="mr-3"
          />
          
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-light flex items-center">
                {user.displayName || user.username.replace(/^user_/, '')}
                {/* Trophy emoji for top 3 ranks */}
                {rank === 1 && <span className="ml-1" title="1st Place">🏆</span>}
                {rank === 2 && <span className="ml-1" title="2nd Place">🥈</span>}
                {rank === 3 && <span className="ml-1" title="3rd Place">🥉</span>}
                {user.isVerified && (
                  <span className="ml-1 text-blue-500" title="Verified User">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="currentColor" 
                      className="w-4 h-4"
                    >
                      <path 
                        fillRule="evenodd" 
                        clipRule="evenodd" 
                        d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                      />
                    </svg>
                  </span>
                )}
              </h3>
              <div className="text-primary font-mono font-medium text-lg">{user.points}</div>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-400">
              <span>{user.location || randomLocation}</span>
              <span>Total</span>
            </div>
          </div>
        </div>
        
        {/* Follow button - placed inside the container */}
        {currentUser && currentUser.id !== user.id && (
          <Button
            variant={isFollowing ? "outline" : "default"}
            size="sm"
            className={`ml-3 ${isFollowing ? 'border-primary text-primary hover:bg-primary/10 bg-dark' : 'bg-primary hover:bg-primary/90'} 
            md:px-6 px-2`}
            onClick={handleFollowClick}
            disabled={followMutation.isPending || unfollowMutation.isPending}
          >
            {isFollowing ? (
              <>
                <UserCheck className="h-4 w-4" />
                <span className="text-xs ml-1 hidden md:inline">Following</span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span className="text-xs ml-1 hidden md:inline">Follow</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default LeaderboardItem;
