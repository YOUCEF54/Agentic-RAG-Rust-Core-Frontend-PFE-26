import api from './api';

export const sendChatMessage = async (message: string, files?: string[]) => {
  const response = await api.post('/chat', { message, files });
  return response.data as { response: string };
};

export const uploadDocuments = async (files: File[]) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

  return response.data as { file_ids: string[]; chunks_stored: number };
};
