export interface KnowledgeDocument {
  id: string;
  filename: string;
  source?: string | null;
  chunks: number;
  uploaded_at: string;
}

export interface UploadResponse {
  file_ids: string[];
  chunks_stored: number;
  documents: KnowledgeDocument[];
}
