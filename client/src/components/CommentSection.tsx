import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Comment, User } from '@/lib/types';
import { timeAgo } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface CommentSectionProps {
  postId: number;
}

const CommentSection = ({ postId }: CommentSectionProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');

  // Fetch comments from API
  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: [`/api/posts/${postId}/comments`]
  });

  // Mutation for posting a new comment
  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error('Authentication required');
      return apiRequest('POST', '/api/comments', {
        postId,
        userId: user.id,
        content,
      });
    },
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/comments`] });
      toast({
        title: 'Comment posted',
        description: 'Your comment has been added successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to post comment',
        variant: 'destructive',
      });
    },
  });

  const handleSubmitComment = () => {
    if (!commentText.trim()) return;
    
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to comment',
        variant: 'destructive',
      });
      return;
    }

    // Submit comment via API
    commentMutation.mutate(commentText);
  };

  // Helper function to get user for a comment
  const { data: commentUsers = {} } = useQuery<Record<number, User>>({
    queryKey: ['/api/commentUsers', comments],
    enabled: comments.length > 0,
    queryFn: async () => {
      // Extract unique user IDs from comments
      const userIds = Array.from(new Set(comments.map(comment => comment.userId)));
      
      // Create an object to store user data by ID
      const userMap: Record<number, User> = {};
      
      // Fetch user data for each unique user ID
      await Promise.all(userIds.map(async (userId) => {
        try {
          const response = await apiRequest('GET', `/api/users/${userId}`);
          const userData = await response.json();
          userMap[userId] = userData;
        } catch (error) {
          console.error(`Failed to fetch user data for ID ${userId}:`, error);
        }
      }));
      
      return userMap;
    },
  });
  
  const getUserForComment = (userId: number): User | undefined => {
    return commentUsers[userId];
  };

  if (comments.length === 0 && !user) {
    return (
      <div className="p-4 bg-dark-light rounded-lg mt-4">
        <p className="text-center text-gray-400">No comments yet</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-light rounded-lg mt-4 overflow-hidden">
      <h3 className="text-light font-semibold p-3 border-b border-dark-lighter">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h3>
      
      {/* Comment list */}
      <div className="max-h-80 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="p-4 text-center text-gray-400">Be the first to comment</p>
        ) : (
          <div className="divide-y divide-dark-lighter">
            {comments.map((comment) => {
              const commentUser = getUserForComment(comment.userId);
              return (
                <div key={comment.id} className="p-3">
                  <div className="flex items-center mb-1">
                    <div className="w-6 h-6 rounded-full bg-dark-lighter flex items-center justify-center mr-2 overflow-hidden">
                      {commentUser?.profileImageUrl ? (
                        <img
                          src={commentUser.profileImageUrl}
                          alt={commentUser.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-gray-400">
                          {commentUser ? 
                            (commentUser.displayName || commentUser.username.replace(/^user_/, '')).charAt(0).toUpperCase()
                            : '?'}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-light">
                      {commentUser ? 
                        (commentUser.displayName || commentUser.username.replace(/^user_/, '')) : 
                        'Anonymous'}
                      {commentUser?.isVerified && 
                        <span className="ml-1 inline-flex items-center text-sky-400">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                        </span>
                      }
                    </span>
                    <span className="text-xs text-gray-500">
                      {timeAgo(typeof comment.createdAt === 'string' ? new Date(comment.createdAt).getTime() : comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 pl-8">{comment.content}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Comment form */}
      {user && (
        <div className="p-3 border-t border-dark-lighter">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-dark-lighter flex items-center justify-center mr-2 overflow-hidden">
              {user.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt={user.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-gray-400">
                  {(user.displayName || user.username.replace(/^user_/, '')).charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <Textarea
              placeholder="Add a comment..."
              className="min-h-9 text-sm bg-dark-lighter border-dark-lighter focus-visible:ring-primary text-light resize-none"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <Button
              size="sm"
              className="ml-2 bg-primary text-white"
              onClick={handleSubmitComment}
              disabled={commentMutation.isPending || !commentText.trim()}
            >
              Post
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentSection;