import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Post } from "@/lib/types";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Flag } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { timeAgo } from '@/lib/date-utils';
import Avatar from "@/components/Avatar";
import { APP_NAME } from "@/lib/brand";

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

interface SwipeCardProps {
  post: Post;
  onSwipe: (direction: 'left' | 'right') => void;
}

const SwipeCard = ({ post, onSwipe }: SwipeCardProps) => {
  const [, setLocation] = useLocation();
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  // Fetch post user data from API
  const { data: postOwner } = useQuery<User>({
    queryKey: [`/api/users/${post.userId}`]
  });
  
  // For random location when user has none
  const [randomLocation, setRandomLocation] = useState<string>("");
  
  // Separate effect for random location
  useEffect(() => {
    // Set a random location when the post changes
    setRandomLocation(DEFAULT_LOCATIONS[Math.floor(Math.random() * DEFAULT_LOCATIONS.length)]);
  }, [post.userId]);
  
  // For follow status
  const [isFollowing, setIsFollowing] = useState(false);
  
  // Use follow status from post object if available, otherwise fall back to API call
  useEffect(() => {
    if ('isFollowing' in post && typeof post.isFollowing === 'boolean') {
      setIsFollowing(post.isFollowing);
    }
  }, [post]);
  
  // Fallback follow query for backwards compatibility (only if post doesn't have isFollowing)
  const followQuery = useQuery({
    queryKey: [`/api/follows/${currentUser?.id}/${post.userId}`],
    enabled: !!currentUser && !!post.userId && !('isFollowing' in post)
  });
  
  // Update following state when fallback data changes
  useEffect(() => {
    // Only use fallback query if post doesn't have isFollowing property
    if (!('isFollowing' in post) && followQuery.isSuccess) {
      setIsFollowing(!!followQuery.data);
    }
  }, [followQuery.isSuccess, followQuery.data, post]);
  
  // Follow/unfollow mutations
  const followMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/follows', {
        followerId: currentUser!.id,
        followedId: post.userId
      });
    },
    onSuccess: () => {
      setIsFollowing(true);
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: [`/api/follows/${currentUser?.id}/${post.userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${currentUser?.id}/following`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${post.userId}/followers`] });
    }
  });
  
  const unfollowMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/follows/${currentUser!.id}/${post.userId}`);
    },
    onSuccess: () => {
      setIsFollowing(false);
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: [`/api/follows/${currentUser?.id}/${post.userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${currentUser?.id}/following`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${post.userId}/followers`] });
    }
  });

  // Framer Motion values
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-30, 30]);
  const rightOpacity = useTransform(x, [0, 100], [0, 1]);
  const leftOpacity = useTransform(x, [0, -100], [0, 1]);

  // Effect to handle swipe completion
  useEffect(() => {
    const unsubscribe = x.onChange((latest) => {
      if (latest > 150) {
        setSwipeDirection('right');
      } else if (latest < -150) {
        setSwipeDirection('left');
      }
    });

    return () => unsubscribe();
  }, [x]);

  useEffect(() => {
    if (swipeDirection) {
      const timer = setTimeout(() => {
        onSwipe(swipeDirection);
        setSwipeDirection(null);
        x.set(0);
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [swipeDirection, onSwipe, x]);

  // Handle report submission
  const handleReportSubmit = async () => {
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please sign in to report content",
        variant: "destructive",
      });
      setReportDialogOpen(false);
      setLocation("/auth");
      return;
    }

    if (!reportReason.trim()) {
      toast({
        title: "Report reason required",
        description: "Please provide a reason for reporting this content",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiRequest(
        'POST',
        '/api/reports',
        {
          postId: post.id,
          reporterId: currentUser.id,
          reason: reportReason
        }
      );

      if (response.ok) {
        toast({
          title: "Report submitted",
          description: `Thank you for helping keep ${APP_NAME} safe. Our team will review your report.`
        });
        setReportDialogOpen(false);
        setReportReason('');
      } else {
        throw new Error("Failed to submit report");
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({
        title: "Error",
        description: "Failed to submit report. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate hashrate percentage for the progress bar
  // This is just a visual representation
  const hashratePercentage = Math.min(Math.random() * 100, 100);

  return (
    <div className="w-full h-[calc(100%-7rem)] px-4 py-6 relative">
      <motion.div 
        ref={cardRef}
        className="w-full h-full rounded-xl overflow-hidden bg-dark-light border border-dark-lighter relative flex flex-col"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        style={{ x, rotate }}
        dragElastic={0.7}
        onDragEnd={(e, { offset, velocity }) => {
          if (offset.x > 100) {
            onSwipe('right');
          } else if (offset.x < -100) {
            onSwipe('left');
          }
        }}
      >
        {/* Card Header */}
        <div className="absolute top-0 left-0 w-full z-10 bg-gradient-to-b from-dark to-transparent p-3">
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center cursor-pointer" 
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/profile/${post.userId}`);
              }}
            >
              <Avatar
                src={postOwner?.profileImageUrl}
                alt={postOwner?.username}
                size="sm"
                fallbackText={postOwner?.username?.charAt(0).toUpperCase() || '?'}
                className="border border-dark-lighter"
              />
              <div className="ml-2">
                <h3 className="text-sm font-semibold text-light flex items-center">
                  {postOwner?.displayName || (postOwner?.username ? postOwner.username.replace(/^user_/, '') : "Loading...")}
                  {postOwner?.isVerified && (
                    <span className="ml-1 text-blue-500" title="Verified User">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-400">
                  {postOwner?.location || randomLocation}
                </p>
              </div>
            </div>
            <div className="flex items-center">
              {currentUser && postOwner && currentUser.id !== postOwner.id && (
                <button 
                  className={`transition p-1 ${isFollowing ? 'text-primary' : 'text-gray-400 hover:text-primary'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isFollowing) {
                      // Unfollow the user
                      unfollowMutation.mutate();
                      toast({
                        title: "Unfollowed",
                        description: `You are no longer following ${postOwner.displayName || (postOwner.username ? postOwner.username.replace(/^user_/, '') : 'this miner')}`,
                      });
                    } else {
                      // Follow the user
                      followMutation.mutate();
                      toast({
                        title: "Following",
                        description: `You are now following ${postOwner.displayName || (postOwner.username ? postOwner.username.replace(/^user_/, '') : 'this miner')}`,
                      });
                    }
                  }}
                >
                  <i className={`${isFollowing ? 'fas fa-user-check' : 'fas fa-user-plus'} text-sm`}></i>
                </button>
              )}
              <button 
                className="transition p-1 ml-2 text-gray-400 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  setReportDialogOpen(true);
                }}
              >
                <Flag className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Image Container */}
        <div className="flex-1 bg-dark-light relative overflow-hidden">
          {/* Blurred background image */}
          <div 
            className="absolute inset-0 w-full h-full bg-cover bg-center blur-lg scale-110 opacity-50"
            style={{ 
              backgroundImage: `url(${post.imageUrl})`,
              filter: 'blur(20px) brightness(0.3)'
            }}
          />
          
          {/* Main image - fit to height, centered */}
          <div className="relative w-full h-full flex items-center justify-center">
            <img 
              src={post.imageUrl} 
              alt={`Mining rig: ${post.minerModel}`} 
              className="max-w-full max-h-full object-contain cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/post/${post.id}`);
              }}
            />
          </div>
          
          {/* Swipe Overlays */}
          <motion.div 
            className="absolute top-1/2 left-1/4 transform -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white p-3 rounded-lg border-4 border-white rotate-12 z-10"
            style={{ opacity: leftOpacity }}
          >
            <span className="text-3xl font-bold tracking-wider">SKIP</span>
          </motion.div>
          
          <motion.div 
            className="absolute top-1/2 right-1/4 transform translate-x-1/2 -translate-y-1/2 bg-primary text-white p-3 rounded-lg border-4 border-white -rotate-12 z-10"
            style={{ opacity: rightOpacity }}
          >
            <span className="text-3xl font-bold tracking-wider">RATE</span>
          </motion.div>
        </div>
        
        {/* Card Details */}
        <div className="p-3 bg-dark-light border-t border-dark-lighter">
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-base font-semibold text-light flex items-center">
                {post.minerModel}
                <span className="bg-primary rounded px-2 py-0.5 text-xs font-mono text-white ml-2">
                  {post.algorithm || "SHA-256"}
                </span>
              </h2>
            </div>
            {post.modifications && (
              <div>
                <span className="text-primary text-xs">Modded</span>
              </div>
            )}
          </div>
          
          {/* Hashrate details */}
          {post.hashrate && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Hashrate</span>
                <span className="font-mono">{post.hashrate}</span>
              </div>
              <div className="relative h-2 bg-dark-lighter rounded overflow-hidden">
                <div 
                  className="absolute h-full bg-gradient-to-r from-primary to-primary-light transition-all duration-1000 rounded"
                  style={{ width: `${hashratePercentage}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {/* Modifications */}
          {post.modifications && (
            <div className="text-sm text-gray-300 mb-3">
              <p>{post.modifications}</p>
            </div>
          )}
          
          {/* Stats row */}
          <div className="flex justify-between text-xs text-gray-400 pt-2 border-t border-dark-lighter">
            {post.power && <span><i className="fas fa-bolt mr-1"></i> {post.power}</span>}
            {post.temperature && <span><i className="fas fa-thermometer-half mr-1"></i> {post.temperature}</span>}
            {post.efficiency && <span><i className="fas fa-tachometer-alt mr-1"></i> {post.efficiency}</span>}
            <span><i className="fas fa-clock mr-1"></i> {post.createdAt ? timeAgo(typeof post.createdAt === 'string' ? new Date(post.createdAt).getTime() : post.createdAt) : 'Recently'}</span>
          </div>
        </div>
      </motion.div>

      {/* Report Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Inappropriate Content</DialogTitle>
            <DialogDescription>
              Please tell us why you're reporting this mining rig image. Our moderation team will review your report promptly.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for reporting</Label>
              <Textarea
                id="reason"
                placeholder="Please explain why you believe this content violates our community guidelines..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReportSubmit} 
              disabled={isSubmitting || !reportReason.trim()}
            >
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SwipeCard;
