export const APP_NAME = "WhatsApp Marketing";

export const MESSAGE_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  FAILED: "failed",
} as const;

export const CAMPAIGN_STATUS = {
  DRAFT: "draft",
  SENDING: "sending",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export const ROUTES = {
  HOME: "/",
  DASHBOARD: "/dashboard",
  CAMPAIGNS: "/campaigns",
  NEW_CAMPAIGN: "/new-campaign",
  CONTACTS: "/contacts",
  WHATSAPP: "/whatsapp",
  AUTH: "/auth",
} as const;

export const QUERY_KEYS = {
  CAMPAIGNS: "campaigns",
  CONTACTS: "contacts",
  MESSAGES: "messages",
  METRICS: "metrics",
  WHATSAPP_CONFIG: "whatsapp-config",
  PROFILE: "profile",
} as const;

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "video/mp4"];

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;
