import React, { createContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserProfile, Settings, FirebaseResponse } from "@/types/chat";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  settings: Settings | null;
  isDev: boolean;
  loading: boolean;
  refreshProfile: () => Promise<FirebaseResponse>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async (): Promise<FirebaseResponse> => {
    if (!user) return { ok: false, error: "Not authenticated" };
    try {
      const profileSnap = await getDoc(doc(db, "users", user.uid));
      const settingsSnap = await getDoc(doc(db, "settings", user.uid));

      if (profileSnap.exists()) setProfile(profileSnap.data() as UserProfile);
      if (settingsSnap.exists()) setSettings(settingsSnap.data() as Settings);

      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await refreshProfile();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [refreshProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, settings, isDev: profile?.isDev || false, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
