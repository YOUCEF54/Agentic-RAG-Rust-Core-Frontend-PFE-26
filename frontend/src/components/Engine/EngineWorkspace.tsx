import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useDropzone } from 'react-dropzone';
import engineApi from '../../services/engineApi';
import Button from '../UI/Button';

interface EngineWorkspaceProps {
  onBack: () => void;
}

interface EngineDocument {
  filename: string;
  size_bytes: number;
  uploaded_at?: string;
  updated_at?: string;
  sha256?: string;
  pages?: number | null;
}

interface IndexStatusInfo {
  last_build_at?: string;
  last_build_ms?: number;
  pages?: number;
  chunks?: number;
  chunking?: string;
  embed_batch_size?: number;
  hardware_config_mtime?: number | null;
  last_error?: string | null;
}

interface IndexStatus {
  status: string;
  ready: boolean;
  info?: IndexStatusInfo;
}

interface HardwareCalibrationSummary {
  optimal_batch_size?: number;
  throughput_measured?: number;
  calibration_date?: string;
  cpu_info?: string;
  tested_batch_sizes?: number[];
  stop_reason?: string;
}

interface IndexBuildRequest {
  rebuild: boolean;
  max_pages: number | null;
  run_hardware_test?: boolean;
  save_hardware_config?: boolean;
  hardware_quick_test?: boolean;
  hardware_max_runtime_seconds?: number;
}

interface IndexBuildResponse {
  status?: string;
  ready?: boolean;
  info?: IndexStatusInfo;
  chunking?: string;
  embed_batch_size?: number;
  hardware_config_mtime?: number | null;
  hardware_calibration?: HardwareCalibrationSummary;
}

interface HardwareConfigResponse {
  active_embed_batch_size?: number;
  embed_batch_size?: number;
  config_path?: string;
  hardware_config_mtime?: number | null;
  config?: HardwareCalibrationSummary | Record<string, unknown> | null;
  hardware_config?: HardwareCalibrationSummary | Record<string, unknown> | null;
}

interface HealthStatus {
  chunking?: string;
  embed_batch_size?: number;
  hardware_config_mtime?: number | null;
}

interface RetrievedChunk {
  text?: string;
  distance?: number;
  source?: string;
  page?: number;
}

interface TraceEvent {
  agent: string;
  message: string;
  data?: Record<string, unknown>;
}

interface EngineEvaluation {
  score?: number;
  summary?: string;
  should_retry?: boolean;
  attempts?: number;
}

interface EngineChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  status?: 'streaming' | 'done' | 'error';
  modelUsed?: string;
  models?: Record<string, string>;
  trace?: TraceEvent[];
  retrieved?: RetrievedChunk[];
  evaluation?: EngineEvaluation;
  refinedQuery?: string;
  score?: number;
  attempts?: number;
  mode?: string;
}

const MAX_TRACE_FIELDS = 4;
const MAX_SOURCE_CHUNKS = 6;

const AGENT_STEPS = [
  { key: 'QueryRefiner', label: 'Refining' },
  { key: 'Retriever', label: 'Searching' },
  { key: 'Selector', label: 'Filtering' },
  { key: 'Generator', label: 'Drafting' },
  { key: 'Evaluator', label: 'Verifying' }
];

const getActiveStepIndex = (message: EngineChatMessage) => {
  if (message.status === 'done') return AGENT_STEPS.length;
  if (!message.trace || message.trace.length === 0) return 0;
  const lastTrace = message.trace[message.trace.length - 1];
  const stepIndex = AGENT_STEPS.findIndex(step => step.key === lastTrace.agent);
  return stepIndex !== -1 ? stepIndex : 0;
};

const EngineWorkspace = ({ onBack }: EngineWorkspaceProps) => {
  const [documents, setDocuments] = useState<EngineDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [autoRebuild, setAutoRebuild] = useState(true);
  const [localPendingReindex, setLocalPendingReindex] = useState(false);
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [rebuildFromScratch, setRebuildFromScratch] = useState(true);
  const [maxPages, setMaxPages] = useState('');
  const [runHardwareTest, setRunHardwareTest] = useState(false);
  const [saveHardwareConfig, setSaveHardwareConfig] = useState(true);
  const [hardwareQuickTest, setHardwareQuickTest] = useState(true);
  const [latestIndexBuild, setLatestIndexBuild] = useState<IndexBuildResponse | null>(null);
  const [hardwareConfig, setHardwareConfig] = useState<HardwareConfigResponse | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [lastCalibration, setLastCalibration] = useState<HardwareCalibrationSummary | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [hardwareError, setHardwareError] = useState<string | null>(null);

  const [messages, setMessages] = useState<EngineChatMessage[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [topK, setTopK] = useState(3);
  const [minScore, setMinScore] = useState(0.7);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [mode, setMode] = useState<'agentic' | 'naive' | 'retrieval_only'>('agentic');
  const [isQuerying, setIsQuerying] = useState(false);
  const [streamState, setStreamState] = useState('idle');
  const [queryError, setQueryError] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const baseUrl = useMemo(() => {
    const rawBase = engineApi.defaults.baseURL || 'http://localhost:8000';
    return rawBase.replace(/\/$/, '');
  }, []);

  const loadDocuments = async () => {
    try {
      setIsLoadingDocs(true);
      setDocsError(null);
      const response = await engineApi.get('/documents');
      const payload = response.data as { documents?: EngineDocument[] };
      setDocuments(payload.documents || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load documents.';
      setDocsError(message);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const loadIndexStatus = async () => {
    try {
      const response = await engineApi.get('/index/status');
      const payload = response.data as IndexStatus;
      setIndexStatus(payload);
      setIndexError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load index status.';
      setIndexError(message);
    }
  };

  const loadHardwareConfig = async () => {
    try {
      const response = await engineApi.get('/hardware/config');
      const payload = response.data as HardwareConfigResponse;
      setHardwareConfig(payload);
      const configCalibration = normalizeCalibration(payload.config || payload.hardware_config);
      if (configCalibration) {
        setLastCalibration(configCalibration);
      }
      setHardwareError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load hardware config.';
      setHardwareError(message);
    }
  };

  const loadHealthStatus = async () => {
    try {
      const response = await engineApi.get('/health');
      const payload = response.data as HealthStatus;
      setHealthStatus(payload);
    } catch {
      // Health diagnostics are optional in UI; ignore endpoint failures.
    }
  };

  useEffect(() => {
    loadDocuments();
    loadIndexStatus();
    loadHardwareConfig();
    loadHealthStatus();
    const timer = window.setInterval(loadIndexStatus, 20000);
    return () => window.clearInterval(timer);
  }, []);



  const createId = () => `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const updateMessage = (id: string, updater: (message: EngineChatMessage) => EngineChatMessage) => {
    setMessages((prev) => prev.map((message) => (message.id === id ? updater(message) : message)));
  };

  const formatBytes = (value?: number) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '0 B';
    }
    if (value < 1024) {
      return `${value} B`;
    }
    const kb = value / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (value?: string) => {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };

  const formatMtime = (value?: number | null) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '-';
    }
    const milliseconds = value > 1_000_000_000_000 ? value : value * 1000;
    return formatDate(new Date(milliseconds).toISOString());
  };

  const normalizeCalibration = (value: unknown): HardwareCalibrationSummary | null => {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const record = value as Record<string, unknown>;
    const calibration: HardwareCalibrationSummary = {};
    if (typeof record.optimal_batch_size === 'number') {
      calibration.optimal_batch_size = record.optimal_batch_size;
    }
    if (typeof record.throughput_measured === 'number') {
      calibration.throughput_measured = record.throughput_measured;
    }
    if (typeof record.calibration_date === 'string') {
      calibration.calibration_date = record.calibration_date;
    }
    if (typeof record.cpu_info === 'string') {
      calibration.cpu_info = record.cpu_info;
    }
    if (Array.isArray(record.tested_batch_sizes)) {
      calibration.tested_batch_sizes = record.tested_batch_sizes.filter(
        (value): value is number => typeof value === 'number'
      );
    }
    if (typeof record.stop_reason === 'string') {
      calibration.stop_reason = record.stop_reason;
    }
    return Object.keys(calibration).length ? calibration : null;
  };

  const formatTraceValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return '-';
    }
    if (typeof value === 'string') {
      const trimmed = value.replace(/\s+/g, ' ').trim();
      return trimmed.length > 140 ? `${trimmed.slice(0, 140)}...` : trimmed;
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (Array.isArray(value)) {
      return `${value.length} items`;
    }
    if (typeof value === 'object') {
      return 'Object';
    }
    return String(value);
  };

  const mergeRetrieved = (current: RetrievedChunk[] = [], incoming: RetrievedChunk[] = []) => {
    const seen = new Set(current.map((item) => `${item.source || ''}-${item.page || 0}-${item.text || ''}`));
    const next = [...current];
    incoming.forEach((item) => {
      const key = `${item.source || ''}-${item.page || 0}-${item.text || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        next.push(item);
      }
    });
    return next;
  };

  const handleUpload = async () => {
    if (!pendingFiles.length) {
      return;
    }
    try {
      setIsUploading(true);
      setUploadError(null);
      const formData = new FormData();
      pendingFiles.forEach((file) => formData.append('files', file));
      const response = await engineApi.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const payload = response.data as { needs_reindex?: boolean };
      setPendingFiles([]);
      await loadDocuments();
      if (payload.needs_reindex) {
        if (autoRebuild) {
          await handleIndex();
        } else {
          setLocalPendingReindex(true);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload PDFs.';
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    const confirmed = window.confirm(`Delete ${filename}? This will remove related chunks.`);
    if (!confirmed) {
      return;
    }
    try {
      setDocsError(null);
      await engineApi.delete(`/documents/${encodeURIComponent(filename)}`, {
        params: { rebuild_index: autoRebuild }
      });
      await loadDocuments();
      if (autoRebuild) {
        await loadIndexStatus();
      } else {
        setLocalPendingReindex(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete document.';
      setDocsError(message);
    }
  };

  const handleIndex = async () => {
    try {
      setIsIndexing(true);
      setIndexError(null);
      const payload: IndexBuildRequest = {
        rebuild: rebuildFromScratch,
        max_pages: maxPages.trim() ? Number(maxPages) : null,
        run_hardware_test: runHardwareTest,
        save_hardware_config: saveHardwareConfig,
        hardware_quick_test: hardwareQuickTest,
        hardware_max_runtime_seconds: 25
      };
      const response = await engineApi.post('/index', payload);
      const result = response.data as IndexBuildResponse;
      setLatestIndexBuild(result);
      if (result.hardware_calibration) {
        setLastCalibration(result.hardware_calibration);
      }
      await loadIndexStatus();
      await loadHardwareConfig();
      await loadHealthStatus();
      setLocalPendingReindex(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run indexing.';
      setIndexError(message);
    } finally {
      setIsIndexing(false);
    }
  };

  const handleCalibrateNow = async () => {
    try {
      setIsCalibrating(true);
      setHardwareError(null);
      const response = await engineApi.post('/hardware/calibrate', {
        save_config: saveHardwareConfig,
        quick_mode: hardwareQuickTest,
        max_runtime_seconds: 25
      });
      const payload = response.data as Record<string, unknown>;
      const directCalibration = normalizeCalibration(payload);
      const nestedCalibration =
        normalizeCalibration(payload.hardware_calibration) || normalizeCalibration(payload.config);
      const calibration = directCalibration || nestedCalibration;
      if (calibration) {
        setLastCalibration(calibration);
      }
      if (typeof payload.embed_batch_size === 'number' || typeof payload.active_embed_batch_size === 'number') {
        setLatestIndexBuild((prev) => ({
          ...(prev || {}),
          embed_batch_size:
            typeof payload.embed_batch_size === 'number'
              ? payload.embed_batch_size
              : (payload.active_embed_batch_size as number)
        }));
      }
      await loadHardwareConfig();
      await loadIndexStatus();
      await loadHealthStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run hardware calibration.';
      setHardwareError(message);
    } finally {
      setIsCalibrating(false);
    }
  };
  const handleStreamEvent = (
    runId: string,
    event: string,
    payload: Record<string, unknown>
  ) => {
    if (event === 'status') {
      const state = typeof payload.state === 'string' ? payload.state : 'running';
      setStreamState(state);
      return;
    }

    if (event === 'trace') {
      const nextTrace: TraceEvent = {
        agent: typeof payload.agent === 'string' ? payload.agent : 'agent',
        message: typeof payload.message === 'string' ? payload.message : '',
        data:
          payload.data && typeof payload.data === 'object'
            ? (payload.data as Record<string, unknown>)
            : undefined
      };
      updateMessage(runId, (message) => ({
        ...message,
        trace: [...(message.trace || []), nextTrace],
        status: 'streaming'
      }));
      return;
    }

    if (event === 'retrieved') {
      const incoming = Array.isArray(payload.items) ? (payload.items as RetrievedChunk[]) : [];
      updateMessage(runId, (message) => ({
        ...message,
        retrieved: mergeRetrieved(message.retrieved, incoming)
      }));
      return;
    }

    if (event === 'answer') {
      updateMessage(runId, (message) => ({
        ...message,
        content: typeof payload.answer === 'string' ? payload.answer : message.content,
        modelUsed: typeof payload.model_used === 'string' ? payload.model_used : message.modelUsed,
        status: 'streaming'
      }));
      return;
    }

    if (event === 'evaluation') {
      updateMessage(runId, (message) => ({
        ...message,
        evaluation: payload as EngineEvaluation,
        score: typeof payload.score === 'number' ? payload.score : message.score,
        attempts: typeof payload.attempts === 'number' ? payload.attempts : message.attempts
      }));
      return;
    }

    if (event === 'retry') {
      updateMessage(runId, (message) => ({
        ...message,
        attempts: typeof payload.attempts === 'number' ? payload.attempts : message.attempts
      }));
      return;
    }

    if (event === 'final') {
      const finalPayload = payload as Record<string, unknown>;
      updateMessage(runId, (message) => ({
        ...message,
        content:
          typeof finalPayload.answer === 'string' ? finalPayload.answer : message.content,
        modelUsed:
          typeof finalPayload.model_used === 'string' ? finalPayload.model_used : message.modelUsed,
        retrieved: Array.isArray(finalPayload.retrieved)
          ? (finalPayload.retrieved as RetrievedChunk[])
          : message.retrieved,
        trace: Array.isArray(finalPayload.trace)
          ? (finalPayload.trace as TraceEvent[])
          : message.trace,
        models:
          typeof finalPayload.models === 'object' && finalPayload.models
            ? (finalPayload.models as Record<string, string>)
            : message.models,
        refinedQuery:
          typeof finalPayload.refined_query === 'string'
            ? finalPayload.refined_query
            : message.refinedQuery,
        score: typeof finalPayload.score === 'number' ? finalPayload.score : message.score,
        attempts:
          typeof finalPayload.attempts === 'number' ? finalPayload.attempts : message.attempts,
        mode: typeof finalPayload.mode === 'string' ? finalPayload.mode : message.mode,
        status: 'done'
      }));
      setStreamState('complete');
    }
  };

  const parseStream = async (response: Response, runId: string) => {
    if (!response.body) {
      throw new Error('Streaming response unavailable.');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventName = '';
    let dataLines: string[] = [];

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      let boundaryIndex = buffer.indexOf('\n');
      while (boundaryIndex >= 0) {
        const line = buffer.slice(0, boundaryIndex).replace(/\r$/, '');
        buffer = buffer.slice(boundaryIndex + 1);

        if (!line) {
          if (dataLines.length) {
            const data = dataLines.join('\n');
            try {
              const payload = JSON.parse(data) as Record<string, unknown>;
              handleStreamEvent(runId, eventName || 'message', payload);
            } catch (err) {
              console.warn('Unable to parse SSE payload', err);
            }
          }
          eventName = '';
          dataLines = [];
        } else if (line.startsWith('event:')) {
          eventName = line.replace('event:', '').trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.replace('data:', '').trim());
        }
        boundaryIndex = buffer.indexOf('\n');
      }
    }

    if (dataLines.length) {
      try {
        const payload = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
        handleStreamEvent(runId, eventName || 'message', payload);
      } catch (err) {
        console.warn('Unable to parse SSE payload', err);
      }
    }
  };

  const handleQuery = async () => {
    if (!question.trim()) {
      return;
    }
    if (needsReindex) {
      setQueryError(
        localPendingReindex
          ? 'Documents changed since the last build. Rebuild the index before querying.'
          : 'Index is still building. Wait until it is ready before querying.'
      );
      return;
    }
    const runId = createId();
    const timestamp = new Date().toISOString();
    const trimmedQuestion = question.trim();
    const userMessage: EngineChatMessage = {
      id: `${runId}-user`,
      role: 'user',
      content: trimmedQuestion,
      createdAt: timestamp
    };
    const agentMessage: EngineChatMessage = {
      id: runId,
      role: 'assistant',
      content: '',
      createdAt: timestamp,
      status: 'streaming',
      trace: [],
      retrieved: []
    };

    setMessages((prev) => [...prev, userMessage, agentMessage]);
    setSelectedRunId(runId);
    setQuestion('');
    setQueryError(null);
    setIsQuerying(true);
    setStreamState('starting');

    const payload = {
      question: trimmedQuestion,
      top_k: topK,
      mode,
      return_trace: true,
      min_score: minScore,
      max_attempts: maxAttempts
    };

    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch(`${baseUrl}/query/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`Streaming failed (${response.status}).`);
      }
      await parseStream(response, runId);
    } catch (err) {
      try {
        const response = await engineApi.post('/query', payload);
        const data = response.data as Record<string, unknown>;
        updateMessage(runId, (message) => ({
          ...message,
          content: typeof data.answer === 'string' ? data.answer : message.content,
          modelUsed: typeof data.model_used === 'string' ? data.model_used : message.modelUsed,
          retrieved: Array.isArray(data.retrieved)
            ? (data.retrieved as RetrievedChunk[])
            : message.retrieved,
          trace: Array.isArray(data.trace) ? (data.trace as TraceEvent[]) : message.trace,
          models:
            typeof data.models === 'object' && data.models
              ? (data.models as Record<string, string>)
              : message.models,
          refinedQuery:
            typeof data.refined_query === 'string' ? data.refined_query : message.refinedQuery,
          score: typeof data.score === 'number' ? data.score : message.score,
          attempts: typeof data.attempts === 'number' ? data.attempts : message.attempts,
          mode: typeof data.mode === 'string' ? data.mode : message.mode,
          status: 'done'
        }));
      } catch (innerErr) {
        const message = innerErr instanceof Error ? innerErr.message : 'Query failed.';
        setQueryError(message);
        updateMessage(runId, (msg) => ({
          ...msg,
          content: 'Unable to complete the request.',
          status: 'error'
        }));
      }
    } finally {
      setIsQuerying(false);
      setStreamState('idle');
    }
  };

  const selectedRun = useMemo(() => {
    if (!messages.length) {
      return null;
    }
    const runs = messages.filter((message) => message.role === 'assistant');
    const selected = runs.find((message) => message.id === selectedRunId);
    return selected || runs[runs.length - 1] || null;
  }, [messages, selectedRunId]);

  const traceItems = selectedRun?.trace || [];
  const retrievedItems = (selectedRun?.retrieved || []).slice(0, MAX_SOURCE_CHUNKS);
  const showTraceEmpty = !traceItems.length && !isQuerying;
  const needsReindex = localPendingReindex || indexStatus?.ready === false;
  const indexUiState =
    indexStatus?.ready === true ? (localPendingReindex ? 'stale' : 'ready') : 'pending';
  const indexHeaderLabel =
    indexUiState === 'ready'
      ? 'Index Ready'
      : indexUiState === 'stale'
        ? 'Index Stale'
        : 'Index Pending';
  const indexPanelLabel =
    indexUiState === 'ready' ? 'Ready' : indexUiState === 'stale' ? 'Stale' : 'Needs build';
  const chunkingMode =
    indexStatus?.info?.chunking || latestIndexBuild?.chunking || healthStatus?.chunking || '-';
  const activeEmbedBatchSize =
    indexStatus?.info?.embed_batch_size ??
    latestIndexBuild?.embed_batch_size ??
    healthStatus?.embed_batch_size ??
    hardwareConfig?.active_embed_batch_size ??
    hardwareConfig?.embed_batch_size;
  const hardwareConfigMtime =
    indexStatus?.info?.hardware_config_mtime ??
    latestIndexBuild?.hardware_config_mtime ??
    healthStatus?.hardware_config_mtime ??
    hardwareConfig?.hardware_config_mtime ??
    null;
  const storedCalibration = normalizeCalibration(hardwareConfig?.config || hardwareConfig?.hardware_config);
  const calibrationSummary =
    latestIndexBuild?.hardware_calibration || lastCalibration || storedCalibration;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setPendingFiles((prev) => [...prev, ...acceptedFiles]);
    },
    accept: { 'application/pdf': ['.pdf'] }
  });

  const canSend =
    question.trim().length > 0 && !isQuerying && !needsReindex && indexStatus?.ready !== false;
  return (
    <div className="engine-shell">
      <header className="engine-header">
        <div>
          <p className="engine-eyebrow">Agentic RAG Console</p>
          {/* <h1>Query, trace, and refine answers in real time.</h1> */}
          <h1>PFE 2026</h1>
        </div>
        <div className="engine-header-actions">
          <div className="engine-status-pill">
            <span
              className={
                indexUiState === 'ready'
                  ? 'status-ready'
                  : indexUiState === 'stale'
                    ? 'status-stale'
                    : 'status-pending'
              }
            />
            {indexHeaderLabel}
          </div>
          <Button className="ghost-button" onClick={onBack}>
            Back to Router
          </Button>
        </div>
      </header>

      <div className="engine-body">
        <aside className="engine-knowledge-panel">
          <div className="engine-panel">
            <div className="engine-panel-header">
              <h3>Query Settings</h3>
            </div>
            <div className="engine-panel-body">
              <label className="engine-field">
                Mode
                <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
                  <option value="agentic">Agentic</option>
                  <option value="naive">Naive</option>
                  <option value="retrieval_only">Retrieval only</option>
                </select>
              </label>
              <label className="engine-field">
                Top K
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={topK}
                  onChange={(event) => setTopK(Number(event.target.value))}
                />
              </label>
              {mode === 'agentic' ? (
                <>
                  <label className="engine-field">
                    Min Score Target
                    <input
                      type="number"
                      step={0.05}
                      min={0}
                      max={1}
                      value={minScore}
                      onChange={(event) => setMinScore(Number(event.target.value))}
                    />
                  </label>
                  <label className="engine-field">
                    Max Retries
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={maxAttempts}
                      onChange={(event) => setMaxAttempts(Number(event.target.value))}
                    />
                  </label>
                </>
              ) : null}
            </div>
          </div>
          <div className="engine-panel">
            <div className="engine-panel-header">
              <h3>Index Status</h3>
              <span
                className={
                  indexUiState === 'ready'
                    ? 'engine-pill ready'
                    : indexUiState === 'stale'
                      ? 'engine-pill stale'
                      : 'engine-pill pending'
                }
              >
                {indexPanelLabel}
              </span>
            </div>
            <div className="engine-panel-body">
              <div className="engine-kv">
                <span>Last build</span>
                <strong>{formatDate(indexStatus?.info?.last_build_at)}</strong>
              </div>
              <div className="engine-kv">
                <span>Pages indexed</span>
                <strong>{indexStatus?.info?.pages ?? '-'}</strong>
              </div>
              <div className="engine-kv">
                <span>Chunks</span>
                <strong>{indexStatus?.info?.chunks ?? '-'}</strong>
              </div>
              <div className="engine-kv">
                <span>Chunking mode</span>
                <strong>{chunkingMode}</strong>
              </div>
              <div className="engine-kv">
                <span>Embed batch size</span>
                <strong>{activeEmbedBatchSize ?? '-'}</strong>
              </div>
              <div className="engine-kv">
                <span>Hardware config updated</span>
                <strong>{formatMtime(hardwareConfigMtime)}</strong>
              </div>
              {indexStatus?.info?.last_error ? (
                <p className="error-banner">{indexStatus.info.last_error}</p>
              ) : null}
              <div className="engine-divider" />
              <label className="engine-toggle">
                <input
                  type="checkbox"
                  checked={autoRebuild}
                  onChange={(event) => setAutoRebuild(event.target.checked)}
                />
                <span className="slider"></span>
                <span className="label-text">Auto rebuild after changes</span>
              </label>
              <label className="engine-toggle">
                <input
                  type="checkbox"
                  checked={rebuildFromScratch}
                  onChange={(event) => setRebuildFromScratch(event.target.checked)}
                />
                <span className="slider"></span>
                <span className="label-text">Rebuild from scratch</span>
              </label>
              <label className="engine-field">
                Max pages
                <input
                  type="number"
                  min={1}
                  placeholder="All"
                  value={maxPages}
                  onChange={(event) => setMaxPages(event.target.value)}
                />
              </label>
              <Button onClick={handleIndex} disabled={isIndexing}>
                {isIndexing ? 'Indexing...' : 'Build index'}
              </Button>
              {indexError ? <p className="error-banner">{indexError}</p> : null}
            </div>
          </div>

          <div className="engine-panel">
            <div className="engine-panel-header">
              <h3>Hardware Calibration</h3>
              <span className="engine-pill">Optional</span>
            </div>
            <div className="engine-panel-body">
              <p className="engine-hardware-note">
                Run the hardware test manually to tune embedding throughput. This does not start indexing.
              </p>
              <label className="engine-toggle">
                <input
                  type="checkbox"
                  checked={runHardwareTest}
                  onChange={(event) => setRunHardwareTest(event.target.checked)}
                />
                <span className="slider"></span>
                <span className="label-text">Run hardware calibration before indexing</span>
              </label>
              <label className="engine-toggle">
                <input
                  type="checkbox"
                  checked={saveHardwareConfig}
                  onChange={(event) => setSaveHardwareConfig(event.target.checked)}
                />
                <span className="slider"></span>
                <span className="label-text">Save calibration result</span>
              </label>
              <label className="engine-toggle">
                <input
                  type="checkbox"
                  checked={hardwareQuickTest}
                  onChange={(event) => setHardwareQuickTest(event.target.checked)}
                />
                <span className="slider"></span>
                <span className="label-text">Quick test mode</span>
              </label>
              <Button
                className={`engine-calibrate-button ${isCalibrating ? 'is-running' : ''}`}
                onClick={handleCalibrateNow}
                disabled={isCalibrating || isIndexing}
              >
                <span className="engine-calibrate-label">
                  {isCalibrating ? <span className="engine-inline-loader" aria-hidden="true" /> : null}
                  <span>{isCalibrating ? 'Running hardware test...' : 'Run hardware test'}</span>
                </span>
              </Button>
              <div className="engine-divider" />
              <div className="engine-kv">
                <span>Config path</span>
                <strong className="engine-mono">{hardwareConfig?.config_path || '-'}</strong>
              </div>
              {calibrationSummary ? (
                <>
                  <div className="engine-kv">
                    <span>Calibrated batch</span>
                    <strong>{calibrationSummary.optimal_batch_size ?? '-'}</strong>
                  </div>
                  <div className="engine-kv">
                    <span>Throughput</span>
                    <strong>
                      {typeof calibrationSummary.throughput_measured === 'number'
                        ? calibrationSummary.throughput_measured.toFixed(2)
                        : '-'}
                    </strong>
                  </div>
                  <div className="engine-kv">
                    <span>Calibration date</span>
                    <strong>{formatDate(calibrationSummary.calibration_date)}</strong>
                  </div>
                  {calibrationSummary.tested_batch_sizes?.length ? (
                    <div className="engine-kv">
                      <span>Tested batches</span>
                      <strong className="engine-mono">
                        {calibrationSummary.tested_batch_sizes.join(', ')}
                      </strong>
                    </div>
                  ) : null}
                  {calibrationSummary.stop_reason ? (
                    <div className="engine-kv">
                      <span>Stop reason</span>
                      <strong className="engine-mono">{calibrationSummary.stop_reason}</strong>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="engine-hardware-note">No calibration data available yet.</p>
              )}
              {calibrationSummary?.cpu_info ? (
                <div className="engine-kv">
                  <span>CPU profile</span>
                  <strong className="engine-mono">{calibrationSummary.cpu_info}</strong>
                </div>
              ) : null}
              {hardwareError ? <p className="error-banner">{hardwareError}</p> : null}
            </div>
          </div>

          <div className="engine-panel">
            <div className="engine-panel-header">
              <h3>Knowledge Base</h3>
              <span className="engine-pill">{documents.length} PDFs</span>
            </div>
            <div className="engine-panel-body">
              <div className="engine-upload-zone" {...getRootProps()}>
                <input {...getInputProps()} />
                <p>{isDragActive ? 'Drop PDFs to upload' : 'Drag & drop PDFs here'}</p>
              </div>
              {pendingFiles.length ? (
                <div className="engine-file-list">
                  {pendingFiles.map((file) => (
                    <span key={file.name} className="engine-tag">
                      {file.name}
                    </span>
                  ))}
                </div>
              ) : null}
              <Button onClick={handleUpload} disabled={isUploading || !pendingFiles.length}>
                {isUploading ? 'Uploading...' : 'Upload PDFs'}
              </Button>
              {uploadError ? <p className="error-banner">{uploadError}</p> : null}
              {docsError ? <p className="error-banner">{docsError}</p> : null}

              {isLoadingDocs ? (
                <div className="engine-empty">
                  <p>Loading documents...</p>
                </div>
              ) : documents.length ? (
                <div className="engine-doc-list">
                  {documents.map((doc) => (
                    <div key={doc.filename} className="engine-doc-row">
                      <div>
                        <div className="engine-doc-name">{doc.filename}</div>
                        <div className="engine-doc-meta">
                          <span>{formatBytes(doc.size_bytes)}</span>
                          <span>Uploaded {formatDate(doc.uploaded_at)}</span>
                          <span>Updated {formatDate(doc.updated_at)}</span>
                          {doc.pages ? <span>{doc.pages} pages</span> : null}
                        </div>
                      </div>
                      <Button className="danger" onClick={() => handleDelete(doc.filename)}>
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="engine-empty">
                  <p>No PDFs uploaded yet.</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="engine-chat-panel">
          <div className="engine-chat-header">
            <div>
              <h2>Agent Chat</h2>
              <p>
                {streamState === 'starting'
                  ? 'Connecting to the engine...'
                  : 'Ask a question and watch the agent pipeline run.'}
              </p>
            </div>
            <div className="engine-chat-status">
              <span className="engine-live">Live</span>
              <span className="engine-stream">{isQuerying ? 'Streaming' : 'Idle'}</span>
            </div>
          </div>

          <div className="engine-message-list">
            {messages.length ? (
              messages.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  className={`engine-message ${message.role} ${
                    message.id === selectedRunId ? 'selected' : ''
                  }`}
                  onClick={() => {
                    if (message.role === 'assistant') {
                      setSelectedRunId(message.id);
                    }
                  }}
                >
                  <div className="engine-message-bubble">
                    {message.role === 'assistant' ? (
                      <>
                        <div className="engine-message-meta">
                          <span className="engine-role">Agent</span>
                          {message.status === 'streaming' ? (
                            <span className="engine-tag">Thinking...</span>
                          ) : null}
                          {message.modelUsed ? (
                            <span className="engine-tag">Model: {message.modelUsed}</span>
                          ) : null}
                          {message.models
                            ? Object.entries(message.models).map(([key, value]) => (
                                <span key={`${message.id}-${key}`} className="engine-tag">
                                  {key}: {value}
                                </span>
                              ))
                            : null}
                        </div>

                        {message.status === 'streaming' || message.trace?.length ? (
                          <div className="agent-progress-bar">
                            {AGENT_STEPS.map((step, idx) => {
                              const stepIndex = getActiveStepIndex(message);
                              const isActive = idx === stepIndex && message.status === 'streaming';
                              const isCompleted = idx < stepIndex || message.status === 'done';
                              return (
                                <div key={step.key} className={`agent-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                                  <div className="step-indicator">
                                    {isCompleted ? '✓' : (isActive ? <span className="step-spinner" /> : idx + 1)}
                                  </div>
                                  <span className="step-label">{step.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

                        {message.attempts && message.attempts > 1 ? (
                          <div className="agent-retry-alert">
                            <span className="retry-icon">⚠️</span>
                            <span>Score low ({message.score ? message.score.toFixed(2) : '?'}), refining strategy and retrying... Attempt {message.attempts}</span>
                          </div>
                        ) : null}

                        {message.content ? (
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        ) : (
                          <p className="engine-placeholder">Agent is gathering context...</p>
                        )}
                        {message.trace && message.trace.length > 0 ? (
                          <details className="terminal-trace">
                            <summary>
                              <span className="trace-icon">⚡</span> Agent Terminal Trace
                            </summary>
                            <div className="terminal-trace-content">
                              {message.trace.map((trace, index) => (
                                <div key={`${trace.agent}-${index}`} className="terminal-trace-item">
                                  <div className="terminal-trace-header">
                                    <span className="terminal-trace-agent">[{trace.agent}]</span>
                                    <span className="terminal-trace-message">{trace.message}</span>
                                  </div>
                                  {trace.data && (
                                    <pre className="terminal-trace-data">
                                      {JSON.stringify(trace.data, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}
                        {message.retrieved && message.retrieved.length > 0 ? (
                          <div className="inline-sources">
                            <details>
                              <summary>
                                <span className="source-icon">📚</span> Sources ({message.retrieved.length})
                              </summary>
                              <div className="inline-sources-content">
                                {message.retrieved.map((item, index) => (
                                  <div key={`${item.source || 'source'}-${index}`} className="inline-source-item">
                                    <p className="inline-source-text">"{item.text}"</p>
                                    <div className="inline-source-meta">
                                      <span>{item.source || 'Unknown source'}</span>
                                      <span>Page {item.page ?? '-'}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="engine-empty">
                <p>No chats yet. Ask your first question to get started.</p>
              </div>
            )}
            {isQuerying ? (
              <div className="engine-message assistant">
                <div className="engine-message-bubble">
                  <div className="typing-indicator">
                    <span>Agent is thinking</span>
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="engine-composer">
            {needsReindex ? (
              <div className="engine-alert">
                {localPendingReindex
                  ? 'New document changes are not indexed yet. '
                  : 'Index needs rebuilding before you can query. '}{' '}
                <button type="button" onClick={handleIndex} disabled={isIndexing}>
                  {isIndexing ? 'Rebuilding...' : 'Rebuild now'}
                </button>
              </div>
            ) : null}
            <textarea
              className="engine-textarea"
              placeholder="Ask about your PDFs, policies, or notes..."
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <div className="engine-composer-row">
              <Button className="engine-send-button" onClick={handleQuery} disabled={!canSend}>
                {isQuerying ? 'Running...' : 'Send Query'}
              </Button>
            </div>
            {queryError ? <p className="error-banner">{queryError}</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
};

export default EngineWorkspace;



