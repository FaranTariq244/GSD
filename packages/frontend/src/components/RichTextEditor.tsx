import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './RichTextEditor.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  taskId?: string; // If provided, upload to existing task; otherwise use temp storage
}

export function RichTextEditor({ value, onChange, placeholder, taskId }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<Array<{ url: string; filename: string }>>([]);

  const insertTextAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.substring(0, start) + text + value.substring(end);
    onChange(newValue);

    // Set cursor position after inserted text
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
    }, 0);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // If we have a taskId, upload to that task's attachments
      // Otherwise, upload to a temporary endpoint
      const endpoint = taskId
        ? `/api/tasks/${taskId}/attachments`
        : '/api/attachments/temp';

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      const imageUrl = data.attachment?.download_url || data.url;

      setUploadedImages(prev => [...prev, {
        url: imageUrl,
        filename: file.name
      }]);

      return imageUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const imageUrl = await uploadImage(file);
    if (imageUrl) {
      insertTextAtCursor(`\n![${file.name}](${imageUrl})\n`);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const imageUrl = await uploadImage(file);
          if (imageUrl) {
            insertTextAtCursor(`\n![pasted-image](${imageUrl})\n`);
          }
        }
        break;
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      return;
    }

    const imageUrl = await uploadImage(file);
    if (imageUrl) {
      insertTextAtCursor(`\n![${file.name}](${imageUrl})\n`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const insertBold = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    if (selectedText) {
      const newValue = value.substring(0, start) + `**${selectedText}**` + value.substring(end);
      onChange(newValue);
    } else {
      insertTextAtCursor('**bold text**');
    }
  };

  const insertItalic = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    if (selectedText) {
      const newValue = value.substring(0, start) + `*${selectedText}*` + value.substring(end);
      onChange(newValue);
    } else {
      insertTextAtCursor('*italic text*');
    }
  };

  const insertBulletList = () => {
    insertTextAtCursor('\n- Item 1\n- Item 2\n- Item 3\n');
  };

  const insertNumberedList = () => {
    insertTextAtCursor('\n1. Item 1\n2. Item 2\n3. Item 3\n');
  };

  const insertCodeBlock = () => {
    insertTextAtCursor('\n```\ncode here\n```\n');
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = value.substring(start, end) || 'link text';
        const newValue = value.substring(0, start) + `[${selectedText}](${url})` + value.substring(end);
        onChange(newValue);
      }
    }
  };

  return (
    <div className="rich-text-editor">
      <div className="editor-toolbar">
        <button
          type="button"
          className="toolbar-btn"
          onClick={insertBold}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={insertItalic}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <span className="toolbar-divider" />
        <button
          type="button"
          className="toolbar-btn"
          onClick={insertBulletList}
          title="Bullet List"
        >
          •
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={insertNumberedList}
          title="Numbered List"
        >
          1.
        </button>
        <span className="toolbar-divider" />
        <button
          type="button"
          className="toolbar-btn"
          onClick={insertCodeBlock}
          title="Code Block"
        >
          {'</>'}
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={insertLink}
          title="Insert Link"
        >
          🔗
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          title="Insert Image"
        >
          {isUploading ? '⏳' : '🖼️'}
        </button>
        <span className="toolbar-divider" />
        <button
          type="button"
          className={`toolbar-btn preview-toggle ${showPreview ? 'active' : ''}`}
          onClick={() => setShowPreview(!showPreview)}
          title="Toggle Preview"
        >
          👁️ Preview
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {showPreview ? (
        <div className="editor-preview">
          {value ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {value}
            </ReactMarkdown>
          ) : (
            <span className="preview-placeholder">Nothing to preview</span>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          placeholder={placeholder || 'Write description... You can paste or drag images here!'}
          rows={6}
        />
      )}

      {isUploading && (
        <div className="upload-indicator">
          Uploading image...
        </div>
      )}

      <div className="editor-hint">
        Supports Markdown. Paste or drag images to embed them.
      </div>
    </div>
  );
}

// Simple markdown renderer for displaying content
export function MarkdownContent({ content }: { content: string | null }) {
  if (!content) {
    return <span className="text-muted">No description</span>;
  }

  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
