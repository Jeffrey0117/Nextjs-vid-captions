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


# --- 字級時間戳 → 細粒度 cue (Claude 2026-06-12) ----------------------------
# 舊版一個 Whisper segment 寫一條 cue — 沒標點的講話會變 8 秒一坨, 下游切句只能
# 按字數比例「猜」時間 → 字幕跟語音差好幾秒。word_timestamps 本來就開著,
# 改成用每個字的真實時間組 cue: 句點/停頓處切、上限 3.5s/12 詞, 起迄準到字。
CUE_MAX_DUR = 3.5     # 單條 cue 秒數上限
CUE_MAX_WORDS = 12    # 單條 cue 詞數上限
CUE_GAP_CUT = 0.6     # 字與字間隔 >= 0.6s 視為停頓 → 切
_SENT_END = (".", "!", "?", "。", "!", "?")


# 強制切 (太長/詞太多) 時, 結尾若是這些連接詞 → 回溯留給下一條, 切在語意自然處
_CONNECTORS = {
    "the", "a", "an", "to", "of", "and", "or", "but", "for", "with", "that",
    "this", "your", "you're", "is", "are", "was", "were", "be", "not", "my",
    "in", "on", "at", "as", "so", "who", "what", "when", "how", "more", "less",
}
CUE_MIN_DUR = 0.5     # 比這短的尾巴 cue 併回上一條 (避免 0.2s 一閃而過)


def build_cues(segments):
    """faster-whisper segments (含 .words) → 逐條 yield (start, end, text) 細粒度 cue。
    generator: segments 是 lazy 的, 串流 yield 才能邊轉錄邊吐進度 (Nextjs 靠 stderr 算 %)。"""
    cur = []        # 進行中的 cue (word 物件 list)
    pending = None  # 留一手緩衝: 下一條太短就併回來

    def make(words_):
        text = "".join(w.word for w in words_).strip()
        return (words_[0].start, words_[-1].end, text) if text else None

    def emit(cue):
        """緩衝一條: 新 cue 太短且緊接著 → 併進上一條; 否則放行上一條。回 (可 yield 的 cue 或 None)。"""
        nonlocal pending
        if cue is None:
            return None
        if pending is None:
            pending = cue
            return None
        ps, pe, pt = pending
        s, e, t = cue
        if (e - s) < CUE_MIN_DUR and (s - pe) < 0.3:
            pending = (ps, e, (pt + " " + t).strip())
            return None
        out = pending
        pending = cue
        return out

    def cut(forced: bool):
        """切一刀: forced (長度/詞數爆) 時回溯連接詞給下一條。回傳要 yield 的 cue 或 None。"""
        carry = []
        if forced:
            while len(cur) > 2 and len(carry) < 3 and \
                    cur[-1].word.strip().lower().strip(".,!?") in _CONNECTORS:
                carry.append(cur.pop())
        cue = make(cur)
        cur.clear()
        cur.extend(reversed(carry))
        return emit(cue)

    for seg in segments:
        words = getattr(seg, "words", None) or []
        if not words:
            # 沒字級資料 (罕見) → 整段一條, 至少不丟字
            if cur:
                c = cut(forced=False)
                if c:
                    yield c
            c = emit((seg.start, seg.end, (seg.text or "").strip())) if (seg.text or "").strip() else None
            if c:
                yield c
            continue
        for w in words:
            if cur:
                gap = w.start - cur[-1].end
                dur = w.end - cur[0].start
                prev = cur[-1].word.strip()
                natural = (
                    gap >= CUE_GAP_CUT                       # 真實停頓
                    or prev.endswith(_SENT_END)              # 句子講完
                    or (prev.endswith((",", ",")) and dur > 2.0)  # 逗號 + 已夠長
                )
                forced = dur > CUE_MAX_DUR or len(cur) >= CUE_MAX_WORDS
                if natural or forced:
                    c = cut(forced=forced and not natural)
                    if c:
                        yield c
            cur.append(w)
    if cur:
        c = cut(forced=False)
        if c:
            yield c
    if pending is not None:
        yield pending


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
        for start, end, text in build_cues(segments):
            f.write(f"{idx}\n{format_timestamp(start)} --> {format_timestamp(end)}\n{text}\n\n")
            # Progress output for parsing
            mins = int(end // 60)
            secs = int(end % 60)
            ms = int((end % 1) * 1000)
            print(f"[{mins:02d}:{secs:02d}.{ms:03d} -->] {text}", file=sys.stderr, flush=True)
            idx += 1

    print(f"SRT saved: {out_path} ({idx - 1} segments)", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
