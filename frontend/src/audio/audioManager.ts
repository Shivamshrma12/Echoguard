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
  private currentPlayId: number = 0;
  private playbackStartTime: number = 0;

  private vadInterval: any = null;
  private consecutiveVoiceFrames: number = 0;
  private watchdogInterval: any = null;

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
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
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
   * Starts browser speech recognition with immediate interrupt handling,
   * continuous listening, and real-time acoustic VAD barge-in.
   */
  public startListening(
    onResult: (text: string) => void,
    onSpeechStart?: () => void,
    onBargeIn?: () => void,
    onError?: (err: any) => void
  ): boolean {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech Recognition not supported in this browser.');
      return false;
    }

    this.shouldBeListening = true;

    // Trigger barge-in: cancel Rime playback immediately in 0ms without destroying speech buffer
    const triggerBargeIn = (source: string) => {
      if (this.isSpeaking) {
        console.log(`[EchoGuard] Automatic Barge-In triggered via ${source}! Cancelling Rime speech output.`);
        this.flushAudioOnly();
        if (onBargeIn) {
          onBargeIn();
        } else if (onSpeechStart) {
          onSpeechStart();
        }
      }
    };

    // Continuous Real-Time Acoustic VAD Loop (runs every 25ms over echo-cancelled stream)
    if (this.vadInterval) clearInterval(this.vadInterval);
    this.vadInterval = setInterval(() => {
      if (!this.isSpeaking || !this.analyser || !this.isMicActive) {
        this.consecutiveVoiceFrames = 0;
        return;
      }

      // Allow 150ms after playback start for browser hardware AEC filter to converge
      if (Date.now() - this.playbackStartTime < 150) {
        return;
      }

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(buffer);

      // Human speech frequency band (bins 3 to 20 correspond to ~350Hz - 3600Hz)
      let voiceEnergy = 0;
      const minBin = 3;
      const maxBin = Math.min(20, buffer.length - 1);
      for (let i = minBin; i <= maxBin; i++) {
        voiceEnergy += buffer[i];
      }
      const avgVoiceEnergy = voiceEnergy / (maxBin - minBin + 1);

      // Distinct human voice energy threshold above noise/echo-cancelled baseline
      if (avgVoiceEnergy > 42) {
        this.consecutiveVoiceFrames++;
        if (this.consecutiveVoiceFrames >= 2) {
          // Sustained human speech detected during agent speech
          triggerBargeIn('vad_acoustic');
          this.consecutiveVoiceFrames = 0;
        }
      } else {
        this.consecutiveVoiceFrames = 0;
      }
    }, 25);

    try {
      if (this.recognition) {
        try { this.recognition.abort(); } catch {}
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onspeechstart = () => {
        triggerBargeIn('speech_start');
        if (onSpeechStart) onSpeechStart();
      };

      rec.onresult = (event: any) => {
        triggerBargeIn('speech_result');

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

        // Optimized fast debounce: 150ms when finalized, 350ms on pauses
        const debounceMs = lastIsFinal ? 150 : 350;

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
        // Ignore expected silence timeouts
        if (e.error === 'no-speech' || e.error === 'aborted') {
          return;
        }
        console.warn('Speech recognition notice:', e.error);
        if (onError) onError(e);
      };

      rec.onend = () => {
        // Continuous listening: restart immediately if session is active
        if (this.shouldBeListening) {
          setTimeout(() => {
            if (this.shouldBeListening && this.recognition) {
              try {
                this.recognition.start();
              } catch (e) {
                // Ignore if already starting
              }
            }
          }, 60);
        }
      };

      rec.start();
      this.recognition = rec;

      // Watchdog interval to ensure recognition is never permanently dead
      if (this.watchdogInterval) clearInterval(this.watchdogInterval);
      this.watchdogInterval = setInterval(() => {
        if (this.shouldBeListening && this.recognition) {
          try {
            this.recognition.start();
          } catch (e) {
            // Already active
          }
        }
      }, 1200);

      return true;
    } catch (e) {
      console.warn('Could not start speech recognition:', e);
      return false;
    }
  }

  public stopListening(): void {
    this.shouldBeListening = false;
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
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
   * Cancels prior speech output in 0ms without erasing user input buffers.
   */
  public async speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<void> {
    this.flushAudioOnly();
    const playId = ++this.currentPlayId;
    this.isSpeaking = true;

    if (!this.audioElement) {
      this.audioElement = new Audio();
    }
    const audio = this.audioElement;

    let hasStarted = false;
    let hasEnded = false;

    const notifyStart = () => {
      if (!hasStarted && playId === this.currentPlayId) {
        hasStarted = true;
        this.isSpeaking = true;
        this.playbackStartTime = Date.now();
        if (onStart) onStart();
      }
    };

    const notifyEnd = () => {
      if (!hasEnded && playId === this.currentPlayId) {
        hasEnded = true;
        this.isSpeaking = false;
        if (onEnd) onEnd();
      }
    };

    // Reset handlers
    audio.onplay = () => {
      if (playId !== this.currentPlayId) {
        try { audio.pause(); } catch {}
        return;
      }
      notifyStart();
    };

    audio.onended = () => {
      if (playId !== this.currentPlayId) return;
      notifyEnd();
    };

    audio.onerror = (e) => {
      if (playId !== this.currentPlayId) return;
      console.warn('Rime audio load notice, falling back to speech synthesis:', e);
      this.fallbackSpeak(text, notifyStart, notifyEnd);
    };

    const rimeUrl = `/api/tts/audio?text=${encodeURIComponent(text)}`;
    audio.src = rimeUrl;

    try {
      await audio.play();
      if (playId !== this.currentPlayId) {
        try { audio.pause(); } catch {}
        return;
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || playId !== this.currentPlayId) {
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
      this.playbackStartTime = Date.now();
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
   * Non-destructive acoustic flush:
   * Instantly silences audio playback in 0ms without clearing accumulated user speech buffers.
   */
  public flushAudioOnly(): void {
    this.currentPlayId++;
    this.isSpeaking = false;
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.removeAttribute('src');
        this.audioElement.load();
      } catch (e) {}
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    this.currentUtterance = null;
  }

  /**
   * Deterministic 0ms Acoustic Cutoff:
   * Instantly pauses audio, removes source, and purges hardware buffer.
   */
  public flushAudio(): void {
    this.flushAudioOnly();
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.accumulatedSpeech = '';
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
