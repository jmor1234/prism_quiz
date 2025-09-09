"use client";

import { useState, useRef, useCallback } from "react";
import { MicIcon, MicOffIcon } from "lucide-react";
import { PromptInputButton } from "@/components/ai-elements/prompt-input";

interface VoiceButtonProps {
  onTranscriptionComplete: (text: string) => void;
  disabled?: boolean;
}

export function VoiceButton({ onTranscriptionComplete, disabled }: VoiceButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const { text } = await response.json();
      
      if (text) {
        onTranscriptionComplete(text);
      }
    } catch (error) {
      console.error('Transcription error:', error);
    } finally {
      setIsTranscribing(false);
    }
  }, [onTranscriptionComplete]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, [transcribeAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const isProcessing = isRecording || isTranscribing;

  return (
    <PromptInputButton
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled || isTranscribing}
      className={`h-8 w-8 ${
        isRecording 
          ? 'text-red-500 hover:text-red-600' 
          : isTranscribing
          ? 'text-blue-500'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {isTranscribing ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : isRecording ? (
        <MicOffIcon className="h-4 w-4" />
      ) : (
        <MicIcon className="h-4 w-4" />
      )}
    </PromptInputButton>
  );
}
