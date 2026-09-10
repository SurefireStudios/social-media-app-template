import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import LeaderboardItem from "@/components/LeaderboardItem";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { User } from "@/lib/types";
import AdBanner from "@/components/AdBanner";
import { apiRequest } from "@/lib/queryClient";
import { RotateCcw } from "lucide-react";
import { Ad } from "@shared/schema";

const Leaderboard = () => {
  const [filter, setFilter] = useState("global");
  const { user } = useAuth();
  const [followedUsers, setFollowedUsers] = useState<User[]>([]);
  const { toast } = useToast();
  
  // Setup effect to keep followed users in sync
  useEffect(() => {
    // Fetch followed users from API
    const fetchFollowedUsers = async () => {
      try {
        if (user) {
          // Update the following tab count by refreshing data from API
          const response = await apiRequest('GET', `/api/users/${user.id}/following`);
          const followedData = await response.json();
          if (followedData) {
            console.log('Fetched followed users from API:', followedData);
            setFollowedUsers(followedData);
          }
        }
      } catch (error) {
        console.error('Error fetching followed users:', error);
      }
    };
    
    // Initial fetch when component mounts
    fetchFollowedUsers();
    
    // Listen for custom DOM events for updates from other components
    const handleFollowEvent = async () => {
      // When follow status changes, refetch followed users
      if (user) {
        try {
          const response = await apiRequest('GET', `/api/users/${user.id}/following`);
          const followedData = await response.json();
          if (followedData) {
            console.log('Updated followed users after event:', followedData);
            setFollowedUsers(followedData);
          }
        } catch (error) {
          console.error('Error updating followed users after event:', error);
        }
      }
    };
    
    // Add event listener for follow status changes
    document.addEventListener('followStatusChange', handleFollowEvent);
    
    // Cleanup
    return () => {
      document.removeEventListener('followStatusChange', handleFollowEvent);
    };
  }, [user]);

  // Fetch users for leaderboard
  const { data: users = [], isLoading, refetch } = useQuery<User[]>({
    queryKey: ['leaderboard-with-follow-status-v2', user?.id], // Changed key to force cache miss
    queryFn: async () => {
      console.log('🔥 NEW LEADERBOARD QUERY RUNNING 🔥');
      console.log('User object:', user);
      console.log('User ID:', user?.id);
      console.log('User ID type:', typeof user?.id);
      
      const url = user?.id 
        ? `/api/leaderboard` 
        : '/api/leaderboard';
      console.log('🎯 Final URL:', url);
      console.log('📡 Making request to:', url);
      
      const response = await apiRequest('GET', url);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      const data = await response.json();
      console.log('✅ Response data sample:', data.slice(0, 2));
      console.log('✅ First user isFollowing:', data[0]?.isFollowing);
      return data;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  
  // Fetch ads for the leaderboard page and ensure uniqueness
  const { data: ads = [] } = useQuery<Ad[]>({
    queryKey: ['/api/ads'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/ads?location=leaderboard`);
      if (!response.ok) throw new Error('Failed to fetch ads');
      let adsData = await response.json();
      
      // Filter for active ads
      adsData = adsData.filter((ad: Ad) => ad.active);
      
      // If we have fewer than 3 unique ads, we'll just show what we have
      // If we have more than 3, we'll pick 3 unique ones randomly
      if (adsData.length > 3) {
        // Get 3 random ads without duplicates
        const shuffled = [...adsData].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 3);
      }
      
      return adsData;
    },
  });
  
  // Reset follows mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/follows/reset');
    },
    onSuccess: () => {
      toast({
        title: "Follows reset",
        description: "All follows have been reset successfully.",
        variant: "default"
      });
      // If in following tab, refresh the list
      if (filter === 'following') {
        setFollowedUsers([]);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to reset follows. Please try again.",
        variant: "destructive"
      });
      console.error("Error resetting follows:", error);
    }
  });
  
  // Handler for reset button
  const handleResetFollows = () => {
    resetMutation.mutate();
  };

  return (
    <div className="h-full overflow-y-auto bg-dark">
      <div className="p-4">
        {/* Responsive ad banners - 3 in a row on desktop, only 1 on mobile */}
        <div className="mb-6 flex flex-col md:flex-row justify-between gap-3 w-full">
          {/* First ad - always visible on all screen sizes, left aligned */}
          <div className="md:self-start flex justify-center md:justify-start">
            <AdBanner
              location="leaderboard"
              slot={1}
              width={320}
              height={100}
              imageUrl={ads.find(ad => ad.location === "leaderboard_slot1")?.imageUrl}
              linkUrl={ads.find(ad => ad.location === "leaderboard_slot1")?.linkUrl}
            />
          </div>
          
          {/* Second ad - only visible on md screens and up, centered */}
          <div className="hidden md:flex md:justify-center">
            <AdBanner
              location="leaderboard"
              slot={2}
              width={320}
              height={100}
              imageUrl={ads.find(ad => ad.location === "leaderboard_slot2")?.imageUrl}
              linkUrl={ads.find(ad => ad.location === "leaderboard_slot2")?.linkUrl}
            />
          </div>
          
          {/* Third ad - only visible on md screens and up, right aligned */}
          <div className="hidden md:flex md:justify-end">
            <AdBanner
              location="leaderboard"
              slot={3}
              width={320}
              height={100}
              imageUrl={ads.find(ad => ad.location === "leaderboard_slot3")?.imageUrl}
              linkUrl={ads.find(ad => ad.location === "leaderboard_slot3")?.linkUrl}
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <h2 className="text-xl font-semibold text-light mr-3">Leaderboard</h2>
          </div>
          
          <Tabs defaultValue="global" onValueChange={(value) => {
            console.log('Tab changed to:', value);
            setFilter(value);
          }} className="w-auto">
            <TabsList className="bg-dark-light">
              <TabsTrigger value="global">Global</TabsTrigger>
              <TabsTrigger value="following">Following ({followedUsers.length})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {/* Show loading skeletons if still loading */}
        {isLoading ? (
          <div>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="mb-4 relative">
                <div className="bg-dark-light rounded-lg p-3 flex items-center">
                  <div className="flex-1 flex">
                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-dark-lighter mr-3">
                      <Skeleton className="w-6 h-6 rounded-full" />
                    </div>
                    <Skeleton className="w-10 h-10 rounded-full mr-3" />
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <Skeleton className="w-24 h-4 rounded" />
                        <Skeleton className="w-12 h-6 rounded" />
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <Skeleton className="w-16 h-3 rounded" />
                        <Skeleton className="w-12 h-3 rounded" />
                      </div>
                    </div>
                  </div>
                  <Skeleton className="w-20 h-8 rounded ml-3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {filter === "global" && 
              users.map((user, index) => (
                <LeaderboardItem 
                  key={user.id} 
                  user={user} 
                  rank={index + 1} 
                />
              ))
            }
            
            {filter === "following" && (
              followedUsers.length > 0 ? (
                followedUsers.map((user, index) => (
                  <LeaderboardItem 
                    key={user.id} 
                    user={user} 
                    rank={index + 1} 
                  />
                ))
              ) : (
                <div className="py-8 text-center text-gray-400">
                  Follow miners to see them here
                </div>
              )
            )}
          </div>
        )}
      </div>
      
      {/* No footer banner as requested */}
    </div>
  );
};

export default Leaderboard;
