import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api, socketUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import usePageVisible from "../hooks/usePageVisible";
import { playServerBeep } from "../utils/audio";
import { parseVoiceCommand, SERVER_ACTIONS, SERVER_SERVE_ACTIONS } from "../utils/voiceCommands";

export default function ServerBoard() {
  const { user } = useAuth();
  const cid = user?.canteen_id;
  const pageVisible = usePageVisible();
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("ready");
  const [notice, setNotice] = useState("");
  const seen = useRef(new Set());
  const ordersRef = useRef([]);
  const recentlyHandled = useRef(new Set());

  // Voice Command State
  const [isListening, setIsListening] = useState(false);
  const [lastSpeech, setLastSpeech] = useState("");
  const recognitionRef = useRef(null);
  const speechClearTimeoutRef = useRef(null);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const handleVoiceCommand = (command) => {
    const result = parseVoiceCommand(command, SERVER_ACTIONS);
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

    if (targetOrder.status === "ready") {
      recentlyHandled.current.add(tokenNumber);
      setTimeout(() => recentlyHandled.current.delete(tokenNumber), 5000);
      served(targetOrder.id);
    } else {
      setNotice(`Cannot perform "${action}" on order ${tokenNumber} right now.`);
      setTimeout(() => setNotice(""), 4000);
    }
  };

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
      if (document.getElementById('voice-toggle-server')?.checked && document.visibilityState === 'visible') {
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
            // stop stream right away to just force the permission popup
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
      const active = r.data.filter((o) => ["ready", "served"].includes(o.status));
      active.reverse();
      setOrders(active);
    }).catch((e) => console.error("Failed to load orders:", e));
  }

  useEffect(() => {
    load();
  }, [cid]);

  // Reconnect socket only when tab is visible
  useEffect(() => {
    if (!cid || !pageVisible) return;
    const s = io(socketUrl(), { path: "/socket.io/" });
    const token = localStorage.getItem("token");
    s.emit("join_canteen", { canteen_id: cid, token });
    s.on("order_update", (payload) => {
      if (payload && payload.status === 'ready' && !seen.current.has(payload.id)) {
        seen.current.add(payload.id);
        playServerBeep();
      }
      load();
    });
    return () => s.disconnect();
  }, [cid, pageVisible]);

  // Reload data when tab becomes visible again
  useEffect(() => {
    if (pageVisible && cid) {
      load();
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

  async function served(id) {
    await api.patch(`/orders/${id}/status`, { status: "served" });
    setNotice("Order marked as served");
    setTimeout(() => setNotice(""), 4000);
    load();
  }

  if (!cid) {
    return <p className="text-rose-600">Not linked to a canteen.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ready to serve</h1>
          <p className="text-sm text-slate-500">Newly ready orders play a double chime.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
            <input
              id="voice-toggle-server"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
              checked={isListening}
              onChange={(e) => setIsListening(e.target.checked)}
            />
            <span>Enable Voice Commands</span>
          </label>
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
              Listening... Say <strong className="text-slate-800 dark:text-slate-200">"served [token]"</strong>
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

      <div className="flex flex-wrap gap-2">
        {[
          ["ready", "Ready"],
          ["served", "Served"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === key ? "bg-brand text-white" : "bg-slate-100 dark:bg-slate-800"
            }`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {orders
          .filter((o) => o.status === tab)
          .map((o) => (
          <div key={o.id} className="card flex flex-col gap-3">
            <div className="flex justify-between">
              <p className="text-3xl font-bold">Token {o.token_number}</p>
              <p className="font-semibold">₹{Number(o.total).toFixed(2)}</p>
            </div>
            {o.status === "ready" ? (
              <button type="button" className="rounded-xl bg-brand py-2 font-semibold text-white" onClick={() => served(o.id)}>
                Mark served
              </button>
            ) : (
              <span className="rounded bg-slate-100 px-3 py-2 text-center text-sm dark:bg-slate-800">
                Already served
              </span>
            )}
          </div>
        ))}
      </div>
      {!orders.filter((o) => o.status === tab).length && <p className="text-slate-500">No orders in this tab.</p>}
    </div>
  );
}
