import React, { createContext, useState, useContext, useCallback } from "react";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, message, duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    
    if (duration) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((msg, dur) => addToast("success", msg, dur), [addToast]);
  const error = useCallback((msg, dur) => addToast("error", msg, dur), [addToast]);
  const info = useCallback((msg, dur) => addToast("info", msg, dur), [addToast]);
  const warning = useCallback((msg, dur) => addToast("warning", msg, dur), [addToast]);

  const toastHelpers = { success, error, info, warning };

  return (
    <ToastContext.Provider value={toastHelpers}>
      {children}
      {/* Global Toast Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
              className="pointer-events-auto"
            >
              <ToastItem toast={toast} onClose={() => removeToast(toast.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-admin-success" />,
    error: <XCircle className="w-5 h-5 text-admin-danger" />,
    warning: <AlertCircle className="w-5 h-5 text-admin-warning" />,
    info: <Info className="w-5 h-5 text-primary" />
  };

  const bgColors = {
    success: "border-admin-success bg-white dark:bg-slate-800",
    error: "border-admin-danger bg-white dark:bg-slate-800",
    warning: "border-admin-warning bg-white dark:bg-slate-800",
    info: "border-primary bg-white dark:bg-slate-800"
  };

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border-l-4 shadow-lg ${bgColors[toast.type]} text-admin-text transition-all duration-300`}>
      <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 text-sm font-medium pr-2">{toast.message}</div>
      <button 
        onClick={onClose} 
        className="flex-shrink-0 text-admin-secondary hover:text-admin-text transition-colors p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
