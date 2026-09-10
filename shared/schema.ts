import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  /** bcrypt hash. Never returned to a client — see toPublicUser in server/auth.ts. */
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  bio: text("bio"),
  location: text("location"),
  profileImageUrl: text("profile_image_url"),
  bannerImageUrl: text("banner_image_url"),
  points: integer("points").default(0).notNull(),
  miningStartYear: integer("mining_start_year"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  isBanned: boolean("is_banned").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  imageUrl: text("image_url").notNull(),
  minerModel: text("miner_model").notNull(),
  algorithm: text("algorithm").default("SHA-256").notNull(),
  hashrate: text("hashrate"),
  power: text("power"),
  temperature: text("temperature"),
  efficiency: text("efficiency"),
  modifications: text("modifications"),
  points: integer("points").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

export const swipes = pgTable("swipes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  postId: integer("post_id").notNull().references(() => posts.id),
  direction: text("direction").notNull(), // 'left' or 'right'
  date: timestamp("date", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull().references(() => users.id),
  followedId: integer("followed_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id),
  userId: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id),
  reporterId: integer("reporter_id").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  status: text("status").default("pending").notNull(), // 'pending', 'reviewed', 'dismissed'
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

export const ads = pgTable("ads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url").notNull(),
  location: text("location").notNull(), // 'home', 'auth', 'leaderboard', etc.
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  sourceUserId: integer("source_user_id").references(() => users.id),
  postId: integer("post_id").references(() => posts.id),
  type: text("type").notNull(), // 'like', 'comment', 'follow', 'points', etc.
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  swipes: many(swipes),
  comments: many(comments),
  following: many(follows, { relationName: "follower" }),
  followers: many(follows, { relationName: "followed" }),
  reports: many(reports),
  sentMessages: many(messages, { relationName: "sender" }),
  receivedMessages: many(messages, { relationName: "receiver" }),
  notifications: many(notifications),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  swipes: many(swipes),
  comments: many(comments),
  reports: many(reports),
}));

export const swipesRelations = relations(swipes, ({ one }) => ({
  user: one(users, {
    fields: [swipes.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [swipes.postId],
    references: [posts.id],
  }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: "follower",
  }),
  followed: one(users, {
    fields: [follows.followedId],
    references: [users.id],
    relationName: "followed",
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [reports.postId],
    references: [posts.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: "receiver",
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  sourceUser: one(users, {
    fields: [notifications.sourceUserId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [notifications.postId],
    references: [posts.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  points: true,
  createdAt: true
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  points: true,
  createdAt: true
});

export const insertSwipeSchema = createInsertSchema(swipes).omit({
  id: true,
  date: true
});

export const insertFollowSchema = createInsertSchema(follows).omit({
  id: true,
  createdAt: true
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  status: true,
  createdAt: true
});

export const insertAdSchema = createInsertSchema(ads).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  read: true,
  createdAt: true
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  read: true,
  createdAt: true
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;

export type Swipe = typeof swipes.$inferSelect;
export type InsertSwipe = z.infer<typeof insertSwipeSchema>;

export type Follow = typeof follows.$inferSelect;
export type InsertFollow = z.infer<typeof insertFollowSchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

export type Ad = typeof ads.$inferSelect;
export type InsertAd = z.infer<typeof insertAdSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
