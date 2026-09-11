var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_path6 = __toESM(require("path"), 1);
var import_express8 = __toESM(require("express"), 1);

// src/app.ts
var import_express7 = __toESM(require("express"), 1);

// src/api/routes/index.ts
var import_express6 = require("express");

// src/api/routes/downloader.routes.ts
var import_express = require("express");

// src/services/download/download.service.ts
var import_crypto4 = __toESM(require("crypto"), 1);

// src/database/repositories/memory-database.ts
var MemoryDatabase = class {
  constructor() {
    this.jobs = /* @__PURE__ */ new Map();
    this.cache = /* @__PURE__ */ new Map();
    this.rateLimits = /* @__PURE__ */ new Map();
    this.providerStatuses = /* @__PURE__ */ new Map();
  }
  // Jobs
  async saveJob(job) {
    this.jobs.set(job.id, { ...job });
    return job;
  }
  async getJobById(id) {
    const job = this.jobs.get(id);
    if (!job) return null;
    return { ...job };
  }
  async getJobs(limit = 50) {
    const all = Array.from(this.jobs.values());
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return all.slice(0, limit);
  }
  async updateJobStatus(id, status, updates = {}) {
    const existing = this.jobs.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      status
    };
    this.jobs.set(id, updated);
    return { ...updated };
  }
  async deleteJob(id) {
    return this.jobs.delete(id);
  }
  async deleteExpiredJobs(beforeIso) {
    const cutoff = new Date(beforeIso).getTime();
    let deletedCount = 0;
    for (const [id, job] of this.jobs.entries()) {
      const jobExpiresAt = new Date(job.expiresAt).getTime();
      if (jobExpiresAt <= cutoff) {
        this.jobs.delete(id);
        deletedCount++;
      }
    }
    return deletedCount;
  }
  async markAbandonedJobs(beforeIso) {
    const cutoff = new Date(beforeIso).getTime();
    let updatedCount = 0;
    for (const [id, job] of this.jobs.entries()) {
      if ((job.status === "processing" || job.status === "queued") && new Date(job.createdAt).getTime() <= cutoff) {
        job.status = "expired";
        job.error = job.error || "Job marked expired due to timeout/inactivity";
        this.jobs.set(id, job);
        updatedCount++;
      }
    }
    return updatedCount;
  }
  // Cache
  async getCache(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (new Date(entry.expiresAt).getTime() <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return { ...entry };
  }
  async setCache(key, value, ttlSeconds) {
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1e3).toISOString();
    const entry = {
      key,
      value,
      createdAt,
      expiresAt
    };
    this.cache.set(key, entry);
    return entry;
  }
  async deleteCache(key) {
    return this.cache.delete(key);
  }
  async deleteExpiredCache(beforeIso) {
    const cutoff = new Date(beforeIso).getTime();
    let deleted = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (new Date(entry.expiresAt).getTime() <= cutoff) {
        this.cache.delete(key);
        deleted++;
      }
    }
    return deleted;
  }
  async getCacheStats() {
    const now = Date.now();
    let active = 0;
    for (const entry of this.cache.values()) {
      if (new Date(entry.expiresAt).getTime() > now) {
        active++;
      }
    }
    return {
      count: this.cache.size,
      activeCount: active
    };
  }
  // Rate Limiting
  async getRateLimit(key) {
    const record = this.rateLimits.get(key);
    if (!record) return null;
    if (Date.now() > record.resetAt) {
      this.rateLimits.delete(key);
      return null;
    }
    return { ...record };
  }
  async incrementRateLimit(key, windowMs) {
    const now = Date.now();
    const existing = this.rateLimits.get(key);
    if (!existing || now > existing.resetAt) {
      const newRecord = {
        key,
        count: 1,
        resetAt: now + windowMs
      };
      this.rateLimits.set(key, newRecord);
      return { count: 1, resetAt: newRecord.resetAt };
    }
    existing.count += 1;
    this.rateLimits.set(key, existing);
    return { count: existing.count, resetAt: existing.resetAt };
  }
  async resetRateLimit(key) {
    this.rateLimits.delete(key);
  }
  async cleanExpiredRateLimits(nowMs) {
    let cleaned = 0;
    for (const [key, record] of this.rateLimits.entries()) {
      if (nowMs > record.resetAt) {
        this.rateLimits.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }
  // Provider Status
  async getProviderStatus(name) {
    const status = this.providerStatuses.get(name);
    return status ? { ...status } : null;
  }
  async getAllProviderStatuses() {
    return Array.from(this.providerStatuses.values()).map((s) => ({ ...s }));
  }
  async updateProviderStatus(name, updates) {
    const existing = this.providerStatuses.get(name) || {
      name,
      isAvailable: false,
      lastCheck: (/* @__PURE__ */ new Date()).toISOString(),
      successCount: 0,
      failureCount: 0,
      avgResponseTimeMs: 0,
      supportedPlatforms: []
    };
    const updated = {
      ...existing,
      ...updates,
      lastCheck: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.providerStatuses.set(name, updated);
    return { ...updated };
  }
  async recordProviderCall(name, success, durationMs, error) {
    const existing = this.providerStatuses.get(name) || {
      name,
      isAvailable: true,
      lastCheck: (/* @__PURE__ */ new Date()).toISOString(),
      successCount: 0,
      failureCount: 0,
      avgResponseTimeMs: 0,
      supportedPlatforms: []
    };
    if (success) {
      existing.successCount += 1;
      const totalCalls = existing.successCount + existing.failureCount;
      existing.avgResponseTimeMs = Math.round(
        (existing.avgResponseTimeMs * (totalCalls - 1) + durationMs) / totalCalls
      );
    } else {
      existing.failureCount += 1;
      existing.lastError = error;
    }
    existing.lastCheck = (/* @__PURE__ */ new Date()).toISOString();
    this.providerStatuses.set(name, existing);
  }
};
var db = new MemoryDatabase();

// src/providers/ytdlp/ytdlp.provider.ts
var import_crypto2 = __toESM(require("crypto"), 1);
var import_fs3 = __toESM(require("fs"), 1);
var import_path4 = __toESM(require("path"), 1);

// src/utils/platform-detector.ts
var PLATFORM_RULES = [
  {
    platform: "youtube",
    patterns: [
      /^(https?:\/\/)?(www\.|m\.|music\.)?youtube\.com\/(watch\?|shorts\/|playlist\?|embed\/|v\/)/i,
      /^(https?:\/\/)?youtu\.be\/[a-zA-Z0-9_-]+/i
    ]
  },
  {
    platform: "instagram",
    patterns: [
      /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|reels|tv|stories)\/[a-zA-Z0-9_-]+/i,
      /^(https?:\/\/)?instagr\.am\/[a-zA-Z0-9_-]+/i
    ]
  },
  {
    platform: "tiktok",
    patterns: [
      /^(https?:\/\/)?(www\.|m\.|t\.)?tiktok\.com\/(@[a-zA-Z0-9_.-]+\/video\/\d+|v\/\d+|t\/[a-zA-Z0-9]+)/i,
      /^(https?:\/\/)?(vm|vt)\.tiktok\.com\/[a-zA-Z0-9_-]+/i
    ]
  },
  {
    platform: "facebook",
    patterns: [
      /^(https?:\/\/)?(www\.|m\.|web\.)?facebook\.com\/([a-zA-Z0-9_.-]+\/videos\/|watch\/\?v=|reel\/|story\.php\?)/i,
      /^(https?:\/\/)?fb\.watch\/[a-zA-Z0-9_-]+/i,
      /^(https?:\/\/)?fb\.com\/[a-zA-Z0-9_.-]+/i
    ]
  },
  {
    platform: "pinterest",
    patterns: [
      /^(https?:\/\/)?([a-z0-9-]+\.)?pinterest\.(com|[a-z]{2,3}(\.[a-z]{2})?)\/pin\/\d+/i,
      /^(https?:\/\/)?pin\.it\/[a-zA-Z0-9_-]+/i
    ]
  },
  {
    platform: "twitter",
    patterns: [
      /^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/[A-Za-z0-9_]{1,15}(?:[/?#].*)?$/i
    ]
  },
  {
    platform: "reddit",
    patterns: [
      /^(https?:\/\/)?(www\.)?reddit\.com\/(?:r\/[A-Za-z0-9_+.-]+\/(?:comments\/|s\/)|u(?:ser)?\/[A-Za-z0-9_-]+|comments\/|gallery\/|media\/)/i,
      /^(https?:\/\/)?redd\.it\/[A-Za-z0-9]+/i
    ]
  }
];
function detectPlatform(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  for (const rule of PLATFORM_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(trimmed))) {
      return rule.platform;
    }
  }
  return null;
}

// src/providers/base/base.provider.ts
var BaseProvider = class {
  isSupported(url) {
    const detected = detectPlatform(url);
    if (!detected) return false;
    return this.supportedPlatforms.includes(detected);
  }
  async search(query, platform) {
    return [];
  }
  async withTimeout(promise, timeoutMs, operationName = "Operation") {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`[${this.name}] ${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
};

// src/utils/errors.ts
var DownloaderError = class _DownloaderError extends Error {
  constructor(message, code, statusCode = 400, details) {
    super(message);
    this.name = "DownloaderError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, _DownloaderError.prototype);
  }
  static invalidUrl(message = "Invalid URL supplied.") {
    return new _DownloaderError(message, "INVALID_URL", 400);
  }
  static unsupportedPlatform(message = "Unsupported platform.") {
    return new _DownloaderError(message, "UNSUPPORTED_PLATFORM", 400);
  }
  static ytdlpNotFound(message = "yt-dlp binary is not installed or available on the host system.") {
    return new _DownloaderError(message, "YTDLP_NOT_FOUND", 503);
  }
  static ytdlpFailed(message, details) {
    return new _DownloaderError(message, "YTDLP_FAILED", 502, details);
  }
  static cobaltUnavailable(message = "Cobalt provider is not configured or unreachable.") {
    return new _DownloaderError(message, "COBALT_UNAVAILABLE", 503);
  }
  static externalApiUnavailable(message = "External API provider is not configured or unreachable.") {
    return new _DownloaderError(message, "EXTERNAL_API_UNAVAILABLE", 503);
  }
  static providerUnavailable(message) {
    return new _DownloaderError(message, "PROVIDER_UNAVAILABLE", 503);
  }
  static providerFailed(message, details) {
    return new _DownloaderError(message, "PROVIDER_FAILED", 502, details);
  }
  static timeout(message = "The download operation timed out.") {
    return new _DownloaderError(message, "DOWNLOAD_TIMEOUT", 504);
  }
  static fileTooLarge(message = "File exceeds maximum allowed download size.") {
    return new _DownloaderError(message, "FILE_TOO_LARGE", 413);
  }
  static invalidMedia(message = "The downloaded file is corrupted or not a valid media file.") {
    return new _DownloaderError(message, "INVALID_MEDIA", 502);
  }
  static expired(message = "Download has expired.") {
    return new _DownloaderError(message, "DOWNLOAD_EXPIRED", 410);
  }
  static rateLimited(message = "Rate limit exceeded.") {
    return new _DownloaderError(message, "RATE_LIMITED", 429);
  }
  static jobNotFound(jobId) {
    return new _DownloaderError(`Download job '${jobId}' was not found.`, "JOB_NOT_FOUND", 404);
  }
};

// src/config/index.ts
var import_path = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var parsePriority = (val) => {
  if (!val) return ["ytdlp", "cobalt", "external"];
  return val.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
};
var parseSizeToBytes = (sizeStr) => {
  const match = sizeStr.trim().match(/^(\d+(?:\.\d+)?)\s*([kmgtpezy]?b?)$/i);
  if (!match) return 100 * 1024 * 1024;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase().charAt(0);
  switch (unit) {
    case "K":
      return Math.round(num * 1024);
    case "M":
      return Math.round(num * 1024 * 1024);
    case "G":
      return Math.round(num * 1024 * 1024 * 1024);
    default:
      return Math.round(num);
  }
};
var maxFileSize = process.env.MAX_FILE_SIZE_MB ? `${process.env.MAX_FILE_SIZE_MB}M` : process.env.YTDLP_MAX_FILE_SIZE || "100M";
var remoteComponents = (process.env.YTDLP_REMOTE_COMPONENTS || process.env.YTDLP_EJS_SOURCE || "ejs:github").trim();
var config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  host: process.env.HOST || "0.0.0.0",
  appName: process.env.APP_NAME || "hax-media-downloader",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  author: "Hamza",
  adminApiKey: (process.env.ADMIN_API_KEY || "").trim(),
  cronSecret: (process.env.CRON_SECRET || "").trim(),
  apiKeyHeader: (process.env.API_KEY_HEADER || "x-api-key").toLowerCase(),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  tempDir: process.env.TEMP_DIR || import_path.default.join(process.cwd(), "temp"),
  maxConcurrentDownloads: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS || "3", 10),
  cleanupIntervalMinutes: parseInt(process.env.CLEANUP_INTERVAL_MINUTES || "15", 10),
  runProviderIntegrationTests: process.env.RUN_PROVIDER_INTEGRATION_TESTS === "true",
  pinterest: {
    enabled: process.env.PINTEREST_ENABLED === "true",
    clientId: (process.env.PINTEREST_CLIENT_ID || "").trim(),
    clientSecret: (process.env.PINTEREST_CLIENT_SECRET || "").trim(),
    redirectUri: (process.env.PINTEREST_REDIRECT_URI || "").trim(),
    accessToken: (process.env.PINTEREST_ACCESS_TOKEN || "").trim(),
    refreshToken: (process.env.PINTEREST_REFRESH_TOKEN || "").trim(),
    apiBaseUrl: (process.env.PINTEREST_API_BASE_URL || "https://api.pinterest.com/v5").trim(),
    oauthBaseUrl: (process.env.PINTEREST_OAUTH_BASE_URL || "https://www.pinterest.com/oauth/").trim(),
    scopes: (process.env.PINTEREST_SCOPES || "pins:read,boards:read,user_accounts:read").split(/[ ,]+/).map((scope) => scope.trim()).filter(Boolean),
    timeoutMs: parseInt(process.env.PINTEREST_TIMEOUT_MS || "10000", 10),
    downloadFallbackEnabled: process.env.PINTEREST_DOWNLOAD_FALLBACK_ENABLED !== "false"
  },
  rateLimit: {
    // Default: 10 requests per window (1 hour)
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || process.env.RATE_LIMIT_MAX || "10", 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || process.env.RATE_LIMIT_WINDOW || "3600000", 10),
    // 1 hour
    adminMaxRequests: parseInt(process.env.ADMIN_RATE_LIMIT_MAX_REQUESTS || "1000", 10),
    adminWindowMs: parseInt(process.env.ADMIN_RATE_LIMIT_WINDOW_MS || "3600000", 10)
  },
  cache: {
    enabled: process.env.CACHE_ENABLED !== "false",
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || process.env.CACHE_TTL || "1800", 10),
    // 30 minutes
    jobExpirationSeconds: parseInt(process.env.JOB_EXPIRATION_SECONDS || process.env.JOB_TTL || "3600", 10)
    // 1 hour
  },
  providers: {
    priority: parsePriority(process.env.PROVIDER_PRIORITY),
    defaultTimeoutMs: parseInt(process.env.PROVIDER_TIMEOUT_MS || "30000", 10),
    ytdlp: {
      enabled: process.env.YTDLP_ENABLED !== "false",
      binaryPath: process.env.YTDLP_PATH || "yt-dlp",
      timeoutMs: parseInt(process.env.YTDLP_TIMEOUT_MS || process.env.YTDLP_TIMEOUT || "45000", 10),
      maxFileSize,
      maxFileSizeBytes: parseSizeToBytes(maxFileSize),
      jsRuntime: (process.env.YTDLP_JS_RUNTIME || "auto").toLowerCase().trim(),
      remoteComponents,
      ejsSource: remoteComponents
    },
    cobalt: {
      enabled: process.env.COBALT_ENABLED !== "false",
      apiUrl: (process.env.COBALT_API_URL || "https://cobalt-api.lamps-dev.dev").trim(),
      apiKey: (process.env.COBALT_API_KEY || "").trim(),
      timeoutMs: parseInt(process.env.COBALT_TIMEOUT_MS || "20000", 10)
    },
    external: {
      enabled: process.env.EXTERNAL_API_ENABLED !== "false",
      apiUrl: (process.env.EXTERNAL_API_URL || "").trim(),
      apiKey: (process.env.EXTERNAL_API_KEY || "").trim(),
      apiHeader: process.env.EXTERNAL_API_HEADER || "x-api-key",
      timeoutMs: parseInt(process.env.EXTERNAL_TIMEOUT_MS || "20000", 10)
    }
  }
};

// src/utils/logger.ts
var Logger = class {
  constructor() {
    this.levelWeights = {
      debug: 10,
      info: 20,
      warn: 30,
      error: 40
    };
    this.currentLevel = process.env.LOG_LEVEL || "info";
  }
  sanitize(data) {
    if (!data) return data;
    if (typeof data === "string") {
      return data.replace(/(api[-_]?key|token|secret|password)=([^&\s]+)/gi, "$1=[REDACTED]");
    }
    if (typeof data === "object") {
      if (Array.isArray(data)) {
        return data.map((item) => this.sanitize(item));
      }
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        if (/key|secret|token|password|auth/i.test(key)) {
          sanitized[key] = "[REDACTED]";
        } else if (typeof value === "object" && value !== null) {
          sanitized[key] = this.sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }
    return data;
  }
  log(level, message, context) {
    if (this.levelWeights[level] < this.levelWeights[this.currentLevel]) {
      return;
    }
    const entry = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      level,
      message,
      ...context ? { context: this.sanitize(context) } : {}
    };
    const formatted = JSON.stringify(entry);
    if (level === "error") {
      console.error(formatted);
    } else if (level === "warn") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }
  debug(message, context) {
    this.log("debug", message, context);
  }
  info(message, context) {
    this.log("info", message, context);
  }
  warn(message, context) {
    this.log("warn", message, context);
  }
  error(message, context) {
    this.log("error", message, context);
  }
};
var logger = new Logger();

// src/providers/ytdlp/ytdlp.binary.ts
var import_child_process = require("child_process");
var import_util = require("util");
var import_fs = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);
var execFileAsync = (0, import_util.promisify)(import_child_process.execFile);
var YtDlpBinaryManager = class {
  static {
    this.cachedPath = null;
  }
  static {
    this.lastCheckTime = 0;
  }
  static {
    this.isAvailable = false;
  }
  static {
    this.version = "unknown";
  }
  static {
    this.ffmpegChecked = false;
  }
  static {
    this.ffmpegInfo = { available: false };
  }
  static {
    this.jsRuntimeInfo = null;
  }
  static {
    this.lastJsCheckTime = 0;
  }
  /**
   * Finds the best available path to the yt-dlp executable.
   * Priority:
   * 1. Configured YTDLP_PATH
   * 2. Local ./bin/yt-dlp (or ./bin/yt-dlp.exe) in workspace
   * 3. System installed PATH binary (/usr/local/bin/yt-dlp, /usr/bin/yt-dlp, yt-dlp)
   */
  static async resolveBinary() {
    const now = Date.now();
    if (this.cachedPath && now - this.lastCheckTime < 3e4) {
      return {
        available: this.isAvailable,
        path: this.cachedPath,
        version: this.version
      };
    }
    const isWin = process.platform === "win32";
    const binaryExt = isWin ? ".exe" : "";
    const binDir = import_path2.default.join(process.cwd(), "bin");
    const candidatePaths = [
      config.providers.ytdlp.binaryPath,
      import_path2.default.join(binDir, `yt-dlp${binaryExt}`),
      import_path2.default.join(binDir, "yt-dlp"),
      "/usr/local/bin/yt-dlp",
      "/usr/bin/yt-dlp"
    ];
    for (const candidate of candidatePaths) {
      if (!candidate) continue;
      try {
        if (candidate.includes("/") || candidate.includes("\\")) {
          if (!import_fs.default.existsSync(candidate)) {
            continue;
          }
        }
        const { stdout } = await execFileAsync(candidate, ["--version"], { timeout: 5e3 });
        const ver = stdout.trim().split("\n").pop()?.trim() || "unknown";
        if (ver) {
          this.cachedPath = candidate;
          this.isAvailable = true;
          this.version = ver;
          this.lastCheckTime = now;
          logger.info(`Resolved yt-dlp binary at: ${candidate} (version: ${ver})`);
          return { available: true, path: candidate, version: ver };
        }
      } catch {
      }
    }
    try {
      const { stdout } = await execFileAsync("yt-dlp", ["--version"], { timeout: 5e3 });
      const ver = stdout.trim().split("\n").pop()?.trim() || "unknown";
      if (ver) {
        this.cachedPath = "yt-dlp";
        this.isAvailable = true;
        this.version = ver;
        this.lastCheckTime = now;
        logger.info(`Resolved yt-dlp binary via PATH: yt-dlp (version: ${ver})`);
        return { available: true, path: "yt-dlp", version: ver };
      }
    } catch {
    }
    this.isAvailable = false;
    this.cachedPath = null;
    this.version = "not found";
    this.lastCheckTime = now;
    return { available: false, version: "not found" };
  }
  /**
   * Resolves supported JavaScript runtime for YouTube challenge solving.
   * Prefers Deno 2.x, or Node.js 22+. Falls back to Node.js 20 with warning.
   */
  static async resolveJsRuntime() {
    const now = Date.now();
    if (this.jsRuntimeInfo && now - this.lastJsCheckTime < 6e4) {
      return this.jsRuntimeInfo;
    }
    const preferred = config.providers.ytdlp.jsRuntime;
    if (preferred === "none") {
      this.jsRuntimeInfo = {
        available: false,
        name: "none",
        isSupported: false,
        warning: "JS runtime explicitly disabled in configuration"
      };
      this.lastJsCheckTime = now;
      return this.jsRuntimeInfo;
    }
    if (preferred === "deno" || preferred === "auto") {
      try {
        const { stdout } = await execFileAsync("deno", ["--version"], { timeout: 4e3 });
        const firstLine = stdout.trim().split("\n")[0] || "";
        const verMatch = firstLine.match(/deno\s+([0-9.]+)/i);
        const version = verMatch ? verMatch[1] : firstLine;
        this.jsRuntimeInfo = {
          available: true,
          name: "deno",
          version,
          isSupported: true
        };
        this.lastJsCheckTime = now;
        return this.jsRuntimeInfo;
      } catch {
      }
    }
    if (preferred === "node" || preferred === "auto") {
      try {
        const { stdout } = await execFileAsync("node", ["--version"], { timeout: 4e3 });
        const version = stdout.trim();
        const majorMatch = version.match(/^v?(\d+)/);
        const major = majorMatch ? parseInt(majorMatch[1], 10) : 0;
        if (major >= 22) {
          this.jsRuntimeInfo = {
            available: true,
            name: "node",
            version,
            isSupported: true
          };
        } else if (major >= 18) {
          this.jsRuntimeInfo = {
            available: true,
            name: "node",
            version,
            isSupported: true,
            warning: `Node.js ${version} may have limited support for YouTube challenge solving. Deno 2.x or Node 22+ recommended.`
          };
        } else if (major > 0) {
          this.jsRuntimeInfo = {
            available: false,
            name: "node",
            version,
            isSupported: false,
            warning: `Node.js ${version} is below version 18. Deno 2.x or Node 18+ is required for yt-dlp.`
          };
        }
        this.lastJsCheckTime = now;
        if (this.jsRuntimeInfo) return this.jsRuntimeInfo;
      } catch {
      }
    }
    this.jsRuntimeInfo = {
      available: false,
      name: "none",
      isSupported: false,
      warning: "No supported JavaScript runtime (Deno 2.x or Node 18+) detected on host system."
    };
    this.lastJsCheckTime = now;
    return this.jsRuntimeInfo;
  }
  /**
   * Returns command arguments for JS runtime configuration.
   */
  static async getJsRuntimeArgs() {
    const runtime = await this.resolveJsRuntime();
    if (runtime.available && runtime.isSupported && (runtime.name === "deno" || runtime.name === "node")) {
      return ["--js-runtimes", runtime.name];
    }
    return [];
  }
  /**
   * Returns command arguments for remote EJS components if configured.
   */
  static getEjsArgs() {
    const raw = config.providers.ytdlp.remoteComponents || config.providers.ytdlp.ejsSource;
    if (!raw || raw === "none" || raw === "false") {
      return [];
    }
    if (raw.startsWith("ejs:")) {
      return ["--remote-components", raw];
    }
    if (raw === "github") {
      return ["--remote-components", "ejs:github"];
    }
    if (raw === "npm") {
      return ["--remote-components", "ejs:npm"];
    }
    return ["--remote-components", raw];
  }
  /**
   * Checks if FFmpeg is installed and accessible on host.
   */
  static async checkFfmpeg() {
    if (this.ffmpegChecked) return this.ffmpegInfo;
    try {
      const { stdout } = await execFileAsync("ffmpeg", ["-version"], { timeout: 3e3 });
      const firstLine = stdout.trim().split("\n")[0] || "";
      const verMatch = firstLine.match(/ffmpeg\s+version\s+([^\s]+)/i);
      const version = verMatch ? verMatch[1] : firstLine;
      this.ffmpegInfo = { available: true, version };
    } catch {
      this.ffmpegInfo = { available: false };
    }
    this.ffmpegChecked = true;
    return this.ffmpegInfo;
  }
  /**
   * Executes a command using execFile with argument arrays (no shell interpolation).
   */
  static async executeCommand(args, timeoutMs = 45e3) {
    const binary = await this.resolveBinary();
    if (!binary.available || !binary.path) {
      throw DownloaderError.ytdlpNotFound("YTDLP_NOT_FOUND: yt-dlp binary is not installed or available on this system.");
    }
    try {
      return await execFileAsync(binary.path, args, {
        timeout: timeoutMs,
        maxBuffer: 25 * 1024 * 1024
        // 25MB output buffer
      });
    } catch (err) {
      const error = err;
      if (error.killed || error.message.includes("TIMEDOUT") || error.message.includes("timed out")) {
        throw DownloaderError.timeout(`yt-dlp command timed out after ${timeoutMs}ms`);
      }
      const stderr = error.stderr || error.message;
      if (stderr.includes("Unsupported URL") || stderr.includes("is not a valid URL")) {
        throw DownloaderError.invalidUrl(stderr.trim());
      }
      if (stderr.includes("Private video") || stderr.includes("Sign in") || stderr.includes("login required")) {
        throw DownloaderError.ytdlpFailed("Content requires authentication or is private", { raw: stderr });
      }
      if (stderr.includes("Video unavailable") || stderr.includes("This video has been removed")) {
        throw DownloaderError.ytdlpFailed("Content is unavailable or removed on host platform", { raw: stderr });
      }
      throw DownloaderError.ytdlpFailed(`yt-dlp execution failed: ${stderr.slice(0, 300)}`, { raw: stderr });
    }
  }
};

// src/services/storage/storage.service.ts
var import_fs2 = __toESM(require("fs"), 1);
var import_path3 = __toESM(require("path"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var MIME_MAP = {
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
  aac: "audio/aac"
};
var ALLOWED_EXTENSIONS = new Set(Object.keys(MIME_MAP));
var StorageService = class {
  constructor() {
    this.tokenToFileMap = /* @__PURE__ */ new Map();
    this.tempDir = import_path3.default.resolve(config.tempDir);
    this.ensureDirectory();
  }
  ensureDirectory() {
    try {
      if (!import_fs2.default.existsSync(this.tempDir)) {
        import_fs2.default.mkdirSync(this.tempDir, { recursive: true, mode: 448 });
      }
    } catch (err) {
      logger.error("Failed to create storage temporary directory", { tempDir: this.tempDir, error: err.message });
    }
  }
  getTempDir() {
    this.ensureDirectory();
    return this.tempDir;
  }
  /**
   * Creates an isolated, unique directory for a job inside tempDir.
   */
  createJobDirectory(jobId) {
    this.ensureDirectory();
    const safeJobId = jobId.replace(/[^a-zA-Z0-9_-]/g, "") || `job_${import_crypto.default.randomBytes(6).toString("hex")}`;
    const jobDir = import_path3.default.join(this.tempDir, safeJobId);
    if (!import_fs2.default.existsSync(jobDir)) {
      import_fs2.default.mkdirSync(jobDir, { recursive: true, mode: 448 });
    }
    return jobDir;
  }
  /**
   * Generates an isolated, unpredictable safe path inside a unique per-job directory.
   */
  generateSafeFilePath(jobId, ext = "mp4") {
    const jobDir = this.createJobDirectory(jobId);
    const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "mp4";
    const randomHex = import_crypto.default.randomBytes(8).toString("hex");
    const safeBaseName = `media_${randomHex}.${safeExt}`;
    const filePath = import_path3.default.join(jobDir, safeBaseName);
    const fileToken = `tok_${import_crypto.default.randomBytes(16).toString("hex")}`;
    return { filePath, fileToken, jobDir };
  }
  /**
   * Cleans up an entire job directory and associated tokens.
   */
  async cleanupJob(jobId) {
    const safeJobId = jobId.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeJobId) return;
    for (const [token, entry] of this.tokenToFileMap.entries()) {
      if (entry.jobId === safeJobId) {
        this.tokenToFileMap.delete(token);
      }
    }
    const jobDir = import_path3.default.join(this.tempDir, safeJobId);
    try {
      if (import_fs2.default.existsSync(jobDir)) {
        await import_fs2.default.promises.rm(jobDir, { recursive: true, force: true });
      }
    } catch (err) {
      logger.warn(`Could not delete job directory ${jobDir}: ${err.message}`);
    }
  }
  /**
   * Registers a validated file with a safe download token.
   */
  registerFileToken(fileToken, jobId, filePath, mimeType, filename, ttlSeconds) {
    if (this.tokenToFileMap.size > 2e3) {
      this.purgeExpiredTokens();
    }
    this.tokenToFileMap.set(fileToken, {
      filePath,
      jobId,
      mimeType,
      filename,
      expiresAt: Date.now() + ttlSeconds * 1e3
    });
  }
  getFileByToken(fileToken) {
    const entry = this.tokenToFileMap.get(fileToken);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.tokenToFileMap.delete(fileToken);
      this.deleteFileSafely(entry.filePath);
      return null;
    }
    return entry;
  }
  /**
   * Sanitizes user-facing title for Content-Disposition header.
   */
  sanitizeFilename(title, extension) {
    const base = title.replace(/[^\w\s.-]/g, "").trim().replace(/\s+/g, "_").slice(0, 80) || "media";
    const cleanExt = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "mp4";
    return `${base}.${cleanExt}`;
  }
  /**
   * Validates downloaded file: existence, non-empty, max size, extension, and magic bytes.
   */
  async validateDownloadedFile(filePath, expectedFormat) {
    const resolved = import_path3.default.resolve(filePath);
    if (!resolved.startsWith(this.tempDir)) {
      return { isValid: false, size: 0, mimeType: "", extension: "", error: "File path security violation" };
    }
    if (!import_fs2.default.existsSync(resolved)) {
      return { isValid: false, size: 0, mimeType: "", extension: "", error: "Target file does not exist" };
    }
    const stat = await import_fs2.default.promises.stat(resolved);
    if (stat.size === 0) {
      await this.deleteFileSafely(resolved);
      return { isValid: false, size: 0, mimeType: "", extension: "", error: "Downloaded file is empty (0 bytes)" };
    }
    if (stat.size > config.providers.ytdlp.maxFileSizeBytes) {
      await this.deleteFileSafely(resolved);
      return {
        isValid: false,
        size: stat.size,
        mimeType: "",
        extension: "",
        error: `File size (${Math.round(stat.size / 1024 / 1024)}MB) exceeds limit of ${config.providers.ytdlp.maxFileSize}`
      };
    }
    const ext = import_path3.default.extname(resolved).replace(".", "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      await this.deleteFileSafely(resolved);
      return { isValid: false, size: stat.size, mimeType: "", extension: ext, error: `Disallowed media extension: .${ext}` };
    }
    const mimeType = MIME_MAP[ext] || "application/octet-stream";
    const isMagicValid = await this.verifyMagicBytes(resolved, ext);
    if (!isMagicValid) {
      await this.deleteFileSafely(resolved);
      return { isValid: false, size: stat.size, mimeType, extension: ext, error: `Invalid or corrupted media file signature for .${ext}` };
    }
    return {
      isValid: true,
      size: stat.size,
      mimeType,
      extension: ext
    };
  }
  /**
   * Inspects initial file bytes to verify media container headers.
   */
  async verifyMagicBytes(filePath, ext) {
    try {
      const fd = await import_fs2.default.promises.open(filePath, "r");
      const buffer = Buffer.alloc(32);
      await fd.read(buffer, 0, 32, 0);
      await fd.close();
      if (ext === "mp4" || ext === "m4a") {
        const str = buffer.toString("utf8", 4, 12);
        return str.includes("ftyp") || buffer.slice(0, 4).toString("hex") === "00000018" || buffer.slice(0, 4).toString("hex") === "00000020";
      }
      if (ext === "webm") {
        return buffer[0] === 26 && buffer[1] === 69 && buffer[2] === 223 && buffer[3] === 163;
      }
      if (ext === "mp3") {
        const id3 = buffer.toString("utf8", 0, 3);
        if (id3 === "ID3") return true;
        if (buffer[0] === 255 && (buffer[1] & 224) === 224) return true;
        return true;
      }
      if (ext === "ogg") {
        return buffer.toString("utf8", 0, 4) === "OggS";
      }
      if (ext === "wav") {
        return buffer.toString("utf8", 0, 4) === "RIFF";
      }
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Safely removes a file from disk ensuring no directory traversal outside tempDir.
   */
  async deleteFileSafely(filePath) {
    try {
      const resolved = import_path3.default.resolve(filePath);
      if (resolved.startsWith(this.tempDir) && import_fs2.default.existsSync(resolved)) {
        await import_fs2.default.promises.unlink(resolved);
      }
    } catch (err) {
      logger.warn(`Could not delete temp file ${filePath}: ${err.message}`);
    }
  }
  /**
   * Streams file safely to response with HTTP Range header support.
   */
  serveFileWithRanges(filePath, mimeType, downloadFilename, req, res) {
    const resolved = import_path3.default.resolve(filePath);
    if (!resolved.startsWith(this.tempDir) || !import_fs2.default.existsSync(resolved)) {
      throw DownloaderError.jobNotFound("Requested media file not found or expired");
    }
    const stat = import_fs2.default.statSync(resolved);
    const fileSize = stat.size;
    const range = req.headers.range;
    res.setHeader("Content-Disposition", `attachment; filename="${downloadFilename}"`);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (start >= fileSize || end >= fileSize) {
        res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
        return;
      }
      const chunksize = end - start + 1;
      const stream = import_fs2.default.createReadStream(resolved, { start, end });
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Length": chunksize,
        "Content-Type": mimeType
      });
      stream.pipe(res);
      stream.on("error", (err) => {
        logger.error("Stream range error", { error: err.message });
      });
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": mimeType
      });
      const stream = import_fs2.default.createReadStream(resolved);
      stream.pipe(res);
      stream.on("error", (err) => {
        logger.error("Stream error", { error: err.message });
      });
    }
  }
  /**
   * Purges expired files and directories from the temporary directory.
   */
  async purgeExpiredFiles(maxAgeSeconds = config.cache.jobExpirationSeconds) {
    this.purgeExpiredTokens();
    let deletedCount = 0;
    try {
      this.ensureDirectory();
      const entries = await import_fs2.default.promises.readdir(this.tempDir, { withFileTypes: true });
      const now = Date.now();
      const maxAgeMs = maxAgeSeconds * 1e3;
      for (const entry of entries) {
        const fullPath = import_path3.default.join(this.tempDir, entry.name);
        try {
          const stat = await import_fs2.default.promises.stat(fullPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            if (entry.isDirectory()) {
              await import_fs2.default.promises.rm(fullPath, { recursive: true, force: true });
            } else {
              await import_fs2.default.promises.unlink(fullPath);
            }
            deletedCount++;
          }
        } catch {
        }
      }
    } catch (err) {
      logger.warn(`Failed during temp directory file purge: ${err.message}`);
    }
    return deletedCount;
  }
  /**
   * Cleans up all temporary storage on application shutdown.
   */
  async cleanupAllTemp() {
    try {
      this.tokenToFileMap.clear();
      if (import_fs2.default.existsSync(this.tempDir)) {
        const entries = await import_fs2.default.promises.readdir(this.tempDir);
        for (const entry of entries) {
          const fullPath = import_path3.default.join(this.tempDir, entry);
          await import_fs2.default.promises.rm(fullPath, { recursive: true, force: true }).catch(() => {
          });
        }
      }
    } catch (err) {
      logger.warn(`Failed during cleanupAllTemp: ${err.message}`);
    }
  }
  purgeExpiredTokens() {
    const now = Date.now();
    for (const [token, entry] of this.tokenToFileMap.entries()) {
      if (now > entry.expiresAt) {
        this.tokenToFileMap.delete(token);
        this.deleteFileSafely(entry.filePath);
      }
    }
  }
};
var storageService = new StorageService();

// src/providers/ytdlp/ytdlp.provider.ts
function buildYtDlpFormatSelector(options, ffmpegInfo) {
  const isAudio = options?.type === "audio";
  const requestedFormat = options?.format?.toLowerCase();
  const requestedQuality = (options?.quality || "720p").toLowerCase();
  const hasFfmpeg = typeof ffmpegInfo === "boolean" ? ffmpegInfo : Boolean(ffmpegInfo?.available);
  const extraArgs = [];
  if (isAudio) {
    if (requestedFormat === "m4a") {
      return {
        selector: "bestaudio[ext=m4a]/bestaudio/best",
        extraArgs: hasFfmpeg ? ["-x", "--audio-format", "m4a"] : []
      };
    }
    const audioFmt = requestedFormat === "wav" || requestedFormat === "ogg" || requestedFormat === "aac" ? requestedFormat : "mp3";
    return {
      selector: "bestaudio/best",
      extraArgs: hasFfmpeg ? ["-x", "--audio-format", audioFmt] : []
    };
  }
  let heightLimit = null;
  if (requestedQuality === "360p" || requestedQuality === "360") heightLimit = 360;
  else if (requestedQuality === "480p" || requestedQuality === "480") heightLimit = 480;
  else if (requestedQuality === "720p" || requestedQuality === "720") heightLimit = 720;
  else if (requestedQuality === "1080p" || requestedQuality === "1080") heightLimit = 1080;
  else if (requestedQuality.match(/^\d+p?$/)) {
    const parsed = parseInt(requestedQuality.replace(/\D/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) heightLimit = parsed;
  }
  let selector;
  if (hasFfmpeg) {
    if (heightLimit) {
      selector = `bestvideo[height<=${heightLimit}][vcodec^=avc]+bestaudio[acodec^=mp4a]/bestvideo[height<=${heightLimit}]+bestaudio/best[height<=${heightLimit}]/best`;
    } else {
      selector = "bestvideo[vcodec^=avc]+bestaudio[acodec^=mp4a]/bestvideo+bestaudio/best";
    }
    extraArgs.push("--merge-output-format", "mp4");
  } else {
    if (heightLimit) {
      selector = `best[height<=${heightLimit}][ext=mp4]/best[height<=${heightLimit}]/best`;
    } else {
      selector = "best[ext=mp4]/best";
    }
  }
  return { selector, extraArgs };
}
function parseYtDlpJson(stdout) {
  const trimmed = stdout.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    throw DownloaderError.ytdlpFailed("yt-dlp returned unparseable or non-JSON output", { raw: trimmed.slice(0, 300) });
  }
  const jsonSnippet = trimmed.slice(jsonStart, jsonEnd + 1);
  try {
    return JSON.parse(jsonSnippet);
  } catch (err) {
    throw DownloaderError.ytdlpFailed(`Failed to parse yt-dlp output JSON: ${err.message}`, {
      raw: jsonSnippet.slice(0, 300)
    });
  }
}
var YtDlpProvider = class extends BaseProvider {
  constructor() {
    super(...arguments);
    this.name = "yt-dlp";
    this.supportedPlatforms = ["youtube", "instagram", "tiktok", "facebook", "pinterest", "twitter", "reddit"];
  }
  async healthCheck() {
    if (!config.providers.ytdlp.enabled) {
      return {
        provider: this.name,
        available: false,
        statusMessage: "yt-dlp provider is disabled in configuration"
      };
    }
    const start = Date.now();
    try {
      const binary = await YtDlpBinaryManager.resolveBinary();
      const latencyMs = Date.now() - start;
      if (!binary.available || !binary.path) {
        return {
          provider: this.name,
          available: false,
          latencyMs,
          statusMessage: "YTDLP_NOT_FOUND: yt-dlp executable was not found on host system or configured path"
        };
      }
      const ffmpeg = await YtDlpBinaryManager.checkFfmpeg();
      const jsRuntime = await YtDlpBinaryManager.resolveJsRuntime();
      let available = true;
      const statusParts = [`yt-dlp v${binary.version}`];
      if (ffmpeg.available) {
        statusParts.push(`FFmpeg active (${ffmpeg.version || "detected"})`);
      } else {
        statusParts.push("FFmpeg missing");
      }
      if (jsRuntime.available && jsRuntime.isSupported) {
        statusParts.push(`JS runtime: ${jsRuntime.name} v${jsRuntime.version || "detected"}`);
      } else {
        available = false;
        statusParts.push(jsRuntime.warning || "JS runtime missing or unsupported (requires Deno 2.x or Node 22+)");
      }
      const ejsConfig = config.providers.ytdlp.remoteComponents;
      if (ejsConfig && ejsConfig !== "none") {
        statusParts.push(`EJS: ${ejsConfig}`);
      }
      return {
        provider: this.name,
        available,
        latencyMs,
        version: binary.version,
        statusMessage: statusParts.join(" | ")
      };
    } catch (err) {
      return {
        provider: this.name,
        available: false,
        latencyMs: Date.now() - start,
        statusMessage: `yt-dlp health check failed: ${err.message}`
      };
    }
  }
  async getInfo(url, options) {
    const platform = detectPlatform(url);
    if (!platform) {
      throw DownloaderError.unsupportedPlatform(`Unsupported URL for metadata extraction: ${url}`);
    }
    const binary = await YtDlpBinaryManager.resolveBinary();
    if (!binary.available) {
      throw DownloaderError.ytdlpNotFound();
    }
    const timeout = options?.timeoutMs || config.providers.ytdlp.timeoutMs;
    const jsRuntimeArgs = await YtDlpBinaryManager.getJsRuntimeArgs();
    const ejsArgs = YtDlpBinaryManager.getEjsArgs();
    const args = [
      "--dump-single-json",
      "--no-warnings",
      "--no-playlist",
      "--skip-download",
      ...jsRuntimeArgs,
      ...ejsArgs,
      "--",
      url
    ];
    const { stdout } = await YtDlpBinaryManager.executeCommand(args, timeout);
    const data = parseYtDlpJson(stdout);
    const availableQualities = [];
    const availableFormats = [];
    const formats = [];
    if (Array.isArray(data.formats)) {
      for (const fmt of data.formats) {
        const ext = String(fmt.ext || "");
        const height = typeof fmt.height === "number" ? fmt.height : void 0;
        const resolution = fmt.resolution ? String(fmt.resolution) : height ? `${height}p` : void 0;
        const note = fmt.format_note ? String(fmt.format_note) : void 0;
        const filesize = typeof fmt.filesize === "number" ? fmt.filesize : typeof fmt.filesize_approx === "number" ? fmt.filesize_approx : void 0;
        if (resolution && !availableQualities.includes(resolution)) {
          availableQualities.push(resolution);
        } else if (note && !availableQualities.includes(note)) {
          availableQualities.push(note);
        }
        if (ext && !availableFormats.includes(ext)) {
          availableFormats.push(ext);
        }
        formats.push({
          formatId: String(fmt.format_id || ""),
          ext,
          resolution,
          height,
          filesize,
          note,
          vcodec: fmt.vcodec ? String(fmt.vcodec) : void 0,
          acodec: fmt.acodec ? String(fmt.acodec) : void 0
        });
      }
    }
    const uploader = String(data.uploader || data.channel || data.creator || "Unknown");
    const title = String(data.title || "Untitled Media");
    const duration = typeof data.duration === "number" ? Math.round(data.duration) : 0;
    const thumbnail = typeof data.thumbnail === "string" ? data.thumbnail : void 0;
    const webpageUrl = typeof data.webpage_url === "string" ? data.webpage_url : url;
    return {
      id: String(data.id || "media"),
      title,
      uploader,
      author: uploader,
      thumbnail,
      duration,
      platform,
      webpageUrl,
      url: webpageUrl,
      originalUrl: url,
      availableQualities: availableQualities.slice(0, 10),
      availableFormats: availableFormats.slice(0, 8),
      formats: formats.slice(0, 25)
    };
  }
  async download(url, options) {
    const platform = detectPlatform(url);
    if (!platform) {
      throw DownloaderError.unsupportedPlatform(`Unsupported URL for download: ${url}`);
    }
    const binary = await YtDlpBinaryManager.resolveBinary();
    if (!binary.available) {
      throw DownloaderError.ytdlpNotFound();
    }
    const isAudio = options?.type === "audio";
    const requestedQuality = options?.quality || "720p";
    const requestedFormat = options?.format || (isAudio ? "mp3" : "mp4");
    const timeout = options?.timeoutMs || config.providers.ytdlp.timeoutMs;
    const jobId = options?.jobId || `job_${import_crypto2.default.randomBytes(6).toString("hex")}`;
    const jobDir = storageService.createJobDirectory(jobId);
    const outputTemplate = import_path4.default.join(jobDir, "media.%(ext)s");
    const ffmpegInfo = await YtDlpBinaryManager.checkFfmpeg();
    const { selector, extraArgs } = buildYtDlpFormatSelector(options, ffmpegInfo);
    const jsRuntimeArgs = await YtDlpBinaryManager.getJsRuntimeArgs();
    const ejsArgs = YtDlpBinaryManager.getEjsArgs();
    const args = [
      "-f",
      selector,
      "--no-playlist",
      "--no-warnings",
      ...jsRuntimeArgs,
      ...ejsArgs,
      "--max-filesize",
      config.providers.ytdlp.maxFileSize,
      "-o",
      outputTemplate,
      "--print",
      "title",
      "--print",
      "after_move:filepath",
      ...extraArgs,
      "--",
      url
    ];
    logger.info(`Executing yt-dlp download for job ${jobId}`, {
      platform,
      requestedFormat,
      requestedQuality,
      jobDir
    });
    try {
      const { stdout } = await YtDlpBinaryManager.executeCommand(args, timeout);
      const outputLines = stdout.trim().split("\n").map((l) => l.trim()).filter(Boolean);
      let parsedTitle = "Media";
      let downloadedFilePath = "";
      if (outputLines.length >= 2) {
        parsedTitle = outputLines[outputLines.length - 2];
        downloadedFilePath = outputLines[outputLines.length - 1];
      } else if (outputLines.length === 1) {
        downloadedFilePath = outputLines[0];
      }
      if (!downloadedFilePath || !import_fs3.default.existsSync(downloadedFilePath)) {
        const files = await import_fs3.default.promises.readdir(jobDir);
        const mediaFile = files.find((f) => !f.endsWith(".part") && !f.endsWith(".ytdl"));
        if (mediaFile) {
          downloadedFilePath = import_path4.default.join(jobDir, mediaFile);
        }
      }
      if (!downloadedFilePath || !import_fs3.default.existsSync(downloadedFilePath)) {
        await storageService.cleanupJob(jobId);
        throw DownloaderError.ytdlpFailed("yt-dlp finished but output media file was not found in storage");
      }
      const validation = await storageService.validateDownloadedFile(downloadedFilePath, requestedFormat);
      if (!validation.isValid) {
        await storageService.cleanupJob(jobId);
        throw DownloaderError.invalidMedia(validation.error || "Downloaded media failed validation");
      }
      try {
        const remainingFiles = await import_fs3.default.promises.readdir(jobDir);
        for (const file of remainingFiles) {
          const fullPath = import_path4.default.join(jobDir, file);
          if (fullPath !== downloadedFilePath) {
            await import_fs3.default.promises.rm(fullPath, { force: true }).catch(() => {
            });
          }
        }
      } catch {
      }
      const fileToken = `tok_${import_crypto2.default.randomBytes(16).toString("hex")}`;
      const userFilename = storageService.sanitizeFilename(parsedTitle, validation.extension);
      storageService.registerFileToken(
        fileToken,
        jobId,
        downloadedFilePath,
        validation.mimeType,
        userFilename,
        config.cache.jobExpirationSeconds
      );
      const downloadUrl = `/api/media/${fileToken}`;
      const expiresAt = new Date(Date.now() + config.cache.jobExpirationSeconds * 1e3).toISOString();
      return {
        success: true,
        platform,
        provider: this.name,
        title: parsedTitle,
        duration: 0,
        format: validation.extension,
        quality: requestedQuality,
        size: validation.size,
        mimeType: validation.mimeType,
        url: downloadUrl,
        downloadUrl,
        filePath: downloadedFilePath,
        fileToken,
        expiresAt,
        jobId
      };
    } catch (err) {
      await storageService.cleanupJob(jobId).catch(() => {
      });
      throw err;
    }
  }
  async search(query, platform) {
    if (platform !== "youtube") {
      return [];
    }
    const binary = await YtDlpBinaryManager.resolveBinary();
    if (!binary.available) {
      throw DownloaderError.ytdlpNotFound();
    }
    const cleanQuery = query.replace(/[^\w\s-]/g, "").trim();
    if (!cleanQuery) return [];
    const jsRuntimeArgs = await YtDlpBinaryManager.getJsRuntimeArgs();
    const ejsArgs = YtDlpBinaryManager.getEjsArgs();
    const args = [
      `ytsearch5:${cleanQuery}`,
      "--dump-single-json",
      "--flat-playlist",
      "--no-warnings",
      "--skip-download",
      ...jsRuntimeArgs,
      ...ejsArgs
    ];
    try {
      const { stdout } = await YtDlpBinaryManager.executeCommand(args, 15e3);
      const data = parseYtDlpJson(stdout);
      const results = [];
      if (Array.isArray(data.entries)) {
        for (const entry of data.entries) {
          if (!entry || !entry.id) continue;
          const videoId = String(entry.id);
          const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
          const title = String(entry.title || "Untitled");
          const duration = typeof entry.duration === "number" ? Math.round(entry.duration) : 0;
          const uploader = String(entry.uploader || entry.channel || "Unknown");
          results.push({
            id: videoId,
            title,
            uploader,
            author: uploader,
            duration,
            platform: "youtube",
            webpageUrl: videoUrl,
            url: videoUrl,
            originalUrl: videoUrl
          });
        }
      }
      return results;
    } catch (err) {
      logger.warn("yt-dlp search operation failed", { error: err.message });
      return [];
    }
  }
};

// src/providers/cobalt/cobalt.provider.ts
var CobaltProvider = class extends BaseProvider {
  constructor() {
    super(...arguments);
    this.name = "cobalt";
    this.supportedPlatforms = ["youtube", "instagram", "tiktok", "facebook", "pinterest", "twitter", "reddit"];
  }
  getBaseUrl() {
    const url = config.providers.cobalt.apiUrl;
    if (!url || !url.startsWith("http")) return null;
    return url.replace(/\/+$/, "");
  }
  async healthCheck() {
    if (!config.providers.cobalt.enabled) {
      return {
        provider: this.name,
        available: false,
        statusMessage: "Cobalt provider is disabled in configuration"
      };
    }
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return {
        provider: this.name,
        available: false,
        statusMessage: "COBALT_API_URL is not configured in environment"
      };
    }
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5e3);
      const headers = {
        Accept: "application/json"
      };
      const normalizedKey = this.normalizeApiKey(config.providers.cobalt.apiKey);
      if (normalizedKey) {
        headers["Authorization"] = normalizedKey;
      }
      const res = await fetch(`${baseUrl}/api/serverInfo`, {
        method: "GET",
        headers,
        signal: controller.signal
      }).catch(
        () => fetch(baseUrl, {
          method: "GET",
          headers,
          signal: controller.signal
        })
      );
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      if (res && res.ok) {
        let version = "unknown";
        try {
          const body = await res.json();
          version = body.version || body.cobalt?.version || "connected";
        } catch {
          version = "reachable";
        }
        return {
          provider: this.name,
          available: true,
          latencyMs,
          version,
          statusMessage: `Cobalt service healthy at ${baseUrl}`
        };
      }
      return {
        provider: this.name,
        available: false,
        latencyMs,
        statusMessage: `Cobalt API returned status ${res?.status ?? "unavailable"}`
      };
    } catch (err) {
      return {
        provider: this.name,
        available: false,
        statusMessage: `Cobalt connection failed: ${err.message}`
      };
    }
  }
  /**
   * Normalizes API key to ensure proper Bearer token format.
   * Accepts: "TOKEN", "Bearer TOKEN", "bearer TOKEN" (case-insensitive)
   * Returns: "Bearer TOKEN" format without duplication
   */
  normalizeApiKey(apiKey) {
    if (!apiKey) return void 0;
    const trimmed = apiKey.trim();
    const bearerPattern = /^bearer\s+/i;
    const cleanToken = trimmed.replace(bearerPattern, "").trim();
    if (!cleanToken) return void 0;
    return `Bearer ${cleanToken}`;
  }
  async getInfo(url, options) {
    const platform = detectPlatform(url);
    if (!platform) {
      throw DownloaderError.unsupportedPlatform(`Unsupported platform for URL: ${url}`);
    }
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      throw DownloaderError.cobaltUnavailable("Cobalt provider is unavailable: COBALT_API_URL is not configured.");
    }
    const result = await this.download(url, { ...options, type: "video" });
    return {
      id: Buffer.from(url).toString("base64").slice(0, 16),
      title: result.title,
      uploader: "Cobalt Media Source",
      author: "Cobalt Media Source",
      thumbnail: result.thumbnail,
      duration: result.duration,
      platform,
      url,
      webpageUrl: url,
      originalUrl: url,
      availableQualities: ["360p", "480p", "720p", "1080p", "best"],
      availableFormats: ["mp4", "mp3", "m4a", "webm"]
    };
  }
  async download(url, options) {
    const platform = detectPlatform(url);
    if (!platform) {
      throw DownloaderError.unsupportedPlatform(`Unsupported platform for URL: ${url}`);
    }
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      throw DownloaderError.cobaltUnavailable("Cobalt provider is unavailable: COBALT_API_URL is not configured.");
    }
    const timeoutMs = options?.timeoutMs || config.providers.cobalt.timeoutMs;
    const isAudio = options?.type === "audio";
    let vQuality = "720";
    if (options?.quality) {
      const match = options.quality.match(/\d+/);
      if (match) vQuality = match[0];
      if (options.quality.toLowerCase() === "best" || options.quality.toLowerCase() === "max") {
        vQuality = "max";
      }
    }
    const payload = {
      url,
      videoQuality: vQuality,
      downloadMode: isAudio ? "audio" : "auto",
      audioFormat: options?.format || "mp3"
    };
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };
    const normalizedKey = this.normalizeApiKey(config.providers.cobalt.apiKey);
    if (normalizedKey) {
      headers["Authorization"] = normalizedKey;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (response.status === 404) {
        response = await fetch(`${baseUrl}/api/json`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      }
      if (!response.ok) {
        const errorText = await response.text();
        throw DownloaderError.providerFailed(`Cobalt API error (${response.status}): ${errorText.slice(0, 200)}`);
      }
      const data = await response.json();
      let directUrl = "";
      if (data.status === "stream" || data.status === "tunnel" || data.status === "redirect") {
        directUrl = data.url;
      } else if (data.status === "picker" && Array.isArray(data.picker) && data.picker[0]) {
        directUrl = data.picker[0].url;
      } else if (data.url) {
        directUrl = data.url;
      }
      if (!directUrl) {
        const errMsg = data.error?.code || data.text || data.message || "Cobalt returned no media stream URL";
        throw DownloaderError.providerFailed(`Cobalt error: ${errMsg}`);
      }
      const cleanTitle = data.filename || `media_${platform}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1e3).toISOString();
      return {
        success: true,
        platform,
        provider: this.name,
        title: cleanTitle,
        thumbnail: void 0,
        duration: 0,
        format: options?.format || (isAudio ? "mp3" : "mp4"),
        quality: options?.quality || `${vQuality}p`,
        url: directUrl,
        downloadUrl: directUrl,
        expiresAt,
        jobId: options?.jobId || "",
        metadata: {
          cobaltStatus: data.status
        }
      };
    } catch (err) {
      if (err.name === "AbortError") {
        throw DownloaderError.timeout(`Cobalt request timed out after ${timeoutMs}ms`);
      }
      if (err instanceof DownloaderError) throw err;
      throw DownloaderError.providerFailed(`Cobalt failed: ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
};

// src/providers/external/external.provider.ts
var ExternalApiProvider = class extends BaseProvider {
  constructor() {
    super(...arguments);
    this.name = "external-api";
    this.supportedPlatforms = ["youtube", "instagram", "tiktok", "facebook", "pinterest", "twitter", "reddit"];
  }
  getBaseUrl() {
    const url = config.providers.external.apiUrl;
    if (!url || !url.startsWith("http")) return null;
    return url.replace(/\/+$/, "");
  }
  /**
   * Normalizes API key to ensure proper Bearer token format.
   * Accepts: "TOKEN", "Bearer TOKEN", "bearer TOKEN" (case-insensitive)
   * Returns: "Bearer TOKEN" format without duplication
   */
  normalizeApiKey(apiKey) {
    if (!apiKey) return void 0;
    const trimmed = apiKey.trim();
    const bearerPattern = /^bearer\s+/i;
    const cleanToken = trimmed.replace(bearerPattern, "").trim();
    if (!cleanToken) return void 0;
    return `Bearer ${cleanToken}`;
  }
  async healthCheck() {
    if (!config.providers.external.enabled) {
      return {
        provider: this.name,
        available: false,
        statusMessage: "External API provider is disabled in configuration"
      };
    }
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return {
        provider: this.name,
        available: false,
        statusMessage: "EXTERNAL_API_URL is not configured in environment"
      };
    }
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5e3);
      const headers = {
        Accept: "application/json"
      };
      const normalizedKey = this.normalizeApiKey(config.providers.external.apiKey);
      if (normalizedKey) {
        headers[config.providers.external.apiHeader] = normalizedKey;
      }
      const res = await fetch(`${baseUrl}/health`, {
        method: "GET",
        headers,
        signal: controller.signal
      }).catch(
        () => fetch(baseUrl, {
          method: "GET",
          headers,
          signal: controller.signal
        })
      );
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      if (res && res.ok) {
        return {
          provider: this.name,
          available: true,
          latencyMs,
          statusMessage: `External API service reachable at ${baseUrl}`
        };
      }
      return {
        provider: this.name,
        available: false,
        latencyMs,
        statusMessage: `External API returned status ${res?.status ?? "unavailable"}`
      };
    } catch (err) {
      return {
        provider: this.name,
        available: false,
        statusMessage: `External API unreachable: ${err.message}`
      };
    }
  }
  async getInfo(url, options) {
    const platform = detectPlatform(url);
    if (!platform) {
      throw DownloaderError.unsupportedPlatform(`Unsupported platform for URL: ${url}`);
    }
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      throw DownloaderError.externalApiUnavailable("External API provider is not configured (EXTERNAL_API_URL missing).");
    }
    const timeoutMs = options?.timeoutMs || config.providers.external.timeoutMs;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };
    const normalizedKey = this.normalizeApiKey(config.providers.external.apiKey);
    if (normalizedKey) {
      headers[config.providers.external.apiHeader] = normalizedKey;
    }
    try {
      const res = await fetch(`${baseUrl}/info`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url }),
        signal: controller.signal
      });
      if (!res.ok) {
        throw DownloaderError.providerFailed(`External API info error: ${res.status}`);
      }
      const data = await res.json();
      const uploader = data.author || data.creator || data.uploader || "Creator";
      return {
        id: data.id || Buffer.from(url).toString("base64").slice(0, 16),
        title: data.title || "Untitled Media",
        uploader,
        author: uploader,
        thumbnail: data.thumbnail,
        duration: data.duration || 0,
        platform,
        url,
        webpageUrl: url,
        originalUrl: url,
        availableQualities: data.qualities || ["720p", "1080p"],
        availableFormats: data.formats || ["mp4", "mp3"]
      };
    } catch (err) {
      if (err.name === "AbortError") {
        throw DownloaderError.timeout(`External API request timed out after ${timeoutMs}ms`);
      }
      if (err instanceof DownloaderError) throw err;
      throw DownloaderError.providerFailed(`External API failed: ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
  async download(url, options) {
    const platform = detectPlatform(url);
    if (!platform) {
      throw DownloaderError.unsupportedPlatform(`Unsupported platform for URL: ${url}`);
    }
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      throw DownloaderError.externalApiUnavailable("External API provider is not configured (EXTERNAL_API_URL missing).");
    }
    const timeoutMs = options?.timeoutMs || config.providers.external.timeoutMs;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };
    const normalizedKey = this.normalizeApiKey(config.providers.external.apiKey);
    if (normalizedKey) {
      headers[config.providers.external.apiHeader] = normalizedKey;
    }
    try {
      const res = await fetch(`${baseUrl}/download`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url }),
        signal: controller.signal
      });
      if (!res.ok) {
        const errText = await res.text();
        throw DownloaderError.providerFailed(`External API download error (${res.status}): ${errText.slice(0, 200)}`);
      }
      const data = await res.json();
      const mediaUrl = data.url || data.downloadUrl || data.mediaUrl;
      if (!mediaUrl) {
        throw DownloaderError.providerFailed("External API response did not contain a valid media URL");
      }
      const cleanTitle = data.title || `Media from ${platform}`;
      return {
        success: true,
        platform,
        provider: this.name,
        title: cleanTitle,
        thumbnail: data.thumbnail,
        duration: data.duration || 0,
        format: options?.format || data.format || "mp4",
        quality: options?.quality || data.quality || "720p",
        url: mediaUrl,
        downloadUrl: mediaUrl,
        expiresAt: data.expiresAt || new Date(Date.now() + 3600 * 1e3).toISOString(),
        jobId: options?.jobId || "",
        metadata: data.metadata || {}
      };
    } catch (err) {
      if (err.name === "AbortError") {
        throw DownloaderError.timeout(`External API request timed out after ${timeoutMs}ms`);
      }
      if (err instanceof DownloaderError) throw err;
      throw DownloaderError.providerFailed(`External API failed: ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
};

// src/services/pinterest/pinterest-api.service.ts
var import_node_crypto = __toESM(require("node:crypto"), 1);
var PinterestApiService = class {
  constructor() {
    this.oauthStates = /* @__PURE__ */ new Map();
  }
  isConfigured() {
    return Boolean(config.pinterest.enabled && config.pinterest.clientId && config.pinterest.clientSecret && config.pinterest.redirectUri);
  }
  getAuthorizationUrl() {
    if (!this.isConfigured()) throw new Error("Pinterest OAuth is not configured. Set PINTEREST_ENABLED, PINTEREST_CLIENT_ID, PINTEREST_CLIENT_SECRET and PINTEREST_REDIRECT_URI.");
    const state = import_node_crypto.default.randomBytes(24).toString("hex");
    this.oauthStates.set(state, { value: state, expiresAt: Date.now() + 10 * 60 * 1e3 });
    const url = new URL(config.pinterest.oauthBaseUrl);
    url.searchParams.set("client_id", config.pinterest.clientId);
    url.searchParams.set("redirect_uri", config.pinterest.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", config.pinterest.scopes.join(","));
    url.searchParams.set("state", state);
    return url.toString();
  }
  consumeState(state) {
    const entry = this.oauthStates.get(state);
    this.oauthStates.delete(state);
    return Boolean(entry && entry.expiresAt > Date.now() && entry.value === state);
  }
  async exchangeCode(code) {
    const credentials = Buffer.from(`${config.pinterest.clientId}:${config.pinterest.clientSecret}`).toString("base64");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.pinterest.timeoutMs);
    try {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.pinterest.redirectUri,
        continuous_refresh: "true"
      });
      const response = await fetch(`${config.pinterest.apiBaseUrl}/oauth/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body,
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`Pinterest OAuth token exchange failed (${response.status}): ${JSON.stringify(data)}`);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }
  extractPinId(url) {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/pin\/(\d+)/i);
      return match?.[1] || null;
    } catch {
      return null;
    }
  }
  async getPin(pinId, accessToken = config.pinterest.accessToken) {
    if (!accessToken) throw new Error("No Pinterest access token configured.");
    if (!/^\d+$/.test(pinId)) throw new Error("Invalid Pinterest Pin ID.");
    return this.apiRequest(`/pins/${encodeURIComponent(pinId)}`, accessToken);
  }
  async resolvePinMedia(url) {
    const pinId = this.extractPinId(url);
    if (!pinId) throw new Error("Pinterest Official API requires a numeric /pin/<id> URL.");
    if (!config.pinterest.accessToken) throw new Error("No Pinterest access token configured.");
    const pin = await this.getPin(pinId);
    const media = pin?.media || {};
    const mediaType = String(media.media_type || "").toLowerCase();
    if (mediaType === "video") {
      const videos = media.videos || {};
      const candidates = Object.values(videos);
      const video = candidates.filter((v) => v && typeof v.url === "string").sort((a, b) => Number(b.width || 0) * Number(b.height || 0) - Number(a.width || 0) * Number(a.height || 0))[0];
      const videoUrl = pin.video_url || video?.url;
      if (videoUrl) {
        return {
          pin,
          mediaUrl: videoUrl,
          thumbnail: pin.image_signature ? void 0 : this.extractImageUrl(media),
          isVideo: true
        };
      }
      throw new Error("Pinterest API did not return an accessible video URL. pins:read is required and Pinterest may restrict video_url access.");
    }
    const imageUrl = this.extractImageUrl(media);
    if (!imageUrl) throw new Error("Pinterest API did not return an accessible image URL.");
    return { pin, mediaUrl: imageUrl, thumbnail: imageUrl, isVideo: false };
  }
  extractImageUrl(media) {
    const images = media?.images || {};
    const candidates = Object.values(images);
    const valid = candidates.filter((v) => v && typeof v.url === "string").sort((a, b) => Number(b.width || 0) * Number(b.height || 0) - Number(a.width || 0) * Number(a.height || 0));
    return valid[0]?.url;
  }
  async getUserAccount(accessToken = config.pinterest.accessToken) {
    if (!accessToken) throw new Error("No Pinterest access token configured.");
    return this.apiRequest("/user_account", accessToken);
  }
  async listPins(accessToken = config.pinterest.accessToken, bookmark) {
    if (!accessToken) throw new Error("No Pinterest access token configured.");
    const path7 = bookmark ? `/pins?bookmark=${encodeURIComponent(bookmark)}` : "/pins";
    return this.apiRequest(path7, accessToken);
  }
  async refreshAccessToken() {
    if (!config.pinterest.refreshToken) throw new Error("No Pinterest refresh token configured.");
    const credentials = Buffer.from(`${config.pinterest.clientId}:${config.pinterest.clientSecret}`).toString("base64");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.pinterest.timeoutMs);
    try {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.pinterest.refreshToken,
        continuous_refresh: "true"
      });
      const response = await fetch(`${config.pinterest.apiBaseUrl}/oauth/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body,
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Pinterest token refresh failed (${response.status}): ${JSON.stringify(data)}`);
      const token = data;
      if (token.access_token) config.pinterest.accessToken = token.access_token;
      if (token.refresh_token) config.pinterest.refreshToken = token.refresh_token;
      return token;
    } finally {
      clearTimeout(timer);
    }
  }
  async apiRequest(path7, accessToken, allowRefresh = true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.pinterest.timeoutMs);
    try {
      const response = await fetch(`${config.pinterest.apiBaseUrl}${path7}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json"
        },
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 && allowRefresh && config.pinterest.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed.access_token) return this.apiRequest(path7, refreshed.access_token, false);
      }
      if (!response.ok) {
        throw new Error(`Pinterest API request failed (${response.status}): ${JSON.stringify(data)}`);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }
};
var pinterestApiService = new PinterestApiService();

// src/providers/pinterest/pinterest.provider.ts
var PinterestProvider = class extends BaseProvider {
  constructor() {
    super(...arguments);
    this.name = "pinterest-api";
    this.supportedPlatforms = ["pinterest"];
  }
  isSupported(url) {
    return Boolean(
      config.pinterest.enabled && config.pinterest.downloadFallbackEnabled && config.pinterest.accessToken && pinterestApiService.extractPinId(url) && super.isSupported(url)
    );
  }
  async healthCheck() {
    if (!config.pinterest.enabled || !config.pinterest.downloadFallbackEnabled) {
      return { provider: this.name, available: false, statusMessage: "Pinterest official API fallback is disabled" };
    }
    if (!config.pinterest.accessToken) {
      return { provider: this.name, available: false, statusMessage: "Pinterest API enabled but no access token is configured" };
    }
    if (!pinterestApiService.extractPinId("https://www.pinterest.com/pin/123456789/")) {
      return { provider: this.name, available: false, statusMessage: "Pinterest Pin URL parser unavailable" };
    }
    return { provider: this.name, available: true, statusMessage: "Pinterest official API fallback configured" };
  }
  async getInfo(url, _options) {
    const platform = detectPlatform(url);
    if (platform !== "pinterest") throw DownloaderError.unsupportedPlatform(`Unsupported platform for Pinterest API: ${url}`);
    try {
      const resolved = await pinterestApiService.resolvePinMedia(url);
      const pin = resolved.pin || {};
      return {
        id: pin.id || Buffer.from(url).toString("base64").slice(0, 16),
        title: pin.title || pin.description || "Pinterest Pin",
        thumbnail: resolved.thumbnail,
        duration: resolved.isVideo ? Number(pin.media?.videos?.duration || 0) : 0,
        author: pin.board_owner?.username || pin.pinner?.username,
        uploader: pin.board_owner?.username || pin.pinner?.username,
        platform: "pinterest",
        availableQualities: resolved.isVideo ? ["best"] : ["original"],
        availableFormats: [resolved.isVideo ? "mp4" : "jpg"],
        url: resolved.mediaUrl,
        webpageUrl: url,
        originalUrl: url
      };
    } catch (err) {
      if (err instanceof DownloaderError) throw err;
      throw DownloaderError.providerFailed(`Pinterest Official API failed: ${err.message}`);
    }
  }
  async download(url, options) {
    const platform = detectPlatform(url);
    if (platform !== "pinterest") throw DownloaderError.unsupportedPlatform(`Unsupported platform for Pinterest API: ${url}`);
    try {
      const resolved = await pinterestApiService.resolvePinMedia(url);
      const pin = resolved.pin || {};
      const isAudio = options?.type === "audio";
      if (isAudio) throw DownloaderError.providerFailed("Pinterest Official API does not provide an audio conversion path.");
      const format = resolved.isVideo ? "mp4" : "jpg";
      return {
        success: true,
        platform: "pinterest",
        provider: this.name,
        title: pin.title || pin.description || "Pinterest Pin",
        thumbnail: resolved.thumbnail,
        duration: 0,
        format,
        quality: options?.quality || (resolved.isVideo ? "best" : "original"),
        url: resolved.mediaUrl,
        downloadUrl: resolved.mediaUrl,
        expiresAt: new Date(Date.now() + 30 * 60 * 1e3).toISOString(),
        jobId: options?.jobId || "",
        metadata: {
          pinterestPinId: pin.id,
          source: "official-pinterest-api",
          mediaType: resolved.isVideo ? "video" : "image"
        }
      };
    } catch (err) {
      if (err instanceof DownloaderError) throw err;
      throw DownloaderError.providerFailed(`Pinterest Official API download failed: ${err.message}`);
    }
  }
};

// src/services/pinterest-search/pinterest-search.service.ts
var SEARCH_BASE_URL = "https://www.pinterest.com/search/pins/";
var REQUEST_TIMEOUT_MS = 15e3;
function decodePinterestUrl(value) {
  return value.replace(/\\u002F/g, "/").replace(/\\\//g, "/").replace(/\\u003D/g, "=").replace(/&amp;/g, "&").replace(/\\u0026/g, "&").replace(/\\u003F/g, "?");
}
function normalizeImageUrl(value) {
  const decoded = decodePinterestUrl(value).trim();
  if (!/^https?:\/\//i.test(decoded)) return null;
  if (!/(?:pinimg\.com|pinterest\.com)/i.test(decoded)) return null;
  if (!/\.(?:jpe?g|png|webp|gif)(?:[?#]|$)/i.test(decoded) && !/pinimg\.com/i.test(decoded)) return null;
  return decoded.replace(/\\u0026/g, "&");
}
function collectUrls(html) {
  const candidates = /* @__PURE__ */ new Set();
  const normalizedHtml = html.replace(/\\\//g, "/").replace(/\\u002F/gi, "/").replace(/\\u003A/gi, ":").replace(/\\u003D/gi, "=").replace(/\\u0026/gi, "&");
  const urlPattern = /https?:\/\/[^"'\\\s<>]+/gi;
  for (const match of normalizedHtml.matchAll(urlPattern)) {
    const value = normalizeImageUrl(match[0]);
    if (value) candidates.add(value);
  }
  return [...candidates];
}
var PinterestSearchService = class {
  async search(query, type = "i", limit = 3) {
    const cleanQuery = query.trim();
    if (!cleanQuery) throw new Error("Pinterest search query cannot be empty");
    const finalQuery = type === "s" ? `${cleanQuery} sticker` : cleanQuery;
    const url = `${SEARCH_BASE_URL}?q=${encodeURIComponent(finalQuery)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });
      if (!response.ok) {
        throw new Error(`Pinterest search returned HTTP ${response.status}`);
      }
      const html = await response.text();
      const urls = collectUrls(html);
      const unique = [...new Set(urls)].slice(0, Math.min(Math.max(limit, 1), 25));
      if (!unique.length) {
        throw new Error("Pinterest returned no public search images");
      }
      return unique.map((imageUrl, index) => ({
        id: `pinterest-search-${index + 1}`,
        title: cleanQuery,
        url: imageUrl,
        webpageUrl: url,
        thumbnail: imageUrl,
        platform: "pinterest",
        author: "Pinterest"
      }));
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Pinterest search timed out");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
};
var pinterestSearchService = new PinterestSearchService();

// src/services/provider-manager/provider-manager.service.ts
var ProviderManager = class {
  constructor() {
    this.providers = /* @__PURE__ */ new Map();
    this.registerProvider(new YtDlpProvider());
    this.registerProvider(new CobaltProvider());
    this.registerProvider(new ExternalApiProvider());
    this.registerProvider(new PinterestProvider());
  }
  registerProvider(provider) {
    this.providers.set(provider.name.toLowerCase(), provider);
    logger.info(`Registered media downloader provider: ${provider.name}`);
  }
  getProvider(name) {
    return this.providers.get(name.toLowerCase());
  }
  getAllProviders() {
    return Array.from(this.providers.values());
  }
  /**
   * Resolves eligible providers for a URL ordered by configured priority (yt-dlp -> cobalt -> external-api).
   */
  getOrderedProvidersForUrl(url) {
    const platform = detectPlatform(url);
    if (!platform) return [];
    const available = this.getAllProviders().filter((p) => p.isSupported(url));
    const priorityList = config.providers.priority.map((p) => {
      const lower = p.toLowerCase();
      if (lower === "ytdlp" || lower === "yt-dlp") return "yt-dlp";
      if (lower === "external" || lower === "external-api") return "external-api";
      if (lower === "pinterest" || lower === "pinterest-api" || lower === "official-pinterest") return "pinterest-api";
      return lower;
    });
    return available.sort((a, b) => {
      const idxA = priorityList.indexOf(a.name.toLowerCase());
      const idxB = priorityList.indexOf(b.name.toLowerCase());
      const rankA = idxA === -1 ? 999 : idxA;
      const rankB = idxB === -1 ? 999 : idxB;
      return rankA - rankB;
    });
  }
  /**
   * Fetches media info by trying providers in priority order with deterministic fallback.
   */
  async getInfo(url, options) {
    const platform = detectPlatform(url);
    if (!platform) {
      throw DownloaderError.unsupportedPlatform(
        "Unsupported URL. Valid platforms are: YouTube, Instagram, TikTok, Facebook, Pinterest, X/Twitter, Reddit."
      );
    }
    const orderedProviders = this.getOrderedProvidersForUrl(url);
    if (orderedProviders.length === 0) {
      throw DownloaderError.providerUnavailable(`No downloader providers configured to handle platform: ${platform}`);
    }
    const failureLogs = [];
    for (const provider of orderedProviders) {
      const start = Date.now();
      try {
        logger.info(`Attempting info extraction with provider: ${provider.name} for ${platform}`);
        const info = await provider.getInfo(url, options);
        const duration = Date.now() - start;
        await db.recordProviderCall(provider.name, true, duration);
        return { info, providerUsed: provider.name };
      } catch (err) {
        const duration = Date.now() - start;
        const error = err;
        const msg = error.message;
        logger.warn(`Provider ${provider.name} failed getInfo`, {
          provider: provider.name,
          error: msg,
          code: error.code
        });
        await db.recordProviderCall(provider.name, false, duration, msg);
        if (error instanceof DownloaderError && (error.code === "INVALID_URL" || error.code === "UNSUPPORTED_PLATFORM")) {
          throw error;
        }
        failureLogs.push({ provider: provider.name, error: msg, code: error.code });
      }
    }
    const summary = failureLogs.map((f) => `${f.provider}: ${f.error}`).join(" | ");
    throw DownloaderError.providerFailed(`All providers failed to extract media info. (${summary})`, {
      attempts: failureLogs
    });
  }
  /**
   * Executes download by trying providers in priority order with deterministic fallback.
   */
  async download(url, options) {
    const platform = detectPlatform(url);
    if (!platform) {
      throw DownloaderError.unsupportedPlatform(
        "Unsupported URL. Valid platforms are: YouTube, Instagram, TikTok, Facebook, Pinterest, X/Twitter, Reddit."
      );
    }
    const orderedProviders = this.getOrderedProvidersForUrl(url);
    if (orderedProviders.length === 0) {
      throw DownloaderError.providerUnavailable(`No providers available for platform: ${platform}`);
    }
    const failureLogs = [];
    for (const provider of orderedProviders) {
      const start = Date.now();
      try {
        logger.info(`Attempting download with provider: ${provider.name} for ${platform}`);
        const result = await provider.download(url, options);
        const duration = Date.now() - start;
        await db.recordProviderCall(provider.name, true, duration);
        result.provider = provider.name;
        result.platform = platform;
        return result;
      } catch (err) {
        const duration = Date.now() - start;
        const error = err;
        const msg = error.message;
        logger.warn(`Provider ${provider.name} failed download`, {
          provider: provider.name,
          error: msg,
          code: error.code
        });
        await db.recordProviderCall(provider.name, false, duration, msg);
        if (error instanceof DownloaderError && (error.code === "INVALID_URL" || error.code === "UNSUPPORTED_PLATFORM")) {
          throw error;
        }
        failureLogs.push({ provider: provider.name, error: msg, code: error.code });
      }
    }
    const summary = failureLogs.map((f) => `${f.provider}: ${f.error}`).join(" | ");
    throw DownloaderError.providerFailed(`All providers failed to download media. (${summary})`, {
      attempts: failureLogs
    });
  }
  /**
   * Runs health checks across all registered providers.
   */
  async checkAllHealth() {
    const results = [];
    for (const provider of this.getAllProviders()) {
      try {
        const health = await provider.healthCheck();
        results.push(health);
        await db.updateProviderStatus(provider.name, {
          isAvailable: health.available,
          supportedPlatforms: provider.supportedPlatforms,
          lastError: health.available ? void 0 : health.statusMessage
        });
      } catch (err) {
        results.push({
          provider: provider.name,
          available: false,
          statusMessage: err.message
        });
      }
    }
    return results;
  }
  /**
   * Multi-provider search (YouTube via yt-dlp).
   */
  async search(query, platform) {
    if (platform === "pinterest") {
      const type = /\bsticker\b/i.test(query) ? "s" : "i";
      const cleanQuery = query.replace(/\bsticker\b/ig, " ").replace(/\s+/g, " ").trim();
      try {
        return await pinterestSearchService.search(cleanQuery || query, type, 25);
      } catch {
      }
    }
    for (const provider of this.getAllProviders()) {
      if (typeof provider.search === "function") {
        try {
          const items = await provider.search(query, platform);
          if (items && items.length > 0) {
            return items;
          }
        } catch {
        }
      }
    }
    return [];
  }
};
var providerManager = new ProviderManager();

// src/services/cache/cache.service.ts
var import_crypto3 = __toESM(require("crypto"), 1);
var CacheService = class {
  constructor() {
    this.enabled = config.cache.enabled;
    this.defaultTtl = config.cache.ttlSeconds;
  }
  generateKey(prefix, identifier) {
    const raw = typeof identifier === "string" ? identifier : JSON.stringify(identifier);
    const hash = import_crypto3.default.createHash("sha256").update(raw).digest("hex").slice(0, 16);
    return `${prefix}:${hash}`;
  }
  async get(key) {
    if (!this.enabled) return null;
    try {
      const entry = await db.getCache(key);
      if (!entry) return null;
      return entry.value;
    } catch (err) {
      logger.warn(`Cache get failed for key ${key}: ${err.message}`);
      return null;
    }
  }
  async set(key, value, ttlSeconds = this.defaultTtl) {
    if (!this.enabled) return;
    try {
      await db.setCache(key, value, ttlSeconds);
    } catch (err) {
      logger.warn(`Cache set failed for key ${key}: ${err.message}`);
    }
  }
  async delete(key) {
    try {
      return await db.deleteCache(key);
    } catch {
      return false;
    }
  }
  async cleanupExpired() {
    try {
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      return await db.deleteExpiredCache(nowIso);
    } catch (err) {
      logger.error(`Cache cleanup failed: ${err.message}`);
      return 0;
    }
  }
  async getStats() {
    const stats = await db.getCacheStats();
    return {
      ...stats,
      enabled: this.enabled
    };
  }
};
var cacheService = new CacheService();

// src/utils/ssrf.ts
var import_url = require("url");
var BLOCKED_HOSTS = /* @__PURE__ */ new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "::",
  "metadata.google.internal",
  "169.254.169.254",
  "169.254.170.2",
  "100.100.100.200",
  "instance-data"
]);
var BLOCKED_DOMAINS = [
  ".local",
  ".internal",
  ".localhost",
  ".lan",
  ".home",
  ".corp",
  ".intranet",
  ".arpa"
];
function isPrivateIpv4(octets) {
  const [a, b] = octets;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}
function parseIpv4Octets(hostname) {
  if (/^\d+$/.test(hostname)) {
    const num = parseInt(hostname, 10);
    if (!isNaN(num) && num >= 0 && num <= 4294967295) {
      return [num >>> 24 & 255, num >>> 16 & 255, num >>> 8 & 255, num & 255];
    }
  }
  if (/^0x[0-9a-fA-F]+$/.test(hostname)) {
    const num = parseInt(hostname, 16);
    if (!isNaN(num) && num >= 0 && num <= 4294967295) {
      return [num >>> 24 & 255, num >>> 16 & 255, num >>> 8 & 255, num & 255];
    }
  }
  const parts = hostname.split(".");
  if (parts.length === 4) {
    const octets = [];
    for (const p of parts) {
      let val;
      if (p.startsWith("0x") || p.startsWith("0X")) {
        val = parseInt(p, 16);
      } else if (p.length > 1 && p.startsWith("0")) {
        val = parseInt(p, 8);
      } else if (/^\d+$/.test(p)) {
        val = parseInt(p, 10);
      } else {
        return null;
      }
      if (isNaN(val) || val < 0 || val > 255) return null;
      octets.push(val);
    }
    return octets;
  }
  return null;
}
function isSafeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { safe: false, reason: "URL is required and must be a string" };
  }
  let parsed;
  try {
    parsed = new import_url.URL(rawUrl);
  } catch {
    return { safe: false, reason: "Invalid URL syntax" };
  }
  if (/[\0\r\n`$<>|]/.test(rawUrl) || /;.*(\s|rm|bash|sh|exec)/i.test(rawUrl) || /;$/.test(rawUrl.trim())) {
    return { safe: false, reason: "URL contains illegal or dangerous characters" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: `Unsupported protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.` };
  }
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    return { safe: false, reason: `Port ${parsed.port} is not permitted. Only standard HTTP/HTTPS ports are allowed.` };
  }
  const rawHostname = parsed.hostname.toLowerCase();
  const hostname = rawHostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(hostname) || BLOCKED_HOSTS.has(rawHostname)) {
    return { safe: false, reason: "URL targets restricted or private infrastructure" };
  }
  for (const suffix of BLOCKED_DOMAINS) {
    if (hostname.endsWith(suffix)) {
      return { safe: false, reason: `URL targets restricted local domain: ${suffix}` };
    }
  }
  if (hostname === "::1" || hostname === "::" || hostname.startsWith("fe80:") || hostname.startsWith("fc00:") || hostname.startsWith("fd00:") || hostname.startsWith("::ffff:")) {
    return { safe: false, reason: "URL resolves to private/restricted IPv6 address range" };
  }
  const octets = parseIpv4Octets(hostname);
  if (octets) {
    if (isPrivateIpv4(octets)) {
      return { safe: false, reason: "URL resolves to private or restricted network range" };
    }
  }
  return { safe: true };
}

// src/utils/url-validator.ts
function validateMediaUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { isValid: false, error: "A valid URL string is required." };
  }
  const trimmed = rawUrl.trim();
  const safeCheck = isSafeUrl(trimmed);
  if (!safeCheck.safe) {
    return { isValid: false, error: safeCheck.reason || "Restricted or invalid URL." };
  }
  const platform = detectPlatform(trimmed);
  if (!platform) {
    return {
      isValid: false,
      error: "Unsupported platform. Supported platforms: YouTube, Instagram, TikTok, Facebook, Pinterest, X/Twitter, Reddit."
    };
  }
  return {
    isValid: true,
    platform,
    normalizedUrl: trimmed
  };
}

// src/services/download/download.service.ts
var DownloadService = class {
  constructor() {
    this.activeDownloads = 0;
    this.queue = [];
  }
  /**
   * Extracts media information with caching.
   */
  async getMediaInfo(url, options) {
    const validation = validateMediaUrl(url);
    if (!validation.isValid || !validation.normalizedUrl) {
      if (validation.error?.toLowerCase().includes("unsupported platform")) {
        throw DownloaderError.unsupportedPlatform(validation.error);
      }
      throw DownloaderError.invalidUrl(validation.error || "Invalid URL supplied.");
    }
    const cleanUrl = validation.normalizedUrl;
    const cacheKey = cacheService.generateKey("info", { url: cleanUrl });
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.info(`Returning cached media info for ${cleanUrl}`);
      return cached;
    }
    const result = await providerManager.getInfo(cleanUrl, options);
    const combined = { ...result.info, providerUsed: result.providerUsed };
    await cacheService.set(cacheKey, combined, config.cache.ttlSeconds);
    return combined;
  }
  /**
   * Creates an asynchronous download job and kicks off queue processing.
   */
  async createDownloadJob(url, options = {}, userId) {
    const validation = validateMediaUrl(url);
    if (!validation.isValid || !validation.normalizedUrl || !validation.platform) {
      if (validation.error?.toLowerCase().includes("unsupported platform")) {
        throw DownloaderError.unsupportedPlatform(validation.error);
      }
      throw DownloaderError.invalidUrl(validation.error || "Invalid URL supplied for download.");
    }
    const cleanUrl = validation.normalizedUrl;
    const platform = validation.platform;
    const cacheKey = cacheService.generateKey("download", {
      url: cleanUrl,
      type: options.type || "video",
      quality: options.quality || "720p",
      format: options.format || "mp4"
    });
    const cachedResult = await cacheService.get(cacheKey);
    if (cachedResult && new Date(cachedResult.expiresAt).getTime() > Date.now()) {
      logger.info(`Returning cached download job for ${cleanUrl}`);
      const jobId2 = cachedResult.jobId || `job_${import_crypto4.default.randomBytes(8).toString("hex")}`;
      const now2 = (/* @__PURE__ */ new Date()).toISOString();
      const job2 = {
        id: jobId2,
        userId,
        sourceUrl: cleanUrl,
        platform,
        provider: cachedResult.provider,
        status: "completed",
        title: cachedResult.title,
        mediaUrl: cachedResult.url,
        downloadUrl: cachedResult.downloadUrl || cachedResult.url,
        fileToken: cachedResult.fileToken,
        filePath: cachedResult.filePath,
        format: cachedResult.format,
        quality: cachedResult.quality,
        size: cachedResult.size,
        mimeType: cachedResult.mimeType,
        progress: null,
        createdAt: now2,
        expiresAt: cachedResult.expiresAt
      };
      await db.saveJob(job2);
      return job2;
    }
    const jobId = `job_${import_crypto4.default.randomBytes(8).toString("hex")}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const expiresAt = new Date(Date.now() + config.cache.jobExpirationSeconds * 1e3).toISOString();
    const job = {
      id: jobId,
      userId,
      sourceUrl: cleanUrl,
      platform,
      provider: "pending",
      status: "queued",
      progress: null,
      format: options.format || (options.type === "audio" ? "mp3" : "mp4"),
      quality: options.quality || "720p",
      createdAt: now,
      expiresAt
    };
    await db.saveJob(job);
    this.queue.push({
      jobId,
      url: cleanUrl,
      options: { ...options, jobId },
      userId
    });
    setImmediate(() => this.processNextQueueItem());
    return job;
  }
  /**
   * Processes the job queue while respecting concurrency limits.
   */
  async processNextQueueItem() {
    if (this.activeDownloads >= config.maxConcurrentDownloads) {
      return;
    }
    const task = this.queue.shift();
    if (!task) {
      return;
    }
    this.activeDownloads++;
    const { jobId, url, options, userId } = task;
    try {
      await db.updateJobStatus(jobId, "processing", {
        provider: "active",
        progress: null
      });
      logger.info(`Starting execution for download job ${jobId} (Active: ${this.activeDownloads})`);
      const result = await providerManager.download(url, { ...options, jobId });
      const completedData = {
        status: "completed",
        provider: result.provider,
        title: result.title,
        thumbnail: result.thumbnail,
        duration: result.duration,
        format: result.format,
        quality: result.quality,
        size: result.size,
        mimeType: result.mimeType,
        mediaUrl: result.url,
        downloadUrl: result.downloadUrl || result.url,
        fileToken: result.fileToken,
        filePath: result.filePath,
        expiresAt: result.expiresAt,
        progress: null,
        metadata: result.metadata
      };
      await db.updateJobStatus(jobId, "completed", completedData);
      const cacheKey = cacheService.generateKey("download", {
        url,
        type: options.type || "video",
        quality: options.quality || "720p",
        format: options.format || "mp4"
      });
      await cacheService.set(cacheKey, result, config.cache.ttlSeconds);
      if (task.resolve) task.resolve(result);
    } catch (err) {
      const error = err;
      logger.error(`Download job ${jobId} failed: ${error.message}`, {
        jobId,
        code: error.code
      });
      if (options.jobId) {
        const tempFiles = await storageService.purgeExpiredFiles(0);
        logger.debug(`Cleaned up temp files for failed job: ${tempFiles}`);
      }
      await db.updateJobStatus(jobId, "failed", {
        error: error.message || "Download operation failed",
        errorCode: error.code || "PROVIDER_FAILED",
        progress: null
      });
      if (task.reject) task.reject(error);
    } finally {
      this.activeDownloads--;
      setImmediate(() => this.processNextQueueItem());
    }
  }
  /**
   * Synchronous / awaitable download processing (useful for testing and sync clients).
   */
  async processDownload(url, options = {}, userId) {
    const job = await this.createDownloadJob(url, options, userId);
    if (job.status === "completed") {
      return {
        success: true,
        platform: job.platform,
        provider: job.provider,
        title: job.title || "Media",
        duration: job.duration || 0,
        format: job.format || "mp4",
        quality: job.quality || "720p",
        url: job.downloadUrl || job.mediaUrl || "",
        downloadUrl: job.downloadUrl || job.mediaUrl || "",
        size: job.size,
        mimeType: job.mimeType,
        fileToken: job.fileToken,
        filePath: job.filePath,
        expiresAt: job.expiresAt,
        jobId: job.id
      };
    }
    const timeoutMs = options.timeoutMs || config.providers.ytdlp.timeoutMs + 1e4;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 800));
      const current = await this.getJob(job.id);
      if (!current) throw DownloaderError.jobNotFound(job.id);
      if (current.status === "completed") {
        return {
          success: true,
          platform: current.platform,
          provider: current.provider,
          title: current.title || "Media",
          duration: current.duration || 0,
          format: current.format || "mp4",
          quality: current.quality || "720p",
          url: current.downloadUrl || current.mediaUrl || "",
          downloadUrl: current.downloadUrl || current.mediaUrl || "",
          size: current.size,
          mimeType: current.mimeType,
          fileToken: current.fileToken,
          filePath: current.filePath,
          expiresAt: current.expiresAt,
          jobId: current.id
        };
      }
      if (current.status === "failed") {
        throw new DownloaderError(
          current.error || "Download failed",
          current.errorCode || "PROVIDER_FAILED"
        );
      }
    }
    throw DownloaderError.timeout("Download job timed out");
  }
  /**
   * Retrieves a job by ID and verifies expiration.
   */
  async getJob(id) {
    const job = await db.getJobById(id);
    if (!job) return null;
    if (new Date(job.expiresAt).getTime() <= Date.now()) {
      if (job.status !== "expired") {
        job.status = "expired";
        await db.updateJobStatus(id, "expired");
      }
    }
    return job;
  }
};
var downloadService = new DownloadService();

// src/api/controllers/downloader.controller.ts
var DownloaderController = class {
  async getHealth(_req, res) {
    const memoryUsage = process.memoryUsage();
    res.json({
      status: "ok",
      service: config.appName,
      author: config.author,
      version: "1.3.0",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      environment: config.env,
      memory: {
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024)
      },
      concurrency: {
        maxConcurrent: config.maxConcurrentDownloads
      }
    });
  }
  async getProviders(_req, res, next) {
    try {
      const healthList = await providerManager.checkAllHealth();
      const providers = providerManager.getAllProviders().map((p) => {
        const h = healthList.find((item) => item.provider.toLowerCase() === p.name.toLowerCase());
        return {
          name: p.name,
          supportedPlatforms: p.supportedPlatforms,
          isAvailable: h?.available ?? false,
          latencyMs: h?.latencyMs,
          statusMessage: h?.statusMessage,
          version: h?.version
        };
      });
      res.json({
        success: true,
        priorityOrder: config.providers.priority,
        providers
      });
    } catch (err) {
      next(err);
    }
  }
  async getInfo(req, res, next) {
    try {
      const { url, timeoutMs } = req.body;
      const mediaInfo = await downloadService.getMediaInfo(url, { timeoutMs });
      res.json({
        success: true,
        data: mediaInfo
      });
    } catch (err) {
      next(err);
    }
  }
  async postDownload(req, res, next) {
    try {
      const { url, type, quality, format, sync } = req.body;
      const userId = req.userId;
      if (sync === true || req.query.sync === "true") {
        const result = await downloadService.processDownload(
          url,
          { type, quality, format },
          userId
        );
        const { filePath: _fp, ...safeResult } = result;
        res.json({
          success: true,
          data: {
            id: result.jobId,
            status: "completed",
            title: result.title,
            mimeType: result.mimeType,
            size: result.size,
            downloadUrl: result.downloadUrl || result.url,
            progress: null
          },
          ...safeResult
        });
        return;
      }
      const job = await downloadService.createDownloadJob(
        url,
        { type, quality, format },
        userId
      );
      res.status(202).json({
        success: true,
        data: {
          jobId: job.id,
          status: job.status
        },
        jobId: job.id,
        status: job.status
      });
    } catch (err) {
      next(err);
    }
  }
  async getJobById(req, res, next) {
    try {
      const { id } = req.params;
      const job = await downloadService.getJob(id);
      if (!job) {
        throw DownloaderError.jobNotFound(id);
      }
      const { filePath: _fp, ...safeJob } = job;
      res.json({
        success: true,
        data: {
          id: job.id,
          status: job.status,
          title: job.title,
          mimeType: job.mimeType,
          size: job.size,
          downloadUrl: job.downloadUrl || job.mediaUrl,
          progress: null,
          format: job.format,
          quality: job.quality,
          thumbnail: job.thumbnail,
          duration: job.duration,
          createdAt: job.createdAt,
          expiresAt: job.expiresAt,
          error: job.error,
          errorCode: job.errorCode
        },
        job: safeJob
      });
    } catch (err) {
      next(err);
    }
  }
  async getMediaFile(req, res, next) {
    try {
      const { token } = req.params;
      const fileEntry = storageService.getFileByToken(token);
      if (!fileEntry) {
        throw DownloaderError.jobNotFound(`Media file with token '${token}' was not found or has expired.`);
      }
      storageService.serveFileWithRanges(
        fileEntry.filePath,
        fileEntry.mimeType,
        fileEntry.filename,
        req,
        res
      );
    } catch (err) {
      next(err);
    }
  }
  async getJobFile(req, res, next) {
    try {
      const { id } = req.params;
      const job = await downloadService.getJob(id);
      if (!job) {
        throw DownloaderError.jobNotFound(id);
      }
      if (job.status !== "completed" || !job.filePath) {
        res.status(400).json({
          success: false,
          error: `Job '${id}' is currently in state '${job.status}' and file is not ready.`,
          code: "FILE_NOT_READY"
        });
        return;
      }
      const mimeType = job.mimeType || "video/mp4";
      const ext = job.format || "mp4";
      const filename = storageService.sanitizeFilename(job.title || "media", ext);
      storageService.serveFileWithRanges(job.filePath, mimeType, filename, req, res);
    } catch (err) {
      next(err);
    }
  }
  async postSearch(req, res, next) {
    try {
      const { query, platform } = req.body;
      const results = await providerManager.search(query, platform);
      res.json({
        success: true,
        count: results.length,
        results
      });
    } catch (err) {
      next(err);
    }
  }
};
var downloaderController = new DownloaderController();

// src/middleware/validation.middleware.ts
var import_zod = require("zod");
var validateBody = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.join(".") || "body";
      const isUrlError = field === "url" || issue.message.toLowerCase().includes("url");
      const errorCode = isUrlError ? "INVALID_URL" : "VALIDATION_ERROR";
      res.status(400).json({
        success: false,
        error: `Validation Error: ${issue.message} at '${field}'`,
        code: errorCode,
        details: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
      });
      return;
    }
    req.body = result.data;
    next();
  };
};
var InfoRequestSchema = import_zod.z.object({
  url: import_zod.z.string().url("A valid URL is required").trim().min(1, "URL cannot be empty")
});
var DownloadRequestSchema = import_zod.z.object({
  url: import_zod.z.string().url("A valid URL is required").trim().min(1, "URL cannot be empty"),
  type: import_zod.z.enum(["video", "audio"]).optional().default("video"),
  quality: import_zod.z.string().optional().default("720p"),
  format: import_zod.z.string().optional()
});
var SearchRequestSchema = import_zod.z.object({
  query: import_zod.z.string().trim().min(1, "Search query cannot be empty"),
  platform: import_zod.z.enum(["youtube", "instagram", "tiktok", "facebook", "pinterest", "twitter", "reddit"]).optional()
});

// src/services/rate-limit/rate-limit.service.ts
var RateLimitService = class {
  async checkRateLimit(identifier, isAdmin = false) {
    const limit = isAdmin ? config.rateLimit.adminMaxRequests : config.rateLimit.maxRequests;
    const windowMs = isAdmin ? config.rateLimit.adminWindowMs : config.rateLimit.windowMs;
    const key = `ratelimit:${isAdmin ? "admin:" : "user:"}${identifier}`;
    const result = await db.incrementRateLimit(key, windowMs);
    const remaining = Math.max(0, limit - result.count);
    const allowed = result.count <= limit;
    return {
      allowed,
      remaining,
      resetAt: result.resetAt,
      total: result.count,
      limit
    };
  }
  async getStatus(identifier, isAdmin = false) {
    const limit = isAdmin ? config.rateLimit.adminMaxRequests : config.rateLimit.maxRequests;
    const key = `ratelimit:${isAdmin ? "admin:" : "user:"}${identifier}`;
    const record = await db.getRateLimit(key);
    if (!record) {
      return {
        allowed: true,
        remaining: limit,
        resetAt: Date.now() + (isAdmin ? config.rateLimit.adminWindowMs : config.rateLimit.windowMs),
        total: 0,
        limit
      };
    }
    return {
      allowed: record.count <= limit,
      remaining: Math.max(0, limit - record.count),
      resetAt: record.resetAt,
      total: record.count,
      limit
    };
  }
  async reset(identifier, isAdmin = false) {
    const key = `ratelimit:${isAdmin ? "admin:" : "user:"}${identifier}`;
    await db.resetRateLimit(key);
  }
  async cleanupExpired() {
    return db.cleanExpiredRateLimits(Date.now());
  }
};
var rateLimitService = new RateLimitService();

// src/middleware/auth.middleware.ts
var import_crypto5 = __toESM(require("crypto"), 1);
function timingSafeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    import_crypto5.default.timingSafeEqual(bufA, bufA);
    return false;
  }
  return import_crypto5.default.timingSafeEqual(bufA, bufB);
}
function verifyAdminKey(providedKey) {
  if (!providedKey || !config.adminApiKey) return false;
  return timingSafeCompare(providedKey.trim(), config.adminApiKey);
}
function verifyCronSecret(providedKey) {
  if (!providedKey || !config.cronSecret) return false;
  return timingSafeCompare(providedKey.trim(), config.cronSecret);
}
function extractKeyFromHeaders(req) {
  const headerKey = req.headers["x-admin-key"];
  const cronHeader = req.headers["x-cron-secret"];
  const authHeader = req.headers["authorization"];
  if (headerKey) return headerKey.trim();
  if (cronHeader) return cronHeader.trim();
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return void 0;
}
function adminAuthMiddleware(req, res, next) {
  if (!config.adminApiKey) {
    res.status(503).json({
      success: false,
      error: "Admin endpoints are disabled because ADMIN_API_KEY is not configured in the server environment."
    });
    return;
  }
  const providedKey = extractKeyFromHeaders(req);
  if (!providedKey || !verifyAdminKey(providedKey)) {
    res.status(401).json({
      success: false,
      error: "Unauthorized: Valid Admin API key required.",
      hint: "Pass X-Admin-Key header or Authorization: Bearer <ADMIN_API_KEY>"
    });
    return;
  }
  next();
}
function cronAuthMiddleware(req, res, next) {
  if (!config.adminApiKey && !config.cronSecret) {
    res.status(503).json({
      success: false,
      error: "Cleanup endpoint is disabled because neither ADMIN_API_KEY nor CRON_SECRET is configured."
    });
    return;
  }
  const providedKey = extractKeyFromHeaders(req);
  const isValidAdmin = verifyAdminKey(providedKey);
  const isValidCron = verifyCronSecret(providedKey);
  if (!isValidAdmin && !isValidCron) {
    res.status(401).json({
      success: false,
      error: "Unauthorized: Valid X-Admin-Key, X-Cron-Secret, or Bearer token required."
    });
    return;
  }
  next();
}
function optionalUserAuthMiddleware(req, res, next) {
  const apiKey = req.headers[config.apiKeyHeader];
  if (apiKey) {
    req.userId = apiKey.trim();
  }
  next();
}

// src/middleware/rate-limit.middleware.ts
function createRateLimiter(options = {}) {
  return async (req, res, next) => {
    const rawIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const clientIp = rawIp.split(",")[0].trim();
    const userId = req.userId || clientIp;
    const adminHeader = req.headers["x-admin-key"] || (req.headers["authorization"]?.toString().startsWith("Bearer ") ? req.headers["authorization"].toString().slice(7) : void 0);
    const hasValidAdminKey = verifyAdminKey(adminHeader);
    const isAdmin = options.isAdmin || hasValidAdminKey;
    const status = await rateLimitService.checkRateLimit(userId, Boolean(isAdmin));
    res.setHeader("X-RateLimit-Limit", status.limit);
    res.setHeader("X-RateLimit-Remaining", status.remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(status.resetAt / 1e3));
    if (!status.allowed) {
      res.status(429).json({
        success: false,
        error: "Too Many Requests: Rate limit exceeded.",
        limit: status.limit,
        remaining: 0,
        resetAt: new Date(status.resetAt).toISOString(),
        message: `Limit of ${status.limit} requests per window exceeded. Please wait until reset.`
      });
      return;
    }
    next();
  };
}
var downloadRateLimiter = createRateLimiter({ isAdmin: false });
var adminRateLimiter = createRateLimiter({ isAdmin: true });

// src/api/routes/downloader.routes.ts
var router = (0, import_express.Router)();
router.get("/health", (req, res) => downloaderController.getHealth(req, res));
router.get("/providers", (req, res, next) => downloaderController.getProviders(req, res, next));
router.post(
  "/info",
  optionalUserAuthMiddleware,
  downloadRateLimiter,
  validateBody(InfoRequestSchema),
  (req, res, next) => downloaderController.getInfo(req, res, next)
);
router.post(
  "/download",
  optionalUserAuthMiddleware,
  downloadRateLimiter,
  validateBody(DownloadRequestSchema),
  (req, res, next) => downloaderController.postDownload(req, res, next)
);
router.get("/job/:id", (req, res, next) => downloaderController.getJobById(req, res, next));
router.get("/job/:id/file", (req, res, next) => downloaderController.getJobFile(req, res, next));
router.get("/media/:token", (req, res, next) => downloaderController.getMediaFile(req, res, next));
router.post(
  "/search",
  optionalUserAuthMiddleware,
  validateBody(SearchRequestSchema),
  (req, res, next) => downloaderController.postSearch(req, res, next)
);
var downloader_routes_default = router;

// src/api/routes/admin.routes.ts
var import_express2 = require("express");

// src/services/cleanup/cleanup.service.ts
var CleanupService = class {
  /**
   * Executes complete database, cache & temporary storage garbage collection.
   */
  async runCleanup() {
    const executedAt = (/* @__PURE__ */ new Date()).toISOString();
    logger.info("Starting system cleanup & garbage collection cycle...");
    const abandonedCutoff = new Date(Date.now() - 15 * 60 * 1e3).toISOString();
    const abandonedMarked = await db.markAbandonedJobs(abandonedCutoff);
    const expiredJobsDeleted = await db.deleteExpiredJobs(executedAt);
    const staleCacheEntriesRemoved = await db.deleteExpiredCache(executedAt);
    await db.cleanExpiredRateLimits(Date.now());
    const filesPurged = await storageService.purgeExpiredFiles();
    const stats = {
      expiredJobsDeleted,
      staleCacheEntriesRemoved,
      abandonedJobsMarkedExpired: abandonedMarked,
      executedAt
    };
    logger.info("System cleanup complete", { stats, filesPurged });
    return stats;
  }
};
var cleanupService = new CleanupService();

// src/api/controllers/admin.controller.ts
var AdminController = class {
  async testProviders(_req, res, next) {
    try {
      const healthList = await providerManager.checkAllHealth();
      const dbStatuses = await db.getAllProviderStatuses();
      res.json({
        success: true,
        testedAt: (/* @__PURE__ */ new Date()).toISOString(),
        providers: healthList,
        historicalStats: dbStatuses
      });
    } catch (err) {
      next(err);
    }
  }
  async cacheCleanup(_req, res, next) {
    try {
      const stats = await cleanupService.runCleanup();
      res.json({
        success: true,
        message: "System cache & expired job cleanup completed successfully.",
        stats
      });
    } catch (err) {
      next(err);
    }
  }
  async getStats(_req, res, next) {
    try {
      const cacheStats = await cacheService.getStats();
      const providerStatuses = await db.getAllProviderStatuses();
      const recentJobs = await db.getJobs(100);
      const jobCounts = {
        total: recentJobs.length,
        completed: recentJobs.filter((j) => j.status === "completed").length,
        failed: recentJobs.filter((j) => j.status === "failed").length,
        processing: recentJobs.filter((j) => j.status === "processing").length,
        expired: recentJobs.filter((j) => j.status === "expired").length
      };
      res.json({
        success: true,
        uptimeSeconds: Math.floor(process.uptime()),
        cache: cacheStats,
        jobs: jobCounts,
        providers: providerStatuses
      });
    } catch (err) {
      next(err);
    }
  }
  async getJobs(req, res, next) {
    try {
      const limit = parseInt(req.query.limit, 10) || 50;
      const jobs = await db.getJobs(limit);
      res.json({
        success: true,
        count: jobs.length,
        jobs
      });
    } catch (err) {
      next(err);
    }
  }
};
var adminController = new AdminController();

// src/api/routes/admin.routes.ts
var router2 = (0, import_express2.Router)();
router2.use(adminRateLimiter);
router2.post(
  "/cache/cleanup",
  cronAuthMiddleware,
  (req, res, next) => adminController.cacheCleanup(req, res, next)
);
router2.use(adminAuthMiddleware);
router2.post("/providers/test", (req, res, next) => adminController.testProviders(req, res, next));
router2.get("/stats", (req, res, next) => adminController.getStats(req, res, next));
router2.get("/jobs", (req, res, next) => adminController.getJobs(req, res, next));
var admin_routes_default = router2;

// src/api/routes/pinterest.routes.ts
var import_express3 = require("express");

// src/api/controllers/pinterest.controller.ts
var PinterestController = class {
  oauthStart(_req, res, next) {
    try {
      if (!config.pinterest.enabled) {
        res.status(503).json({ success: false, error: "Pinterest integration is disabled. Set PINTEREST_ENABLED=true." });
        return;
      }
      res.redirect(pinterestApiService.getAuthorizationUrl());
    } catch (err) {
      next(err);
    }
  }
  async oauthCallback(req, res, next) {
    try {
      const { code, state, error, error_description } = req.query;
      if (error) {
        res.status(400).json({ success: false, error, error_description });
        return;
      }
      if (!code || !state || !pinterestApiService.consumeState(state)) {
        res.status(400).json({ success: false, error: "Invalid or expired Pinterest OAuth state/code." });
        return;
      }
      const token = await pinterestApiService.exchangeCode(code);
      res.json({
        success: true,
        message: "Pinterest OAuth completed. Store the returned tokens in Railway Variables, then restart/redeploy the service.",
        token,
        railwayVariables: {
          PINTEREST_ACCESS_TOKEN: token.access_token || "",
          PINTEREST_REFRESH_TOKEN: token.refresh_token || ""
        }
      });
    } catch (err) {
      next(err);
    }
  }
  async status(_req, res, next) {
    try {
      const configured = pinterestApiService.isConfigured();
      const hasAccessToken = Boolean(config.pinterest.accessToken);
      let account = void 0;
      if (hasAccessToken) account = await pinterestApiService.getUserAccount();
      res.json({ success: true, enabled: config.pinterest.enabled, configured, hasAccessToken, account });
    } catch (err) {
      next(err);
    }
  }
  async getPin(req, res, next) {
    try {
      const pinId = String(req.params.pinId || "").trim();
      if (!/^\d+$/.test(pinId)) {
        res.status(400).json({ success: false, error: "A numeric Pinterest Pin ID is required." });
        return;
      }
      const data = await pinterestApiService.getPin(pinId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
  async listPins(req, res, next) {
    try {
      const data = await pinterestApiService.listPins(void 0, typeof req.query.bookmark === "string" ? req.query.bookmark : void 0);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
};
var pinterestController = new PinterestController();

// src/api/routes/pinterest.routes.ts
var router3 = (0, import_express3.Router)();
router3.get("/oauth", (req, res, next) => pinterestController.oauthStart(req, res, next));
router3.get("/oauth/callback", (req, res, next) => pinterestController.oauthCallback(req, res, next));
router3.get("/status", (req, res, next) => pinterestController.status(req, res, next));
router3.get("/pin/:pinId", (req, res, next) => pinterestController.getPin(req, res, next));
router3.get("/pins", (req, res, next) => pinterestController.listPins(req, res, next));
var pinterest_routes_default = router3;

// src/api/routes/pinterest-search.routes.ts
var import_express4 = require("express");

// src/api/controllers/pinterest-search.controller.ts
var PinterestSearchController = class {
  async search(req, res, next) {
    try {
      const query = String(req.query.q || req.query.query || "").trim();
      const type = String(req.query.type || "i").toLowerCase() === "s" ? "s" : "i";
      const rawLimit = Number(req.query.limit || 3);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 25) : 3;
      if (!query) {
        res.status(400).json({ success: false, error: "Query is required", code: "VALIDATION_ERROR" });
        return;
      }
      const results = await pinterestSearchService.search(query, type, limit);
      res.json({ success: true, count: results.length, type, query, results });
    } catch (err) {
      next(err);
    }
  }
};
var pinterestSearchController = new PinterestSearchController();

// src/api/routes/pinterest-search.routes.ts
var router4 = (0, import_express4.Router)();
router4.get("/search", (req, res, next) => pinterestSearchController.search(req, res, next));
var pinterest_search_routes_default = router4;

// src/api/routes/osint.routes.ts
var import_express5 = require("express");

// src/services/osint/osint.service.ts
var SUPPORTED = ["youtube", "instagram", "tiktok", "facebook", "pinterest", "twitter", "reddit"];
var TIMEOUT_MS = 12e3;
function cleanUsername(value) {
  let v = String(value || "").trim();
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      const parts = u.pathname.split("/").filter(Boolean);
      if (u.hostname.includes("reddit.com") && parts[0] && /^(u|user)$/i.test(parts[0])) return parts[1] || "";
      if (u.hostname.includes("youtube.com") && parts[0]?.startsWith("@")) return parts[0].slice(1);
      if ((u.hostname.includes("x.com") || u.hostname.includes("twitter.com")) && parts[0]) return parts[0];
      if (u.hostname.includes("tiktok.com") && parts[0]?.startsWith("@")) return parts[0].slice(1);
      return parts[0]?.replace(/^@/, "") || "";
    } catch {
      return "";
    }
  }
  return v.replace(/^@/, "").replace(/^\/+|\/+$/g, "").split(/[?#]/)[0];
}
function profileUrl(platform, username) {
  const u = encodeURIComponent(username);
  switch (platform) {
    case "youtube":
      return `https://www.youtube.com/@${u}`;
    case "instagram":
      return `https://www.instagram.com/${u}/`;
    case "tiktok":
      return `https://www.tiktok.com/@${u}`;
    case "facebook":
      return `https://www.facebook.com/${u}`;
    case "pinterest":
      return `https://www.pinterest.com/${u}/`;
    case "twitter":
      return `https://x.com/${u}`;
    case "reddit":
      return `https://www.reddit.com/user/${u}/about.json`;
  }
}
function text(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
function meta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i");
  const m = html.match(re);
  return m?.[1]?.trim() || void 0;
}
function first(...values) {
  return values.find((v) => typeof v === "string" && v.trim());
}
function parseCount(source, labels) {
  const escaped = labels.join("|");
  const re = new RegExp(`([\\d,.]+\\s*[KMB]?)\\s*(?:${escaped})`, "i");
  const m = source.match(re);
  if (!m) return void 0;
  const raw = m[1].replace(/,/g, "").trim().toUpperCase();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return void 0;
  if (raw.endsWith("K")) return Math.round(n * 1e3);
  if (raw.endsWith("M")) return Math.round(n * 1e6);
  if (raw.endsWith("B")) return Math.round(n * 1e9);
  return Math.round(n);
}
async function fetchPublic(url, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(Math.max(timeoutMs, 3e3), 3e4));
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      },
      redirect: "follow"
    });
    const body = await response.text();
    return { response, body };
  } finally {
    clearTimeout(timer);
  }
}
var OsintService = class {
  isSupported(platform) {
    return SUPPORTED.includes(platform);
  }
  async getProfile(platform, input, timeoutMs = TIMEOUT_MS) {
    if (!this.isSupported(platform)) throw new Error(`Unsupported OSINT platform: ${platform}`);
    const username = cleanUsername(input);
    if (!username || !/^[A-Za-z0-9._+\-]{1,100}$/.test(username)) throw new Error("Invalid username");
    const url = profileUrl(platform, username);
    if (platform === "reddit") return this.getReddit(username, url, timeoutMs);
    const { response, body } = await fetchPublic(url, timeoutMs);
    const available = {};
    const ogTitle = first(meta(body, "og:title"), meta(body, "twitter:title"));
    const description = first(meta(body, "og:description"), meta(body, "description"), meta(body, "twitter:description"));
    const image = first(meta(body, "og:image"), meta(body, "twitter:image"));
    const canonical = first(meta(body, "og:url")) || response.url || url;
    if (ogTitle) available.displayName = ogTitle;
    if (description) available.bio = description;
    if (image) available.profilePicture = image;
    if (canonical) available.canonicalUrl = canonical;
    if (!response.ok) available.httpStatus = response.status;
    const visible = text(body);
    const followers = parseCount(`${description || ""} ${visible}`, ["followers", "follower", "subscribers", "subscriber"]);
    const following = parseCount(`${description || ""} ${visible}`, ["following", "following"]);
    const posts = parseCount(`${description || ""} ${visible}`, ["posts", "post", "videos", "video", "pins", "pin"]);
    if (followers !== void 0) available.followers = followers;
    if (following !== void 0) available.following = following;
    if (posts !== void 0) available.postsOrVideos = posts;
    available.isPrivate = /\bprivate account\b|\bthis account is private\b/i.test(visible + " " + (description || ""));
    available.publicDataOnly = true;
    return { platform, username, profileUrl: url, available };
  }
  async getReddit(username, url, timeoutMs) {
    const { response, body } = await fetchPublic(url, timeoutMs);
    const available = { publicDataOnly: true };
    try {
      const json = JSON.parse(body);
      const d = json?.data || json;
      const map = {
        displayName: d?.subreddit?.display_name_prefixed || d?.name,
        bio: d?.subreddit?.public_description || d?.subreddit?.description,
        profilePicture: d?.icon_img || d?.subreddit?.icon_img || d?.subreddit?.community_icon,
        karma: d?.total_karma,
        isGold: d?.is_gold,
        createdAt: typeof d?.created_utc === "number" ? new Date(d.created_utc * 1e3).toISOString() : void 0,
        isSuspended: d?.is_suspended
      };
      for (const [k, v] of Object.entries(map)) if (v !== void 0 && v !== null && v !== "") available[k] = v;
    } catch {
      available.httpStatus = response.status;
    }
    if (!response.ok) available.httpStatus = response.status;
    return { platform: "reddit", username, profileUrl: url, available };
  }
};
var osintService = new OsintService();

// src/api/controllers/osint.controller.ts
var OsintController = class {
  async profile(req, res, next) {
    try {
      const platform = String(req.body?.platform || req.query.platform || "").toLowerCase();
      const username = String(req.body?.username || req.query.username || "").trim();
      const timeoutMs = Number(req.body?.timeoutMs || req.query.timeoutMs || 12e3);
      if (!platform || !username) {
        res.status(400).json({ success: false, error: "platform and username are required" });
        return;
      }
      const data = await osintService.getProfile(platform, username, timeoutMs);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
};
var osintController = new OsintController();

// src/api/routes/osint.routes.ts
var router5 = (0, import_express5.Router)();
router5.post("/profile", optionalUserAuthMiddleware, downloadRateLimiter, (req, res, next) => osintController.profile(req, res, next));
router5.get("/profile", optionalUserAuthMiddleware, downloadRateLimiter, (req, res, next) => osintController.profile(req, res, next));
var osint_routes_default = router5;

// src/api/routes/index.ts
var apiRouter = (0, import_express6.Router)();
apiRouter.use("/admin", admin_routes_default);
apiRouter.use("/pinterest", pinterest_routes_default);
apiRouter.use("/pinterest", pinterest_search_routes_default);
apiRouter.use("/osint", osint_routes_default);
apiRouter.use("/", downloader_routes_default);
var routes_default = apiRouter;

// src/middleware/logger.middleware.ts
var import_crypto6 = __toESM(require("crypto"), 1);
function requestLogger(req, res, next) {
  const start = Date.now();
  const requestId = req.headers["x-request-id"] || `req_${import_crypto6.default.randomBytes(6).toString("hex")}`;
  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);
  res.on("finish", () => {
    const duration = Date.now() - start;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`, {
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      ip: typeof ip === "string" ? ip.split(",")[0].trim() : String(ip),
      durationMs: duration
    });
  });
  next();
}

// src/middleware/error.middleware.ts
function errorHandler(err, req, res, _next) {
  const isDownloaderError = err instanceof DownloaderError;
  const statusCode = isDownloaderError ? err.statusCode : 500;
  const errorCode = isDownloaderError ? err.code : "INTERNAL_ERROR";
  logger.error(`API Error [${errorCode}]: ${err.message}`, {
    url: req.originalUrl,
    method: req.method,
    statusCode,
    code: errorCode
  });
  res.status(statusCode).json({
    success: false,
    error: err.message || "An unexpected internal server error occurred.",
    code: errorCode,
    path: req.originalUrl,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
}
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
    code: "ROUTE_NOT_FOUND",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
}

// src/app.ts
var import_path5 = __toESM(require("path"), 1);
function createApp() {
  const app = (0, import_express7.default)();
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", config.corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key, X-Api-Key");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(import_express7.default.json({ limit: "1mb" }));
  app.use(import_express7.default.urlencoded({ extended: true, limit: "1mb" }));
  app.use(requestLogger);
  app.use("/api", routes_default);
  app.get("/privacy", (_req, res) => {
    res.sendFile(import_path5.default.join(process.cwd(), "privacy.html"));
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// server.ts
var import_vite = require("vite");
async function startServer() {
  const app = createApp();
  const PORT = config.port;
  const HOST = config.host;
  providerManager.checkAllHealth().then((healths) => {
    logger.info("Initial provider health check completed", {
      providers: healths.map((h) => ({ name: h.provider, available: h.available }))
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path6.default.join(process.cwd(), "dist");
    app.use(import_express8.default.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      res.sendFile(import_path6.default.join(distPath, "index.html"));
    });
  }
  app.all("/api/*", notFoundHandler);
  app.use(errorHandler);
  const server = app.listen(PORT, HOST, () => {
    logger.info(`hax-media-downloader API server listening on http://${HOST}:${PORT}`);
    logger.info(`API Base URL: http://${HOST}:${PORT}/api`);
    logger.info(`Author: ${config.author} | Client Consumer: Tanu-xai`);
  });
  let isShuttingDown = false;
  const gracefulShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);
    try {
      await storageService.cleanupAllTemp();
      logger.info("Cleaned up temporary media storage");
    } catch (err) {
      logger.warn(`Error cleaning up temporary storage: ${err.message}`);
    }
    server.close(() => {
      logger.info("Server HTTP listener closed");
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn("Forcing shutdown after timeout");
      process.exit(0);
    }, 5e3).unref();
  };
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}
startServer().catch((err) => {
  logger.error("Fatal error during server startup", { error: err.message });
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map
