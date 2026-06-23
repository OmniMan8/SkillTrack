import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  ChevronLeft, 
  Download, 
  Upload, 
  Search, 
  Layers, 
  PlusCircle, 
  X,
  Code2,
  Calendar,
  CheckCircle2,
  Lightbulb,
  Menu,
  LogOut,
  Shield,
  Award,
  Sparkles,
  Lock
} from 'lucide-react';
import { storage } from './lib/storage';
import { AppData, LearningSet, LearningCard, Subheading } from './types';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, signInWithGoogle, logOut, handleFirestoreError, OperationType } from './lib/firebase';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [data, setData] = useState<AppData>({ sets: [] });
  const [currentSetId, setCurrentSetId] = useState<string | null>(null);
  const [isEditingSet, setIsEditingSet] = useState<LearningSet | null | 'new'>(null);
  const [isEditingCard, setIsEditingCard] = useState<LearningCard | null | 'new'>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return unsubscribe;
  }, []);

  // Sync data in real-time with Firestore when user is logged in
  useEffect(() => {
    if (!user) {
      setData({ sets: [] });
      return;
    }

    const q = query(collection(db, 'sets'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sets: LearningSet[] = [];
      snapshot.forEach((docSnap) => {
        sets.push(docSnap.data() as LearningSet);
      });
      sets.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setData({ sets });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sets');
    });

    return unsubscribe;
  }, [user]);

  const currentSet = data.sets.find(s => s.id === currentSetId);

  // Handlers using Firestore persistence
  const handleCreateSet = async (title: string, description: string) => {
    if (!user) return;
    const newSet: LearningSet & { userId: string } = {
      id: crypto.randomUUID(),
      userId: user.uid,
      title,
      description,
      cards: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'sets', newSet.id), newSet);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `sets/${newSet.id}`);
    }
    setIsEditingSet(null);
  };

  const handleUpdateSet = async (id: string, title: string, description: string) => {
    if (!user) return;
    const targetSet = data.sets.find(s => s.id === id);
    if (!targetSet) return;
    const updatedSet = {
      ...targetSet,
      title,
      description,
      updatedAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'sets', id), updatedSet);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sets/${id}`);
    }
    setIsEditingSet(null);
  };

  const handleDeleteSet = async (id: string) => {
    if (!user) return;
    if (confirm('Are you sure you want to delete this set? All cards inside will be lost.')) {
      try {
        await deleteDoc(doc(db, 'sets', id));
        if (currentSetId === id) setCurrentSetId(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `sets/${id}`);
      }
    }
  };

  const handleCreateCard = async (heading: string, subheadings: Subheading[], techStack: string[]) => {
    if (!user || !currentSetId) return;
    const targetSet = data.sets.find(s => s.id === currentSetId);
    if (!targetSet) return;
    const newCard: LearningCard = {
      id: crypto.randomUUID(),
      heading,
      subheadings: subheadings.map(s => ({ ...s, id: crypto.randomUUID() })),
      techStack,
      date: new Date().toISOString()
    };
    const updatedSet = {
      ...targetSet,
      cards: [newCard, ...targetSet.cards],
      updatedAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'sets', currentSetId), updatedSet);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sets/${currentSetId}`);
    }
    setIsEditingCard(null);
  };

  const handleUpdateCard = async (cardId: string, heading: string, subheadings: Subheading[], techStack: string[]) => {
    if (!user || !currentSetId) return;
    const targetSet = data.sets.find(s => s.id === currentSetId);
    if (!targetSet) return;
    const updatedSet = {
      ...targetSet,
      cards: targetSet.cards.map(c => c.id === cardId ? {
        ...c,
        heading,
        subheadings: subheadings.map(st => ({ ...st, id: st.id || crypto.randomUUID() })),
        techStack
      } : c),
      updatedAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'sets', currentSetId), updatedSet);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sets/${currentSetId}`);
    }
    setIsEditingCard(null);
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!user || !currentSetId) return;
    const targetSet = data.sets.find(s => s.id === currentSetId);
    if (!targetSet) return;
    if (confirm('Delete this card?')) {
      const updatedSet = {
        ...targetSet,
        cards: targetSet.cards.filter(c => c.id !== cardId),
        updatedAt: new Date().toISOString()
      };
      try {
        await setDoc(doc(db, 'sets', currentSetId), updatedSet);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `sets/${currentSetId}`);
      }
    }
  };

  const handleExport = () => storage.exportJSON(data);
  
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await storage.importJSON(file);
      if (user) {
        for (const set of imported.sets) {
          const newSet = {
            ...set,
            userId: user.uid,
            updatedAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'sets', set.id), newSet);
        }
        alert('Data imported and synced to Firebase successfully!');
      } else {
        setData(imported);
        alert('Data imported successfully!');
      }
    } catch (err) {
      alert('Failed to import data. Please check the file format.');
    }
  };


  if (loadingAuth) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-800">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading SkillTrack...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Subtle glowing decorative background spots */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10">
          
          {/* Left Column - Brand Presentation */}
          <div className="p-8 md:p-16 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Layers className="text-white" size={20} />
              </div>
              <span className="text-lg font-black tracking-tight text-white">SkillTrack</span>
            </div>

            <div className="my-12 md:my-0 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-300">
                <Sparkles size={13} />
                Now Powered by Firebase Cloud
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
                Architect Your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-200">Developer Odyssey</span>
              </h1>
              <p className="text-slate-400 text-sm md:text-base leading-relaxed font-medium">
                Track learning paths, log technical milestones, build deep-dive cards, and monitor your personal portfolio expansion in secure, real-time cloud synchronization.
              </p>
            </div>

            <div className="flex items-center gap-3 text-slate-500 text-xs font-mono">
              <Shield size={14} className="text-indigo-400" />
              <span>Attributes Secured &bull; Zero-Trust Rules</span>
            </div>
          </div>

          {/* Right Column - Interaction Card */}
          <div className="p-8 md:p-16 flex flex-col justify-center bg-slate-900">
            <div className="max-w-md mx-auto w-full space-y-8">
              <div className="space-y-3">
                <div className="w-12 h-12 bg-slate-800 border border-slate-700/50 rounded-2xl flex items-center justify-center mb-6">
                  <Lock className="text-indigo-400" size={20} />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Access Your Workspace</h2>
                <p className="text-slate-400 text-sm font-medium">Sign in to instantly access your synced developer tracking metrics and collections.</p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={signInWithGoogle}
                  className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-900 font-bold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] shadow-xl hover:shadow-indigo-500/5 cursor-pointer"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.08H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.92l2.85-2.22.81-.6z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.08l3.66 2.84c.87-2.6 3.3-4.54 6.16-4.54z" fill="#EA4335"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div className="flex items-center gap-2 justify-center pt-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Enterprise Cloud Core Live</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 z-40">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg md:hidden text-slate-500 transition-colors"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <Layers className="text-white" size={18} />
            </div>
            <h1 className="text-lg md:xl font-bold tracking-tight text-slate-800">SkillTrack</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden sm:flex border border-slate-200 rounded-lg overflow-hidden h-9 shadow-sm">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-4 bg-white hover:bg-slate-50 text-xs font-semibold border-r border-slate-200 flex items-center gap-2 text-slate-600 transition-colors cursor-pointer"
              title="Import JSON"
              id="import-button"
            >
              <Upload size={14} />
              Import
            </button>
            <button 
              onClick={handleExport}
              className="px-4 bg-white hover:bg-slate-50 text-xs font-semibold flex items-center gap-2 text-slate-600 transition-colors cursor-pointer"
              title="Export JSON"
              id="export-button"
            >
              <Download size={14} />
              Export
            </button>
          </div>
          <button 
            onClick={() => currentSetId ? setIsEditingCard('new') : setIsEditingSet('new')}
            className="bg-indigo-600 text-white px-3 md:px-5 py-2 md:py-2.5 rounded-lg font-bold text-[10px] md:text-xs hover:bg-indigo-700 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            id="new-button"
          >
            {currentSetId ? '+ Add' : '+ New Set'}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            className="hidden" 
            accept=".json"
          />

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3 pl-2 md:pl-4 border-l border-slate-200">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || "User"} 
                className="w-8 h-8 rounded-full border border-slate-200"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0">
                {user.displayName?.charAt(0) || user.email?.charAt(0) || "U"}
              </div>
            )}
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-700 max-w-[120px] truncate leading-tight">
                {user.displayName || "Developer"}
              </span>
              <span className="text-[10px] text-slate-400 font-mono max-w-[120px] truncate leading-none">
                {user.email}
              </span>
            </div>
            <button
              onClick={logOut}
              className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
              title="Sign Out"
              id="signout-button"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Menu Backdrop */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-30 md:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:static inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 p-6 flex flex-col shrink-0 z-40 transition-transform duration-300 ease-in-out`}>
          <div className="mb-8 overflow-y-auto custom-scrollbar flex-1">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-6 px-3">My Collections</h2>
            <nav className="space-y-2">
              <button
                onClick={() => { setCurrentSetId(null); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium ${!currentSetId ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                <div className={`w-2 h-2 rounded-full ${!currentSetId ? 'bg-indigo-300' : 'bg-slate-600'}`} />
                All Sets
              </button>
              {data.sets.map(set => (
                <button
                  key={set.id}
                  onClick={() => { setCurrentSetId(set.id); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium text-left truncate ${currentSetId === set.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${currentSetId === set.id ? 'bg-indigo-300' : 'bg-indigo-900'}`} />
                  <span className="truncate">{set.title}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700/50 backdrop-blur-sm shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Learning Stats</p>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <p className="text-sm font-medium text-white flex items-baseline gap-1">
              <span className="text-2xl font-black">{data.sets.reduce((acc, s) => acc + s.cards.length, 0)}</span>
              <span className="text-slate-500 text-xs uppercase tracking-tighter">Total Cards</span>
            </p>
            <div className="mt-4 w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (data.sets.reduce((acc, s) => acc + s.cards.length, 0) / 10) * 100)}%` }}
                className="bg-indigo-400 h-full shadow-[0_0_8px_rgba(129,140,248,0.5)]" 
              />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-slate-50 overflow-y-auto relative scroll-smooth">
          <div className="p-4 md:p-10 max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
              {!currentSetId ? (
                <motion.div 
                  key="dashboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-10"
                >
                  <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200 pb-8 gap-6 md:gap-0">
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Active Learning Paths</h2>
                      <p className="text-sm md:text-base text-slate-500 mt-1 font-medium">Track your progress on skills and project builds.</p>
                    </div>
                    <div className="relative group w-full md:w-auto">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
                      <input 
                        type="text" 
                        placeholder="Filter collections..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-white border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 shadow-sm rounded-xl text-sm transition-all w-full md:w-64 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                    {data.sets.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase())).map(set => (
                      <motion.div
                        key={set.id}
                        layoutId={set.id}
                        onClick={() => setCurrentSetId(set.id)}
                        className="group bg-white border border-slate-200 p-8 rounded-[2rem] hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-900/5 transition-all cursor-pointer relative flex flex-col"
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 transform group-hover:rotate-6">
                            <Layers size={24} />
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setIsEditingSet(set); }}
                              className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteSet(set.id); }}
                              className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{set.title}</h3>
                        <p className="text-slate-500 text-sm line-clamp-2 mb-8 leading-relaxed font-medium">{set.description}</p>
                        <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">{set.cards.length} cards</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{new Date(set.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="set-view"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-12"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 border-b border-slate-200 pb-10">
                    <div className="max-w-2xl">
                      <div className="flex items-center gap-3 text-indigo-600 mb-4">
                        <button 
                          onClick={() => setCurrentSetId(null)}
                          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest hover:translate-x-[-4px] transition-transform"
                        >
                          <ChevronLeft size={16} />
                          Back to Collections
                        </button>
                      </div>
                      <h2 className="text-4xl font-black tracking-tight text-slate-900 mb-3">{currentSet.title}</h2>
                      <p className="text-lg text-slate-500 leading-relaxed font-medium">{currentSet.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-8 pb-12">
                    {currentSet.cards.filter(c => c.heading.toLowerCase().includes(searchQuery.toLowerCase())).map((card, idx) => (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.1 } }}
                        className="bg-white border border-slate-200 rounded-[2rem] shadow-sm hover:shadow-lg transition-all group overflow-hidden flex flex-col"
                      >
                         <div className="p-6 md:p-8 border-b border-slate-100 relative">
                            <div className="flex justify-between items-start mb-4">
                              <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">Skill Milestone</span>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => setIsEditingCard(card)}
                                  className="p-2 bg-slate-50 hover:bg-indigo-600 hover:text-white rounded-xl transition-all"
                                >
                                  <Edit3 size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteCard(card.id)}
                                  className="p-2 bg-slate-50 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                            
                            <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-4">{card.heading}</h3>
                            
                            <div className="flex flex-wrap gap-2">
                                {card.techStack.map(tech => (
                                  <span key={tech} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wide">
                                    {tech}
                                  </span>
                                ))}
                            </div>
                         </div>

                         <div className="p-6 md:p-8 bg-slate-50/50 flex flex-col md:flex-row gap-6 md:gap-8">
                            <div className="flex-1">
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                  {card.subheadings.map((sub) => (
                                    <li key={sub.id} className="flex items-center gap-3">
                                      <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                        <CheckCircle2 size={12} className="text-indigo-600" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-600 font-bold truncate">{sub.text}</p>
                                        {sub.description && (
                                          <p className="text-[10px] text-slate-400 font-medium line-clamp-1">{sub.description}</p>
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                            </div>
                            <div className="shrink-0 flex items-center pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-200 md:pl-8">
                                <div className="flex items-center gap-2 text-slate-400 font-mono text-[10px] uppercase tracking-widest">
                                  <Calendar size={12} />
                                  {new Date(card.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                            </div>
                         </div>
                      </motion.div>
                    ))}
                    
                    {currentSet.cards.length === 0 && (
                      <div className="py-24 text-center bg-white border-2 border-dashed border-slate-200 rounded-[2rem]">
                         <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <PlusCircle size={40} className="text-slate-200" />
                         </div>
                        <p className="text-slate-400 font-bold mb-4">Empty Collection</p>
                        <button 
                          onClick={() => setIsEditingCard('new')}
                          className="text-indigo-600 font-bold text-sm hover:underline"
                        >
                          Create your first card
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Footer / Status Bar */}
      <footer className="py-2 md:h-10 bg-white border-t border-slate-200 flex flex-col md:flex-row items-center justify-between px-4 md:px-8 shrink-0 gap-2 md:gap-0">
        <div className="flex items-center gap-4 text-[9px] md:text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Cloud Sync Active
          </div>
          <span className="hidden md:inline w-1 h-1 bg-slate-300 rounded-full" />
          <div className="flex items-center gap-1">
            <Shield size={10} className="text-slate-400" />
            <span>Secure Database &bull; Auth Active</span>
          </div>
        </div>
        <div className="text-[9px] md:text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
           SkillTrack &copy; {new Date().getFullYear()} &bull; v1.0.4 Production
        </div>
      </footer>

      {/* Set Editor Modal */}
      <AnimatePresence>
        {isEditingSet && (
          <Modal onClose={() => setIsEditingSet(null)} title={isEditingSet === 'new' ? 'Create New Set' : 'Edit Set'}>
            <SetForm 
              initialData={isEditingSet === 'new' ? undefined : isEditingSet}
              onSave={(title, desc) => {
                if (isEditingSet === 'new') handleCreateSet(title, desc);
                else handleUpdateSet(isEditingSet.id, title, desc);
              }}
              onCancel={() => setIsEditingSet(null)}
            />
          </Modal>
        )}
      </AnimatePresence>

      {/* Card Editor Modal */}
      <AnimatePresence>
        {isEditingCard && (
          <Modal onClose={() => setIsEditingCard(null)} title={isEditingCard === 'new' ? 'New Progress Card' : 'Edit Card'}>
            <CardForm 
              initialData={isEditingCard === 'new' ? undefined : isEditingCard}
              onSave={(heading, subs, tech) => {
                if (isEditingCard === 'new') handleCreateCard(heading, subs, tech);
                else handleUpdateCard(isEditingCard.id, heading, subs, tech);
              }}
              onCancel={() => setIsEditingCard(null)}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components
function Modal({ children, onClose, title }: { children: React.ReactNode, onClose: () => void, title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden relative z-10 shadow-2xl border border-white/20"
      >
        <div className="h-2 bg-indigo-600" />
        <div className="p-6 md:p-12">
          <div className="flex items-center justify-between mb-6 md:mb-10">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{title}</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} className="text-slate-400" /></button>
          </div>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function SetForm({ initialData, onSave, onCancel }: { initialData?: LearningSet, onSave: (t: string, d: string) => void, onCancel: () => void }) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');

  return (
    <form className="space-y-8" onSubmit={e => { e.preventDefault(); onSave(title, description); }}>
      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">Collection Title</label>
        <input 
          autoFocus
          className="w-full text-2xl font-bold bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl px-6 py-4 outline-none transition-all placeholder:text-slate-200"
          placeholder="e.g. Distributed Systems"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">Description</label>
        <textarea 
          className="w-full h-32 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl px-6 py-4 outline-none transition-all resize-none placeholder:text-slate-200 text-lg font-medium text-slate-600"
          placeholder="Summarize what you're tracking here..."
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>
      <div className="flex gap-4 pt-6">
        <button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-indigo-900/20">
          Confirm Changes
        </button>
        <button type="button" onClick={onCancel} className="px-8 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

function CardForm({ initialData, onSave, onCancel }: { initialData?: LearningCard, onSave: (h: string, s: Subheading[], t: string[]) => void, onCancel: () => void }) {
  const [heading, setHeading] = useState(initialData?.heading || '');
  const [subheadings, setSubheadings] = useState<Subheading[]>(initialData?.subheadings || []);
  const [techStack, setTechStack] = useState<string[]>(initialData?.techStack || []);
  const [newTech, setNewTech] = useState('');
  
  const [editingSub, setEditingSub] = useState<{ index: number, data: Partial<Subheading> } | null>(null);

  const saveSubheading = (text: string, description: string) => {
    if (!editingSub) return;
    const next = [...subheadings];
    const subData = { id: editingSub.data.id || crypto.randomUUID(), text, description };
    
    if (editingSub.index === -1) {
      setSubheadings([...next, subData]);
    } else {
      next[editingSub.index] = subData;
      setSubheadings(next);
    }
    setEditingSub(null);
  };

  const removeSubheading = (idx: number) => setSubheadings(subheadings.filter((_, i) => i !== idx));

  const addTech = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (newTech.trim() && !techStack.includes(newTech.trim())) {
      setTechStack([...techStack, newTech.trim()]);
      setNewTech('');
    }
  };

  const removeTech = (tech: string) => setTechStack(techStack.filter(t => t !== tech));

  return (
    <>
      <form className="space-y-10" onSubmit={e => { e.preventDefault(); onSave(heading, subheadings, techStack); }}>
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">Milestone Heading</label>
            <input 
              autoFocus
              className="w-full text-2xl font-bold bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl px-6 py-4 outline-none transition-all placeholder:text-slate-200"
              placeholder="What's the main achievement?"
              value={heading}
              onChange={e => setHeading(e.target.value)}
              required
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Accomplishments</label>
              <button 
                type="button" 
                onClick={() => setEditingSub({ index: -1, data: {} })} 
                className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700"
              >
                Add Line +
              </button>
            </div>
            <div className="space-y-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              {subheadings.map((sub, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-transparent hover:border-indigo-100 transition-colors group">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{sub.text}</p>
                    {sub.description && (
                      <p className="text-[10px] text-slate-400 line-clamp-1">{sub.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => setEditingSub({ index: idx, data: sub })} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                      <Edit3 size={14} />
                    </button>
                    <button type="button" onClick={() => removeSubheading(idx)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {subheadings.length === 0 && (
                <div className="py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">No accomplishments added</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">Tech Stack Tags</label>
            <div className="flex gap-2">
              <input 
                className="flex-1 bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-400 rounded-xl px-4 py-3 outline-none transition-all text-sm font-medium"
                placeholder="Add tag (Type & press Enter)"
                value={newTech}
                onChange={e => setNewTech(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTech())}
              />
              <button type="button" onClick={() => addTech()} className="bg-indigo-600 text-white px-5 rounded-xl text-xs font-bold transition-all hover:bg-indigo-700">Add</button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-8">
              {techStack.map(tech => (
                <span key={tech} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg animate-in fade-in zoom-in-95">
                  {tech}
                  <button type="button" onClick={() => removeTech(tech)} className="hover:text-indigo-400 transition-colors"><X size={10} /></button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-6">
          <button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-indigo-900/20">
            Save Progress
          </button>
          <button type="button" onClick={onCancel} className="px-8 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-colors">
            Cancel
          </button>
        </div>
      </form>

      <AnimatePresence>
        {editingSub && (
          <Modal onClose={() => setEditingSub(null)} title={editingSub.index === -1 ? 'Add Accomplishment' : 'Edit Accomplishment'}>
            <SubheadingForm 
              initialData={editingSub.data as Subheading}
              onSave={saveSubheading}
              onCancel={() => setEditingSub(null)}
            />
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

function SubheadingForm({ initialData, onSave, onCancel }: { initialData?: Subheading, onSave: (t: string, d: string) => void, onCancel: () => void }) {
  const [text, setText] = useState(initialData?.text || '');
  const [description, setDescription] = useState(initialData?.description || '');

  return (
    <form className="space-y-8" onSubmit={e => { e.preventDefault(); onSave(text, description); }}>
      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">What did you achieve?</label>
        <input 
          autoFocus
          className="w-full text-xl font-bold bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl px-6 py-4 outline-none transition-all placeholder:text-slate-200"
          placeholder="e.g. Implemented OAuth flow"
          value={text}
          onChange={e => setText(e.target.value)}
          required
        />
      </div>
      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">Context / Details (Optional)</label>
        <textarea 
          className="w-full h-24 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl px-6 py-4 outline-none transition-all resize-none placeholder:text-slate-200 text-base font-medium text-slate-600"
          placeholder="Add some more color to this win..."
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>
      <div className="flex gap-4 pt-6">
        <button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-indigo-900/20">
          Confirm
        </button>
        <button type="button" onClick={onCancel} className="px-8 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-colors">
          Back
        </button>
      </div>
    </form>
  );
}
