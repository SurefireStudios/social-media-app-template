// API configuration
//
// Defaults to same-origin, which is what a single-service deployment wants —
// the Express server serves both this bundle and /api. This was once hardcoded
// to one production API host, so every other deployment called that host
// instead of its own backend. Set VITE_API_BASE_URL at build time to point
// somewhere else.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

// Helper function to get full API URL
export function getFullApiUrl(path: string): string {
  // Make sure path starts with a slash if not already
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // If path already has the base URL, return as is
  if (path.startsWith(API_BASE_URL)) {
    return path;
  }
  
  // If path starts with /api, add the base URL
  if (normalizedPath.startsWith('/api')) {
    return `${API_BASE_URL}${normalizedPath}`;
  }
  
  // Otherwise return the path as is
  return path;
} 
