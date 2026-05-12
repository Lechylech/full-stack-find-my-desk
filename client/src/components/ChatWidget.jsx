import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export default function ChatWidget({ me }) {
  const [enabled, setEnabled] = useState(null); // null = unknown, false = hide, true = show
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // server-shape messages (for re-send)
  const [renderMessages, setRenderMessages] = useState([]); // simplified for UI
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [usage, setUsage] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    api.chat.health()
      .then((h) => setEnabled(!!h.enabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [renderMessages, open]);

  if (!me || enabled !== true) return null;

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);

    const userMsg = { role: 'user', content: [{ type: 'text', text }] };
    const nextServerMessages = [...messages, userMsg];
    const nextRender = [...renderMessages, { role: 'user', text }];
    setMessages(nextServerMessages);
    setRenderMessages(nextRender);
    setInput('');

    try {
      const r = await api.chat.send({
        userId: me.id,
        userName: me.fullName,
        messages: nextServerMessages,
      });
      setMessages(r.messages || nextServerMessages);
      const trace = (r.toolTrace || []).map((t) => `${t.name} → ${t.summary}`);
      setRenderMessages([
        ...nextRender,
        { role: 'assistant', text: r.reply || '(empty reply)', toolTrace: trace },
      ]);
      setUsage(r.usage || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  function newConversation() {
    setMessages([]);
    setRenderMessages([]);
    setError(null);
    setUsage(null);
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      <button
        className={`chat-fab${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        title="AI booking assistant"
      >
        {open ? '×' : '✦'}
      </button>

      {open && (
        <div className="chat-panel" role="dialog" aria-label="AI booking assistant">
          <header className="chat-header">
            <div>
              <strong>AI booking assistant</strong>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Powered by Claude · {me.fullName}</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={newConversation} title="New conversation" className="chat-icon-btn">⟲</button>
              <button onClick={() => setOpen(false)} title="Close" className="chat-icon-btn">×</button>
            </div>
          </header>

          <div className="chat-body" ref={scrollRef}>
            {renderMessages.length === 0 && (
              <div className="chat-hint">
                Ask me to find or book a desk. Try:
                <ul>
                  <li>"Find a quiet window desk for Friday"</li>
                  <li>"Book a hot-desk near my team tomorrow morning"</li>
                  <li>"What's available in Virtualisation today?"</li>
                </ul>
              </div>
            )}
            {renderMessages.map((m, i) => (
              <div key={i} className={`chat-msg chat-msg-${m.role}`}>
                <div className="chat-msg-text">{m.text}</div>
                {m.toolTrace && m.toolTrace.length > 0 && (
                  <details className="chat-tool-trace">
                    <summary>{m.toolTrace.length} tool call{m.toolTrace.length === 1 ? '' : 's'}</summary>
                    <ul>{m.toolTrace.map((t, j) => <li key={j}>{t}</li>)}</ul>
                  </details>
                )}
              </div>
            ))}
            {sending && <div className="chat-msg chat-msg-assistant chat-thinking">Thinking…</div>}
            {error && <div className="chat-error">{error}</div>}
          </div>

          <footer className="chat-footer">
            <textarea
              rows={2}
              placeholder="Ask me to find or book a desk…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              disabled={sending}
            />
            <button className="primary" onClick={send} disabled={sending || !input.trim()}>
              Send
            </button>
          </footer>
          {usage && (
            <div className="chat-usage" title="Token usage this conversation">
              in {usage.input} · out {usage.output}
              {usage.cacheRead > 0 && ` · cache ${usage.cacheRead}`}
            </div>
          )}
        </div>
      )}
    </>
  );
}
