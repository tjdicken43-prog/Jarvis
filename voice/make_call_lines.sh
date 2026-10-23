#!/bin/sh
# Records Jarvis's phone-call lines (voice/calls/lines.tsv: name<TAB>text) as MP3s for Bird's "play" step.
# Voice: Piper (open source, free, runs offline) with the British male "alan" model, made a touch deeper and
# phone-clear with ffmpeg. Needs: pip install piper-tts, ffmpeg, and the model from
# https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-gb-alan-low.tar.gz
# Usage: sh voice/make_call_lines.sh path/to/en-gb-alan-low.onnx
set -e
MODEL="$1"; DIR="$(dirname "$0")/calls"; TMP="$(mktemp -d)"
while IFS="$(printf '\t')" read -r name text; do
  echo "$text" | python3 -I -m piper -m "$MODEL" --length-scale 1.08 --sentence-silence 0.35 -f "$TMP/raw.wav" >/dev/null 2>&1
  ffmpeg -nostdin -loglevel error -y -i "$TMP/raw.wav" -af "asetrate=16000*0.95,aresample=16000,atempo=1.0526,highpass=f=90,equalizer=f=2500:t=q:w=1:g=3,acompressor=threshold=-18dB:ratio=3:attack=5:release=120,adelay=400,apad=pad_dur=0.6,loudnorm=I=-16:TP=-1.5" -ac 1 -ar 16000 -codec:a libmp3lame -b:a 64k "$DIR/$name.mp3"
done < "$DIR/lines.tsv"
rm -rf "$TMP"
