import { Mic, MicOff } from 'lucide-react';
import { useVoice } from '@/shared/hooks/useVoice';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const { isRecording, isSupported, startRecording, stopRecording, error } = useVoice(
    (text) => {
      onTranscript(text);
    }
  );

  if (!isSupported) {
    return (
      <button
        disabled
        className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-xl text-text-tertiary opacity-40"
        title="Voice input not supported in this browser"
      >
        <MicOff size={18} />
      </button>
    );
  }

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
          isRecording
            ? 'bg-red-500 text-white animate-pulse'
            : 'text-text-tertiary hover:bg-bg-secondary hover:text-text-primary'
        } disabled:cursor-not-allowed disabled:opacity-50`}
        title={isRecording ? 'Stop recording' : 'Start voice input'}
      >
        <Mic size={18} />
      </button>

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute bottom-full right-0 mb-2 flex items-center gap-2 whitespace-nowrap rounded-xl bg-red-500 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          Listening...
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute bottom-full right-0 mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}
