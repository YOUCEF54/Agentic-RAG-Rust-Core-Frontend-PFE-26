import api from '../services/api';
import type { UploadResponse } from '../types/knowledge.types';

export const useFileUpload = () => {
  const uploadFiles = async (files: File[], source?: string) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    if (source) {
      formData.append('source', source);
    }

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data as UploadResponse;
  };

  return { uploadFiles };
};
