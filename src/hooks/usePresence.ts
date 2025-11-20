import { useEffect } from "react";
import { rtdb, auth } from "@/lib/firebase";
import { ref as rtdbRef, set, onDisconnect } from "firebase/database";

export const usePresence = () => {
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const presenceRef = rtdbRef(rtdb, `presence/${user.uid}`);
    set(presenceRef, { uid: user.uid, lastSeen: Date.now() });

    onDisconnect(presenceRef).set({ uid: user.uid, lastSeen: Date.now(), offline: true });

    return () => {
      set(presenceRef, null);
    };
  }, []);
};
