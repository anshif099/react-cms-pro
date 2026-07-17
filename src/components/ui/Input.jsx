import React, { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../utils/cn";

export const Input = forwardRef(({
  label,
  error,
  type = "text",
  placeholder,
  className,
  icon: Icon,
  helperText,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;

  return (
    <div className={cn("flex flex-col gap-1 w-full text-left", className)}>
      {label && (
        <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3 text-admin-secondary pointer-events-none">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          ref={ref}
          type={inputType}
          placeholder={placeholder}
          className={cn(
            "w-full text-sm py-2 px-3 rounded-lg border bg-white text-admin-text transition-all duration-200 outline-none",
            "border-admin-border hover:border-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600 focus:border-primary focus:ring-2 focus:ring-primary/25",
            Icon ? "pl-9" : "",
            isPassword ? "pr-9" : "",
            error ? "border-admin-danger focus:border-admin-danger focus:ring-admin-danger/25" : ""
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 text-admin-secondary hover:text-admin-text transition-colors cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && (
        <span className="text-xs text-admin-danger font-medium">{error}</span>
      )}
      {helperText && !error && (
        <span className="text-xs text-admin-secondary">{helperText}</span>
      )}
    </div>
  );
});

Input.displayName = "Input";
export default Input;
