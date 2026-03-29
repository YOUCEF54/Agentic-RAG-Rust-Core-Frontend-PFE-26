import { useMemo, useState } from 'react';
import engineApi from '../../services/engineApi';
import Button from '../UI/Button';
import FileUpload from '../Chat/FileUpload';
import MessageList from '../Chat/MessageList';
import type { ChatMessage } from '../../types/agent.types';

interface EngineWorkspaceProps {
  onBack: () => void;
}

const EngineWorkspace = ({ onBack }: EngineWorkspaceProps) => {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [rebuild, setRebuild] = useState(true);
  const [maxPages, setMaxPages] = useState('');
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexResult, setIndexResult] = useState<string | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [topK, setTopK] = useState(3);
  const [useLlm, setUseLlm] = useState(true);
  const [chatModel, setChatModel] = useState('openrouter/free');
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState<Record<string, unknown> | null>(null);
  const [queryRaw, setQueryRaw] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [autoIndex, setAutoIndex] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [engineMessages, setEngineMessages] = useState<ChatMessage[]>([]);

  const derivedMessages = useMemo(() => {
    if (!queryResult) {
      return engineMessages;
    }
    return engineMessages;
  }, [engineMessages, queryResult]);

  const handleUpload = async () => {
    if (!pendingFiles.length) {
      return;
    }
    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadResult(null);
      const formData = new FormData();
      pendingFiles.forEach((file) => formData.append('files', file));
      const response = await engineApi.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResult(JSON.stringify(response.data, null, 2));
      setPendingFiles([]);
      if (autoIndex) {
        await handleIndex();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload documents.';
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleIndex = async () => {
    try {
      setIsIndexing(true);
      setIndexError(null);
      setIndexResult(null);
      const payload = {
        rebuild,
        max_pages: maxPages.trim() ? Number(maxPages) : null
      };
      const response = await engineApi.post('/index', payload);
      setIndexResult(JSON.stringify(response.data, null, 2));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run indexing.';
      setIndexError(message);
    } finally {
      setIsIndexing(false);
    }
  };

  const formatAnswer = (payload: Record<string, unknown>) => {
    const answer = typeof payload.answer === 'string' ? payload.answer.trim() : '';
    const retrieved = Array.isArray(payload.retrieved) ? payload.retrieved : [];
    if (!retrieved.length) {
      return answer || 'No answer returned.';
    }
    const sources = retrieved
      .slice(0, 4)
      .map((item, index) => {
        const entry = item as { text?: string; distance?: number };
        const snippet = (entry.text || '').replace(/\s+/g, ' ').slice(0, 180);
        const distance =
          typeof entry.distance === 'number' ? ` (distance ${entry.distance.toFixed(3)})` : '';
        return `- ${snippet}${snippet.length === 180 ? '…' : ''}${distance}`;
      })
      .join('\n');
    return `${answer}\n\n**Sources**\n${sources}`;
  };

  const handleQuery = async () => {
    if (!question.trim()) {
      return;
    }
    try {
      setIsQuerying(true);
      setQueryError(null);
      setQueryResult(null);
      setQueryRaw(null);
      setEngineMessages((prev) => [...prev, { role: 'user', content: question.trim() }]);
      const payload = {
        question: question.trim(),
        top_k: topK,
        use_llm: useLlm,
        chat_model: chatModel.trim()
      };
      const response = await engineApi.post('/query', payload);
      const data = response.data as Record<string, unknown>;
      setQueryResult(data);
      setQueryRaw(JSON.stringify(data, null, 2));
      setEngineMessages((prev) => [
        ...prev,
        { role: 'agent', content: formatAnswer(data) }
      ]);
      setQuestion('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to query the engine.';
      setQueryError(message);
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="engine-shell">
      <header className="engine-header">
        <div>
          <h1>Python/Rust RAG Engine</h1>
          <p>Chat with your custom pipeline and attach documents on demand.</p>
        </div>
        <Button className="ghost-button" onClick={onBack}>
          Back to Router
        </Button>
      </header>

      <section className="engine-chat-shell">
        <MessageList messages={derivedMessages} isLoading={isQuerying} />

        {showUpload ? (
          <div className="engine-upload-panel">
            <div className="engine-upload-header">
              <strong>Attach documents</strong>
              <Button className="ghost-button" onClick={() => setShowUpload(false)}>
                Close
              </Button>
            </div>
            <FileUpload files={pendingFiles} onFilesChange={setPendingFiles} />
            <label className="field-label">
              <input
                type="checkbox"
                checked={autoIndex}
                onChange={(event) => setAutoIndex(event.target.checked)}
              />
              Auto-run indexing after upload
            </label>
            <Button onClick={handleUpload} disabled={isUploading || !pendingFiles.length}>
              {isUploading ? 'Uploading...' : 'Upload files'}
            </Button>
            {uploadError ? <p className="error-banner">{uploadError}</p> : null}
            {uploadResult ? <pre className="engine-output">{uploadResult}</pre> : null}
            <div className="engine-advanced-toggle">
              <Button
                className="ghost-button"
                onClick={() => setShowAdvanced((prev) => !prev)}
              >
                {showAdvanced ? 'Hide Indexing' : 'Show Indexing'}
              </Button>
            </div>
            {showAdvanced ? (
              <div className="engine-advanced-body">
                <label className="field-label">
                  <input
                    type="checkbox"
                    checked={rebuild}
                    onChange={(event) => setRebuild(event.target.checked)}
                  />
                  Rebuild index from scratch
                </label>
                <label className="field-label" htmlFor="max-pages-input">
                  Max pages (optional)
                </label>
                <input
                  id="max-pages-input"
                  className="text-input"
                  placeholder="Leave empty for full crawl"
                  value={maxPages}
                  onChange={(event) => setMaxPages(event.target.value)}
                />
                <Button onClick={handleIndex} disabled={isIndexing}>
                  {isIndexing ? 'Indexing...' : 'Run indexing'}
                </Button>
                {indexError ? <p className="error-banner">{indexError}</p> : null}
                {indexResult ? <pre className="engine-output">{indexResult}</pre> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="engine-input-area">
          <button
            type="button"
            className="engine-attach"
            onClick={() => setShowUpload((prev) => !prev)}
            aria-label="Attach documents"
          >
            +
          </button>
          <textarea
            placeholder="Ask your engine..."
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <Button onClick={handleQuery} disabled={isQuerying || !question.trim()}>
            Send
          </Button>
        </div>
        {queryError ? <p className="error-banner">{queryError}</p> : null}
      </section>
    </div>
  );
};

export default EngineWorkspace;
