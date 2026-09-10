import { API_BASE_URL } from "@/config";

/**
 * Helper function to get the full API URL
 * Prepends the API base URL to paths that start with "/api/"
 */
export function getApiUrl(path: string): string {
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