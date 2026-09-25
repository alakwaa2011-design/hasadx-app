#!/usr/bin/env bash
set -euo pipefail

# Run from any directory. The first two seconds are deliberately silent: the
# preview prerolls this very audio element before mounting the film clock.
artifact="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workspace="$(cd "$artifact/../.." && pwd)"
voice_dir="$workspace/attached_assets/generated_audio"
starts=(2080 4760 9160 16960 22760 28360 32610 39310 46410)
takes=(
  hasaad-vertical-premium-0.mp3
  hasaad-vertical-premium-1.mp3
  hasaad-vertical-premium-2.mp3
  hasaad-vertical-premium-3.mp3
  hasaad-vertical-premium-4-short.mp3
  hasaad-vertical-premium-5.mp3
  hasaad-vertical-premium-6_2.mp3
  hasaad-vertical-premium-7_2.mp3
  hasaad-vertical-premium-8.mp3
)
# Light timing correction only where a line meets the next visual cut.
tempo=(1 1.06 1 1 1.05 1 1.08 1 1)

inputs=(
  -i "$artifact/public/audio/bed-directed.mp3"
  -i "$artifact/public/audio/wheel-accent.mp3"
  -i "$artifact/public/audio/mark-accent.mp3"
)
# The score plays once: the previous 33-second hard loop cut across Wameeth.
# All offsets include the two-second silent preroll used by the film clock.
filters="[0:a]atrim=0:49.6,asetpts=PTS-STARTPTS,volume=0.21,afade=t=in:st=0:d=0.25,afade=t=out:st=48.85:d=0.75,adelay=2000:all=1[bg];"
filters+="[1:a]volume=0.26,adelay=24850:all=1[wheel];"
filters+="[2:a]volume=0.28,adelay=31800:all=1[mark];"
mix="[bg][wheel][mark]"

for i in "${!starts[@]}"; do
  file="$voice_dir/${takes[$i]}"
  if [[ ! -s "$file" ]]; then
    printf 'Missing narration clip: %s\n' "$file" >&2
    exit 1
  fi
  inputs+=(-i "$file")
  filters+="[$((i + 3)):a]aresample=44100,atempo=${tempo[$i]},adelay=${starts[$i]}:all=1[v$i];"
  mix+="[v$i]"
done

filters+="${mix}amix=inputs=12:duration=longest:normalize=0,atrim=0:51.6,alimiter=limit=0.92:attack=4:release=40[out]"
ffmpeg -y -loglevel error "${inputs[@]}" \
  -filter_complex "$filters" -map '[out]' -c:a libmp3lame -b:a 192k \
  "$artifact/public/audio/final-mix.mp3"