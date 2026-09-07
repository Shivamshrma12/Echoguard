import React, { useState } from 'react';
import { X, Key, CheckCircle2, Shield, Sparkles, Radio } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveKeys: (keys: {
    gemini_api_key?: string;
    rime_api_key?: string;
    livekit_url?: string;
    livekit_api_key?: string;
    livekit_api_secret?: string;
  }) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaveKeys }) => {
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [rimeKey, setRimeKey] = useState<string>('');
  const [livekitUrl, setLivekitUrl] = useState<string>('');
  const [livekitApiKey, setLivekitApiKey] = useState<string>('');
  const [livekitApiSecret, setLivekitApiSecret] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSaveKeys({
      gemini_api_key: geminiKey || undefined,
      rime_api_key: rimeKey || undefined,
      livekit_url: livekitUrl || undefined,
      livekit_api_key: livekitApiKey || undefined,
      livekit_api_secret: livekitApiSecret || undefined,
    });
    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg bg-[#090e1a] border border-cyan-500/30 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.2)] p-6 font-sans text-xs overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Key className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                API Credentials & Voice Config
              </h3>
              <p className="text-[11px] text-slate-400">
                Connect live Gemini intelligence, Rime TTS, and LiveKit WebRTC
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 my-5">
          {/* Gemini API Key */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Google Gemini API Key</span>
              <span className="text-[10px] text-purple-400 font-normal">(Powers real-time answers)</span>
            </label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="Paste your GEMINI_API_KEY here..."
              className="w-full px-3 py-2 rounded-lg bg-[#060911] border border-white/[0.1] text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono"
            />
          </div>

          {/* Rime API Key */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>Rime TTS API Key</span>
              <span className="text-[10px] text-cyan-400 font-normal">(Primary spoken output)</span>
            </label>
            <input
              type="password"
              value={rimeKey}
              onChange={(e) => setRimeKey(e.target.value)}
              placeholder="Paste your RIME_API_KEY here..."
              className="w-full px-3 py-2 rounded-lg bg-[#060911] border border-white/[0.1] text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono"
            />
          </div>

          {/* LiveKit Configuration */}
          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            <div className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              LiveKit WebRTC Cloud (Optional)
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={livekitUrl}
                onChange={(e) => setLivekitUrl(e.target.value)}
                placeholder="LIVEKIT_URL (e.g. wss://your-project.livekit.cloud)"
                className="w-full px-3 py-2 rounded-lg bg-[#060911] border border-white/[0.1] text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="password"
                  value={livekitApiKey}
                  onChange={(e) => setLivekitApiKey(e.target.value)}
                  placeholder="LIVEKIT_API_KEY"
                  className="w-full px-3 py-2 rounded-lg bg-[#060911] border border-white/[0.1] text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono"
                />
                <input
                  type="password"
                  value={livekitApiSecret}
                  onChange={(e) => setLivekitApiSecret(e.target.value)}
                  placeholder="LIVEKIT_API_SECRET"
                  className="w-full px-3 py-2 rounded-lg bg-[#060911] border border-white/[0.1] text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>
          </div>

          {savedSuccess && (
            <div className="p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Credentials saved successfully! Live engines ready.</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
            <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span>Credentials stay server-side only.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save & Connect'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
