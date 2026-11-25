import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, Link as LinkIcon, X, Check, Sparkles, FolderPlus } from 'lucide-react';

/**
 * Utility to compress/resize base64 image client-side to keep DB fast and compact
 */
function compressImage(file, maxWidth = 800, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export default function ImageUploadPicker({
  value,
  onChange,
  label = 'Product Photo / Image',
  presets = [],
  placeholderText = 'Drag & drop image here or click to browse',
  aspectRatio = 'square', // 'square' | 'wide'
  showPresets = true
}) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'presets' | 'url'
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState(value && value.startsWith('http') ? value : '');
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WebP, etc.)');
      return;
    }
    try {
      const compressedBase64 = await compressImage(file, 800, 0.85);
      onChange(compressedBase64);
    } catch (err) {
      console.error('Failed to process image:', err);
      // Fallback to raw data url
      const reader = new FileReader();
      reader.onload = (e) => onChange(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (urlInput.trim()) {
      onChange(urlInput.trim());
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setUrlInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
          {label}
        </label>

        {/* Source Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px]">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-2 py-0.5 rounded-md font-medium transition-all ${
              activeTab === 'upload'
                ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Upload File
          </button>
          {showPresets && presets.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                activeTab === 'presets'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Presets
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`px-2 py-0.5 rounded-md font-medium transition-all ${
              activeTab === 'url'
                ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Web URL
          </button>
        </div>
      </div>

      {/* 1. Direct File Upload Mode */}
      {activeTab === 'upload' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp, image/gif, image/svg+xml"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          {value ? (
            <div className="relative group rounded-2xl overflow-hidden border-2 border-brand-500/30 bg-slate-950/5 dark:bg-slate-900/60 p-2 flex items-center gap-4">
              <img
                src={value}
                alt="Uploaded Preview"
                className={`object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm ${
                  aspectRatio === 'wide' ? 'w-24 h-16' : 'w-16 h-16'
                }`}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=100';
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  <Check className="w-3.5 h-3.5" />
                  <span>Image Loaded Directly</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {value.startsWith('data:') ? 'Local file uploaded & encoded' : value}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                  >
                    <FolderPlus className="w-3 h-3" />
                    Change Image
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 scale-[0.99]'
                  : 'border-slate-300 dark:border-slate-700 hover:border-brand-400 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-brand-50/20'
              }`}
            >
              <div className="flex flex-col items-center justify-center space-y-1.5">
                <div className="w-10 h-10 rounded-2xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center shadow-inner">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Click to browse or drop an image file
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Supports JPG, PNG, WebP, SVG from your device
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Preset Library Mode */}
      {activeTab === 'presets' && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {presets.map((item, idx) => {
              const isSelected = value === item.url;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onChange(item.url)}
                  className={`relative group rounded-xl overflow-hidden border-2 transition-all p-1 text-left ${
                    isSelected
                      ? 'border-brand-600 dark:border-brand-400 ring-2 ring-brand-500/20 bg-brand-50 dark:bg-brand-950/40'
                      : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'
                  }`}
                >
                  <img
                    src={item.url}
                    alt={item.label}
                    className="w-full h-12 object-cover rounded-lg"
                  />
                  <div className="text-[9px] font-semibold text-slate-700 dark:text-slate-300 truncate mt-1 text-center">
                    {item.label}
                  </div>
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-brand-600 text-white rounded-full flex items-center justify-center text-[10px] shadow">
                      ✓
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. URL Input Mode */}
      {activeTab === 'url' && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="url"
              placeholder="https://images.unsplash.com/photo-..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
            />
          </div>
          <button
            type="button"
            onClick={handleUrlSubmit}
            className="px-3 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
