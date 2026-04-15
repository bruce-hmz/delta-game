// Sound design layer for the gacha extraction game
// Uses Web Audio API for zero-dependency sound generation
// (Howler.js available for when we switch to real audio assets)

import { Howl } from 'howler';
import type { Quality } from '../types';

// ==================== Sound Manager ====================

class SoundManager {
  private enabled = true;
  private volume = 0.7;
  private sounds: Map<string, Howl> = new Map();
  private initialized = false;

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Generate procedural sounds using Web Audio API
    // In production, replace with actual audio files

    // Quality reveal sounds - escalating intensity
    this.createQualitySound('white', 300, 0.2, 'sine');    // Soft click
    this.createQualitySound('blue', 500, 0.3, 'sine');     // Shimmer
    this.createQualitySound('purple', 800, 0.4, 'triangle'); // Magical chime
    this.createQualitySound('red', 200, 0.5, 'sawtooth');   // Bass drop
    this.createQualitySound('gold', 1000, 0.6, 'sine');     // Orchestral hit

    // UI sounds
    this.createUISound('click', 600, 0.05, 'sine');
    this.createUISound('hover', 400, 0.03, 'sine');

    // Zone ambient sounds
    this.createAmbientSound('zone-normal', 150, 0.1);
    this.createAmbientSound('zone-dangerous', 100, 0.15);
    this.createAmbientSound('zone-boss', 80, 0.2);

    // Event sounds
    this.createUISound('combat', 200, 0.3, 'sawtooth');
    this.createUISound('trap', 150, 0.3, 'square');
    this.createUISound('treasure', 700, 0.2, 'sine');

    // Result sounds
    this.createUISound('extract', 500, 0.4, 'sine');
    this.createUISound('death', 100, 0.5, 'sawtooth');
    this.createUISound('success', 800, 0.3, 'sine');
  }

  private createQualitySound(quality: string, freq: number, duration: number, wave: OscillatorType) {
    // Create a short buffer with procedural audio
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    // Generate samples
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const envelope = Math.max(0, 1 - t / duration);
      let sample = 0;

      // Quality-specific harmonics
      if (quality === 'gold') {
        // Major chord: root + third + fifth + octave
        sample = Math.sin(2 * Math.PI * freq * t) * 0.3
          + Math.sin(2 * Math.PI * freq * 1.26 * t) * 0.2
          + Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.2
          + Math.sin(2 * Math.PI * freq * 2 * t) * 0.15;
      } else if (quality === 'red') {
        // Low bass with harmonics
        sample = Math.sin(2 * Math.PI * freq * t) * 0.5
          + Math.sin(2 * Math.PI * freq * 2 * t) * 0.2
          + (Math.random() - 0.5) * 0.1; // noise
      } else {
        sample = Math.sin(2 * Math.PI * freq * t);
      }

      const val = Math.max(-1, Math.min(1, sample * envelope));
      view.setInt16(44 + i * 2, val * 32767, true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    this.sounds.set(`quality-${quality}`, new Howl({
      src: [url],
      volume: this.volume,
      format: ['wav'],
    }));
  }

  private createUISound(name: string, freq: number, duration: number, wave: OscillatorType) {
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const envelope = Math.max(0, 1 - t / duration);
      let sample = Math.sin(2 * Math.PI * freq * t);
      if (wave === 'square') sample = sample > 0 ? 1 : -1;
      if (wave === 'sawtooth') sample = 2 * (t * freq - Math.floor(t * freq + 0.5));

      const val = Math.max(-1, Math.min(1, sample * envelope * 0.5));
      view.setInt16(44 + i * 2, val * 32767, true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    this.sounds.set(name, new Howl({
      src: [url],
      volume: this.volume,
      format: ['wav'],
    }));
  }

  private createAmbientSound(name: string, freq: number, duration: number) {
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const envelope = 0.15 * (1 + Math.sin(2 * Math.PI * 0.5 * t));
      const sample = Math.sin(2 * Math.PI * freq * t) * 0.3
        + Math.sin(2 * Math.PI * freq * 0.5 * t) * 0.2
        + (Math.random() - 0.5) * 0.05;

      const val = Math.max(-1, Math.min(1, sample * envelope));
      view.setInt16(44 + i * 2, val * 32767, true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    this.sounds.set(name, new Howl({
      src: [url],
      volume: this.volume * 0.3,
      loop: true,
      format: ['wav'],
    }));
  }

  // ==================== Public API ====================

  playQualityReveal(quality: Quality) {
    if (!this.enabled) return;
    this.init();
    const sound = this.sounds.get(`quality-${quality}`);
    if (sound) sound.play();
  }

  playUI(name: 'click' | 'hover' | 'combat' | 'trap' | 'treasure' | 'extract' | 'death' | 'success') {
    if (!this.enabled) return;
    this.init();
    const sound = this.sounds.get(name);
    if (sound) sound.play();
  }

  playZoneAmbient(zone: 'normal' | 'dangerous' | 'boss') {
    if (!this.enabled) return;
    this.init();
    // Stop all ambient sounds first
    this.sounds.forEach((sound, key) => {
      if (key.startsWith('zone-')) sound.stop();
    });
    const sound = this.sounds.get(`zone-${zone}`);
    if (sound) sound.play();
  }

  stopAmbient() {
    this.sounds.forEach((sound, key) => {
      if (key.startsWith('zone-')) sound.stop();
    });
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stopAmbient();
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach(sound => sound.volume(this.volume));
  }

  dispose() {
    this.sounds.forEach(sound => sound.unload());
    this.sounds.clear();
  }
}

// Singleton
export const soundManager = new SoundManager();
