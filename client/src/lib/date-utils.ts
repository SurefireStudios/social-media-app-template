/**
 * Date and time utility functions for the application
 */

/**
 * Get current UTC timestamp in milliseconds
 * @returns {number} Unix epoch timestamp (milliseconds since January 1, 1970)
 */
export const getCurrentTimestamp = (): number => {
  return Date.now();
};

/**
 * Format a timestamp for display in the UI
 * @param {number | Date} timestamp - Unix epoch timestamp in milliseconds or Date object
 * @param {object} options - Formatting options
 * @returns {string} Formatted time string
 */
export const formatTime = (
  timestamp: number | Date, // Reverted type
  options: Intl.DateTimeFormatOptions = { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  }
): string => {
  // Create date object directly from timestamp
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleTimeString([], options);
};

/**
 * Format a timestamp as a date for display in the UI
 * @param {number | Date} timestamp - Unix epoch timestamp in milliseconds or Date object
 * @returns {string} Formatted date string
 */
export const formatDate = (timestamp: number | Date): string => { // Reverted type
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleDateString([], { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

/**
 * Format a timestamp as a full date and time for display in the UI
 * @param {number | Date} timestamp - Unix epoch timestamp in milliseconds or Date object
 * @returns {string} Formatted date and time string
 */
export const formatDateTime = (timestamp: number | Date): string => { // Reverted type
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleString([], { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Format a timestamp as a relative time string (e.g., "2 hours ago")
 * Simplified now that server sends numeric timestamps
 * 
 * @param {number | Date} timestamp - Unix epoch timestamp in milliseconds or Date object
 * @returns {string} Relative time string
 */
export const timeAgo = (timestamp: number | Date): string => { // Reverted type
  const time = timestamp instanceof Date ? timestamp.getTime() : timestamp;
  const now = Date.now();
  const diff = Math.floor((now - time) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1
  };
  
  if (diff <= 0) {
    return 'just now';
  }
  
  if (diff < intervals.minute) {
    return 'just now';
  } else if (diff < intervals.hour) {
    const minutes = Math.floor(diff / intervals.minute);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diff < intervals.day) {
    const hours = Math.floor(diff / intervals.hour);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diff < intervals.week) {
    const days = Math.floor(diff / intervals.day);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  } else if (diff < intervals.month) {
    const weeks = Math.floor(diff / intervals.week);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  } else if (diff < intervals.year) {
    const months = Math.floor(diff / intervals.month);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  } else {
    const years = Math.floor(diff / intervals.year);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  }
}; 