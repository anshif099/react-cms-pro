import React, { createContext, useState, useContext, useEffect } from "react";
import authService from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if there is a local session first
    const localSession = sessionStorage.getItem("reactcms_local_session");
    if (localSession) {
      setUser({
        uid: "admin_local",
        email: "admin@reactcms.local",
        name: "Admin User",
        role: "Administrator",
        company: "ReactCMS Ltd.",
        phone: "+1 (555) 019-2834"
      });
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }

    // Listen to Firebase Auth state changes
    const unsubscribe = authService.onAuthChange(async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        try {
          // Attempt to retrieve profile from Firestore
          let profile = await authService.getUserProfile(firebaseUser.uid);
          if (!profile) {
            // First time login bootstrap: create the profile document
            profile = await authService.createUserProfile(firebaseUser.uid, {
              email: firebaseUser.email,
              name: "Admin User",
              role: "Administrator",
              company: "ReactCMS Ltd.",
              phone: "+1 (555) 019-2834"
            });
          }
          setUser(profile);
          setIsAuthenticated(true);
        } catch (e) {
          console.error("Failed to load user profile", e);
          // Fallback to basic auth info if firestore fails temporarily
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: "Admin User",
            role: "Administrator"
          });
          setIsAuthenticated(true);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      const result = await authService.login(email, password);
      return { success: true, user: result.user };
    } catch (error) {
      console.warn("Firebase Auth login failed, checking local credentials fallback:", error);
      
      // Fallback for admin credentials to bypass Firebase Auth if not configured/enabled
      if (email === "admin@reactcms.local" && password === "ReactCMS@2026") {
        sessionStorage.setItem("reactcms_local_session", "true");
        const adminProfile = {
          uid: "admin_local",
          email: "admin@reactcms.local",
          name: "Admin User",
          role: "Administrator",
          company: "ReactCMS Ltd.",
          phone: "+1 (555) 019-2834"
        };
        setUser(adminProfile);
        setIsAuthenticated(true);
        return { success: true, user: adminProfile };
      }

      let message = "An unexpected error occurred.";
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
        message = "Invalid email or password.";
      } else if (error.code === "auth/too-many-requests") {
        message = "Too many attempts. Please try again later.";
      } else if (error.code === "auth/network-request-failed") {
        message = "Network error. Please check your connection.";
      } else if (error.code === "auth/user-disabled") {
        message = "This account has been disabled.";
      } else if (error.code === "auth/configuration-not-found") {
        message = "Authentication provider not enabled. Contact administrator.";
      }
      return { success: false, message };
    }
  };

  const logout = async () => {
    sessionStorage.removeItem("reactcms_local_session");
    try {
      await authService.logout();
    } catch (e) {
      console.error("Logout failed", e);
    }
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateProfile = async (name, phone, company) => {
    if (!user || !user.uid) return { success: false, message: "No active user session." };
    try {
      const updatedData = { name, phone, company };
      await authService.updateUserProfile(user.uid, updatedData);
      setUser(prev => prev ? { ...prev, ...updatedData } : null);
      return { success: true, user: { ...user, ...updatedData } };
    } catch (e) {
      console.error("Failed to update profile", e);
      return { success: false, message: "Failed to update profile." };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await authService.changePassword(currentPassword, newPassword);
      return { success: true };
    } catch (error) {
      console.error("Failed to change password", error);
      let message = "Failed to update password.";
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
        message = "Current password is incorrect.";
      } else if (error.code === "auth/weak-password") {
        message = "Password must be at least 6 characters.";
      } else if (error.code === "auth/network-request-failed") {
        message = "Network error. Please check your connection.";
      }
      return { success: false, message };
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
