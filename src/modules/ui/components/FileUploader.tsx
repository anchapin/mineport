import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { UploadState } from '../types.js';

interface FileUploaderProps {
  onFileSelected: (file: File) => void;
  onSourceRepoChange: (repo: string) => void;
  uploadState: UploadState;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelected,
  onSourceRepoChange,
  uploadState,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelected(e.target.files[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleRepoChange = (e: ChangeEvent<HTMLInputElement>) => {
    onSourceRepoChange(e.target.value);
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="file-uploader">
      <h2>Upload Minecraft Java Mod</h2>

      <div
        className={`upload-area ${isDragging ? 'dragging' : ''} ${uploadState.file ? 'has-file' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".jar"
          style={{ display: 'none' }}
        />

        {uploadState.file ? (
          <div className="file-info">
            <span className="file-name">{uploadState.file.name}</span>
            <span className="file-size">
              ({(uploadState.file.size / (1024 * 1024)).toFixed(2)} MB)
            </span>
          </div>
        ) : (
          <div className="upload-prompt">
            <div className="upload-icon">📁</div>
            <p>Drag and drop your .jar file here or click to browse</p>
          </div>
        )}
      </div>

      <div className="source-repo-input">
        <label htmlFor="source-repo">GitHub Repository URL (Optional):</label>
        <input
          type="text"
          id="source-repo"
          placeholder="https://github.com/username/repo"
          value={uploadState.sourceRepo || ''}
          onChange={handleRepoChange}
        />
        <p className="hint">Providing the source repository helps with better conversion results</p>
      </div>

      {uploadState.error && <div className="error-message">{uploadState.error}</div>}

      <button
        className="upload-button"
        disabled={!uploadState.file || uploadState.isUploading}
        onClick={() => {
          /* Submit logic will be handled by parent component */
        }}
      >
        {uploadState.isUploading ? 'Uploading...' : 'Start Conversion'}
      </button>
    </div>
  );
};

export default FileUploader;
