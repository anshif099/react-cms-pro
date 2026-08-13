import React, { createContext, useState, useContext, useEffect } from "react";
import authService from "../services/authService";
import clientAdminService from "../services/clientAdminService";
import sourceCredentialService from "../services/sourceCredentialService";
import {
  SUPER_ADMIN_ROLE,
  isSuperAdminUser,
  userCanAccessWebsite
} from "../utils/authAccess";

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
        role: SUPER_ADMIN_ROLE,
        isSuperAdmin: true,
        company: "ReactCMS Ltd.",
        phone: "+1 (555) 019-2834"
      });
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }

    // Listen to Firebase Auth and the assigned profile. Watching the profile
    // makes replacement client logins take effect in already-open sessions.
    let unsubscribeProfile = null;
    const unsubscribe = authService.onAuthChange((firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
      setLoading(true);
      if (firebaseUser) {
        unsubscribeProfile = authService.onUserProfileChange(firebaseUser.uid, async (profile, error) => {
          if (error) {
            console.error("Failed to load user profile", error);
            setUser(null);
            setIsAuthenticated(false);
            setLoading(false);
            return;
          }
          if (!profile || profile.disabled) {
            await authService.logout();
            setUser(null);
            setIsAuthenticated(false);
          } else {
            setUser(profile);
            setIsAuthenticated(true);
          }
          setLoading(false);
        });
      } else {
        sourceCredentialService.clearHostingSession();
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
      unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    // The built-in local administrator must not call Firebase Auth. This
    // project can run with Firebase Email/Password authentication disabled.
    if (email === "admin@reactcms.local" && password === "ReactCMS@2026") {
      sessionStorage.setItem("reactcms_local_session", "true");
      const adminProfile = {
        uid: "admin_local",
        email: "admin@reactcms.local",
        name: "Admin User",
        role: SUPER_ADMIN_ROLE,
        isSuperAdmin: true,
        company: "ReactCMS Ltd.",
        phone: "+1 (555) 019-2834"
      };
      setUser(adminProfile);
      setIsAuthenticated(true);
      return { success: true, user: adminProfile };
    }

    try {
      const result = await authService.login(email, password);
      setUser(result.profile);
      setIsAuthenticated(true);
      return { success: true, user: result.profile };
    } catch (error) {
      console.warn("Firebase Auth login failed, checking local credentials fallback:", error);
      
      let message = "An unexpected error occurred.";
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
        message = "Invalid email or password.";
      } else if (error.code === "auth/too-many-requests") {
        message = "Too many attempts. Please try again later.";
      } else if (error.code === "auth/network-request-failed") {
        message = "Network error. Please check your connection.";
      } else if (error.code === "auth/user-disabled") {
        message = error.message || "This account has been disabled.";
      } else if (error.code === "auth/profile-not-found") {
        message = error.message;
      } else if (error.code === "auth/configuration-not-found") {
        message = "Authentication provider not enabled. Contact administrator.";
      }
      return { success: false, message };
    }
  };

  const logout = async () => {
    sessionStorage.removeItem("reactcms_local_session");
    sourceCredentialService.clearHostingSession();
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
      await authService.updateUserProfile(user.uid, {
        ...updatedData,
        ...(user.companyId ? { companyId: user.companyId } : {})
      });
      setUser(prev => prev ? { ...prev, ...updatedData } : null);
      return { success: true, user: { ...user, ...updatedData } };
    } catch (e) {
      console.error("Failed to update profile", e);
      return { success: false, message: "Failed to update profile." };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    if (user?.uid === "admin_local") {
      return {
        success: false,
        message: "The built-in super-admin password is configured by the application and cannot be changed here."
      };
    }
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

  const createClientAdmin = async (website, credentials) => {
    if (!isSuperAdminUser(user)) {
      return { success: false, message: "Only a super administrator can create client logins." };
    }

    try {
      const account = await clientAdminService.create({
        website,
        ...credentials,
        actorUid: user.uid
      });
      return { success: true, account };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const sendClientPasswordReset = async (email) => {
    if (!isSuperAdminUser(user)) {
      return { success: false, message: "Only a super administrator can reset client logins." };
    }

    try {
      await clientAdminService.sendPasswordReset(email);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const isSuperAdmin = isSuperAdminUser(user);
  const canAccessWebsite = (websiteId) => userCanAccessWebsite(user, websiteId);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isSuperAdmin,
      loading,
      login,
      logout,
      updateProfile,
      changePassword,
      createClientAdmin,
      sendClientPasswordReset,
      canAccessWebsite
    }}>
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
