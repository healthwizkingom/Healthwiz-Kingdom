class SoundManager {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private bgmAudio: HTMLAudioElement | null = null;
  private isBgmPlaying: boolean = false;

  constructor() {
    // Lazy initialize on first interaction
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    if (!enabled && this.bgmAudio) {
      this.bgmAudio.pause();
      this.isBgmPlaying = false;
    }
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public sfx(freq: number = 440, duration: number = 0.1, type: OscillatorType = 'square') {
    if (!this.soundEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = 0.05;
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio not supported or blocked
    }
  }

  public playClick() {
    this.sfx(600, 0.04);
  }

  public playXP() {
    this.sfx(660, 0.08);
  }

  public playLevelUp() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.sfx(f, 0.14), i * 110);
    });
  }

  public playBadge() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      setTimeout(() => this.sfx(f, 0.12), i * 100);
    });
  }

  public playMetronome(high: boolean) {
    this.sfx(high ? 520 : 390, 0.04);
  }

  public toggleBGM(): boolean {
    if (!this.soundEnabled) return false;
    try {
      if (!this.bgmAudio) {
        this.bgmAudio = new Audio('assets/audio/home-theme.mp3');
        this.bgmAudio.loop = true;
        this.bgmAudio.volume = 0.25;
      }
      if (this.isBgmPlaying) {
        this.bgmAudio.pause();
        this.isBgmPlaying = false;
      } else {
        this.bgmAudio.play().then(() => {
          this.isBgmPlaying = true;
        }).catch(() => {
          this.isBgmPlaying = false;
        });
      }
      return this.isBgmPlaying;
    } catch {
      return false;
    }
  }

  public isBGMActive(): boolean {
    return this.isBgmPlaying;
  }
}

export const sound = new SoundManager();
