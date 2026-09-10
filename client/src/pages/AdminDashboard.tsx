import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { User, Post } from '@/lib/types';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertCircle, 
  Ban,
  CheckCircle, 
  Shield, 
  UserX, 
  Award, 
  Search, 
  Trash, 
  Flag, 
  Eye, 
  ThumbsDown, 
  ThumbsUp,
  ImageIcon,
  Plus,
  Edit,
  Link,
  Bell,
  Send,
  Users,
  MessageSquare
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { getApiUrl } from "@/lib/api";
import { APP_NAME } from "@/lib/brand";

// Interface for report data
interface Report {
  id: number;
  postId: number;
  reporterId: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  post: Post;
  reporter: User;
  postOwner: User;
}

// Interface for ad data
interface Ad {
  id: number;
  name: string;
  imageUrl: string;
  linkUrl: string;
  location: string;
  width: number;
  height: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [reportCount, setReportCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'verify' | 'unverify' | 'ban' | 'unban' | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportAction, setReportAction] = useState<'approve' | 'reject' | null>(null);
  
  // Reset app data states
  const [confirmResetApp, setConfirmResetApp] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  
  // Ad management states
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [adFormOpen, setAdFormOpen] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [adImageFile, setAdImageFile] = useState<File | null>(null);
  const [adPreviewUrl, setAdPreviewUrl] = useState<string | null>(null);

  // Notification management states
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [customNotificationOpen, setCustomNotificationOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [notificationType, setNotificationType] = useState<'system' | 'announcement' | 'update'>('system');

  // Check if user is admin, if not redirect to home
  useEffect(() => {
    if (user && !user.isAdmin) {
      toast({
        title: "Access Denied",
        description: "You do not have permission to access the admin dashboard.",
        variant: "destructive"
      });
      navigate('/');
    }
  }, [user, navigate, toast]);

  // Reset app data handler
  const handleResetAppData = async () => {
    if (!confirmResetApp) {
      setConfirmResetApp(true);
      return;
    }
    
    // User confirmed, reset data
    setConfirmResetApp(false);
    
    try {
      setResetLoading(true);
      
      const response = await fetch(getApiUrl(`/api/admin/reset-app-data`), {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to reset app data: ${response.status}`);
      }
      
      toast({
        title: "Application data reset",
        description: "All posts, comments, swipes, follows, reports, and notifications have been cleared. User points reset to 0.",
        variant: "default",
      });
      
      // Refresh data
      fetchUsers();
      fetchReports();
      fetchAds();
    } catch (error) {
      console.error("Error resetting app data:", error);
      toast({
        title: "Error resetting data",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };
  
  // Fetch all users function
  const fetchUsers = async () => {
    if (!user?.isAdmin) return;
    
    try {
      setIsLoading(true);
      const response = await apiRequest('GET', `/api/admin/users`);
      const allUsers = await response.json();
      setUsers(allUsers as User[]);
      setFilteredUsers(allUsers as User[]);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to load users. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Call fetchUsers on component mount
  useEffect(() => {
    if (!user?.isAdmin) return;
    fetchUsers();
  }, [user, toast]);
  
  // Fetch reports function
  const fetchReports = async () => {
    if (!user?.isAdmin) return;
    
    try {
      setIsLoadingReports(true);
      const response = await apiRequest('GET', `/api/admin/reports`);
      const pendingReports = await response.json();
      setReports(pendingReports as Report[]);
      setReportCount(pendingReports.length);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({
        title: "Error",
        description: "Failed to load reports. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingReports(false);
    }
  };
  
  // Call fetchReports on component mount
  useEffect(() => {
    if (!user?.isAdmin) return;
    fetchReports();
  }, [user, toast]);
  
  // Fetch ads function
  const fetchAds = async () => {
    if (!user?.isAdmin) return;
    
    try {
      setIsLoadingAds(true);
      // Pass adminId to ensure we get all ads including inactive ones
      const response = await apiRequest('GET', `/api/ads`);
      const allAds = await response.json();
      setAds(allAds as Ad[]);
    } catch (error) {
      console.error('Error fetching ads:', error);
      toast({
        title: "Error",
        description: "Failed to load ads. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingAds(false);
    }
  };

  // Call fetchAds on component mount
  useEffect(() => {
    if (!user?.isAdmin) return;
    fetchAds();
  }, [user, toast]);

  // Handle search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(user => 
      user.username.toLowerCase().includes(query) || 
      (user.displayName && user.displayName.toLowerCase().includes(query)) ||
      (user.email && user.email.toLowerCase().includes(query))
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  const handleVerifyUser = async (userId: number) => {
    try {
      const response = await apiRequest(
        'PATCH',
        `/api/admin/users/${userId}`,
        { isVerified: true }
      );
      const updatedUser = await response.json() as User;

      // Update local state
      setUsers(prev => 
        prev.map(u => u.id === userId ? { ...u, isVerified: true } : u)
      );
      setFilteredUsers(prev => 
        prev.map(u => u.id === userId ? { ...u, isVerified: true } : u)
      );

      toast({
        title: "Success",
        description: `User ${updatedUser.username} has been verified.`,
      });
    } catch (error) {
      console.error('Error verifying user:', error);
      toast({
        title: "Error",
        description: "Failed to verify user. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleBanUser = async (userId: number, ban: boolean) => {
    try {
      const response = await apiRequest(
        'PATCH',
        `/api/admin/users/${userId}`,
        { isBanned: ban }
      );
      const updatedUser = await response.json() as User;

      // Update local state
      setUsers(prev => 
        prev.map(u => u.id === userId ? { ...u, isBanned: ban } : u)
      );
      setFilteredUsers(prev => 
        prev.map(u => u.id === userId ? { ...u, isBanned: ban } : u)
      );

      toast({
        title: "Success",
        description: `User ${updatedUser.username} has been ${ban ? 'banned' : 'unbanned'}.`,
      });
    } catch (error) {
      console.error(`Error ${ban ? 'banning' : 'unbanning'} user:`, error);
      toast({
        title: "Error",
        description: `Failed to ${ban ? 'ban' : 'unban'} user. Please try again.`,
        variant: "destructive"
      });
    }
  };

  const openConfirmDialog = (user: User, action: 'verify' | 'unverify' | 'ban' | 'unban') => {
    setSelectedUser(user);
    setConfirmAction(action);
    setConfirmDialogOpen(true);
  };

  // Add a handler for unverifying users
  const handleUnverifyUser = async (userId: number) => {
    try {
      const response = await apiRequest(
        'PATCH',
        `/api/admin/users/${userId}`,
        { isVerified: false }
      );
      const updatedUser = await response.json() as User;

      // Update local state
      setUsers(prev => 
        prev.map(u => u.id === userId ? { ...u, isVerified: false } : u)
      );
      setFilteredUsers(prev => 
        prev.map(u => u.id === userId ? { ...u, isVerified: false } : u)
      );

      toast({
        title: "Success",
        description: `Verification removed from user ${updatedUser.username}.`,
      });
    } catch (error) {
      console.error('Error unverifying user:', error);
      toast({
        title: "Error",
        description: "Failed to remove verification. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleConfirmAction = () => {
    if (!selectedUser || !confirmAction) return;

    if (confirmAction === 'verify') {
      handleVerifyUser(selectedUser.id);
    } else if (confirmAction === 'unverify') {
      handleUnverifyUser(selectedUser.id);
    } else if (confirmAction === 'ban') {
      handleBanUser(selectedUser.id, true);
    } else if (confirmAction === 'unban') {
      handleBanUser(selectedUser.id, false);
    }

    setConfirmDialogOpen(false);
    setSelectedUser(null);
    setConfirmAction(null);
  };
  
  // Open report action dialog
  const openReportDialog = (report: Report, action: 'approve' | 'reject') => {
    setSelectedReport(report);
    setReportAction(action);
    setReportDialogOpen(true);
  };
  
  // Handle report action (approve = remove the post, reject = dismiss the report)
  const handleReportAction = async () => {
    if (!selectedReport || !reportAction || !user) return;
    
    try {
      console.log(`Processing report ID: ${selectedReport.id}, action: ${reportAction}, postId: ${selectedReport.postId}`);
      
      const response = await apiRequest(
        'PATCH',
        `/api/admin/reports/${selectedReport.id}`,
        { status: reportAction === 'approve' ? 'approved' : 'rejected' }
      );
      
      if (response.ok) {
        // Remove report from the list
        setReports(prev => prev.filter(r => r.id !== selectedReport.id));
        setReportCount(prev => prev - 1);
        
        toast({
          title: "Success",
          description: reportAction === 'approve' 
            ? "Report approved. The post has been removed." 
            : "Report rejected. The post will remain visible.",
        });
      } else {
        throw new Error("Failed to process report");
      }
    } catch (error) {
      console.error('Error processing report:', error);
      toast({
        title: "Error",
        description: `Failed to ${reportAction} report. Please try again.`,
        variant: "destructive"
      });
    } finally {
      setReportDialogOpen(false);
      setSelectedReport(null);
      setReportAction(null);
    }
  };
  
  // Ad management handlers
  const openAdForm = (ad: Ad | null = null) => {
    setSelectedAd(ad);
    setAdImageFile(null);
    setAdPreviewUrl(ad?.imageUrl || null);
    setAdFormOpen(true);
  };
  
  const handleAdImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAdImageFile(file);
      
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setAdPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleDeleteAd = async (adId: number) => {
    if (!user?.isAdmin) return;
    
    try {
      const response = await apiRequest(
        'DELETE',
        `/api/admin/ads/${adId}`
      );
      
      if (response.ok) {
        // Remove ad from list
        setAds(prev => prev.filter(ad => ad.id !== adId));
        
        toast({
          title: "Success",
          description: "Ad deleted successfully",
        });
      } else {
        throw new Error("Failed to delete ad");
      }
    } catch (error) {
      console.error('Error deleting ad:', error);
      toast({
        title: "Error",
        description: "Failed to delete ad. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handleSubmitAd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!user?.isAdmin) return;
    
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    // Add adminId to the form data
    formData.append('adminId', user.id.toString());
    
    // Force the ad dimensions to be 320x100
    formData.set('width', '320');
    formData.set('height', '100');
    
    if (selectedAd) {
      // Update existing ad
      // Only include image if a new one was selected
      if (!adImageFile) {
        formData.delete('image');
      }
      
      try {
        const response = await fetch(getApiUrl(`/api/admin/ads/${selectedAd.id}`), {
          method: 'PATCH',
          body: formData,
        });
        
        if (response.ok) {
          const updatedAd = await response.json();
          
          // Update ad in state
          setAds(prev => prev.map(ad => ad.id === updatedAd.id ? updatedAd : ad));
          
          toast({
            title: "Success",
            description: "Ad updated successfully",
          });
          
          setAdFormOpen(false);
        } else {
          throw new Error("Failed to update ad");
        }
      } catch (error) {
        console.error('Error updating ad:', error);
        toast({
          title: "Error",
          description: "Failed to update ad. Please try again.",
          variant: "destructive"
        });
      }
    } else {
      // Create new ad
      try {
        const response = await fetch(getApiUrl(`/api/admin/ads`), {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const newAd = await response.json();
          
          // Add new ad to state
          setAds(prev => [...prev, newAd]);
          
          toast({
            title: "Success",
            description: "Ad created successfully",
          });
          
          setAdFormOpen(false);
        } else {
          throw new Error("Failed to create ad");
        }
      } catch (error) {
        console.error('Error creating ad:', error);
        toast({
          title: "Error",
          description: "Failed to create ad. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  // Notification functions
  const sendWelcomeNotification = async () => {
    if (!user?.isAdmin) return;
    
    try {
      setNotificationLoading(true);
      
      const message = `Welcome to ${APP_NAME}! Share your first photo to start earning points, and follow a few people to fill up your feed.`;
      
      const result = await sendCustomNotificationToAll(message);
      
      toast({
        title: "Welcome Notification Sent",
        description: result.message,
        variant: "default",
      });
    } catch (error) {
      console.error("Error sending welcome notification:", error);
      toast({
        title: "Error",
        description: "Failed to send welcome notification",
        variant: "destructive",
      });
    } finally {
      setNotificationLoading(false);
    }
  };

  /**
   * Send one announcement to every user.
   *
   * This used to POST /api/notifications with `userId: 0` and a comment saying
   * it would be overridden per user. Nothing overrode it — it created a single
   * notification addressed to a user that does not exist. The server now owns
   * the fan-out.
   */
  const sendCustomNotificationToAll = async (message: string) => {
    const response = await fetch(getApiUrl(`/api/admin/announce`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.message ?? `Failed to send announcement: ${response.status}`);
    }

    return response.json() as Promise<{ message: string; sent: number; failed: number[] }>;
  };

  const sendCustomNotification = async () => {
    if (!customMessage.trim()) {
      toast({
        title: "Error",
        description: "Please enter a notification message",
        variant: "destructive",
      });
      return;
    }

    try {
      setNotificationLoading(true);
      
      let targetUsers = selectedUserIds.length > 0 ? selectedUserIds : users.map(u => u.id);
      let notificationsSent = 0;
      
      for (const userId of targetUsers) {
        try {
          const response = await fetch(getApiUrl(`/api/notifications`), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: userId,
              type: notificationType,
              message: customMessage,
              sourceUserId: null
            })
          });
          
          if (response.ok) {
            notificationsSent++;
          }
        } catch (error) {
          console.error(`Failed to send notification to user ${userId}:`, error);
        }
      }
      
      toast({
        title: "Custom Notification Sent",
        description: `Sent notification to ${notificationsSent} user(s).`,
        variant: "default",
      });
      
      // Reset form
      setCustomMessage('');
      setSelectedUserIds([]);
      setCustomNotificationOpen(false);
      
    } catch (error) {
      console.error("Error sending custom notification:", error);
      toast({
        title: "Error",
        description: "Failed to send custom notification",
        variant: "destructive",
      });
    } finally {
      setNotificationLoading(false);
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-[70vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-lg">Loading admin dashboard...</p>
      </div>
    );
  }

  // If user is not an admin, don't render anything (they'll be redirected)
  if (!user?.isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 overflow-y-auto h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 flex items-center">
          <Shield className="mr-2" /> Admin Dashboard
        </h1>
        <p className="text-muted-foreground">Manage users and content on {APP_NAME}</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="reported" className="relative">
            Reported Content
            {reportCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {reportCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="ads">
            <ImageIcon className="mr-1 h-4 w-4" /> Ad Management
          </TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search users by name, username or email..."
              className="pl-10"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="rounded-md border max-h-[60vh] overflow-auto">
            <Table>
              <TableCaption>List of all registered users</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">ID</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Points</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.id}</TableCell>
                    <TableCell>
                      <a 
                        href={`/profile/${user.id}`} 
                        className="hover:underline text-primary font-medium cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/profile/${user.id}`);
                        }}
                      >
                        {user.displayName || user.username.replace(/^user_/, '')}
                      </a>
                      {user.isAdmin && (
                        <Badge variant="outline" className="ml-2 bg-amber-100 text-black">
                          Admin
                        </Badge>
                      )}
                      {user.isVerified && (
                        <Badge variant="outline" className="ml-2 bg-sky-100 text-black">
                          <CheckCircle className="mr-1 h-3 w-3" /> Verified
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                    <TableCell className="hidden md:table-cell">{user.points}</TableCell>
                    <TableCell>
                      {user.isBanned ? (
                        <Badge variant="destructive">Banned</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-100 text-black">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!user.isVerified ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openConfirmDialog(user, 'verify')}
                          className="mr-1"
                        >
                          <Award className="h-4 w-4 mr-1" /> Verify
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openConfirmDialog(user, 'unverify')}
                          className="mr-1 text-blue-500 hover:text-blue-700 hover:bg-blue-100"
                        >
                          <Ban className="h-4 w-4 mr-1" /> Unverify
                        </Button>
                      )}
                      
                      {!user.isBanned ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openConfirmDialog(user, 'ban')}
                          className="text-red-500 hover:text-red-700 hover:bg-red-100"
                        >
                          <UserX className="h-4 w-4 mr-1" /> Ban
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openConfirmDialog(user, 'unban')}
                          className="text-green-500 hover:text-green-700 hover:bg-green-100"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Unban
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="reported">
          {isLoadingReports ? (
            <div className="flex flex-col items-center justify-center p-10 text-center border rounded-md">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mb-4"></div>
              <p className="text-lg">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center border rounded-md">
              <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No reported content</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Reported content will appear here. Currently, there are no reports to review.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <h3 className="text-lg font-medium flex items-center mb-4">
                <Flag className="mr-2 text-red-500" /> Pending Reports ({reportCount})
              </h3>
              
              <div className="grid grid-cols-1 gap-6">
                {reports.map(report => (
                  <Card key={report.id} className="overflow-hidden">
                    <div className="grid md:grid-cols-7 gap-4">
                      <div className="md:col-span-2 bg-muted">
                        <div className="relative h-60 w-full">
                          <a href={report.post.imageUrl} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={report.post.imageUrl} 
                              alt="Reported Mining Rig" 
                              className="object-cover h-full w-full hover:opacity-90 transition-opacity"
                            />
                          </a>
                        </div>
                      </div>
                      <div className="md:col-span-5 p-6">
                        <div className="flex flex-col h-full">
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <Badge variant="destructive" className="mr-2">
                                  <Flag className="mr-1 h-3 w-3" /> Reported
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(report.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm font-medium">
                                Report ID: {report.id}
                              </p>
                            </div>
                            <h4 className="text-lg font-semibold mb-1">
                              {report.post.minerModel}
                            </h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              Uploaded by{" "}
                              <a 
                                href={`/profile/${report.postOwner.id}`} 
                                className="hover:underline text-primary"
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigate(`/profile/${report.postOwner.id}`);
                                }}
                              >
                                {report.postOwner.displayName || report.postOwner.username.replace(/^user_/, '')}
                              </a>
                              {report.postOwner.isVerified && (
                                <CheckCircle className="inline-block ml-1 h-3 w-3 text-blue-500" />
                              )}
                            </p>
                          </div>
                          
                          <div className="mb-4 flex-grow">
                            <h5 className="font-medium mb-1">Reason for report:</h5>
                            <p className="text-sm p-3 bg-muted rounded-md">{report.reason}</p>
                          </div>
                          
                          <div className="mt-auto pt-4 border-t">
                            <p className="text-sm mb-3">
                              <span className="font-medium">Reported by:</span>{" "}
                              <a 
                                href={`/profile/${report.reporter.id}`} 
                                className="hover:underline text-primary"
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigate(`/profile/${report.reporter.id}`);
                                }}
                              >
                                {report.reporter.displayName || report.reporter.username.replace(/^user_/, '')}
                              </a>
                            </p>
                            <div className="flex space-x-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openReportDialog(report, 'reject')}
                                className="text-muted-foreground"
                              >
                                <ThumbsDown className="h-4 w-4 mr-1" /> Reject Report
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => openReportDialog(report, 'approve')}
                              >
                                <Trash className="h-4 w-4 mr-1" /> Remove Content
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ads">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium flex items-center">
                <ImageIcon className="mr-2" /> Ad Management
              </h3>
              <Button onClick={() => openAdForm()} className="bg-green-600 hover:bg-green-700">
                <Plus className="mr-2 h-4 w-4" /> Create New Ad
              </Button>
            </div>
            
            {isLoadingAds ? (
              <div className="flex flex-col items-center justify-center p-10 text-center border rounded-md">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mb-4"></div>
                <p className="text-lg">Loading ads...</p>
              </div>
            ) : ads.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center border rounded-md">
                <ImageIcon className="h-10 w-10 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No ads available</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  No ads have been created yet. Click the button below to create your first ad.
                </p>
                <Button onClick={() => openAdForm()} className="bg-green-600 hover:bg-green-700">
                  <Plus className="mr-2 h-4 w-4" /> Create New Ad
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ads.map(ad => (
                  <Card key={ad.id} className="overflow-hidden">
                    <div className="relative">
                      <div className="bg-muted aspect-video w-full overflow-hidden">
                        <img 
                          src={ad.imageUrl} 
                          alt={ad.name} 
                          className="object-cover h-full w-full"
                        />
                      </div>
                      <Badge 
                        variant={ad.active ? "default" : "outline"} 
                        className={`absolute top-2 right-2 ${!ad.active && 'bg-gray-200 text-gray-700'}`}
                      >
                        {ad.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <div className="mb-4">
                        <h4 className="text-lg font-semibold mb-1 truncate">{ad.name}</h4>
                        <p className="text-sm text-muted-foreground mb-2 truncate">
                          <Link className="inline-block mr-1 h-3 w-3" /> 
                          <a 
                            href={ad.linkUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:underline text-blue-500"
                          >
                            {ad.linkUrl}
                          </a>
                        </p>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <span className="mr-2">Size: {ad.width}×{ad.height}</span>
                          <span>Location: {ad.location.includes('slot') ? 
                            ad.location.replace('leaderboard_slot', 'Leaderboard Slot ') : 
                            ad.location.charAt(0).toUpperCase() + ad.location.slice(1)
                          }</span>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteAd(ad.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash className="h-4 w-4 mr-1" /> Delete
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openAdForm(ad)}
                        >
                          <Edit className="h-4 w-4 mr-1" /> Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          
          {/* Ad Form Dialog */}
          <Dialog open={adFormOpen} onOpenChange={setAdFormOpen}>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader>
                <DialogTitle>
                  {selectedAd ? `Edit Ad: ${selectedAd.name}` : 'Create New Ad'}
                </DialogTitle>
                <DialogDescription>
                  {selectedAd 
                    ? 'Update the advertisement settings below.' 
                    : 'Fill in the details below to create a new advertisement.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitAd}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="name" className="text-right font-medium">
                      Name
                    </label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={selectedAd?.name || ''}
                      className="col-span-3"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="linkUrl" className="text-right font-medium">
                      Link URL
                    </label>
                    <Input
                      id="linkUrl"
                      name="linkUrl"
                      defaultValue={selectedAd?.linkUrl || ''}
                      className="col-span-3"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="location" className="text-right font-medium">
                      Location
                    </label>
                    <select
                      id="location"
                      name="location"
                      defaultValue={selectedAd?.location || 'leaderboard'}
                      className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      required
                    >
                      <option value="leaderboard">Leaderboard (Random Placement)</option>
                      <option value="leaderboard_slot1">Leaderboard - Slot 1 (Left)</option>
                      <option value="leaderboard_slot2">Leaderboard - Slot 2 (Middle)</option>
                      <option value="leaderboard_slot3">Leaderboard - Slot 3 (Right)</option>
                      <option value="auth">Auth Page</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right font-medium">
                      Dimensions
                    </label>
                    <div className="col-span-3">
                      <div className="flex space-x-2">
                        <Input
                          id="width"
                          name="width"
                          type="number"
                          value={320}
                          readOnly
                          className="bg-muted"
                        />
                        <span className="flex items-center">×</span>
                        <Input
                          id="height"
                          name="height"
                          type="number"
                          value={100}
                          readOnly
                          className="bg-muted"
                        />
                        <span className="flex items-center">px</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">All ads must be 320×100px</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right font-medium">
                      Status
                    </label>
                    <div className="col-span-3 flex items-center space-x-2">
                      <input
                        id="active"
                        name="active"
                        type="checkbox"
                        defaultChecked={selectedAd?.active !== false}
                        value="true"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor="active" className="text-sm font-medium">
                        Active
                      </label>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 items-start gap-4">
                    <label htmlFor="image" className="text-right font-medium pt-2">
                      Image
                    </label>
                    <div className="col-span-3">
                      <Input
                        id="image"
                        name="image"
                        type="file"
                        accept="image/jpeg,image/png,image/gif"
                        onChange={handleAdImageChange}
                        className="mb-2"
                        required={!selectedAd}
                      />
                      {adPreviewUrl && (
                        <div className="mt-2 border rounded-md overflow-hidden">
                          <img 
                            src={adPreviewUrl} 
                            alt="Preview" 
                            className="max-h-48 object-contain mx-auto"
                          />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload a JPG, PNG, or GIF image file (max 25MB).
                      </p>
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setAdFormOpen(false)} className="mr-2">
                    Cancel
                  </Button>
                  <Button type="submit">
                    {selectedAd ? 'Update Ad' : 'Create Ad'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium flex items-center">
                <Bell className="mr-2" /> Send Notifications
              </h3>
            </div>
          </div>
          
          <div className="space-y-6">
            {/* Pre-defined notifications */}
            <Card>
              <CardContent className="p-6">
                <h4 className="text-md font-medium mb-4 flex items-center">
                  <MessageSquare className="mr-2 h-4 w-4" /> Pre-defined Notifications
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={sendWelcomeNotification}
                    disabled={notificationLoading}
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-start"
                  >
                    <div className="flex items-center mb-2">
                      <Users className="mr-2 h-4 w-4 text-green-500" />
                      <span className="font-medium">Welcome Message</span>
                    </div>
                    <p className="text-xs text-muted-foreground text-left">
                      Send welcome message to all users
                    </p>
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Custom notification */}
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-md font-medium flex items-center">
                    <Send className="mr-2 h-4 w-4" /> Custom Notification
                  </h4>
                  <Button
                    onClick={() => setCustomNotificationOpen(true)}
                    variant="default"
                    size="sm"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Create Custom
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Create a custom notification to send to specific users or all users.
                </p>
              </CardContent>
            </Card>
            
            {/* Statistics */}
            <Card>
              <CardContent className="p-6">
                <h4 className="text-md font-medium mb-4">Notification Statistics</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-md">
                    <p className="text-2xl font-bold">{users.length}</p>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                  </div>
                  <div className="text-center p-4 border rounded-md">
                    <p className="text-2xl font-bold">{users.filter(u => u.isVerified).length}</p>
                    <p className="text-sm text-muted-foreground">Verified Users</p>
                  </div>
                  <div className="text-center p-4 border rounded-md">
                    <p className="text-2xl font-bold">{users.filter(u => !u.isBanned).length}</p>
                    <p className="text-sm text-muted-foreground">Active Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Custom notification dialog */}
          <Dialog open={customNotificationOpen} onOpenChange={setCustomNotificationOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Send Custom Notification</DialogTitle>
                <DialogDescription>
                  Create and send a custom notification to selected users or all users.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Notification Type</label>
                  <select
                    value={notificationType}
                    onChange={(e) => setNotificationType(e.target.value as 'system' | 'announcement' | 'update')}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="system">System</option>
                    <option value="announcement">Announcement</option>
                    <option value="update">Update</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Message</label>
                  <Textarea
                    placeholder="Enter your notification message here..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Recipients</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Leave blank to send to all users, or select specific users by ID
                  </p>
                  <Input
                    placeholder="User IDs (comma-separated, e.g., 1,2,3)"
                    value={selectedUserIds.join(',')}
                    onChange={(e) => {
                      const ids = e.target.value.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                      setSelectedUserIds(ids);
                    }}
                  />
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <p>Preview: This will send the notification to {selectedUserIds.length > 0 ? `${selectedUserIds.length} selected user(s)` : `all ${users.length} users`}</p>
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setCustomNotificationOpen(false)}
                  disabled={notificationLoading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={sendCustomNotification}
                  disabled={notificationLoading || !customMessage.trim()}
                >
                  {notificationLoading ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-0 border-r-0 rounded-full"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Notification
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="border p-4 rounded-md">
              <h3 className="text-lg font-medium mb-2">Total Users</h3>
              <p className="text-3xl font-bold">{users.length}</p>
            </div>
            <div className="border p-4 rounded-md">
              <h3 className="text-lg font-medium mb-2">Verified Users</h3>
              <p className="text-3xl font-bold">{users.filter(u => u.isVerified).length}</p>
            </div>
            <div className="border p-4 rounded-md">
              <h3 className="text-lg font-medium mb-2">Banned Users</h3>
              <p className="text-3xl font-bold">{users.filter(u => u.isBanned).length}</p>
            </div>
            <div className="border p-4 rounded-md">
              <h3 className="text-lg font-medium mb-2 flex items-center">
                <Flag className="h-4 w-4 mr-2 text-red-500" /> Pending Reports
              </h3>
              <p className="text-3xl font-bold">{reportCount}</p>
            </div>
          </div>
          <h3 className="text-lg font-medium mb-4">Platform Stats</h3>
          <div className="rounded-md border p-4 text-center">
            <p className="text-muted-foreground">Detailed platform statistics will be added in a future update.</p>
          </div>
          
          <div className="mt-10 border-t pt-8">
            <h3 className="text-lg font-medium mb-4 flex items-center text-red-600">
              <Trash className="h-5 w-5 mr-2" /> Pre-Launch Data Reset
            </h3>
            <div className="rounded-md border border-red-300 p-6 bg-red-950/10 dark:bg-red-900/20">
              <p className="mb-4">
                This tool is intended for pre-launch cleanup only. It will delete <strong>ALL</strong> posts, 
                comments, swipes, follows, reports, and notifications from the database. User accounts will 
                remain, but all points will be reset to zero.
              </p>
              <div className="flex justify-center">
                <Button 
                  variant={confirmResetApp ? "destructive" : "outline"} 
                  className={`${confirmResetApp ? '' : 'border-red-300 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'}`}
                  onClick={handleResetAppData}
                  disabled={resetLoading}
                >
                  {resetLoading ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-0 border-r-0 rounded-full"></div>
                      Resetting...
                    </>
                  ) : confirmResetApp ? (
                    <>Click again to confirm reset</>
                  ) : (
                    <>Reset application data</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* User Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === 'verify' && "Verify User"}
              {confirmAction === 'unverify' && "Remove Verification"}
              {confirmAction === 'ban' && "Ban User"}
              {confirmAction === 'unban' && "Unban User"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'verify' && (
                `Are you sure you want to verify ${selectedUser?.displayName || selectedUser?.username?.replace(/^user_/, '')}? This will add a verification badge to their profile.`
              )}
              {confirmAction === 'unverify' && (
                `Are you sure you want to remove verification from ${selectedUser?.displayName || selectedUser?.username?.replace(/^user_/, '')}? This will remove the verification badge from their profile.`
              )}
              {confirmAction === 'ban' && (
                `Are you sure you want to ban ${selectedUser?.displayName || selectedUser?.username?.replace(/^user_/, '')}? They will no longer be able to log in or interact with the platform.`
              )}
              {confirmAction === 'unban' && (
                `Are you sure you want to unban ${selectedUser?.displayName || selectedUser?.username?.replace(/^user_/, '')}? This will restore their access to the platform.`
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmAction}
              variant={confirmAction === 'ban' ? 'destructive' : 'default'}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Report Confirmation Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reportAction === 'approve' && "Remove Reported Content"}
              {reportAction === 'reject' && "Reject Report"}
            </DialogTitle>
            <DialogDescription>
              {reportAction === 'approve' && (
                <>
                  <p className="mb-2">
                    Are you sure you want to remove this content? This action cannot be undone. The post will be permanently deleted.
                  </p>
                  {selectedReport && (
                    <div className="mt-4 p-2 bg-muted rounded-md">
                      <p className="text-sm font-medium">Report reason:</p>
                      <p className="text-sm italic">"{selectedReport.reason}"</p>
                    </div>
                  )}
                </>
              )}
              {reportAction === 'reject' && (
                "Are you sure you want to reject this report? The content will remain visible to all users."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReportAction}
              variant={reportAction === 'approve' ? 'destructive' : 'default'}
            >
              {reportAction === 'approve' ? 'Remove Content' : 'Reject Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}