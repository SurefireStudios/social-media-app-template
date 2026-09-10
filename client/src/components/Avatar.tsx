import { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fallbackText?: string;
}

const Avatar = ({ 
  src, 
  alt = 'Avatar', 
  className = '', 
  size = 'md',
  fallbackText 
}: AvatarProps) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  // Show fallback if no src, image failed to load, or still loading
  const showFallback = !src || imageError || !imageLoaded;

  return (
    <div className={`${sizeClasses[size]} ${className} relative overflow-hidden rounded-full bg-dark-lighter flex items-center justify-center`}>
      {src && !imageError && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      )}
      
      {showFallback && (
        <div className="absolute inset-0 flex items-center justify-center">
          {fallbackText ? (
            <span className="text-gray-400 font-medium text-sm">
              {fallbackText.charAt(0).toUpperCase()}
            </span>
          ) : (
            <svg 
              className="w-1/2 h-1/2 text-gray-400" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          )}
        </div>
      )}
    </div>
  );
};

export default Avatar; 