import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { Globe, ArrowLeft, Key, HelpCircle, Eye, EyeOff } from "lucide-react";
import { useWebsites } from "../../hooks/useWebsites";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../hooks/useAuth";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { generateWebsiteId, generateApiKey, generateSecretKey } from "../../utils/generators";
import { motion } from "framer-motion";

const connectSchema = zod.object({
  name: zod.string().min(2, "Website name must be at least 2 characters"),
  domain: zod.string().min(1, "Domain URL is required").url("Must be a valid URL (e.g. https://example.com)"),
  framework: zod.enum(["React", "React + Vite", "Next.js", "Other"], {
    errorMap: () => ({ message: "Please select a framework" })
  }),
  hosting: zod.enum(["cPanel", "VPS", "Cloud", "Other"], {
    errorMap: () => ({ message: "Please select a hosting provider" })
  }),
  ownerName: zod.string().min(2, "Owner name is required"),
  ownerEmail: zod.string().min(1, "Owner email is required").email("Invalid email format")
});

export function ConnectWebsitePage() {
  const { createWebsite } = useWebsites();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  
  // Generating visual read-only placeholders to showcase dynamic keygen
  const [mockId] = useState(() => generateWebsiteId());
  const [mockApiKey, setMockApiKey] = useState(() => generateApiKey());
  const [mockSecretKey, setMockSecretKey] = useState(() => generateSecretKey());
  const [showSecret, setShowSecret] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch, reset } = useForm({
    resolver: zodResolver(connectSchema),
    defaultValues: {
      name: "",
      domain: "",
      framework: "React + Vite",
      hosting: "cPanel",
      ownerName: "",
      ownerEmail: ""
    }
  });

  useEffect(() => {
    if (user) {
      reset({
        name: "",
        domain: "",
        framework: "React + Vite",
        hosting: "cPanel",
        ownerName: user.name || "",
        ownerEmail: user.email || ""
      });
    }
  }, [user, reset]);

  const onSubmit = async (data) => {
    try {
      // Create website using local storage service
      const created = await createWebsite({
        ...data,
        id: mockId,
        apiKey: mockApiKey,
        secretKey: mockSecretKey
      });
      
      toast.success(`Website "${created.name}" connected!`);
      // Redirect straight to verification page of the newly created website
      navigate(`/websites/${created.id}/verify`);
    } catch (e) {
      toast.error("Failed to connect website.");
    }
  };

  const handleRegenerateKeys = () => {
    setMockApiKey(generateApiKey());
    setMockSecretKey(generateSecretKey());
    toast.info("Regenerated temporary key pairs");
  };

  return (
    <div className="space-y-6 text-left max-w-4xl mx-auto">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate("/websites")}
          className="flex items-center gap-1.5 text-xs font-semibold text-admin-secondary hover:text-primary transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Websites
        </button>
      </div>

      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-admin-text tracking-tight">Connect Website</h2>
        <p className="text-sm text-admin-secondary">Register a new domain and generate SDK access credentials</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Core details card */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Website Details" subtitle="Provide information about the website deployment">
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Website Name */}
                <Input
                  label="Website Name *"
                  placeholder="e.g. Triosis"
                  error={errors.name?.message}
                  {...register("name")}
                />

                {/* Domain URL */}
                <Input
                  label="Domain URL (with https://) *"
                  placeholder="e.g. https://triosis.in"
                  error={errors.domain?.message}
                  {...register("domain")}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Framework Selector */}
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">
                    Framework *
                  </label>
                  <select
                    className="w-full text-sm py-2 px-3 rounded-lg border border-admin-border bg-white text-admin-text outline-none dark:border-slate-700 dark:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    {...register("framework")}
                  >
                    <option value="React">React</option>
                    <option value="React + Vite">React + Vite</option>
                    <option value="Next.js">Next.js</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.framework?.message && (
                    <span className="text-xs text-admin-danger font-medium">{errors.framework.message}</span>
                  )}
                </div>

                {/* Hosting Selector */}
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">
                    Hosting Provider *
                  </label>
                  <select
                    className="w-full text-sm py-2 px-3 rounded-lg border border-admin-border bg-white text-admin-text outline-none dark:border-slate-700 dark:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    {...register("hosting")}
                  >
                    <option value="cPanel">cPanel</option>
                    <option value="VPS">VPS</option>
                    <option value="Cloud">Cloud</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.hosting?.message && (
                    <span className="text-xs text-admin-danger font-medium">{errors.hosting.message}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-admin-border dark:border-slate-800/80">
                {/* Owner Name */}
                <Input
                  label="Owner Contact Name *"
                  placeholder="e.g. John Doe"
                  error={errors.ownerName?.message}
                  {...register("ownerName")}
                />

                {/* Owner Email */}
                <Input
                  label="Owner Email Address *"
                  placeholder="e.g. john@triosis.in"
                  error={errors.ownerEmail?.message}
                  {...register("ownerEmail")}
                />
              </div>
            </div>
          </Card>
          
          {/* Actions */}
          <div className="flex items-center justify-end gap-3.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/websites")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="px-6"
            >
              Connect Website
            </Button>
          </div>
        </div>

        {/* Sidebar keygen info */}
        <div className="space-y-6">
          <Card title="SDK Credentials" subtitle="Automatically generated secure credentials">
            <div className="space-y-5">
              {/* Web ID */}
              <div>
                <span className="text-[10px] font-semibold text-admin-secondary uppercase tracking-wider block mb-1">
                  Website ID
                </span>
                <code className="block w-full py-1.5 px-3 border border-admin-border dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs font-mono select-all overflow-hidden text-ellipsis">
                  {mockId}
                </code>
              </div>

              {/* API Key */}
              <div>
                <span className="text-[10px] font-semibold text-admin-secondary uppercase tracking-wider block mb-1">
                  API Key
                </span>
                <code className="block w-full py-1.5 px-3 border border-admin-border dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs font-mono select-all overflow-hidden text-ellipsis">
                  {mockApiKey}
                </code>
              </div>

              {/* Secret Key */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-semibold text-admin-secondary uppercase tracking-wider">
                    Secret Key
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-[10px] text-primary hover:underline flex items-center cursor-pointer"
                  >
                    {showSecret ? <EyeOff className="w-3 h-3 mr-0.5" /> : <Eye className="w-3 h-3 mr-0.5" />}
                    {showSecret ? "Hide" : "Show"}
                  </button>
                </div>
                <code className="block w-full py-1.5 px-3 border border-admin-border dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs font-mono select-all overflow-hidden text-ellipsis">
                  {showSecret ? mockSecretKey : "••••••••••••••••••••••••"}
                </code>
              </div>

              <div className="pt-2">
                <Button 
                  onClick={handleRegenerateKeys} 
                  variant="outline" 
                  size="sm"
                  className="w-full gap-2 text-xs font-semibold py-1.5"
                >
                  <Key className="w-3.5 h-3.5" />
                  Regenerate Keys
                </Button>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-slate-800/60 rounded-lg flex items-start gap-2.5 text-xs text-admin-secondary leading-relaxed mt-4">
                <HelpCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span>
                  The secret key should never be checked into code. It must be kept private to allow secure content updates.
                </span>
              </div>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}

export default ConnectWebsitePage;
// Note: This connects domain and redirects user to verify route.
