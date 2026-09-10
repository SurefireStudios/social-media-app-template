import { useLocation } from "wouter";
import { Post } from "@/lib/types";
import { Zap, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface RigGalleryItemProps {
  post: Post;
  showDeleteButton?: boolean;
}

const RigGalleryItem = ({ post, showDeleteButton = false }: RigGalleryItemProps) => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/posts/${post.id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Your post has been deleted",
      });
      // Refresh the user's posts
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/posts`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete the post. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleClick = () => {
    // Navigate to post detail view
    setLocation(`/post/${post.id}`);
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation to post detail
    
    // Handle delete using the API
    deleteMutation.mutate();
  };

  return (
    <div 
      className="aspect-square rounded-lg overflow-hidden relative cursor-pointer"
      onClick={handleClick}
    >
      <img 
        src={post.imageUrl} 
        alt={`Mining rig: ${post.minerModel}`}
        className="w-full h-full object-cover"
      />
      
      {showDeleteButton && user && post.userId === user.id && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button 
              className="absolute top-2 right-2 p-1.5 bg-red-600 bg-opacity-80 rounded-full hover:bg-opacity-100 transition-all"
              onClick={(e) => e.stopPropagation()} // Prevent navigation to post detail
            >
              <Trash2 className="h-4 w-4 text-white" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-dark-light border-dark-lighter">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-light">Delete Mining Rig</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                Are you sure you want to delete this mining rig? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                className="bg-dark-lighter text-gray-300 hover:text-white hover:bg-dark-light"
                onClick={(e) => e.stopPropagation()} // Prevent navigation
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-dark to-transparent p-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-white font-medium">{post.minerModel}</span>
          <span className="text-xs text-primary flex items-center">
            <Zap className="h-3 w-3 mr-1" />
            {post.points}
          </span>
        </div>
      </div>
    </div>
  );
};

export default RigGalleryItem;
