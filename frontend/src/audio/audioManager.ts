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
  public activeSpokenText: string = '';
  public activeGenerationId: string = '';
  private silenceTimer: any = null;
  private accumulatedSpeech: string = '';
  private audioElement: HTMLAudioElement | null = null;
  private shouldBeListening: boolean = false;
  private currentPlayId: number = 0;
  private playbackStartTime: number = 0;

  private vadInterval: any = null;
  private consecutiveVoiceFrames: number = 0;
  private invalidatedGenerations: Set<string> = new Set();

  public setGeneration(genId: string): void {
    this.activeGenerationId = genId;
  }

  public invalidateGeneration(genId: string): void {
    if (genId) {
      this.invalidatedGenerations.add(genId);
    }
  }

  public isGenerationValid(genId: string): boolean {
    if (!genId) return true;
    if (this.invalidatedGenerations.has(genId)) return false;
    if (this.activeGenerationId && genId !== this.activeGenerationId) return false;
    return true;
  }

  public async startMicrophone(): Promise<boolean> {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Request microphone with standard browser Acoustic Echo Cancellation (AEC) constraints
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
   * Helper: check if utterance contains an explicit user interruption keyword
   */
  private isExplicitInterruptionPhrase(text: string): boolean {
    const lower = text.toLowerCase().trim();
    const interruptPhrases = [
      'stop',
      'no',
      'wait',
      'hold on',
      'cancel',
      'pause',
      'quiet',
      'shut up',
      'freeze',
      'hold',
      'hang on',
      'no stop',
      'please stop',
      'listen',
      'hey',
    ];
    return interruptPhrases.some((p) => {
      const re = new RegExp(`(^|\\b)${p}(\\b|$)`, 'i');
      return re.test(lower);
    });
  }

  /**
   * Helper: clean string into lowercase alpha tokens
   */
  private cleanTokens(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }

  /**
   * Helper: checks if the candidate transcript is acoustic feedback / echo
   * of what the agent is currently speaking through the speakers.
   */
  private isLikelySpeakerEcho(candidateText: string, activeSpokenText: string): boolean {
    if (!activeSpokenText || !candidateText) return false;

    // Explicit interruption phrases are never considered echo
    if (this.isExplicitInterruptionPhrase(candidateText)) {
      return false;
    }

    const candidateTokens = this.cleanTokens(candidateText);
    const spokenTokens = this.cleanTokens(activeSpokenText);

    if (candidateTokens.length === 0) return true;

    let matchCount = 0;
    for (const token of candidateTokens) {
      if (spokenTokens.includes(token)) {
        matchCount++;
      }
    }

    const matchRatio = matchCount / candidateTokens.length;
    // If 40% or more of words in candidate are part of currently playing agent speech,
    // it is speaker feedback picked up by the microphone.
    if (matchRatio >= 0.4) {
      return true;
    }

    const normCand = candidateText.toLowerCase().replace(/[^\w]/g, '');
    const normSpoken = activeSpokenText.toLowerCase().replace(/[^\w]/g, '');
    if (normSpoken.includes(normCand) && normCand.length > 4) {
      return true;
    }

    return false;
  }

  /**
   * Starts browser speech recognition with continuous listening, speaker echo filtering,
   * automatic user barge-in, and generation protection.
   */
  public startListening(
    onResult: (text: string) => void,
    onSpeechStart?: () => void,
    onBargeIn?: (interruptedUtterance?: string) => void,
    onError?: (err: any) => void,
    onInterim?: (interimText: string) => void
  ): boolean {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech Recognition not supported in this browser.');
      return false;
    }

    this.shouldBeListening = true;

    // Continuous Real-Time Acoustic analyser loop (for visual waveform only; does not cut audio blindly)
    if (this.vadInterval) clearInterval(this.vadInterval);
    this.vadInterval = setInterval(() => {
      if (!this.analyser || !this.isMicActive) {
        this.consecutiveVoiceFrames = 0;
        return;
      }
      this.consecutiveVoiceFrames = 0;
    }, 50);

    try {
      if (this.recognition) {
        try { this.recognition.abort(); } catch {}
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onspeechstart = () => {
        if (!this.isSpeaking && onSpeechStart) {
          onSpeechStart();
        }
      };

      rec.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript + ' ';
          } else {
            interimTranscript += res[0].transcript;
          }
        }

        const candidate = (finalTranscript + interimTranscript).trim();
        if (!candidate) return;

        // If the agent is currently speaking aloud through the speakers:
        if (this.isSpeaking) {
          // Check A: Explicit interruption phrase ("stop", "no", "wait", "hold on", "cancel", "pause", "quiet", "hey", "listen")
          if (this.isExplicitInterruptionPhrase(candidate)) {
            console.log(`[EchoGuard] User explicit barge-in keyword: "${candidate}". Cutting audio.`);
            this.flushAudioOnly();
            if (onBargeIn) {
              onBargeIn(candidate);
            }
            if (onInterim) onInterim(candidate);
            return;
          }
          // Check B: Speaker self-echo from laptop speakers — ignore and do not interrupt
          if (this.isLikelySpeakerEcho(candidate, this.activeSpokenText)) {
            return;
          }
          // Check C: User speaking a distinct, new utterance over the agent's voice (>= 2 distinct tokens)
          const tokens = this.cleanTokens(candidate);
          if (tokens.length >= 2) {
            console.log(`[EchoGuard] User distinct speech barge-in: "${candidate}". Cutting audio.`);
            this.flushAudioOnly();
            if (onBargeIn) {
              onBargeIn(candidate);
            }
            if (onInterim) onInterim(candidate);
            return;
          }
          // While speaking, do not trigger normal LLM query
          return;
        }

        // --- NOT SPEAKING: Agent is listening to user's question ---
        if (onInterim) {
          onInterim(candidate);
        }

        // Conversational End-of-Speech silence timeout:
        const words = candidate.split(/\s+/).filter(Boolean);
        const lastWord = words.length > 0 ? words[words.length - 1].toLowerCase().replace(/[^\w]/g, '') : '';
        
        const incompleteTrailing = [
          'tell', 'what', 'who', 'how', 'when', 'why', 'where', 'which',
          'is', 'are', 'was', 'were', 'am', 'be', 'been',
          'can', 'could', 'would', 'should', 'will', 'do', 'does', 'did',
          'explain', 'give', 'say', 'me', 'you',
          'the', 'a', 'an', 'to', 'for', 'about', 'in', 'on', 'at', 'by',
          'my', 'your', 'and', 'or', 'of', 'if', 'so', 'then', 'with', 'please'
        ];

        // Default conversational silence timeout: 1400ms for natural pauses
        let debounceMs = 1400;

        if (words.length < 3 || incompleteTrailing.includes(lastWord)) {
          // If the user spoke only 1-2 words (e.g. "tell me" or "what is" or trailing preposition "about"),
          // allow 2200ms so they can comfortably finish their complete sentence!
          debounceMs = 2200;
        } else if (words.length >= 5 && (candidate.endsWith('?') || candidate.endsWith('.') || candidate.endsWith('!'))) {
          // Complete sentence with natural punctuation
          debounceMs = 1100;
        }

        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
        }

        this.silenceTimer = setTimeout(() => {
          const textToSend = candidate.trim();
          if (onInterim) onInterim('');

          if (textToSend) {
            // Do not send if it was merely residual speaker echo
            if (this.isLikelySpeakerEcho(textToSend, this.activeSpokenText)) {
              return;
            }
            
            // Cleanly abort to reset the internal result list for the next turn
            try {
              rec.abort();
            } catch {}

            onResult(textToSend);
          }
        }, debounceMs);
      };

      rec.onerror = (e: any) => {
        // Ignore expected silence timeouts or aborts
        if (e.error === 'no-speech' || e.error === 'aborted') {
          return;
        }
        console.warn('Speech recognition notice:', e.error);
        if (onError) onError(e);
      };

      rec.onend = () => {
        // Continuous listening: restart cleanly if session is active
        if (this.shouldBeListening) {
          setTimeout(() => {
            if (this.shouldBeListening && this.recognition) {
              try {
                this.recognition.start();
              } catch (e) {
                // Ignore if already active
              }
            }
          }, 60);
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
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
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
   * Speaks the response through a single dedicated Rime TTS audio channel with generation fencing.
   * Cancels prior speech output with immediate cutoff without erasing user input buffers.
   */
  public async speak(
    text: string,
    generationIdOrOnStart?: string | (() => void),
    onStartOrOnEnd?: (() => void),
    onEndCallback?: (() => void)
  ): Promise<void> {
    let actualGenId: string | undefined;
    let onStart: (() => void) | undefined;
    let onEnd: (() => void) | undefined;

    if (typeof generationIdOrOnStart === 'function') {
      actualGenId = this.activeGenerationId;
      onStart = generationIdOrOnStart;
      onEnd = onStartOrOnEnd;
    } else {
      actualGenId = generationIdOrOnStart || this.activeGenerationId;
      onStart = onStartOrOnEnd;
      onEnd = onEndCallback;
    }

    const generationId = actualGenId;
    if (generationId) {
      this.activeGenerationId = generationId;
      if (this.invalidatedGenerations.has(generationId)) {
        console.warn(`[EchoGuard Fence] Dropping speak() for invalidated generation: ${generationId}`);
        return;
      }
    }
    this.flushAudioOnly();
    const playId = ++this.currentPlayId;
    this.isSpeaking = true;
    this.activeSpokenText = text;

    if (!this.audioElement) {
      this.audioElement = new Audio();
    }
    const audio = this.audioElement;

    let hasStarted = false;
    let hasEnded = false;

    const notifyStart = () => {
      if (!hasStarted && playId === this.currentPlayId) {
        if (generationId && !this.isGenerationValid(generationId)) {
          try { audio.pause(); } catch {}
          return;
        }
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
        this.activeSpokenText = '';
        if (onEnd) onEnd();
      }
    };

    // Reset handlers
    audio.onplay = () => {
      if (playId !== this.currentPlayId || (generationId && !this.isGenerationValid(generationId))) {
        try { audio.pause(); } catch {}
        return;
      }
      notifyStart();
    };

    audio.onended = () => {
      if (playId !== this.currentPlayId || (generationId && !this.isGenerationValid(generationId))) return;
      notifyEnd();
    };

    audio.onerror = (e) => {
      if (playId !== this.currentPlayId || (generationId && !this.isGenerationValid(generationId))) return;
      console.warn('Rime audio load notice, falling back to speech synthesis:', e);
      this.fallbackSpeak(text, notifyStart, notifyEnd);
    };

    const rimeUrl = `/api/tts/audio?text=${encodeURIComponent(text)}${generationId ? `&generationId=${encodeURIComponent(generationId)}` : ''}`;
    audio.src = rimeUrl;

    try {
      if (generationId && !this.isGenerationValid(generationId)) return;
      await audio.play();
      if (playId !== this.currentPlayId || (generationId && !this.isGenerationValid(generationId))) {
        try { audio.pause(); } catch {}
        return;
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || playId !== this.currentPlayId || (generationId && !this.isGenerationValid(generationId))) {
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
      this.activeSpokenText = '';
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
      this.activeSpokenText = '';
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.activeSpokenText = '';
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  /**
   * Non-destructive acoustic flush:
   * Instantly silences audio playback with immediate cutoff without clearing accumulated user speech buffers.
   */
  public flushAudioOnly(): void {
    this.currentPlayId++;
    this.isSpeaking = false;
    this.activeSpokenText = '';
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
