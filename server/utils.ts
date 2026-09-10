// Simple profanity filter for usernames
const PROFANITY_LIST = [
  'shit', 'fuck', 'ass', 'bitch', 'cunt', 'damn', 'dick', 'bastard',
  'asshole', 'twat', 'cock', 'pussy', 'whore', 'slut', 'nazi', 'hitler',
  'racist', 'nigger', 'faggot', 'retard', 'piss', 'cum', 'porn', 'sex'
];

export function containsProfanity(text: string): boolean {
  if (!text) return false;
  
  const lowerText = text.toLowerCase();
  
  // Check for exact matches or if any profane word is contained within the text
  return PROFANITY_LIST.some(word => 
    lowerText === word || 
    lowerText.includes(word) ||
    // Also check for common letter replacements (e.g., @ for a, 1 for i)
    lowerText.replace(/[^a-zA-Z0-9]/g, '').includes(word)
  );
}

// Function to check if a username is valid
export function isValidUsername(username: string): boolean {
  if (!username) return false;
  
  // Check if username is too short or too long
  if (username.length < 3 || username.length > 20) return false;
  
  // Check if username contains only allowed characters
  // Allow letters, numbers, underscores, and periods (no spaces)
  if (!/^[a-zA-Z0-9._]+$/.test(username)) return false;
  
  // Check for consecutive special characters (periods or underscores)
  if (/[._]{2,}/.test(username)) return false;
  
  // Check if username contains profanity
  if (containsProfanity(username)) return false;
  
  return true;
}

/**
 * A display name is a human name, not a handle — spaces are allowed, and so are
 * hyphens and apostrophes. Usernames stay strict; see isValidUsername.
 *
 * This previously used the username rules, which forbade spaces and capped the
 * length at 20. That rejected names the app itself creates, "Hash Father" among
 * them, so registration was stricter than the data it had to coexist with.
 */
export function isValidDisplayName(displayName: string): boolean {
  if (!displayName) return false;
  
  const trimmed = displayName.trim();
  
  // Reject padding rather than silently accepting it.
  if (trimmed !== displayName) return false;
  
  if (trimmed.length < 1 || trimmed.length > 30) return false;
  
  // Letters, numbers, spaces, and the punctuation that turns up in real names.
  if (!/^[a-zA-Z0-9 ._'-]+$/.test(trimmed)) return false;
  
  // No runs of whitespace.
  if (/\s{2,}/.test(trimmed)) return false;
  
  // Check for consecutive special characters (periods or underscores)
  if (/[._]{2,}/.test(displayName)) return false;
  
  // Check if display name contains profanity
  if (containsProfanity(displayName)) return false;
  
  return true;
}

// Function to check if a display name is already taken (case-insensitive)
export async function isDisplayNameTaken(
  // Only the one method is needed, so ask for that rather than `any` — which
  // made `user` below implicitly any and switched off checking inside the loop.
  storage: { getAllUsers(): Promise<{ id: number; displayName: string | null }[]> },
  displayName: string, 
  excludeUserId?: number
): Promise<boolean> {
  try {
    // Convert to lowercase for case-insensitive comparison
    const lowerDisplayName = displayName.toLowerCase();
    
    // Get all users
    const allUsers = await storage.getAllUsers();
    
    // Check if any user has the same display name (case-insensitive)
    return allUsers.some(user => 
      user.displayName?.toLowerCase() === lowerDisplayName && 
      (!excludeUserId || user.id !== excludeUserId)
    );
  } catch (error) {
    console.error("Error checking if display name is taken:", error);
    return false;
  }
}