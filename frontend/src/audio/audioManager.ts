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

  public async startMicrophone(): Promise<boolean> {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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
   * Starts browser speech recognition so you can speak naturally
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

    try {
      if (this.recognition) {
        this.recognition.abort();
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onspeechstart = () => {
        if (onSpeechStart) onSpeechStart();
      };

      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          onResult(transcript.trim());
        }
      };

      rec.onerror = (e: any) => {
        if (onError) onError(e);
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
   * Speaks the response aloud through your speakers
   */
  public speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void
  ): void {
    if (!('speechSynthesis' in window)) {
      console.warn('SpeechSynthesis not available in browser');
      if (onStart) onStart();
      setTimeout(() => {
        if (onEnd) onEnd();
      }, 2000);
      return;
    }

    // Cancel any previous speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Pick a natural English voice if available
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(
      (v) => (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Ava')) && v.lang.startsWith('en')
    ) || voices.find((v) => v.lang.startsWith('en'));
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e);
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  /**
   * Immediately flushes and cancels in-flight audio when interrupted
   */
  public flushAudio(): void {
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
