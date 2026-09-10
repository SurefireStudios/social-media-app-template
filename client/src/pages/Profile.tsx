import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Edit, UserCheck, UserPlus } from "lucide-react";
import RigGalleryItem from "@/components/RigGalleryItem";
import EditProfileModal from "@/components/EditProfileModal";
import ThemePickerModal from "@/components/ThemePickerModal";
import FollowerListPopup from "@/components/FollowerListPopup";
import { User, UserWithStats, Post } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

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

const Profile = () => {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const userId = id ? parseInt(id) : user?.id;
  const isOwnProfile = user?.id === userId;
  const [showEditModal, setShowEditModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showFollowerList, setShowFollowerList] = useState(false);
  const [showFollowingList, setShowFollowingList] = useState(false);
  
  // Query API for user profile data
  const { data: profile, isLoading } = useQuery<UserWithStats>({
    queryKey: [`/api/users/${userId}`, user?.id],
    queryFn: async () => {
      const url = user?.id 
        ? `/api/users/${userId}` 
        : `/api/users/${userId}`;
      const response = await apiRequest('GET', url);
      if (!response.ok) throw new Error('Failed to fetch user profile');
      return response.json();
    },
    enabled: !!userId,
  });
  
  // Track following state
  const [isFollowing, setIsFollowing] = useState(false);

  // Random location for users that don't have one set
  const [randomLocation, setRandomLocation] = useState<string>("");
  
  // Set a random location when the profile changes
  useEffect(() => {
    if (profile) {
      if (!profile.location) {
        setRandomLocation(DEFAULT_LOCATIONS[Math.floor(Math.random() * DEFAULT_LOCATIONS.length)]);
      }
    }
  }, [profile?.id]);
  
  // Update following state whenever profile data changes
  useEffect(() => {
    if (profile && 'isFollowing' in profile && typeof profile.isFollowing === 'boolean') {
      setIsFollowing(profile.isFollowing);
    } else {
      // Default to false if no follow status is provided
      setIsFollowing(false);
    }
  }, [profile]);

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!user || !userId) throw new Error("Authentication required");
      return apiRequest("POST", "/api/follows", {
        followerId: user.id,
        followedId: userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      if (!user || !userId) throw new Error("Authentication required");
      return apiRequest("DELETE", `/api/follows/${user.id}/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
    },
  });

  const { toast } = useToast();
  
  const handleFollowToggle = () => {
    if (!user) {
      setLocation("/auth");
      return;
    }
    
    // Check follow limit (max 100 follows per hour)
    const currentTime = Date.now();
    const lastFollowReset = parseInt(localStorage.getItem('lastFollowReset') || '0');
    let currentFollowCount = parseInt(localStorage.getItem('followCount') || '0');
    
    // Reset counter if an hour has passed
    if (currentTime - lastFollowReset > 60 * 60 * 1000) {
      currentFollowCount = 0;
      localStorage.setItem('followCount', '0');
      localStorage.setItem('lastFollowReset', currentTime.toString());
    }
    
    // If not following and trying to follow, check the limit
    if (!isFollowing && currentFollowCount >= 100) {
      toast({
        title: "Follow limit reached",
        description: "You can only follow 100 users per hour. Please try again later.",
        variant: "destructive"
      });
      return;
    }
    
    // Optimistically update UI
    setIsFollowing(!isFollowing);
    
    if (isFollowing) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
      // Update follow count
      const newCount = currentFollowCount + 1;
      localStorage.setItem('followCount', newCount.toString());
    }
    
    // Show toast notification
    toast({
      title: !isFollowing ? "Following!" : "Unfollowed",
      description: !isFollowing 
        ? `You are now following ${profile?.username}` 
        : `You have unfollowed ${profile?.username}`,
    });
  };
  
  // Use useEffect to handle navigation to avoid React warnings
  useEffect(() => {
    if (!userId) {
      setLocation("/auth");
    }
  }, [userId, setLocation]);
  
  if (!userId) {
    return null;
  }

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">User not found</h2>
          <p className="text-gray-400 mb-4">This profile doesn't exist or has been removed</p>
          <Button onClick={() => setLocation("/")} variant="outline">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Handle profile updates
  const handleProfileUpdate = (updatedUser: User) => {
    // Invalidate the query to fetch the updated profile from API
    queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
  };

  return (
    <div className="h-full overflow-y-auto bg-dark">
      <div className="relative">
        {/* Profile Header */}
        <div className="h-32 overflow-hidden" style={{ 
          background: profile.bannerImageUrl 
            ? 'none' 
            : `linear-gradient(to right, var(--color-primary-dark), var(--color-primary) 60%, rgba(0,0,0,0.9))` 
        }}>
          {profile.bannerImageUrl && (
            <img 
              src={profile.bannerImageUrl} 
              alt="Profile banner" 
              className="w-full h-full object-cover"
            />
          )}
        </div>
        
        {/* Edit Profile Modal */}
        {profile && isOwnProfile && showEditModal && (
          <EditProfileModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            user={profile as User}
            onProfileUpdate={handleProfileUpdate}
          />
        )}
        
        {/* Theme Picker Modal */}
        {isOwnProfile && (
          <ThemePickerModal
            isOpen={showThemeModal}
            onClose={() => setShowThemeModal(false)}
          />
        )}
        
        <div className="px-4 pb-4 relative">
          <div className="flex justify-between items-end -mt-16 mb-4">
            <div className="w-24 h-24 rounded-full border-4 border-dark bg-dark-light flex items-center justify-center overflow-hidden">
              {profile.profileImageUrl ? (
                <img 
                  src={profile.profileImageUrl}
                  alt={profile.displayName || profile.username} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-4xl text-gray-400">
                  {(profile.displayName || profile.username || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            
            <div className="flex space-x-2">
              {isOwnProfile ? (
                <>
                  <Button 
                    onClick={() => setShowEditModal(true)}
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <Edit className="w-4 h-4 mr-1" /> Edit Profile
                  </Button>
                  <Button 
                    onClick={() => setShowThemeModal(true)}
                    variant="outline" 
                    className="p-2 bg-dark-lighter text-light"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={handleFollowToggle}
                  className="px-4 py-2 rounded-lg text-sm font-medium flex items-center text-white"
                  style={{ 
                    backgroundColor: isFollowing ? '#3A3A3A' : 'var(--color-primary)' 
                  }}
                  disabled={followMutation.isPending || unfollowMutation.isPending}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="w-4 h-4 mr-1" /> Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-1" /> Follow
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-light flex items-center">
              {profile.displayName || profile.username}
              {profile.isVerified && (
                <span className="ml-2 text-blue-500" title="Verified User">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </h2>
            <p className="text-gray-400 text-sm">
              {profile.location ? (
                <>
                  {profile.location.match(/https?:\/\/[^\s]+/g) ? (
                    <>
                      {profile.location.split(/\b(https?:\/\/[^\s]+)\b/).map((part, i) => {
                        if (i % 2 === 1) { // It's a URL
                          return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{part}</a>;
                        }
                        return part;
                      })} • 
                    </>
                  ) : (
                    `${profile.location} • `
                  )}
                </>
              ) : randomLocation ? (
                `${randomLocation} • `
              ) : (
                ''
              )}
              Mining since {profile.miningStartYear || new Date(profile.createdAt).getFullYear()}
            </p>
          </div>
          
          <div className="flex justify-between mb-6">
            <div className="text-center">
              <p className="text-xl font-semibold font-mono" style={{ color: 'var(--color-primary)' }}>{profile.points}</p>
              <p className="text-xs text-gray-400">POINTS</p>
            </div>
            <div 
              className="text-center cursor-pointer hover:opacity-80" 
              onClick={() => setShowFollowerList(true)}
            >
              <p className="text-xl font-semibold text-light">{profile.followerCount || 0}</p>
              <p className="text-xs text-gray-400">FOLLOWERS</p>
            </div>
            <div 
              className="text-center cursor-pointer hover:opacity-80"
              onClick={() => setShowFollowingList(true)}
            >
              <p className="text-xl font-semibold text-light">{profile.followingCount || 0}</p>
              <p className="text-xs text-gray-400">FOLLOWING</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-light">{profile.posts?.length || 0}</p>
              <p className="text-xs text-gray-400">RIGS</p>
            </div>
          </div>
          
          {/* Followers/Following Popups */}
          <FollowerListPopup
            isOpen={showFollowerList}
            onClose={() => setShowFollowerList(false)}
            listType="followers"
            userId={userId}
          />
          <FollowerListPopup
            isOpen={showFollowingList}
            onClose={() => setShowFollowingList(false)}
            listType="following"
            userId={userId}
          />
          
          {profile.bio && (
            <div className="bg-dark-light rounded-lg p-3 mb-6">
              {profile.bio.match(/https?:\/\/[^\s]+/g) ? (
                <p className="text-gray-300">
                  {profile.bio.split(/\b(https?:\/\/[^\s]+)\b/).map((part, i) => {
                    if (i % 2 === 1) { // It's a URL
                      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{part}</a>;
                    }
                    return part;
                  })}
                </p>
              ) : (
                <p className="text-gray-300">{profile.bio}</p>
              )}
            </div>
          )}
          
          {/* Profile Tabs */}
          <Tabs defaultValue="rigs">
            <TabsList className="border-b border-dark-lighter bg-transparent w-full justify-start">
              <TabsTrigger 
                value="rigs" 
                className="text-sm data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                style={{ 
                  '--tw-border-opacity': 1,
                  borderColor: 'var(--color-primary)',
                  color: 'var(--color-primary)'
                } as React.CSSProperties}
              >
                My Rigs
              </TabsTrigger>
              <TabsTrigger 
                value="stats" 
                className="text-sm data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                style={{ 
                  '--tw-border-opacity': 1,
                  borderColor: 'var(--color-primary)',
                  color: 'var(--color-primary)'
                } as React.CSSProperties}
              >
                Stats
              </TabsTrigger>

            </TabsList>
            
            {/* Gallery Grid */}
            <TabsContent value="rigs" className="mt-4">
              {profile.posts && profile.posts.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {profile.posts.map((post) => (
                    <RigGalleryItem 
                      key={post.id} 
                      post={post} 
                      showDeleteButton={isOwnProfile} 
                    />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400">
                  No mining rigs uploaded yet
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="stats" className="mt-4">
              <div className="py-8 text-center text-gray-400">
                Mining stats coming soon
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

const ProfileSkeleton = () => (
  <div className="h-full overflow-y-auto bg-dark">
    <div className="relative">
      <Skeleton className="h-32 w-full" />
      
      <div className="px-4 pb-4 relative">
        <div className="flex justify-between items-end -mt-16 mb-4">
          <Skeleton className="w-24 h-24 rounded-full" />
          
          <div className="flex space-x-2">
            <Skeleton className="w-24 h-10 rounded-lg" />
            <Skeleton className="w-10 h-10 rounded-lg" />
          </div>
        </div>
        
        <div className="mb-4">
          <Skeleton className="w-40 h-6 mb-2 rounded" />
          <Skeleton className="w-60 h-4 rounded" />
        </div>
        
        <div className="flex justify-between mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="text-center">
              <Skeleton className="w-12 h-6 mb-1 rounded mx-auto" />
              <Skeleton className="w-16 h-3 rounded mx-auto" />
            </div>
          ))}
        </div>
        
        <Skeleton className="w-full h-24 rounded-lg mb-6" />
        
        <div className="border-b border-dark-lighter mb-4">
          <div className="flex">
            <Skeleton className="w-20 h-10 rounded" />
            <Skeleton className="w-20 h-10 rounded ml-4" />
            <Skeleton className="w-20 h-10 rounded ml-4" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default Profile;
