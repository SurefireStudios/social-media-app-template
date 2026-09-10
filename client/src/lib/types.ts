// This file contains shared types for the client application

export interface User {
  id: number;
  username: string;
  email: string;
  displayName?: string;
  bio?: string;
  location?: string;
  profileImageUrl?: string;
  bannerImageUrl?: string;
  points: number;
  createdAt: string | Date;
  miningStartYear?: number;
  isAdmin?: boolean;
  isVerified?: boolean;
  isBanned?: boolean;
  isFollowing?: boolean;
}

/**
 * What `GET /api/users/:id` returns. `storage.getUserWithStats` spreads the user
 * row and adds the posts and both follow counts; the route adds `isFollowing`
 * when the request carries a viewer id. The profile page asked for this as a
 * plain `User`, so every one of those extra fields was a type error.
 */
export interface UserWithStats extends User {
  posts: Post[];
  followerCount: number;
  followingCount: number;
}

export interface Post {
  id: number;
  userId: number;
  imageUrl: string;
  minerModel: string;
  algorithm?: string;
  hashrate?: string;
  power?: string;
  temperature?: string;
  efficiency?: string;
  modifications?: string;
  points: number;
  createdAt: string | Date;
  isFollowing?: boolean;
}

export interface Swipe {
  id: number;
  userId: number;
  postId: number;
  direction: 'left' | 'right';
  date: string | Date;
}

export interface Comment {
  id: number;
  postId: number;
  userId: number;
  content: string;
  createdAt: string | Date;
}

export interface Follow {
  id: number;
  followerId: number;
  followedId: number;
  createdAt: string | Date;
}
