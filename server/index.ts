import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { stripSecrets } from "./sanitize";
import { setupVite, serveStatic, log } from "./vite";
import cors from "cors";
import { sessionMiddleware } from "./auth";

const app = express();

// Origins allowed to call the API with credentials.
//
// The client is served by this same process, so same-origin requests need no
// entry here at all. Set PUBLIC_ORIGIN only if you serve the front end from a
// different host — a comma-separated list.
const corsOrigins: (string | RegExp)[] = [
  "http://localhost:3000",
  "http://localhost:5000",
];

if (process.env.PUBLIC_ORIGIN) {
  corsOrigins.push(...process.env.PUBLIC_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean));
}

// Trust proxy headers when behind Cloudflare/reverse proxy
app.set('trust proxy', true);

// Configure CORS to allow specified origins with credential support
app.use(cors({
  origin: corsOrigins,
  credentials: true, // Allow credentials (cookies)
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // Allow all methods
  allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"] // Allow these headers
}));

// Add OPTIONS handler for preflight requests
app.options('*', cors({
  origin: corsOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"]
}));

// Signed session cookie. Every route derives the acting user from this and
// nothing else — see server/auth.ts.
app.use(sessionMiddleware());

// Sessions over plain HTTP in production are a real problem, not a style point:
// the cookie travels in the clear and anyone on the network path can take it.
// Warn once rather than on every request.
if (process.env.NODE_ENV === "production") {
  let warned = false;
  app.use((req, _res, next) => {
    if (!warned && !req.secure) {
      warned = true;
      log(
        "WARNING: running in production over plain HTTP. Session cookies are " +
          "not marked Secure and travel unencrypted. Put this behind HTTPS."
      );
    }
    next();
  });
}

// Before the routes, so every res.json below is covered.
app.use(stripSecrets);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Anything under /api that no route claimed is a 404, not the SPA shell.
  // Without this the static/Vite fallback below answers with index.html and a
  // 200, so a typo'd endpoint reaches the client as HTML it then tries to
  // parse as JSON.
  app.use("/api", (req: Request, res: Response) => {
    res.status(404).json({ message: `No such endpoint: ${req.method} /api${req.path}` });
  });

  // Error handler for API routes
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    log(`Error: ${status} - ${message}`);
    
    // Only return JSON for API routes
    if (_req.path.startsWith('/api')) {
      return res.status(status).json({ message });
    }
    
    // For non-API routes, let the client handle it or send basic HTML
    res.status(status).send(`
      <html>
        <head><title>Error ${status}</title></head>
        <body>
          <h1>Error ${status}</h1>
          <p>${message}</p>
          <a href="/">Go back to homepage</a>
        </body>
      </html>
    `);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // One process serves both the API and the client.
  //
  // The port was hardcoded to 5000, which is fine on a VPS you control but
  // makes the app undeployable anywhere that assigns a port — Render, Fly,
  // Railway and every other managed host set $PORT and expect you to bind it.
  // 5000 remains the local default.
  const port = Number(process.env.PORT) || 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
