export type Provider = 'guest' | 'google' | 'linuxdo' | 'admin';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Env {
  APP_NAME?: string;
  APP_ENV?: string;
  APP_URL?: string;
  APP_SESSION_SECRET?: string;
  APP_CONFIG_ENCRYPTION_KEY?: string;
  ADMIN_BOOTSTRAP_EMAILS?: string;

  OPENAI_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_IMAGE_MODEL?: string;
  OPENAI_IMAGE_SIZE?: string;
  OPENAI_IMAGE_QUALITY?: string;

  QUEUE_CONCURRENCY?: string;
  QUEUE_GROUP_WINDOW_SECONDS?: string;
  QUEUE_GROUP_MAX_REQUESTS?: string;
  QUEUE_PRIORITY_TRIGGER_LENGTH?: string;
  QUEUE_PROTECTED_RANK?: string;
  QUEUE_PRIORITY_INSERT_START?: string;
  QUEUE_ALLOW_GUEST?: string;

  GOOGLE_OAUTH_ENABLED?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_OAUTH_REDIRECT_URI?: string;
  GOOGLE_OAUTH_SCOPE?: string;

  LINUXDO_OAUTH_ENABLED?: string;
  LINUXDO_OAUTH_CLIENT_ID?: string;
  LINUXDO_OAUTH_CLIENT_SECRET?: string;
  LINUXDO_OAUTH_ISSUER?: string;
  LINUXDO_OAUTH_REDIRECT_URI?: string;
  LINUXDO_OAUTH_SCOPE?: string;

  ADSENSE_ENABLED?: string;
  ADSENSE_CLIENT_ID?: string;
  ADSENSE_SLOT_HOME?: string;
  ADSENSE_SLOT_QUEUE?: string;
  ADSENSE_SLOT_RESULT?: string;

  TURNSTILE_SECRET_KEY?: string;
  HCAPTCHA_SECRET_KEY?: string;

  DB: D1Database;
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
  QUEUE_COORDINATOR: DurableObjectNamespace;
}

export interface AppUser {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  provider: Provider;
  priority: number;
  role: 'user' | 'admin';
}

export interface AppContext {
  Variables: {
    user?: AppUser;
    requestId: string;
  };
  Bindings: Env;
}

export interface QueueJob {
  id: string;
  userId?: string;
  anonymousDeviceId?: string;
  provider: Provider;
  priority: number;
  prompt: string;
  model: string;
  size: string;
  quality: string;
  createdAt: number;
}

export interface QueueConfig {
  concurrency: number;
  priorityTriggerLength: number;
  protectedRank: number;
  priorityInsertStart: number;
}

export interface ApiError {
  code: string;
  message: string;
}
