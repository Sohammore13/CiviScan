import { Shield, Search, Flame, ShieldAlert, Smile, Brain, SlidersHorizontal, Link, ListTodo, Cpu, BarChart3, Mail, MapPin, MessageSquare, AlertTriangle, Skull, X, CheckCircle2 } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
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
    title: "AI Analyzes Comments",
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
    description: "Pinpoint hostile and abusive language with AI-driven toxicity scoring.",
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
    title: "AI-Powered Insights",
    description: "Get an instant community health score and actionable recommendations.",
  },
  {
    icon: SlidersHorizontal,
    title: "Smart Content Moderation",
    description: "Filter, search, and sort flagged content to moderate at scale.",
  },
];

const MOCK_COMMENTS = [
  {
    id: 1,
    text: "You are worthless and everyone hates you.",
    user: "@JustanotherUser",
    likes: 35,
    classification: "Cyberbullying",
    toxicity: 99,
  },
  {
    id: 2,
    text: "This is absolute trash, what a waste of time.",
    user: "@Sara L.",
    likes: 9,
    classification: "Toxic",
    toxicity: 95,
  },
  {
    id: 3,
    text: "This is absolute trash, what a waste of time.",
    user: "@frostbyte",
    likes: 231,
    classification: "Toxic",
    toxicity: 94,
  },
  {
    id: 4,
    text: "This is absolute trash, what a waste of time.",
    user: "@Sara L.",
    likes: 78,
    classification: "Toxic",
    toxicity: 93,
  },
  {
    id: 5,
    text: "Great video explanation! Really helped clear up the setup steps.",
    user: "@DevDave",
    likes: 42,
    classification: "Safe",
    toxicity: 4,
  },
  {
    id: 6,
    text: "Shut up, you have no idea what you are talking about.",
    user: "@anon992",
    likes: 12,
    classification: "Offensive",
    toxicity: 88,
  },
];

const METRICS = [
  { label: "Total Comments", value: 118, icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50" },
  { label: "Safe Comments", value: 74, icon: Shield, color: "text-emerald-500", bg: "bg-emerald-50" },
  { label: "Toxic Comments", value: 20, icon: Flame, color: "text-rose-500", bg: "bg-rose-50" },
  { label: "Offensive Comments", value: 16, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50" },
  { label: "Cyberbullying", value: 8, icon: Skull, color: "text-purple-500", bg: "bg-purple-50" },
];

export default function LandingPage() {
  const [videoUrl, setVideoUrl] = useState("");
  const [showDashboard, setShowDashboard] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  
  const [hoveredSlice, setHoveredSlice] = useState<{ label: string; value: number } | null>(null);

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

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (videoUrl.trim() !== "") {
      setShowDashboard(true);
      setTimeout(() => {
        const element = document.getElementById("insights-panel");
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  };

  const filteredComments = useMemo(() => {
    return MOCK_COMMENTS.filter((c) => {
      const matchesFilter = activeFilter === "All" || c.classification === activeFilter;
      const matchesSearch = c.text.toLowerCase().includes(searchQuery.toLowerCase()) || c.user.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, searchQuery]);

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
          <button onClick={() => {
            document.getElementById("search-input")?.focus();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }} className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-6 py-2 rounded-full font-bold text-sm tracking-tight shadow-sm transition duration-200">
            Analyze Now
          </button>
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
              <div className="inline-flex items-center gap-2 bg-blue-100/80 text-blue-700 px-4 py-2 rounded-full w-fit">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium">AI-Powered Comment Moderation</span>
              </div>

              <h1 className="text-5xl md:text-6xl font-black text-left leading-tight text-slate-900">
                AI-Powered<br />YouTube{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">Comment</span><br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">Moderation</span>
              </h1>

              <p className="text-lg text-gray-600 text-left leading-relaxed">
                Analyze YouTube comments instantly and detect toxic, abusive, and cyberbullying content with AI.
              </p>

              <form onSubmit={handleAnalyze} className="space-y-4 pt-4">
                <div className="flex gap-2 bg-white rounded-full p-2 shadow-lg border border-slate-100">
                  <div className="flex items-center gap-3 flex-1 px-4">
                    <Search className="w-5 h-5 text-gray-400" />
                    <input
                      id="search-input"
                      type="text"
                      placeholder="Paste YouTube Video URL Here"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      className="flex-1 outline-none bg-transparent text-gray-900 placeholder-gray-400 text-sm md:text-base"
                    />
                  </div>
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-full font-semibold transition text-sm md:text-base whitespace-nowrap">
                    Analyze Comments
                  </button>
                </div>
                <p className="text-sm text-gray-500 text-left">
                  Try any public YouTube link – e.g. youtube.com/watch?v=dQw4w9WgXcQ
                </p>
              </form>
            </motion.div>

            {/* Right Column Shield Asset Wrapper */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.215, 0.610, 0.355, 1.000] }}
              className="relative hidden md:flex items-center justify-center"
            >
              <div className="relative w-96 h-96">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-blue-400 rounded-full blur-3xl opacity-25 animate-pulse"></div>
                <motion.img 
                  src="/shield.png" 
                  alt="CiviScan AI Security Shield" 
                  className="relative w-full h-full object-contain drop-shadow-[0_20px_40px_rgba(79,70,229,0.15)]"
                  animate={{ y: [0, -15, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* --- SECTION 2: LIVE INLINE DASHBOARD (HEADER REMOVED PER image_9355c2.png) --- */}
        <AnimatePresence>
          {showDashboard && (
            <motion.div
              id="insights-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.6, ease: [0.215, 0.610, 0.355, 1.000] }}
              className="overflow-hidden bg-slate-100/50 border-t border-b border-slate-200/60 py-12 scroll-mt-28"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

                {/* Video Summary Metadata Card Header Block */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center text-left"
                >
                  <div className="w-full sm:w-56 aspect-video bg-slate-100 rounded-2xl overflow-hidden relative border border-slate-100 flex-shrink-0">
                    <img 
                      src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80" 
                      alt="YouTube Video Thumbnail Preview" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/5"></div>
                  </div>

                  <div className="space-y-2 flex-grow">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Analysis complete
                    </div>
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                      10 Productivity Hacks That Actually Work
                    </h3>
                    <div className="text-xs sm:text-sm space-y-0.5">
                      <p className="text-slate-400 font-bold">The Daily Byte</p>
                      <p className="text-slate-500 font-medium">118 comments analyzed with AI</p>
                    </div>
                  </div>
                </motion.div>

                {/* Metric Counter Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {METRICS.map((metric, idx) => {
                    const Icon = metric.icon;
                    return (
                      <div key={idx} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col space-y-3 text-left">
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
                  
                  {/* Donut Classification Circle Layout Card */}
                  <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8 text-left relative">
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-955 tracking-tight">Comment Classification</h3>
                      <p className="text-slate-400 text-xs mt-0.5 font-medium leading-relaxed">Real-time AI breakdown across all analyzed comments</p>
                    </div>

                    <div className="relative flex justify-center items-center py-4">
                      <div className="relative w-56 h-56 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3.2" />
                          
                          <motion.circle 
                            cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="3.2" 
                            initial={{ strokeDasharray: "0 100" }}
                            whileInView={{ strokeDasharray: "62.7 100" }}
                            viewport={{ once: false, amount: 0.1 }}
                            whileHover={{ strokeWidth: 4.5 }}
                            onMouseEnter={() => setHoveredSlice({ label: "Safe", value: 74 })}
                            onMouseLeave={() => setHoveredSlice(null)}
                            transition={{ duration: 1.4, ease: [0.25, 1, 0.5, 1] }}
                            className="cursor-pointer origin-center"
                            strokeDashoffset="0" 
                          />
                          
                          <motion.circle 
                            cx="18" cy="18" r="15.915" fill="none" stroke="#a855f7" strokeWidth="3.2" 
                            initial={{ strokeDasharray: "0 100" }}
                            whileInView={{ strokeDasharray: "6.8 100" }}
                            viewport={{ once: false, amount: 0.1 }}
                            whileHover={{ strokeWidth: 4.5 }}
                            onMouseEnter={() => setHoveredSlice({ label: "Cyberbullying", value: 8 })}
                            onMouseLeave={() => setHoveredSlice(null)}
                            transition={{ duration: 1.4, ease: [0.25, 1, 0.5, 1] }}
                            className="cursor-pointer origin-center"
                            strokeDashoffset="-62.7" 
                          />
                          
                          <motion.circle 
                            cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="3.2" 
                            initial={{ strokeDasharray: "0 100" }}
                            whileInView={{ strokeDasharray: "13.6 100" }}
                            viewport={{ once: false, amount: 0.1 }}
                            whileHover={{ strokeWidth: 4.5 }}
                            onMouseEnter={() => setHoveredSlice({ label: "Offensive", value: 16 })}
                            onMouseLeave={() => setHoveredSlice(null)}
                            transition={{ duration: 1.4, ease: [0.25, 1, 0.5, 1] }}
                            className="cursor-pointer origin-center"
                            strokeDashoffset="-69.5" 
                          />
                          
                          <motion.circle 
                            cx="18" cy="18" r="15.915" fill="none" stroke="#ef4444" strokeWidth="3.2" 
                            initial={{ strokeDasharray: "0 100" }}
                            whileInView={{ strokeDasharray: "16.9 100" }}
                            viewport={{ once: false, amount: 0.1 }}
                            whileHover={{ strokeWidth: 4.5 }}
                            onMouseEnter={() => setHoveredSlice({ label: "Toxic", value: 20 })}
                            onMouseLeave={() => setHoveredSlice(null)}
                            transition={{ duration: 1.4, ease: [0.25, 1, 0.5, 1] }}
                            className="cursor-pointer origin-center"
                            strokeDashoffset="-83.1" 
                          />
                        </svg>
                        
                        <div className="absolute inset-0 flex flex-col justify-center items-center text-center select-none pointer-events-none">
                          <span className="text-4xl font-black text-indigo-600 tracking-tighter">63%</span>
                          <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">Safe</p>
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

                    <div className="grid grid-cols-2 gap-x-2 gap-y-3 pt-2 text-xs font-bold text-slate-700">
                      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Safe</div>
                      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span> Toxic</div>
                      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> Offensive</div>
                      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block"></span> Cyberbullying</div>
                    </div>
                  </div>

                  {/* Table List Workspace Data Block */}
                  <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6 text-left lg:col-span-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-extrabold text-slate-955 tracking-tight">Comments Analysis</h3>
                        <p className="text-slate-400 text-xs font-semibold mt-0.5">108 of 108 comments</p>
                      </div>

                      <div className="relative w-full sm:w-64">
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

                    <div className="flex flex-wrap gap-2 pt-1">
                      {["All", "Safe", "Toxic", "Offensive", "Cyberbullying"].map((filterName) => (
                        <button
                          key={filterName}
                          onClick={() => setActiveFilter(filterName)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-tight transition border ${
                            activeFilter === filterName
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                              : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
                          }`}
                        >
                          {filterName}
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
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {filteredComments.length > 0 ? (
                            filteredComments.map((comment) => (
                              <tr key={comment.id} className="group hover:bg-slate-50/60 transition-colors">
                                <td className="py-4 pr-4">
                                  <p className="text-slate-900 font-medium leading-normal max-w-sm sm:max-w-md">{comment.text}</p>
                                  <span className="text-xs text-slate-400 block mt-1 font-medium">
                                    {comment.user} · {comment.likes} likes
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
                                        className={`h-full rounded-full ${comment.toxicity > 70 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                                        style={{ width: `${comment.toxicity}%` }}
                                      ></div>
                                    </div>
                                    <span className={`font-mono font-bold ${comment.toxicity > 70 ? 'text-rose-600' : 'text-slate-600'}`}>
                                      {comment.toxicity}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3} className="py-12 text-center text-slate-400 font-medium">
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
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Features</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight max-w-3xl mx-auto leading-tight">Everything you need to keep communities safe</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">CiviScan combines NLP and machine learning to detect harmful content the moment it appears.</p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES_DATA.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <motion.div key={index} initial={{ opacity: 0, scale: 0.85, y: 40 }} whileInView={{ opacity: 1, scale: 1, y: 0 }} viewport={{ once: false, amount: 0.15 }} transition={{ duration: 0.5, delay: (index % 3) * 0.12, ease: [0.215, 0.610, 0.355, 1.000] }} className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col items-start space-y-5 transition-all duration-300 hover:shadow-md hover:-translate-y-1">
                  <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-sm shadow-indigo-200">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div className="space-y-2 text-left">
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">{feature.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* --- SECTION 4: HOW IT WORKS BLOCK --- */}
        <div id="analytics" className="pb-24 pt-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-28">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 0.6 }} className="text-center space-y-3 mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">How It Works</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight max-w-3xl mx-auto leading-tight">From link to insights in seconds</h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS_DATA.map((step, index) => {
              const IconComponent = step.icon;
              return (
                <motion.div key={index} initial={{ opacity: 0, scale: 0.88, y: 35 }} whileInView={{ opacity: 1, scale: 1, y: 0 }} viewport={{ once: false, amount: 0.15 }} transition={{ duration: 0.5, delay: index * 0.1, ease: [0.215, 0.610, 0.355, 1.000] }} className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col items-start space-y-4 transition-all duration-300 hover:shadow-md hover:-translate-y-1 text-left">
                  <span className="text-5xl font-black text-indigo-100/70 leading-none select-none">{step.number}</span>
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shadow-inner">
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">{step.title}</h3>
                    <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">{step.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* --- SECTION 5: ABOUT CONTENT BLOCK --- */}
        <div id="about" className="pb-28 pt-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-28">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.2 }} transition={{ duration: 0.6 }} className="space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Our Story</span>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">Empowering creators, <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">protecting communities.</span></h2>
              </div>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed text-left">CiviScan combines advanced Natural Language Processing (NLP) models with custom contextual classifiers to evaluate semantic nuances and stop cyberbullying patterns instantly.</p>
            </motion.div>
            <div className="grid gap-4 sm:grid-cols-2 text-left">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-2">
                <div className="text-2xl">🧠</div>
                <h3 className="font-bold text-slate-900 text-sm tracking-tight">Advanced NLP</h3>
                <p className="text-slate-500 text-xs leading-relaxed">Deep learning parameters evaluate sentences to understand underlying context.</p>
              </div>
              <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-md shadow-indigo-100 space-y-2">
                <div className="text-2xl">⚡</div>
                <h3 className="font-bold text-sm tracking-tight">Instant Scans</h3>
                <p className="text-indigo-100 text-xs leading-relaxed">Processes thousands of comments securely in milliseconds.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* --- SECTION 6: FOOTER --- */}
      <footer id="contact" className="bg-white text-slate-900 pt-16 pb-8 px-6 md:px-12 border-t border-slate-200 scroll-mt-28">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16 text-left">
            <div className="md:col-span-1 pr-4 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-full flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-950 tracking-tight">CiviScan</span>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">
                AI-powered moderation that detects toxic, abusive, and cyberbullying content in YouTube comment sections.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-slate-950 mb-5 text-sm uppercase tracking-wider">Platform</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="#home" className="text-slate-600 hover:text-indigo-600 transition duration-150">Home</a></li>
                <li><a href="#features" className="text-slate-600 hover:text-indigo-600 transition duration-150">Features</a></li>
                <li><a href="#analytics" className="text-slate-600 hover:text-indigo-600 transition duration-150">Analytics</a></li>
                <li><a href="#about" className="text-slate-600 hover:text-indigo-600 transition duration-150">About</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-slate-955 mb-5 text-sm uppercase tracking-wider">Legal</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="/privacy" className="text-slate-600 hover:text-indigo-600 transition duration-150">Privacy Policy</a></li>
                <li><a href="/terms" className="text-slate-600 hover:text-indigo-600 transition duration-150">Premium Terms</a></li>
                <li><a href="/cookies" className="text-slate-600 hover:text-indigo-600 transition duration-150">Cookie Guidelines</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-slate-955 mb-5 text-sm uppercase tracking-wider">Contact</h3>
              <ul className="space-y-3.5 text-sm">
                <li className="flex items-center gap-3 text-slate-600">
                  <Mail className="w-4 h-4 text-indigo-500" />
                  <a href="mailto:hello@civiscan.ai" className="hover:text-indigo-600 transition">hello@civiscan.ai</a>
                </li>
                <li className="flex items-center gap-3 text-slate-600">
                  <MapPin className="w-4 h-4 text-indigo-500" />
                  <span>Remote · Worldwide</span>
                </li>
                <li className="flex items-center gap-3 text-slate-600">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-indigo-500">
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                    <path d="M9 18c-4.51 2-5-2-7-2" />
                  </svg>
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition">GitHub Repository</a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-200/80 pt-8 flex flex-col md:flex-row justify-between items-center text-xs md:text-sm text-slate-500 gap-4">
            <p>© 2026 CiviScan. All rights reserved.</p>
            <p className="font-medium tracking-tight text-slate-400">
              Built with React, Tailwind CSS & AI · NLP & Machine Learning Models
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}