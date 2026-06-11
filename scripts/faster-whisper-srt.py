"""
faster-whisper SRT transcription wrapper.
Usage: python faster-whisper-srt.py <audio_file> --model base --language auto --output_dir ./temp
Outputs an SRT file in the specified directory.
"""
import os
import sys
import argparse
from pathlib import Path

# --- GPU enable (Claude 2026-06-11) -----------------------------------------
# Reelo 用 PYTHON_PATH 指向有 GPU faster-whisper 的 venv 跑這支。Windows 上
# ctranslate2 要找得到 pip 裝的 cuDNN9 / cuBLAS DLL, 不然 cuda 會 "cublas64_12.dll
# not found"。把 venv 內 nvidia/*/bin 塞進 DLL 搜尋路徑 (用 sys.prefix 相對, 換機器
# 也通)。truststore 讓 HuggingFace 模型下載走 Windows 憑證庫 (繞過防毒 SSL 攔截)。
_nv = Path(sys.prefix) / "Lib" / "site-packages" / "nvidia"
_bins = [str(_nv / s) for s in ("cublas/bin", "cudnn/bin", "cuda_nvrtc/bin") if (_nv / s).exists()]
if _bins:
    os.environ["PATH"] = os.pathsep.join(_bins) + os.pathsep + os.environ.get("PATH", "")
    for _b in _bins:
        try:
            os.add_dll_directory(_b)
        except Exception:
            pass
try:
    import truststore
    truststore.inject_into_ssl()
except Exception:
    pass

from faster_whisper import WhisperModel


def _load_model(model_name: str):
    """優先 GPU (RTX 50xx Blackwell 必須 float16 — int8 會 CUBLAS_STATUS_NOT_SUPPORTED),
    GPU 不可用 / 載入失敗自動退回 CPU int8。"""
    try:
        m = WhisperModel(model_name, device="cuda", compute_type="float16")
        print("Device: cuda (float16)", file=sys.stderr, flush=True)
        return m
    except Exception as e:
        print(f"GPU 不可用 ({e}), fallback CPU int8", file=sys.stderr, flush=True)
        return WhisperModel(model_name, device="cpu", compute_type="int8")


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
    model = _load_model(args.model)

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
