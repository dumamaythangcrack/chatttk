export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  phoneNumber?: string;
  status: "online" | "offline" | "away";
  lastSeen: number;
  isDev: boolean;
  isBanned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  uid: string;
  theme: "light" | "dark" | "system";
  font: "default" | "serif" | "mono";
  fontSize: number;
  lineHeight: number;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  pushEnabled: boolean;
  privateMessages: "everyone" | "friends" | "none";
  showOnlineStatus: boolean;
  readReceipts: boolean;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  content?: string;
  type: "text" | "image" | "video" | "audio" | "file";
  mediaURL?: string;
  mediaThumbnailURL?: string;
  mediaSize?: number;
  mediaMimeType?: string;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
  reactions: ReactionMap;
  editedAt?: number;
  editHistory?: Array<{ content: string; editedAt: number }>;
  deletedBy: string[];
  recalledAt?: number;
  readBy: string[];
  createdAt: number;
  updatedAt: number;
}

export type ReactionMap = Record<string, string[]>;

export interface Chat {
  id: string;
  name?: string;
  photoURL?: string;
  isGroup: boolean;
  members: string[];
  admins: string[];
  createdBy: string;
  lastMessageId?: string;
  lastMessageTime?: number;
  lastMessagePreview?: string;
  unreadCount: number;
  isMuted: boolean;
  isPinned: boolean;
  isArchived: boolean;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  mediaURL: string;
  thumbnailURL?: string;
  caption?: string;
  viewedBy: string[];
  expiresAt: number;
  createdAt: number;
}

export interface DevLog {
  id: string;
  action: string;
  details: Record<string, any>;
  performedBy: string;
  timestamp: number;
  ipAddress?: string;
}

export type FirebaseResponse<T = any> = {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
};
