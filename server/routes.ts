import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import {
  requireAuth,
  requireAdmin,
  requireSelf,
  optionalUserId,
  hashPassword,
  verifyPassword,
  toPublicUser,
  type AuthedRequest,
} from "./auth";
import { db } from "./db";
import { eq } from "drizzle-orm";
import {
  insertUserSchema,
  insertPostSchema,
  insertSwipeSchema,
  insertFollowSchema,
  insertCommentSchema,
  insertReportSchema,
  insertAdSchema,
  insertMessageSchema,
  insertNotificationSchema,
  reports as dbReports,
  ads as dbAds,
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";

const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.resolve(process.cwd(), "dist", "public", "uploads");
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and GIF are allowed."));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // health check endpoint
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ message: "OK" });
  });
  
  // Add a test endpoint for CORS verification
  // Serve uploaded images from the uploads directory
  const uploadsDir = path.resolve(process.cwd(), "dist", "public", "uploads");
  // Create directory if it doesn't exist
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  // Add middleware to check if files exist before serving
  app.use("/uploads", (req: Request, res: Response, next: NextFunction) => {
    const filePath = path.join(uploadsDir, req.path);
    
    // Check if file exists
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      next(); // File exists, continue to static file serving
    } else {
      // File doesn't exist, return 404
      res.status(404).json({ 
        message: "Image not found",
        path: req.path 
      });
    }
  });
  
  app.use("/uploads", express.static(uploadsDir));

  // Admin routes use requireAdmin from ./auth, which resolves the user from the
  // session. The middleware this replaced read `adminId` out of the query string
  // and looked it up - a real check, but on a self-asserted identity, so naming
  // any admin's id was enough to satisfy it.
  
  // Admin data reset endpoint for clearing all posts before launch
  app.post("/api/admin/reset-app-data", requireAdmin, async (req: Request, res: Response) => {
    try {
      console.log(`Admin ${(req as AuthedRequest).userId} requested app data reset`);
      
      // Import the DB and schema
      const { db } = await import("./db");
      const { 
        posts, 
        swipes, 
        comments, 
        reports, 
        notifications,
        follows
      } = await import("@shared/schema");
      
      // Start with deleting all swipes (have FK dependencies)
      console.log("Deleting all swipes...");
      await db.delete(swipes);
      
      // Delete all comments
      console.log("Deleting all comments...");
      await db.delete(comments);
      
      // Delete all reports related to posts
      console.log("Deleting all content reports...");
      await db.delete(reports);
      
      // Delete all follows
      console.log("Deleting all follows...");
      await db.delete(follows);
      
      // Delete all notifications
      console.log("Deleting all notifications...");
      await db.delete(notifications);
      
      // Finally delete all posts
      console.log("Deleting all posts...");
      await db.delete(posts);
      
      // Reset user points to 0 except for admins
      console.log("Resetting all user points...");
      const { users } = await import("@shared/schema");
      const { eq, ne } = await import("drizzle-orm");
      await db.update(users)
        .set({ points: 0 })
        .where(ne(users.isAdmin, true));
      
      // Attempt to delete uploaded files from the filesystem
      try {
        console.log("Cleaning up uploaded files...");
        const uploadsDir = path.resolve(process.cwd(), "dist", "public", "uploads");
        if (fs.existsSync(uploadsDir)) {
          const files = fs.readdirSync(uploadsDir);
          for (const file of files) {
            if (file !== '.gitkeep') { // Keep the .gitkeep file
              fs.unlinkSync(`${uploadsDir}/${file}`);
              console.log(`Deleted file: ${file}`);
            }
          }
        }
      } catch (err) {
        console.error("Error cleaning up uploads directory:", err);
        // Continue despite file cleanup errors
      }
      
      console.log("App data reset complete");
      res.status(200).json({ 
        message: "App data reset complete", 
        details: "All posts, swipes, comments, follows, reports, and notifications have been deleted. User points reset to 0." 
      });
    } catch (error) {
      console.error("Error resetting app data:", error);
      res.status(500).json({ message: "Error resetting app data" });
    }
  });
  
  // Admin Routes
  app.get("/api/admin/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Error fetching users" });
    }
  });
  
  app.patch("/api/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Validate the user ID
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Only allow updating admin-specific fields
      const allowedFields = ['isVerified', 'isBanned'];
      const updates: any = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }
      
      // Update the user
      const updatedUser = await storage.updateUser(userId, updates);
      if (!updatedUser) {
        return res.status(500).json({ message: "Error updating user" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Error updating user" });
    }
  });
  
  // Make a user an admin (super admin only)
  app.patch("/api/admin/promote/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const adminId = (req as AuthedRequest).userId;
      
      // Validate the user ID
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Check if the current admin is user #1 (super admin)
      const admin = await storage.getUser(adminId);
      if (admin?.id !== 1) {
        return res.status(403).json({ message: "Only super admin can promote users to admin" });
      }
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update the user to be an admin
      const updatedUser = await storage.updateUser(userId, { isAdmin: true });
      if (!updatedUser) {
        return res.status(500).json({ message: "Error promoting user to admin" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error promoting user to admin:", error);
      res.status(500).json({ message: "Error promoting user to admin" });
    }
  });
  
  app.delete("/api/admin/posts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const postId = parseInt(req.params.id);
      
      // Validate the post ID
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      // Check if post exists
      const post = await storage.getPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      // Delete the post
      await storage.deletePost(postId);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ message: "Error deleting post" });
    }
  });
  
  // Endpoint for users to delete their own posts
  app.delete("/api/posts/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const postId = parseInt(req.params.id);
      
      const currentUserId = (req as AuthedRequest).userId;
      
      // Validate the post ID
      if (isNaN(postId)) {
        console.log("Delete failed: Invalid post ID");
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      // Validate the user ID
      if (isNaN(currentUserId) || !currentUserId) {
        console.log(`Delete failed: Invalid user ID - isNaN=${isNaN(currentUserId)}, value=${currentUserId}`);
        return res.status(400).json({ message: "Invalid user ID - user must be logged in" });
      }
      
      // Check if post exists
      const post = await storage.getPost(postId);
      if (!post) {
        console.log(`Delete failed: Post ${postId} not found`);
        return res.status(404).json({ message: "Post not found" });
      }
      
      console.log(`Post found: postId=${post.id}, postUserId=${post.userId}, requestUserId=${currentUserId}`);
      
      // Make sure the post belongs to the current user
      if (post.userId !== currentUserId) {
        console.log(`Delete failed: User ${currentUserId} trying to delete post ${postId} owned by user ${post.userId}`);
        return res.status(403).json({ message: "You can only delete your own posts" });
      }
      
      console.log(`Attempting to delete post ${postId} for user ${currentUserId}`);
      
      // Delete the post
      await storage.deletePost(postId);
      
      console.log(`Successfully deleted post ${postId}`);
      res.status(200).json({ message: "Post deleted successfully" });
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ message: "Error deleting post", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });
  
  // User Routes
  app.get("/api/users/:id", async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    try {
      // Get user with their stats
      const userWithStats = await storage.getUserWithStats(userId);
      if (!userWithStats) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const currentUserId = optionalUserId(req);
      
      // If a user is logged in, check if they are following the requested user
      if (currentUserId && currentUserId !== userId) {
        const isFollowing = await storage.isFollowing(currentUserId, userId);
        // Add isFollowing field to the response
        res.json({
          ...userWithStats,
          isFollowing
        });
      } else {
        // No user logged in or viewing own profile, just return the user data
        res.json(userWithStats);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Error fetching user" });
    }
  });
  
  // Add PATCH endpoint to update user profile
  // requireSelf, not requireAuth: this route took the id from the URL and
  // edited whoever it named, so any signed-in account could rewrite anyone
  // else's profile.
  app.patch("/api/users/:id", requireSelf("id"), upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'bannerImage', maxCount: 1 }
  ]), async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    try {
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Import the validation functions (once at the top for both username and display name)
      const { isValidUsername, isValidDisplayName, containsProfanity } = await import('./utils');
      
      // If the username is being updated, validate it
      if (req.body.username) {
        // Check if username contains profanity
        if (containsProfanity(req.body.username)) {
          return res.status(400).json({ 
            message: "Username contains inappropriate language", 
            field: "username" 
          });
        }
        
        // Check if username is valid format
        if (!isValidUsername(req.body.username)) {
          return res.status(400).json({ 
            message: "Username must be 3-20 characters and contain only letters, numbers, underscore, period, or hyphen", 
            field: "username" 
          });
        }
        
        // Check if username is already taken (case-insensitive, excluding current user)
        const usernameTaken = await storage.isUsernameTaken(req.body.username, userId);
        if (usernameTaken) {
          return res.status(400).json({ 
            message: "Username is already taken", 
            field: "username" 
          });
        }
      }
      
      // If the display name is being updated, validate it
      if (req.body.displayName) {
        // Check if display name contains profanity
        if (containsProfanity(req.body.displayName)) {
          return res.status(400).json({ 
            message: "Display name contains inappropriate language", 
            field: "displayName" 
          });
        }
        
        // Check if display name is valid format
        if (!isValidDisplayName(req.body.displayName)) {
          return res.status(400).json({ 
            message: "Display name must be 3-20 characters and contain only letters, numbers, underscores, and periods", 
            field: "displayName" 
          });
        }
        
        // Check if display name is already taken (case-insensitive, excluding current user)
        const displayNameTaken = await storage.isDisplayNameTaken(req.body.displayName, userId);
        if (displayNameTaken) {
          return res.status(400).json({ 
            message: "Display name is already taken", 
            field: "displayName" 
          });
        }
      }
      
      // Handle profile image upload
      // Create an object to store the actual update values
      const userData: Record<string, any> = {};
      
      // For FormData submissions, we need to extract the fields we want
      if (req.body.displayName) userData.displayName = req.body.displayName;
      if (req.body.bio) userData.bio = req.body.bio;
      if (req.body.location) userData.location = req.body.location;
      if (req.body.miningStartYear) userData.miningStartYear = parseInt(req.body.miningStartYear);
      
      // Handle uploaded files (type assertion for multer)
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      // If a new profile image was uploaded, add the URL to userData
      if (files && files.profileImage && files.profileImage[0]) {
        userData.profileImageUrl = `/uploads/${files.profileImage[0].filename}`;
      }
      
      // If a new banner image was uploaded, add the URL to userData
      if (files && files.bannerImage && files.bannerImage[0]) {
        userData.bannerImageUrl = `/uploads/${files.bannerImage[0].filename}`;
      }
      
      // Only proceed if there's something to update
      if (Object.keys(userData).length === 0) {
        return res.status(400).json({ message: "No valid update data provided" });
      }
      
      // Update the user
      const updatedUser = await storage.updateUser(userId, userData);
      if (!updatedUser) {
        return res.status(500).json({ message: "Error updating user" });
      }
      
      // Get the updated user with stats to return
      const userWithStats = await storage.getUserWithStats(userId);
      
      res.json(userWithStats);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Error updating user profile", error: String(error) });
    }
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, username, password, displayName } = req.body ?? {};

      if (typeof email !== "string" || typeof username !== "string" || typeof password !== "string") {
        return res.status(400).json({ message: "email, username and password are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters", field: "password" });
      }

      const { isValidUsername, isValidDisplayName, containsProfanity } = await import("./utils");

      if (containsProfanity(username)) {
        return res.status(400).json({ message: "Username contains inappropriate language", field: "username" });
      }

      if (!isValidUsername(username)) {
        return res.status(400).json({
          message: "Username must be 3-20 characters and contain only letters, numbers, underscore, period, or hyphen",
          field: "username",
        });
      }

      if (displayName) {
        if (containsProfanity(displayName)) {
          return res.status(400).json({ message: "Display name contains inappropriate language", field: "displayName" });
        }
        if (!isValidDisplayName(displayName)) {
          return res.status(400).json({ message: "Display name must be 1-30 characters", field: "displayName" });
        }
      }

      if (await storage.getUserByEmail(email.toLowerCase())) {
        return res.status(409).json({ message: "An account with this email already exists", field: "email" });
      }

      if (await storage.isUsernameTaken(username)) {
        return res.status(409).json({ message: "Username is already taken", field: "username" });
      }

      const user = await storage.createUser({
        email: email.toLowerCase(),
        username,
        displayName: displayName || username,
        passwordHash: await hashPassword(password),
      });

      // Sign them straight in, so registering does not need a second round trip.
      req.session.userId = user.id;
      res.status(201).json(toPublicUser(user));
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Error creating account" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body ?? {};

      if (typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({ message: "email and password are required" });
      }

      const user = await storage.getUserByEmail(email.toLowerCase());

      // One message and one code for "no such account" and "wrong password", so
      // the endpoint does not confirm which addresses are registered. The hash
      // is still verified when the user is missing, to keep the timing similar.
      const ok = user
        ? await verifyPassword(password, user.passwordHash)
        : await verifyPassword(password, "$argon2id$v=19$m=65536,t=2,p=1$notarealsalt$notarealhash");

      if (!user || !ok) {
        return res.status(401).json({ message: "Incorrect email or password" });
      }

      if (user.isBanned) {
        return res.status(403).json({ message: "This account is suspended" });
      }

      req.session.userId = user.id;
      res.json(toPublicUser(user));
    } catch (error) {
      console.error("Error signing in:", error);
      res.status(500).json({ message: "Error signing in" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((error) => {
      if (error) {
        console.error("Error destroying session:", error);
        return res.status(500).json({ message: "Error signing out" });
      }
      res.clearCookie("sid");
      res.json({ message: "Signed out" });
    });
  });

  /** Who am I? Returns 200 with the user, or 401 when signed out. */
  app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser((req as AuthedRequest).userId);
    if (!user) return res.status(401).json({ message: "Not signed in" });
    res.json(toPublicUser(user));
  });

  // Leaderboard
  app.get("/api/leaderboard", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const currentUserId = optionalUserId(req);

      const topUsers = await storage.getTopUsers(limit);
      
      // If current user is provided, check follow status for each user
      if (currentUserId) {
        const usersWithFollowStatus = await Promise.all(
          topUsers.map(async (user) => {
            const isFollowing = await storage.isFollowing(currentUserId, user.id);
            return {
              ...user,
              isFollowing
            };
          })
        );
        res.json(usersWithFollowStatus);
      } else {
        // No current user provided, return users without follow status
        res.json(topUsers);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Error fetching leaderboard" });
    }
  });

  // Post Routes
  app.post("/api/posts", requireAuth, upload.single("image"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image provided" });
      }
      
      const imageUrl = `/uploads/${req.file.filename}`;
      
      // Converting numeric strings to appropriate formats
      const postData = {
        ...req.body,
        imageUrl,
        userId: (req as AuthedRequest).userId,
      };
      
      console.log("Received post data:", postData);
      
      try {
        const validatedData = insertPostSchema.parse(postData);
        
        
        const newPost = await storage.createPost(validatedData);
        
        res.status(201).json(newPost);
      } catch (error) {
        console.error("Validation error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid data", errors: error.errors });
        }
        throw error; // Re-throw to be caught by outer catch
      }
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ message: "Error creating post" });
    }
  });

  app.get("/api/posts/:id", async (req: Request, res: Response) => {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    try {
      const post = await storage.getPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      res.json(post);
    } catch (error) {
      res.status(500).json({ message: "Error fetching post" });
    }
  });

  app.get("/api/users/:id/posts", async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    try {
      const posts = await storage.getPostsForUser(userId);
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Error fetching posts" });
    }
  });

  app.get("/api/feed", async (req: Request, res: Response) => {
    try {
      const userIdStr = String(optionalUserId(req) ?? "");
      const limitStr = req.query.limit as string;
            
      // Validate and convert userId
      let userId = 0;
      try {
        if (userIdStr && /^\d+$/.test(userIdStr)) {
          userId = parseInt(userIdStr);
        }
      } catch (e) {
        console.error("Invalid userId in query:", userIdStr);
      }
      
      // Validate and convert limit - Default to NO LIMIT to show all rigs
      let limit = null; // No limit by default - show ALL uploaded rigs
      try {
        if (limitStr && /^\d+$/.test(limitStr)) {
          limit = parseInt(limitStr);
          // Allow any limit value - no artificial cap since users want to see all rigs
        }
      } catch (e) {
        console.error("Invalid limit in query:", limitStr);
        limit = null; // Fallback to no limit
      }
      
      console.log(`Feed request for userId: ${userId}, limit: ${limit || 'unlimited (showing all rigs)'}`);
            
      // IMPORTANT CHANGE: Always show ALL posts, regardless of whether the user has swiped on them before
      // This implements the endless loop behavior the user wants
      try {
        const { db } = await import("./db");
        const { posts: postsTable } = await import("@shared/schema");
        const { desc } = await import("drizzle-orm");
        
        // Get all posts, ordered by newest first (including user's own posts)
        // User requested chronological order instead of random
        let allPosts = [];
        
        if (userId > 0) {
          const query = db
            .select()
            .from(postsTable)
            // Removed exclusion of user's own posts - users should see ALL posts like Twitter
            .orderBy(desc(postsTable.createdAt)); // Order by newest first
            
          // Only apply limit if one was specified, otherwise show ALL posts
          allPosts = limit ? await query.limit(limit) : await query;
            
          console.log(`Found ${allPosts.length} posts for user ${userId} feed (including own posts, ${limit ? 'limited to ' + limit : 'unlimited'})`);
        } else {
          // If no user ID, show newest posts first
          const query = db
            .select()
            .from(postsTable)
            .orderBy(desc(postsTable.createdAt)); // Order by newest first
            
          // Only apply limit if one was specified, otherwise show ALL posts
          allPosts = limit ? await query.limit(limit) : await query;
            
          console.log(`No user ID provided - returning ${allPosts.length} posts (newest first, ${limit ? 'limited to ' + limit : 'unlimited'})`);
        }
        
        // If current user is provided, add follow status for each post's user
        if (userId > 0) {
          const postsWithFollowStatus = await Promise.all(
            allPosts.map(async (post) => {
              // Don't check follow status for user's own posts
              if (post.userId === userId) {
                return {
                  ...post,
                  isFollowing: false // User doesn't "follow" themselves
                };
              }
              
              const isFollowing = await storage.isFollowing(userId, post.userId);
              return {
                ...post,
                isFollowing
              };
            })
          );
          
          // Add post details for debugging
          if (postsWithFollowStatus.length > 0) {
            const postDetails = postsWithFollowStatus.map(p => `${p.id} (by user ${p.userId}, following: ${p.isFollowing})`).join(', ');
            console.log(`Post IDs being returned with follow status: ${postDetails}`);
          }
          
          return res.json(postsWithFollowStatus);
        } else {
          // No current user provided, return posts without follow status
          // Add post details for debugging
          if (allPosts.length > 0) {
            const postDetails = allPosts.map(p => `${p.id} (by user ${p.userId})`).join(', ');
            console.log(`Post IDs being returned: ${postDetails}`);
          } else {
            console.log(`Warning: No posts found to display in feed`);
          }
          
          return res.json(allPosts);
        }
      } catch (error) {
        console.error("Error getting feed posts:", error);
        
        // Last resort fallback to make sure something is returned - also ordered by newest first
        const { db } = await import("./db");
        const { posts: postsTable } = await import("@shared/schema");
        const { desc } = await import("drizzle-orm");
        
        console.log(`Using last resort fallback: most recent posts (newest first)`);
        
        // Apply the same chronological ordering as the main query
        const fallbackQuery = db
          .select()
          .from(postsTable)
          .orderBy(desc(postsTable.createdAt)); // Consistent ordering by newest first
          
        // Only apply limit if one was specified, otherwise show ALL posts
        const fallbackPosts = limit ? await fallbackQuery.limit(limit) : await fallbackQuery;
        
        return res.json(fallbackPosts);
      }
    } catch (error) {
      console.error("Error fetching feed:", error);
      res.status(500).json({ message: "Error fetching feed" });
    }
  });

  // Swipe Routes
  app.post("/api/swipes", requireAuth, async (req: Request, res: Response) => {
    try {
      // The acting user comes from the session, never from the body. Parsing
      // req.body straight into the insert schema let a signed-in account act
      // as any other user — swipe, comment, follow, report and message as them.
      const validatedData = insertSwipeSchema.parse({
        ...req.body,
        userId: (req as AuthedRequest).userId,
      });
      
      
      // Only check rate limit for right swipes (actual ratings)
      if (validatedData.direction === 'right') {
        // Check if already rated this post today
        const alreadySwiped = await storage.hasUserSwipedToday(
          validatedData.userId,
          validatedData.postId
        );
        
        if (alreadySwiped) {
          // Array of fun messages for the swipe limit
          const messages = [
            "One swipe per day! Try again tomorrow. 😺",
            "One R8 per rig a day, Let the rig cool down. 😎",
            "You've already swiped on this today! 🚀",
            "Easy tiger — one swipe per day! 🐯",
            "R8 - Rise - Repeat every 24hrs! ⛏️"
          ];
          
          // Select a random message
          const randomMessage = messages[Math.floor(Math.random() * messages.length)];
          
          return res.status(409).json({ message: randomMessage });
        }
      }
      
      const newSwipe = await storage.createSwipe(validatedData);
      res.status(201).json(newSwipe);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating swipe" });
    }
  });

  // Follow Routes
  app.post("/api/follows", requireAuth, async (req: Request, res: Response) => {
    try {
      // The acting user comes from the session, never from the body. Parsing
      // req.body straight into the insert schema let a signed-in account act
      // as any other user — swipe, comment, follow, report and message as them.
      const validatedData = insertFollowSchema.parse({
        ...req.body,
        followerId: (req as AuthedRequest).userId,
      });
      
      // Check if user is trying to follow themselves
      if (validatedData.followerId === validatedData.followedId) {
        return res.status(400).json({ message: "You cannot follow yourself" });
      }
      
      
      // Check if already following
      const alreadyFollowing = await storage.isFollowing(
        validatedData.followerId,
        validatedData.followedId
      );
      
      if (alreadyFollowing) {
        // Instead of error, let's return a 200 with the existing follow relationship
        // This makes the API more idempotent and reliable
        console.log(`User ${validatedData.followerId} is already following ${validatedData.followedId}`);
        return res.status(200).json({ 
          id: 0, // We don't know the actual ID, but client doesn't need it
          followerId: validatedData.followerId,
          followedId: validatedData.followedId,
          createdAt: new Date().toISOString(),
          message: "Already following this user"
        });
      }
      
      const newFollow = await storage.createFollow(validatedData);
      res.status(201).json(newFollow);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Error following user" });
    }
  });

  app.delete("/api/follows/:followerId/:followedId", requireSelf("followerId"), async (req: Request, res: Response) => {
    const followerId = parseInt(req.params.followerId);
    const followedId = parseInt(req.params.followedId);
    
    if (isNaN(followerId) || isNaN(followedId)) {
      return res.status(400).json({ message: "Invalid user IDs" });
    }


    try {
      await storage.removeFollow(followerId, followedId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Error unfollowing user" });
    }
  });
  
  // Get users followed by a user
  app.get("/api/users/:id/following", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      console.log(`Getting followed users for userId: ${userId}`);
      
      // Get all followed users from the database
      const followedUsers = await storage.getFollowedUsers(userId);
      
      res.json(followedUsers);
    } catch (error) {
      console.error("Error fetching followed users:", error);
      res.status(500).json({ message: "Error fetching followed users" });
    }
  });

  // Get followers of a user
  app.get("/api/users/:id/followers", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      console.log(`Getting followers for userId: ${userId}`);
      
      // Get all followers from the database
      const followers = await storage.getFollowers(userId);
      
      res.json(followers);
    } catch (error) {
      console.error("Error fetching followers:", error);
      res.status(500).json({ message: "Error fetching followers" });
    }
  });
  
  // Legacy endpoint for compatibility - redirect to new endpoint
  app.get("/api/users/followed", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthedRequest).userId;
      
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      console.log(`Getting followed users for userId: ${userId} (legacy endpoint)`);
      
      // Get all followed users from the database
      const followedUsers = await storage.getFollowedUsers(userId);
      
      res.json(followedUsers);
    } catch (error) {
      console.error("Error fetching followed users:", error);
      res.status(500).json({ message: "Error fetching followed users" });
    }
  });
  
  // Reset all follows (for testing purposes)
  app.post("/api/follows/reset", requireAuth, async (req: Request, res: Response) => {
    try {
      // Get user ID from session
      const userId = (req as any).session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Reset follows in the database for this user
      try {
        const { db } = await import('./db');
        const { follows } = await import('@shared/schema');
        const { eq } = await import('drizzle-orm');
        
        await db.delete(follows).where(eq(follows.followerId, userId));
        console.log(`Deleted all follows for user ${userId}`);
      } catch (error) {
        console.error("Error resetting follows:", error);
      }
      
      res.status(200).json({ message: "All follows have been reset" });
    } catch (error) {
      console.error("Error in reset follows endpoint:", error);
      res.status(500).json({ message: "Error resetting follows" });
    }
  });

  // Comment Routes
  app.get("/api/posts/:id/comments", async (req: Request, res: Response) => {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    try {
      const comments = await storage.getCommentsForPost(postId);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ message: "Error fetching comments" });
    }
  });

  app.post("/api/comments", requireAuth, async (req: Request, res: Response) => {
    try {
      // The acting user comes from the session, never from the body. Parsing
      // req.body straight into the insert schema let a signed-in account act
      // as any other user — swipe, comment, follow, report and message as them.
      const validatedData = insertCommentSchema.parse({
        ...req.body,
        userId: (req as AuthedRequest).userId,
      });
      
      
      const newComment = await storage.createComment(validatedData);
      res.status(201).json(newComment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating comment" });
    }
  });

  // Report Routes
  app.post("/api/reports", requireAuth, async (req: Request, res: Response) => {
    try {
      // The acting user comes from the session, never from the body. Parsing
      // req.body straight into the insert schema let a signed-in account act
      // as any other user — swipe, comment, follow, report and message as them.
      const validatedData = insertReportSchema.parse({
        ...req.body,
        reporterId: (req as AuthedRequest).userId,
      });
      
      
      const newReport = await storage.createReport(validatedData);
      res.status(201).json(newReport);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating report" });
    }
  });

  // Admin Report Routes
  app.get("/api/admin/reports", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const reports = await storage.getPendingReports(limit);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching pending reports:", error);
      res.status(500).json({ message: "Error fetching reports" });
    }
  });
  
  app.patch("/api/admin/reports/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const reportId = parseInt(req.params.id);
      
      // Validate the report ID
      if (isNaN(reportId)) {
        return res.status(400).json({ message: "Invalid report ID" });
      }
      
      // Validate status
      const status = req.body.status;
      if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Update report status
      await storage.updateReportStatus(reportId, status);
      
      // If approved, delete the post
      if (status === 'approved') {
        try {
          // Get the report directly by ID from the database
          const reportCollection = await import("@shared/schema");
          const { reports } = reportCollection;
          const { eq } = await import("drizzle-orm");
          const { db } = await import('./db');
          
          console.log(`Report ID: ${reportId}`);
          
          const [directReport] = await db.select().from(reports).where(eq(reports.id, reportId));
          
          if (directReport && directReport.postId) {
            console.log(`Found report directly. Deleting post with ID ${directReport.postId}`);
            await storage.deletePost(directReport.postId);
          } else {
            console.error(`Direct report not found or has no postId`);
            
            // Fallback to getting from storage
            const pendingReports = await storage.getPendingReports();
            const report = pendingReports.find(r => r.id === reportId);
            
            if (report && report.postId) {
              console.log(`Found report via storage. Deleting post with ID ${report.postId}`);
              await storage.deletePost(report.postId);
            } else {
              console.error(`Could not find report with ID ${reportId} in storage either`);
            }
          }
        } catch(error) {
          console.error(`Error handling report ${reportId}:`, error);
        }
      }
      
      res.status(200).json({ message: "Report status updated" });
    } catch (error) {
      console.error("Error updating report status:", error);
      res.status(500).json({ message: "Error updating report status" });
    }
  });
  
  // Ad Management Routes (Admin only)
  app.get("/api/ads", async (req: Request, res: Response) => {
    try {
      const location = req.query.location as string | undefined;
      // Admins see inactive ads too; everyone else sees only the active ones.
      const viewerId = optionalUserId(req);
      const viewer = viewerId ? await storage.getUser(viewerId) : null;
      const isAdminRequest = viewer?.isAdmin ? "1" : undefined;
      
      // Get all ads first
      const allAds = await storage.getAds(location);
      
      // If this is coming from an admin panel, return all ads
      // Otherwise, return only active ads for regular users
      let ads = allAds;
      
      if (!isAdminRequest) {
        // Filter to only active ads for regular user requests
        ads = allAds.filter(ad => ad.active);
      }
      
      res.json(ads);
    } catch (error) {
      console.error("Error fetching ads:", error);
      res.status(500).json({ message: "Error fetching ads" });
    }
  });
  
  app.get("/api/ads/:id", async (req: Request, res: Response) => {
    try {
      const adId = parseInt(req.params.id);
      if (isNaN(adId)) {
        return res.status(400).json({ message: "Invalid ad ID" });
      }
      
      const ad = await storage.getAd(adId);
      if (!ad) {
        return res.status(404).json({ message: "Ad not found" });
      }
      
      res.json(ad);
    } catch (error) {
      console.error("Error fetching ad:", error);
      res.status(500).json({ message: "Error fetching ad" });
    }
  });
  
  app.post("/api/admin/ads", requireAdmin, upload.single("image"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Image file is required" });
      }
      
      const imageUrl = `/uploads/${req.file.filename}`;
      
      const adData = {
        name: req.body.name,
        imageUrl,
        linkUrl: req.body.linkUrl,
        location: req.body.location,
        width: 320, // Force fixed width
        height: 100, // Force fixed height
        active: req.body.active === "true" || req.body.active === true
      };
      
      // Basic validation
      if (!adData.name || !adData.linkUrl || !adData.location || 
          isNaN(adData.width) || isNaN(adData.height)) {
        return res.status(400).json({
          message: "Missing required fields",
          required: ["name", "linkUrl", "location", "width", "height"]
        });
      }
      
      const newAd = await storage.createAd(adData);
      res.status(201).json(newAd);
    } catch (error) {
      console.error("Error creating ad:", error);
      res.status(500).json({ message: "Error creating ad" });
    }
  });
  
  app.patch("/api/admin/ads/:id", requireAdmin, upload.single("image"), async (req: Request, res: Response) => {
    try {
      const adId = parseInt(req.params.id);
      if (isNaN(adId)) {
        return res.status(400).json({ message: "Invalid ad ID" });
      }
      
      // Check if the ad exists
      const existingAd = await storage.getAd(adId);
      if (!existingAd) {
        return res.status(404).json({ message: "Ad not found" });
      }
      
      // Prepare update data
      const updateData: any = {};
      
      // Update fields if provided
      if (req.body.name) updateData.name = req.body.name;
      if (req.body.linkUrl) updateData.linkUrl = req.body.linkUrl;
      if (req.body.location) updateData.location = req.body.location;
      
      // Force standard ad dimensions (320x100) regardless of input
      updateData.width = 320;
      updateData.height = 100;
      
      // Handle the active field more robustly
      // If active is undefined in the form (checkbox not checked), it's false
      updateData.active = req.body.active === "true" || req.body.active === true;
      
      // If new image was uploaded
      if (req.file) {
        updateData.imageUrl = `/uploads/${req.file.filename}`;
        
        // Delete old image file if it exists and is not a default image
        if (existingAd.imageUrl && existingAd.imageUrl.startsWith('/uploads/')) {
          try {
            const oldImagePath = path.join(process.cwd(), 'dist', 'public', existingAd.imageUrl);
            if (fs.existsSync(oldImagePath)) {
              fs.unlinkSync(oldImagePath);
            }
          } catch (err) {
            console.error("Error deleting old image:", err);
            // Continue with the update even if file deletion fails
          }
        }
      }
      
      const updatedAd = await storage.updateAd(adId, updateData);
      res.json(updatedAd);
    } catch (error) {
      console.error("Error updating ad:", error);
      res.status(500).json({ message: "Error updating ad" });
    }
  });
  
  app.delete("/api/admin/ads/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const adId = parseInt(req.params.id);
      if (isNaN(adId)) {
        return res.status(400).json({ message: "Invalid ad ID" });
      }
      
      // Check if the ad exists
      const ad = await storage.getAd(adId);
      if (!ad) {
        return res.status(404).json({ message: "Ad not found" });
      }
      
      // Delete the image file if it exists and is not a default image
      if (ad.imageUrl && ad.imageUrl.startsWith('/uploads/')) {
        try {
          const imagePath = path.join(process.cwd(), 'dist', 'public', ad.imageUrl);
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (err) {
          console.error("Error deleting image:", err);
          // Continue with the deletion even if file deletion fails
        }
      }
      
      await storage.deleteAd(adId);
      res.status(200).json({ message: "Ad deleted successfully" });
    } catch (error) {
      console.error("Error deleting ad:", error);
      res.status(500).json({ message: "Error deleting ad" });
    }
  });

  // Message API endpoints
  app.get("/api/messages/conversations", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthedRequest).userId;

      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error getting conversations:", error);
      res.status(500).json({ message: "Error getting conversations" });
    }
  });
  
  // Important: Keep specific routes BEFORE parameterized routes to avoid conflicts
  app.get("/api/messages/unread-count/:userId", requireSelf("userId"), async (req: Request, res: Response) => {
    try {
      console.log("Unread message count request params:", req.params);
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      console.log(`Getting unread message count for user ${userId}`);
      const count = await storage.getUnreadMessageCount(userId);
      console.log(`Unread message count result:`, count);
      res.json({ count });
    } catch (error) {
      console.error("Error getting unread message count:", error);
      res.status(500).json({ message: "Error getting unread message count" });
    }
  });
  
  app.patch("/api/messages/read/:senderId/:receiverId", requireSelf("receiverId"), async (req: Request, res: Response) => {
    try {
      const senderId = parseInt(req.params.senderId);
      const receiverId = parseInt(req.params.receiverId);
      
      if (isNaN(senderId) || isNaN(receiverId)) {
        return res.status(400).json({ message: "Invalid user IDs" });
      }
      
      await storage.markMessagesAsRead(senderId, receiverId);
      res.status(200).json({ message: "Messages marked as read" });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Error marking messages as read" });
    }
  });
  
  app.get("/api/messages/:userId1/:userId2", requireSelf("userId1", "userId2"), async (req: Request, res: Response) => {
    try {
      const userId1 = parseInt(req.params.userId1);
      const userId2 = parseInt(req.params.userId2);
      
      if (isNaN(userId1) || isNaN(userId2)) {
        return res.status(400).json({ message: "Invalid user IDs" });
      }
      
      const messages = await storage.getMessagesBetweenUsers(userId1, userId2);
      res.json(messages);
    } catch (error) {
      console.error("Error getting messages:", error);
      res.status(500).json({ message: "Error getting messages" });
    }
  });
  
  app.post("/api/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const { receiverId, content } = req.body;

      // The sender is whoever holds the session. It used to come from the body,
      // which let any signed-in account send messages as anyone else.
      const senderId = (req as AuthedRequest).userId;

      if (!receiverId || !content) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const messageData = insertMessageSchema.parse({
        senderId,
        receiverId: parseInt(receiverId),
        content
      });
      
      const message = await storage.saveMessage(messageData);
      
      // Create a notification for the message
      try {
        // Get sender's display name
        const sender = await storage.getUser(senderId);
        
        // Create notification for the receiver
        if (sender) {
          const notificationData = insertNotificationSchema.parse({
            userId: parseInt(receiverId),
            type: 'message',
            message: `New message from ${sender.displayName || sender.username}`,
            sourceUserId: senderId
          });
          
          await storage.createNotification(notificationData);
          console.log(`Created notification for message from ${senderId} to ${receiverId}`);
        }
      } catch (notifError) {
        console.error("Error creating notification for message:", notifError);
        // Continue even if notification creation fails
      }
      
      // Convert createdAt to timestamp - Drizzle handles timestamptz correctly
      const responseMessage = {
        ...message,
        createdAt: message.createdAt.getTime(), // Use standard getTime()
      };
      
      res.status(201).json(responseMessage);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Error sending message" });
    }
  });
  
  // Add DELETE endpoint to clear chat history between two users
  app.delete("/api/messages/:userId1/:userId2", requireSelf("userId1", "userId2"), async (req: Request, res: Response) => {
    try {
      const userId1 = parseInt(req.params.userId1);
      const userId2 = parseInt(req.params.userId2);
      
      if (isNaN(userId1) || isNaN(userId2)) {
        return res.status(400).json({ message: "Invalid user IDs" });
      }
      
      // Delete all messages between these users
      await storage.deleteMessagesBetweenUsers(userId1, userId2);
      
      res.status(200).json({ message: "Chat history cleared successfully" });
    } catch (error) {
      console.error("Error clearing chat history:", error);
      res.status(500).json({ message: "Error clearing chat history" });
    }
  });
  
  // Notification routes
  // Important: Keep specific routes BEFORE parameterized routes to avoid conflicts
  app.get("/api/notifications/unread-count/:userId", requireSelf("userId"), async (req: Request, res: Response) => {
    try {
      console.log("Unread notification count request params:", req.params);
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      console.log(`Getting unread notification count for user ${userId}`);
      const count = await storage.getUnreadNotificationCount(userId);
      console.log(`Unread notification count result:`, count);
      res.json({ count });
    } catch (error) {
      console.error("Error getting unread notification count:", error);
      res.status(500).json({ message: "Error getting unread notification count" });
    }
  });
  
  app.get("/api/notifications/:userId", requireSelf("userId"), async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const notifications = await storage.getNotificationsForUser(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error getting notifications:", error);
      res.status(500).json({ message: "Error getting notifications" });
    }
  });
  
  app.post("/api/notifications", requireAdmin, async (req: Request, res: Response) => {
    try {
      const validatedData = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(validatedData);
      res.status(201).json(notification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating notification:", error);
      res.status(500).json({ message: "Error creating notification" });
    }
  });
  
  app.patch("/api/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }
      
      const updated = await storage.markNotificationAsRead(id, (req as AuthedRequest).userId);

      if (!updated) {
        // Either it does not exist or it is not theirs. One answer for both, so
        // the endpoint cannot be used to probe for other people's notifications.
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Error marking notification as read" });
    }
  });
  
  app.patch("/api/notifications/:userId/read-all", requireSelf("userId"), async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Error marking all notifications as read" });
    }
  });

  // Admin-only route for sending system notifications
  /**
   * Send one announcement to every user.
   *
   * The message comes from the request, not from this file. The original of
   * this route had a specific incident notice and a list of affected user ids
   * baked into it, which is no use to anyone else.
   */
  app.post("/api/admin/announce", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { message } = req.body ?? {};

      if (typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ message: "A message is required", field: "message" });
      }
      if (message.length > 1000) {
        return res.status(400).json({ message: "Message must be 1000 characters or fewer", field: "message" });
      }

      const allUsers = await storage.getAllUsers();
      let sent = 0;
      const failed: number[] = [];

      for (const user of allUsers) {
        try {
          await storage.createNotification(
            insertNotificationSchema.parse({
              userId: user.id,
              sourceUserId: null,
              postId: null,
              type: "announcement",
              message: message.trim(),
            })
          );
          sent++;
        } catch (error) {
          console.error(`Failed to notify user ${user.id}:`, error);
          failed.push(user.id);
        }
      }

      res.json({ message: `Announcement sent to ${sent} of ${allUsers.length} users`, sent, failed });
    } catch (error) {
      console.error("Error sending announcement:", error);
      res.status(500).json({ message: "Error sending announcement" });
    }
  });

  return httpServer;
}
