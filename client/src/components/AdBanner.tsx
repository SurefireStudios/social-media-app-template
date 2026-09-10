import React, { useEffect, useRef, useState } from 'react';
import { Ad } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

interface AdBannerProps {
  location: string; // sidebar, header, footer, leaderboard, auth
  slot?: number; // Specific slot number (1, 2, 3, etc.)
  width?: number;
  height?: number;
  className?: string;
  imageUrl?: string; // For direct image injection (bypass DB)
  linkUrl?: string; // For direct link injection (bypass DB)
}

const AdBanner: React.FC<AdBannerProps> = ({ 
  location, 
  slot,
  width: propWidth, 
  height: propHeight, 
  className,
  imageUrl: propImageUrl,
  linkUrl: propLinkUrl
}) => {
  const adContainerRef = useRef<HTMLDivElement>(null);
  const [ad, setAd] = useState<Ad | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use props as fallback values
  const imageUrl = ad?.imageUrl || propImageUrl;
  const linkUrl = ad?.linkUrl || propLinkUrl;
  // Use provided width/height from props or default to 320x100
  const width = propWidth || 320;
  const height = propHeight || 100;

  // Fetch ad for the specified location and slot
  useEffect(() => {
    // If direct props are provided, don't fetch from server
    if (propImageUrl && propLinkUrl) {
      setIsLoading(false);
      return;
    }
    
    const fetchAd = async () => {
      try {
        setIsLoading(true);
        // Construct the query URL based on location and possibly slot
        let queryUrl = `/api/ads?location=${location}`;
        if (slot !== undefined) {
          queryUrl += `&slot=${slot}`;
        }
        
        const response = await apiRequest('GET', queryUrl);
        const ads = await response.json() as Ad[];
        
        if (ads && ads.length > 0) {
          // Filter active ads
          const activeAds = ads.filter(ad => ad.active);
          
          if (activeAds.length > 0) {
            // If a slot is specified, try to find an ad for that slot
            if (slot !== undefined) {
              // Find an ad that matches both location and slot
              const slotAd = activeAds.find(ad => ad.location === `${location}_slot${slot}`);
              if (slotAd) {
                setAd(slotAd);
              } else {
                // Fallback to any ad in that location
                const randomIndex = Math.floor(Math.random() * activeAds.length);
                setAd(activeAds[randomIndex]);
              }
            } else {
              // No slot specified, use random ad
              const randomIndex = Math.floor(Math.random() * activeAds.length);
              setAd(activeAds[randomIndex]);
            }
          }
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching ad:', error);
        setError('Failed to load advertisement');
        setIsLoading(false);
      }
    };

    fetchAd();
  }, [location, slot, propImageUrl, propLinkUrl]);

  // Render the ad content
  useEffect(() => {
    if (adContainerRef.current) {
      adContainerRef.current.innerHTML = '';
      
      if (imageUrl && linkUrl) {
        // If we have an image and link (either from props or fetched ad)
        const link = document.createElement('a');
        link.href = linkUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        
        const image = document.createElement('img');
        
        // Fix the image path if it starts with /assets/
        let imgSrc = imageUrl;
        if (imgSrc && imgSrc.startsWith('/assets/')) {
          const fileName = imgSrc.split('/').pop(); // Get the filename
          imgSrc = `/assets/${fileName}`;
        }
        
        image.src = imgSrc;
        image.alt = ad?.name || 'Advertisement';
        image.style.width = '100%';
        image.style.height = 'auto';
        image.style.objectFit = 'cover';
        image.style.display = 'block';
        
        link.appendChild(image);
        adContainerRef.current.appendChild(link);
      } else if (!isLoading && !error) {
        // Only show placeholder if not loading and no error
        // and we don't have image/link
        const placeholder = document.createElement('div');
        placeholder.style.width = '100%';
        placeholder.style.height = '100%';
        placeholder.style.backgroundColor = '#f0f0f0';
        placeholder.style.display = 'flex';
        placeholder.style.alignItems = 'center';
        placeholder.style.justifyContent = 'center';
        placeholder.style.color = '#666';
        placeholder.style.fontSize = '12px';
        placeholder.style.border = '1px dashed #ccc';
        placeholder.innerText = `Ad Space (${width}×${height})`;
        adContainerRef.current.appendChild(placeholder);
      }
    }
  }, [ad, isLoading, error, imageUrl, linkUrl, width, height]);

  return (
    <div 
      ref={adContainerRef}
      id={`ad-container-${location}${slot !== undefined ? `-slot${slot}` : ''}`}
      className={className}
      style={{ 
        width: `${width}px`, 
        height: `${height}px`
      }}
      aria-label={`Advertisement${slot !== undefined ? ` - Slot ${slot}` : ''}`}
    />
  );
};

export default AdBanner;