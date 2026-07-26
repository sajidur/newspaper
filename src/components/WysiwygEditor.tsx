import React, { useRef, useEffect, useState } from 'react';
import { 
  Bold, Italic, List, ListOrdered, Heading1, Heading2, Image, 
  Code, Link, Quote, Upload, Sparkles, CheckCircle2, AlertCircle
} from 'lucide-react';

interface WysiwygEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  token?: string;
}

export default function WysiwygEditor({ value, onChange, placeholder = "Type your article content...", token }: WysiwygEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [htmlValue, setHtmlValue] = useState(value);
  const [uploadFeedback, setUploadFeedback] = useState<{ text: string; isError: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);

  // Keep internal contentEditable in sync with external value
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
    setHtmlValue(value);
  }, [value]);

  const handleEditorChange = () => {
    if (editorRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      setHtmlValue(currentHtml);
      onChange(currentHtml);
    }
  };

  const executeCommand = (command: string, argument: string = '') => {
    document.execCommand(command, false, argument);
    handleEditorChange();
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const handleLink = () => {
    const url = prompt("Enter the URL link:");
    if (url) {
      executeCommand("createLink", url);
    }
  };

  const handleImageLink = () => {
    const url = prompt("Enter the external Image URL:");
    if (url) {
      executeCommand("insertImage", url);
      // Clean up styling of inserted image
      setTimeout(() => {
        if (editorRef.current) {
          const imgs = editorRef.current.getElementsByTagName('img');
          for (let i = 0; i < imgs.length; i++) {
            if (!imgs[i].classList.contains('editor-img')) {
              imgs[i].className = 'editor-img my-4 max-w-full rounded border border-stone-200 shadow-xs max-h-96 object-cover mx-auto block';
              imgs[i].referrerPolicy = 'no-referrer';
            }
          }
          handleEditorChange();
        }
      }, 50);
    }
  };

  // Image upload
  const handleImageUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (e.g. 3MB)
    if (file.size > 3 * 1024 * 1024) {
      setUploadFeedback({ text: "File too large. Maximum size is 3MB.", isError: true });
      return;
    }

    setUploading(true);
    setUploadFeedback(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({ image: base64Data })
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const data = await res.json();
        // Insert uploaded image at cursor position
        executeCommand("insertImage", data.url);
        
        // Apply default clean editorial image styles
        setTimeout(() => {
          if (editorRef.current) {
            const imgs = editorRef.current.getElementsByTagName('img');
            for (let i = 0; i < imgs.length; i++) {
              if (imgs[i].src.includes(data.url)) {
                imgs[i].className = 'editor-img my-4 max-w-full rounded border border-stone-200 shadow-md max-h-96 object-cover mx-auto block';
                imgs[i].referrerPolicy = 'no-referrer';
              }
            }
            handleEditorChange();
          }
        }, 50);

        setUploadFeedback({ text: "Image successfully uploaded and embedded!", isError: false });
        setTimeout(() => setUploadFeedback(null), 3000);
      } catch (err: any) {
        console.error("Image upload failed:", err);
        setUploadFeedback({ text: err.message || "Failed to upload image. Please try again.", isError: true });
      } finally {
        setUploading(false);
      }
    };

    reader.onerror = () => {
      setUploadFeedback({ text: "Error reading image file.", isError: true });
      setUploading(false);
    };

    reader.readAsDataURL(file);
  };

  const toggleMode = () => {
    if (isHtmlMode) {
      // Switch back to rich text editor
      setIsHtmlMode(false);
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = htmlValue;
        }
      }, 50);
    } else {
      // Switch to html editor
      setIsHtmlMode(true);
    }
  };

  const handleHtmlAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setHtmlValue(val);
    onChange(val);
  };

  return (
    <div className="border border-stone-200 rounded-lg overflow-hidden bg-white shadow-xs focus-within:border-stone-400 transition-colors">
      
      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-stone-50 border-b border-stone-200 gap-2 shrink-0 select-none">
        
        {/* Format Actions */}
        <div className="flex items-center flex-wrap gap-1">
          <button
            type="button"
            onClick={() => executeCommand('bold')}
            disabled={isHtmlMode}
            className="p-1.5 rounded text-stone-600 hover:bg-stone-200 disabled:opacity-30 cursor-pointer"
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          
          <button
            type="button"
            onClick={() => executeCommand('italic')}
            disabled={isHtmlMode}
            className="p-1.5 rounded text-stone-600 hover:bg-stone-200 disabled:opacity-30 cursor-pointer"
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>

          <span className="w-[1px] h-4 bg-stone-300 mx-1"></span>

          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<h2>')}
            disabled={isHtmlMode}
            className="p-1.5 rounded text-stone-600 hover:bg-stone-200 disabled:opacity-30 cursor-pointer"
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<h3>')}
            disabled={isHtmlMode}
            className="p-1.5 rounded text-stone-600 hover:bg-stone-200 disabled:opacity-30 cursor-pointer"
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<blockquote>')}
            disabled={isHtmlMode}
            className="p-1.5 rounded text-stone-600 hover:bg-stone-200 disabled:opacity-30 cursor-pointer"
            title="Blockquote"
          >
            <Quote className="w-4 h-4" />
          </button>

          <span className="w-[1px] h-4 bg-stone-300 mx-1"></span>

          <button
            type="button"
            onClick={() => executeCommand('insertUnorderedList')}
            disabled={isHtmlMode}
            className="p-1.5 rounded text-stone-600 hover:bg-stone-200 disabled:opacity-30 cursor-pointer"
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => executeCommand('insertOrderedList')}
            disabled={isHtmlMode}
            className="p-1.5 rounded text-stone-600 hover:bg-stone-200 disabled:opacity-30 cursor-pointer"
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          <span className="w-[1px] h-4 bg-stone-300 mx-1"></span>

          <button
            type="button"
            onClick={handleLink}
            disabled={isHtmlMode}
            className="p-1.5 rounded text-stone-600 hover:bg-stone-200 disabled:opacity-30 cursor-pointer"
            title="Insert Link"
          >
            <Link className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleImageLink}
            disabled={isHtmlMode}
            className="p-1.5 rounded text-stone-600 hover:bg-stone-200 disabled:opacity-30 cursor-pointer"
            title="Insert External Image URL"
          >
            <Image className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleImageUploadClick}
            disabled={isHtmlMode || uploading}
            className="p-1.5 rounded text-stone-600 hover:bg-stone-200 disabled:opacity-30 cursor-pointer flex items-center gap-1"
            title="Upload Local Image"
          >
            <Upload className="w-4 h-4" />
            <span className="text-[10px] font-mono font-bold hidden sm:inline">Upload</span>
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
        </div>

        {/* View Toggle */}
        <div>
          <button
            type="button"
            onClick={toggleMode}
            className="flex items-center gap-1.5 px-2 py-1 rounded border border-stone-200 hover:bg-stone-100 text-[10px] font-mono font-bold uppercase transition-all tracking-wide text-stone-600 cursor-pointer"
          >
            <Code className="w-3.5 h-3.5" />
            <span>{isHtmlMode ? "Rich Text View" : "Raw HTML View"}</span>
          </button>
        </div>

      </div>

      {/* Editor Body */}
      <div className="relative min-h-80 max-h-[500px] overflow-y-auto p-4 md:p-6 font-serif leading-relaxed text-stone-800">
        {isHtmlMode ? (
          <textarea
            value={htmlValue}
            onChange={handleHtmlAreaChange}
            className="w-full h-80 font-mono text-xs p-2 bg-stone-50 border border-stone-200 rounded outline-none focus:bg-white focus:border-stone-400"
            placeholder="Edit Raw HTML content directly..."
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            onInput={handleEditorChange}
            className="outline-none min-h-72 wysiwyg-editor-content prose max-w-none text-base"
            style={{ minHeight: "18rem" }}
            data-placeholder={placeholder}
          />
        )}
      </div>

      {/* Upload Feedback Overlay */}
      {uploadFeedback && (
        <div className={`px-4 py-2 text-xs font-mono border-t flex items-center gap-2 ${
          uploadFeedback.isError 
            ? 'bg-red-50 text-red-700 border-red-200' 
            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          {uploadFeedback.isError ? <AlertCircle className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          <span>{uploadFeedback.text}</span>
        </div>
      )}
      {uploading && (
        <div className="px-4 py-2 text-xs font-mono border-t bg-stone-50 text-stone-500 flex items-center gap-2 animate-pulse">
          <span className="inline-block w-2.5 h-2.5 bg-stone-400 rounded-full animate-ping" />
          <span>Streaming & compressing local image to media vaults...</span>
        </div>
      )}
    </div>
  );
}
