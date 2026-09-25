#!/usr/bin/env bash
set -euo pipefail

# Run from any directory. The first two seconds are deliberately silent: the
# preview prerolls this very audio element before mounting the film clock.
artifact="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workspace="$(cd "$artifact/../.." && pwd)"
voice_dir="$workspace/attached_assets/generated_audio"
starts=(2080 4760 9160 16960 22760 28360 32610 39310 46410)

inputs=(-stream_loop -1 -i "$artifact/public/audio/bg_extended.mp3")
filters="[0:a]atrim=0:49.6,asetpts=PTS-STARTPTS,volume=0.19,afade=t=in:st=0:d=0.3,afade=t=out:st=48.8:d=0.8,adelay=2000:all=1[bg];"
mix="[bg]"

for i in "${!starts[@]}"; do
  file="$voice_dir/hasaad-vertical-short-$i.mp3"
  if [[ ! -s "$file" ]]; then
    printf 'Missing narration clip: %s\n' "$file" >&2
    exit 1
  fi
  inputs+=(-i "$file")
  filters+="[$((i + 1)):a]aresample=44100,adelay=${starts[$i]}:all=1[v$i];"
  mix+="[v$i]"
done

filters+="${mix}amix=inputs=10:duration=longest:normalize=0,atrim=0:51.6[out]"
ffmpeg -y -loglevel error "${inputs[@]}" \
  -filter_complex "$filters" -map '[out]' -c:a libmp3lame -b:a 192k \
  "$artifact/public/audio/final-mix.mp3"