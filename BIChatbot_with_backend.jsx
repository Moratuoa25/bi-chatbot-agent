import { useState, useRef, useEffect } from "react";

const API_URL = "http://localhost:5000"; // your Flask backend

const SAMPLE_QUESTIONS = [
  "Which month had the highest revenue in 2023?",
  "What are the top 3 product categories by sales?",
  "Compare revenue across all regions",
  "Which category has the best profit margin?",
  "Show me monthly sales trend for Electronics",
  "What was the worst performing month?",
];

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "12px 16px" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: "50%", background: "#00e5ff",
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

function DataTable({ data }) {
  if (!data || !data.rows?.length) return null;
  return (
    <div style={{ overflowX: "auto", marginTop: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            {data.columns.map((col) => (
              <th key={col} style={{
                padding: "6px 10px", textAlign: "left",
                background: "rgba(123,47,247,0.2)", color: "#b794f4",
                fontFamily: "'Space Mono', monospace", fontSize: 10,
                textTransform: "uppercase", letterSpacing: 1,
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "5px 10px", color: "#c4c4d4", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {typeof cell === "number" ? cell.toLocaleString() : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  const [showSQL, setShowSQL] = useState(false);

  const formatText = (text) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const code = part.replace(/```[\w]*\n?/, "").replace(/```$/, "");
        return (
          <pre key={i} style={{
            background: "#0a0a0f", border: "1px solid #1a1a2e",
            borderRadius: 8, padding: "10px 14px", fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace", color: "#00e5ff",
            overflowX: "auto", margin: "8px 0", whiteSpace: "pre-wrap",
          }}>{code.trim()}</pre>
        );
      }
      return <span key={i} style={{ whiteSpace: "pre-wrap" }}>{part}</span>;
    });
  };

  return (
    <div style={{
      display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 16, animation: "fadeSlideIn 0.3s ease",
    }}>
      {!isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "linear-gradient(135deg, #00e5ff, #7b2ff7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, marginRight: 10, flexShrink: 0,
          boxShadow: "0 0 12px rgba(0,229,255,0.3)",
        }}>⚡</div>
      )}
      <div style={{ maxWidth: "80%" }}>
        <div style={{
          padding: "12px 16px",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          background: isUser
            ? "linear-gradient(135deg, #7b2ff7, #00b4d8)"
            : "rgba(255,255,255,0.04)",
          border: isUser ? "none" : "1px solid rgba(255,255,255,0.08)",
          color: "#e8e8f0", fontSize: 14, lineHeight: 1.6,
        }}>
          {formatText(msg.content)}
        </div>

        {/* Show real data table */}
        {msg.data && (
          <div style={{
            background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "0 0 12px 12px", padding: "8px 12px",
          }}>
            <DataTable data={msg.data} />
          </div>
        )}

        {/* SQL toggle */}
        {msg.sql && (
          <div style={{ marginTop: 6 }}>
            <button onClick={() => setShowSQL(!showSQL)} style={{
              fontSize: 10, padding: "3px 10px", borderRadius: 20,
              background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.2)",
              color: "#00e5ff", cursor: "pointer", fontFamily: "'Space Mono', monospace",
            }}>
              {showSQL ? "▲ HIDE SQL" : "▼ VIEW SQL"}
            </button>
            {showSQL && (
              <pre style={{
                background: "#0a0a0f", border: "1px solid rgba(0,229,255,0.15)",
                borderRadius: 8, padding: "10px 14px", fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace", color: "#00e5ff",
                marginTop: 6, whiteSpace: "pre-wrap", overflowX: "auto",
              }}>{msg.sql}</pre>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, marginLeft: 10, flexShrink: 0,
        }}>👤</div>
      )}
    </div>
  );
}

export default function BIChatbot() {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Hey! I'm your BI Agent ⚡\n\nI'm connected to a real sales database with 500 transactions across products, regions, and categories.\n\nAsk me anything in plain English — I'll write the SQL, run it, and explain the results!",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("connecting");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Check backend health
  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then(() => setStatus("connected"))
      .catch(() => setStatus("disconnected"));
  }, []);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;

    const userMsg = { role: "user", content: userText };
    const newHistory = [...history, { role: "user", content: userText }];
    setMessages((prev) => [...prev, userMsg]);
    setHistory(newHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, history: newHistory }),
      });
      const data = await res.json();

      const assistantMsg = {
        role: "assistant",
        content: data.reply || data.error || "No response",
        sql: data.sql,
        data: data.data,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setHistory((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "⚠️ Backend not reachable. Make sure Flask is running:\n```\npython app.py\n```",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const statusColor = { connected: "#00e5ff", connecting: "#ffd700", disconnected: "#ff4444" }[status];
  const statusLabel = { connected: "Live Database Connected", connecting: "Connecting...", disconnected: "Backend Offline — run python app.py" }[status];

  return (
    <div style={{ minHeight: "100vh", background: "#07070f", display: "flex", flexDirection: "column", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: "#e8e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap');
        @keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-6px);opacity:1} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
        textarea{resize:none} textarea:focus{outline:none}
      `}</style>

      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,.02)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#7b2ff7,#00e5ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 0 20px rgba(123,47,247,.4)" }}>⚡</div>
        <div>
          <div style={{ fontFamily: "'Space Mono',monospace", fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>BI AGENT</div>
          <div style={{ fontSize: 11, color: statusColor, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, display: "inline-block", animation: "pulse 2s infinite" }} />
            {statusLabel}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {["500 Records", "4 Tables", "SQLite"].map((tag) => (
            <span key={tag} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, background: "rgba(123,47,247,.15)", border: "1px solid rgba(123,47,247,.3)", color: "#b794f4", fontFamily: "'Space Mono',monospace" }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 16 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#00e5ff,#7b2ff7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 10, flexShrink: 0 }}>⚡</div>
              <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: "18px 18px 18px 4px" }}>
                <TypingIndicator />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Sample questions */}
      {messages.length <= 1 && (
        <div style={{ padding: "0 20px 16px", maxWidth: 780, margin: "0 auto", width: "100%" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)", marginBottom: 8, fontFamily: "'Space Mono',monospace" }}>TRY ASKING:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SAMPLE_QUESTIONS.map((q) => (
              <button key={q} onClick={() => sendMessage(q)} style={{ padding: "7px 14px", borderRadius: 20, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#c4c4d4", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>{q}</button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,.06)", background: "rgba(255,255,255,.02)" }}>
        <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", gap: 12, alignItems: "flex-end", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, padding: "12px 16px" }}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
            placeholder="Ask anything about your data..." rows={1}
            style={{ flex: 1, background: "transparent", border: "none", color: "#e8e8f0", fontSize: 14, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }} />
          <button onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{
            width: 36, height: 36, borderRadius: 10, border: "none", cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            background: input.trim() && !loading ? "linear-gradient(135deg,#7b2ff7,#00b4d8)" : "rgba(255,255,255,.06)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
            boxShadow: input.trim() && !loading ? "0 0 16px rgba(123,47,247,.4)" : "none",
          }}>{loading ? "⏳" : "➤"}</button>
        </div>
        <div style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,.2)", marginTop: 8, fontFamily: "'Space Mono',monospace" }}>
          REAL SQL · REAL DATA · POWERED BY CLAUDE
        </div>
      </div>
    </div>
  );
}
