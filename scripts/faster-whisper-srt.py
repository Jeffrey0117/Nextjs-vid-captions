"""
faster-whisper SRT transcription wrapper.
Usage: python faster-whisper-srt.py <audio_file> --model base --language auto --output_dir ./temp
Outputs an SRT file in the specified directory.
"""
import sys
import argparse
from faster_whisper import WhisperModel


def format_timestamp(seconds: float) -> str:
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{ms:03d}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", help="Path to audio/video file")
    parser.add_argument("--model", default="base")
    parser.add_argument("--language", default="auto")
    parser.add_argument("--output_dir", default=".")
    args = parser.parse_args()

    lang = None if args.language == "auto" else args.language

    print(f"Loading model: {args.model}", file=sys.stderr, flush=True)
    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    print(f"Transcribing: {args.audio}", file=sys.stderr, flush=True)
    segments, info = model.transcribe(
        args.audio,
        language=lang,
        beam_size=5,
        word_timestamps=True,
        condition_on_previous_text=True,
    )

    if info.language:
        print(f"Detected language: {info.language} (prob={info.language_probability:.2f})", file=sys.stderr, flush=True)

    import os
    base = os.path.splitext(os.path.basename(args.audio))[0]
    out_path = os.path.join(args.output_dir, base + ".srt")

    idx = 1
    with open(out_path, "w", encoding="utf-8") as f:
        for seg in segments:
            start_ts = format_timestamp(seg.start)
            end_ts = format_timestamp(seg.end)
            text = seg.text.strip()
            if not text:
                continue
            f.write(f"{idx}\n{start_ts} --> {end_ts}\n{text}\n\n")
            # Progress output for parsing
            mins = int(seg.end // 60)
            secs = int(seg.end % 60)
            ms = int((seg.end % 1) * 1000)
            print(f"[{mins:02d}:{secs:02d}.{ms:03d} -->] {text}", file=sys.stderr, flush=True)
            idx += 1

    print(f"SRT saved: {out_path} ({idx - 1} segments)", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
