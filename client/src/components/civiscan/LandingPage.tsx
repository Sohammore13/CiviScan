import { Shield, Search, Flame, ShieldAlert, Smile, Brain, SlidersHorizontal, Link, ListTodo, Cpu, BarChart3, Mail, MapPin, MessageSquare, AlertTriangle, Skull, X, CheckCircle2, Loader2, Trash2, Video, LogOut, Sparkles, TrendingUp, Zap, ShieldCheck, Check } from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

// Data blueprint for the Analytics / How It Works section
const STEPS_DATA = [
  {
    number: "1",
    icon: Link,
    title: "Paste YouTube Video Link",
    description: "Drop any public video URL into the analyzer.",
  },
  {
    number: "2",
    icon: ListTodo,
    title: "Fetch Public Comments",
    description: "We collect the video's public comments instantly.",
  },
  {
    number: "3",
    icon: Cpu,
    title: "Analyzes Comments",
    description: "Models classify each comment for toxicity & harm.",
  },
  {
    number: "4",
    icon: BarChart3,
    title: "Generate Insights",
    description: "Get analytics, charts, and a moderation summary.",
  },
];

// Data blueprint for the Features section
const FEATURES_DATA = [
  {
    icon: Flame,
    title: "Toxic Comment Detection",
    description: "Pinpoint hostile and abusive language with automated toxicity scoring.",
  },
  {
    icon: ShieldAlert,
    title: "Cyberbullying Detection",
    description: "Surface targeted harassment and bullying before it harms your community.",
  },
  {
    icon: Smile,
    title: "Sentiment Analysis",
    description: "Understand the emotional tone of every conversation at a glance.",
  },
  {
    icon: Brain,
    title: "Actionable Insights",
    description: "Get an instant community health score and actionable recommendations.",
  },
  {
    icon: SlidersHorizontal,
    title: "Smart Content Moderation",
    description: "Filter, search, and sort flagged content to moderate at scale.",
  },
];

interface CommentResult {
  comment_id: string;
  comment: string;
  author: string;
  published_at: string;
  prediction: string;
  confidence: number;
}

interface AnalysisResponse {
  video_title: string;
  channel_title: string;
  total_comments: number;
  results: CommentResult[];
  authenticated: boolean;
}

const getCategory = (prediction: string, confidence: number) => {
  if (prediction === "not_cyberbullying") return "Safe";
  if (prediction === "other_cyberbullying") return "Toxic";
  if (["age", "ethnicity", "gender", "religion"].includes(prediction)) return "Cyberbullying";
  if (confidence > 0.5) return "Offensive";
  return "Safe";
};

export default function LandingPage() {
  const [videoUrl, setVideoUrl] = useState("");
  const [showDashboard, setShowDashboard] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Analyzing...");
  const [error, setError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null);

  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [hoveredSlice, setHoveredSlice] = useState<{ label: string; value: number } | null>(null);

  // OAuth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const rawApiBase = ((import.meta as any).env?.VITE_API_URL) || "http://127.0.0.1:8000";
  const API_BASE = rawApiBase.replace(/\/+$/, "");

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Check OAuth status on mount and after redirect
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_BASE}/youtube/auth-status`);
        const data = await res.json();
        setIsAuthenticated(data.authenticated ?? false);
      } catch { /* server may not be up yet */ }
    };
    checkAuth();

    // Handle oauth_success / oauth_error query params after redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth_success")) {
      setIsAuthenticated(true);
      showToast("✅ YouTube channel connected! You can now delete toxic comments.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (params.get("oauth_error")) {
      showToast(`OAuth error: ${params.get("oauth_error")}`, "error");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [showToast]);

  const handleDelete = async (commentId: string) => {
    if (!commentId || deletingIds.has(commentId)) return;
    setDeletingIds((prev) => new Set(prev).add(commentId));
    try {
      const res = await fetch(`${API_BASE}/youtube/comment/${commentId}`, { method: "DELETE" });
      if (res.ok) {
        setDeletedIds((prev) => new Set(prev).add(commentId));
        showToast("Comment deleted from YouTube successfully.");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.detail || "Failed to delete comment.", "error");
      }
    } catch {
      showToast("Network error. Could not reach the server.", "error");
    } finally {
      setDeletingIds((prev) => { const s = new Set(prev); s.delete(commentId); return s; });
    }
  };

  const handleLogout = async () => {
    await fetch(`${API_BASE}/youtube/logout`, { method: "POST" });
    setIsAuthenticated(false);
    showToast("Disconnected from YouTube.");
  };

  // Tracks scroll behavior to switch style states cleanly
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (videoUrl.trim() === "") return;

    setIsLoading(true);
    setLoadingMsg("Analyzing...");
    setError(null);
    setShowDashboard(false);

    // Show a hint after 5 s — Render free tier may be cold-starting
    const wakeTimer = setTimeout(() => {
      setLoadingMsg("Waking up server… this may take up to 30 s on first use.");
    }, 5000);

    try {
      const response = await fetch(`${API_BASE}/youtube/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: videoUrl.trim() }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail?.detail || `Server returned ${response.status}. Please check the video URL.`);
      }

      const data: AnalysisResponse = await response.json();
      setAnalysisData(data);
      setShowDashboard(true);

      setTimeout(() => {
        const element = document.getElementById("insights-panel");
        if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err: any) {
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setError("Network error: Cannot reach the server. The server may still be waking up — please wait 30 seconds and try again.");
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
    } finally {
      clearTimeout(wakeTimer);
      setIsLoading(false);
      setLoadingMsg("Analyzing...");
    }
  };

  const processedComments = useMemo(() => {
    if (!analysisData) return [];
    return analysisData.results.map((r, i) => {
      const toxicity =
        r.prediction === "not_cyberbullying"
          ? Math.round((1 - r.confidence) * 100)
          : Math.round(r.confidence * 100);
      return {
        id: i,
        commentId: r.comment_id,
        text: r.comment,
        user: r.author,
        likes: 0,
        classification: getCategory(r.prediction, r.confidence),
        toxicity,
      };
    });
  }, [analysisData]);

  // Exclude deleted comments so all analytics reflect the current moderation state in real-time
  const visibleComments = useMemo(() => {
    return processedComments.filter((c) => !c.commentId || !deletedIds.has(c.commentId));
  }, [processedComments, deletedIds]);

  const metrics = useMemo(() => {
    if (!visibleComments.length) return [];
    
    let safe = 0, toxic = 0, offensive = 0, cyberbullying = 0;
    for (const c of visibleComments) {
      if (c.classification === "Safe") safe++;
      else if (c.classification === "Toxic") toxic++;
      else if (c.classification === "Offensive") offensive++;
      else if (c.classification === "Cyberbullying") cyberbullying++;
    }

    return [
      { label: "Total Comments", value: visibleComments.length, icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50" },
      { label: "Safe Comments", value: safe, icon: Shield, color: "text-emerald-500", bg: "bg-emerald-50" },
      { label: "Toxic Comments", value: toxic, icon: Flame, color: "text-rose-500", bg: "bg-rose-50" },
      { label: "Offensive Comments", value: offensive, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50" },
      { label: "Cyberbullying", value: cyberbullying, icon: Skull, color: "text-purple-500", bg: "bg-purple-50" },
    ];
  }, [visibleComments]);

  const percentages = useMemo(() => {
    if (!visibleComments.length) return { safe: 0, toxic: 0, offensive: 0, cyberbullying: 0, safeCount: 0, toxicCount: 0, offensiveCount: 0, cyberbullyingCount: 0 };
    const total = visibleComments.length;
    let safe = 0, toxic = 0, offensive = 0, cyberbullying = 0;
    for (const c of visibleComments) {
      if (c.classification === "Safe") safe++;
      else if (c.classification === "Toxic") toxic++;
      else if (c.classification === "Offensive") offensive++;
      else if (c.classification === "Cyberbullying") cyberbullying++;
    }
    return {
      safe: Math.round((safe / total) * 100),
      toxic: Math.round((toxic / total) * 100),
      offensive: Math.round((offensive / total) * 100),
      cyberbullying: Math.round((cyberbullying / total) * 100),
      safeCount: safe,
      toxicCount: toxic,
      offensiveCount: offensive,
      cyberbullyingCount: cyberbullying,
    };
  }, [visibleComments]);

  const cyberOffset = -percentages.safe;
  const offensiveOffset = cyberOffset - percentages.cyberbullying;
  const toxicOffset = offensiveOffset - percentages.offensive;

  const healthMetrics = useMemo(() => {
    if (!visibleComments.length) {
      return { score: 100, label: "Healthy Community", color: "text-emerald-600", bg: "bg-emerald-500", statusBg: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: ShieldCheck };
    }
    const total = visibleComments.length;
    let safe = 0;
    for (const c of visibleComments) {
      if (c.classification === "Safe") safe++;
    }
    const score = Math.round((safe / total) * 100);
    if (score >= 80) return { score, label: "Healthy Community", color: "text-emerald-600", bg: "bg-emerald-500", statusBg: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: ShieldCheck };
    if (score >= 50) return { score, label: "Moderate Toxicity Risk", color: "text-amber-600", bg: "bg-amber-500", statusBg: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle };
    return { score, label: "High Toxicity Alert", color: "text-rose-600", bg: "bg-rose-500", statusBg: "bg-rose-50 text-rose-700 border-rose-200", icon: Skull };
  }, [visibleComments]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: visibleComments.length, Safe: 0, Toxic: 0, Offensive: 0, Cyberbullying: 0 };
    for (const c of visibleComments) {
      if (counts[c.classification] !== undefined) {
        counts[c.classification]++;
      }
    }
    return counts;
  }, [visibleComments]);

  const flaggedComments = useMemo(() => {
    return visibleComments.filter((c) => c.classification !== "Safe" && c.commentId);
  }, [visibleComments]);

  const handleBatchDeleteFlagged = async () => {
    if (!flaggedComments.length) {
      showToast("No flagged comments remaining to remove.");
      return;
    }

    showToast(`Removing ${flaggedComments.length} flagged comment(s)...`);
    for (const comment of flaggedComments) {
      await handleDelete(comment.commentId);
    }
  };

  const filteredComments = useMemo(() => {
    return visibleComments.filter((c) => {
      const matchesFilter = activeFilter === "All" || c.classification === activeFilter;
      const matchesSearch = c.text.toLowerCase().includes(searchQuery.toLowerCase()) || c.user.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, searchQuery, visibleComments]);

  const getBadgeStyles = (category: string) => {
    switch (category) {
      case "Safe": return "bg-emerald-50 text-emerald-600 border border-emerald-100";
      case "Toxic": return "bg-rose-50 text-rose-600 border border-rose-100";
      case "Offensive": return "bg-amber-50 text-amber-600 border border-amber-100";
      case "Cyberbullying": return "bg-purple-50 text-purple-600 border border-purple-100";
      default: return "bg-slate-50 text-slate-600";
    }
  };

  return (
    <div id="home" className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-100 text-slate-900 scroll-smooth flex flex-col justify-between">

      {/* --- TOAST NOTIFICATION --- */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -40, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -40, x: "-50%" }}
            className={`fixed top-6 left-1/2 z-[100] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold ${
              toast.type === "error"
                ? "bg-rose-600 text-white"
                : "bg-emerald-600 text-white"
            }`}
          >
            {toast.type === "error" ? <X className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* --- DYNAMIC NAVBAR CONTAINER HUB --- */}
      <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? "px-4 pt-4 sm:px-6 lg:px-8" : "w-full"}`}>
        <nav className={`transition-all duration-300 mx-auto flex items-center justify-between ${
          isScrolled 
            ? "max-w-7xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.06)] rounded-full border border-slate-200/50 py-3 px-6" 
            : "w-full bg-white/40 backdrop-blur-sm border-b border-slate-200/30 py-5 px-6 md:px-12"
        }`}>
          {/* Logo */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-full flex items-center justify-center">
              <Shield className="w-4.5 h-45 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">CiviScan</span>
          </div>

          {/* Menu Links */}
          <div className="hidden md:flex items-center gap-8 font-medium text-sm">
            <a href="#home" className="text-slate-600 hover:text-indigo-600 transition duration-200">Home</a>
            <a href="#features" className="text-slate-600 hover:text-indigo-600 transition duration-200">Features</a>
            <a href="#analytics" className="text-slate-600 hover:text-indigo-600 transition duration-200">Analytics</a>
            <a href="#about" className="text-slate-600 hover:text-indigo-600 transition duration-200">About</a>
            <a href="#contact" className="text-slate-600 hover:text-indigo-600 transition duration-200">Contact</a>
          </div>

          {/* CTA Pill button wrapper */}
          <div className="flex items-center gap-3">
            {/* YouTube OAuth Connect / Disconnect button */}
            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                title="Disconnect YouTube account"
                className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-full font-semibold text-xs transition duration-200"
              >
                <Video className="w-3.5 h-3.5" />
                Connected
                <LogOut className="w-3 h-3 ml-0.5 opacity-70" />
              </button>
            ) : (
              <a
                href={`${API_BASE}/youtube/auth`}
                title="Connect your YouTube channel to enable comment deletion"
                className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 px-4 py-2 rounded-full font-semibold text-xs transition duration-200"
              >
                <Video className="w-3.5 h-3.5" />
                Connect YouTube
              </a>
            )}
            <button onClick={() => {
              document.getElementById("search-input")?.focus();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }} className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-6 py-2 rounded-full font-bold text-sm tracking-tight shadow-sm transition duration-200">
              Analyze Now
            </button>
          </div>
        </nav>
      </div>

      {/* Main Single Page Layout Container */}
      <main className="flex-grow pt-24">
        
        {/* --- SECTION 1: HERO CONTAINER --- */}
        <div className="pt-20 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            
            {/* Left Column Text / Action Box */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.215, 0.610, 0.355, 1.000] }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-2 rounded-full w-fit shadow-xs">
                <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider">Cyberbullying & Toxicity Moderation</span>
              </div>

              <h1 className="text-5xl sm:text-6xl font-extrabold text-left leading-[1.1] text-slate-900 tracking-tight">
                YouTube<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600">Comment</span><br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600">Moderation</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 text-left leading-relaxed max-w-xl">
                Analyze public YouTube comments in real-time. Detect toxic, abusive, and cyberbullying threats instantly with custom deep learning NLP models.
              </p>

              <form onSubmit={handleAnalyze} className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row gap-2 bg-white rounded-3xl sm:rounded-full p-2.5 shadow-[0_10px_35px_rgba(79,70,229,0.08)] border border-slate-200/80 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition">
                  <div className="flex items-center gap-3 flex-1 px-4 py-1">
                    <Search className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                    <input
                      id="search-input"
                      type="text"
                      placeholder="Paste YouTube Video URL (e.g. youtube.com/watch?v=...)"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      className="flex-1 outline-none bg-transparent text-slate-900 placeholder-slate-400 text-sm md:text-base font-medium"
                    />
                  </div>
                  <button 
                    disabled={isLoading} 
                    type="submit" 
                    className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-75 text-white px-7 py-3.5 rounded-full font-bold transition duration-200 text-sm md:text-base whitespace-nowrap flex items-center justify-center gap-2 shadow-md shadow-indigo-200"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isLoading ? loadingMsg : "Analyze Comments"}
                  </button>
                </div>

                {error && (
                  <div className="mt-3 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs sm:text-sm text-left font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Sample URL quick-action pills */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-left">
                  <span className="text-xs text-slate-400 font-semibold">Try sample:</span>
                  <button
                    type="button"
                    onClick={() => setVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")}
                    className="text-xs bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200 hover:border-indigo-200 px-3 py-1 rounded-full font-semibold transition"
                  >
                    Rick Astley (Official Video)
                  </button>
                </div>
              </form>
            </motion.div>

            {/* Right Column Interactive Showcase Cards */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.215, 0.610, 0.355, 1.000] }}
              className="relative hidden md:flex items-center justify-center"
            >
              <div className="relative w-full max-w-md">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-blue-500/15 to-purple-500/20 rounded-3xl blur-3xl opacity-70 animate-pulse"></div>

                {/* Center Showcase Card */}
                <div className="relative bg-white/90 backdrop-blur-xl border border-white/60 shadow-[0_20px_50px_rgba(79,70,229,0.12)] rounded-[2.5rem] p-7 space-y-6 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-200">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">CiviScan Sentinel</h4>
                        <p className="text-[11px] text-slate-400 font-semibold">Active Comment Guard</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-extrabold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block"></span> Live Protection
                    </span>
                  </div>

                  {/* Sample threat preview cards */}
                  <div className="space-y-3">
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">"Great video! Loved the breakdown!"</p>
                        <span className="text-[10px] text-slate-400 font-medium">Author: Alex_M</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-600 border border-emerald-100 flex-shrink-0">
                        Safe (99%)
                      </span>
                    </div>

                    <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">"You should delete your channel right now!"</p>
                        <span className="text-[10px] text-rose-500 font-medium">Author: AnonymousUser</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200 flex-shrink-0 flex items-center gap-1">
                        <Flame className="w-3 h-3" /> Cyberbullying (98%)
                      </span>
                    </div>
                  </div>

                  {/* Stat highlights footer */}
                  <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-xs font-extrabold text-indigo-600 block">&lt; 100ms</span>
                      <span className="text-[10px] text-slate-400 font-semibold">Latency</span>
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-indigo-600 block">6 Categories</span>
                      <span className="text-[10px] text-slate-400 font-semibold">Classification</span>
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-indigo-600 block">YouTube OAuth</span>
                      <span className="text-[10px] text-slate-400 font-semibold">One-click Clean</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* --- SECTION 2: LIVE INLINE DASHBOARD --- */}
        <AnimatePresence>
          {showDashboard && analysisData && (
            <motion.div
              id="insights-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.6, ease: [0.215, 0.610, 0.355, 1.000] }}
              className="overflow-hidden bg-slate-100/50 border-t border-b border-slate-200/60 py-12 scroll-mt-28"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

                {/* Video Summary Metadata & Health Score Header Block */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 flex flex-col md:flex-row gap-6 items-start md:items-center text-left justify-between"
                >
                  <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center flex-grow">
                    <div className="w-full sm:w-48 aspect-video bg-slate-100 rounded-2xl overflow-hidden relative border border-slate-100 flex-shrink-0 shadow-sm">
                      <img 
                        src={`https://img.youtube.com/vi/${new URL(videoUrl).searchParams.get('v') || videoUrl.split('/').pop()?.split('?')[0]}/maxresdefault.jpg`}
                        alt="YouTube Video Thumbnail Preview" 
                        onError={(e) => {
                          e.currentTarget.src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80";
                        }}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/5"></div>
                    </div>

                    <div className="space-y-2 flex-grow">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Analysis Complete
                        </div>
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${healthMetrics.statusBg}`}>
                          <healthMetrics.icon className="w-3.5 h-3.5" />
                          {healthMetrics.label} ({healthMetrics.score}%)
                        </div>
                      </div>
                      <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                        {analysisData.video_title || "YouTube Video"}
                      </h3>
                      <div className="text-xs sm:text-sm space-y-0.5">
                        <p className="text-slate-400 font-bold">{analysisData.channel_title || "Unknown Channel"}</p>
                        <p className="text-slate-500 font-medium">{analysisData.total_comments} public comments analyzed with deep learning</p>
                      </div>
                    </div>
                  </div>

                  {/* Health Score Meter Box */}
                  <div className="w-full md:w-auto bg-slate-50 border border-slate-150/80 rounded-2xl p-4 flex flex-col space-y-2 min-w-[200px] text-left">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Safety Score</span>
                      <span className={`font-mono text-sm font-black ${healthMetrics.color}`}>{healthMetrics.score}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200/70 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${healthMetrics.bg}`}
                        style={{ width: `${healthMetrics.score}%` }}
                      ></div>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {healthMetrics.score >= 80 ? "Great community environment." : healthMetrics.score >= 50 ? "Some toxic comments detected." : "High toxicity detected. Action recommended."}
                    </p>
                  </div>
                </motion.div>

                {/* Metric Counter Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {metrics.map((metric, idx) => {
                    const Icon = metric.icon;
                    return (
                      <div key={idx} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col space-y-3 text-left hover:border-slate-200 transition">
                        <div className={`w-10 h-10 ${metric.bg} ${metric.color} rounded-full flex items-center justify-center`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-3xl font-black text-slate-955 tracking-tight">{metric.value}</span>
                          <p className="text-slate-500 text-xs font-medium">{metric.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Graph Engine and Data Grid Layout Splitting Container */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                  
                  {/* Donut Classification & Category Distribution Card */}
                  <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6 text-left relative">
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-955 tracking-tight">Comment Classification</h3>
                      <p className="text-slate-400 text-xs mt-0.5 font-medium leading-relaxed">Real-time breakdown across all analyzed comments</p>
                    </div>

                    <div className="relative flex justify-center items-center py-2">
                      <div className="relative w-52 h-52 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3.2" />
                          
                          {percentages.safe > 0 && (
                            <motion.circle 
                              cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="3.2" 
                              animate={{ strokeDasharray: `${percentages.safe} 100` }}
                              whileHover={{ strokeWidth: 4.5 }}
                              onMouseEnter={() => setHoveredSlice({ label: "Safe", value: percentages.safeCount })}
                              onMouseLeave={() => setHoveredSlice(null)}
                              transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
                              className="cursor-pointer origin-center"
                              strokeDashoffset="0" 
                            />
                          )}
                          
                          {percentages.cyberbullying > 0 && (
                            <motion.circle 
                              cx="18" cy="18" r="15.915" fill="none" stroke="#a855f7" strokeWidth="3.2" 
                              animate={{ strokeDasharray: `${percentages.cyberbullying} 100` }}
                              whileHover={{ strokeWidth: 4.5 }}
                              onMouseEnter={() => setHoveredSlice({ label: "Cyberbullying", value: percentages.cyberbullyingCount })}
                              onMouseLeave={() => setHoveredSlice(null)}
                              transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
                              className="cursor-pointer origin-center"
                              strokeDashoffset={cyberOffset} 
                            />
                          )}
                          
                          {percentages.offensive > 0 && (
                            <motion.circle 
                              cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="3.2" 
                              animate={{ strokeDasharray: `${percentages.offensive} 100` }}
                              whileHover={{ strokeWidth: 4.5 }}
                              onMouseEnter={() => setHoveredSlice({ label: "Offensive", value: percentages.offensiveCount })}
                              onMouseLeave={() => setHoveredSlice(null)}
                              transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
                              className="cursor-pointer origin-center"
                              strokeDashoffset={offensiveOffset} 
                            />
                          )}
                          
                          {percentages.toxic > 0 && (
                            <motion.circle 
                              cx="18" cy="18" r="15.915" fill="none" stroke="#ef4444" strokeWidth="3.2" 
                              animate={{ strokeDasharray: `${percentages.toxic} 100` }}
                              whileHover={{ strokeWidth: 4.5 }}
                              onMouseEnter={() => setHoveredSlice({ label: "Toxic", value: percentages.toxicCount })}
                              onMouseLeave={() => setHoveredSlice(null)}
                              transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
                              className="cursor-pointer origin-center"
                              strokeDashoffset={toxicOffset} 
                            />
                          )}
                        </svg>
                        
                        <div className="absolute inset-0 flex flex-col justify-center items-center text-center select-none pointer-events-none">
                          {(() => {
                            const dominant = [
                              { label: "Safe", pct: percentages.safe, color: "text-emerald-500" },
                              { label: "Toxic", pct: percentages.toxic, color: "text-rose-500" },
                              { label: "Offensive", pct: percentages.offensive, color: "text-amber-500" },
                              { label: "Cyberbullying", pct: percentages.cyberbullying, color: "text-purple-500" },
                            ].reduce((a, b) => (b.pct > a.pct ? b : a));
                            return (
                              <>
                                <span className={`text-4xl font-black tracking-tighter ${dominant.color}`}>{dominant.pct}%</span>
                                <span className="text-[11px] font-bold text-slate-400 mt-0.5">{dominant.label}</span>
                              </>
                            );
                          })()}
                        </div>

                        <AnimatePresence>
                          {hoveredSlice && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.9, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: 10 }}
                              transition={{ duration: 0.15 }}
                              className="absolute bottom-4 bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.08)] px-5 py-2.5 rounded-2xl flex items-center justify-center font-bold text-slate-800 text-sm tracking-tight gap-1.5 z-10"
                            >
                              <span className={
                                hoveredSlice.label === "Safe" ? "text-emerald-500" :
                                hoveredSlice.label === "Toxic" ? "text-rose-500" :
                                hoveredSlice.label === "Offensive" ? "text-amber-500" : "text-purple-500"
                              }>
                                {hoveredSlice.label}
                              </span>
                              <span className="text-slate-300">:</span>
                              <span className="font-mono text-slate-955 font-black">{hoveredSlice.value}</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Linear Distribution Progress Bars */}
                    <div className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Safe</span>
                          <span className="font-mono text-slate-500">{percentages.safeCount} ({percentages.safe}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${percentages.safe}%` }}></div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Toxic</span>
                          <span className="font-mono text-slate-500">{percentages.toxicCount} ({percentages.toxic}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500 rounded-full" style={{ width: `${percentages.toxic}%` }}></div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Offensive</span>
                          <span className="font-mono text-slate-500">{percentages.offensiveCount} ({percentages.offensive}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${percentages.offensive}%` }}></div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span> Cyberbullying</span>
                          <span className="font-mono text-slate-500">{percentages.cyberbullyingCount} ({percentages.cyberbullying}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${percentages.cyberbullying}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Table List Workspace Data Block */}
                  <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6 text-left lg:col-span-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-extrabold text-slate-955 tracking-tight">Comments Analysis</h3>
                        <p className="text-slate-400 text-xs font-semibold mt-0.5">{filteredComments.length} of {visibleComments.length} comments matching filters</p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        {isAuthenticated && flaggedComments.length > 0 && (
                          <button
                            onClick={handleBatchDeleteFlagged}
                            title="Remove all flagged toxic comments from YouTube at once"
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-sm transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Clean All Flagged ({flaggedComments.length})
                          </button>
                        )}

                        <div className="relative w-full sm:w-60">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Search comments..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 rounded-full pl-10 pr-8 py-2 text-sm text-slate-900 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                          />
                          {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 rounded-full transition">
                              <X className="w-3 h-3 text-slate-500" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {["All", "Safe", "Toxic", "Offensive", "Cyberbullying"].map((filterName) => (
                        <button
                          key={filterName}
                          onClick={() => setActiveFilter(filterName)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-tight transition border flex items-center gap-1.5 ${
                            activeFilter === filterName
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                              : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
                          }`}
                        >
                          <span>{filterName}</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                            activeFilter === filterName ? "bg-indigo-700 text-white" : "bg-slate-200 text-slate-600"
                          }`}>
                            {categoryCounts[filterName] ?? 0}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="overflow-x-auto min-h-[300px]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                            <th className="pb-3 font-semibold">Comment</th>
                            <th className="pb-3 font-semibold px-4">Classification</th>
                            <th className="pb-3 font-semibold text-right">Toxicity</th>
                            {isAuthenticated && <th className="pb-3 font-semibold text-center w-20">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {filteredComments.length > 0 ? (
                            filteredComments
                              .map((comment) => (
                              <tr key={comment.id} className="group hover:bg-slate-50/60 transition-colors">
                                <td className="py-4 pr-4">
                                  <p className="text-slate-900 font-medium leading-normal max-w-sm sm:max-w-md">{comment.text}</p>
                                  <span className="text-xs text-slate-400 block mt-1 font-medium">
                                    {comment.user}
                                  </span>
                                </td>
                                <td className="py-4 px-4 whitespace-nowrap">
                                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getBadgeStyles(comment.classification)}`}>
                                    {comment.classification}
                                  </span>
                                </td>
                                <td className="py-4 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-3 justify-end w-28">
                                    <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                      <div 
                                        className={`h-full rounded-full ${comment.toxicity > 70 ? 'bg-rose-500' : comment.toxicity > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                        style={{ width: `${comment.toxicity}%` }}
                                      ></div>
                                    </div>
                                    <span className={`font-mono font-bold ${comment.toxicity > 70 ? 'text-rose-600' : comment.toxicity > 40 ? 'text-amber-600' : 'text-slate-600'}`}>
                                      {comment.toxicity}%
                                    </span>
                                  </div>
                                </td>
                                {isAuthenticated && (
                                  <td className="py-4 text-center">
                                    {comment.classification !== "Safe" && comment.commentId ? (
                                      <button
                                        onClick={() => handleDelete(comment.commentId)}
                                        disabled={deletingIds.has(comment.commentId)}
                                        title="Remove this comment from YouTube"
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                      >
                                        {deletingIds.has(comment.commentId)
                                          ? <Loader2 className="w-3 h-3 animate-spin" />
                                          : <Trash2 className="w-3 h-3" />}
                                        Delete
                                      </button>
                                    ) : (
                                      <span className="text-xs text-slate-300">—</span>
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={isAuthenticated ? 4 : 3} className="py-12 text-center text-slate-400 font-medium">
                                No comments found matching your active criteria modifiers.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- SECTION 3: FEATURES BLOCK --- */}
        <div id="features" className="pb-24 pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-28">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 0.6 }} className="text-center space-y-3 mb-16">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-bold uppercase tracking-widest">
              <Zap className="w-3.5 h-3.5 text-indigo-600" /> Platform Capabilities
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight max-w-3xl mx-auto leading-tight">
              Everything you need to keep your community safe
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed font-medium">
              CiviScan combines fine-tuned NLP transformers and real-time moderation pipelines to surface harmful comment patterns instantly.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES_DATA.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <motion.div 
                  key={index} 
                  initial={{ opacity: 0, scale: 0.9, y: 30 }} 
                  whileInView={{ opacity: 1, scale: 1, y: 0 }} 
                  viewport={{ once: false, amount: 0.15 }} 
                  transition={{ duration: 0.5, delay: (index % 3) * 0.1, ease: [0.215, 0.610, 0.355, 1.000] }} 
                  className="bg-white/80 backdrop-blur-sm rounded-[2rem] p-8 shadow-[0_4px_25px_rgba(0,0,0,0.03)] border border-slate-200/70 flex flex-col items-start space-y-5 transition-all duration-300 hover:shadow-xl hover:border-indigo-200 hover:-translate-y-1.5 group text-left"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-200 group-hover:scale-110 transition duration-300">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-extrabold text-slate-900 tracking-tight group-hover:text-indigo-600 transition">{feature.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed font-medium">{feature.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* --- SECTION 4: HOW IT WORKS BLOCK --- */}
        <div id="analytics" className="pb-24 pt-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-28">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 0.6 }} className="text-center space-y-3 mb-16">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-bold uppercase tracking-widest">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" /> Simple 4-Step Workflow
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight max-w-3xl mx-auto leading-tight">
              From link to insights in seconds
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base font-medium">
              Zero complicated setup. Just drop any YouTube link to scan comments and delete toxic threats instantly.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS_DATA.map((step, index) => {
              const IconComponent = step.icon;
              return (
                <motion.div 
                  key={index} 
                  initial={{ opacity: 0, scale: 0.9, y: 30 }} 
                  whileInView={{ opacity: 1, scale: 1, y: 0 }} 
                  viewport={{ once: false, amount: 0.15 }} 
                  transition={{ duration: 0.5, delay: index * 0.1, ease: [0.215, 0.610, 0.355, 1.000] }} 
                  className="bg-white/80 backdrop-blur-sm rounded-[2rem] p-8 shadow-[0_4px_25px_rgba(0,0,0,0.03)] border border-slate-200/70 flex flex-col items-start space-y-4 transition-all duration-300 hover:shadow-xl hover:border-indigo-200 hover:-translate-y-1.5 text-left relative overflow-hidden group"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-4xl font-black text-indigo-100 group-hover:text-indigo-200 transition leading-none select-none font-mono">0{step.number}</span>
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition duration-300">
                      <IconComponent className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{step.title}</h3>
                    <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">{step.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* --- SECTION 5: ABOUT & ENGINE STORY BLOCK --- */}
        <div id="about" className="pb-28 pt-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-28">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.2 }} transition={{ duration: 0.6 }} className="space-y-6 text-left">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-bold uppercase tracking-widest">
                  <Brain className="w-3.5 h-3.5 text-indigo-600" /> Model Architecture
                </span>
                <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Empowering creators, <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600">protecting communities.</span>
                </h2>
              </div>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
                CiviScan is powered by custom fine-tuned DistilBERT models deployed on Hugging Face. It classifies comment intent into six distinct categories: Age, Ethnicity, Gender, Religion, Other Cyberbullying, or Safe — executing inference in under 100ms.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white border border-slate-200/80 px-3.5 py-2 rounded-full shadow-xs">
                  <Check className="w-4 h-4 text-emerald-500" /> 6 Threat Categories
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white border border-slate-200/80 px-3.5 py-2 rounded-full shadow-xs">
                  <Check className="w-4 h-4 text-emerald-500" /> Hugging Face Transformers
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white border border-slate-200/80 px-3.5 py-2 rounded-full shadow-xs">
                  <Check className="w-4 h-4 text-emerald-500" /> YouTube OAuth 2.0 API
                </div>
              </div>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2 text-left">
              <div className="bg-white p-7 rounded-[2.5rem] border border-slate-200/80 shadow-[0_10px_30px_rgba(0,0,0,0.03)] space-y-3 hover:border-indigo-200 transition">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold text-lg">🧠</div>
                <h3 className="font-extrabold text-slate-900 text-base tracking-tight">Transformer NLP</h3>
                <p className="text-slate-500 text-xs leading-relaxed font-medium">
                  Deep contextual embeddings accurately recognize sarcasm, slurs, and implicit harassment.
                </p>
              </div>

              <div className="bg-gradient-to-br from-indigo-600 to-blue-600 p-7 rounded-[2.5rem] text-white shadow-xl shadow-indigo-200 space-y-3">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center font-bold text-lg text-white">⚡</div>
                <h3 className="font-extrabold text-base tracking-tight">Sub-100ms Inference</h3>
                <p className="text-indigo-100 text-xs leading-relaxed font-medium">
                  Evaluates hundreds of comments concurrently via FastAPI backend pipelines.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* --- SECTION 6: FOOTER --- */}
      <footer id="contact" className="bg-white text-slate-900 pt-16 pb-8 px-6 md:px-12 border-t border-slate-200/80 scroll-mt-28">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16 text-left">
            <div className="md:col-span-1 pr-4 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8.5 h-8.5 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-full flex items-center justify-center shadow-md shadow-indigo-200">
                  <Shield className="w-4.5 h-4.5 text-white" />
                </div>
                <span className="text-xl font-extrabold text-slate-950 tracking-tight">CiviScan</span>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed font-medium">
                Comment moderation platform designed to keep YouTube video discussions safe and free of toxic cyberbullying.
              </p>
            </div>

            <div>
              <h3 className="font-extrabold text-slate-950 mb-5 text-xs uppercase tracking-widest">Platform</h3>
              <ul className="space-y-3 text-sm font-semibold">
                <li><a href="#home" className="text-slate-600 hover:text-indigo-600 transition">Home</a></li>
                <li><a href="#features" className="text-slate-600 hover:text-indigo-600 transition">Features</a></li>
                <li><a href="#analytics" className="text-slate-600 hover:text-indigo-600 transition">How It Works</a></li>
                <li><a href="#about" className="text-slate-600 hover:text-indigo-600 transition">Model Architecture</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-extrabold text-slate-950 mb-5 text-xs uppercase tracking-widest">Resources</h3>
              <ul className="space-y-3 text-sm font-semibold">
                <li><a href="https://huggingface.co/Sohammore13/cyberbullying-detector" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-indigo-600 transition">Hugging Face Model</a></li>
                <li><a href="https://developers.google.com/youtube/v3" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-indigo-600 transition">YouTube Data API v3</a></li>
                <li><a href="https://fastapi.tiangolo.com/" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-indigo-600 transition">FastAPI Docs</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-extrabold text-slate-950 mb-5 text-xs uppercase tracking-widest">Contact & Open Source</h3>
              <ul className="space-y-3 text-sm font-medium">
                <li className="flex items-center gap-3 text-slate-600">
                  <Mail className="w-4 h-4 text-indigo-500" />
                  <a href="mailto:support@civiscan.com" className="hover:text-indigo-600 transition font-semibold">support@civiscan.com</a>
                </li>
                <li className="flex items-center gap-3 text-slate-600">
                  <MapPin className="w-4 h-4 text-indigo-500" />
                  <span>Remote · Worldwide</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-200/80 pt-8 flex flex-col md:flex-row justify-between items-center text-xs md:text-sm text-slate-500 gap-4 font-medium">
            <p>© 2026 CiviScan. All rights reserved.</p>
            <p className="tracking-tight text-slate-400">
              Built with React, Tailwind CSS, FastAPI & Hugging Face Transformers
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}