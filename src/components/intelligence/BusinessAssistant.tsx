'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Sparkles, 
  TrendingUp, 
  AlertCircle, 
  Bot, 
  User, 
  Loader2,
  ChevronRight,
  Lightbulb,
  HelpCircle,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { analyzeText, aiToast } from '@/services/aiService';
import { db } from '@/db/dexie';
import ReactMarkdown from 'react-markdown';
import { usePathname } from 'next/navigation';

const PREF_KEY = 'kasirhub_prefs';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function BusinessAssistant() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Halo! Saya asisten bisnis KasirHub ✨. Saya bisa membantu menganalisa data penjualan, stok, dan memberikan saran strategi untuk toko Anda. Apa yang ingin Anda ketahui hari ini?',
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [prefs, setPrefs] = useState<any>(null);

  useEffect(() => {
    const loadPrefs = () => {
      const saved = localStorage.getItem(PREF_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setPrefs(parsed);
          // If there's a custom prompt, update the first message if it's the default one
          if (parsed.chatbotPrompt) {
            setMessages([
              {
                role: 'assistant',
                content: parsed.chatbotPrompt,
                timestamp: new Date()
              }
            ]);
          }
        } catch (e) {}
      }
    };

    loadPrefs();

    window.addEventListener('kasirhub_prefs_updated', loadPrefs);
    return () => window.removeEventListener('kasirhub_prefs_updated', loadPrefs);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Hide on certain pages to avoid obstruction or unnecessary presence
  const hiddenRoutes = ['/login', '/register', '/kasir', '/menu'];
  if (hiddenRoutes.some(route => pathname?.startsWith(route))) return null;

  // Respect user preference for FAB visibility
  if (prefs && prefs.showChatbotFab === false) return null;

  const IconMap: Record<string, any> = {
    robot: Bot,
    message: MessageSquare,
    help: HelpCircle,
    sparkles: Sparkles
  };
  const MainIcon = IconMap[prefs?.chatbotIcon || 'robot'] || Bot;

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Fetch local context
      const [products, transactions, transactionItems, expenses] = await Promise.all([
        db.products.toArray(),
        db.transactions.toArray(),
        db.transaction_items.toArray(),
        db.expenses.toArray()
      ]);

      // Build Rich Context for the AI
      const recentTransactions = transactions.slice(-20);
      const lowStockCount = products.filter(p => (p.stock_store || 0) <= (prefs?.lowStockThreshold || 10)).length;
      const totalSales = transactions.reduce((acc, t) => acc + (t.total_amount || 0), 0);
      
      // Calculate profit: Total Sales - Total Cost of Goods Sold (HPP)
      const totalCost = transactionItems.reduce((acc, item) => acc + ((item.cost_at_time || 0) * (item.quantity || 1)), 0);
      const totalProfit = totalSales - totalCost;
      
      const contextData = {
        inventory: {
          totalProducts: products.length,
          lowStockItems: products.filter(p => (p.stock_store || 0) <= (prefs?.lowStockThreshold || 10)).slice(0, 5).map(p => `${p.name} (Sisa: ${p.stock_store})`),
          lowStockCount,
          topSelling: products.sort((a,b) => (b.stock_store||0) - (a.stock_store||0)).slice(0,5).map(p => p.name)
        },
        finance: {
          totalSales: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalSales),
          totalProfit: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalProfit),
          transactionCount: transactions.length,
          averageBasket: transactions.length > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalSales / transactions.length) : 'Rp 0'
        },
        recentActivity: recentTransactions.map(t => `${t.created_at}: Rp ${t.total_amount}`).join(', ')
      };

      const systemPrompt = `
        Anda adalah "KasirHub Strategist", asisten AI tingkat tinggi untuk pemilik toko retail dan F&B. 
        Tujuan Anda adalah membantu pemilik toko meningkatkan profit dan efisiensi operasional.

        IDENTITAS & GAYA:
        - Profesional, analitis, proaktif, dan solutif.
        - Gunakan bahasa Indonesia yang ramah namun tetap bisnis.
        - Gunakan format Markdown (bold, lists) dan emoji yang relevan untuk keterbacaan.
        - Jika ditanya hal teknis aplikasi, jelaskan fitur KasirHub (Sinkronisasi, Laporan, Stok).

        KEMAMPUAN ANALISA:
        1. Analisa Penjualan: Identifikasi tren dari transaksi terakhir.
        2. Manajemen Stok: Berikan saran restock berdasarkan item yang menipis.
        3. Strategi Harga: Sarankan bundling jika ada produk yang stoknya banyak tapi penjualannya lambat.
        4. Konsultasi Bisnis: Berikan tips manajemen karyawan dan kepuasan pelanggan.

        DATA REAL-TIME TOKO SAAT INI:
        - Total Produk: ${contextData.inventory.totalProducts}
        - Barang Menipis: ${contextData.inventory.lowStockCount} item (${contextData.inventory.lowStockItems.join(', ')})
        - Total Omzet: ${contextData.finance.totalSales}
        - Estimasi Laba Bersih: ${contextData.finance.totalProfit}
        - Rata-rata Belanja Pelanggan: ${contextData.finance.averageBasket}
        - Produk Populer: ${contextData.inventory.topSelling.join(', ')}

        INSTRUKSI KHUSUS:
        - Jika user bertanya "Analisa Penjualan", berikan ringkasan omzet dan performa transaksi.
        - Jika user bertanya "Saran Bundling", cari produk populer dan sarankan pasangan paket hemat.
        - Selalu akhiri jawaban dengan satu pertanyaan proaktif untuk membantu langkah bisnis berikutnya.
      `;

      const response = await analyzeText(systemPrompt);
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      aiToast.error("Maaf, saya sedang kesulitan terhubung ke otak pusat.");
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Maaf, terjadi kesalahan saat memproses permintaan Anda. Pastikan koneksi internet stabil.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        style={{ opacity: (prefs?.chatbotFabOpacity || 100) / 100 }}
        className={cn(
          "fixed right-0 lg:right-6 rounded-full bg-indigo-600 text-white shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-50 group border-4 border-white",
          // Position
          "bottom-24 lg:bottom-6",
          // Size
          prefs?.chatbotFabSize === 'sm' && "size-10 lg:size-12",
          (prefs?.chatbotFabSize === 'md' || !prefs?.chatbotFabSize) && "size-14 lg:size-16",
          prefs?.chatbotFabSize === 'lg' && "size-18 lg:size-20",
          // Visibility & Auto-Hide (Docking) logic
          isOpen ? "scale-0 opacity-0 pointer-events-none" : "scale-100",
          prefs?.chatbotFabAutoHide && !isOpen 
            ? "translate-x-1/2 lg:translate-x-1/2 hover:translate-x-0 opacity-50 hover:opacity-100" 
            : "translate-x-0"
        )}
      >
        <div className={cn(
          "absolute -top-1 -right-1 bg-rose-500 rounded-full border-2 border-white animate-bounce",
          prefs?.chatbotFabSize === 'sm' ? "size-3" : "size-4"
        )} />
        <MainIcon className={cn(
          "transition-transform group-hover:rotate-12",
          prefs?.chatbotFabSize === 'sm' ? "size-5" : "size-7 lg:size-8"
        )} />
      </button>

      {/* Assistant Panel */}
      <div className={cn(
        "fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white/95 backdrop-blur-xl z-[60] flex flex-col sm:border-l sm:border-white/20 sm:shadow-[-20px_0_80px_rgba(0,0,0,0.15)]",
        !isOpen && "hidden"
      )}>
        {/* Header */}
        <div className="py-3 px-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.3)] border border-indigo-400/20">
              <MainIcon className="size-5 text-white" />
            </div>
            <div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.12em] flex items-center gap-1.5">
                Business Intelligence
                <Sparkles className="size-3 text-indigo-400 animate-pulse" />
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="size-1 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)] animate-pulse" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">System Online</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="size-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all hover:rotate-90"
          >
            <X className="size-4 text-slate-400" />
          </button>
        </div>

        {/* Messages Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/30"
        >
          {messages.map((msg, idx) => (
            <div 
              key={idx}
              className={cn(
                "flex gap-3 max-w-[85%]",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "size-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-all duration-300 hover:scale-110",
                msg.role === 'user' ? "bg-gradient-to-tr from-slate-800 to-slate-900 text-white" : "bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white"
              )}>
                {msg.role === 'user' ? <User className="size-5" /> : <MainIcon className="size-5" />}
              </div>
              <div className={cn(
                "p-4 rounded-[1.25rem] text-[13px] leading-relaxed shadow-sm border transition-all duration-300 hover:shadow-md",
                msg.role === 'user' ? "whitespace-pre-wrap bg-slate-900 text-white rounded-tr-none border-slate-800" : "bg-white border-white text-slate-700 rounded-tl-none font-medium shadow-indigo-100/30",
                "[&_li_p]:m-0 [&_li_p]:leading-snug [&_ul]:my-1 [&_li]:mb-0"
              )}>
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  <ReactMarkdown
                    components={{
                      strong: ({node, ...props}) => <strong className="font-black text-slate-900" {...props} />,
                      p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-snug" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2 space-y-0.5" {...props} />,
                      li: ({node, ...props}) => <li className="mb-0" {...props} />,
                      h1: ({node, ...props}) => <h1 className="text-base font-black uppercase tracking-tight mb-2 mt-2 first:mt-0" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-sm font-black uppercase tracking-tight mb-1 mt-1.5 first:mt-0" {...props} />,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 mr-auto">
              <div className="size-8 rounded-lg bg-white border border-slate-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Loader2 className="size-4 animate-spin" />
              </div>
              <div className="p-4 bg-white border border-slate-100 rounded-2xl rounded-tl-none shadow-sm">
                <div className="flex gap-1">
                  <div className="size-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="size-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="size-1.5 bg-indigo-600 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions - Horizontal Scroll */}
        <div className="px-4 py-2.5 border-t border-slate-100 bg-white/50 backdrop-blur-sm overflow-hidden">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { icon: TrendingUp, label: "Analisa Penjualan" },
              { icon: AlertCircle, label: "Cek Stok Menipis" },
              { icon: Lightbulb, label: "Saran Bundling" },
              { icon: BarChart3, label: "Laporan Laba" },
              { icon: Sparkles, label: "Ide Promosi" },
              { icon: Bot, label: "Tips Efisiensi" }
            ].map((action, i) => (
              <button
                key={i}
                onClick={() => setInput(action.label)}
                className="whitespace-nowrap px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-600 hover:bg-indigo-50/50 text-[10.5px] font-bold text-slate-600 hover:text-indigo-600 transition-all flex items-center gap-2 shadow-sm shrink-0"
              >
                <action.icon className="size-3" />
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="px-4 pb-4 bg-white/80">
          <div className="relative group">
            <label htmlFor="ai-assistant-input" className="sr-only">Tanya asisten strategi</label>
            <input 
              id="ai-assistant-input"
              name="ai-assistant-input"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Tanya asisten strategi..."
              className="w-full h-11 pl-4 pr-12 rounded-xl bg-slate-100/50 border border-slate-200 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/5 text-[12px] font-medium transition-all shadow-inner"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 size-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center transition-all hover:bg-indigo-700 active:scale-90 shadow-lg shadow-indigo-200 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              <Send className="size-4" />
            </button>
          </div>
          <p className="text-center text-[9px] font-black text-slate-300 uppercase tracking-[0.15em] mt-2.5 opacity-60">
            KasirHub Intelligence ✨
          </p>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[55] transition-all"
        />
      )}
    </>
  );
}
