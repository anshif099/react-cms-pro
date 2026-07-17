import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ShieldCheck, 
  ArrowLeft, 
  Copy, 
  Check, 
  Download, 
  Code, 
  Server, 
  Database,
  CheckCircle2,
  Terminal,
  Activity
} from "lucide-react";
import { useWebsites } from "../../hooks/useWebsites";
import { useToast } from "../../hooks/useToast";
import { verificationService } from "../../services/verificationService";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { CodeBlock } from "../../components/ui/CodeBlock";
import { motion, AnimatePresence } from "framer-motion";

export function VerificationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { selectWebsite, selectedWebsite, updateWebsite } = useWebsites();

  const [activeTab, setActiveTab] = useState("meta"); // 'meta' | 'file' | 'dns'
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync selected website
  useEffect(() => {
    if (id) {
      async function loadWebsite() {
        const found = await selectWebsite(id);
        if (!found) {
          toast.error("Website not found.");
          navigate("/websites");
        } else if (found.verificationStatus === "verified") {
          setSuccess(true);
        }
      }
      loadWebsite();
    }
  }, [id, selectWebsite, navigate, toast]);

  if (!selectedWebsite) {
    return <div className="text-left">Loading website info...</div>;
  }

  const code = selectedWebsite.verificationCode;
  const metaTag = `<meta name="reactcms-verification" content="${code}">`;
  const fileContent = `reactcms-verification=${code}`;
  const dnsRecord = `reactcms-verification=${code}`;

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error("Failed to copy text.");
    }
  };

  const handleDownloadFile = () => {
    try {
      const element = document.createElement("a");
      const file = new Blob([fileContent], { type: "text/plain" });
      element.href = URL.createObjectURL(file);
      element.download = "reactcms-verify.txt";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      toast.success("Verification file downloaded");
    } catch (e) {
      toast.error("Failed to download file.");
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const result = await verificationService.verifyDomain(selectedWebsite.id, activeTab);
      if (result.success) {
        // Sync context
        updateWebsite(selectedWebsite.id, result.website);
        toast.info("Verification attempt initiated. The background service will verify it shortly.");
      }
    } catch (e) {
      toast.error(e.message || "Verification failed. Please check setup.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6 text-left max-w-4xl mx-auto">
      {/* Back link */}
      <div>
        <button
          onClick={() => navigate(`/websites/${selectedWebsite.id}`)}
          className="flex items-center gap-1.5 text-xs font-semibold text-admin-secondary hover:text-primary transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Details
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-admin-text tracking-tight">Domain Verification</h2>
          <p className="text-sm text-admin-secondary">
            Verify ownership of <span className="font-semibold text-admin-text">{selectedWebsite.name}</span> ({selectedWebsite.domain})
          </p>
        </div>
        <div className="flex gap-2">
          <Badge>{selectedWebsite.verificationStatus}</Badge>
          <Badge variant={selectedWebsite.status === "connected" ? "success" : "neutral"}>
            {selectedWebsite.status}
          </Badge>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {success ? (
          // Success State Card
          <motion.div
            key="success-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="w-full"
          >
            <Card className="text-center p-8 border-2 border-green-200 dark:border-green-800/40 bg-green-50/20 dark:bg-green-950/10">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-admin-text mb-2">Website Verified Successfully</h3>
              <p className="text-sm text-admin-secondary max-w-md mx-auto mb-8 leading-relaxed">
                We have verified that you own this domain. The connection status is active and you can now integrate the SDK in your React build.
              </p>

              <div className="flex flex-wrap justify-center gap-3.5">
                <Button 
                  onClick={() => navigate(`/websites/${selectedWebsite.id}`)}
                  variant="secondary"
                >
                  View Website Info
                </Button>
                <Button 
                  onClick={() => navigate(`/websites/${selectedWebsite.id}/sdk`)}
                  variant="primary"
                  className="gap-2"
                >
                  <Terminal className="w-4 h-4" />
                  Proceed to SDK Guide
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : (
          // Verification Tab Options Card
          <motion.div
            key="tabs-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-2 space-y-6">
              <Card noPadding>
                {/* Custom Tabs */}
                <div className="flex border-b border-admin-border dark:border-slate-800 select-none">
                  <button
                    onClick={() => setActiveTab("meta")}
                    className={`flex-1 py-3 text-xs font-semibold text-center uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
                      activeTab === "meta"
                        ? "border-primary text-primary"
                        : "border-transparent text-admin-secondary hover:text-admin-text"
                    }`}
                  >
                    1. Meta Tag
                  </button>
                  <button
                    onClick={() => setActiveTab("file")}
                    className={`flex-1 py-3 text-xs font-semibold text-center uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
                      activeTab === "file"
                        ? "border-primary text-primary"
                        : "border-transparent text-admin-secondary hover:text-admin-text"
                    }`}
                  >
                    2. HTML File
                  </button>
                  <button
                    onClick={() => setActiveTab("dns")}
                    className={`flex-1 py-3 text-xs font-semibold text-center uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
                      activeTab === "dns"
                        ? "border-primary text-primary"
                        : "border-transparent text-admin-secondary hover:text-admin-text"
                    }`}
                  >
                    3. DNS Record
                  </button>
                </div>

                <div className="p-6">
                  {activeTab === "meta" && (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-admin-text flex items-center gap-2">
                        <Code className="w-4 h-4 text-primary" />
                        Add a verification meta tag
                      </h4>
                      <p className="text-xs text-admin-secondary leading-relaxed">
                        Copy the meta tag below and insert it into the <code>&lt;head&gt;</code> block of your website's primary <code>index.html</code> template file, then redeploy your build.
                      </p>
                      
                      <CodeBlock code={metaTag} language="html" />
                    </div>
                  )}

                  {activeTab === "file" && (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-admin-text flex items-center gap-2">
                        <Server className="w-4 h-4 text-primary" />
                        Upload HTML Verification File
                      </h4>
                      <p className="text-xs text-admin-secondary leading-relaxed">
                        Download the verification text file below and upload it to the root public folder of your React deployment (e.g. <code>public/reactcms-verify.txt</code>) so it becomes accessible at:
                        <br />
                        <span className="font-semibold text-admin-text break-all">
                          {selectedWebsite.domain}/reactcms-verify.txt
                        </span>
                      </p>

                      <div className="flex flex-col sm:flex-row gap-3 items-center p-3 border border-admin-border dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 rounded-lg justify-between w-full">
                        <div className="text-left w-full sm:w-auto">
                          <code className="text-xs font-mono font-bold block text-admin-text">reactcms-verify.txt</code>
                          <span className="text-[10px] text-admin-secondary">Content: {fileContent}</span>
                        </div>
                        <Button 
                          onClick={handleDownloadFile} 
                          variant="outline" 
                          size="sm"
                          className="gap-1.5 w-full sm:w-auto"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download File
                        </Button>
                      </div>
                    </div>
                  )}

                  {activeTab === "dns" && (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-admin-text flex items-center gap-2">
                        <Database className="w-4 h-4 text-primary" />
                        Add DNS TXT Record
                      </h4>
                      <p className="text-xs text-admin-secondary leading-relaxed">
                        Access your domain registrar DNS administration panel and configure a new TXT record:
                      </p>
                      
                      <div className="space-y-3.5 border border-admin-border dark:border-slate-800 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <span className="font-bold text-admin-secondary">Record Type</span>
                          <span className="font-bold text-admin-secondary col-span-2">Value / Content</span>
                          <span>TXT</span>
                          <code className="font-mono text-admin-text select-all col-span-2 overflow-hidden text-ellipsis">{dnsRecord}</code>
                        </div>
                      </div>

                      <Button 
                        onClick={() => handleCopy(dnsRecord, "DNS TXT value")}
                        variant="outline" 
                        size="sm"
                        className="gap-1.5"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        Copy Record Value
                      </Button>
                    </div>
                  )}

                  {/* Verification CTA Action */}
                  <div className="mt-8 pt-6 border-t border-admin-border dark:border-slate-800 flex justify-end">
                    <Button
                      onClick={handleVerify}
                      variant="primary"
                      className="px-6 font-semibold"
                      loading={verifying}
                    >
                      {verifying ? "Verifying Domain..." : "Check Verification"}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Sidebar FAQ helper */}
            <div className="space-y-6">
              <Card title="Troubleshooting FAQ">
                <div className="space-y-4 text-xs text-admin-secondary leading-relaxed">
                  <div>
                    <h5 className="font-bold text-admin-text mb-1">How long does DNS verification take?</h5>
                    <p>DNS changes can sometimes take up to 24 hours to propagate, but usually take less than 1 hour. If it fails, try the Meta Tag method which is instant.</p>
                  </div>
                  <div className="pt-3.5 border-t border-admin-border dark:border-slate-850">
                    <h5 className="font-bold text-admin-text mb-1">What method is recommended?</h5>
                    <p>The Meta Tag method is recommended because it is the fastest to insert directly into index.html and requires no server file routing.</p>
                  </div>
                  <div className="pt-3.5 border-t border-admin-border dark:border-slate-850 flex gap-2.5 items-center">
                    <Activity className="w-4 h-4 text-primary" />
                    <span>Verifications are encrypted and checked securely over HTTPS.</span>
                  </div>
                </div>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default VerificationPage;
