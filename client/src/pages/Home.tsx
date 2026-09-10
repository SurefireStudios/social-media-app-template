import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import SwipeCard from "@/components/SwipeCard";
import SwipeActions from "@/components/SwipeActions";

import { useAuth } from "@/hooks/useAuth";
import { useSwipe } from "@/hooks/useSwipe";
import { Post } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { getApiUrl } from "@/lib/api";
import { API_BASE_URL } from "@/config";

const Home = () => {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const { handleSwipe } = useSwipe();
  // Always declare hooks at the top level for consistent execution order
  const isMobile = useIsMobile();
  
  // Fetch posts not swiped by the user
  const { data: posts = [], refetch } = useQuery<Post[]>({
    queryKey: ['/api/feed', user?.id], // Include user ID in query key
    queryFn: async ({ queryKey }) => {
      const userId = queryKey[1];
      const endpoint = '/api/feed';
      const response = await fetch(getApiUrl(endpoint));
      if (!response.ok) {
        throw new Error('Failed to fetch feed');
      }
      return response.json();
    }
  });
  
  const currentPost = posts[currentIndex] as Post | undefined;

  // Track which posts showed the daily limit message
  const [showedDailyLimitFor, setShowedDailyLimitFor] = useState<number[]>([]);

  // Handle swipe actions
  const onSwipe = async (direction: 'left' | 'right') => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to rate mining rigs",
        variant: "destructive",
      });
      setLocation("/auth");
      return;
    }

    if (!currentPost) return;

    try {
      // For left swipes (skips), just move to the next post without calling API
      if (direction === 'left') {
        moveToNextPost();
        return;
      }
      
      // For right swipes (ratings), call the API
      await handleSwipe(currentPost.id, direction);
      moveToNextPost();
    } catch (error) {
      console.error("Error swiping:", error);
      
      let errorMessage = "Failed to rate this rig. Try again later.";
      let variant: "default" | "destructive" = "destructive";
      
      // Check if this is a daily swipe limit error (they contain emoji)
      if (error instanceof Error && 
          (error.message.includes("😺") || 
           error.message.includes("😎") || 
           error.message.includes("🚀") || 
           error.message.includes("🐯") || 
           error.message.includes("⛏️"))) {
        
        // Check if we've already shown this message for this post
        if (!showedDailyLimitFor.includes(currentPost.id)) {
          // It's a friendly daily limit message - use a friendly toast
          console.log("Daily limit message:", error.message);
          
          try {
            // Try to parse as JSON if it contains JSON format
            if (error.message.includes('{"message":')) {
              const jsonStart = error.message.indexOf('{');
              const jsonPart = error.message.substring(jsonStart);
              const parsed = JSON.parse(jsonPart);
              errorMessage = parsed.message;
            } else {
              // Otherwise just clean up the status code
              errorMessage = error.message.replace(/^\d+: /, '');
            }
          } catch (e) {
            // Fallback cleanup if JSON parsing fails
            errorMessage = error.message
              .replace(/^\d+: /, '')
              .replace(/^"/, '')
              .replace(/"$/, '')
              .replace(/\\"/g, '"')
              .replace(/\\n/g, ' ')
              .replace(/\\t/g, ' ')
              .replace(/^{message:"|"}$/, '');
          }
            
          variant = "default"; // Use default toast style instead of destructive
          
          // Show the toast
          toast({
            title: "Daily Limit",
            description: errorMessage,
            variant: variant,
          });
          
          // Remember that we've shown this message for this post
          setShowedDailyLimitFor(prev => [...prev, currentPost.id]);
        }
        
        // Move to the next post even if there's a rate limit
        moveToNextPost();
      } else if (error instanceof Error) {
        errorMessage = error.message;
        toast({
          title: "Error",
          description: errorMessage,
          variant: variant,
        });
      }
    }
  };
  
  // Helper function to move to the next post
  const moveToNextPost = () => {
    // Move to next post, with continuous cycling
    if (currentIndex < posts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Always cycle back to the beginning without refreshing
      setCurrentIndex(0);
      
      // Refresh the feed in the background for next cycle
      refetch().catch(err => console.error("Error refreshing feed:", err));
      
      // Silent cycling - no notification to user as requested
      console.log("Cycling back to first post - silent mode");
      
      // Only show empty feed message if there are truly no posts
      if (posts.length === 0) {
        toast({
          title: "No mining rigs",
          description: "There are no rigs to rate right now. Why not upload yours?",
        });
      }
      // No toast notification when cycling through posts
    }
  };

  const testApiConnection = async () => {
    try {
      console.log("Testing API connection to port 5000...");
      const response = await fetch(`${API_BASE_URL}/api/test-connection`, {
        method: "GET",
        credentials: "include"
      });
      console.log("Test connection response:", response.status, await response.text());
    } catch (error) {
      console.error("API test connection error:", error);
    }
  };

  const testCorsConfiguration = async () => {
    console.log("Testing CORS configuration...");
    
    // Test using XMLHttpRequest which provides more CORS details
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `${API_BASE_URL}/api/leaderboard`);
    xhr.withCredentials = true; // Include cookies
    
    xhr.onload = () => {
      console.log("CORS test succeeded:", xhr.status, xhr.responseText);
    };
    
    xhr.onerror = () => {
      console.error("CORS test failed - likely a CORS issue");
    };
    
    xhr.send();
  };

  if (posts.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md bg-dark-light border-dark-lighter">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-4">No Mining Rigs</h2>
            <p className="text-gray-400 mb-6">There are no rigs to rate right now. Why not upload yours?</p>
            <Button onClick={() => setLocation("/upload")} className="bg-primary hover:bg-primary-dark">
              Upload My Rig
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full bg-dark">
      <div className="h-full flex flex-col md:flex-row">
        {/* Main content */}
        <div className="flex-grow flex flex-col">
          {currentPost && (
            <SwipeCard
              post={currentPost}
              onSwipe={onSwipe}
            />
          )}
          <SwipeActions onSwipeLeft={() => onSwipe('left')} onSwipeRight={() => onSwipe('right')} />
          
          {/* No footer ad on home page */}
        </div>
        
        {/* No sidebar ads on home page */}
      </div>
    </div>
  );
};

export default Home;
