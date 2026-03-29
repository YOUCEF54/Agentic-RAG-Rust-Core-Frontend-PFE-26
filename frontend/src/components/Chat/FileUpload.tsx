import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

const FileUpload = ({ files, onFilesChange }: FileUploadProps) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFilesChange([...files, ...acceptedFiles]);
    },
    [files, onFilesChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    }
  });

  return (
    <div>
      <div className="upload-zone" {...getRootProps()}>
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop files to add them</p>
        ) : (
          <p>Drag and drop PDFs, TXTs, or DOCX files here</p>
        )}
      </div>
      {files.length ? (
        <div className="file-list">
          {files.map((file) => (
            <span key={file.name} className="file-chip">
              {file.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default FileUpload;
