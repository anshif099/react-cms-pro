import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { User, Phone, Briefcase, Mail } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { motion } from "framer-motion";

const profileSchema = zod.object({
  name: zod.string().min(2, "Name must be at least 2 characters"),
  phone: zod.string().min(5, "Phone is required"),
  company: zod.string().min(2, "Company Name is required")
});

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(profileSchema)
  });

  // Sync profile details with form
  useEffect(() => {
    if (user) {
      reset({
        name: user.name || "",
        phone: user.phone || "",
        company: user.company || ""
      });
    }
  }, [user, reset]);

  const getInitials = (name) => {
    if (!name) return "A";
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const result = await updateProfile(data.name, data.phone, data.company);
      if (result.success) {
        toast.success("Profile updated successfully!");
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 text-left max-w-3xl mx-auto"
    >
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-admin-text tracking-tight">My Profile</h2>
        <p className="text-sm text-admin-secondary">Manage your administrator details and preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Avatar Card */}
        <Card className="text-center p-6 flex flex-col items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 text-primary border-2 border-primary/20 flex items-center justify-center font-extrabold text-2xl mb-4 select-none">
            {getInitials(user?.name)}
          </div>
          <h3 className="font-bold text-admin-text text-base leading-tight">{user?.name}</h3>
          <span className="text-xs text-primary font-semibold uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full mt-2 select-none">
            {user?.role}
          </span>
          
          <div className="w-full border-t border-admin-border dark:border-slate-800/80 mt-6 pt-4 text-xs text-admin-secondary leading-relaxed">
            Registered Email:
            <span className="block font-semibold text-admin-text mt-0.5 truncate" title={user?.email}>
              {user?.email}
            </span>
          </div>
        </Card>

        {/* Right Details Form */}
        <div className="md:col-span-2">
          <Card title="Account Details" subtitle="Update name and company settings">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Name */}
              <Input
                label="Full Name *"
                placeholder="e.g. Admin User"
                icon={User}
                error={errors.name?.message}
                {...register("name")}
              />

              {/* Email (Read only) */}
              <div className="flex flex-col gap-1 text-left">
                <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">
                  Admin Email Address
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={user?.email || "admin@reactcms.local"}
                    disabled
                    className="w-full text-sm py-2 pl-9 pr-3 rounded-lg border border-admin-border bg-slate-50 text-slate-500 cursor-not-allowed dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-500"
                  />
                </div>
                <span className="text-[10px] text-admin-secondary">Contact support to modify admin email address.</span>
              </div>

              {/* Phone */}
              <Input
                label="Phone Number *"
                placeholder="e.g. +1 (555) 019-2834"
                icon={Phone}
                error={errors.phone?.message}
                {...register("phone")}
              />

              {/* Company */}
              <Input
                label="Company Name *"
                placeholder="e.g. ReactCMS Ltd."
                icon={Briefcase}
                error={errors.company?.message}
                {...register("company")}
              />

              {/* Action submit button */}
              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  className="px-6 font-semibold"
                  loading={saving}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

export default ProfilePage;
