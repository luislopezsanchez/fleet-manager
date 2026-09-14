import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface ChatAction {
  endpoint?: string;
  params?: Record<string, unknown>;
  status?: string;
  error?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ChatAction[];
  data?: any;
  timestamp: string;
  expanded?: boolean;
}

const API_BASE = '/api/v1';

export default function AssistantPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = [
    t('assistant.suggestion1'),
    t('assistant.suggestion2'),
    t('assistant.suggestion3'),
    t('assistant.suggestion4'),
  ];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const token = localStorage.getItem('fleet_token');
      if (!token) return;
      const resp = await fetch(`${API_BASE}/assistant/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.conversations && data.conversations.length > 0) {
          const historyMsgs: ChatMessage[] = data.conversations.map(
            (c: Record<string, unknown>, idx: number) => ({
              id: `hist-${idx}`,
              role: c.role as 'user' | 'assistant',
              content: c.content as string,
              actions: c.actions as ChatAction[],
              data: c.data,
              timestamp: c.timestamp as string,
              expanded: false,
            }),
          );
          setMessages(historyMsgs);
        }
      }
    } catch {
      // silently ignore — start with empty chat
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError(null);
    setInput('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const token = localStorage.getItem('fleet_token');
      if (!token) {
        setError(t('assistant.error'));
        setLoading(false);
        return;
      }

      const resp = await fetch(`${API_BASE}/assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = await resp.json();
      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.response || '...',
        actions: data.actions || [],
        data: data.data,
        timestamp: new Date().toISOString(),
        expanded: false,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(t('assistant.error'));
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: t('assistant.error'),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const toggleActions = (id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, expanded: !m.expanded } : m)),
    );
  };

  const renderData = (data: unknown) => {
    if (!data) return null;
    if (typeof data === 'string') return <pre className="text-xs text-gray-600 whitespace-pre-wrap">{data}</pre>;
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      if (typeof first === 'object' && first !== null) {
        const keys = Object.keys(first);
        return (
          <div className="overflow-x-auto mt-2">
            <table className="min-w-full text-xs border border-gray-200 rounded">
              <thead className="bg-gray-100">
                <tr>
                  {keys.slice(0, 8).map((k) => (
                    <th key={k} className="px-2 py-1 text-left font-semibold text-gray-700 border-b">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 20).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {keys.slice(0, 8).map((k) => (
                      <td key={k} className="px-2 py-1 border-b text-gray-600">
                        {String(row[k] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length > 20 && (
              <p className="text-xs text-gray-400 mt-1">
                ({data.length} registros, mostrando primeros 20)
              </p>
            )}
          </div>
        );
      }
    }
    if (typeof data === 'object') {
      return (
        <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto bg-gray-50 p-2 rounded mt-2">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
    }
    return <span className="text-xs text-gray-600">{String(data)}</span>;
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">{t('assistant.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('assistant.subtitle')}</p>
      </div>

      {/* Chat container */}
      <div className="flex-1 overflow-y-auto bg-white rounded-lg border border-gray-200 p-4 mb-4 min-h-[300px]">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="text-gray-600 max-w-md">{t('assistant.welcome')}</p>
            <div className="flex flex-wrap gap-2 mt-6 justify-center max-w-lg">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

              {/* Actions */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => toggleActions(msg.id)}
                    className={`text-xs font-medium underline ${
                      msg.role === 'user' ? 'text-blue-100' : 'text-blue-600'
                    }`}
                  >
                    {t('assistant.actions')} ({msg.actions.length}) {msg.expanded ? '▲' : '▼'}
                  </button>
                  {msg.expanded && (
                    <div className="mt-2 space-y-2">
                      {msg.actions.map((act, i) => (
                        <div
                          key={i}
                          className={`text-xs rounded-lg p-2 border ${
                            msg.role === 'user'
                              ? 'bg-blue-500 border-blue-400 text-blue-50'
                              : 'bg-white border-gray-200 text-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">{act.endpoint || 'N/A'}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                act.status === 'success'
                                  ? 'bg-green-100 text-green-700'
                                  : act.status === 'error'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {act.status || 'pending'}
                            </span>
                          </div>
                          {act.params && Object.keys(act.params).length > 0 && (
                            <pre className="mt-1 text-[10px] opacity-75 overflow-x-auto">
                              {JSON.stringify(act.params, null, 2)}
                            </pre>
                          )}
                          {act.error && (
                            <p className="mt-1 text-red-400">{act.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Data */}
              {msg.data && msg.expanded && (
                <div className="mt-2">
                  <p className={`text-xs font-medium mb-1 ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                    {t('assistant.data')}:
                  </p>
                  {renderData(msg.data)}
                </div>
              )}

              <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{t('assistant.thinking')}</span>
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center mb-4">
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg border border-red-200">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions (always visible) */}
      {messages.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s)}
              disabled={loading}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-full border border-gray-200 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('assistant.placeholder')}
          rows={1}
          disabled={loading}
          className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
          style={{ maxHeight: '120px' }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white rounded-xl px-5 py-3 font-medium text-sm hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {t('assistant.send')}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}