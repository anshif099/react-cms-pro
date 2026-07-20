import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Search, Bell, Sun, Moon, LogOut, User, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { Dropdown } from "../ui/Dropdown";
import { cn } from "../../utils/cn";
import notificationService from "../../services/notificationService";

export function TopBar({ setMobileOpen }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const list = await notificationService.getAll();
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.read).length);
    } catch (e) {
      console.error("Failed to load notifications:", e);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      logout();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const avatarDropdownItems = [
    {
      label: "My Profile",
      icon: User,
      onClick: () => navigate("/profile")
    },
    {
      label: "Settings",
      icon: SettingsIcon,
      onClick: () => navigate("/settings")
    },
    { divider: true },
    {
      label: "Logout",
      icon: LogOut,
      variant: "danger",
      onClick: handleLogout
    }
  ];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-admin-card border-b border-admin-border dark:border-slate-800 transition-colors">
      <div className="flex items-center gap-4 flex-1">
        {/* Toggle Sidebar (Mobile only) */}
        <button
          onClick={() => setMobileOpen(prev => !prev)}
          className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Bar */}
        <div className="relative max-w-md w-full hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="Search websites, logs, API events..."
            className="w-full text-sm pl-9 pr-4 py-1.5 bg-slate-50 border border-admin-border dark:bg-slate-800/40 dark:border-slate-800 rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-admin-text"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Theme Switcher */}
        <button
          onClick={toggleTheme}
          className="p-2 text-admin-secondary hover:text-admin-text hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg transition-colors cursor-pointer"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications Icon */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) {
                fetchNotifications();
              }
            }}
            className="p-2 text-admin-secondary hover:text-admin-text hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-admin-danger" />
            )}
          </button>

          {/* Simple Mock Notifications Dropdown */}
          {showNotifications && (
            <>
              <div 
                className="fixed inset-0 z-30" 
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 mt-2 w-80 rounded-lg bg-admin-card border border-admin-border shadow-lg z-40 py-2 dark:border-slate-850 text-left">
                <div className="px-4 py-2 border-b border-admin-border dark:border-slate-800 flex justify-between items-center">
                  <span className="font-semibold text-xs text-admin-text">Recent Events</span>
                  <button 
                    onClick={handleMarkAllRead} 
                    className="text-[10px] text-primary hover:underline cursor-pointer border-none bg-transparent"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto py-1 divide-y divide-admin-border dark:divide-slate-800">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-admin-secondary text-center">
                      No notifications.
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id} 
                        className={cn(
                          "px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer",
                          !notif.read && "bg-blue-50/50 dark:bg-blue-950/10 font-medium"
                        )}
                        onClick={async () => {
                          if (!notif.read) {
                            await notificationService.markRead(notif.id);
                            fetchNotifications();
                          }
                        }}
                      >
                        <p className="font-semibold text-admin-text">{notif.title}</p>
                        <p className="text-[10px] text-admin-secondary mt-0.5">{notif.message || notif.desc}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Profile Avatar Dropdown */}
        <Dropdown
          align="right"
          trigger={
            <button className="flex items-center gap-2 cursor-pointer focus:outline-none select-none">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-xs font-bold border border-primary/20">
                {user ? user.name.split(" ").map(n => n[0]).join("").toUpperCase() : "A"}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-admin-text leading-tight">{user?.name || "Admin"}</p>
                <p className="text-[10px] text-admin-secondary leading-none mt-0.5">{user?.role || "Administrator"}</p>
              </div>
            </button>
          }
          items={avatarDropdownItems}
        />
      </div>
    </header>
  );
}

export default TopBar;
