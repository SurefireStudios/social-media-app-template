import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { timeAgo } from '@/lib/date-utils';
import { ArrowLeft, ThumbsUp, MessageSquare, Share2, UserPlus, UserCheck, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Post, User } from '@/lib/types';
import CommentSection from '@/components/CommentSection';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const PostDetail = () => {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const postId = parseInt(id || '0');
  
  // Report dialog state
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  
  // API data queries
  const { data: post, isLoading: isPostLoading } = useQuery<Post>({
    queryKey: [`/api/posts/${postId}`],
    enabled: !!postId,
  });
  
  const { data: postUser, isLoading: isUserLoading } = useQuery<User>({
    queryKey: [`/api/users/${post?.userId}`],
    enabled: !!post?.userId,
  });
  
  // For follow functionality
  const [isFollowing, setIsFollowing] = useState(false);
  
  const isLoading = isPostLoading || isUserLoading;
  
  // Check if the current user follows the post user
  useEffect(() => {
    if (postUser && user && postUser.id !== user.id) {
      // We would check the isFollowing property from the API result
      if (postUser && 'isFollowing' in postUser) {
        setIsFollowing(Boolean(postUser.isFollowing));
      }
    }
  }, [postUser, user]);
  
  useEffect(() => {
    if (!postId) {
      setLocation("/");
    }
  }, [postId, setLocation]);
  
  if (!postId) {
    return null;
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }
  
  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-xl font-semibold mb-4">Post not found</h2>
        <Button onClick={() => setLocation('/')} variant="outline">Back to Home</Button>
      </div>
    );
  }
  
  const handleLike = () => {
    toast({
      title: "Liked!",
      description: "You liked this mining rig",
    });
  };
  
  const handleShare = () => {
    // In a real app, this would open a share dialog
    toast({
      title: "Share feature",
      description: "Share functionality coming soon!",
    });
  };
  
  // Handle report submission
  const handleReportSubmit = async () => {
    if (!reportReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for your report",
        variant: "destructive"
      });
      return;
    }
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to report content",
        variant: "destructive"
      });
      setLocation("/auth");
      return;
    }
    
    try {
      // API call to report content
      const response = await apiRequest(
        'POST',
        '/api/reports',
        {
          postId: post.id,
          reporterId: user.id,
          reason: reportReason.trim()
        }
      );
      
      if (!response.ok) {
        throw new Error("Failed to submit report");
      }
      
      toast({
        title: "Content Reported",
        description: "Thank you for helping keep our community safe. Our team will review this content.",
      });
    } catch (error) {
      console.error("Error reporting content:", error);
      toast({
        title: "Report failed",
        description: error instanceof Error ? error.message : "Failed to submit your report. Please try again.",
        variant: "destructive"
      });
    } finally {
      setReportDialogOpen(false);
      setReportReason('');
    }
  };
  
  return (
    <div className="h-full overflow-y-auto bg-dark">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-dark border-b border-dark-lighter p-3 flex items-center">
        <Button 
          variant="ghost"
          size="icon"
          className="text-light"
          onClick={() => setLocation('/')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-light ml-2">Mining Rig Details</h1>
      </div>
      
      {/* Post Header */}
      <div className="p-3 border-b border-dark-lighter">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div 
              className="w-10 h-10 rounded-full border border-dark-lighter bg-dark-light flex items-center justify-center overflow-hidden cursor-pointer"
              onClick={() => setLocation(`/profile/${post.userId}`)}
            >
              {postUser?.profileImageUrl ? (
                <img 
                  src={postUser.profileImageUrl}
                  alt={postUser.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-lg text-gray-400">
                  {postUser ? (postUser.displayName || postUser.username.replace(/^user_/, '')).charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </div>
            
            <div className="ml-3 cursor-pointer" onClick={() => setLocation(`/profile/${post.userId}`)}>
              <div className="flex items-center">
                <h3 className="text-light font-semibold">
                  {postUser ? (postUser.displayName || postUser.username.replace(/^user_/, '')) : 'Anonymous'}
                </h3>
                {postUser?.isVerified && (
                  <span className="ml-1 inline-flex items-center text-sky-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400">
                {postUser?.location && `${postUser.location} • `}
                {timeAgo(typeof post.createdAt === 'string' ? new Date(post.createdAt).getTime() : post.createdAt)}
              </div>
            </div>
          </div>
          
          {/* Follow/Unfollow Button - only show for other miners, not own posts */}
          {user && postUser && postUser.id !== user.id && (
            <Button 
              variant={isFollowing ? "default" : "outline"}
              size="sm"
              className={isFollowing ? "bg-primary text-white" : "text-primary border-primary hover:bg-primary/10"}
              onClick={() => {
                // Optimistically update UI
                const wasFollowing = isFollowing;
                setIsFollowing(!isFollowing);
                
                // Make API call
                apiRequest(
                  wasFollowing ? 'DELETE' : 'POST',
                  wasFollowing ? `/api/follows/${user.id}/${postUser.id}` : '/api/follows',
                  wasFollowing ? undefined : { followerId: user.id, followedId: postUser.id }
                ).then(response => {
                  if (!response.ok) {
                    // Revert UI if API call fails
                    setIsFollowing(wasFollowing);
                    throw new Error(wasFollowing ? "Failed to unfollow" : "Failed to follow");
                  }
                  
                  // Invalidate queries to refresh data
                  queryClient.invalidateQueries({ queryKey: [`/api/users/${postUser.id}`] });
                  
                  // Show success message
                  toast({
                    title: wasFollowing ? "Unfollowed" : "Following",
                    description: wasFollowing
                      ? `You are no longer following ${postUser.displayName || postUser.username.replace(/^user_/, '') || 'this miner'}`
                      : `You are now following ${postUser.displayName || postUser.username.replace(/^user_/, '') || 'this miner'}`,
                  });
                }).catch(error => {
                  console.error("Follow/unfollow error:", error);
                  toast({
                    title: "Action failed",
                    description: error.message,
                    variant: "destructive"
                  });
                });
              }}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="h-4 w-4 mr-1" />
                  Following
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-1" />
                  Follow
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      
      {/* Post Image */}
      <div className="bg-dark-light relative">
        <img 
          src={post.imageUrl}
          alt={`Mining rig: ${post.minerModel}`}
          className="w-full object-contain max-h-96"
        />
        
        {/* Report button - positioned in top right corner */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 bg-dark/60 hover:bg-dark/80 text-red-500 backdrop-blur-sm"
          onClick={() => setReportDialogOpen(true)}
        >
          <Flag className="h-4 w-4 mr-1" />
          Report
        </Button>
      </div>
      
      {/* Post Details */}
      <div className="p-4 border-b border-dark-lighter">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-xl text-light font-semibold flex items-center">
              {post.minerModel}
              <span className="bg-primary rounded px-2 py-0.5 text-xs font-mono text-white ml-2">
                {post.algorithm || "SHA-256"}
              </span>
            </h2>
          </div>
          <div className="px-3 py-1 bg-primary rounded text-white font-mono text-sm">
            {post.points} pts
          </div>
        </div>
        
        {post.hashrate && (
          <div className="mb-2">
            <span className="text-gray-400 text-sm">Hashrate: </span>
            <span className="text-light font-mono">{post.hashrate}</span>
          </div>
        )}
        
        {post.power && (
          <div className="mb-2">
            <span className="text-gray-400 text-sm">Power: </span>
            <span className="text-light font-mono">{post.power}</span>
          </div>
        )}
        
        {post.temperature && (
          <div className="mb-2">
            <span className="text-gray-400 text-sm">Temperature: </span>
            <span className="text-light font-mono">{post.temperature}</span>
          </div>
        )}
        
        {post.efficiency && (
          <div className="mb-2">
            <span className="text-gray-400 text-sm">Efficiency: </span>
            <span className="text-light font-mono">{post.efficiency}</span>
          </div>
        )}
        
        {post.modifications && (
          <div className="mt-4">
            <h3 className="text-light font-semibold mb-1">Modifications</h3>
            <p className="text-gray-300">{post.modifications}</p>
          </div>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="flex border-b border-dark-lighter">
        <Button 
          variant="ghost" 
          className="flex-1 py-6 rounded-none text-light hover:text-primary hover:bg-dark-lighter"
          onClick={handleLike}
        >
          <ThumbsUp className="h-5 w-5 mr-2" />
          Like
        </Button>
        <Button 
          variant="ghost" 
          className="flex-1 py-6 rounded-none text-light hover:text-primary hover:bg-dark-lighter"
        >
          <MessageSquare className="h-5 w-5 mr-2" />
          Comment
        </Button>
        <Button 
          variant="ghost" 
          className="flex-1 py-6 rounded-none text-light hover:text-primary hover:bg-dark-lighter"
          onClick={handleShare}
        >
          <Share2 className="h-5 w-5 mr-2" />
          Share
        </Button>
      </div>
      
      {/* Comments Section */}
      <div className="p-4">
        <CommentSection postId={postId} />
      </div>
      
      {/* Report Content Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="bg-dark-light border-dark-lighter text-light">
          <DialogHeader>
            <DialogTitle className="text-light">Report Content</DialogTitle>
            <DialogDescription className="text-gray-400">
              Please explain why you're reporting this content. Our team will review your report.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Textarea 
              placeholder="Explain why this content should be removed (e.g., spam, offensive, inappropriate, etc.)"
              className="bg-dark border-dark-lighter text-light"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleReportSubmit}
            >
              <Flag className="h-4 w-4 mr-1" />
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PostDetail;