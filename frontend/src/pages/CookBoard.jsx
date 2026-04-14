import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api, socketUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import usePageVisible from "../hooks/usePageVisible";

import { playCookBeep } from "../utils/audio";
import { parseVoiceCommand, COOK_ACTIONS, COOK_START_ACTIONS, COOK_FINISH_ACTIONS } from "../utils/voiceCommands";

export default function CookBoard() {
  const { user } = useAuth();
  const cid = user?.canteen_id;
  const pageVisible = usePageVisible();
  const [orders, setOrders] = useState([]);
  const [notice, setNotice] = useState("");
  const seen = useRef(new Set());
  const ordersRef = useRef([]);
  const recentlyHandled = useRef(new Set());

  // Voice Command State
  const [isListening, setIsListening] = useState(false);
  const [lastSpeech, setLastSpeech] = useState("");
  const recognitionRef = useRef(null);
  const speechClearTimeoutRef = useRef(null);

  const [menuItems, setMenuItems] = useState([]);
  const [showMenuManage, setShowMenuManage] = useState(false);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Handle parsed voice commands using fuzzy matching
  const handleVoiceCommand = (command) => {
    const result = parseVoiceCommand(command, COOK_ACTIONS);
    if (!result) return;

    const { action, tokenNumber, confidence } = result;

    if (recentlyHandled.current.has(tokenNumber)) return;

    const currentOrders = ordersRef.current;
    const targetOrder = currentOrders.find(o => o.token_number == tokenNumber);
    
    if (!targetOrder) {
      setNotice(`Order ${tokenNumber} not found.`);
      setTimeout(() => setNotice(""), 4000);
      return;
    }

    if (COOK_START_ACTIONS.has(action) && targetOrder.status === "accepted") {
      recentlyHandled.current.add(tokenNumber);
      setTimeout(() => recentlyHandled.current.delete(tokenNumber), 5000);
      setStatus(targetOrder.id, "preparing");
    } else if (COOK_FINISH_ACTIONS.has(action) && targetOrder.status === "preparing") {
      recentlyHandled.current.add(tokenNumber);
      setTimeout(() => recentlyHandled.current.delete(tokenNumber), 5000);
      setStatus(targetOrder.id, "ready");
    } else {
      setNotice(`Cannot perform "${action}" on order ${tokenNumber} right now.`);
      setTimeout(() => setNotice(""), 4000);
    }
  };

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        const cleaned = finalTranscript.trim().toLowerCase();
        setLastSpeech(cleaned);
        handleVoiceCommand(cleaned);
        
        try {
          recognition.stop();
        } catch (e) {
          // ignore
        }
      } else if (interimTranscript) {
        setLastSpeech(interimTranscript.trim().toLowerCase() + "...");
      }

      if (speechClearTimeoutRef.current) clearTimeout(speechClearTimeoutRef.current);
      speechClearTimeoutRef.current = setTimeout(() => {
        setLastSpeech("");
      }, 4000);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setNotice(`Microphone error: ${event.error}. Please check permissions.`);
    };

    recognition.onend = () => {
      if (document.getElementById('voice-toggle')?.checked && document.visibilityState === 'visible') {
        try {
          recognition.start();
        } catch (e) {
          // ignore
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, []);

  useEffect(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then((stream) => {
            // we stop the stream right away, we just wanted to force the permission prompt
            stream.getTracks().forEach(track => track.stop());
            try {
              recognitionRef.current.start();
            } catch (e) {
              // ignore if already started
            }
          })
          .catch(err => {
            console.error("Mic permission denied or error:", err);
            setNotice("Microphone permission denied. Please allow it in the browser address bar.");
            setIsListening(false);
          });
      } else {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // ignore
        }
      }
    } else {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  function load() {
    if (!cid) return;
    api.get(`/orders/canteen/${cid}`).then((r) => {
      const active = r.data.filter((o) =>
        ["accepted", "preparing", "ready"].includes(o.status)
      );
      active.reverse();
      setOrders(active);
    }).catch((e) => console.error("Failed to load orders:", e));
  }

  function loadMenu() {
    if (!cid) return;
    api.get(`/menu/canteen/${cid}`).then((r) => setMenuItems(r.data)).catch((e) => console.error("Failed to load menu:", e));
  }

  useEffect(() => {
    load();
    loadMenu();
  }, [cid]);

  // Reconnect socket only when tab is visible
  useEffect(() => {
    if (!cid || !pageVisible) return;
    const s = io(socketUrl(), { path: "/socket.io/" });
    const token = localStorage.getItem("token");
    s.emit("join_canteen", { canteen_id: cid, token });
    s.on("order_new", (payload) => {
      if (!seen.current.has(payload.id)) {
        seen.current.add(payload.id);
        playCookBeep();
      }
      load();
    });
    s.on("order_update", () => load());
    return () => s.disconnect();
  }, [cid, pageVisible]);

  // Reload data when tab becomes visible again
  useEffect(() => {
    if (pageVisible && cid) {
      load();
      loadMenu();
    }
  }, [pageVisible]);

  // Pause/resume microphone based on tab visibility
  useEffect(() => {
    if (!recognitionRef.current) return;
    if (!pageVisible && isListening) {
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
    }
    if (pageVisible && isListening) {
      try { recognitionRef.current.start(); } catch (e) { /* ignore */ }
    }
  }, [pageVisible]);

  async function setStatus(id, status) {
    await api.patch(`/orders/${id}/status`, { status });
    setNotice(`Order moved to ${status}`);
    setTimeout(() => setNotice(""), 4000);
    load();
  }

  async function toggleAvailability(id, currentStatus) {
    try {
      await api.patch(`/menu/item/${id}`, { available: !currentStatus });
      setNotice(`Item marked as ${!currentStatus ? 'available' : 'unavailable'}`);
      setTimeout(() => setNotice(""), 3000);
      loadMenu();
    } catch (e) {
      console.error(e);
      setNotice("Failed to update item availability");
    }
  }

  if (!cid) {
    return <p className="text-rose-600">Your account is not linked to a kitchen. Ask the owner to add you as cook.</p>;
  }

  const renderCol = (title, statusValue) => {
    const colOrders = orders.filter((o) => o.status === statusValue);
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-center">{title} ({colOrders.length})</h2>
        <div className="flex flex-col gap-4">
          {colOrders.map((o) => (
            <div key={o.id} className="card space-y-3">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="text-2xl font-bold">Token {o.token_number}</p>
                </div>
              </div>
              <ul className="text-sm text-slate-600 dark:text-slate-300">
                {o.items.map((li, i) => (
                  <li key={i}>
                    {li.quantity}× {li.name}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {o.status === "accepted" && (
                  <button
                    type="button"
                    className="rounded-lg bg-brand w-full py-2 text-sm font-semibold text-white"
                    onClick={() => setStatus(o.id, "preparing")}
                  >
                    Accept & start cooking
                  </button>
                )}
                {o.status === "preparing" && (
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-600 w-full py-2 text-sm font-semibold text-white"
                    onClick={() => setStatus(o.id, "ready")}
                  >
                    Mark ready
                  </button>
                )}
                {o.status === "ready" && (
                  <span className="rounded bg-emerald-100 w-full text-center py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Ready for serving
                  </span>
                )}
              </div>
            </div>
          ))}
          {!colOrders.length && <p className="text-slate-400 text-center text-sm py-4">No orders.</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Kitchen Dashboard</h1>
          <p className="text-sm text-slate-500">Live multi-column view. Say "start [token]" or "ready [token]"</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold dark:bg-slate-700"
            onClick={() => setShowMenuManage(!showMenuManage)}
          >
            {showMenuManage ? "Hide Menu" : "Manage Menu"}
          </button>
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
            <input
              id="voice-toggle"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
              checked={isListening}
              onChange={(e) => setIsListening(e.target.checked)}
            />
            <span>Enable Voice Commands</span>
          </label>
        </div>
        </div>
      </div>
      
      {(isListening || notice) && (
        <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
          {notice && <p className="font-semibold text-brand mb-1">{notice}</p>}
          {isListening && (
            <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              Listening... Try <strong className="text-slate-800 dark:text-slate-200">"prepare [token]"</strong>, <strong className="text-slate-800 dark:text-slate-200">"making [token]"</strong>, or <strong className="text-slate-800 dark:text-slate-200">"done [token]"</strong>
            </p>
          )}
          {lastSpeech && (
            <div className="mt-3 flex gap-2 items-end">
              <div className="bg-brand text-white text-sm font-medium px-3 py-2 rounded-2xl rounded-tl-sm shadow-sm inline-block max-w-sm">
                "{lastSpeech}"
              </div>
            </div>
          )}
        </div>
      )}

      {showMenuManage && (
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-900 border border-slate-100 dark:border-slate-800 transition-all">
          <h2 className="text-xl font-bold mb-4">Manage Menu Availability</h2>
          {menuItems.length === 0 ? (
            <p className="text-slate-500">No menu items found.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {menuItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border-l-4" style={{ borderColor: item.available ? '#10b981' : '#f43f5e' }}>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{item.name}</span>
                    <span className="text-xs text-slate-500">₹{item.price}</span>
                  </div>
                  <button
                    onClick={() => toggleAvailability(item.id, item.available)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full ${item.available ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30'}`}
                  >
                    {item.available ? 'Available' : 'Unavailable'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3-Column Layout */}
      <div className="grid gap-6 md:grid-cols-3">
        {renderCol("New Orders", "accepted")}
        {renderCol("Preparing", "preparing")}
        {renderCol("Ready", "ready")}
      </div>
    </div>
  );
}
