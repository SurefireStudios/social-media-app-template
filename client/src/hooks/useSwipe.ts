import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "./useAuth";

export const useSwipe = () => {
  const { user } = useAuth();
  const [isSwipeInProgress, setIsSwipeInProgress] = useState(false);

  const swipeMutation = useMutation({
    mutationFn: async ({ postId, direction }: { postId: number, direction: 'left' | 'right' }) => {
      if (!user) throw new Error("You must be logged in to rate");
      
      console.log(`Attempting to swipe post ${postId} ${direction}`);
      const response = await apiRequest("POST", "/api/swipes", {
        userId: user.id,
        postId,
        direction,
      });
      console.log(`Swipe response status: ${response.status}`);

      return response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/leaderboard'] });
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      }
    },
    onSettled: () => {
      setIsSwipeInProgress(false);
    }
  });

  const handleSwipe = async (postId: number, direction: 'left' | 'right') => {
    if (isSwipeInProgress) return;
    
    if (!user) {
      throw new Error("You must be logged in to rate mining rigs");
    }
    
    // Only process right swipes (actual ratings) through the API
    // Left swipes (skips) are handled directly in the UI by moving to the next post
    if (direction === 'right') {
      setIsSwipeInProgress(true);
      try {
        await swipeMutation.mutateAsync({ postId, direction });
        return true;
      } catch (error) {
        console.error("Swipe error:", error);
        throw error;
      } finally {
        setIsSwipeInProgress(false);
      }
    }
    
    return true; // For left swipes, just return success without API call
  };

  return {
    handleSwipe,
    isSwipeInProgress,
  };
};
