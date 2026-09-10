import { useState } from "react";
import { Bell, Heart, MessageSquare, Award, UserPlus, ChevronRight, CheckCheck } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@shared/schema";
import { getApiUrl } from "@/lib/api";
import { timeAgo } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";

const Notifications = () => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Fetch notifications for the logged-in user
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['/api/notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(getApiUrl(`/api/notifications/${user.id}`));
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const data = await response.json();
      return data;
    },
    enabled: !!user?.id,
  });

  // Mutation to mark a notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await fetch(getApiUrl(`/api/notifications/${notificationId}/read`), {
        method: 'PATCH'
      });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate to refresh the notifications data
      queryClient.invalidateQueries({ queryKey: ['/api/notifications', user?.id] });
      // Also invalidate the unread count if we're tracking it elsewhere
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count', user?.id] });
    }
  });

  // Mutation to mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return null;
      const response = await fetch(getApiUrl(`/api/notifications/${user.id}/read-all`), {
        method: 'PATCH'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count', user?.id] });
    }
  });

  const handleNotificationClick = (notification: Notification) => {
    // Mark the notification as read if it isn't already
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
    
    // Navigate based on notification type
    if (notification.type === 'like' || notification.type === 'comment') {
      if (notification.postId) {
        setLocation(`/post/${notification.postId}`);
      }
    } else if (notification.type === 'follow') {
      setLocation(`/profile/${notification.sourceUserId}`);
    } else if (notification.type === 'message') {
      // Navigate to messages with this user
      localStorage.setItem('chatWithUserId', notification.sourceUserId?.toString() || '');
      setLocation('/messages');
    } else if (notification.type === 'points') {
      setLocation(`/profile/${user?.id}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-5 h-5 text-red-500" />;
      case 'comment':
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'follow':
        return <UserPlus className="w-5 h-5 text-green-500" />;
      case 'message':
        return <MessageSquare className="w-5 h-5 text-orange-500" />;
      case 'points':
        return <Award className="w-5 h-5 text-yellow-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  if (!user) {
    // Redirect to login if no user is authenticated
    setLocation("/auth");
    return null;
  }

  return (
    <div className="h-full overflow-y-auto bg-dark">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Bell className="w-6 h-6 text-primary mr-2" />
            <h1 className="text-xl font-semibold text-light">Notifications</h1>
          </div>
          
          {notifications.length > 0 && notifications.some((n: Notification) => !n.read) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="text-xs bg-dark-lighter border-dark-lighter text-light hover:bg-dark hover:text-primary"
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              {markAllAsReadMutation.isPending ? "Clearing..." : "Clear All"}
            </Button>
          )}
        </div>
        
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Bell className="w-12 h-12 text-gray-600 mb-3" />
            <p className="text-gray-400 text-center">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification: Notification) => (
              <div 
                key={notification.id} 
                className={`p-3 rounded-lg flex items-start cursor-pointer transition-colors ${
                  notification.read ? 'bg-dark-light' : 'bg-dark-lighter'
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="mr-3 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1">
                  <p className={`text-sm ${notification.read ? 'text-gray-300' : 'text-light font-medium'}`}>
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {timeAgo(notification.createdAt)}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 mt-1" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;