import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { Lock, Mail, ShieldAlert } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { motion } from "framer-motion";

const loginSchema = zod.object({
  email: zod.string().min(1, "Email is required").email("Invalid email format"),
  password: zod.string().min(1, "Password is required"),
  rememberMe: zod.boolean().optional()
});

export function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false
    }
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const result = await login(data.email, data.password);
      if (result.success) {
        toast.success("Welcome back! Redirecting...");
      } else {
        setErrorMsg(result.message);
        toast.error(result.message);
      }
    } catch (err) {
      setErrorMsg("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-admin-bg dark:bg-slate-900 p-6 transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Brand */}
        <div className="flex flex-col items-center mb-8 text-center select-none">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-white font-black text-xl mb-3 shadow-md shadow-primary/30">
            RC
          </div>
          <h2 className="text-2xl font-black text-admin-text tracking-tight">
            ReactCMS <span className="text-primary font-black uppercase text-xs bg-primary/10 px-2 py-0.5 rounded-full ml-1">Pro</span>
          </h2>
          <p className="text-sm text-admin-secondary mt-1">Enterprise dashboard for React websites</p>
        </div>

        <Card className="shadow-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <h3 className="text-lg font-bold text-admin-text text-left border-b border-admin-border dark:border-slate-800 pb-3">
              Administrator Login
            </h3>

            {errorMsg && (
              <div className="flex gap-2.5 p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-admin-danger dark:bg-red-950/20 dark:border-red-900/40">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Email input */}
            <Input
              label="Admin Email"
              type="email"
              icon={Mail}
              placeholder="e.g. admin@reactcms.local"
              error={errors.email?.message}
              {...register("email")}
            />

            {/* Password input */}
            <Input
              label="Password"
              type="password"
              icon={Lock}
              placeholder="••••••••••••"
              error={errors.password?.message}
              {...register("password")}
            />

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs select-none">
              <label className="flex items-center gap-2 font-medium text-admin-secondary cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-admin-border dark:border-slate-700 text-primary focus:ring-primary w-4 h-4"
                  {...register("rememberMe")}
                />
                <span>Remember me</span>
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full py-2.5 shadow-md shadow-primary/20"
              loading={loading}
            >
              Sign In
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}

export default LoginPage;
