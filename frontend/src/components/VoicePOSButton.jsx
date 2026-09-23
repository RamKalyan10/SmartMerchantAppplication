import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Mic, MicOff, X, Volume2, Sparkles, AlertCircle, CheckCircle2, Package } from "lucide-react";

export default function VoicePOSButton({ products = [], onAddProduct, onRemoveProduct, onClearCart, onSetSearch }) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [toast, setToast] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [showPickModal, setShowPickModal] = useState(false);
  const [pendingPick, setPendingPick] = useState(null);
  const recognitionRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setIsSupported(false);
    return () => { recognitionRef.current?.stop(); };
  }, []);

  const showToast = useCallback((type, message) => {
    clearTimeout(toastTimerRef.current);
    setToast({ type, message });
    if (type !== "pick") {
      toastTimerRef.current = setTimeout(() => setToast(null), 4000);
    }
  }, []);

  const parseCommand = useCallback((text) => {
    const t = text.toLowerCase().trim();
    // Clear cart
    if (/\b(clear|empty|reset|wipe)\b/.test(t) || t === "clear") {
      onClearCart?.();
      showToast("success", "Cart cleared!");
      return;
    }
    // Search
    const searchMatch = t.match(/^(?:search|find|look for|show me|filter)\s+(.+)$/);
    if (searchMatch) {
      const term = searchMatch[1].trim();
      onSetSearch?.(term);
      showToast("info", "Searching for: " + term);
      return;
    }
    // Remove
    const removeMatch = t.match(/^(?:remove|delete|take off|cancel)\s+(.+)$/);
    if (removeMatch) {
      const query = removeMatch[1].trim();
      onRemoveProduct?.(query);
      showToast("success", "Removed from cart: " + query);
      return;
    }
    // Add with optional qty
    let qty = 1;
    let productQuery = t;
    const addPrefix = t.match(/^(?:add|put|include|get|give me|i want|i need)\s+(.+)$/);
    if (addPrefix) productQuery = addPrefix[1];
    const leadNum = productQuery.match(/^(\d+)\s+(?:bags? of|packets? of|kg of|liters? of|bottles? of|pieces? of|units? of|boxes? of)?\s*(.+)$/);
    if (leadNum) { qty = parseInt(leadNum[1], 10); productQuery = leadNum[2].trim(); }
    else {
      const trailNum = productQuery.match(/^(.+?)\s+(\d+)$/);
      if (trailNum) { productQuery = trailNum[1].trim(); qty = parseInt(trailNum[2], 10); }
    }
    qty = Math.max(1, Math.min(qty, 999));
    if (!products.length) { showToast("error", "No products loaded yet."); return; }
    const q = productQuery.toLowerCase();
    const scored = products.filter(p => p.stock_quantity > 0).map(p => {
      const name = p.name.toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      let score = 0;
      if (name === q || sku === q) score = 100;
      else if (name.startsWith(q) || sku.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else {
        const words = q.split(/\s+/);
        const matched = words.filter(w => name.includes(w) || sku.includes(w));
        score = (matched.length / words.length) * 50;
      }
      return { product: p, score };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);
    if (scored.length === 0) { showToast("error", "No product found for: " + productQuery); return; }
    if (scored.length === 1 || scored[0].score >= 80) {
      const best = scored[0].product;
      onAddProduct?.(best, qty);
      showToast("success", "Added " + qty + "x " + best.name + " to cart");
    } else {
      setPendingPick({ matches: scored.slice(0, 5).map(s => s.product), qty });
      setShowPickModal(true);
    }
  }, [products, onAddProduct, onRemoveProduct, onClearCart, onSetSearch, showToast]);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.onstart = () => { setIsListening(true); setTranscript(""); setToast(null); };
    recognition.onresult = (event) => {
      let interim = "", final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t; else interim += t;
      }
      setTranscript(final || interim);
      if (final) parseCommand(final);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === "no-speech") showToast("info", "No speech detected. Tap mic and try again.");
      else if (event.error === "not-allowed") showToast("error", "Microphone access denied.");
      else showToast("error", "Voice error: " + event.error);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  }, [parseCommand, showToast]);

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); setIsListening(false); }, []);
  const handlePickProduct = (product) => {
    onAddProduct?.(product, pendingPick.qty);
    showToast("success", "Added " + pendingPick.qty + "x " + product.name + " to cart");
    setShowPickModal(false); setPendingPick(null);
  };

  if (!isSupported) return null;

  return (
    <>
      <div className="relative">
        {isListening && (
          <>
            <span className="absolute inset-0 rounded-full bg-rose-500 opacity-30 animate-ping" />
            <span className="absolute inset-0 rounded-full bg-rose-400 opacity-20 animate-ping [animation-delay:0.3s]" />
          </>
        )}
        <button
          onClick={() => isListening ? stopListening() : startListening()}
          title={isListening ? "Stop listening" : 'Voice command — say "add 3 rice"'}
          className={`relative w-11 h-11 rounded-full flex items-center justify-center font-bold shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 ${
            isListening
              ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/40"
              : "bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-violet-600/30"
          }`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      </div>

      {isListening && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in pointer-events-none">
          <div className="bg-slate-900/95 backdrop-blur-xl text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 min-w-[300px] max-w-[420px]">
            <div className="flex items-end gap-0.5 h-6 shrink-0">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="w-1 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s`, height: `${30 + (i % 3) * 30}%`, minHeight: "4px" }} />
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-rose-300 uppercase tracking-widest mb-0.5">Listening…</div>
              <div className="text-xs text-slate-300 truncate">{transcript || 'Say: "add 3 rice" or "clear cart"'}</div>
            </div>
            <Volume2 className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
          </div>
        </div>,
        document.body
      )}

      {toast && !isListening && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in pointer-events-none">
          <div className={`backdrop-blur-xl px-5 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 max-w-[420px] ${
            toast.type === "success" ? "bg-emerald-900/95 border-emerald-500/30 text-emerald-100"
            : toast.type === "error" ? "bg-rose-900/95 border-rose-500/30 text-rose-100"
            : "bg-slate-900/95 border-violet-500/30 text-slate-100"
          }`}>
            {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === "error" && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {toast.type === "info" && <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />}
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        </div>,
        document.body
      )}

      {showPickModal && pendingPick && createPortal(
        <div className="fixed inset-0 z-[10001] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="fixed inset-0" onClick={() => { setShowPickModal(false); setPendingPick(null); }} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden z-10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400"><Mic className="w-4 h-4" /></div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Which product?</h3>
                  <p className="text-[11px] text-slate-500">Multiple matches — tap to add {pendingPick.qty}×</p>
                </div>
              </div>
              <button onClick={() => { setShowPickModal(false); setPendingPick(null); }} className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
              {pendingPick.matches.map(product => (
                <button key={product.id} onClick={() => handlePickProduct(product)} className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-all group text-left">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
                    <img src={product.image_url || "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=80"} alt={product.name} className="w-full h-full object-cover"
                      onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=80"; }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-violet-700 dark:group-hover:text-violet-300 truncate">{product.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono text-slate-400">{product.sku}</span>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">?{Number(product.selling_price || 0).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 group-hover:text-violet-600 shrink-0"><Package className="w-3.5 h-3.5" /><span>×{pendingPick.qty}</span></div>
                </button>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90">
              <p className="text-[10px] text-slate-400 text-center">Tap a product above to add it to cart</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
