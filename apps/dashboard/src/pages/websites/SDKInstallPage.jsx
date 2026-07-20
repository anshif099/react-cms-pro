import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Terminal, 
  Play, 
  CheckCircle, 
  Globe, 
  ShieldCheck, 
  RefreshCw 
} from "lucide-react";
import { useWebsites } from "../../hooks/useWebsites";
import { useToast } from "../../hooks/useToast";
import { sdkService } from "../../services/sdkService";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { CodeBlock } from "../../components/ui/CodeBlock";
import { Badge } from "../../components/ui/Badge";
import { motion } from "framer-motion";

export function SDKInstallPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { selectWebsite, selectedWebsite, updateWebsite } = useWebsites();

  const [testing, setTesting] = useState(false);

  // Sync selected website
  useEffect(() => {
    if (id) {
      async function loadWebsite() {
        const found = await selectWebsite(id);
        if (!found) {
          toast.error("Website not found.");
          navigate("/websites");
        }
      }
      loadWebsite();
    }
  }, [id, selectWebsite, navigate, toast]);

  if (!selectedWebsite) {
    return <div className="text-left py-4">Loading SDK documentation...</div>;
  }

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const result = await sdkService.testConnection(selectedWebsite.id);
      if (result.success) {
        // Sync context
        updateWebsite(selectedWebsite.id, result.website);
        toast.success("SDK Connection established successfully!");
      }
    } catch (e) {
      toast.error(e.message || "Failed to establish SDK connection.");
    } finally {
      setTesting(false);
    }
  };

  const codeSnippet = sdkService.getProviderSnippet(selectedWebsite);

  return (
    <div className="space-y-6 text-left max-w-4xl mx-auto">
      {/* Back button */}
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
          <h2 className="text-2xl font-bold text-admin-text tracking-tight">Install ReactCMS SDK</h2>
          <p className="text-sm text-admin-secondary">
            Integrate the client package on <span className="font-semibold text-admin-text">{selectedWebsite.name}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Badge>{selectedWebsite.verificationStatus}</Badge>
          <Badge variant={selectedWebsite.status === "connected" ? "success" : "neutral"}>
            {selectedWebsite.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Step-by-step Guides */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Integration Steps" subtitle="Follow instructions to link your React frontend">
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-sm text-admin-text flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold font-sans">1</span>
                  Install the package via NPM
                </h4>
                <p className="text-xs text-admin-secondary">
                  Open your terminal inside the root directory of your React website project and run:
                </p>
                <CodeBlock code={sdkService.getInstallCommand()} language="bash" />
              </div>

              {/* Step 2 */}
              <div className="space-y-2.5 pt-4 border-t border-admin-border dark:border-slate-800/80">
                <h4 className="font-bold text-sm text-admin-text flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold font-sans">2</span>
                  Configure CMS Provider in your Root Component
                </h4>
                <p className="text-xs text-admin-secondary">
                  Import the provider and wrap your primary App component layout, configuring the credentials:
                </p>
                <CodeBlock code={codeSnippet} language="jsx" />
              </div>
            </div>
          </Card>
        </div>

        {/* Sync checking side panel */}
        <div className="space-y-6">
          {/* Status Display Card */}
          <Card title="Sync Check">
            <div className="space-y-5 text-xs text-admin-secondary">
              <div className="space-y-3.5">
                <div className="flex justify-between items-center">
                  <span>Connection State</span>
                  <Badge variant={selectedWebsite.status === "connected" ? "success" : "neutral"}>
                    {selectedWebsite.status}
                  </Badge>
                </div>
                <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                  <span>SDK Installed</span>
                  <span className="font-bold text-admin-text">{selectedWebsite.sdkInstalled ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                  <span>SDK Version</span>
                  <span className="font-bold text-admin-text">{selectedWebsite.sdkVersion || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                  <span>Environment</span>
                  <span className="font-semibold text-admin-text bg-slate-100 dark:bg-slate-800 py-0.5 px-2 rounded border border-admin-border dark:border-slate-800">
                    production
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-admin-border dark:border-slate-800/80">
                <Button
                  onClick={handleTestConnection}
                  variant="primary"
                  className="w-full gap-2 font-bold py-2.5 shadow-md shadow-primary/10"
                  loading={testing}
                >
                  <RefreshCw className={`w-4 h-4 ${testing ? "animate-spin" : ""}`} />
                  Test Connection
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default SDKInstallPage;
