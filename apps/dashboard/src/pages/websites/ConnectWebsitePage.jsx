import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import {
  Archive,
  ArrowLeft,
  FolderGit2,
  Info,
  UploadCloud
} from "lucide-react";
import { useWebsites } from "../../hooks/useWebsites";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../hooks/useAuth";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import sourceImportService from "../../services/sourceImportService";

const connectSchema = zod.object({
  name: zod.string().min(2, "Website name must be at least 2 characters"),
  domain: zod.string().min(1, "Domain URL is required").url("Enter a full URL, including https://"),
  connectionProvider: zod.enum(["github", "cpanel"]),
  repositoryUrl: zod.string().optional(),
  branch: zod.string().optional(),
  rootDirectory: zod.string().optional(),
  githubToken: zod.string().optional(),
  ownerName: zod.string().min(2, "Owner name is required"),
  ownerEmail: zod.string().email("Enter a valid owner email")
}).superRefine((data, context) => {
  if (data.connectionProvider === "github" && !data.repositoryUrl?.trim()) {
    context.addIssue({
      code: "custom",
      path: ["repositoryUrl"],
      message: "GitHub repository URL is required"
    });
  }
});

export function ConnectWebsitePage() {
  const {
    createWebsite,
    importRoutes,
    updateWebsite
  } = useWebsites();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [archiveFile, setArchiveFile] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [progress, setProgress] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset
  } = useForm({
    resolver: zodResolver(connectSchema),
    defaultValues: {
      name: "",
      domain: "",
      connectionProvider: "github",
      repositoryUrl: "",
      branch: "",
      rootDirectory: "",
      githubToken: "",
      ownerName: "",
      ownerEmail: ""
    }
  });

  const provider = watch("connectionProvider");

  useEffect(() => {
    if (!user) return;
    reset((current) => ({
      ...current,
      ownerName: user.name || current.ownerName,
      ownerEmail: user.email || current.ownerEmail
    }));
  }, [reset, user]);

  const onSubmit = async (data) => {
    if (data.connectionProvider === "cpanel" && !archiveFile) {
      toast.error("Choose the ZIP source backup downloaded from cPanel.");
      return;
    }

    setConnecting(true);
    setProgress("Preparing source import...");
    let createdWebsite = null;
    try {
      const imported = data.connectionProvider === "github"
        ? await sourceImportService.importGitHub({
          repositoryUrl: data.repositoryUrl,
          branch: data.branch,
          rootDirectory: data.rootDirectory,
          token: data.githubToken,
          onProgress: setProgress
        })
        : await sourceImportService.importCPanelArchive({
          file: archiveFile,
          rootDirectory: data.rootDirectory,
          onProgress: setProgress
        });
      if (imported.manifest.tokenIgnored) {
        toast.info("The invalid token was ignored because this repository is public.");
      }
      if (imported.manifest.rootIgnored) {
        toast.info("Project Root matched the branch name, so the repository root was used.");
      }

      setProgress("Creating website record...");
      createdWebsite = await createWebsite({
        name: data.name,
        domain: data.domain,
        framework: imported.manifest.framework,
        hosting: data.connectionProvider === "cpanel" ? "cPanel" : "GitHub",
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
        connectionProvider: data.connectionProvider,
        connection: {
          provider: data.connectionProvider,
          status: "importing",
          repository: imported.manifest.repository,
          branch: imported.manifest.branch,
          rootDirectory: imported.manifest.rootDirectory,
          sourceRevision: imported.manifest.revision,
          authentication: imported.manifest.authentication
        }
      });

      const codebase = await sourceImportService.persistCodebase(
        createdWebsite.id,
        imported,
        setProgress
      );

      setProgress(`Importing ${imported.routes.length} discovered pages...`);
      await importRoutes(
        createdWebsite.id,
        imported.routes,
        user?.email || user?.uid || "system"
      );

      await updateWebsite(createdWebsite.id, {
        framework: imported.manifest.framework,
        status: "connected",
        verificationStatus: "verified",
        sdkInstalled: false,
        connectionHealth: "healthy",
        sourceConnected: true,
        connection: {
          provider: data.connectionProvider,
          status: "ready",
          repository: imported.manifest.repository,
          branch: imported.manifest.branch,
          rootDirectory: imported.manifest.rootDirectory,
          sourceRevision: imported.manifest.revision,
          authentication: imported.manifest.authentication,
          artifactPath: codebase.artifactPath,
          fileCount: imported.manifest.fileCount,
          routeCount: imported.routes.length,
          importedAt: Date.now()
        }
      });

      toast.success(
        `${data.name} source imported with ${imported.routes.length} page${imported.routes.length === 1 ? "" : "s"}.`
      );
      navigate(`/content/${createdWebsite.id}/pages`);
    } catch (error) {
      console.error("Source connection failed", error);
      if (createdWebsite) {
        try {
          await updateWebsite(createdWebsite.id, {
            status: "error",
            connectionHealth: "error",
            "connection/status": "error",
            "connection/error": error.message
          });
        } catch (updateError) {
          console.error("Could not persist import failure", updateError);
        }
      }
      toast.error(error.message || "Website source could not be imported.");
    } finally {
      setConnecting(false);
      setProgress("");
    }
  };

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto">
      <button
        type="button"
        onClick={() => navigate("/websites")}
        className="flex items-center gap-1.5 text-xs font-semibold text-admin-secondary hover:text-primary transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Websites
      </button>

      <div>
        <h2 className="text-2xl font-bold text-admin-text tracking-tight">
          Import Website Source
        </h2>
        <p className="text-sm text-admin-secondary mt-1">
          Connect the codebase directly. No ReactCMS SDK or npm package is required.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Connection Method" subtitle="Choose where ReactCMS should read the website source">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`rounded-xl border p-4 cursor-pointer transition-colors ${
                provider === "github"
                  ? "border-primary bg-primary/5"
                  : "border-admin-border dark:border-slate-800 hover:border-slate-600"
              }`}>
                <input
                  type="radio"
                  value="github"
                  className="sr-only"
                  {...register("connectionProvider")}
                />
                <FolderGit2 className="w-6 h-6 text-admin-text" />
                <span className="block mt-3 text-sm font-bold text-admin-text">GitHub Repository</span>
                <span className="block mt-1 text-xs leading-5 text-admin-secondary">
                  Download a branch directly from a public or token-authorized repository.
                </span>
              </label>

              <label className={`rounded-xl border p-4 cursor-pointer transition-colors ${
                provider === "cpanel"
                  ? "border-primary bg-primary/5"
                  : "border-admin-border dark:border-slate-800 hover:border-slate-600"
              }`}>
                <input
                  type="radio"
                  value="cpanel"
                  className="sr-only"
                  {...register("connectionProvider")}
                />
                <Archive className="w-6 h-6 text-admin-text" />
                <span className="block mt-3 text-sm font-bold text-admin-text">cPanel Source Backup</span>
                <span className="block mt-1 text-xs leading-5 text-admin-secondary">
                  Import a ZIP created in cPanel File Manager without sharing cPanel credentials.
                </span>
              </label>
            </div>
          </Card>

          <Card title="Website Details" subtitle="Identify the deployed website and project owner">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                label="Website Name *"
                placeholder="e.g. Triosis"
                error={errors.name?.message}
                {...register("name")}
              />
              <Input
                label="Live Domain *"
                placeholder="https://triosis.vercel.app"
                error={errors.domain?.message}
                {...register("domain")}
              />
              <Input
                label="Owner Name *"
                placeholder="Website owner"
                error={errors.ownerName?.message}
                {...register("ownerName")}
              />
              <Input
                label="Owner Email *"
                placeholder="owner@example.com"
                error={errors.ownerEmail?.message}
                {...register("ownerEmail")}
              />
            </div>
          </Card>

          {provider === "github" ? (
            <Card title="GitHub Source" subtitle="The token is held in memory for this import only and is never stored">
              <div className="space-y-5">
                <Input
                  label="Repository URL *"
                  placeholder="https://github.com/owner/repository"
                  error={errors.repositoryUrl?.message}
                  {...register("repositoryUrl")}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input
                    label="Branch"
                    placeholder="Default branch"
                    helperText="For Triosis use main."
                    {...register("branch")}
                  />
                  <Input
                    label="Project Root"
                    placeholder="Empty for repository root"
                    helperText="Leave empty unless package.json is inside a subfolder. Do not enter the branch here."
                    {...register("rootDirectory")}
                  />
                </div>
                <Input
                  type="password"
                  label="Fine-grained Token (private repo only)"
                  placeholder="Leave empty for a public repository"
                  helperText="Triosis is public, so leave this field empty."
                  autoComplete="off"
                  {...register("githubToken")}
                />
              </div>
            </Card>
          ) : (
            <Card title="cPanel Source Backup" subtitle="In cPanel File Manager, compress the source project folder as ZIP, then select it here">
              <div className="space-y-5">
                <label className="min-h-36 rounded-xl border-2 border-dashed border-slate-700 hover:border-primary bg-slate-950/20 grid place-items-center cursor-pointer transition-colors">
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    className="sr-only"
                    onChange={(event) => setArchiveFile(event.target.files?.[0] || null)}
                  />
                  <span className="text-center px-6 py-5">
                    <UploadCloud className="w-7 h-7 text-primary mx-auto" />
                    <span className="block mt-2 text-sm font-bold text-admin-text">
                      {archiveFile ? archiveFile.name : "Choose cPanel source ZIP"}
                    </span>
                    <span className="block mt-1 text-xs text-admin-secondary">
                      Maximum compressed size: 50 MB
                    </span>
                  </span>
                </label>
                <Input
                  label="Project Root Inside ZIP"
                  placeholder="e.g. public_html or app (optional)"
                  {...register("rootDirectory")}
                />
              </div>
            </Card>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate("/websites")}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={connecting} className="px-6">
              {connecting ? "Importing Source..." : "Import Website"}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card title="What gets imported">
            <div className="space-y-3 text-xs leading-5 text-admin-secondary">
              <p>ReactCMS stores the complete ZIP as a versioned source artifact.</p>
              <p>Framework, source files, routes, branch, and revision are indexed for the Pages module.</p>
              <p>No SDK credentials or npm installation are generated.</p>
            </div>
          </Card>

          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 flex gap-3">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs leading-5 text-admin-secondary">
              Arbitrary React code is not executed inside the dashboard. A page must produce an
              editor-safe native component tree before it can be rendered and edited. Unsupported
              pages show their real source status, never a fabricated template.
            </p>
          </div>

          {connecting && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs font-bold text-primary">Import in progress</p>
              <p className="text-xs text-admin-secondary mt-1">{progress}</p>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

export default ConnectWebsitePage;
