import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveRestore,
  Bot,
  Boxes,
  BrainCircuit,
  Check,
  ChevronDown,
  Circle,
  Clock3,
  Code2,
  Database,
  FileClock,
  Image as ImageIcon,
  Lightbulb,
  ListChecks,
  Loader2,
  LogOut,
  MessageSquare,
  PanelRightClose,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  TriangleAlert,
  X
} from "lucide-react";
import BLOCK_SCHEMAS from "../blocks/blockSchemas";
import aiBuilderPersistenceService, {
  parseAISnapshot
} from "../../services/aiBuilderPersistenceService";
import aiWebsiteAgentService from "../../services/aiWebsiteAgentService";
import { auditAIContext } from "../../services/aiWebsiteContextService";
import mediaService from "../../services/mediaService";
import rocketAIAuthService from "../../services/rocketAIAuthService";

const TABS = [
  { id: "chat", label: "Rocket Chat", icon: MessageSquare },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "history", label: "History", icon: FileClock },
  { id: "suggestions", label: "Suggestions", icon: Lightbulb },
  { id: "components", label: "Components", icon: Boxes },
  { id: "assets", label: "Assets", icon: ImageIcon },
  { id: "knowledge", label: "Knowledge", icon: BrainCircuit },
  { id: "console", label: "Console", icon: SquareTerminal }
];

const QUICK_REQUESTS = [
  "Make this page feel premium while preserving the brand",
  "Review the full page and fix the biggest UX issues",
  "Improve the mobile layout and spacing",
  "Improve accessibility, readability, SEO, and conversions",
  "Add a persuasive FAQ and final call to action",
  "Create a complete SaaS landing page"
];

const MEMORY_FIELDS = [
  ["companyInfo", "Company information"],
  ["brandVoice", "Brand voice"],
  ["targetAudience", "Target audience"],
  ["businessGoals", "Business goals"],
  ["preferredColors", "Preferred colors"],
  ["preferredLayout", "Preferred layout"],
  ["typography", "Typography"],
  ["designLanguage", "Design language"]
];

function dateLabel(value) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function generatedImageFile(base64, pageTitle, mimeType = "image/png") {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const safeTitle = String(pageTitle || "website")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "website";
  const extension = mimeType === "image/svg+xml" ? "svg" : "png";
  return new File(
    [bytes],
    `${safeTitle}-ai-${Date.now()}.${extension}`,
    { type: mimeType }
  );
}

function StatusIcon({ status }) {
  if (status === "applying") return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />;
  if (status === "applied") return <Check className="h-3.5 w-3.5 text-emerald-400" />;
  if (status === "failed") return <TriangleAlert className="h-3.5 w-3.5 text-rose-400" />;
  return <Circle className="h-3.5 w-3.5 text-slate-600" />;
}

function EmptyPanel({ icon: Icon, title, children }) {
  return (
    <div className="grid min-h-60 place-items-center px-6 text-center">
      <div>
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-slate-800 bg-slate-950/60">
          <Icon className="h-5 w-5 text-slate-600" />
        </div>
        <h3 className="mt-3 text-xs font-bold text-slate-300">{title}</h3>
        <p className="mt-1.5 text-[10px] leading-5 text-slate-600">{children}</p>
      </div>
    </div>
  );
}

function PlanCard({ plan, busy, onApprove, onModify, onCancel }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-xl border border-violet-500/25 bg-violet-500/[0.07] p-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-2 text-left cursor-pointer"
      >
        <div className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-violet-500/15">
          <Sparkles className="h-3.5 w-3.5 text-violet-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-violet-300">
            Planned changes
          </p>
          <h3 className="mt-0.5 text-xs font-bold text-white">{plan.title}</h3>
          <p className="mt-1 text-[10px] leading-4 text-slate-400">{plan.summary}</p>
        </div>
        <ChevronDown className={`mt-1 h-3.5 w-3.5 text-slate-600 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-[8px] font-bold text-violet-200">
              {plan.estimatedEdits || plan.operations.length} edits
            </span>
            <span className="rounded-full border border-slate-700 px-2 py-1 text-[8px] font-bold capitalize text-slate-400">
              {plan.risk} risk
            </span>
            {(plan.affectedAreas || []).slice(0, 4).map((area) => (
              <span key={area} className="rounded-full border border-slate-800 px-2 py-1 text-[8px] text-slate-500">
                {area}
              </span>
            ))}
          </div>

          <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto pr-1">
            {plan.operations.map((operation) => (
              <div key={operation.id} className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-2.5 py-2">
                <div className="flex gap-2">
                  <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-violet-300" />
                  <div>
                    <p className="text-[10px] font-semibold text-slate-200">{operation.summary}</p>
                    <p className="mt-0.5 text-[9px] leading-4 text-slate-600">{operation.reason}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!!plan.preserved?.length && (
            <div className="mt-3 flex gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-2.5">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
              <p className="text-[9px] leading-4 text-emerald-200/70">
                Preserving {plan.preserved.join(", ")}.
              </p>
            </div>
          )}

          <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="h-8 rounded-lg bg-violet-600 px-3 text-[10px] font-bold text-white hover:bg-violet-500 disabled:opacity-50 cursor-pointer"
            >
              {busy ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : "Approve & apply"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onModify}
              className="h-8 rounded-lg border border-slate-700 px-2.5 text-[9px] font-bold text-slate-300 hover:bg-slate-900 cursor-pointer"
            >
              Modify
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-800 text-slate-600 hover:text-white cursor-pointer"
              title="Cancel plan"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export function AIWorkspace({
  websiteId,
  pageId,
  pageTitle,
  surface,
  getContext,
  onApplyPlan,
  onRollback,
  onInsertComponent,
  renderInspector,
  onClose
}) {
  const [activeTab, setActiveTab] = useState("chat");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([{
    id: "welcome",
    role: "assistant",
    content: "I am Rocket AI, running inside ReactCMS without an external AI API. I understand this complete page, its component tree, website theme, assets, navigation, SEO, draft, and revision history. Tell me the outcome you want."
  }]);
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [pending, setPending] = useState(null);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [planFeedback, setPlanFeedback] = useState("");
  const [tasks, setTasks] = useState([]);
  const [runs, setRuns] = useState([]);
  const [context, setContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [memory, setMemory] = useState({});
  const [memorySaving, setMemorySaving] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageGenerating, setImageGenerating] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const [consoleEntries, setConsoleEntries] = useState([]);
  const [rocketUser, setRocketUser] = useState(() => rocketAIAuthService.currentUser());
  const [rocketAuthLoading, setRocketAuthLoading] = useState(true);
  const [rocketSigningIn, setRocketSigningIn] = useState(false);
  const [rocketAuthError, setRocketAuthError] = useState("");
  const chatEndRef = useRef(null);
  const getContextRef = useRef(getContext);

  useEffect(() => {
    getContextRef.current = getContext;
  }, [getContext]);

  useEffect(() => rocketAIAuthService.subscribe((user) => {
    setRocketUser(user);
    setRocketAuthLoading(false);
    if (user) setRocketAuthError("");
  }), []);

  const log = useCallback((level, message, data = null) => {
    setConsoleEntries((current) => [{
      id: `${Date.now()}_${Math.random()}`,
      at: Date.now(),
      level,
      message,
      data
    }, ...current].slice(0, 120));
  }, []);

  const refreshContext = useCallback(async () => {
    setContextLoading(true);
    try {
      const next = await getContextRef.current();
      setContext(next);
      log("context", `Collected ${next?.currentPage?.flattenedComponentIndex?.length || 0} components and ${next?.contentSystem?.assets?.length || 0} assets.`, {
        capabilities: next?.capabilities
      });
      return next;
    } catch (error) {
      log("error", error.message || "Context collection failed.");
      throw error;
    } finally {
      setContextLoading(false);
    }
  }, [log]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      aiBuilderPersistenceService.getRuns(websiteId, pageId),
      aiBuilderPersistenceService.getMemory(websiteId)
    ]).then(([savedRuns, savedMemory]) => {
      if (cancelled) return;
      setRuns(savedRuns);
      setMemory(savedMemory);
    }).catch((error) => {
      if (!cancelled) log("error", error.message || "Rocket workspace state could not be loaded.");
    });
    return () => {
      cancelled = true;
    };
  }, [pageId, websiteId, log]);

  useEffect(() => {
    refreshContext().catch(() => undefined);
  }, [refreshContext]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, pending, planning]);

  const suggestions = useMemo(() => context ? auditAIContext(context) : [], [context]);
  const assets = context?.contentSystem?.assets || [];

  const connectRocketAI = async () => {
    if (rocketSigningIn) return;
    setRocketSigningIn(true);
    setRocketAuthError("");
    try {
      const user = await rocketAIAuthService.signInWithGoogle();
      setRocketUser(user);
      log("auth", `Rocket AI connected as ${user.email || user.displayName}.`);
    } catch (error) {
      const message = error.message || "Google sign-in failed.";
      setRocketAuthError(message);
      log("error", message);
    } finally {
      setRocketSigningIn(false);
    }
  };

  const disconnectRocketAI = async () => {
    try {
      await rocketAIAuthService.signOut();
      setRocketUser(null);
      setPending(null);
      log("auth", "Rocket AI Google account disconnected.");
    } catch (error) {
      const message = error.message || "Rocket AI could not sign out.";
      setRocketAuthError(message);
      log("error", message);
    }
  };

  const requestPlan = useCallback(async ({
    intent,
    previousPlan = null,
    feedback = "",
    appendUser = true
  }) => {
    const cleanIntent = String(intent || "").trim();
    if (!cleanIntent || planning || applying) return;
    if (!rocketUser) {
      setRocketAuthError("Connect a Google account before asking Rocket AI.");
      return;
    }
    if (appendUser) {
      setMessages((current) => [...current, {
        id: `user_${Date.now()}`,
        role: "user",
        content: feedback || cleanIntent
      }]);
    }
    setPlanning(true);
    setPending(null);
    setModifyOpen(false);
    log("plan", `Analyzing the full page for: ${cleanIntent}`);
    try {
      const freshContext = await refreshContext();
      const response = await aiWebsiteAgentService.createPlan({
        intent: cleanIntent,
        context: freshContext,
        memory,
        conversation: messages,
        previousPlan,
        feedback
      });
      const nextPending = {
        prompt: cleanIntent,
        plan: response.plan,
        context: freshContext,
        model: response.model,
        requestId: response.requestId,
        usage: response.usage
      };
      setPending(nextPending);
      setTasks(response.plan.operations.map((operation) => ({
        ...operation,
        status: "planned"
      })));
      setMessages((current) => [...current, {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: response.plan.assistantMessage || response.plan.summary
      }]);
      log("plan", `Plan ready: ${response.plan.operations.length} operations.`, {
        model: response.model,
        requestId: response.requestId
      });
    } catch (error) {
      const message = error.message || "Rocket AI could not create a plan.";
      setMessages((current) => [...current, {
        id: `error_${Date.now()}`,
        role: "assistant",
        error: true,
        content: message
      }]);
      log("error", message);
    } finally {
      setPlanning(false);
    }
  }, [applying, log, memory, messages, planning, refreshContext, rocketUser]);

  const submitPrompt = (event) => {
    event?.preventDefault();
    const intent = prompt;
    setPrompt("");
    requestPlan({ intent });
  };

  const approvePlan = async () => {
    if (!pending || applying) return;
    setApplying(true);
    setTasks((current) => current.map((task) => ({ ...task, status: "applying" })));
    log("apply", `Applying ${pending.plan.operations.length} coordinated edits.`);
    let run = null;
    try {
      run = await aiBuilderPersistenceService.createRun(websiteId, pageId, {
        status: "applying",
        surface,
        prompt: pending.prompt,
        plan: pending.plan,
        model: pending.model,
        requestId: pending.requestId
      });
      const execution = await onApplyPlan(pending.plan, pending.context);
      const resultById = new Map((execution.results || []).map((item) => [item.id, item]));
      setTasks((current) => current.map((task) => ({
        ...task,
        status: resultById.get(task.id)?.status || "failed",
        detail: resultById.get(task.id)?.detail
      })));
      const validation = execution.validation || [];
      await aiBuilderPersistenceService.completeRun(websiteId, pageId, run.id, {
        before: execution.before,
        after: execution.after,
        results: execution.results,
        validation,
        status: execution.summary?.failed ? "applied_with_warnings" : "applied"
      });
      await aiWebsiteAgentService.recordFeedback({
        intent: pending.prompt,
        context: pending.context,
        plan: pending.plan,
        results: execution.results,
        validation
      }).then((feedback) => {
        if (feedback?.captured) log("training", "Approved plan added to the private Rocket AI curriculum.");
      }).catch((error) => {
        log("warning", error.message || "Rocket AI training feedback was not captured.");
      });
      const completedRun = {
        ...run,
        status: execution.summary?.failed ? "applied_with_warnings" : "applied",
        results: execution.results,
        validation,
        beforeSnapshotJson: JSON.stringify(execution.before),
        afterSnapshotJson: JSON.stringify(execution.after),
        appliedAt: Date.now()
      };
      setRuns((current) => [completedRun, ...current.filter((item) => item.id !== run.id)]);
      setMessages((current) => [...current, {
        id: `applied_${Date.now()}`,
        role: "assistant",
        content: `Applied ${execution.summary?.applied || 0} edits${execution.summary?.failed ? `; ${execution.summary.failed} need attention` : ""}. A draft snapshot and rollback point were created.`
      }]);
      setPending(null);
      await refreshContext();
      log("success", "Rocket AI draft committed with a rollback snapshot.", execution.summary);
    } catch (error) {
      const message = error.message || "The Rocket AI plan could not be applied.";
      if (run?.id) {
        await aiBuilderPersistenceService.failRun(
          websiteId,
          pageId,
          run.id,
          message
        ).catch(() => undefined);
      }
      setTasks((current) => current.map((task) => (
        task.status === "applying" ? { ...task, status: "failed", detail: message } : task
      )));
      setMessages((current) => [...current, {
        id: `apply_error_${Date.now()}`,
        role: "assistant",
        error: true,
        content: message
      }]);
      log("error", message, { runId: run?.id });
    } finally {
      setApplying(false);
    }
  };

  const rollbackRun = async (run) => {
    if (!run.beforeSnapshotJson || applying) return;
    if (!window.confirm(`Roll back "${run.plan?.title || "Rocket AI changes"}"? This restores its earlier page draft snapshot.`)) return;
    setApplying(true);
    log("rollback", `Restoring Rocket AI run ${run.id}.`);
    try {
      await onRollback(parseAISnapshot(run.beforeSnapshotJson));
      await aiBuilderPersistenceService.markRolledBack(websiteId, pageId, run.id);
      setRuns((current) => current.map((item) => (
        item.id === run.id ? { ...item, status: "rolled_back", rolledBackAt: Date.now() } : item
      )));
      setMessages((current) => [...current, {
        id: `rollback_${Date.now()}`,
        role: "assistant",
        content: `Rolled back “${run.plan?.title || "Rocket AI changes"}” and saved the restored draft.`
      }]);
      await refreshContext();
      log("success", "Rollback completed.");
    } catch (error) {
      log("error", error.message || "Rollback failed.");
    } finally {
      setApplying(false);
    }
  };

  const saveMemory = async () => {
    setMemorySaving(true);
    try {
      const saved = await aiBuilderPersistenceService.saveMemory(websiteId, memory);
      setMemory(saved);
      log("memory", "Website knowledge updated.");
    } catch (error) {
      log("error", error.message || "Website knowledge could not be saved.");
    } finally {
      setMemorySaving(false);
    }
  };

  const generateImage = async () => {
    const cleanPrompt = imagePrompt.trim();
    if (!cleanPrompt || imageGenerating) return;
    setImageGenerating(true);
    setImageProgress(0);
    log("image", `Generating a brand-aware image: ${cleanPrompt}`);
    try {
      const generated = await aiWebsiteAgentService.generateImage({
        prompt: cleanPrompt,
        brandContext: {
          pageTitle,
          theme: context?.designSystem?.theme,
          memory
        }
      });
      const file = generatedImageFile(generated.imageBase64, pageTitle, generated.mimeType);
      const asset = await mediaService.upload(
        websiteId,
        file,
        "ai-generated",
        setImageProgress
      );
      setImagePrompt("");
      await refreshContext();
      log("success", `Generated and saved ${asset.name} to the Media Library.`, {
        model: generated.model,
        assetId: asset.id
      });
    } catch (error) {
      log("error", error.message || "The image could not be generated.");
    } finally {
      setImageGenerating(false);
      setImageProgress(0);
    }
  };

  const renderChat = () => (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-3">
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-blue-400" />
            <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-blue-300">
              Full-page context
            </p>
            {contextLoading ? (
              <Loader2 className="ml-auto h-3 w-3 animate-spin text-blue-400" />
            ) : (
              <span className="ml-auto text-[8px] font-bold text-emerald-400">Live</span>
            )}
          </div>
          <p className="mt-2 text-[9px] leading-4 text-slate-500">
            {context?.currentPage?.flattenedComponentIndex?.length || 0} components · {assets.length} assets · {context?.revisionHistory?.length || 0} revisions · {(context?.capabilities || []).length} editing capabilities
          </p>
        </div>

        <div className={`rounded-xl border p-3 ${
          rocketUser
            ? "border-emerald-500/20 bg-emerald-500/5"
            : "border-violet-500/25 bg-violet-500/[0.06]"
        }`}>
          {rocketAuthLoading ? (
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" />
              Checking Rocket AI account…
            </div>
          ) : rocketUser ? (
            <div className="flex items-center gap-2.5">
              {rocketUser.photoURL ? (
                <img src={rocketUser.photoURL} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="grid h-8 w-8 place-items-center rounded-full bg-white text-xs font-black text-slate-900">G</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">Rocket AI ready · embedded</p>
                <p className="truncate text-[10px] text-slate-300">{rocketUser.email || rocketUser.displayName} · no AI API</p>
              </div>
              <button
                type="button"
                onClick={disconnectRocketAI}
                className="grid h-7 w-7 place-items-center rounded-lg border border-slate-800 text-slate-500 hover:border-rose-500/30 hover:text-rose-300 cursor-pointer"
                title="Disconnect Google account"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-2.5">
                <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-white text-xs font-black text-slate-900">G</div>
                <div>
                  <p className="text-[10px] font-bold text-white">Connect Google to Rocket AI</p>
                  <p className="mt-1 text-[9px] leading-4 text-slate-500">This is separate from your ReactCMS administrator session.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={connectRocketAI}
                disabled={rocketSigningIn}
                className="mt-3 flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-white px-3 text-[10px] font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60 cursor-pointer"
              >
                {rocketSigningIn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="text-xs font-black">G</span>}
                {rocketSigningIn ? "Connecting…" : "Continue with Google"}
              </button>
              {rocketAuthError && <p className="mt-2 text-[9px] leading-4 text-rose-300">{rocketAuthError}</p>}
            </div>
          )}
        </div>

        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[92%] rounded-xl px-3 py-2.5 text-[10px] leading-5 ${
              message.role === "user"
                ? "bg-blue-600 text-white"
                : message.error
                  ? "border border-rose-500/20 bg-rose-500/5 text-rose-200"
                  : "border border-slate-800 bg-slate-950/50 text-slate-300"
            }`}>
              {message.content}
            </div>
          </div>
        ))}

        {planning && (
          <div className="flex items-center gap-2 rounded-xl border border-violet-500/15 bg-violet-500/5 p-3">
            <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
            <div>
              <p className="text-[10px] font-semibold text-violet-100">Analyzing the entire page</p>
              <p className="mt-0.5 text-[9px] text-slate-600">Planning structure, design, content, responsive behavior, and validation…</p>
            </div>
          </div>
        )}

        {pending && (
          <PlanCard
            plan={pending.plan}
            busy={applying}
            onApprove={approvePlan}
            onModify={() => setModifyOpen(true)}
            onCancel={() => {
              setPending(null);
              setTasks([]);
            }}
          />
        )}

        {modifyOpen && pending && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const feedback = planFeedback.trim();
              if (!feedback) return;
              setPlanFeedback("");
              requestPlan({
                intent: pending.prompt,
                previousPlan: pending.plan,
                feedback
              });
            }}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
          >
            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
              Modify the plan
            </label>
            <textarea
              autoFocus
              value={planFeedback}
              onChange={(event) => setPlanFeedback(event.target.value)}
              rows="3"
              placeholder="Keep the hero, use fewer colors, add one more pricing tier…"
              className="mt-2 w-full resize-none rounded-lg border border-slate-800 bg-[#070b14] p-2.5 text-[10px] leading-4 text-slate-200 outline-none focus:border-violet-500"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setModifyOpen(false)} className="h-7 px-2 text-[9px] font-bold text-slate-600 hover:text-white cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="h-7 rounded-lg bg-violet-600 px-3 text-[9px] font-bold text-white cursor-pointer">
                Re-plan
              </button>
            </div>
          </form>
        )}

        {!pending && messages.length <= 2 && !planning && (
          <div className="grid gap-1.5">
            {QUICK_REQUESTS.map((request) => (
              <button
                key={request}
                type="button"
                onClick={() => requestPlan({ intent: request })}
                disabled={!rocketUser}
                className="rounded-lg border border-slate-800/80 bg-slate-950/30 px-3 py-2 text-left text-[9px] leading-4 text-slate-500 hover:border-violet-500/25 hover:text-slate-200 cursor-pointer"
              >
                {request}
              </button>
            ))}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={submitPrompt} className="border-t border-slate-800 p-3">
        <div className="rounded-xl border border-slate-700 bg-[#070b14] p-2 focus-within:border-violet-500/60">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            disabled={!rocketUser}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitPrompt(event);
              }
            }}
            rows="3"
            placeholder={rocketUser ? "Ask Rocket AI to build, redesign, review, or optimize this page…" : "Connect Google to start using Rocket AI…"}
            className="w-full resize-none bg-transparent px-1 text-[11px] leading-5 text-slate-200 outline-none placeholder:text-slate-700"
          />
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[8px] text-slate-700">Enter to plan · Shift+Enter for a line</span>
            <button
              type="submit"
              disabled={!rocketUser || !prompt.trim() || planning || applying}
              className="ml-auto grid h-7 w-7 place-items-center rounded-lg bg-violet-600 text-white disabled:opacity-30 cursor-pointer"
              title="Create plan"
            >
              {planning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  const renderTasks = () => tasks.length ? (
    <div className="space-y-2 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Current execution</p>
        <span className="text-[9px] text-slate-600">
          {tasks.filter((task) => task.status === "applied").length}/{tasks.length}
        </span>
      </div>
      {tasks.map((task) => (
        <div key={task.id} className="rounded-lg border border-slate-800 bg-slate-950/35 p-2.5">
          <div className="flex gap-2">
            <StatusIcon status={task.status} />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-slate-300">{task.summary}</p>
              <p className="mt-0.5 text-[9px] leading-4 text-slate-600">{task.detail || task.reason}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : <EmptyPanel icon={ListChecks} title="No active tasks">Create a plan in Rocket Chat to see every coordinated edit and its execution status.</EmptyPanel>;

  const renderHistory = () => runs.length ? (
    <div className="space-y-2 p-3">
      {runs.map((run) => (
        <div key={run.id} className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
          <div className="flex items-start gap-2">
            <FileClock className="mt-0.5 h-3.5 w-3.5 text-blue-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-slate-200">{run.plan?.title || run.prompt}</p>
              <p className="mt-1 text-[9px] leading-4 text-slate-600">{dateLabel(run.createdAt)} · {run.plan?.operations?.length || 0} edits</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-[8px] font-bold ${
              run.status === "rolled_back"
                ? "bg-slate-800 text-slate-500"
                : run.status?.startsWith("applied")
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-amber-500/10 text-amber-300"
            }`}>
              {run.status?.replaceAll("_", " ")}
            </span>
          </div>
          {!!run.results?.length && (
            <>
              <p className="mt-2 text-[9px] text-slate-500">
                {run.results.filter((item) => item.status === "applied").length} applied · {run.results.filter((item) => item.status === "failed").length} warnings
              </p>
              <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                {run.results.slice(0, 12).map((item) => (
                  <div key={item.id} className="rounded-md border border-slate-800/70 px-2 py-1.5">
                    <p className="text-[8px] font-semibold text-slate-400">{item.summary}</p>
                    <p className="mt-0.5 text-[8px] leading-3 text-slate-700">{item.reason || item.detail}</p>
                  </div>
                ))}
              </div>
            </>
          )}
          {run.beforeSnapshotJson && run.status !== "rolled_back" && (
            <button
              type="button"
              disabled={applying}
              onClick={() => rollbackRun(run)}
              className="mt-3 flex h-7 items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 text-[9px] font-bold text-slate-400 hover:text-white disabled:opacity-40 cursor-pointer"
            >
              <ArchiveRestore className="h-3 w-3" />
              Roll back this run
            </button>
          )}
        </div>
      ))}
    </div>
  ) : <EmptyPanel icon={Clock3} title="No Rocket history yet">Applied plans will keep their diff, explanation, draft snapshot, and rollback point here.</EmptyPanel>;

  const renderSuggestions = () => suggestions.length ? (
    <div className="space-y-2 p-3">
      <button
        type="button"
        onClick={refreshContext}
        className="mb-1 flex h-7 items-center gap-1.5 text-[9px] font-bold text-slate-500 hover:text-white cursor-pointer"
      >
        <RefreshCw className="h-3 w-3" />
        Re-run page audit
      </button>
      {suggestions.map((suggestion, index) => (
        <button
          key={`${suggestion.category}-${index}`}
          type="button"
          onClick={() => {
            setActiveTab("chat");
            requestPlan({ intent: `Fix this ${suggestion.category} issue across the page: ${suggestion.message}` });
          }}
          className="w-full rounded-xl border border-slate-800 bg-slate-950/35 p-3 text-left hover:border-violet-500/25 cursor-pointer"
        >
          <div className="flex items-start gap-2">
            <Lightbulb className={`mt-0.5 h-3.5 w-3.5 ${suggestion.severity === "high" ? "text-amber-400" : "text-blue-400"}`} />
            <div>
              <p className="text-[8px] font-extrabold uppercase tracking-wider text-slate-600">{suggestion.category}</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-300">{suggestion.message}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  ) : <EmptyPanel icon={ShieldCheck} title="No obvious issues found">The deterministic page audit currently passes. Ask Rocket Chat for a deeper design or conversion review.</EmptyPanel>;

  const renderComponents = () => (
    <div className="min-h-0 overflow-y-auto">
      <div className="border-b border-slate-800 p-3">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Generate and insert</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {BLOCK_SCHEMAS.slice(0, 24).map((component) => (
            <button
              key={component.type}
              type="button"
              onClick={() => {
                if (onInsertComponent) onInsertComponent(component.type);
                else {
                  setActiveTab("chat");
                  requestPlan({ intent: `Create and insert a polished ${component.label} that matches this page and brand.` });
                }
              }}
              className="rounded-lg border border-slate-800 bg-slate-950/35 px-2.5 py-2 text-left hover:border-blue-500/30 cursor-pointer"
            >
              <p className="text-[9px] font-bold text-slate-300">{component.label}</p>
              <p className="mt-0.5 truncate text-[8px] text-slate-700">{component.category}</p>
            </button>
          ))}
        </div>
      </div>
      {renderInspector ? (
        <div className="min-h-96">{renderInspector()}</div>
      ) : (
        <EmptyPanel icon={Boxes} title="No direct inspector on this surface">Use Rocket Chat to manipulate the complete page model.</EmptyPanel>
      )}
    </div>
  );

  const renderAssets = () => (
    <div>
      <div className="border-b border-slate-800 p-3">
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-violet-300" />
            <p className="text-[10px] font-bold text-violet-100">Generate a brand-aware image</p>
          </div>
          <textarea
            value={imagePrompt}
            onChange={(event) => setImagePrompt(event.target.value)}
            rows="3"
            placeholder="A premium abstract hero image for our product, coral accents, clean negative space…"
            className="mt-2 w-full resize-none rounded-lg border border-slate-800 bg-[#070b14] p-2.5 text-[10px] leading-4 text-slate-300 outline-none focus:border-violet-500"
          />
          <button
            type="button"
            disabled={!imagePrompt.trim() || imageGenerating}
            onClick={generateImage}
            className="mt-2 h-8 w-full rounded-lg bg-violet-600 text-[10px] font-bold text-white disabled:opacity-40 cursor-pointer"
          >
            {imageGenerating
              ? `Generating${imageProgress ? ` · ${Math.round(imageProgress)}% upload` : "…"}`
              : "Generate & save to Media Library"}
          </button>
        </div>
      </div>
      {assets.length ? (
        <div className="grid grid-cols-2 gap-2 p-3">
          {assets.slice(0, 100).map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => {
                setActiveTab("chat");
                requestPlan({
                  intent: `Use the existing media asset with ID "${asset.id}" in the most appropriate selected or prominent page component, with accessible alt text.`
                });
              }}
              className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40 text-left hover:border-violet-500/30 cursor-pointer"
            >
              {String(asset.type || "").startsWith("image/") ? (
                <img src={asset.url} alt={asset.alt || asset.name} className="h-20 w-full object-cover" />
              ) : (
                <div className="grid h-20 place-items-center bg-slate-900"><ImageIcon className="h-5 w-5 text-slate-700" /></div>
              )}
              <div className="p-2">
                <p className="truncate text-[9px] font-semibold text-slate-300">{asset.name}</p>
                <p className="mt-0.5 truncate text-[8px] text-slate-700">{asset.alt || "No alt text"}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyPanel icon={ImageIcon} title="No media assets">Generate one above or upload assets to the Media Library; Rocket AI receives them automatically.</EmptyPanel>
      )}
    </div>
  );

  const renderKnowledge = () => (
    <div className="space-y-3 p-3">
      <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-3">
        <p className="text-[10px] font-bold text-blue-200">Persistent website memory</p>
        <p className="mt-1 text-[9px] leading-4 text-slate-500">These preferences are automatically included with every plan for this website.</p>
      </div>
      {MEMORY_FIELDS.map(([key, label]) => (
        <label key={key} className="block">
          <span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-600">{label}</span>
          <textarea
            value={memory[key] || ""}
            onChange={(event) => setMemory((current) => ({ ...current, [key]: event.target.value }))}
            maxLength={4000}
            rows="3"
            className="mt-1.5 w-full resize-y rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 text-[10px] leading-4 text-slate-300 outline-none focus:border-blue-500"
          />
        </label>
      ))}
      <button
        type="button"
        disabled={memorySaving}
        onClick={saveMemory}
        className="h-8 w-full rounded-lg bg-blue-600 text-[10px] font-bold text-white disabled:opacity-50 cursor-pointer"
      >
        {memorySaving ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : "Save website knowledge"}
      </button>
    </div>
  );

  const renderConsole = () => consoleEntries.length ? (
    <div className="space-y-1.5 p-3 font-mono">
      {consoleEntries.map((entry) => (
        <div key={entry.id} className="rounded-lg border border-slate-800/70 bg-black/20 p-2.5">
          <div className="flex gap-2 text-[8px] uppercase tracking-wider">
            <span className={entry.level === "error" ? "text-rose-400" : entry.level === "success" ? "text-emerald-400" : "text-blue-400"}>{entry.level}</span>
            <span className="text-slate-700">{new Date(entry.at).toLocaleTimeString()}</span>
          </div>
          <p className="mt-1 text-[9px] leading-4 text-slate-400">{entry.message}</p>
          {entry.data && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[8px] leading-4 text-slate-700">{JSON.stringify(entry.data, null, 2)}</pre>}
        </div>
      ))}
    </div>
  ) : <EmptyPanel icon={Code2} title="Console is quiet">Context collection, planning, execution, validation, and rollback events appear here.</EmptyPanel>;

  const panels = {
    chat: renderChat,
    tasks: renderTasks,
    history: renderHistory,
    suggestions: renderSuggestions,
    components: renderComponents,
    assets: renderAssets,
    knowledge: renderKnowledge,
    console: renderConsole
  };
  const active = TABS.find((tab) => tab.id === activeTab) || TABS[0];
  const ActiveIcon = active.icon;

  return (
    <aside className="flex h-full w-[400px] flex-shrink-0 border-l border-slate-800 bg-[#0b1120] text-left 2xl:w-[440px]">
      <nav className="flex w-12 flex-shrink-0 flex-col items-center gap-1 border-r border-slate-800 bg-[#080d18] py-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`relative grid h-9 w-9 place-items-center rounded-lg transition-colors cursor-pointer ${
              activeTab === id
                ? "bg-violet-600 text-white"
                : "text-slate-600 hover:bg-slate-900 hover:text-slate-200"
            }`}
            title={label}
          >
            <Icon className="h-4 w-4" />
            {id === "tasks" && tasks.some((task) => task.status === "applying") && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-300" />
            )}
          </button>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-slate-800 px-3">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/15">
            {activeTab === "chat" ? <Bot className="h-3.5 w-3.5 text-violet-300" /> : <ActiveIcon className="h-3.5 w-3.5 text-violet-300" />}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-white">{active.label}</p>
            <p className="max-w-56 truncate text-[8px] text-slate-600">{pageTitle} · {surface.replaceAll("-", " ")}</p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-slate-600 hover:bg-slate-900 hover:text-white cursor-pointer" title="Close Rocket AI workspace">
              <PanelRightClose className="h-3.5 w-3.5" />
            </button>
          )}
        </header>
        <div className={`min-h-0 flex-1 overflow-y-auto ${activeTab === "chat" ? "flex flex-col overflow-hidden" : ""}`}>
          {panels[activeTab]()}
        </div>
      </div>
    </aside>
  );
}

export default AIWorkspace;
