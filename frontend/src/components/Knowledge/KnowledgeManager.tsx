import { useEffect, useState } from 'react';
import FileUpload from '../Chat/FileUpload';
import Button from '../UI/Button';
import Spinner from '../UI/Spinner';
import { useFileUpload } from '../../hooks/useFileUpload';
import api from '../../services/api';
import type { KnowledgeDocument, UploadResponse } from '../../types/knowledge.types';

const KnowledgeManager = () => {
  const { uploadFiles } = useFileUpload();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [source, setSource] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/documents');
      setDocuments(response.data.documents as KnowledgeDocument[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load documents.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleUpload = async () => {
    if (!pendingFiles.length) {
      return;
    }
    try {
      setIsUploading(true);
      setError(null);
      const result: UploadResponse = await uploadFiles(
        pendingFiles,
        source.trim() ? source.trim() : undefined
      );
      setPendingFiles([]);
      setSource('');
      if (result.documents?.length) {
        setDocuments((prev) => [...result.documents, ...prev]);
      } else {
        await loadDocuments();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to upload documents.';
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      setDeletingId(documentId);
      setError(null);
      await api.delete(`/documents/${documentId}`);
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to delete document.';
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="knowledge-shell">
      <div className="knowledge-header">
        <div>
          <h2>Knowledge Management</h2>
          <p>Upload sources, track embeddings, and prune stale documents.</p>
        </div>
        <div className="knowledge-status">
          {isLoading ? <Spinner /> : <span>{documents.length} documents</span>}
        </div>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="knowledge-grid">
        <div className="knowledge-card">
          <h3>Ingest Documents</h3>
          <label className="field-label" htmlFor="source-input">
            Source label (optional)
          </label>
          <input
            id="source-input"
            className="text-input"
            placeholder="e.g. Product docs, policies, FAQ"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          />
          <FileUpload files={pendingFiles} onFilesChange={setPendingFiles} />
          <Button
            onClick={handleUpload}
            disabled={isUploading || pendingFiles.length === 0}
          >
            {isUploading ? 'Uploading...' : 'Upload & Embed'}
          </Button>
        </div>
        <div className="knowledge-card">
          <h3>Embedded Documents</h3>
          {isLoading ? (
            <div className="empty-state">
              <Spinner />
              <p>Loading knowledge base...</p>
            </div>
          ) : documents.length ? (
            <div className="document-list">
              {documents.map((doc) => (
                <div key={doc.id} className="document-row">
                  <div>
                    <div className="document-name">{doc.filename}</div>
                    <div className="document-meta">
                      <span>{doc.chunks} chunks</span>
                      {doc.source ? <span className="tag">{doc.source}</span> : null}
                      {doc.uploaded_at ? (
                        <span className="muted">{doc.uploaded_at}</span>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    className="danger"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                  >
                    {deletingId === doc.id ? 'Removing...' : 'Delete Embeddings'}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No documents ingested yet.</p>
              <p>Upload files to build the knowledge base.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default KnowledgeManager;
