import { useState, useEffect, useCallback } from "react";
import { collection, query, where, orderBy, onSnapshot, limit, startAfter, DocumentSnapshot } from "firebase/firestore";
import { db, rtdb } from "@/lib/firebase";
import { ref, onValue, off } from "firebase/database";
import { Message } from "@/types/chat";

const PAGE_SIZE = 30;

export const useRealtimeMessages = (chatId: string, currentUserId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, any>>({});
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chatId),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Message))
        .filter((msg) => !msg.deletedBy.includes(currentUserId))
        .reverse();
      setMessages(msgs);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [chatId, currentUserId]);

  useEffect(() => {
    const typingRef = ref(rtdb, `typing/${chatId}`);
    const listener = onValue(typingRef, (snapshot) => {
      const data = snapshot.val() || {};
      setTypingUsers(data);
    });
    return () => off(typingRef);
  }, [chatId]);

  const loadMore = useCallback(() => {
    if (!lastDoc) return;
    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chatId),
      orderBy("createdAt", "desc"),
      startAfter(lastDoc),
      limit(PAGE_SIZE)
    );
    onSnapshot(q, (snapshot) => {
      if (snapshot.empty) setHasMore(false);
      const newMsgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Message)).reverse();
      setMessages((prev) => [...prev, ...newMsgs]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
    });
  }, [lastDoc, chatId]);

  return { messages, typingUsers, hasMore, loading, loadMore };
};
