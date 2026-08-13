import React, { useEffect, useState } from "react";
import { Check, Copy, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { generateClientAdminEmail, generateSecurePassword } from "../../utils/generators";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";

export function ClientAdminModal({ isOpen, onClose, website, onCreated }) {
  const { createClientAdmin, sendClientPasswordReset } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdAccount, setCreatedAccount] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !website) return;
    setName(website.ownerName || `${website.name} Admin`);
    setEmail(generateClientAdminEmail(website, Boolean(website.clientAdmin?.uid)));
    setPassword(generateSecurePassword());
    setError("");
    setCreatedAccount(null);
    setCopied(false);
  }, [isOpen, website]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Enter a name for the client administrator.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid client administrator email.");
      return;
    }
    if (password.length < 12) {
      setError("Use a password with at least 12 characters.");
      return;
    }

    setLoading(true);
    const result = await createClientAdmin(website, { name, email, password });
    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    const account = { ...result.account, password };
    setCreatedAccount(account);
    onCreated?.(account);
    toast.success("Client administrator login created");
  };

  const handleCopy = async () => {
    if (!createdAccount) return;
    await navigator.clipboard.writeText(
      `ReactCMS client login for ${website.name}\nEmail: ${createdAccount.email}\nPassword: ${createdAccount.password}\nLogin: ${window.location.origin}/login`
    );
    setCopied(true);
    toast.success("Login details copied");
  };

  const handlePasswordReset = async () => {
    setResetLoading(true);
    const result = await sendClientPasswordReset(website.clientAdmin.email);
    setResetLoading(false);
    if (result.success) {
      toast.success("Password reset email sent to the client administrator");
    } else {
      setError(result.message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={createdAccount ? "Client Login Created" : "Client Administrator Login"}
      size="md"
    >
      {createdAccount ? (
        <div className="space-y-5 text-left">
          <div className="flex gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300">
            <ShieldCheck className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">The account is ready to use.</p>
              <p className="mt-1 text-xs">Copy these details now. The generated password is not stored and cannot be shown again.</p>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-admin-border bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-admin-secondary">Website</span>
              <p className="text-sm font-semibold text-admin-text">{website.name}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-admin-secondary">Admin Email</span>
              <code className="block select-all break-all text-sm text-admin-text">{createdAccount.email}</code>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-admin-secondary">Password</span>
              <code className="block select-all break-all text-sm text-admin-text">{createdAccount.password}</code>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-admin-secondary">Login URL</span>
              <code className="block select-all break-all text-sm text-admin-text">{window.location.origin}/login</code>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Done</Button>
            <Button type="button" className="gap-2" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy Login Details"}
            </Button>
          </div>
        </div>
      ) : (
        <form className="space-y-5 text-left" onSubmit={handleSubmit}>
          {website?.clientAdmin?.uid && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
              <p className="font-semibold">Current login: {website.clientAdmin.email}</p>
              <p className="mt-1">Creating a replacement disables the current profile and assigns the website to the new login.</p>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="mt-3"
                loading={resetLoading}
                onClick={handlePasswordReset}
              >
                Send Password Reset Email
              </Button>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-admin-danger dark:border-red-900/40 dark:bg-red-950/20">
              {error}
            </div>
          )}

          <Input
            label="Client Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Website administrator"
            autoComplete="off"
          />
          <Input
            label="Admin Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            helperText="This is the username the client will enter on the ReactCMS login page."
            autoComplete="off"
          />
          <div className="flex items-end gap-2">
            <Input
              label="Generated Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              helperText="Shown once after account creation."
              autoComplete="new-password"
            />
            <Button
              type="button"
              variant="secondary"
              className="mb-5 h-[38px] flex-shrink-0 px-3"
              title="Generate another password"
              onClick={() => setPassword(generateSecurePassword())}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-admin-border p-3 text-xs text-admin-secondary dark:border-slate-700">
            <KeyRound className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <p>The client will only see and manage <strong className="text-admin-text">{website?.name}</strong>. The super-admin login remains unchanged.</p>
          </div>

          <div className="flex justify-end gap-2 border-t border-admin-border pt-4 dark:border-slate-800">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={loading} className="gap-2">
              <KeyRound className="h-4 w-4" />
              {website?.clientAdmin?.uid ? "Create Replacement Login" : "Create Client Login"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default ClientAdminModal;
