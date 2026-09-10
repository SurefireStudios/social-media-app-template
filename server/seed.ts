/**
 * Seed the database with demonstration content.
 *
 * The app has no route guards on the feed, leaderboard or profiles, so an
 * instance with data in it is browsable without signing in — which is the point
 * of this script. A freshly pushed schema shows empty screens everywhere and
 * demonstrates nothing.
 *
 *   bun run db:seed              # refuses if the database already has users
 *   bun run db:seed -- --force   # wipes the seeded tables first
 *
 * Every image is a local SVG under client/public/seed/, generated for this
 * purpose and labelled SAMPLE DATA. No stock photos, no external requests, no
 * licensing question.
 *
 * Every seeded account is signable-into, so you can click through the whole app
 * straight after seeding. They all share one password, printed at the end of the
 * run and defined below in plain sight — which is exactly why you should only
 * ever seed a database you are happy to throw away.
 */
import { db, pool } from "./db";
import {
  users,
  posts,
  swipes,
  follows,
  comments,
  messages,
  notifications,
  ads,
} from "@shared/schema";
import { sql } from "drizzle-orm";
import { hashPassword } from "./auth";

const force = process.argv.includes("--force");

/**
 * Every seeded account shares this password, so the demo is actually usable —
 * sign in as any of them and post, swipe, comment and message.
 *
 * That does mean a seeded database has several accounts whose password is
 * written in this file. Fine for a demo you can wipe; never seed a database
 * holding anything you care about.
 */
const DEMO_PASSWORD = "demo1234";

/** Minutes ago, as a Date. Keeps the feed's relative timestamps sensible. */
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const SEED_USERS = [
  {
    username: "hashfather",
    email: "hashfather@example.invalid",
    displayName: "Hash Father",
    bio: "Running a 12-machine shed in West Texas. Immersion since 2021. Ask me about heat reuse.",
    location: "Midland, TX",
    miningStartYear: 2013,
    points: 4820,
    isAdmin: true,
    isVerified: true,
  },
  {
    username: "solowatt",
    email: "solowatt@example.invalid",
    displayName: "Solo Watt",
    bio: "Solo mining on a shelf of Bitaxes. One block would do it. https://example.invalid/solowatt",
    location: "Bristol, UK",
    miningStartYear: 2020,
    points: 3610,
    isVerified: true,
  },
  {
    username: "coldstart",
    email: "coldstart@example.invalid",
    displayName: "coldstart",
    bio: "Heating a greenhouse with an S19. It works better than it sounds.",
    location: "Tromsø, NO",
    miningStartYear: 2017,
    points: 2975,
  },
  {
    username: "nerdqueen",
    email: "nerdqueen@example.invalid",
    displayName: "NerdQueen",
    bio: "NerdQAxe builds, firmware tinkering, and far too many spare fans.",
    location: "Lisbon, PT",
    miningStartYear: 2022,
    points: 2140,
  },
  {
    username: "terahertz",
    email: "terahertz@example.invalid",
    displayName: "Terahertz",
    bio: "Hosted fleet ops. Efficiency is the only number that matters.",
    location: "Reykjavík, IS",
    miningStartYear: 2015,
    points: 1780,
  },
  {
    username: "benchbuilt",
    email: "benchbuilt@example.invalid",
    displayName: "Bench Built",
    bio: "Everything I run, I built. Most of it twice.",
    location: "Austin, TX",
    miningStartYear: 2019,
    points: 940,
  },
];

const SEED_POSTS = [
  {
    author: "solowatt",
    image: "/seed/rig-1.svg",
    minerModel: "Bitaxe Gamma 601",
    algorithm: "SHA-256",
    hashrate: "1.2",
    power: "18",
    temperature: "54",
    efficiency: "15",
    modifications: "Noctua 40mm swap, printed stand, undervolted to 4.9V",
    points: 412,
    minutesAgo: 42,
  },
  {
    author: "hashfather",
    image: "/seed/rig-2.svg",
    minerModel: "Antminer S21 Pro",
    algorithm: "SHA-256",
    hashrate: "234",
    power: "3510",
    temperature: "61",
    efficiency: "15",
    modifications: "Immersion, single-phase dielectric, stock firmware",
    points: 388,
    minutesAgo: 96,
  },
  {
    author: "terahertz",
    image: "/seed/rig-3.svg",
    minerModel: "Whatsminer M60S",
    algorithm: "SHA-256",
    hashrate: "186",
    power: "3441",
    temperature: "66",
    efficiency: "18.5",
    modifications: "Hydro loop shared with three others",
    points: 351,
    minutesAgo: 180,
  },
  {
    author: "nerdqueen",
    image: "/seed/rig-6.svg",
    minerModel: "NerdQAxe++",
    algorithm: "SHA-256",
    hashrate: "4.8",
    power: "76",
    temperature: "58",
    efficiency: "15.8",
    modifications: "Custom acrylic case, 60mm fan, ESP32 reflashed",
    points: 336,
    minutesAgo: 240,
  },
  {
    author: "coldstart",
    image: "/seed/rig-5.svg",
    minerModel: "Antminer S19j Pro",
    algorithm: "SHA-256",
    hashrate: "104",
    power: "3068",
    temperature: "72",
    efficiency: "29.5",
    modifications: "Ducted into a greenhouse. Runs Nov–Mar only.",
    points: 297,
    minutesAgo: 420,
  },
  {
    author: "benchbuilt",
    image: "/seed/rig-4.svg",
    minerModel: "Bitaxe Ultra 204",
    algorithm: "SHA-256",
    hashrate: "0.5",
    power: "15",
    temperature: "49",
    efficiency: "30",
    modifications: "First build. Hand-soldered the headers.",
    points: 244,
    minutesAgo: 600,
  },
  {
    author: "hashfather",
    image: "/seed/rig-8.svg",
    minerModel: "Antminer S21 XP",
    algorithm: "SHA-256",
    hashrate: "270",
    power: "3645",
    temperature: "59",
    efficiency: "13.5",
    modifications: "Newest shelf. Nothing modified yet.",
    points: 218,
    minutesAgo: 900,
  },
  {
    author: "solowatt",
    image: "/seed/rig-10.svg",
    minerModel: "Bitaxe Supra 401",
    algorithm: "SHA-256",
    hashrate: "0.7",
    power: "17",
    temperature: "52",
    efficiency: "24",
    modifications: "Shelf number four. They multiply.",
    points: 190,
    minutesAgo: 1440,
  },
  {
    author: "terahertz",
    image: "/seed/rig-9.svg",
    minerModel: "Canaan Avalon A1466",
    algorithm: "SHA-256",
    hashrate: "150",
    power: "3230",
    temperature: "68",
    efficiency: "21.5",
    modifications: "Air-cooled, containerised",
    points: 141,
    minutesAgo: 2160,
  },
  {
    author: "nerdqueen",
    image: "/seed/rig-7.svg",
    minerModel: "Avalon Nano 3S",
    algorithm: "SHA-256",
    hashrate: "6",
    power: "140",
    temperature: "55",
    efficiency: "23.3",
    modifications: "Desk heater that occasionally finds shares",
    points: 88,
    minutesAgo: 4320,
  },
];

const SEED_COMMENTS: [string, number, string, number][] = [
  // [author username, post index, content, minutes ago]
  ["hashfather", 0, "15 J/TH on a Bitaxe is genuinely good. What firmware?", 30],
  ["solowatt", 0, "AxeOS 2.4.2 with the voltage pulled down a touch.", 26],
  ["nerdqueen", 0, "Printed stand link? Mine keeps sliding off the shelf.", 20],
  ["terahertz", 1, "Immersion at 61 °C — is that the fluid or the chip?", 80],
  ["hashfather", 1, "Chip. Fluid sits around 43.", 74],
  ["coldstart", 3, "The acrylic case is lovely. Does it trap heat at all?", 200],
  ["nerdqueen", 3, "A little. 60mm fan handles it.", 190],
  ["benchbuilt", 4, "Greenhouse setup is the most sensible thing on this feed.", 380],
  ["solowatt", 5, "First build and the solder looks better than mine.", 540],
  ["terahertz", 6, "13.5 J/TH is the whole reason to buy the XP.", 800],
];

const SEED_MESSAGES: [string, string, string, number, boolean][] = [
  // [from, to, content, minutes ago, read]
  ["solowatt", "hashfather", "Saw your immersion build — what dielectric are you running?", 300, true],
  ["hashfather", "solowatt", "Engineered Fluids BitCool. Not cheap but it has been faultless for two years.", 290, true],
  ["solowatt", "hashfather", "Appreciated. Might try a single-machine tank first.", 285, true],
  ["nerdqueen", "solowatt", "Do you have the STL for that Bitaxe stand?", 120, true],
  ["solowatt", "nerdqueen", "Will dig it out this evening.", 110, false],
  ["benchbuilt", "hashfather", "Any advice on a first hosted machine?", 60, false],
];

const SEED_ADS = [
  {
    name: "Example Hardware Co",
    imageUrl: "/seed/ad-1.svg",
    linkUrl: "https://example.invalid/hardware",
    location: "home",
    width: 728,
    height: 90,
  },
  {
    name: "Example Parts Shop",
    imageUrl: "/seed/ad-2.svg",
    linkUrl: "https://example.invalid/parts",
    location: "leaderboard",
    width: 728,
    height: 90,
  },
];

async function main() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);

  if (count > 0 && !force) {
    console.error(
      `Refusing to seed: ${count} user(s) already exist.\n` +
        `Re-run with --force to clear the seeded tables first.`
    );
    process.exit(1);
  }

  if (count > 0) {
    console.log(`Clearing ${count} existing user(s) and everything referencing them...`);
    // Order matters — these all carry foreign keys back to users or posts.
    await db.execute(sql`
      TRUNCATE TABLE
        notifications, messages, comments, reports, swipes, follows, posts, ads, users
      RESTART IDENTITY CASCADE
    `);
  }

  // --- users -------------------------------------------------------------
  // Hashed once and reused. argon2id is deliberately slow, so hashing the same
  // string per user would add seconds for nothing.
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const insertedUsers = await db
    .insert(users)
    .values(
      SEED_USERS.map((u) => ({
        username: u.username,
        email: u.email,
        displayName: u.displayName,
        bio: u.bio,
        location: u.location,
        miningStartYear: u.miningStartYear,
        points: u.points,
        isAdmin: u.isAdmin ?? false,
        isVerified: u.isVerified ?? false,
        passwordHash,
        profileImageUrl: `/seed/rig-${(SEED_USERS.indexOf(u) % 10) + 1}.svg`,
      }))
    )
    .returning();

  const idOf = (username: string) => {
    const found = insertedUsers.find((u) => u.username === username);
    if (!found) throw new Error(`seed: no user named ${username}`);
    return found.id;
  };
  console.log(`users          ${insertedUsers.length}`);

  // --- posts -------------------------------------------------------------
  const insertedPosts = await db
    .insert(posts)
    .values(
      SEED_POSTS.map((p) => ({
        userId: idOf(p.author),
        imageUrl: p.image,
        minerModel: p.minerModel,
        algorithm: p.algorithm,
        hashrate: p.hashrate,
        power: p.power,
        temperature: p.temperature,
        efficiency: p.efficiency,
        modifications: p.modifications,
        points: p.points,
        createdAt: ago(p.minutesAgo),
      }))
    )
    .returning();
  console.log(`posts          ${insertedPosts.length}`);

  // --- follows -----------------------------------------------------------
  // A deliberately uneven graph, so follower counts differ per profile.
  const followPairs: [string, string][] = [
    ["solowatt", "hashfather"], ["coldstart", "hashfather"],
    ["nerdqueen", "hashfather"], ["terahertz", "hashfather"],
    ["benchbuilt", "hashfather"], ["hashfather", "solowatt"],
    ["nerdqueen", "solowatt"], ["benchbuilt", "solowatt"],
    ["coldstart", "solowatt"], ["hashfather", "terahertz"],
    ["solowatt", "terahertz"], ["nerdqueen", "coldstart"],
    ["benchbuilt", "nerdqueen"], ["terahertz", "nerdqueen"],
    ["solowatt", "benchbuilt"],
  ];
  await db.insert(follows).values(
    followPairs.map(([follower, followed]) => ({
      followerId: idOf(follower),
      followedId: idOf(followed),
    }))
  );
  console.log(`follows        ${followPairs.length}`);

  // --- swipes ------------------------------------------------------------
  // Everyone has seen a few posts, so the feed does not re-serve them all.
  const swipeRows: { userId: number; postId: number; direction: string }[] = [];
  for (const user of insertedUsers) {
    insertedPosts.forEach((post, index) => {
      if (post.userId === user.id) return;      // nobody swipes their own rig
      if ((index + user.id) % 3 !== 0) return;  // a spread, not everything
      swipeRows.push({
        userId: user.id,
        postId: post.id,
        direction: (index + user.id) % 6 === 0 ? "left" : "right",
      });
    });
  }
  if (swipeRows.length) await db.insert(swipes).values(swipeRows);
  console.log(`swipes         ${swipeRows.length}`);

  // --- comments ----------------------------------------------------------
  await db.insert(comments).values(
    SEED_COMMENTS.map(([author, postIndex, content, minutesAgo]) => ({
      postId: insertedPosts[postIndex].id,
      userId: idOf(author),
      content,
      createdAt: ago(minutesAgo),
    }))
  );
  console.log(`comments       ${SEED_COMMENTS.length}`);

  // --- messages ----------------------------------------------------------
  await db.insert(messages).values(
    SEED_MESSAGES.map(([from, to, content, minutesAgo, read]) => ({
      senderId: idOf(from),
      receiverId: idOf(to),
      content,
      read,
      createdAt: ago(minutesAgo),
    }))
  );
  console.log(`messages       ${SEED_MESSAGES.length}`);

  // --- notifications -----------------------------------------------------
  const notificationRows = [
    {
      userId: idOf("solowatt"),
      sourceUserId: idOf("hashfather"),
      postId: insertedPosts[0].id,
      type: "comment",
      message: "Hash Father commented on your Bitaxe Gamma 601",
      read: false,
      createdAt: ago(30),
    },
    {
      userId: idOf("solowatt"),
      sourceUserId: idOf("nerdqueen"),
      postId: insertedPosts[0].id,
      type: "comment",
      message: "NerdQueen commented on your Bitaxe Gamma 601",
      read: false,
      createdAt: ago(20),
    },
    {
      userId: idOf("hashfather"),
      sourceUserId: idOf("benchbuilt"),
      postId: null,
      type: "follow",
      message: "Bench Built started following you",
      read: true,
      createdAt: ago(180),
    },
    {
      userId: idOf("nerdqueen"),
      sourceUserId: null,
      postId: insertedPosts[3].id,
      type: "points",
      message: "Your NerdQAxe++ passed 300 points",
      read: false,
      createdAt: ago(90),
    },
  ];
  await db.insert(notifications).values(notificationRows);
  console.log(`notifications  ${notificationRows.length}`);

  // --- ads ---------------------------------------------------------------
  await db.insert(ads).values(SEED_ADS);
  console.log(`ads            ${SEED_ADS.length}`);

  console.log("\nSeeded. The feed, leaderboard and profiles are browsable signed out.");
  console.log("\nSign in with any of these:");
  for (const u of SEED_USERS) {
    console.log(`  ${u.email.padEnd(34)} ${DEMO_PASSWORD}${u.isAdmin ? "   (admin)" : ""}`);
  }
  console.log("\nThey all share one password that is printed in server/seed.ts. Demo data only.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
