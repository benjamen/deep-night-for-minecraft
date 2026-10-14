#!/usr/bin/env python3
"""Generates Deep Night's night sounds from code (numpy), so they are original and carry no third-party licence.
Writes mono 44.1 kHz OGG files to RP/sounds/dn/ and RP/sounds/sound_definitions.json. Deterministic (fixed seeds)."""
import json, os, subprocess, sys, tempfile, wave
import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "RP", "sounds")
os.makedirs(os.path.join(OUT, "dn"), exist_ok=True)

def env(n, a, d, floor=0.0):
    t = np.arange(n) / SR
    return np.minimum(t / max(a, 1e-4), 1) * np.exp(-t / max(d, 1e-4)) + floor

def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR); y = np.zeros_like(x); s = 0.0
    for i, v in enumerate(x): s = (1 - a) * v + a * s; y[i] = s
    return y

def fade(x, ms=25):
    n = int(SR * ms / 1000); x = x.copy(); x[:n] *= np.linspace(0, 1, n); x[-n:] *= np.linspace(1, 0, n); return x

def norm(x, peak=0.8): return x / (np.max(np.abs(x)) + 1e-9) * peak

def crickets(seed):
    r = np.random.default_rng(seed); n = int(SR * 6); x = np.zeros(n)
    for voice in range(3):
        f = r.uniform(4200, 5000); start = r.uniform(0, 0.4); rate = r.uniform(11, 14)
        t = np.arange(n) / SR
        gate = (np.sin(2 * np.pi * rate * t) > 0.2) * (np.sin(2 * np.pi * r.uniform(0.35, 0.6) * t + start) > -0.2)
        x += np.sin(2 * np.pi * f * t) * gate.astype(float) * lowpass(r.standard_normal(n), 30) * 0 + np.sin(2 * np.pi * f * t) * gate * 0.4
    return fade(norm(lowpass(x, 7000)))

def owl(seed):
    r = np.random.default_rng(seed); n = int(SR * 2.4); x = np.zeros(n)
    for start, dur, f in [(0.1, 0.45, 392), (0.75, 0.25, 370), (1.1, 0.25, 370), (1.5, 0.7, 330)]:
        s, m = int(start * SR), int(dur * SR); t = np.arange(m) / SR
        vib = 1 + 0.01 * np.sin(2 * np.pi * 5 * t); fl = f * (1 - 0.06 * t / dur)
        tone = np.sin(2 * np.pi * np.cumsum(fl * vib) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(fl) / SR)
        x[s:s + m] += tone * env(m, 0.05, dur * 0.9) * np.minimum(1, (dur - t) / 0.08)
    x += lowpass(r.standard_normal(n), 1500) * 0.01
    return fade(norm(lowpass(x, 2400)))

def wind(seed):
    r = np.random.default_rng(seed); n = int(SR * 8); t = np.arange(n) / SR
    base = lowpass(r.standard_normal(n), 600) + 0.6 * lowpass(r.standard_normal(n), 2200)
    swell = 0.35 + 0.65 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.17 * t + 1)) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.43 * t))
    rustle = lowpass(r.standard_normal(n), 5000) * (r.random(n) > 0.985) * 0.5
    x = base * swell + lowpass(rustle, 4000) * swell
    k = int(SR * 0.5); x[:k] *= np.linspace(0, 1, k); x[-k:] *= np.linspace(1, 0, k)
    return norm(x, 0.7)

def howl(seed):
    n = int(SR * 3.6); t = np.arange(n) / SR
    f = 330 + 260 * np.sin(np.pi * np.clip(t / 3.4, 0, 1)) ** 1.5 + 6 * np.sin(2 * np.pi * 6 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)
    x += lowpass(np.random.default_rng(seed).standard_normal(n), 3000) * 0.08
    x *= np.minimum(t / 0.8, 1) * np.minimum((3.6 - t) / 1.2, 1)
    return fade(norm(lowpass(x, 1800), 0.7))

def twig(seed):
    r = np.random.default_rng(seed); n = int(SR * 0.5); x = np.zeros(n)
    for at, amp in [(0.0, 1.0), (0.045, 0.5), (0.12, 0.3)]:
        s = int(at * SR); m = n - s
        click = r.standard_normal(m) * env(m, 0.0005, 0.006)
        ring = np.sin(2 * np.pi * r.uniform(1800, 2600) * np.arange(m) / SR) * env(m, 0.0005, 0.02) * 0.4
        x[s:] += (click + ring) * amp
    return fade(norm(x, 0.9), 5)

def heartbeat(seed):
    n = int(SR * 1.2); x = np.zeros(n)
    for at, amp in [(0.0, 1.0), (0.28, 0.7)]:
        s = int(at * SR); m = int(0.25 * SR); t = np.arange(m) / SR
        x[s:s + m] += np.sin(2 * np.pi * (62 - 25 * t) * t) * env(m, 0.01, 0.07) * amp
    return fade(norm(lowpass(x, 180), 0.9))

SOUNDS = {
    "dn.crickets": (crickets, 2, 0.55), "dn.owl": (owl, 2, 0.8), "dn.wind": (wind, 2, 0.6),
    "dn.howl": (howl, 2, 0.7), "dn.twig": (twig, 3, 0.9), "dn.heartbeat": (heartbeat, 1, 0.7),
}
defs = {}
for name, (fn, variants, vol) in SOUNDS.items():
    files = []
    for v in range(variants):
        stem = f"{name.split('.')[1]}_{v + 1}"
        pcm = (fn(1000 + v * 17) * 32767).astype("<i2")
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            with wave.open(tmp.name, "wb") as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-c:a", "libvorbis", "-q:a", "4", os.path.join(OUT, "dn", stem + ".ogg")], check=True)
        os.unlink(tmp.name)
        files.append({"name": f"sounds/dn/{stem}", "volume": vol, "load_on_low_memory": True})
    defs[name] = {"category": "ambient", "max_distance": 64, "sounds": files}
json.dump({"format_version": "1.20.20", "sound_definitions": defs}, open(os.path.join(OUT, "sound_definitions.json"), "w"), indent=2)
print("wrote", sum(len(d["sounds"]) for d in defs.values()), "sounds")
