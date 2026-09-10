import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { X, User, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { User as UserType } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

interface FollowerListPopupProps {
  isOpen: boolean;
  onClose: () => void;
  listType: 'followers' | 'following';
  userId?: number; // Optional: if viewing a specific user's followers/following
}

const FollowerListPopup: React.FC<FollowerListPopupProps> = ({ 
  isOpen, 
  onClose, 
  listType,
  userId 
}) => {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [userList, setUserList] = useState<UserType[]>([]);
  const targetUserId = userId || (user?.id || 0);

  // Determine the API endpoint based on list type
  const endpoint = listType === 'followers' 
    ? `/api/users/${targetUserId}/followers` 
    : `/api/users/${targetUserId}/following`;

  // Fetch users
  const { data: apiUsers = [], isLoading } = useQuery<UserType[]>({
    queryKey: [endpoint],
    enabled: isOpen && targetUserId > 0,
  });

  // Update the user list when data changes
  useEffect(() => {
    if (isOpen) {
      if (apiUsers.length > 0) {
        // Use API data
        setUserList(apiUsers);
      } else if (!isLoading) {
        // Empty the list if API returned empty and not loading
        setUserList([]);
      }
    }
  }, [apiUsers, isOpen, isLoading]);

  const handleUserClick = (userId: number) => {
    // Open chat with this user
    localStorage.setItem('chatWithUserId', userId.toString());
    setLocation('/messages');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Popup content */}
      <div className="relative w-full max-w-md max-h-[90vh] bg-dark-light rounded-t-lg sm:rounded-lg overflow-hidden z-50 flex flex-col">
        <div className="p-4 border-b border-dark-lighter flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">
            {listType === 'followers' ? 'Followers' : 'Following'}
          </h3>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-1">
          {isLoading ? (
            // Loading skeletons
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="p-3 flex items-center">
                <Skeleton className="h-12 w-12 rounded-full bg-dark-lighter" />
                <div className="ml-3 space-y-2 flex-1">
                  <Skeleton className="h-4 w-32 bg-dark-lighter" />
                  <Skeleton className="h-3 w-24 bg-dark-lighter" />
                </div>
              </div>
            ))
          ) : userList.length > 0 ? (
            // User list
            userList.map(user => (
              <div 
                key={user.id}
                className="p-3 flex items-center hover:bg-dark transition-colors cursor-pointer border-b border-dark-lighter"
                onClick={() => handleUserClick(user.id)}
              >
                <div className="w-12 h-12 rounded-full bg-dark-lighter overflow-hidden flex-shrink-0">
                  {user.profileImageUrl ? (
                    <img 
                      src={user.profileImageUrl} 
                      alt={user.username} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <User className="h-6 w-6" />
                    </div>
                  )}
                </div>
                
                <div className="ml-3 flex-1">
                  <p className="font-medium text-white flex items-center">
                    {user.displayName || user.username}
                    {user.isVerified && (
                      <span className="ml-1 text-blue-500" title="Verified User">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-400">
                    @{user.username}
                  </p>
                </div>
                
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="text-primary hover:bg-primary/10"
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  <span className="text-xs">Chat</span>
                </Button>
              </div>
            ))
          ) : (
            // Empty state
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-dark mx-auto mb-4 flex items-center justify-center">
                <User className="h-8 w-8 text-gray-400" />
              </div>
              <h4 className="text-lg font-medium text-white mb-2">
                {listType === 'followers' 
                  ? 'No followers yet' 
                  : 'Not following anyone yet'}
              </h4>
              <p className="text-gray-400 max-w-xs mx-auto">
                {listType === 'followers'
                  ? 'When other miners follow you, they will appear here.'
                  : 'When you follow other miners, they will appear here.'}
              </p>
              <Button 
                className="mt-4 bg-primary hover:bg-primary/90"
                onClick={() => {
                  setLocation("/leaderboard");
                  onClose();
                }}
              >
                {listType === 'following' ? 'Find miners to follow' : 'Back to Home'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowerListPopup;