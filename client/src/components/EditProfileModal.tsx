import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { User } from "@/lib/types";
import { Upload, Image, X } from "lucide-react";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onProfileUpdate: (updatedUser: User) => void;
}

const EditProfileModal = ({ isOpen, onClose, user, onProfileUpdate }: EditProfileModalProps) => {
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [bio, setBio] = useState(user.bio || "");
  const [location, setLocation] = useState(user.location || "");
  const [profileImage, setProfileImage] = useState<string | null>(user.profileImageUrl || null);
  const [bannerImage, setBannerImage] = useState<string | null>(user.bannerImageUrl || null);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string | null>(user.profileImageUrl || null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(user.bannerImageUrl || null);
  const [miningStartYear, setMiningStartYear] = useState<number>(
    user.miningStartYear || new Date().getFullYear()
  );
  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { updateUserProfile } = useAuth();

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      // Check file type
      if (!file.type.match('image/jpeg') && !file.type.match('image/png')) {
        toast({
          title: "Invalid file format",
          description: "Please upload JPG or PNG images only",
          variant: "destructive",
        });
        return;
      }

      // Check file size (max 25MB)
      if (file.size > 25 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 25MB",
          variant: "destructive",
        });
        return;
      }

      setProfileImageFile(file);
      
      // Create a preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      // Check file type
      if (!file.type.match('image/jpeg') && !file.type.match('image/png')) {
        toast({
          title: "Invalid file format",
          description: "Please upload JPG or PNG images only",
          variant: "destructive",
        });
        return;
      }

      // Check file size (max 25MB)
      if (file.size > 25 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 25MB",
          variant: "destructive",
        });
        return;
      }

      setBannerImageFile(file);
      
      // Create a preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveProfileImage = () => {
    setProfilePreviewUrl(null);
    setProfileImageFile(null);
    if (profileFileInputRef.current) {
      profileFileInputRef.current.value = "";
    }
  };

  const handleRemoveBannerImage = () => {
    setBannerPreviewUrl(null);
    setBannerImageFile(null);
    if (bannerFileInputRef.current) {
      bannerFileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    
    try {
      // Create FormData for the API call
      const formData = new FormData();
      
      // Add text fields to the form data
      formData.append('displayName', displayName || user.username);
      formData.append('bio', bio || '');
      formData.append('location', location || '');
      formData.append('miningStartYear', miningStartYear.toString());
      
      // Add profile image file if it exists
      if (profileImageFile) {
        formData.append('profileImage', profileImageFile);
      }
      
      // Add banner image file if it exists
      if (bannerImageFile) {
        formData.append('bannerImage', bannerImageFile);
      }
      
      // For real users, we update using API call
      // The auth hook will handle the PATCH request with FormData
      // The session identifies the user; the id is no longer passed.
      const success = await updateUserProfile(formData);
      
      if (success) {
        toast({
          title: "Profile updated",
          description: "Your profile information has been updated successfully",
        });
        
        // Update UI through callback - this will refresh the profile data
        onProfileUpdate({
          ...user,
          displayName: displayName || user.username,
          bio,
          location,
          miningStartYear,
          profileImageUrl: profileImageFile ? URL.createObjectURL(profileImageFile) : user.profileImageUrl,
          bannerImageUrl: bannerImageFile ? URL.createObjectURL(bannerImageFile) : user.bannerImageUrl
        });
        
        onClose();
      } else {
        throw new Error("Failed to update profile");
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Update failed",
        description: "There was an error updating your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-dark-light text-light border-dark-lighter max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit Profile</DialogTitle>
          <DialogDescription className="text-gray-400">
            Update your profile information and photos
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Banner Image */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Banner Image</h3>
            <div className="relative w-full h-24 overflow-hidden rounded-md bg-dark-lighter flex items-center justify-center">
              {bannerPreviewUrl ? (
                <>
                  <img src={bannerPreviewUrl} alt="Banner preview" className="w-full h-full object-cover" />
                  <button 
                    onClick={handleRemoveBannerImage}
                    className="absolute top-2 right-2 bg-dark-lighter p-1 rounded-full"
                  >
                    <X className="w-4 h-4 text-light" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center text-gray-400">
                  <Image className="w-8 h-8 mb-1" />
                  <span className="text-xs">Banner Image</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center">
              <input
                type="file"
                id="banner-image"
                className="hidden"
                accept="image/jpeg,image/png"
                onChange={handleBannerImageChange}
                ref={bannerFileInputRef}
              />
              <Button 
                variant="outline" 
                className="text-sm border-dark-lighter bg-dark-light"
                onClick={() => bannerFileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose Banner Image
              </Button>
            </div>
          </div>

          {/* Profile Image */}
          <div className="flex flex-col items-center space-y-3">
            <h3 className="text-sm font-medium">Profile Image</h3>
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-dark-lighter flex items-center justify-center">
              {profilePreviewUrl ? (
                <>
                  <img src={profilePreviewUrl} alt="Profile preview" className="w-full h-full object-cover" />
                  <button 
                    onClick={handleRemoveProfileImage}
                    className="absolute top-0 right-0 bg-dark-lighter p-1 rounded-full"
                  >
                    <X className="w-4 h-4 text-light" />
                  </button>
                </>
              ) : (
                <Image className="w-8 h-8 text-gray-400" />
              )}
            </div>
            
            <div className="flex items-center">
              <input
                type="file"
                id="profile-image"
                className="hidden"
                accept="image/jpeg,image/png"
                onChange={handleProfileImageChange}
                ref={profileFileInputRef}
              />
              <Button 
                variant="outline" 
                className="text-sm border-dark-lighter bg-dark-light"
                onClick={() => profileFileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose Profile Image
              </Button>
            </div>
          </div>
          
          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="displayName" className="text-light">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-dark border-dark-lighter text-light"
                placeholder="Your display name"
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="location" className="text-light">Location (30 characters max)</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value.slice(0, 30))}
                className="bg-dark border-dark-lighter text-light"
                placeholder="City, Country"
                maxLength={30}
              />
              <div className="text-xs text-gray-400 flex justify-end">
                {location.length}/30 characters
              </div>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="bio" className="text-light">Bio (160 characters max)</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 160))}
                className="bg-dark border-dark-lighter text-light resize-none"
                rows={3}
                placeholder="Tell others about yourself and your mining experience"
                maxLength={160}
              />
              <div className="text-xs text-gray-400 flex justify-end">
                {bio.length}/160 characters
              </div>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="miningStartYear" className="text-light">Mining Since (Year)</Label>
              <Input
                id="miningStartYear"
                type="number"
                min="2009"
                max={new Date().getFullYear()}
                value={miningStartYear}
                onChange={(e) => setMiningStartYear(parseInt(e.target.value))}
                className="bg-dark border-dark-lighter text-light"
              />
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            className="border-dark-lighter text-light"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            className="bg-primary text-white"
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditProfileModal;