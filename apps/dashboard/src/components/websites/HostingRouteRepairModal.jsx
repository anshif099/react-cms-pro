import React, { useEffect, useState } from "react";
import { Route, Server } from "lucide-react";
import sourceCredentialService from "../../services/sourceCredentialService";
import sourceProviderService from "../../services/sourceProviderService";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";

async function verifyLiveSpaFallback(domain) {
  const route = new URL(
    `/reactcms-route-check-${Date.now().toString(36)}`,
    String(domain || "")
  );
  route.searchParams.set("rcms_route_check", Date.now().toString());
  const response = await fetch(
    `/api/live-preview?probe=${encodeURIComponent(route.toString())}`,
    { method: "GET", cache: "no-store" }
  );
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || "ReactCMS could not verify the repaired live route.");
  }
  if (!result?.ok) {
    throw new Error(
      `.htaccess was written successfully, but the live server still returned HTTP ${result?.status || "unknown"}. Confirm that the connected project root is the domain's active document root and that Apache allows rewrite rules.`
    );
  }
  return result;
}

export function HostingRouteRepairModal({ isOpen, onClose, website, onRepaired }) {
  const provider = website?.connection?.provider;
  const isSftp = provider === "sftp";
  const [endpoint, setEndpoint] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [rootDirectory, setRootDirectory] = useState("");
  const [authMethod, setAuthMethod] = useState("password");
  const [credential, setCredential] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !website) return;
    setEndpoint(
      website.connection?.endpoint
      || (isSftp ? "ftp.stackcp.com" : "")
    );
    setPort(String(website.connection?.port || 22));
    setUsername(website.connection?.username || "");
    setRootDirectory(website.connection?.rootDirectory || (isSftp ? "." : "public_html"));
    setAuthMethod(
      website.connection?.authMethod
      || (website.connection?.authentication === "api-token" ? "api-token" : "password")
    );
    setCredential("");
    setError("");
    setLoading(false);
  }, [isOpen, isSftp, website]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!endpoint.trim() || !username.trim() || !credential) {
      setError(`${isSftp ? "StackCP host" : "cPanel URL"}, username, and ${isSftp ? "password" : authMethod === "password" ? "password" : "API token"} are required.`);
      return;
    }
    if (isSftp && Number(port) !== 22) {
      setError("StackCP SFTP must use port 22.");
      return;
    }

    setLoading(true);
    try {
      let resolvedRootDirectory = rootDirectory.trim() || (isSftp ? "." : "public_html");
      if (isSftp) {
        const sftpCredentials = {
          host: endpoint,
          port,
          username,
          credential
        };
        sourceCredentialService.rememberSftp(website.id, sftpCredentials);
        resolvedRootDirectory = await sourceProviderService.resolveSftpDocumentRoot(
          sftpCredentials,
          resolvedRootDirectory
        );
        setRootDirectory(resolvedRootDirectory);
      } else {
        sourceCredentialService.rememberCPanel(website.id, {
          endpoint,
          username,
          authMethod,
          credential
        });
      }

      const connection = {
        ...website.connection,
        endpoint: endpoint.trim(),
        port: isSftp ? Number(port) : website.connection?.port || null,
        username: username.trim(),
        rootDirectory: resolvedRootDirectory,
        ...(isSftp ? {} : { authMethod })
      };
      const routing = await sourceProviderService.ensureSpaRouting({
        ...website,
        connection
      });
      const liveProbe = await verifyLiveSpaFallback(website.domain);
      await onRepaired?.({
        routing,
        liveProbe,
        connection
      });
    } catch (repairError) {
      setError(repairError.message || "The live route could not be repaired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Repair Live Website Routes"
      size="md"
    >
      <form className="space-y-5 text-left" onSubmit={handleSubmit}>
        <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
          <Route className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">Configure live publishing and SPA fallback routing</p>
            <p className="mt-1 text-xs leading-5">
              ReactCMS will configure <code>.htaccess</code>, install published-style and deleted-route handling, read the files back, and confirm that the live server accepts a nested route. Credentials remain in this browser session only.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-admin-danger dark:border-red-900/40 dark:bg-red-950/20">
            {error}
          </div>
        )}

        <Input
          label={isSftp ? "StackCP SFTP Host" : "cPanel URL"}
          icon={Server}
          value={endpoint}
          onChange={(event) => setEndpoint(event.target.value)}
          placeholder={isSftp ? "ftp.stackcp.com" : "https://example.com:2083"}
          autoComplete="off"
        />

        {isSftp && (
          <Input
            label="SFTP Port"
            type="number"
            value={port}
            onChange={(event) => setPort(event.target.value)}
            autoComplete="off"
          />
        )}

        <Input
          label={isSftp ? "SFTP Username" : "cPanel Username"}
          name={`reactcms-${isSftp ? "sftp" : "cpanel"}-username`}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />

        <Input
          label="Website Document Root"
          value={rootDirectory}
          onChange={(event) => setRootDirectory(event.target.value)}
          placeholder={isSftp ? "." : "public_html"}
          helperText={isSftp
            ? "ReactCMS will automatically check this directory, public_html, and the FTP account root for the live index.html file."
            : "Use the same directory that contains the live index.html file."}
          autoComplete="off"
        />

        {!isSftp && (
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-admin-secondary">Authentication</label>
            <select
              value={authMethod}
              onChange={(event) => setAuthMethod(event.target.value)}
              className="w-full rounded-lg border border-admin-border bg-white px-3 py-2 text-sm text-admin-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="password">Password</option>
              <option value="api-token">API Token</option>
            </select>
          </div>
        )}

        <Input
          label={isSftp ? "SFTP Password" : authMethod === "password" ? "cPanel Password" : "cPanel API Token"}
          type="password"
          name={`reactcms-${isSftp ? "sftp" : "cpanel"}-credential`}
          value={credential}
          onChange={(event) => setCredential(event.target.value)}
          autoComplete="new-password"
          spellCheck={false}
        />

        <div className="flex justify-end gap-2 border-t border-admin-border pt-4 dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading} className="gap-2">
            <Route className="h-4 w-4" />
            Repair and Verify Route
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default HostingRouteRepairModal;
