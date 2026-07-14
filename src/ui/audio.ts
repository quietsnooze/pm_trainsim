import type { SoundBackend } from '../sim/sound'

/**
 * Procedurally synthesised WebAudio backend — no audio files. Everything
 * is tuned gentle: this plays in a small person's hands.
 */
export class WebAudioBackend implements SoundBackend {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  /**
   * Create/resume the context. Must be called from a user gesture on iOS;
   * idempotent, so call it on every pointerdown.
   */
  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.35 // gentle by default
      this.master.connect(this.ctx.destination)
      // One second of white noise, reused for every chuff.
      const len = this.ctx.sampleRate
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = this.noiseBuffer.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  chuff(intensity: number): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    // Slowed-down noise reads as steam, not a snare.
    src.playbackRate.value = 0.45 + intensity * 0.25
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 140 + intensity * 120 // deep
    filter.Q.value = 0.5 // loose
    const gain = this.ctx.createGain()
    const peak = 0.16 + intensity * 0.42
    // Soft swell instead of an instant hit, then a long breathy tail.
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.045)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start(t, Math.random() * 0.5, 0.4)
  }

  whistle(): void {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    // A soft three-note chime, like the A4's whistle heard across a field.
    const notes: Array<[number, number]> = [
      [622, 0.14],
      [740, 0.11],
      [932, 0.08],
    ]
    for (const [freq, vol] of notes) {
      const osc = this.ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = freq
      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.08)
      gain.gain.setValueAtTime(vol, t + 0.7)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(t)
      osc.stop(t + 1.15)
    }
  }

  clunk(): void {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.07)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.4, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + 0.1)
  }
}
