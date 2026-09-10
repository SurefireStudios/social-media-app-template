import { db } from "./db";
import { eq, ne, and, desc, sql, isNull, inArray, or, asc } from "drizzle-orm";
import { users, posts, swipes, follows, comments, reports, ads, messages, notifications, insertMessageSchema } from "@shared/schema";
import { type User, type Post, type Swipe, type Follow, type Comment, type Report, type Ad, type Message, type Notification } from "@shared/schema";
import { type InsertUser, type InsertPost, type InsertSwipe, type InsertFollow, type InsertComment, type InsertReport, type InsertAd, type InsertMessage, type InsertNotification } from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  isUsernameTaken(username: string, excludeUserId?: number): Promise<boolean>;
  isDisplayNameTaken(displayName: string, excludeUserId?: number): Promise<boolean>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
  updateUserPoints(userId: number, points: number): Promise<User | undefined>;
  getUserWithStats(userId: number): Promise<any>;
  getTopUsers(limit?: number): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  
  // Admin methods
  deletePost(id: number): Promise<void>;
  getPendingReports(limit?: number): Promise<any[]>;
  updateReportStatus(id: number, status: string): Promise<void>;
  
  // Post methods
  getPost(id: number): Promise<any | undefined>;
  getPostsForUser(userId: number): Promise<Post[]>;
  createPost(post: InsertPost): Promise<Post>;
  updatePostPoints(postId: number, points: number): Promise<Post | undefined>;
  getPostsNotSwipedByUser(userId: number, limit?: number): Promise<Post[]>;
  
  // Swipe methods
  getSwipe(userId: number, postId: number): Promise<Swipe | undefined>;
  createSwipe(swipe: InsertSwipe): Promise<Swipe>;
  hasUserSwipedToday(userId: number, postId: number): Promise<boolean>;
  
  // Follow methods
  isFollowing(followerId: number, followedId: number): Promise<boolean>;
  createFollow(follow: InsertFollow): Promise<Follow>;
  removeFollow(followerId: number, followedId: number): Promise<void>;
  getFollowerCount(userId: number): Promise<number>;
  getFollowingCount(userId: number): Promise<number>;
  getFollowedUsers(userId: number): Promise<User[]>;
  getFollowers(userId: number): Promise<User[]>;
  
  // Comment methods
  getCommentsForPost(postId: number): Promise<any[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  
  // Report methods
  createReport(report: InsertReport): Promise<Report>;
  
  // Message methods
  getConversations(userId: number): Promise<any[]>;
  getMessagesBetweenUsers(userId1: number, userId2: number): Promise<any[]>;
  saveMessage(message: InsertMessage): Promise<Message>;
  markMessagesAsRead(senderId: number, receiverId: number): Promise<void>;
  getUnreadMessageCount(userId: number): Promise<number>;
  deleteMessagesBetweenUsers(userId1: number, userId2: number): Promise<void>;
  
  // Ad methods
  getAds(location?: string): Promise<Ad[]>;
  getAd(id: number): Promise<Ad | undefined>;
  createAd(ad: InsertAd): Promise<Ad>;
  updateAd(id: number, ad: Partial<Ad>): Promise<Ad | undefined>;
  deleteAd(id: number): Promise<void>;
  
  // Notification methods
  getNotificationsForUser(userId: number): Promise<any[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number, userId: number): Promise<boolean>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
  getUnreadNotificationCount(userId: number): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.username}) = LOWER(${username})`);
    return user;
  }
  
  async isUsernameTaken(username: string, excludeUserId?: number): Promise<boolean> {
    const query = excludeUserId 
      ? db
          .select()
          .from(users)
          .where(and(
            sql`LOWER(${users.username}) = LOWER(${username})`,
            ne(users.id, excludeUserId)
          ))
      : db
          .select()
          .from(users)
          .where(sql`LOWER(${users.username}) = LOWER(${username})`);
          
    const [existingUser] = await query;
    return !!existingUser;
  }
  
  async isDisplayNameTaken(displayName: string, excludeUserId?: number): Promise<boolean> {
    // Case-insensitive check if any user has this display name
    const query = excludeUserId 
      ? db
          .select()
          .from(users)
          .where(and(
            sql`LOWER(${users.displayName}) = LOWER(${displayName})`,
            ne(users.id, excludeUserId)
          ))
      : db
          .select()
          .from(users)
          .where(sql`LOWER(${users.displayName}) = LOWER(${displayName})`);
          
    const [existingUser] = await query;
    return !!existingUser;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    try {
      // Ensure we don't update critical fields like id
      const { id: _, ...updateData } = userData;
      
      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();
      
      return updatedUser;
    } catch (error) {
      console.error("Error updating user:", error);
      return undefined;
    }
  }

  async updateUserPoints(userId: number, points: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ points })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getUserWithStats(userId: number): Promise<any> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) return undefined;
    
    // Get user's posts
    const userPosts = await db.select().from(posts).where(eq(posts.userId, userId));
    
    // Get follower count
    const followerCount = await this.getFollowerCount(userId);
    
    // Get following count
    const followingCount = await this.getFollowingCount(userId);
    
    return {
      ...user,
      posts: userPosts,
      followerCount,
      followingCount
    };
  }

  async getTopUsers(limit: number = 10): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.points)).limit(limit);
  }
  
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.id);
  }
  
  async deletePost(id: number): Promise<void> {
    // First delete any reports on the post to avoid foreign key constraint errors
    await db.delete(reports).where(eq(reports.postId, id));
    
    // Delete any notifications related to the post
    await db.delete(notifications).where(eq(notifications.postId, id));
    
    // Then delete any comments on the post
    await db.delete(comments).where(eq(comments.postId, id));
    
    // Then delete any swipes on the post
    await db.delete(swipes).where(eq(swipes.postId, id));
    
    // Finally delete the post itself
    await db.delete(posts).where(eq(posts.id, id));
  }

  async getPost(id: number): Promise<any | undefined> {
    const [postData] = await db.select().from(posts).where(eq(posts.id, id));
    if (!postData) {
      return undefined;
    }
    // Convert createdAt to timestamp (milliseconds)
    return {
      ...postData,
      createdAt: postData.createdAt.getTime(),
    };
  }

  async getPostsForUser(userId: number): Promise<Post[]> {
    return db.select().from(posts).where(eq(posts.userId, userId));
  }

  async createPost(insertPost: InsertPost): Promise<Post> {
    const [post] = await db.insert(posts).values(insertPost).returning();
    return post;
  }

  async updatePostPoints(postId: number, points: number): Promise<Post | undefined> {
    const [post] = await db
      .update(posts)
      .set({ points })
      .where(eq(posts.id, postId))
      .returning();
    return post;
  }

  async getPostsNotSwipedByUser(userId: number, limit: number = 10): Promise<Post[]> {
    try {
      console.log(`Getting posts not swiped by user ${userId}`);
      
      // First get all posts 
      const allPosts = await db
        .select()
        .from(posts)
        .where(ne(posts.userId, userId))
        .orderBy(sql`RANDOM()`)
        .limit(limit * 2); // Get more than we need, then filter
      
      if (allPosts.length === 0) {
        console.log(`No posts found (excluding user's own posts)`);
        return [];
      }
      
      // Now get all swipes by this user
      const userSwipes = await db
        .select()
        .from(swipes)
        .where(eq(swipes.userId, userId));
      
      // Create a Set of post IDs the user has already swiped on for faster lookup
      const swipedPostIds = new Set(userSwipes.map(swipe => swipe.postId));
      
      console.log(`User ${userId} has swiped on ${swipedPostIds.size} posts`);
      
      // Filter out posts the user has already swiped on
      const unswiped = allPosts.filter(post => !swipedPostIds.has(post.id));
      
      // Limit to requested number
      const result = unswiped.slice(0, limit);
      
      console.log(`Returning ${result.length} unswiped posts`);
      return result;
    } catch (error) {
      console.error('Error in getPostsNotSwipedByUser:', error);
      
      // Fallback to just returning recent posts if there's an error
      return db
        .select()
        .from(posts)
        .where(ne(posts.userId, userId))
        .orderBy(desc(posts.createdAt))
        .limit(limit);
    }
  }

  async getSwipe(userId: number, postId: number): Promise<Swipe | undefined> {
    const [swipe] = await db
      .select()
      .from(swipes)
      .where(and(
        eq(swipes.userId, userId),
        eq(swipes.postId, postId)
      ));
    return swipe;
  }

  async createSwipe(insertSwipe: InsertSwipe): Promise<Swipe> {
    const [swipe] = await db.insert(swipes).values(insertSwipe).returning();
    
    // If it's a right swipe, add a point to the post and user
    if (insertSwipe.direction === 'right') {
      const [post] = await db
        .select()
        .from(posts)
        .where(eq(posts.id, insertSwipe.postId));
      
      if (post) {
        // Incremented in the database rather than read-modify-written, so two
        // swipes landing at once cannot both write the same value and lose one.
        await db
          .update(posts)
          .set({ points: sql`${posts.points} + 1` })
          .where(eq(posts.id, post.id));
        
        // Update user points
        await db
          .update(users)
          .set({ points: sql`${users.points} + 1` })
          .where(eq(users.id, post.userId));
        
        // Create a notification for the post owner (if not swiping on own post)
        if (post.userId !== insertSwipe.userId) {
          try {
            // Get the user who swiped
            const [swipingUser] = await db
              .select()
              .from(users)
              .where(eq(users.id, insertSwipe.userId));
            
            if (swipingUser) {
              // Create notification
              const notificationData = {
                userId: post.userId,
                type: 'like',
                message: `${swipingUser.displayName || swipingUser.username} liked your mining rig!`,
                sourceUserId: swipingUser.id,
                postId: post.id
              };
              await this.createNotification(notificationData);
              
              console.log(`Created notification for post ${post.id} like from user ${swipingUser.id} to user ${post.userId}`);
            }
          } catch (notifError) {
            console.error("Error creating notification for like:", notifError);
            // Continue even if notification creation fails
          }
        }
      }
    }
    
    return swipe;
  }

  async hasUserSwipedToday(userId: number, postId: number): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [swipe] = await db
      .select()
      .from(swipes)
      .where(and(
        eq(swipes.userId, userId),
        eq(swipes.postId, postId),
        sql`DATE(${swipes.date}) = CURRENT_DATE`
      ));
    
    return !!swipe;
  }

  async isFollowing(followerId: number, followedId: number): Promise<boolean> {
    const [follow] = await db
      .select()
      .from(follows)
      .where(and(
        eq(follows.followerId, followerId),
        eq(follows.followedId, followedId)
      ));
    
    return !!follow;
  }

  async createFollow(insertFollow: InsertFollow): Promise<Follow> {
    const [follow] = await db.insert(follows).values(insertFollow).returning();
    
    // Create a notification for the followed user
    try {
      // Get the user who followed
      const [follower] = await db
        .select()
        .from(users)
        .where(eq(users.id, insertFollow.followerId));
      
      if (follower) {
        // Create notification
        const notificationData = {
          userId: insertFollow.followedId,
          type: 'follow',
          message: `${follower.displayName || follower.username} started following you!`,
          sourceUserId: follower.id
        };
        await this.createNotification(notificationData);
        
        console.log(`Created notification for user ${insertFollow.followedId} about new follower ${follower.id}`);
      }
    } catch (notifError) {
      console.error("Error creating notification for follow:", notifError);
      // Continue even if notification creation fails
    }
    
    return follow;
  }

  async removeFollow(followerId: number, followedId: number): Promise<void> {
    await db
      .delete(follows)
      .where(and(
        eq(follows.followerId, followerId),
        eq(follows.followedId, followedId)
      ));
  }

  async getFollowerCount(userId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(follows)
      .where(eq(follows.followedId, userId));
    
    return result[0].count;
  }

  async getFollowingCount(userId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(follows)
      .where(eq(follows.followerId, userId));
    
    return result[0].count;
  }
  
  async getFollowedUsers(userId: number): Promise<User[]> {
    try {
      // First get all follows where this user is the follower
      const followRecords = await db
        .select()
        .from(follows)
        .where(eq(follows.followerId, userId));
      
      if (!followRecords || followRecords.length === 0) {
        return [];
      }
      
      // Extract the IDs of users being followed
      const followedIds = followRecords.map(follow => follow.followedId);
      
      // Get the actual user records for all these IDs
      const followedUsers = await db
        .select()
        .from(users)
        .where(inArray(users.id, followedIds));
      
      return followedUsers;
    } catch (error) {
      console.error("Error getting followed users:", error);
      return [];
    }
  }
  
  async getFollowers(userId: number): Promise<User[]> {
    try {
      // First get all follows where this user is being followed
      const followerRecords = await db
        .select()
        .from(follows)
        .where(eq(follows.followedId, userId));
      
      if (!followerRecords || followerRecords.length === 0) {
        return [];
      }
      
      // Extract the IDs of users who are followers
      const followerIds = followerRecords.map(follow => follow.followerId);
      
      // Get the actual user records for all these IDs
      const followers = await db
        .select()
        .from(users)
        .where(inArray(users.id, followerIds));
      
      return followers;
    } catch (error) {
      console.error("Error getting followers:", error);
      return [];
    }
  }

  async getCommentsForPost(postId: number): Promise<any[]> {
    const commentsList = await db
      .select()
      .from(comments)
      .where(eq(comments.postId, postId))
      .orderBy(desc(comments.createdAt));
      
    // Convert createdAt to timestamp (milliseconds)
    return commentsList.map(comment => ({
      ...comment,
      createdAt: comment.createdAt.getTime(),
    }));
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const [comment] = await db.insert(comments).values(insertComment).returning();
    
    // Create a notification for the post owner (if not commenting on own post)
    try {
      // Get the post
      const [post] = await db
        .select()
        .from(posts)
        .where(eq(posts.id, insertComment.postId));
      
      if (post && post.userId !== insertComment.userId) {
        // Get the user who commented
        const [commenter] = await db
          .select()
          .from(users)
          .where(eq(users.id, insertComment.userId));
        
        if (commenter) {
          // Create notification
          const notificationData = {
            userId: post.userId,
            type: 'comment',
            message: `${commenter.displayName || commenter.username} commented on your mining rig!`,
            sourceUserId: commenter.id,
            postId: post.id
          };
          await this.createNotification(notificationData);
          
          console.log(`Created notification for post ${post.id} comment from user ${commenter.id} to user ${post.userId}`);
        }
      }
    } catch (notifError) {
      console.error("Error creating notification for comment:", notifError);
      // Continue even if notification creation fails
    }
    
    return comment;
  }

  // Report methods
  async getPendingReports(limit: number = 20): Promise<any[]> {
    // Get pending reports
    const reportsList = await db
      .select()
      .from(reports)
      .where(eq(reports.status, 'pending'))
      .orderBy(desc(reports.createdAt))
      .limit(limit);
    
    // Create enhanced reports with related information
    const enhancedReports = [];
    
    for (const report of reportsList) {
      // Get post data
      const post = await this.getPost(report.postId);
      
      // Get reporter and post owner info
      const reporter = post ? await this.getUser(report.reporterId) : null;
      const postOwner = post ? await this.getUser(post.userId) : null;
      
      enhancedReports.push({
        ...report,
        post,
        reporter,
        postOwner
      });
    }
    
    return enhancedReports;
  }

  async updateReportStatus(id: number, status: string): Promise<void> {
    await db
      .update(reports)
      .set({ status })
      .where(eq(reports.id, id));
  }

  async createReport(insertReport: InsertReport): Promise<Report> {
    const [report] = await db.insert(reports).values(insertReport).returning();
    return report;
  }

  // Ad methods
  async getAds(location?: string): Promise<Ad[]> {
    try {
      let results;
      if (location) {
        // If location is specified, get ads for that location or any that start with that location
        // This way location=leaderboard will match leaderboard_slot1, leaderboard_slot2, etc.
        results = await db.select().from(ads).where(
          or(
            eq(ads.location, location),
            sql`${ads.location} LIKE ${location + '_%'}`
          )
        );
      } else {
        // Get all ads (for admin dashboard) without filtering by active status
        results = await db.select().from(ads);
      }
      
      return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error in getAds:', error);
      return [];
    }
  }
  
  async getAd(id: number): Promise<Ad | undefined> {
    const [ad] = await db.select().from(ads).where(eq(ads.id, id));
    return ad;
  }
  
  async createAd(insertAd: InsertAd): Promise<Ad> {
    const [ad] = await db.insert(ads).values(insertAd).returning();
    return ad;
  }
  
  async updateAd(id: number, adData: Partial<Ad>): Promise<Ad | undefined> {
    try {
      // Ensure we don't update critical fields like id
      const { id: _, ...updateData } = adData;
      
      const [updatedAd] = await db
        .update(ads)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(ads.id, id))
        .returning();
      
      return updatedAd;
    } catch (error) {
      console.error("Error updating ad:", error);
      return undefined;
    }
  }
  
  async deleteAd(id: number): Promise<void> {
    await db.delete(ads).where(eq(ads.id, id));
  }

  // Message methods
  async getConversations(userId: number): Promise<any[]> {
    try {
      // First, get all unique users this user has had conversations with
      const sentMessages = await db
        .select({ otherUserId: messages.receiverId })
        .from(messages)
        .where(eq(messages.senderId, userId))
        .groupBy(messages.receiverId);
      
      const receivedMessages = await db
        .select({ otherUserId: messages.senderId })
        .from(messages)
        .where(eq(messages.receiverId, userId))
        .groupBy(messages.senderId);
      
      // Combine and deduplicate
      const conversationUserIds = [
        ...sentMessages.map(m => m.otherUserId),
        ...receivedMessages.map(m => m.otherUserId)
      ].filter((userId, index, self) => self.indexOf(userId) === index);
      
      if (conversationUserIds.length === 0) {
        return [];
      }
      
      // Get user details for each conversation
      const conversationUsers = await db
        .select()
        .from(users)
        .where(inArray(users.id, conversationUserIds));
      
      // For each user, get the latest message
      const conversations = [];
      
      for (const user of conversationUsers) {
        // Get latest message between these users
        const [latestMessage] = await db
          .select()
          .from(messages)
          .where(
            or(
              and(
                eq(messages.senderId, userId),
                eq(messages.receiverId, user.id)
              ),
              and(
                eq(messages.senderId, user.id),
                eq(messages.receiverId, userId)
              )
            )
          )
          .orderBy(desc(messages.createdAt))
          .limit(1);
        
        if (latestMessage) {
          // Count unread messages from this user
          const unreadCount = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(messages)
            .where(
              and(
                eq(messages.senderId, user.id),
                eq(messages.receiverId, userId),
                eq(messages.read, false)
              )
            );
          
          conversations.push({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            profileImage: user.profileImageUrl,
            lastMessage: latestMessage.content,
            timestamp: latestMessage.createdAt.getTime(),
            unread: unreadCount[0].count > 0,
            isVerified: user.isVerified
          });
        }
      }
      
      // Sort by latest message timestamp
      return conversations.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      console.error("Error getting conversations:", error);
      return [];
    }
  }
  
  async getMessagesBetweenUsers(userId1: number, userId2: number): Promise<any[]> {
    try {
      const messagesList = await db
        .select()
        .from(messages)
        .where(
          or(
            and(
              eq(messages.senderId, userId1),
              eq(messages.receiverId, userId2)
            ),
            and(
              eq(messages.senderId, userId2),
              eq(messages.receiverId, userId1)
            )
          )
        )
        .orderBy(asc(messages.createdAt));
      
      // Mark messages from userId2 as read
      await db
        .update(messages)
        .set({ read: true })
        .where(
          and(
            eq(messages.senderId, userId2),
            eq(messages.receiverId, userId1),
            eq(messages.read, false)
          )
        );
      
      // Convert Date object to Unix timestamp (milliseconds) - Drizzle handles timestamptz correctly
      const messagesWithTimestamps = messagesList.map(msg => ({
        ...msg,
        createdAt: msg.createdAt.getTime(), // Use standard getTime()
      }));
      
      return messagesWithTimestamps;
    } catch (error) {
      console.error("Error getting messages between users:", error);
      return [];
    }
  }
  
  async saveMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }
  
  async markMessagesAsRead(senderId: number, receiverId: number): Promise<void> {
    await db
      .update(messages)
      .set({ read: true })
      .where(
        and(
          eq(messages.senderId, senderId),
          eq(messages.receiverId, receiverId),
          eq(messages.read, false)
        )
      );
  }
  
  async getUnreadMessageCount(userId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.receiverId, userId),
          eq(messages.read, false)
        )
      );
    
    return result[0].count;
  }
  
  async deleteMessagesBetweenUsers(userId1: number, userId2: number): Promise<void> {
    // Delete messages where userId1 is the sender and userId2 is the receiver
    await db
      .delete(messages)
      .where(
        and(
          eq(messages.senderId, userId1),
          eq(messages.receiverId, userId2)
        )
      );
    
    // Delete messages where userId2 is the sender and userId1 is the receiver
    await db
      .delete(messages)
      .where(
        and(
          eq(messages.senderId, userId2),
          eq(messages.receiverId, userId1)
        )
      );
  }
  
  // Notification methods
  async getNotificationsForUser(userId: number): Promise<any[]> {
    const notificationsList = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
      
    // Convert createdAt to timestamp (milliseconds)
    return notificationsList.map(notif => ({
      ...notif,
      createdAt: notif.createdAt.getTime(),
    }));
  }
  
  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(insertNotification).returning();
    return notification;
  }
  
  /**
   * Marks one notification read, but only if it belongs to `userId`.
   *
   * The ownership test is part of the UPDATE rather than a separate SELECT, so
   * there is no window between checking and writing. Returns false when the
   * notification does not exist or belongs to someone else — the route cannot
   * tell those apart, which is the point.
   */
  async markNotificationAsRead(id: number, userId: number): Promise<boolean> {
    const updated = await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning({ id: notifications.id });
    return updated.length > 0;
  }
  
  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));
  }
  
  async getUnreadNotificationCount(userId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.read, false)
        )
      );
    
    return result[0].count;
  }
}

export const storage = new DatabaseStorage();