import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Save, 
  Send, 
  Globe, 
  Eye, 
  Edit3, 
  ExternalLink, 
  RefreshCw, 
  Smartphone, 
  Monitor, 
  Tablet, 
  Laptop, 
  Maximize2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Settings,
  Link2,
  AlertTriangle,
  UploadCloud,
  Sparkles,
  Sliders,
  Menu
} from "lucide-react";
import { usePages } from "../../hooks/usePages";
import { useLocale } from "../../hooks/useLocale";
import { useWebsites } from "../../hooks/useWebsites";
import { useAuth } from "../../hooks/useAuth";
import visualEditService from "../../services/visualEditService";
import registryService from "../../services/registryService";
import contentSyncService from "../../services/contentSyncService";
import revisionService from "../../services/revisionService";
import vercelDeployService from "../../services/vercelDeployService";
import { websiteService } from "../../services/websiteService";
import rocketAIEngine from "../../services/rocketAIEngine";
import RocketAIAgentWorkspaceModal from "../../components/content/RocketAIAgentWorkspaceModal";
import RegionTreePanel from "../../components/content/RegionTreePanel";
import RegionInspectorPanel from "../../components/content/RegionInspectorPanel";
import SEOPanel from "../../components/content/SEOPanel";
import RevisionPanel from "../../components/content/RevisionPanel";
import BlockEditor from "../../components/blocks/BlockEditor";
import { useRevisions } from "../../hooks/useRevisions";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useToast } from "../../hooks/useToast";

export function VisualEditorPage() {
  const { websiteId, pageId } = useParams();
  const navigate = useNavigate();

  const { selectedPage, fetchPageById, updatePage, publishPage } = usePages();
  const { selectedWebsite, selectWebsite } = useWebsites();
  const { activeLocales, activeLocale, setLocale } = useLocale(websiteId);
  const { user } = useAuth();
  const toast = useToast();
  const { revisions, loadRevisions, restoreRevision } = useRevisions();

  // Mode and view states
  const [editModeActive, setEditModeActive] = useState(true);
  const [activeDevice, setActiveDevice] = useState("full");
  const [selectedElement, setSelectedElement] = useState(null);
  const [regionsMap, setRegionsMap] = useState({});
  const [previewModeType, setPreviewModeType] = useState("visual"); // "visual" | "shell" | "direct"
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeHero, setIncludeHero] = useState(true);
  const [includeFooter, setIncludeFooter] = useState(true);

  // Target domain state & modal
  const [targetDomain, setTargetDomain] = useState("");
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [newDomainInput, setNewDomainInput] = useState("");
  const [updatingDomain, setUpdatingDomain] = useState(false);

  // Page Settings / Configuration Modal States
  const [showPageSettingsModal, setShowPageSettingsModal] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("general");
  const [pageTitle, setPageTitle] = useState("");
  const [pageSlug, setPageSlug] = useState("");
  const [pageRoute, setPageRoute] = useState("");
  const [pageSeo, setPageSeo] = useState({});
  const [pageBlocks, setPageBlocks] = useState([]);

  // Draft & save states
  const [draftValues, setDraftValues] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved"); // "saved" | "unsaved" | "saving"
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Modals
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);

  // Vercel deployment state
  const [deployingVercel, setDeployingVercel] = useState(false);
  const [showVercelModal, setShowVercelModal] = useState(false);
  const [vercelHookInput, setVercelHookInput] = useState("");

  const handleTriggerVercelDeploy = async () => {
    setDeployingVercel(true);
    try {
      let hookUrl = await vercelDeployService.getDeployHook(websiteId);
      if (!hookUrl) {
        setShowVercelModal(true);
        setDeployingVercel(false);
        return;
      }

      await vercelDeployService.triggerDeploy(websiteId);
      toast.success("🚀 Vercel deployment triggered! Site will update in ~30s.");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to trigger Vercel deployment.");
    } finally {
      setDeployingVercel(false);
    }
  };

  // AI Live Page Prompt & Module State
  const [aiPromptInput, setAiPromptInput] = useState("");
  const [buildingAI, setBuildingAI] = useState(false);
  const [customModules, setCustomModules] = useState([
    {
      id: "mod-1",
      type: "content",
      heading: "Strategic Execution & Growth",
      text: "We help ambitious businesses grow through innovative technology, creative marketing, and measurable digital strategies that deliver long-term business success."
    }
  ]);

  // AI Prompt Parser & Full Page Builder Engine
  const parsePromptToPageModules = (promptText, pageTitle) => {
    // 1. Extract clean main headline (search for quoted text like "Generate High-Converting...")
    const quoteMatch = promptText.match(/"([^"]+)"/);
    const headline = quoteMatch 
      ? quoteMatch[1] 
      : (pageTitle && pageTitle !== "New Created Page" ? pageTitle : "Generate High-Converting AI Landing Pages in Seconds");

    const subheadline = "Create AI-driven, high-converting advertisement pages with automated SEO, real-time analytics, and instant 1-click publishing.";

    const modules = [];

    // 2. Trust Badges
    modules.push({
      id: "mod-trust",
      type: "trust_badges",
      badges: ["⚡ AI Powered", "🚀 SEO Optimized", "📱 Mobile Responsive", "⚡ Fast Performance", "🔒 Enterprise Security"]
    });

    // 3. 6 Feature Cards
    modules.push({
      id: "mod-features",
      type: "features_6",
      heading: "Comprehensive AI Capabilities",
      subheading: "Everything you need to launch, optimize, and scale high-converting landing pages.",
      cards: [
        { icon: "🤖", title: "Automated AI Content", desc: "Generate SEO-optimized copy, headlines, and calls-to-action tailored to your target niche." },
        { icon: "📈", title: "Smart SEO Optimization", desc: "Built-in meta tags, structured data, and keyword integration for top Google rankings." },
        { icon: "🎨", title: "High-Converting Layouts", desc: "Proven design patterns engineered for maximum visitor engagement and lead conversion." },
        { icon: "⚡", title: "1-Click Publishing", desc: "Deploy changes directly to live Vercel servers without touching code or git workflows." },
        { icon: "📊", title: "Real-Time Analytics", desc: "Track visitor traffic, conversion rates, and region performance in real time." },
        { icon: "⚙️", title: "Custom Component Integration", desc: "Seamlessly connect with your existing CMS components, React hooks, and APIs." }
      ]
    });

    // 4. How It Works (3 Steps)
    modules.push({
      id: "mod-steps",
      type: "how_it_works",
      heading: "How It Works in 3 Simple Steps",
      steps: [
        { step: "01", title: "Input Your Prompt", desc: "Describe your page goals, key features, target keywords, and visual layout preferences." },
        { step: "02", title: "AI Generates Layout", desc: "Our engine crafts high-converting copy, visual modules, and responsive layout structure." },
        { step: "03", title: "Publish Live to Vercel", desc: "Click Publish to instantly deploy your new page to live production servers." }
      ]
    });

    // 5. Dashboard Live Preview Mockup
    modules.push({
      id: "mod-mockup",
      type: "mockup",
      heading: "Interactive AI Builder Dashboard",
      subheading: "Full visual control over every region, text block, and image asset.",
      src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80"
    });

    // 6. Testimonials Quotes
    modules.push({
      id: "mod-testimonials",
      type: "testimonials",
      heading: "Trusted by Leading Digital Agencies",
      items: [
        { quote: "ReactCMS AI Builder saved our team over 40 hours of development time. Pages launch visually in seconds!", author: "Sarah Jenkins", role: "Head of Marketing at CloudScale" },
        { quote: "The AI page generator creates layout shells that match our site theme perfectly. Unbelievable productivity boost.", author: "David Vance", role: "Creative Director at Nexus Studio" }
      ]
    });

    // 7. FAQ Accordion
    modules.push({
      id: "mod-faq",
      type: "faq",
      heading: "Frequently Asked Questions",
      faqs: [
        { q: "Does the AI page builder preserve my site's Header & Footer?", a: "Yes! Every AI-generated page inherits your site's exact Header, Logo, Navigation menu, and Footer structure." },
        { q: "Can I edit the generated text and images manually?", a: "Definitely. Click any element on the preview canvas to edit its text, replace images, or add/delete custom sections." },
        { q: "How do I publish the AI generated page to live Vercel?", a: "Click the 🚀 Publish Live or Deploy Vercel button in the top toolbar to publish updates in ~30 seconds." }
      ]
    });

    // 8. Final Conversion CTA
    modules.push({
      id: "mod-final-cta",
      type: "cta",
      title: "Ready to Build High-Converting AI Pages?",
      buttonText: "Book Free Consultation"
    });

    return { headline, subheadline, modules };
  };

  // Right Side AI Assistant Chat State & Handlers
  const [selectedAIModel, setSelectedAIModel] = useState("rocket-2.6");
  const [showAgentWorkspace, setShowAgentWorkspace] = useState(false);
  const [attachedImage, setAttachedImage] = useState(null);
  const fileInputRef = useRef(null);

  const [rightPanelTab, setRightPanelTab] = useState("ai_assistant"); // "inspector" | "ai_assistant"
  const [aiChatMessages, setAiChatMessages] = useState([
    {
      sender: "assistant",
      text: "👋 Hi! I'm Rocket AI 2.6. Powered by live DOM inspection, computedStyle verification loops, multi-element target search, and verified execution reports. Click 🚀 Rocket AI 2.6 at the top to launch Workspace."
    }
  ]);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatProcessing, setAiChatProcessing] = useState(false);

  const handleImageFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedImage(event.target.result);
        toast.success("🖼️ Image attached to AI prompt!");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendAIChatMessage = (userPromptText) => {
    const textToSend = userPromptText || aiChatInput;
    if (!textToSend || !textToSend.trim()) return;

    const userMsg = textToSend.trim();
    setAiChatMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    if (!userPromptText) setAiChatInput("");
    setAiChatProcessing(true);

    setTimeout(() => {
      // Inspect live iframe DOM computed style for Header background color if accessible
      let domContext = null;
      try {
        if (iframeRef.current?.contentDocument) {
          const doc = iframeRef.current.contentDocument;
          const headerEl = doc.querySelector("header") || doc.querySelector(".header") || doc.querySelector("[data-rcms-region*='header']");
          if (headerEl) {
            const bg = window.getComputedStyle(headerEl).backgroundColor;
            domContext = { headerBgColor: bg };
          }
        }
      } catch (e) {
        // Cross-origin fallback handled safely inside engine
      }

      const pageKey = cleanPath || "page";
      const pageTitle = selectedPage?.title || "Page";

      const engineResult = rocketAIEngine.processPrompt({
        promptText: userMsg,
        attachedImage,
        pageKey,
        pageTitle,
        currentDrafts: draftValues,
        currentModules: customModules,
        model: selectedAIModel,
        domContext
      });

      // Clear attached image after processing
      if (attachedImage) setAttachedImage(null);

      // Apply region updates
      if (engineResult.regionUpdates && Object.keys(engineResult.regionUpdates).length > 0) {
        Object.entries(engineResult.regionUpdates).forEach(([rId, val]) => {
          handleRegionValueChange(rId, val);
        });
      }

      // Live DOM Canvas Manipulation fallback for instant visual match in iframe:
      try {
        if (iframeRef.current?.contentDocument) {
          const doc = iframeRef.current.contentDocument;
          const bgVal = engineResult.regionUpdates[`${pageKey}.bg_color`] || engineResult.regionUpdates[`bg_color`];
          if (bgVal === "#ffffff") {
            const targets = doc.querySelectorAll(".page-wrapper, #root, body, main, section, [data-rcms-region]");
            targets.forEach((el) => {
              if (el.tagName !== "HEADER" && !el.closest("header")) {
                el.style.backgroundColor = "#ffffff";
                el.style.color = "#0f172a";
              }
            });
          }
        }
      } catch (err) {
        // Cross-origin fallback handled safely
      }

      // Apply module updates if modified
      if (engineResult.customModules && engineResult.customModules.length > 0) {
        setCustomModules(engineResult.customModules);
      }

      setAiChatMessages((prev) => [...prev, { sender: "assistant", text: engineResult.replyText }]);
      setAiChatProcessing(false);
      toast.success("✨ Rocket AI 2.6 updated page!");
    }, 450);
  };

  const handleAILiveBuildPage = (e) => {
    if (e) e.preventDefault();
    if (!aiPromptInput.trim()) return;
    setBuildingAI(true);

    const promptText = aiPromptInput.trim();
    const pageTitle = selectedPage?.title || "AI Advertisement Page";

    const { headline, subheadline, modules } = parsePromptToPageModules(promptText, pageTitle);

    setCustomModules(modules);

    const pageKey = cleanPath || "page";
    setDraftValues((prev) => ({
      ...prev,
      [`${pageKey}.title`]: headline,
      [`${pageKey}.subtext`]: subheadline,
      [`${pageKey}.heading`]: "Comprehensive AI Capabilities",
      [`${pageKey}.description`]: "Everything you need to launch, optimize, and scale high-converting landing pages.",
      [`${pageKey}.cta_title`]: "Ready to Build High-Converting AI Pages?",
      [`${pageKey}.cta_button`]: "Book Free Consultation"
    }));

    setHasUnsavedChanges(true);
    setSaveStatus("unsaved");
    setBuildingAI(false);
    toast.success("✨ AI Live Landing Page generated successfully!");
  };

  const handleAddModule = (type) => {
    const newId = `mod-${Date.now()}`;
    let newMod = null;

    if (type === "text") {
      newMod = {
        id: newId,
        type: "content",
        heading: "New Section Heading",
        text: "Add your custom text description here. Edit values in the region inspector or inline."
      };
    } else if (type === "image") {
      newMod = {
        id: newId,
        type: "image",
        caption: "Feature Banner Visual Image",
        src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80"
      };
    } else if (type === "cards") {
      newMod = {
        id: newId,
        type: "cards",
        heading: "Key Service Highlights",
        cards: [
          { title: "High Performance", desc: "Tailored strategies that align with core business objectives." },
          { title: "Targeted Outreach", desc: "Leveraging analytics and insights to refine market position." },
          { title: "Scalable Growth", desc: "End-to-end implementation from concept to launch." }
        ]
      };
    } else if (type === "cta") {
      newMod = {
        id: newId,
        type: "cta",
        title: "Ready to transform your business?",
        buttonText: "Book Free Consultation"
      };
    }

    if (newMod) {
      setCustomModules((prev) => [...prev, newMod]);
      setHasUnsavedChanges(true);
      setSaveStatus("unsaved");
      toast.success(`+ Added ${type} module to page`);
    }
  };

  const handleRemoveModule = (modId) => {
    setCustomModules((prev) => prev.filter((m) => m.id !== modId));
    setHasUnsavedChanges(true);
    setSaveStatus("unsaved");
    toast.info("Removed section module");
  };

  const iframeRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  // Fetch page and website data
  useEffect(() => {
    if (websiteId && pageId) {
      selectWebsite(websiteId);
      fetchPageById(websiteId, pageId);
      loadRevisions(websiteId, "page", pageId);
    }
  }, [websiteId, pageId, selectWebsite, fetchPageById, loadRevisions]);

  // Sync page metadata with local state
  useEffect(() => {
    if (selectedPage) {
      const localeData = selectedPage.locales?.[activeLocale] || {};
      setPageTitle(localeData.title || selectedPage.title || "");
      setPageSlug(localeData.slug || selectedPage.slug || "");
      setPageRoute(selectedPage.route || `/${localeData.slug || selectedPage.slug || ""}`);
      setPageSeo(localeData.seo || {});
      setPageBlocks(localeData.blocks || []);

      // Default preview mode to visual page builder so custom page content and + Add Section options load directly
      if (selectedPage.isImported) {
        setPreviewModeType("direct");
      } else {
        setPreviewModeType("visual");
      }

      // Auto-populate template modules matching page type (e.g. Blog, Contact)
      const tmpl = (selectedPage.template || selectedPage.title || selectedPage.slug || "").toLowerCase();
      if (tmpl.includes("blog") || tmpl.includes("post")) {
        setCustomModules([
          {
            id: "mod-trust-blog",
            type: "trust_badges",
            badges: ["📰 Latest Articles", "💡 Industry Insights", "🚀 Tech Trends", "⚡ Weekly Updates"]
          },
          {
            id: "mod-blog-cards",
            type: "cards",
            heading: "Recent Blog Articles & Insights",
            cards: [
              { title: "Strategic Digital Growth", desc: "Discover how modern digital frameworks scale operations and increase conversion rates." },
              { title: "Building High-Performance Architecture", desc: "Key principles for managing enterprise platforms with zero friction." },
              { title: "Design System Best Practices", desc: "Creating harmonious visual consistency across all digital assets." }
            ]
          },
          {
            id: "mod-blog-faq",
            type: "faq",
            heading: "Blog & Editorial FAQ",
            faqs: [
              { q: "How often are new blog posts published?", a: "We publish fresh industry insights and technical articles weekly." },
              { q: "Can I subscribe to updates?", a: "Yes, subscribe to receive email notifications when new posts go live." }
            ]
          },
          {
            id: "mod-blog-cta",
            type: "cta",
            title: "Subscribe to Our Weekly Editorial Insights",
            buttonText: "Join Newsletter"
          }
        ]);
      } else if (tmpl.includes("contact")) {
        setCustomModules([
          {
            id: "mod-contact-cards",
            type: "cards",
            heading: "Get in Touch With Our Team",
            cards: [
              { title: "Sales & Inquiries", desc: "Reach out to our team to discuss project requirements and custom solutions." },
              { title: "24/7 Client Support", desc: "Our support engineers are available round the clock for live assistance." },
              { title: "Global Office", desc: "Visit our technology innovation hub or connect with us online." }
            ]
          },
          {
            id: "mod-contact-cta",
            type: "cta",
            title: "Ready to launch your next project?",
            buttonText: "Schedule Discovery Call"
          }
        ]);
      }
    }
  }, [selectedPage, activeLocale]);

  // Pre-populate draftValues from Firebase draft / published region content on mount
  useEffect(() => {
    if (!websiteId || !selectedPage) return;
    const pageSlug = resolvePageSlug();

    const loadInitialRegions = async () => {
      try {
        const homeDraft = await contentSyncService.getDraft(websiteId, "home");
        const homePublished = await contentSyncService.getPublished(websiteId, "home");
        const pageDraft = await contentSyncService.getDraft(websiteId, pageSlug);
        const pagePublished = await contentSyncService.getPublished(websiteId, pageSlug);

        const initialRegions = {
          ...(homePublished?.regions || {}),
          ...(homeDraft?.regions || {}),
          ...(pagePublished?.regions || {}),
          ...(pageDraft?.regions || {})
        };

        if (Object.keys(initialRegions).length > 0) {
          setDraftValues((prev) => ({ ...initialRegions, ...prev }));
        }
      } catch (err) {
        console.warn("Failed to load initial page regions:", err);
      }
    };

    loadInitialRegions();
  }, [websiteId, selectedPage?.id]);

  // Save Page Settings handler
  const handleSavePageSettings = async () => {
    try {
      await updatePage(websiteId, pageId, activeLocale, {
        title: pageTitle,
        slug: pageSlug,
        route: pageRoute,
        seo: pageSeo,
        blocks: pageBlocks
      });
      setShowPageSettingsModal(false);
    } catch (err) {
      console.error("Failed to update page settings:", err);
    }
  };

  const handleRestoreRevision = async (revisionId) => {
    if (window.confirm("Restore this revision? Unsaved page setting draft changes will be overwritten.")) {
      try {
        const snapshot = await restoreRevision(websiteId, "page", pageId, revisionId);
        if (snapshot) {
          if (snapshot.title) setPageTitle(snapshot.title);
          if (snapshot.slug) setPageSlug(snapshot.slug);
          if (snapshot.seo) setPageSeo(snapshot.seo);
          if (snapshot.blocks) setPageBlocks(snapshot.blocks);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Keep target domain in sync, defaulting directly to live production HTTPS domain
  useEffect(() => {
    if (!websiteId) return;
    const localTarget = localStorage.getItem(`rcms_target_domain_${websiteId}`);
    if (localTarget && !localTarget.includes("localhost")) {
      setTargetDomain(localTarget);
      setNewDomainInput(localTarget);
    } else if (selectedWebsite?.domain && !selectedWebsite.domain.includes("localhost")) {
      setTargetDomain(selectedWebsite.domain);
      setNewDomainInput(selectedWebsite.domain);
    } else {
      const fallbackLive = "https://triosis.vercel.app";
      setTargetDomain(fallbackLive);
      setNewDomainInput(fallbackLive);
    }
  }, [selectedWebsite, websiteId]);

  const handleSwitchTargetDomain = async (newDomain) => {
    try {
      setUpdatingDomain(true);
      localStorage.setItem(`rcms_target_domain_${websiteId}`, newDomain);
      setTargetDomain(newDomain);
      setNewDomainInput(newDomain);
      await websiteService.updateDomain(websiteId, newDomain);
      toast.success(`Preview target URL set to ${newDomain}`);

      // Auto-launch local tab/popup when switching to Local Dev on HTTPS dashboard
      if (window.location.protocol === 'https:' && newDomain.includes('localhost')) {
        const localPath = cleanPath ? `?page=${cleanPath}&rcms_preview=1` : `?rcms_preview=1`;
        window.open(`${newDomain}/${localPath}`, '_blank');
      }
    } catch (err) {
      console.error("Failed to switch target domain:", err);
      toast.error("Failed to update target domain.");
    } finally {
      setUpdatingDomain(false);
    }
  };

  // Subscribe to registered editable regions schema metadata from Firebase registry
  useEffect(() => {
    if (!websiteId || !pageId) return;

    const unsubscribe = registryService.subscribeToEditableRegions(websiteId, (allRegions) => {
      if (!allRegions) {
        setRegionsMap({});
        return;
      }

      // 1. Check exact pageId key
      let pageRegions = allRegions[pageId];

      // 2. If not found by exact pageId, check by slug or fallback to 'global' or merge all keys if empty
      if (!pageRegions || Object.keys(pageRegions).length === 0) {
        if (allRegions.global && Object.keys(allRegions.global).length > 0) {
          pageRegions = allRegions.global;
        } else {
          // Merge all available regions from all pages if pageId-specific entry is empty
          pageRegions = Object.values(allRegions).reduce((acc, curr) => ({ ...acc, ...curr }), {});
        }
      } else if (allRegions.global) {
        // Merge global regions with page specific regions
        pageRegions = { ...allRegions.global, ...pageRegions };
      }

      setRegionsMap(pageRegions || {});
    });

    return () => unsubscribe();
  }, [websiteId, pageId]);

  // Handle beforeunload protection for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Leave anyway?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Resolve page slug from selectedPage for consistent sync keys.
  // The SDK resolves pageId from the browser URL (e.g. "home", "about"),
  // so we must publish/draft under the same slug — not the Firebase doc ID.
  const resolvePageSlug = () => {
    if (selectedPage?.route && selectedPage.route !== "/") {
      return selectedPage.route.replace(/^\/+|\/+$/g, "") || "home";
    }
    const slug = selectedPage?.slug || "";
    if (slug && slug !== "home" && !slug.startsWith("0.") && !slug.startsWith("-")) return slug;
    if (selectedPage?.route === "/" || !slug || slug === "home" || slug.startsWith("-")) return "home";
    return slug || "home";
  };

  // Auto-save debounced handler (2.5 seconds)
  const triggerAutoSave = useCallback((updatedValues) => {
    setHasUnsavedChanges(true);
    setSaveStatus("unsaved");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const pageSlug = resolvePageSlug();
        const existingDraft = (await contentSyncService.getDraft(websiteId, pageSlug))
          || (await contentSyncService.getDraft(websiteId, "home"));

        const mergedValues = {
          ...(existingDraft?.regions || {}),
          ...updatedValues
        };

        const payload = {
          id: pageSlug,
          regions: mergedValues,
          updatedAt: Date.now()
        };

        const targetKeys = Array.from(new Set([pageSlug, "home", pageId]));
        await Promise.all(targetKeys.map((key) => contentSyncService.syncDraft(websiteId, key, payload)));

        setHasUnsavedChanges(false);
        setSaveStatus("saved");
        setLastSavedTime(new Date().toLocaleTimeString());
      } catch (err) {
        console.error("Auto save failed:", err);
        setSaveStatus("unsaved");
      }
    }, 2500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteId, pageId, selectedPage]);

  // Handle region value modification from inspector or iframe
  const handleRegionValueChange = (regionId, newValue) => {
    setDraftValues((prev) => {
      const next = { ...prev, [regionId]: newValue };
      triggerAutoSave(next);
      return next;
    });

    // Update active inspector element
    setSelectedElement((prev) => (prev ? { ...prev, value: newValue } : null));

    // 1. Immediately write to Firebase draft so the preview iframe's real-time
    //    draft subscription picks it up instantly (most reliable cross-origin live preview)
    visualEditService.persistFieldUpdate(websiteId, resolvePageSlug(), regionId, newValue)
      .catch(() => {}); // fire-and-forget

    // 2. Also send postMessage to iframe for instant update (belt + suspenders)
    if (iframeRef.current) {
      visualEditService.sendFieldUpdate(
        iframeRef.current,
        targetDomain,
        websiteId,
        regionId,
        "value",
        newValue
      );
    }
  };

  // Save Target App Domain
  const handleUpdateDomain = async () => {
    if (!newDomainInput.trim()) return;
    let cleanInput = newDomainInput.trim();
    if (!cleanInput.startsWith("http://") && !cleanInput.startsWith("https://")) {
      cleanInput = `https://${cleanInput}`;
    }

    try {
      const parsed = new URL(cleanInput);
      cleanInput = parsed.origin;
    } catch {
      cleanInput = cleanInput.replace(/\/$/, "");
    }

    setUpdatingDomain(true);
    try {
      await websiteService.update(websiteId, { domain: cleanInput });
      setTargetDomain(cleanInput);
      setNewDomainInput(cleanInput);
      setShowDomainModal(false);
    } catch (err) {
      console.error("Failed to update website domain:", err);
    } finally {
      setUpdatingDomain(false);
    }
  };

  // Explicit Save Draft button click
  const handleSaveDraft = async () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSaving(true);
    setSaveStatus("saving");
    try {
      const pageSlug = resolvePageSlug();
      const existingDraft = (await contentSyncService.getDraft(websiteId, pageSlug))
        || (await contentSyncService.getDraft(websiteId, "home"));

      const mergedValues = {
        ...(existingDraft?.regions || {}),
        ...draftValues
      };

      const payload = {
        id: pageSlug,
        regions: mergedValues,
        updatedAt: Date.now()
      };

      const targetKeys = Array.from(new Set([pageSlug, "home", pageId]));
      await Promise.all(targetKeys.map((key) => contentSyncService.syncDraft(websiteId, key, payload)));

      await updatePage(websiteId, pageId, activeLocale, {
        status: "draft"
      });
      setHasUnsavedChanges(false);
      setSaveStatus("saved");
      setLastSavedTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
      setSaveStatus("unsaved");
    } finally {
      setSaving(false);
    }
  };

  // Confirm and Execute Publish
  const handleExecutePublish = async () => {
    setPublishing(true);
    try {
      const pageSlug = resolvePageSlug();
      const existingDraft = (await contentSyncService.getDraft(websiteId, pageSlug))
        || (await contentSyncService.getDraft(websiteId, "home"));
      const existingPublished = (await contentSyncService.getPublished(websiteId, pageSlug))
        || (await contentSyncService.getPublished(websiteId, "home"));

      const combinedRegions = {
        ...(existingPublished?.regions || {}),
        ...(existingDraft?.regions || {}),
        ...draftValues
      };

      const payload = {
        id: pageSlug,
        regions: combinedRegions,
        publishedAt: Date.now()
      };

      // 1. Sync to all target page keys (slug, home, pageId) so client SDK resolves it on any route
      const targetKeys = Array.from(new Set([pageSlug, "home", pageId]));
      await Promise.all(targetKeys.map((key) => contentSyncService.syncPublished(websiteId, key, payload)));

      // 2. Save revision
      await revisionService.save(
        websiteId,
        "page",
        pageId,
        {
          id: pageId,
          regions: combinedRegions,
          title: selectedPage?.title || "Page"
        },
        user?.uid || "system"
      );

      // 3. Update page record
      await publishPage(websiteId, pageId, user?.uid || "system");

      // 4. Broadcast publish event to iframe
      if (iframeRef.current) {
        try {
          iframeRef.current.contentWindow.postMessage(
            {
              rcms: true,
              version: "v1",
              type: "rcms/v1/publish-page",
              websiteId,
              payload: { slug: pageSlug },
              timestamp: Date.now()
            },
            "*"
          );
        } catch (e) {
          console.warn(e);
        }
      }

      setShowPublishModal(false);
      setHasUnsavedChanges(false);
      setSaveStatus("saved");
    } catch (err) {
      console.error("Publish failed:", err);
    } finally {
      setPublishing(false);
    }
  };

  // Region Tree selection handler
  const handleSelectRegionFromTree = (regionId) => {
    const regionObj = regionsMap[regionId];
    const val = draftValues[regionId] !== undefined ? draftValues[regionId] : regionObj?.defaultValue;

    setSelectedElement({
      regionId,
      type: regionObj?.type || "text",
      label: regionObj?.label || regionId,
      pageId,
      value: val
    });

    // Notify preview iframe to highlight selected region
    if (iframeRef.current && targetDomain) {
      try {
        const origin = new URL(targetDomain).origin;
        iframeRef.current.contentWindow.postMessage(
          {
            rcms: true,
            version: "v1",
            type: "rcms/v1/open-inspector",
            websiteId,
            payload: { regionId },
            timestamp: Date.now()
          },
          origin
        );
      } catch (err) {
        console.warn("Failed to notify frame of region selection:", err);
      }
    }
  };

  // Virtual Live Preview Region Selector (WordPress Mode)
  const handleSelectVirtualRegion = (regionId, label, type = "text") => {
    const val = draftValues[regionId] !== undefined 
      ? draftValues[regionId] 
      : (regionsMap[regionId]?.defaultValue || "");

    setSelectedElement({
      regionId,
      type,
      label,
      pageId,
      value: val
    });
  };

  // Handle iframe load sequence
  const handleIframeLoad = () => {
    if (editModeActive) {
      setTimeout(() => {
        visualEditService.enableEditMode(iframeRef.current, targetDomain, websiteId);
      }, 500);
    }
  };

  // Memoized target origin to avoid running expensive URL parsing on every postMessage
  const targetOrigin = React.useMemo(() => {
    if (!targetDomain) return "";
    try {
      return new URL(targetDomain).origin;
    } catch {
      return "";
    }
  }, [targetDomain]);

  // Fast Message listener for iframe events
  useEffect(() => {
    const handleMessage = (event) => {
      const data = event.data;
      // Fast guard check: skip non-RCMS messages without parsing overhead
      if (!data || typeof data !== "object" || data.rcms !== true || data.version !== "v1") return;

      try {
        if (targetOrigin && event.origin !== targetOrigin && event.origin !== window.location.origin) return;

        if (data.type === "rcms/v1/runtime-ready") {
          if (editModeActive && iframeRef.current && targetDomain) {
            visualEditService.enableEditMode(iframeRef.current, targetDomain, websiteId);
          }
        } else if (data.type === "rcms/v1/regions-registered") {
          const payload = data.payload || {};
          if (payload.regions) {
            setRegionsMap((prev) => ({ ...prev, ...payload.regions }));
          }
        } else if (data.type === "rcms/v1/region-selected") {
          const payload = data.payload || {};
          setSelectedElement((prev) => {
            const isSameRegion = prev && prev.regionId === payload.regionId;
            return {
              regionId: payload.regionId,
              type: payload.type || (isSameRegion ? prev.type : "text"),
              label: payload.label || (isSameRegion ? prev.label : payload.regionId),
              pageId: payload.pageId || pageId,
              value: payload.value !== undefined ? payload.value : (isSameRegion ? prev.value : undefined),
              computedStyle: payload.computedStyle || (isSameRegion ? prev.computedStyle : {})
            };
          });
        } else if (data.type === "rcms/v1/field-update") {
          const payload = data.payload || {};
          if (payload.regionId) {
            setDraftValues((prev) => {
              const next = { ...prev, [payload.regionId]: payload.value };
              triggerAutoSave(next);
              return next;
            });
            setSelectedElement((prev) =>
              prev && prev.regionId === payload.regionId
                ? { ...prev, value: payload.value }
                : prev
            );
          }
        }
      } catch (err) {
        // Silent catch
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [targetOrigin, pageId]);

  // Handle Edit/Preview mode toggle
  const handleToggleEditMode = (mode) => {
    setEditModeActive(mode);
    if (mode) {
      visualEditService.enableEditMode(iframeRef.current, targetDomain, websiteId);
    } else {
      visualEditService.disableEditMode(iframeRef.current, targetDomain, websiteId);
      setSelectedElement(null);
    }
  };

  const getDeviceWidth = () => {
    switch (activeDevice) {
      case "desktop": return "1440px";
      case "laptop": return "1280px";
      case "tablet": return "768px";
      case "mobile": return "375px";
      case "full":
      default:
        return "100%";
    }
  };

  // Smart Path resolution for clean target preview URL
  let rawPath = selectedPage?.slug || selectedPage?.route || "";
  let cleanPath = "";
  if (selectedPage?.route && selectedPage.route !== "/") {
    cleanPath = selectedPage.route.replace(/^\/+/, "");
  } else if (rawPath && rawPath !== "home" && !rawPath.startsWith("0.")) {
    cleanPath = rawPath.replace(/^\/+/, "");
  }

  // Always sanitize cleanDomain to base origin (e.g. https://triosis.vercel.app without subpaths)
  let cleanDomain = "";
  if (targetDomain) {
    try {
      let raw = targetDomain.trim();
      if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
      cleanDomain = new URL(raw).origin;
    } catch {
      cleanDomain = targetDomain.replace(/\/$/, "");
    }
  }

  let previewUrl = "";
  if (cleanDomain) {
    if (previewModeType === "shell" && cleanPath && cleanPath !== "home") {
      previewUrl = `${cleanDomain}/?page=${encodeURIComponent(cleanPath)}&rcms_preview=1`;
    } else if (cleanPath && cleanPath !== "home") {
      previewUrl = `${cleanDomain}/${cleanPath}?rcms_preview=1`;
    } else {
      previewUrl = `${cleanDomain}/?rcms_preview=1`;
    }
  }

  // Check if targetDomain points to Dashboard Vercel origin itself
  const isSelfDashboardOrigin = cleanDomain && (
    cleanDomain === window.location.origin ||
    cleanDomain.includes("react-cms-pro.vercel.app")
  );

  const handleExit = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedModal(true);
    } else {
      navigate(`/content/${websiteId}/pages`);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans select-none">
      {/* Top Navigation Toolbar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between gap-4 flex-shrink-0 z-30">
        {/* Left: Exit & Page Details */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Pages</span>
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <div>
            <h1 className="text-xs font-bold text-slate-100 flex items-center gap-2">
              <span>{selectedPage?.title || "Page Editor"}</span>
              <code className="text-[10px] text-purple-400 font-mono font-normal">
                {cleanPath ? `/${cleanPath}` : "/ (home)"}
              </code>
            </h1>
          </div>
        </div>

        {/* Middle: Target App Domain & Auto-Save Status */}
        <div className="flex items-center gap-4">
          {/* Target App Domain Badge & Quick Selector */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowDomainModal(true)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-mono transition-colors cursor-pointer ${
                isSelfDashboardOrigin
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                  : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
              }`}
              title="Click to enter custom client app preview URL"
            >
              <Link2 className="w-3.5 h-3.5 text-primary" />
              <span className="truncate max-w-[140px]">{targetDomain || "Set Target App Domain"}</span>
              <Settings className="w-3 h-3 text-slate-500" />
            </button>

            {/* View Mode Selector: Visual Page Builder (+ Add Sections) vs Connected Live Site */}
            <div className="hidden lg:flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
              <button
                onClick={() => setPreviewModeType("visual")}
                className={`px-3 py-1 rounded font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  previewModeType === "visual"
                    ? "bg-purple-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Visual Page Builder with AI and + Add Section controls"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                <span>Visual Page Builder (+ Add Sections)</span>
              </button>
              <button
                onClick={() => setPreviewModeType("shell")}
                className={`px-3 py-1 rounded font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  previewModeType === "shell"
                    ? "bg-purple-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Connected Live Site Frame preview"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Live Site Frame</span>
              </button>
            </div>
          </div>

          {/* Auto-save Status Indicator */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            {saveStatus === "saving" ? (
              <span className="text-amber-400 flex items-center gap-1 font-bold">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving...
              </span>
            ) : saveStatus === "unsaved" ? (
              <span className="text-amber-400 flex items-center gap-1 font-bold">
                <AlertCircle className="w-3 h-3" /> Unsaved Changes
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1 font-bold">
                <CheckCircle className="w-3 h-3" /> Saved {lastSavedTime ? `at ${lastSavedTime}` : ""}
              </span>
            )}
          </div>

          {/* Device Switcher */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {[
              { id: "full", icon: Maximize2, label: "Full" },
              { id: "desktop", icon: Monitor, label: "Desktop" },
              { id: "laptop", icon: Laptop, label: "Laptop" },
              { id: "tablet", icon: Tablet, label: "Tablet" },
              { id: "mobile", icon: Smartphone, label: "Mobile" },
            ].map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.id}
                  onClick={() => setActiveDevice(d.id)}
                  className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                    activeDevice === d.id ? "bg-primary text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                  title={`${d.label} View`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>

          {/* Edit vs Preview Toggle */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => handleToggleEditMode(true)}
              className={`px-3 py-1 rounded font-bold transition-all cursor-pointer ${
                editModeActive ? "bg-primary text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => handleToggleEditMode(false)}
              className={`px-3 py-1 rounded font-bold transition-all cursor-pointer ${
                !editModeActive ? "bg-primary text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Preview
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Open Preview in New Tab */}
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Open Full Preview in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {/* Refresh Frame */}
          <button
            onClick={() => {
              if (iframeRef.current && previewUrl) iframeRef.current.src = previewUrl;
            }}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Reload Preview Frame"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Page Settings & Configuration */}
          <button
            onClick={() => setShowPageSettingsModal(true)}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer bg-slate-950/60"
            title="Page Properties, SEO Metadata & Revisions"
          >
            <Settings className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline font-semibold">Settings</span>
          </button>

          {/* Save Draft */}
          <Button
            onClick={handleSaveDraft}
            variant="secondary"
            className="text-xs py-1.5 px-3 font-bold gap-1.5 cursor-pointer"
            loading={saving}
          >
            <Save className="w-3.5 h-3.5" />
            Save Draft
          </Button>

          {/* Publish */}
          <Button
            onClick={() => setShowPublishModal(true)}
            variant="primary"
            className="text-xs py-1.5 px-3 font-bold gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Publish
          </Button>

          {/* Rocket AI 2.6 DOM Verification Agent Workspace Launcher */}
          <Button
            onClick={() => setShowAgentWorkspace(true)}
            variant="primary"
            className="text-xs py-1.5 px-3 font-bold gap-1.5 cursor-pointer bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 hover:brightness-110"
            title="Launch Rocket AI 2.6 DOM Verification Agent Workspace"
          >
            <Sparkles className="w-3.5 h-3.5" />
            🚀 Rocket AI 2.6
          </Button>

          {/* Trigger Vercel Deployment */}
          <Button
            onClick={handleTriggerVercelDeploy}
            variant="secondary"
            loading={deployingVercel}
            className="text-xs py-1.5 px-3 font-bold gap-1.5 cursor-pointer bg-purple-950/60 border-purple-500/40 text-purple-200 hover:bg-purple-900/80"
            title="Trigger 1-click Vercel deployment directly from CMS without writing code or git commands"
          >
            <UploadCloud className="w-3.5 h-3.5 text-purple-400" />
            Deploy Vercel
          </Button>
        </div>
      </header>

      {/* Main 3-Pane Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Pane: Region Tree */}
        <div className="w-64 flex-shrink-0 hidden md:block">
          <RegionTreePanel
            regionsMap={regionsMap}
            selectedRegionId={selectedElement?.regionId}
            onSelectRegion={handleSelectRegionFromTree}
            pageTitle={selectedPage?.title}
          />
        </div>

        {/* Center Pane: Preview Iframe Container */}
        <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-4 overflow-auto relative">
          {isSelfDashboardOrigin && (
            <div className="mb-3 w-full max-w-2xl bg-amber-950/80 border border-amber-500/40 p-3 rounded-xl flex items-center justify-between text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <span>
                  Connected app URL points to Dashboard (<strong>{targetDomain}</strong>). Enter your client React app domain (e.g. <code>http://localhost:5173</code>) to preview live.
                </span>
              </div>
              <button
                onClick={() => setShowDomainModal(true)}
                className="px-2.5 py-1 bg-amber-500 text-slate-950 font-bold rounded hover:bg-amber-400 transition-colors ml-3 flex-shrink-0 cursor-pointer"
              >
                Change URL
              </button>
            </div>
          )}



          {previewModeType === "shell" && cleanPath && cleanPath !== "home" && !isSelfDashboardOrigin && (
            <div className="mb-2 w-full max-w-2xl bg-purple-950/70 border border-purple-500/30 p-2.5 rounded-xl flex items-center justify-between text-xs text-purple-200">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span>
                  ✨ Previewing page <strong>/{cleanPath}</strong> using <strong>Site Layout Shell</strong>. Header, Footer &amp; existing site structure are automatically inherited.
                </span>
              </div>
              <button
                onClick={() => setPreviewModeType("direct")}
                className="text-[11px] underline text-purple-300 hover:text-white font-semibold flex-shrink-0 cursor-pointer ml-3"
              >
                Try Direct Route
              </button>
            </div>
          )}

          {previewModeType === "visual" ? (
            <div
              style={{ width: getDeviceWidth(), transform: 'translateZ(0)' }}
              className="h-full w-full bg-white text-slate-900 rounded-xl overflow-y-auto shadow-2xl border border-slate-300 relative text-left"
            >
              {/* Layout Common Section Selection Control Bar */}
              <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-white sticky top-0 z-30 shadow-md">
                <div className="flex items-center gap-2 font-bold text-slate-300">
                  <Sliders className="w-3.5 h-3.5 text-purple-400" />
                  <span>Include Common Home Page Layout Sections:</span>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-purple-300">
                    <input
                      type="checkbox"
                      checked={includeHeader}
                      onChange={(e) => setIncludeHeader(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-0 accent-purple-600 cursor-pointer"
                    />
                    <span className="font-bold">Header</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-purple-300">
                    <input
                      type="checkbox"
                      checked={includeHero}
                      onChange={(e) => setIncludeHero(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-0 accent-purple-600 cursor-pointer"
                    />
                    <span className="font-bold">Hero Section</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-purple-300">
                    <input
                      type="checkbox"
                      checked={includeFooter}
                      onChange={(e) => setIncludeFooter(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-0 accent-purple-600 cursor-pointer"
                    />
                    <span className="font-bold">Footer</span>
                  </label>
                </div>
              </div>

                {/* Site Header (Matching Connected Triosis Site Layout) */}
              {includeHeader && (
                <header className="bg-white text-slate-900 py-4 px-8 border-b border-slate-100 flex items-center justify-between relative z-20 shadow-sm">
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleSelectVirtualRegion("header.logo", "Site Header Logo")}>
                    <div className="w-8 h-8 rounded-xl bg-[#ff5a5f] flex items-center justify-center font-black text-white text-base shadow">
                      T
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="font-extrabold text-xl tracking-tight text-[#ff5a5f]">
                        {draftValues["Hero Symbol Logo"] || draftValues["header.logo"] || "Triosis"}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 -mt-1 tracking-widest uppercase">Digital</span>
                    </div>
                  </div>

                  {/* Standard Main Navigation Links (No custom page path inserted) */}
                  <nav className="hidden md:flex items-center gap-7 text-xs font-bold uppercase tracking-wider text-slate-600">
                    <a href="#" className="hover:text-[#ff5a5f] transition-colors">Home</a>
                    <a href="#" className="hover:text-[#ff5a5f] transition-colors">About Us</a>
                    <a href="#" className="hover:text-[#ff5a5f] transition-colors">Services</a>
                    <a href="#" className="hover:text-[#ff5a5f] transition-colors">Portfolio</a>
                    <a href="#" className="hover:text-[#ff5a5f] transition-colors">Blog</a>
                    <a href="#" className="hover:text-[#ff5a5f] transition-colors">Contact Us</a>
                  </nav>

                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleSelectVirtualRegion("header.cta", "Header Call To Action")}
                      className="hidden sm:inline-block px-5 py-2.5 bg-[#ff5a5f] hover:bg-[#ff4449] text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
                    >
                      {draftValues["header.cta"] || "Get Started"}
                    </button>
                    <button className="p-2 rounded-lg text-[#ff5a5f] hover:bg-rose-50 transition-colors cursor-pointer md:hidden">
                      <Menu className="w-6 h-6" />
                    </button>
                  </div>
                </header>
              )}

              {/* Selected Page Visual Hero Banner */}
              {includeHero && (
                <div className="py-16 px-8 bg-slate-50 text-slate-900 text-center relative border-b border-slate-100">
                  <div 
                    onClick={() => handleSelectVirtualRegion("Hero Heading", "Page Hero Heading")}
                    className={`p-6 max-w-4xl mx-auto rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                      selectedElement?.regionId === "Hero Heading" || selectedElement?.regionId === `${cleanPath || "page"}.title` ? "border-[#ff5a5f] bg-rose-50/50 ring-2 ring-rose-300" : "border-transparent hover:border-slate-300"
                    }`}
                  >
                    <h1 className="text-4xl md:text-5xl font-black text-[#ff5a5f] tracking-tight leading-tight mb-4 capitalize">
                      {draftValues["Hero Heading"] || draftValues[`${cleanPath || "page"}.title`] || selectedPage?.title || cleanPath || "New Created Page"}
                    </h1>
                  </div>

                  {/* Subtext */}
                  <div 
                    onClick={() => handleSelectVirtualRegion("Hero Subtext", "Page Hero Subtext")}
                    className={`mt-2 max-w-2xl mx-auto p-4 rounded-xl border border-dashed transition-all cursor-pointer ${
                      selectedElement?.regionId === "Hero Subtext" || selectedElement?.regionId === `${cleanPath || "page"}.subtext` ? "border-[#ff5a5f] bg-rose-50/50" : "border-transparent hover:border-slate-200"
                    }`}
                  >
                    <p className="text-sm text-slate-600 text-center leading-relaxed">
                      {draftValues["Hero Subtext"] || draftValues[`${cleanPath || "page"}.subtext`] || selectedPage?.prompt || `We help ambitious businesses grow through innovative technology, creative marketing, and measurable digital strategies.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Render Dynamic Custom Modules */}
              {customModules.map((mod) => (
                <div key={mod.id} className="relative group border-b border-slate-100">
                  <button
                    onClick={() => handleRemoveModule(mod.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-red-500 text-white p-1 text-[10px] rounded font-bold transition-all z-10 cursor-pointer"
                  >
                    Remove Section
                  </button>

                  {mod.type === "trust_badges" && (
                    <div className="py-6 px-8 bg-slate-900 text-white border-y border-slate-800">
                      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-6 text-xs font-bold uppercase tracking-wider text-slate-300">
                        {mod.badges.map((b, idx) => (
                          <span key={idx} className="bg-slate-800 px-3.5 py-1.5 rounded-full border border-slate-700 shadow-sm flex items-center gap-1.5">
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {mod.type === "features_6" && (
                    <div className="py-16 px-8 bg-white border-b border-slate-100">
                      <div className="max-w-6xl mx-auto text-center">
                        <h3 className="text-3xl font-extrabold text-slate-900 mb-2">{mod.heading}</h3>
                        <p className="text-sm text-slate-500 mb-12 max-w-2xl mx-auto">{mod.subheading}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                          {mod.cards.map((c, idx) => (
                            <div key={idx} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 hover:shadow-md transition-all">
                              <div className="text-3xl mb-3">{c.icon}</div>
                              <h4 className="text-lg font-bold text-slate-900 mb-2">{c.title}</h4>
                              <p className="text-xs text-slate-600 leading-relaxed">{c.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {mod.type === "how_it_works" && (
                    <div className="py-16 px-8 bg-slate-950 text-white border-b border-slate-900">
                      <div className="max-w-5xl mx-auto text-center">
                        <h3 className="text-3xl font-extrabold mb-12">{mod.heading}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          {mod.steps.map((s, idx) => (
                            <div key={idx} className="bg-slate-900 p-8 rounded-2xl border border-slate-800 relative text-left">
                              <span className="text-4xl font-black text-purple-400 opacity-90 mb-4 block font-mono">{s.step}</span>
                              <h4 className="text-lg font-bold mb-2 text-white">{s.title}</h4>
                              <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {mod.type === "content" && (
                    <div className="py-12 px-8 max-w-4xl mx-auto">
                      <h3 className="text-2xl font-bold text-[#ff5a5f] mb-3">{mod.heading}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{mod.text}</p>
                    </div>
                  )}

                  {mod.type === "image" && (
                    <div className="py-10 px-8 max-w-4xl mx-auto text-center">
                      <img src={mod.src} alt={mod.caption} className="w-full max-h-96 object-cover rounded-2xl shadow-lg border" />
                      <p className="text-xs text-slate-500 mt-2 italic">{mod.caption}</p>
                    </div>
                  )}

                  {mod.type === "cards" && (
                    <div className="py-12 px-8 bg-slate-50">
                      <div className="max-w-5xl mx-auto">
                        <h3 className="text-xl font-bold text-slate-900 mb-6 text-center">{mod.heading}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {mod.cards.map((c, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                              <h4 className="font-bold text-[#ff5a5f] mb-2">{c.title}</h4>
                              <p className="text-xs text-slate-600 leading-relaxed">{c.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {mod.type === "faq" && (
                    <div className="py-12 px-8 bg-white border-b border-slate-100">
                      <div className="max-w-4xl mx-auto">
                        <h3 className="text-2xl font-bold mb-6 text-center text-slate-900">{mod.heading}</h3>
                        <div className="space-y-4">
                          {(mod.faqs || []).map((f, idx) => (
                            <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                              <h4 className="font-bold text-[#ff5a5f] text-sm mb-1">{f.q}</h4>
                              <p className="text-xs text-slate-600 leading-relaxed">{f.a}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {mod.type === "cta" && (
                    <div className="py-12 px-8 bg-slate-900 text-white text-center">
                      <h3 className="text-2xl font-bold mb-3">{mod.title}</h3>
                      <button className="mt-4 px-8 py-3 bg-[#ff5a5f] text-white font-bold rounded-full text-sm shadow-lg cursor-pointer hover:bg-[#ff4449]">
                        {mod.buttonText}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Site Footer (Matching Connected Triosis Site Layout & Coral Theme) */}
              {includeFooter && (
                <footer className="bg-[#fcfbfb] text-slate-700 py-16 px-8 border-t border-slate-200 text-left font-sans">
                  <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                    {/* Left Column: Social Icons */}
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <span className="font-black text-2xl text-[#ff5a5f]">Triosis</span>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Digital</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[#ff5a5f] font-bold text-xs shadow-sm hover:border-[#ff5a5f] transition-all cursor-pointer">X</div>
                        <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[#ff5a5f] font-bold text-xs shadow-sm hover:border-[#ff5a5f] transition-all cursor-pointer">f</div>
                        <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[#ff5a5f] font-bold text-xs shadow-sm hover:border-[#ff5a5f] transition-all cursor-pointer">in</div>
                        <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[#ff5a5f] font-bold text-xs shadow-sm hover:border-[#ff5a5f] transition-all cursor-pointer">▶</div>
                      </div>
                    </div>

                    {/* Center Column: FIND US! */}
                    <div>
                      <h4 
                        className="text-xs font-black text-[#ff5a5f] uppercase tracking-widest mb-4 cursor-pointer hover:underline"
                        onClick={() => handleSelectVirtualRegion("Footer Find Us Title", "Footer Find Us Title")}
                      >
                        {draftValues["Footer Find Us Title"] || "FIND US!"}
                      </h4>
                      <div className="space-y-3 text-xs font-medium text-[#ff5a5f] uppercase tracking-wide">
                        <p 
                          className="cursor-pointer hover:opacity-80 leading-relaxed"
                          onClick={() => handleSelectVirtualRegion("Footer Address", "Footer Address")}
                        >
                          {draftValues["Footer Address"] || "TRIOSIS DIGITAL TOWER 2, HILITE BUSINESS PARK, DOOR NO : 2211, SECOND FLOOR, POOVANGAL, PANTHEERAMKAVU, KOZHIKODE, KERALA 673014"}
                        </p>
                        <p 
                          className="cursor-pointer hover:opacity-80 font-bold"
                          onClick={() => handleSelectVirtualRegion("Footer Email", "Footer Email")}
                        >
                          {draftValues["Footer Email"] || "INFO@TRIOSIS.IN"}
                        </p>
                        <p 
                          className="cursor-pointer hover:opacity-80 font-bold"
                          onClick={() => handleSelectVirtualRegion("Footer Phone", "Footer Phone")}
                        >
                          {draftValues["Footer Phone"] || "+91 9605507008"}
                        </p>
                      </div>
                    </div>

                    {/* Right Column: LINKS! */}
                    <div>
                      <h4 
                        className="text-xs font-black text-[#ff5a5f] uppercase tracking-widest mb-4 cursor-pointer hover:underline"
                        onClick={() => handleSelectVirtualRegion("Footer Links Title", "Footer Links Title")}
                      >
                        {draftValues["Footer Links Title"] || "LINKS!"}
                      </h4>
                      <ul className="grid grid-cols-2 gap-2 text-xs font-bold uppercase tracking-wider text-[#ff5a5f]">
                        <li><a href="#" className="hover:opacity-80 transition-opacity">HOME</a></li>
                        <li><a href="#" className="hover:opacity-80 transition-opacity">ABOUT US</a></li>
                        <li><a href="#" className="hover:opacity-80 transition-opacity">CAREER</a></li>
                        <li><a href="#" className="hover:opacity-80 transition-opacity">OUR TEAM</a></li>
                        <li><a href="#" className="hover:opacity-80 transition-opacity">FAQS</a></li>
                        <li><a href="#" className="hover:opacity-80 transition-opacity">SERVICES</a></li>
                        <li><a href="#" className="hover:opacity-80 transition-opacity">PORTFOLIO</a></li>
                        <li><a href="#" className="hover:opacity-80 transition-opacity">BLOG</a></li>
                        <li><a href="#" className="hover:opacity-80 transition-opacity">CONTACT US</a></li>
                      </ul>
                    </div>
                  </div>

                  <div className="max-w-6xl mx-auto border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#ff5a5f] font-medium">
                    <span 
                      className="cursor-pointer hover:underline"
                      onClick={() => handleSelectVirtualRegion("Footer Copyright", "Footer Copyright")}
                    >
                      {draftValues["Footer Copyright"] || "© 2026 Triosis. All Rights Reserved"}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">Connected Triosis Site Shell</span>
                  </div>
                </footer>
              )}

              {/* Manual Module Inserter Toolbar */}
              <div className="py-8 px-8 bg-slate-900 text-white text-center border-t border-slate-800">
                <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3">
                  + Add Layout Sections &amp; Custom Modules to /{cleanPath || "page"}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => setIncludeHeader(!includeHeader)}
                    className={`px-3 py-1.5 font-bold text-xs rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                      includeHeader ? "bg-purple-900/60 border-purple-500 text-purple-200" : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}
                  >
                    {includeHeader ? "✓ Header Included" : "+ Add Header"}
                  </button>
                  <button
                    onClick={() => setIncludeHero(!includeHero)}
                    className={`px-3 py-1.5 font-bold text-xs rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                      includeHero ? "bg-purple-900/60 border-purple-500 text-purple-200" : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}
                  >
                    {includeHero ? "✓ Hero Included" : "+ Add Hero"}
                  </button>
                  <button
                    onClick={() => handleAddModule("text")}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-purple-900 text-white font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    + Add Text Module
                  </button>
                  <button
                    onClick={() => handleAddModule("image")}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-purple-900 text-white font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    + Add Image Module
                  </button>
                  <button
                    onClick={() => handleAddModule("cards")}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-purple-900 text-white font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    + Add Service Cards
                  </button>
                  <button
                    onClick={() => handleAddModule("cta")}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-purple-900 text-white font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    + Add CTA Banner
                  </button>
                  <button
                    onClick={() => setIncludeFooter(!includeFooter)}
                    className={`px-3 py-1.5 font-bold text-xs rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                      includeFooter ? "bg-purple-900/60 border-purple-500 text-purple-200" : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}
                  >
                    {includeFooter ? "✓ Footer Included" : "+ Add Footer"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{ width: getDeviceWidth(), transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
              className="h-full bg-white rounded-xl overflow-hidden shadow-2xl transition-[width] duration-300 border border-slate-800 relative will-change-transform"
            >
              {previewUrl ? (
                <iframe
                  ref={iframeRef}
                  src={previewUrl}
                  onLoad={handleIframeLoad}
                  className="w-full h-full border-0"
                  title="Visual Site Preview"
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <Globe className="w-10 h-10 mb-3 text-slate-400" />
                  <h4 className="font-bold text-slate-700">No Target App URL Configured</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Please configure the domain URL of your connected client React application to display the live preview.
                  </p>
                  <button
                    onClick={() => setShowDomainModal(true)}
                    className="mt-4 px-4 py-2 bg-primary text-white font-bold rounded-lg text-xs hover:bg-primary/90"
                  >
                    Set App Domain URL
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Pane: Inspector & AI Assistant Tabs */}
        <div className="w-80 flex-shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-hidden text-left">
          {/* Tab Switcher */}
          <div className="flex border-b border-slate-800 bg-slate-950 p-1">
            <button
              onClick={() => setRightPanelTab("inspector")}
              className={`flex-1 py-1.5 text-xs font-bold rounded transition-all cursor-pointer ${
                rightPanelTab === "inspector" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Inspector
            </button>
            <button
              onClick={() => setRightPanelTab("ai_assistant")}
              className={`flex-1 py-1.5 text-xs font-bold rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                rightPanelTab === "ai_assistant" ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              AI Assistant
            </button>
          </div>

          {rightPanelTab === "inspector" ? (
            <RegionInspectorPanel
              selectedElement={selectedElement}
              onChangeRegion={handleRegionValueChange}
              activePageId={pageId}
              onSwitchDevice={(bp) => {
                const deviceMap = { mobile: "mobile", tablet: "tablet", desktop: "desktop" };
                setActiveDevice(deviceMap[bp] || "full");
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col h-full bg-slate-950 text-left overflow-hidden">
              {/* Chat Header with AI Model Selector */}
              <div className="p-3 border-b border-slate-800 bg-slate-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold shadow">
                    ✨
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>AI Assistant</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    </h4>
                    <p className="text-[10px] text-purple-400 font-mono">Connected: /{cleanPath}</p>
                  </div>
                </div>

                {/* AI Model Selector */}
                <select
                  value={selectedAIModel}
                  onChange={(e) => setSelectedAIModel(e.target.value)}
                  className="bg-slate-950 text-purple-300 border border-purple-500/40 text-[10px] font-bold px-2 py-1 rounded outline-none cursor-pointer hover:border-purple-400 transition-colors"
                >
                  <option value="rocket-2.6">🚀 Rocket AI 2.6 (DOM Verification Agent)</option>
                </select>
              </div>

              {/* Chat Messages List */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
                {aiChatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      msg.sender === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[88%] p-2.5 rounded-xl leading-relaxed whitespace-pre-wrap ${
                        msg.sender === "user"
                          ? "bg-purple-600 text-white rounded-br-none shadow-md"
                          : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {aiChatProcessing && (
                  <div className="flex items-center gap-2 text-purple-400 text-xs font-bold p-2 bg-slate-900/60 rounded-lg border border-purple-500/20">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Rocket AI 2.6 (DOM Verification Agent) processing prompt...
                  </div>
                )}
              </div>

              {/* Quick Action Prompt Pills */}
              <div className="p-2 bg-slate-900/80 border-t border-slate-800 flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleSendAIChatMessage('i want bg colour header same as this colour on this entire page now black that i dont want -, this not white check it')}
                  className="text-[10px] bg-purple-950/80 border border-purple-500/30 text-purple-200 px-2 py-1 rounded hover:bg-purple-900 transition-colors cursor-pointer"
                >
                  🎨 Match Header & Page Theme
                </button>
                <button
                  onClick={() => handleSendAIChatMessage('next add a above about ads 📊 Client Success Statistics moving carosil')}
                  className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  📊 Add Moving Stats Carousel
                </button>
                <button
                  onClick={() => handleSendAIChatMessage('below book free consultation add : Create a "Why Choose Us" section with 6 cards')}
                  className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  🌟 Add Why Choose Us
                </button>
                <button
                  onClick={() => handleSendAIChatMessage('Change title to "Generate High-Converting AI Landing Pages in Seconds"')}
                  className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  ✍️ Update Title
                </button>
              </div>

              {/* Attached Image Thumbnail Preview */}
              {attachedImage && (
                <div className="px-2.5 pt-2 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
                  <div className="relative group">
                    <img src={attachedImage} alt="Attached Preview" className="w-12 h-12 object-cover rounded-lg border border-purple-500 shadow" />
                    <button
                      onClick={() => setAttachedImage(null)}
                      className="absolute -top-1.5 -right-1.5 bg-red-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shadow cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                  <span className="text-[11px] text-purple-300 font-semibold">Image attached to prompt</span>
                </div>
              )}

              {/* Chat Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendAIChatMessage();
                }}
                className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
              >
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileSelect}
                  accept="image/*"
                  className="hidden"
                />
                
                {/* Image Attach Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 text-slate-400 hover:text-purple-300 bg-slate-950 border border-slate-800 hover:border-purple-500/50 rounded-lg transition-colors cursor-pointer"
                  title="Attach Image to Prompt"
                >
                  🖼️
                </button>

                <input
                  type="text"
                  value={aiChatInput}
                  onChange={(e) => setAiChatInput(e.target.value)}
                  placeholder="Ask AI Assistant to edit page..."
                  className="flex-1 bg-slate-950 border border-slate-800 text-xs text-white px-3 py-1.5 rounded-lg focus:border-purple-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={aiChatProcessing || (!aiChatInput.trim() && !attachedImage)}
                  className="px-3 py-1.5 bg-purple-600 text-white font-bold text-xs rounded-lg hover:bg-purple-500 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Target Domain Configuration Modal */}
      {showDomainModal && (
        <Modal
          isOpen={showDomainModal}
          onClose={() => setShowDomainModal(false)}
          title="Connected Client App URL"
        >
          <div className="space-y-4 text-left p-1">
            <p className="text-xs text-slate-300 leading-relaxed">
              Enter the target domain or local URL where your connected React client application (with <code>@anshif.rainhopes/reactcms-runtime</code>) is running.
            </p>
            <Input
              label="Connected Client App URL"
              value={newDomainInput}
              onChange={(e) => setNewDomainInput(e.target.value)}
              placeholder="e.g. http://localhost:5173 or https://my-client-app.vercel.app"
            />
            <div className="text-[11px] text-slate-400 bg-slate-900 p-2.5 rounded border border-slate-800">
              💡 For local testing, use <code>http://localhost:5173</code> (or your local dev server port).
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setShowDomainModal(false)}
                className="text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdateDomain}
                loading={updatingDomain}
                className="text-xs font-bold"
              >
                Save Connected URL
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Publish Confirmation Modal */}
      {showPublishModal && (
        <Modal
          isOpen={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          title="Publish Changes to Live Site?"
        >
          <div className="space-y-4 text-left p-1">
            <p className="text-xs text-slate-300 leading-relaxed">
              Publishing will push your current draft changes live. This action will replace the current published website content for <strong className="text-white">/{cleanPath || "home"}</strong> and create a new revision entry.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setShowPublishModal(false)}
                className="text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleExecutePublish}
                loading={publishing}
                className="text-xs font-bold gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Publish Live
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Unsaved Changes Exit Protection Modal */}
      {showUnsavedModal && (
        <Modal
          isOpen={showUnsavedModal}
          onClose={() => setShowUnsavedModal(false)}
          title="You Have Unsaved Changes"
        >
          <div className="space-y-4 text-left p-1">
            <p className="text-xs text-slate-300 leading-relaxed">
              You have modified region values on this page that have not been saved to draft. Are you sure you want to leave anyway?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setShowUnsavedModal(false)}
                className="text-xs font-bold"
              >
                Stay on Page
              </Button>
              <Button
                variant="danger"
                onClick={() => navigate(`/content/${websiteId}/pages`)}
                className="text-xs font-bold"
              >
                Leave Anyway
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Page Settings & Configuration Modal */}
      {showPageSettingsModal && (
        <Modal
          isOpen={showPageSettingsModal}
          onClose={() => setShowPageSettingsModal(false)}
          title={`Page Configuration: ${pageTitle || "Page Settings"}`}
          size="lg"
        >
          <div className="space-y-4 text-left p-1">
            {/* Modal Tabs */}
            <div className="flex border-b border-slate-800 gap-2 pb-2 overflow-x-auto">
              {[
                { id: "general", label: "Page Properties" },
                { id: "seo", label: "SEO Metadata" },
                { id: "blocks", label: "Fallback Blocks" },
                { id: "revisions", label: "Revisions" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSettingsTab(tab.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeSettingsTab === tab.id
                      ? "bg-primary text-white shadow-sm"
                      : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* General Tab */}
            {activeSettingsTab === "general" && (
              <div className="space-y-4">
                <Input
                  label="Page Display Title"
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  placeholder="e.g. Home Page"
                />
                <Input
                  label="Path Slug"
                  value={pageSlug}
                  onChange={(e) => setPageSlug(e.target.value)}
                  placeholder="e.g. home or about-us"
                />
                <Input
                  label="Route Path Override"
                  value={pageRoute}
                  onChange={(e) => setPageRoute(e.target.value)}
                  placeholder="e.g. /about"
                />
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1 text-left">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                      Page Status
                    </label>
                    <select
                      value={selectedPage?.status || "draft"}
                      onChange={(e) => updatePage(websiteId, pageId, activeLocale, { status: e.target.value })}
                      className="w-full text-xs py-2 px-3 rounded-lg border border-slate-750 bg-slate-850 text-slate-200 outline-none focus:border-primary"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div className="flex-1 space-y-1 text-left">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                      Page Source
                    </label>
                    <input
                      disabled
                      value={selectedPage?.source || "cms"}
                      className="w-full text-xs py-2 px-3 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 outline-none capitalize font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SEO Tab */}
            {activeSettingsTab === "seo" && (
              <div className="max-h-[420px] overflow-y-auto pr-1">
                <SEOPanel
                  seoData={pageSeo}
                  onChange={setPageSeo}
                  blocks={pageBlocks}
                />
              </div>
            )}

            {/* Fallback Block Layout Tab */}
            {activeSettingsTab === "blocks" && (
              <div className="max-h-[420px] overflow-y-auto pr-1">
                <p className="text-xs text-slate-400 mb-3">
                  Configure structural JSON block fallbacks for original CMS layout rendering.
                </p>
                <BlockEditor
                  blocks={pageBlocks}
                  onChange={setPageBlocks}
                  activeLocale={activeLocale}
                />
              </div>
            )}

            {/* Revisions Tab */}
            {activeSettingsTab === "revisions" && (
              <div className="max-h-[420px] overflow-y-auto pr-1">
                <RevisionPanel
                  revisions={revisions}
                  onRestore={handleRestoreRevision}
                />
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                variant="secondary"
                onClick={() => setShowPageSettingsModal(false)}
                className="text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSavePageSettings}
                className="text-xs font-bold gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Save Page Settings
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Vercel Deploy Hook Setup Modal */}
      {showVercelModal && (
        <Modal
          isOpen={showVercelModal}
          onClose={() => setShowVercelModal(false)}
          title="Configure 1-Click Vercel Deploy Hook"
        >
          <div className="space-y-4 text-left p-1">
            <p className="text-xs text-slate-300 leading-relaxed">
              Enter your Vercel Deploy Hook URL once to enable 1-click deployments directly from the CMS header without editing code or running manual git commands.
            </p>
            <Input
              label="Vercel Deploy Hook URL"
              value={vercelHookInput}
              onChange={(e) => setVercelHookInput(e.target.value)}
              placeholder="e.g. https://api.vercel.com/v1/integrations/deploy/..."
            />
            <div className="text-[11px] text-slate-400 bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1.5">
              <p className="font-bold text-white">How to get your Vercel Deploy Hook URL:</p>
              <p>1. Go to your Vercel Dashboard project settings.</p>
              <p>2. Navigate to <strong>Git -&gt; Deploy Hooks</strong>.</p>
              <p>3. Click <strong>Create Hook</strong> (name: "ReactCMS", branch: "main") and copy the webhook URL.</p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setShowVercelModal(false)}
                className="text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveVercelHook}
                disabled={!vercelHookInput.trim()}
                className="text-xs font-bold gap-1.5"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Save &amp; Deploy Now
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rocket AI 2.4 Autonomous Agent Workspace Modal */}
      <RocketAIAgentWorkspaceModal
        isOpen={showAgentWorkspace}
        onClose={() => setShowAgentWorkspace(false)}
        pageKey={cleanPath || "page"}
        pageTitle={selectedPage?.title || "Page"}
        draftValues={draftValues}
        customModules={customModules}
        targetDomain={targetDomain}
        onUpdateRegions={(regionUpdates) => {
          Object.entries(regionUpdates).forEach(([rId, val]) => {
            handleRegionValueChange(rId, val);
          });
        }}
        onUpdateModules={(newModules) => {
          setCustomModules(newModules);
        }}
      />
    </div>
  );
}

export default VisualEditorPage;
