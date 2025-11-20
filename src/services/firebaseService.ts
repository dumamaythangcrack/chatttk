import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  increment,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { auth, db, storage, rtdb, functions } from "@/lib/firebase";
import { Message, Chat, Story, UserProfile, FirebaseResponse } from "@/types/chat";
import { ref as rtdbRef, set, onDisconnect } from "firebase/database";

// PASSWORD VALIDATION
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const validatePassword = (password: string): { valid: boolean; message: string } => {
  if (password.length < 8) return { valid: false, message: "Min 8 chars" };
  if (!/[a-z]/.test(password)) return { valid: false, message: "Need lowercase" };
  if (!/[A-Z]/.test(password)) return { valid: false, message: "Need uppercase" };
  if (!/\d/.test(password)) return { valid: false, message: "Need number" };
  if (!/[@$!%*?&]/.test(password)) return { valid: false, message: "Need special char" };
  return { valid: true, message: "Strong password" };
};

// ═══════════════════════════════════════════════════════════════
// AUTH SERVICES
// ═══════════════════════════════════════════════════════════════

export const signUpWithEmail = async (
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseResponse> => {
  const validation = validatePassword(password);
  if (!validation.valid) return { ok: false, error: validation.message };

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const { uid } = userCred.user;

    // Create user profile
    const userProfile: UserProfile = {
      uid,
      email,
      displayName,
      status: "online",
      lastSeen: Date.now(),
      isDev: false,
      isBanned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await setDoc(doc(db, "users", uid), userProfile);

    // Create settings
    await setDoc(doc(db, "settings", uid), {
      uid,
      theme: "system",
      font: "default",
      fontSize: 16,
      lineHeight: 1.5,
      notificationsEnabled: true,
      soundEnabled: true,
      pushEnabled: true,
      privateMessages: "everyone",
      showOnlineStatus: true,
      readReceipts: true,
    });

    return { ok: true, data: userProfile };
  } catch (err: any) {
    return { ok: false, error: err.message, code: err.code };
  }
};

export const signInWithEmail = async (email: string, password: string): Promise<FirebaseResponse> => {
  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const profileSnap = await getDoc(doc(db, "users", userCred.user.uid));
    return { ok: true, data: profileSnap.data() };
  } catch (err: any) {
    return { ok: false, error: err.message, code: err.code };
  }
};

export const signOutUser = async (): Promise<FirebaseResponse> => {
  try {
    await signOut(auth);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

export const changePassword = async (currentPassword: string, newPassword: string): Promise<FirebaseResponse> => {
  const validation = validatePassword(newPassword);
  if (!validation.valid) return { ok: false, error: validation.message };

  try {
    const user = auth.currentUser;
    if (!user || !user.email) return { ok: false, error: "Not authenticated" };

    // Reauthenticate
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // Update password
    await updatePassword(user, newPassword);

    return { ok: true, data: { message: "Password changed" } };
  } catch (err: any) {
    return { ok: false, error: err.message, code: err.code };
  }
};

// ═══════════════════════════════════════════════════════════════
// MESSAGE SERVICES
// ═══════════════════════════════════════════════════════════════

export const sendMessage = async (chatId: string, content: string): Promise<FirebaseResponse<Message>> => {
  try {
    const user = auth.currentUser;
    if (!user) return { ok: false, error: "Not authenticated" };

    const userSnap = await getDoc(doc(db, "users", user.uid));
    const userProfile = userSnap.data() as UserProfile;

    const message: Omit<Message, "id"> = {
      chatId,
      senderId: user.uid,
      senderName: userProfile.displayName,
      senderPhotoURL: userProfile.photoURL,
      content,
      type: "text",
      reactions: {},
      deletedBy: [],
      readBy: [user.uid],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const msgRef = await addDoc(collection(db, "messages"), message);
    await updateDoc(doc(db, "chats", chatId), {
      lastMessageId: msgRef.id,
      lastMessageTime: Date.now(),
      lastMessagePreview: content.substring(0, 50),
      updatedAt: Date.now(),
    });

    return { ok: true, data: { id: msgRef.id, ...message } as Message };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

export const editMessage = async (chatId: string, messageId: string, newContent: string): Promise<FirebaseResponse> => {
  try {
    const user = auth.currentUser;
    if (!user) return { ok: false, error: "Not authenticated" };

    const msgSnap = await getDoc(doc(db, "messages", messageId));
    const msg = msgSnap.data() as Message;

    if (msg.senderId !== user.uid) return { ok: false, error: "Not authorized" };

    const editHistory = msg.editHistory || [];
    editHistory.push({ content: msg.content || "", editedAt: msg.updatedAt });

    await updateDoc(doc(db, "messages", messageId), {
      content: newContent,
      editHistory,
      editedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

export const recallMessage = async (chatId: string, messageId: string): Promise<FirebaseResponse> => {
  try {
    const user = auth.currentUser;
    if (!user) return { ok: false, error: "Not authenticated" };

    const msgSnap = await getDoc(doc(db, "messages", messageId));
    const msg = msgSnap.data() as Message;

    if (msg.senderId !== user.uid) return { ok: false, error: "Not authorized" };

    await updateDoc(doc(db, "messages", messageId), {
      recalledAt: Date.now(),
      content: null,
      mediaURL: null,
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

export const deleteForMe = async (messageId: string): Promise<FirebaseResponse> => {
  try {
    const user = auth.currentUser;
    if (!user) return { ok: false, error: "Not authenticated" };

    await updateDoc(doc(db, "messages", messageId), {
      deletedBy: arrayUnion(user.uid),
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

export const forwardMessage = async (sourceMessageId: string, targetChatId: string): Promise<FirebaseResponse> => {
  try {
    const user = auth.currentUser;
    if (!user) return { ok: false, error: "Not authenticated" };

    const sourceMsg = await getDoc(doc(db, "messages", sourceMessageId));
    const msgData = sourceMsg.data() as Message;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    const userProfile = userSnap.data() as UserProfile;

    const forwardedMsg: Omit<Message, "id"> = {
      ...msgData,
      id: undefined as any,
      chatId: targetChatId,
      senderId: user.uid,
      senderName: userProfile.displayName,
      senderPhotoURL: userProfile.photoURL,
      reactions: {},
      deletedBy: [],
      readBy: [user.uid],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const msgRef = await addDoc(collection(db, "messages"), forwardedMsg);
    return { ok: true, data: { id: msgRef.id } };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

export const addReaction = async (messageId: string, emoji: string): Promise<FirebaseResponse> => {
  try {
    const user = auth.currentUser;
    if (!user) return { ok: false, error: "Not authenticated" };

    const msgSnap = await getDoc(doc(db, "messages", messageId));
    const msg = msgSnap.data() as Message;

    const reactions = msg.reactions || {};
    reactions[emoji] = (reactions[emoji] || []).filter((id) => id !== user.uid);
    reactions[emoji].push(user.uid);

    await updateDoc(doc(db, "messages", messageId), { reactions });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

export const updateReadStatus = async (messageId: string): Promise<FirebaseResponse> => {
  try {
    const user = auth.currentUser;
    if (!user) return { ok: false, error: "Not authenticated" };

    await updateDoc(doc(db, "messages", messageId), {
      readBy: arrayUnion(user.uid),
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

// ═══════════════════════════════════════════════════════════════
// CHAT SERVICES
// ═══════════════════════════════════════════════════════════════

export const createGroupChat = async (name: string, memberIds: string[]): Promise<FirebaseResponse<Chat>> => {
  try {
    const user = auth.currentUser;
    if (!user) return { ok: false, error: "Not authenticated" };

    const newChat: Omit<Chat, "id"> = {
      name,
      isGroup: true,
      members: [...memberIds, user.uid],
      admins: [user.uid],
      createdBy: user.uid,
      unreadCount: 0,
      isMuted: false,
      isPinned: false,
      isArchived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const chatRef = await addDoc(collection(db, "chats"), newChat);
    return { ok: true, data: { id: chatRef.id, ...newChat } as Chat };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

export const addMember = async (chatId: string, userId: string): Promise<FirebaseResponse> => {
  try {
    await updateDoc(doc(db, "chats", chatId), {
      members: arrayUnion(userId),
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

export const removeMember = async (chatId: string, userId: string): Promise<FirebaseResponse> => {
  try {
    await updateDoc(doc(db, "chats", chatId), {
      members: arrayRemove(userId),
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

export const muteChat = async (chatId: string, muted: boolean): Promise<FirebaseResponse> => {
  try {
    await updateDoc(doc(db, "chats", chatId), { isMuted: muted });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

export const pinChat = async (chatId: string, pinned: boolean): Promise<FirebaseResponse> => {
  try {
    await updateDoc(doc(db, "chats", chatId), { isPinned: pinned });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

export const archiveChat = async (chatId: string, archived: boolean): Promise<FirebaseResponse> => {
  try {
    await updateDoc(doc(db, "chats", chatId), { isArchived: archived });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

// ═══════════════════════════════════════════════════════════════
// STORY SERVICES
// ═══════════════════════════════════════════════════════════════

export const postStory = async (mediaURL: string, caption?: string): Promise<FirebaseResponse<Story>> => {
  try {
    const user = auth.currentUser;
    if (!user) return { ok: false, error: "Not authenticated" };

    const userSnap = await getDoc(doc(db, "users", user.uid));
    const userProfile = userSnap.data() as UserProfile;

    const story: Omit<Story, "id"> = {
      userId: user.uid,
      userName: userProfile.displayName,
      userPhotoURL: userProfile.photoURL,
      mediaURL,
      caption,
      viewedBy: [],
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    };

    const storyRef = await addDoc(collection(db, "stories"), story);
    return { ok: true, data: { id: storyRef.id, ...story } as Story };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

// ═══════════════════════════════════════════════════════════════
// DEV SERVICES
// ═══════════════════════════════════════════════════════════════

export const devBanUser = async (userId: string): Promise<FirebaseResponse> => {
  try {
    const banUserFn = httpsCallable(functions, "devBanUser");
    const res = await banUserFn({ userId });
    return res.data as FirebaseResponse;
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

export const devUnbanUser = async (userId: string): Promise<FirebaseResponse> => {
  try {
    const unbanUserFn = httpsCallable(functions, "devUnbanUser");
    const res = await unbanUserFn({ userId });
    return res.data as FirebaseResponse;
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

export const devGetUserMessages = async (userId: string, limit_count: number = 50): Promise<FirebaseResponse> => {
  try {
    const getFn = httpsCallable(functions, "devGetUserMessages");
    const res = await getFn({ userId, limit: limit_count });
    return res.data as FirebaseResponse;
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

export const setTypingStatus = async (chatId: string, isTyping: boolean): Promise<void> => {
  const user = auth.currentUser;
  if (!user) return;

  const typingRef = rtdbRef(rtdb, `typing/${chatId}/${user.uid}`);
  if (isTyping) {
    await set(typingRef, { uid: user.uid, name: user.displayName, timestamp: Date.now() });
  } else {
    await set(typingRef, null);
  }
};
