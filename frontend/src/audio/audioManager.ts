/**
 * EchoGuard Audio Engine
 * Real acoustic capture, Web Audio analyser, Web Speech Recognition,
 * and Speech Synthesis audio output.
 */
export class AudioManager {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isMicActive: boolean = false;
  private recognition: any = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  public isSpeaking: boolean = false;
  private silenceTimer: any = null;
  private accumulatedSpeech: string = '';
  private audioElement: HTMLAudioElement | null = null;
  private shouldBeListening: boolean = false;

  public async startMicrophone(): Promise<boolean> {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Request microphone with hardware/browser Acoustic Echo Cancellation (AEC)
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.micStream);

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      this.sourceNode.connect(this.analyser);
      this.isMicActive = true;
      return true;
    } catch (err) {
      console.warn('Microphone capture not granted or unavailable:', err);
      this.isMicActive = false;
      return false;
    }
  }

  public stopMicrophone(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.isMicActive = false;
  }

  /**
   * Starts browser speech recognition with immediate interrupt handling and continuous listening
   */
  public startListening(
    onResult: (text: string) => void,
    onSpeechStart?: () => void,
    onError?: (err: any) => void
  ): boolean {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech Recognition not supported in this browser.');
      return false;
    }

    this.shouldBeListening = true;

    try {
      if (this.recognition) {
        try { this.recognition.abort(); } catch {}
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onspeechstart = () => {
        // Instant Acoustic Cutoff: if agent is speaking, cut audio immediately (0ms)
        if (this.isSpeaking) {
          this.flushAudio();
          if (onSpeechStart) onSpeechStart();
        }
      };

      rec.onresult = (event: any) => {
        // If agent was still producing audio, cut it instantly
        if (this.isSpeaking) {
          this.flushAudio();
          if (onSpeechStart) onSpeechStart();
        }

        let interim = '';
        let lastIsFinal = false;
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            this.accumulatedSpeech += (this.accumulatedSpeech ? ' ' : '') + item[0].transcript;
            lastIsFinal = true;
          } else {
            interim += item[0].transcript;
          }
        }

        const candidate = (this.accumulatedSpeech + ' ' + interim).trim();
        if (!candidate) return;

        // Fast debounce: 220ms when speech is finalized, 400ms for pauses
        const debounceMs = lastIsFinal ? 220 : 400;

        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
        }
        this.silenceTimer = setTimeout(() => {
          const textToSend = (this.accumulatedSpeech || candidate).trim();
          this.accumulatedSpeech = '';
          if (textToSend) {
            onResult(textToSend);
          }
        }, debounceMs);
      };

      rec.onerror = (e: any) => {
        // Ignore expected silence timeouts from browser engine
        if (e.error === 'no-speech' || e.error === 'aborted') {
          return;
        }
        console.warn('Speech recognition notice:', e.error);
        if (onError) onError(e);
      };

      rec.onend = () => {
        // Browser SpeechRecognition automatically cuts off after pauses; auto-restart if active
        if (this.shouldBeListening) {
          setTimeout(() => {
            if (this.shouldBeListening) {
              try {
                rec.start();
              } catch (e) {
                // Ignore if already starting
              }
            }
          }, 200);
        }
      };

      rec.start();
      this.recognition = rec;
      return true;
    } catch (e) {
      console.warn('Could not start speech recognition:', e);
      return false;
    }
  }

  public stopListening(): void {
    this.shouldBeListening = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.accumulatedSpeech = '';
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
      this.recognition = null;
    }
  }

  /**
   * Speaks the response through a single dedicated Rime TTS audio channel.
   * Guaranteed not to hang voice state.
   */
  public async speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<void> {
    this.flushAudio();
    this.isSpeaking = true;

    if (!this.audioElement) {
      this.audioElement = new Audio();
    }
    const audio = this.audioElement;

    let hasStarted = false;
    let hasEnded = false;

    const notifyStart = () => {
      if (!hasStarted) {
        hasStarted = true;
        this.isSpeaking = true;
        if (onStart) onStart();
      }
    };

    const notifyEnd = () => {
      if (!hasEnded) {
        hasEnded = true;
        this.isSpeaking = false;
        if (onEnd) onEnd();
      }
    };

    // Reset handlers
    audio.onplay = () => {
      notifyStart();
    };

    audio.onended = () => {
      notifyEnd();
    };

    audio.onerror = (e) => {
      console.warn('Rime audio load notice, falling back to speech synthesis:', e);
      this.fallbackSpeak(text, notifyStart, notifyEnd);
    };

    const rimeUrl = `/api/tts/audio?text=${encodeURIComponent(text)}`;
    audio.src = rimeUrl;

    try {
      await audio.play();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      console.warn('Audio play notice, falling back to speech synthesis:', err);
      this.fallbackSpeak(text, notifyStart, notifyEnd);
    }
  }

  private fallbackSpeak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void
  ): void {
    if (!('speechSynthesis' in window)) {
      this.isSpeaking = false;
      if (onStart) onStart();
      setTimeout(() => {
        if (onEnd) onEnd();
      }, 1500);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(
      (v) => (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')) && v.lang.startsWith('en')
    ) || voices.find((v) => v.lang.startsWith('en'));
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  /**
   * Deterministic 0ms Acoustic Cutoff:
   * Instantly pauses audio, removes source, and purges hardware buffer.
   */
  public flushAudio(): void {
    this.isSpeaking = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.accumulatedSpeech = '';
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.removeAttribute('src');
      this.audioElement.load(); // Purges audio pipeline buffer instantly
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
  }

  public getWaveformData(state: string, binCount: number = 64): { data: number[]; isAcoustic: boolean } {
    if (this.isMicActive && this.analyser && (state === 'LISTENING' || state === 'SPEAKING')) {
      const buffer = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(buffer);

      const step = Math.floor(buffer.length / binCount);
      const res: number[] = [];
      for (let i = 0; i < binCount; i++) {
        const val = buffer[i * step] / 255.0;
        res.push(val);
      }
      return { data: res, isAcoustic: true };
    }

    const now = performance.now() / 1000.0;
    const res: number[] = [];

    if (state === 'INTERRUPTING' || state === 'INVALIDATED') {
      for (let i = 0; i < binCount; i++) {
        res.push(0.04 * Math.sin(i * 0.5 + now * 2));
      }
      return { data: res, isAcoustic: false };
    }

    if (state === 'SPEAKING') {
      for (let i = 0; i < binCount; i++) {
        const x = (i / binCount) * Math.PI;
        const envelope = Math.sin(x);
        const harmonic =
          0.5 * Math.sin(i * 0.4 + now * 12) + 0.3 * Math.sin(i * 0.8 - now * 8) + 0.2;
        res.push(Math.max(0.08, Math.min(1.0, envelope * (0.4 + Math.abs(harmonic)))));
      }
      return { data: res, isAcoustic: false };
    }

    if (state === 'LISTENING') {
      for (let i = 0; i < binCount; i++) {
        const envelope = Math.sin((i / binCount) * Math.PI);
        const harmonic = 0.3 * Math.sin(i * 0.6 + now * 6);
        res.push(Math.max(0.05, envelope * (0.2 + Math.abs(harmonic))));
      }
      return { data: res, isAcoustic: false };
    }

    if (state === 'RECOVERING') {
      for (let i = 0; i < binCount; i++) {
        const envelope = Math.sin((i / binCount) * Math.PI);
        const wave = 0.4 * Math.sin(i * 0.5 + now * 10);
        res.push(Math.max(0.05, envelope * Math.abs(wave)));
      }
      return { data: res, isAcoustic: false };
    }

    // IDLE
    for (let i = 0; i < binCount; i++) {
      const envelope = Math.sin((i / binCount) * Math.PI);
      res.push(Math.max(0.02, envelope * 0.08));
    }
    return { data: res, isAcoustic: false };
  }

  public get isMicrophoneConnected(): boolean {
    return this.isMicActive;
  }
}

export const audioManager = new AudioManager();
