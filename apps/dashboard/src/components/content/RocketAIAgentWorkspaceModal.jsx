import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  X, 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  Pause, 
  Play, 
  Square, 
  RotateCcw, 
  RotateCw, 
  CheckCircle2, 
  Clock, 
  Layers, 
  ShieldCheck, 
  Palette, 
  Cpu, 
  ExternalLink, 
  Maximize2, 
  Minimize2, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Mic, 
  Eye, 
  History, 
  FileText,
  AlertCircle
} from "lucide-react";
import rocketAIEngine from "../../services/rocketAIEngine";

const toast = {
  success: (msg) => console.log("Success:", msg),
  info: (msg) => console.log("Info:", msg),
  warning: (msg) => console.log("Warning:", msg),
  error: (msg) => console.log("Error:", msg)
};

export default function RocketAIAgentWorkspaceModal({
  isOpen,
  onClose,
  pageKey = "ads",
  pageTitle = "Page",
  draftValues = {},
  customModules = [],
  targetDomain = "",
  onUpdateRegions = () => {},
  onUpdateModules = () => {}
}) {
  if (!isOpen) return null;

  // Agent State & History
  const [selectedModel, setSelectedModel] = useState("rocket-2.5");
  const [isAgentMode, setIsAgentMode] = useState(true);
  const [agentStatus, setAgentStatus] = useState("idle"); // "idle" | "running" | "paused" | "completed"
  
  // Chat & Execution Messages
  const [messages, setMessages] = useState([
    {
      sender: "assistant",
      text: `👋 Hi! I'm **Rocket AI 2.5 Real Execution Agent**.\n\nI automatically inspect page layouts, locate affected CMS regions, execute editor function updates, refresh the preview frame, and auto-save draft snapshots in real time. Type a prompt or select a quick task to start.`
    }
  ]);

  const [promptInput, setPromptInput] = useState("");
  const [attachedImage, setAttachedImage] = useState(null);
  const [isDeepThink, setIsDeepThink] = useState(true);
  const fileInputRef = useRef(null);

  // Panels Collapse / Expand State
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [showFloatingPreview, setShowFloatingPreview] = useState(false);

  // Timeline & Metrics State
  const [activeTimeline, setActiveTimeline] = useState([]);
  const [activeMetrics, setActiveMetrics] = useState(rocketAIEngine.analyzePageMetrics({ currentDrafts: draftValues, pageKey }));
  
  // Version History Stack for Undo / Redo
  const [versionHistory, setVersionHistory] = useState([
    { id: "v1", label: "Initial Page Draft", timestamp: "Just now", drafts: { ...draftValues }, modules: [...customModules] }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Pause / Resume Refs
  const executionTimerRef = useRef(null);
  const isPausedRef = useRef(false);

  const handleImageFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedImage(event.target.result);
        toast.success("🖼️ Image attached for screenshot intelligence analysis!");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendPrompt = (overridePrompt) => {
    const textToSend = overridePrompt || promptInput;
    if (!textToSend || !textToSend.trim()) return;

    const userMsg = textToSend.trim();
    setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    if (!overridePrompt) setPromptInput("");
    
    setAgentStatus("running");
    isPausedRef.current = false;

    // 1. Generate live timeline steps
    const steps = rocketAIEngine.getThinkingTimeline({ promptText: userMsg, hasImage: !!attachedImage, pageTitle });
    setActiveTimeline(steps);

    // 2. Simulate step-by-step agent execution
    setTimeout(() => {
      if (isPausedRef.current) return;

      const result = rocketAIEngine.processPrompt({
        promptText: userMsg,
        attachedImage,
        pageKey,
        pageTitle,
        currentDrafts: draftValues,
        currentModules: customModules,
        model: selectedModel
      });

      if (attachedImage) setAttachedImage(null);

      // Apply Region & Module updates
      if (result.regionUpdates && Object.keys(result.regionUpdates).length > 0) {
        onUpdateRegions(result.regionUpdates);
      }
      if (result.customModules && result.customModules.length > 0) {
        onUpdateModules(result.customModules);
      }

      // Record Version History Snapshot
      const newVersion = {
        id: `v${versionHistory.length + 1}`,
        label: `Draft v${versionHistory.length + 1} (${userMsg.slice(0, 20)}...)`,
        timestamp: new Date().toLocaleTimeString(),
        drafts: { ...draftValues, ...(result.regionUpdates || {}) },
        modules: [...(result.customModules || customModules)]
      };
      setVersionHistory((prev) => [newVersion, ...prev]);
      setHistoryIndex(0);

      // Update Metrics & Message
      setActiveMetrics(result.metrics);
      setMessages((prev) => [...prev, { sender: "assistant", text: result.replyText }]);
      setAgentStatus("completed");
      toast.success("🚀 Rocket AI 2.4 Autonomous Agent completed tasks!");
    }, 1200);
  };

  const handlePause = () => {
    isPausedRef.current = true;
    setAgentStatus("paused");
    toast.info("⏸️ Rocket AI 2.4 Agent Paused. Progress saved.");
  };

  const handleResume = () => {
    isPausedRef.current = false;
    setAgentStatus("running");
    toast.success("▶️ Resuming Rocket AI 2.4 Agent execution...");
    setTimeout(() => {
      setAgentStatus("completed");
    }, 800);
  };

  const handleStop = () => {
    isPausedRef.current = true;
    setAgentStatus("idle");
    toast.warning("⏹️ Rocket AI 2.4 Agent Execution Stopped.");
  };

  const handleRestoreVersion = (ver) => {
    if (ver && ver.drafts) {
      onUpdateRegions(ver.drafts);
      if (ver.modules) onUpdateModules(ver.modules);
      toast.success(`Restored ${ver.label}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex flex-col text-slate-100 font-sans overflow-hidden animate-in fade-in duration-200">
      
      {/* Top Header Navigation */}
      <header className="h-14 bg-slate-900/90 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/20">
            <Sparkles className="w-4 h-4 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-white tracking-wide">Rocket AI 2.5 Workspace</h3>
              <span className="bg-purple-950 text-purple-300 border border-purple-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Real Execution Agent
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">Connected: /{pageKey} ({pageTitle})</p>
          </div>
        </div>

        {/* Model Selector & Floating Preview Button */}
        <div className="flex items-center gap-3">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-slate-950 text-purple-300 border border-purple-500/40 text-xs font-bold px-3 py-1.5 rounded-lg outline-none cursor-pointer hover:border-purple-400 transition-all"
          >
            <option value="rocket-2.5">🚀 Rocket AI 2.5 (Real Execution Agent)</option>
            <option value="rocket-2.4">🚀 Rocket AI 2.4 (Autonomous Agent)</option>
            <option value="rocket-2.2">🚀 Rocket AI 2.2 (Architect & Engine)</option>
            <option value="rocket-2.1">🚀 Rocket AI 2.1 Ultra</option>
            <option value="rocket-2.0">🧠 Rocket AI 2.0 Pro</option>
            <option value="rocket-1.8">⚡ Rocket AI 1.8 Instant</option>
            <option value="rocket-1.6">💥 Rocket AI 1.6 Flash</option>
          </select>

          {/* Agent Mode Toggle */}
          <button
            onClick={() => setIsAgentMode(!isAgentMode)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              isAgentMode 
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30" 
                : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Agent Mode: {isAgentMode ? "AUTO" : "MANUAL"}</span>
          </button>

          {/* Floating Preview Canvas Toggle */}
          <button
            onClick={() => setShowFloatingPreview(!showFloatingPreview)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
              showFloatingPreview ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{showFloatingPreview ? "Hide Live Preview" : "Popout Preview"}</span>
          </button>

          {/* Close Workspace */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main 3-Panel Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT PANEL (320px) - Memory & Context */}
        <aside className={`${leftCollapsed ? "w-12" : "w-80"} bg-slate-900/60 border-r border-slate-800 flex flex-col transition-all duration-200 shrink-0`}>
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            {!leftCollapsed && <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Context & Memory</h4>}
            <button
              onClick={() => setLeftCollapsed(!leftCollapsed)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer ml-auto"
            >
              {leftCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {!leftCollapsed && (
            <div className="flex-1 p-3 overflow-y-auto space-y-4 text-xs">
              
              {/* Quick Action Pinned Prompts */}
              <div>
                <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block mb-2">Pinned Prompts</span>
                <div className="space-y-1.5">
                  <button
                    onClick={() => handleSendPrompt("i want bg colour header same as this colour on this entire page now black that i dont want -, this not white check it")}
                    className="w-full text-left p-2 rounded-lg bg-purple-950/60 border border-purple-500/30 text-purple-200 hover:bg-purple-900/80 transition-colors text-[11px]"
                  >
                    🎨 Match Header & Page Theme
                  </button>
                  <button
                    onClick={() => handleSendPrompt("next add a above about ads 📊 Client Success Statistics moving carosil")}
                    className="w-full text-left p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors text-[11px]"
                  >
                    📊 Add Moving Stats Carousel
                  </button>
                  <button
                    onClick={() => handleSendPrompt("below book free consultation add : Create a 'Why Choose Us' section with 6 cards")}
                    className="w-full text-left p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors text-[11px]"
                  >
                    🌟 Add Why Choose Us
                  </button>
                  <button
                    onClick={() => handleSendPrompt("Make this page look premium.")}
                    className="w-full text-left p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors text-[11px]"
                  >
                    ✨ Make Page Look Premium
                  </button>
                </div>
              </div>

              {/* Uploaded Reference Images */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Screenshot Reference</span>
                {attachedImage ? (
                  <div className="relative group p-1 bg-slate-950 border border-purple-500/50 rounded-lg">
                    <img src={attachedImage} alt="Reference" className="w-full h-28 object-cover rounded-md" />
                    <button
                      onClick={() => setAttachedImage(null)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full text-xs cursor-pointer shadow"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 border-2 border-dashed border-slate-800 hover:border-purple-500/50 rounded-lg text-center cursor-pointer text-slate-500 hover:text-purple-400 transition-all"
                  >
                    <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-60" />
                    <p className="text-[11px]">Upload Screenshot / Design Reference</p>
                  </div>
                )}
              </div>

              {/* Session Context */}
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Workspace Context</span>
                <p className="text-slate-300 font-semibold">Route: /{pageKey}</p>
                <p className="text-slate-400 text-[11px]">Engine Mode: {selectedModel}</p>
                <p className="text-slate-400 text-[11px]">Draft Regions: {Object.keys(draftValues).length} loaded</p>
              </div>

            </div>
          )}
        </aside>

        {/* CENTER PANEL (Flex) - Conversation, Thinking Timeline & Inputs */}
        <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
          
          {/* Chat Messages & Animated Timeline */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.sender === "user"
                      ? "bg-purple-600 text-white rounded-br-none shadow-lg shadow-purple-600/20"
                      : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-md"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Live Thinking Timeline Steps Stream */}
            {agentStatus === "running" && activeTimeline.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-900/90 border border-purple-500/30 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-purple-400 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Live Agent Reasoning Timeline
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Executing...</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {activeTimeline.map((st) => (
                    <div key={st.id} className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        {st.label}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{st.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Command Prompt Input Bar */}
          <div className="p-3 bg-slate-900/90 border-t border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendPrompt();
              }}
              className="flex flex-col gap-2"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageFileSelect}
                accept="image/*"
                className="hidden"
              />

              <div className="relative">
                <textarea
                  rows={2}
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendPrompt();
                    }
                  }}
                  placeholder="Describe what you'd like Rocket AI to build or improve..."
                  className="w-full text-xs p-3 pr-28 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 outline-none focus:border-purple-500/70 resize-none transition-all"
                />

                <div className="absolute right-2 bottom-2.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Attach Screenshot"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <button
                    type="submit"
                    disabled={agentStatus === "running"}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-purple-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </div>

              {/* Bottom Quick Controls & Deep Think Toggle */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDeepThink}
                      onChange={(e) => setIsDeepThink(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-purple-600 focus:ring-0"
                    />
                    <span>Deep Thinking Mode</span>
                  </label>
                </div>
                <span>Press Shift+Enter for new line</span>
              </div>
            </form>
          </div>
        </main>

        {/* RIGHT PANEL (380px) - Agent Controls, Queue, Theme & Metrics */}
        <aside className={`${rightCollapsed ? "w-12" : "w-96"} bg-slate-900/80 border-l border-slate-800 flex flex-col transition-all duration-200 shrink-0`}>
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <button
              onClick={() => setRightCollapsed(!rightCollapsed)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer mr-auto"
            >
              {rightCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {!rightCollapsed && <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Agent Controls & Audit</h4>}
          </div>

          {!rightCollapsed && (
            <div className="flex-1 p-3 overflow-y-auto space-y-4 text-xs">
              
              {/* Agent Status & Control Bar */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300">Agent Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    agentStatus === "running" ? "bg-purple-950 text-purple-300 border border-purple-500/40 animate-pulse" :
                    agentStatus === "paused" ? "bg-amber-950 text-amber-300 border border-amber-500/40" :
                    agentStatus === "completed" ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40" :
                    "bg-slate-800 text-slate-400"
                  }`}>
                    {agentStatus}
                  </span>
                </div>

                {/* Execution Control Buttons: Pause, Resume, Stop */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={handlePause}
                    disabled={agentStatus !== "running"}
                    className="p-2 rounded-lg bg-amber-950/80 border border-amber-500/30 text-amber-200 hover:bg-amber-900 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </button>
                  <button
                    onClick={handleResume}
                    disabled={agentStatus !== "paused"}
                    className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-900 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <Play className="w-3.5 h-3.5" /> Resume
                  </button>
                  <button
                    onClick={handleStop}
                    className="p-2 rounded-lg bg-red-950/80 border border-red-500/30 text-red-200 hover:bg-red-900 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" /> Stop
                  </button>
                </div>
              </div>

              {/* Audit Scores (SEO, Accessibility, Performance) */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Audit Ratings</span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <p className="text-lg font-extrabold text-emerald-400">{activeMetrics.seoScore}</p>
                    <p className="text-[10px] text-slate-400 font-semibold">SEO Rating</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <p className="text-lg font-extrabold text-purple-400">{activeMetrics.accessibilityScore}</p>
                    <p className="text-[10px] text-slate-400 font-semibold">WCAG AAA</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <p className="text-lg font-extrabold text-indigo-400">{activeMetrics.performanceScore}</p>
                    <p className="text-[10px] text-slate-400 font-semibold">Performance</p>
                  </div>
                </div>
              </div>

              {/* Theme & Palette Summary */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Theme & Color Palette</span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Header Color Sync:</span>
                  <span className="text-emerald-400 font-semibold">{activeMetrics.theme.headerMatch}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Contrast Ratio:</span>
                  <span className="text-purple-300 font-mono">{activeMetrics.theme.contrastRatio}</span>
                </div>
              </div>

              {/* Draft Version History Stack (Undo / Redo) */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Version History Stack</span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {versionHistory.map((ver, idx) => (
                    <button
                      key={ver.id}
                      onClick={() => handleRestoreVersion(ver)}
                      className={`w-full text-left p-2 rounded-lg border text-[11px] flex items-center justify-between transition-colors cursor-pointer ${
                        idx === 0 ? "bg-purple-950/40 border-purple-500/40 text-purple-200" : "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <span className="truncate">{ver.label}</span>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">{ver.timestamp}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}
        </aside>

      </div>

      {/* Floating Picture-in-Picture Preview Window */}
      {showFloatingPreview && (
        <div className="fixed bottom-4 right-4 w-[480px] h-[320px] z-50 bg-slate-950 border-2 border-purple-500/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="p-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-purple-400" /> Live Draft Canvas Preview
            </span>
            <button
              onClick={() => setShowFloatingPreview(false)}
              className="text-slate-400 hover:text-white p-1 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 bg-slate-900">
            <iframe
              src={targetDomain ? `${targetDomain}/${pageKey}?rcms_edit=true` : `/content/preview?path=${pageKey}`}
              className="w-full h-full border-none"
              title="Live Preview"
            />
          </div>
        </div>
      )}

    </div>
  );
}
