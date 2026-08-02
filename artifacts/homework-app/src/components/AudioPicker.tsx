/**
 * AudioPicker — three-mode audio source picker for question editors.
 * Modes: file upload · mic recording · YouTube URL (stored as "yt:VIDEO_ID")
 *
 * Props:
 *   value           — current audioUrl stored on the question (null = none)
 *   onChange        — called when a new audio source is selected or cleared
 *   uploadEndpoint  — API path that returns { uploadURL, objectPath }
 */
import { useState, useRef } from "react";

const API = import.meta.env.VITE_API_URL || "";

type Tab = "file" | "record" | "youtube";

function extractYouTubeId(raw: string): string | null {
  const s = raw.trim();
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,          // watch?v=ID  or  &v=ID
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,      // youtu.be/ID
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/, // /shorts/ID
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,  // /embed/ID
    /^([a-zA-Z0-9_-]{11})$/,               // bare 11-char ID
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1];
  }
  return null;
}

async function uploadToStorage(
  blob: Blob,
  name: string,
  contentType: string,
  endpoint: string,
): Promise<string> {
  const r = await fetch(`${API}${endpoint}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, size: blob.size, contentType }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error((e as { message?: string }).message || "فشل رفع الملف");
  }
  const { uploadURL, objectPath } = (await r.json()) as { uploadURL: string; objectPath: string };
  const put = await fetch(uploadURL, { method: "PUT", body: blob, headers: { "Content-Type": contentType } });
  if (!put.ok) throw new Error("فشل رفع الملف إلى التخزين");
  return objectPath;
}

export default function AudioPicker({
  value,
  onChange,
  uploadEndpoint = "/api/islamic/teacher/uploads/audio-url",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  uploadEndpoint?: string;
}) {
  const [tab, setTab] = useState<Tab>("file");
  const [uploading, setUploading] = useState(false);
  const [error, setError]     = useState("");
  const [recording, setRecording]   = useState(false);
  const [audioBlob, setAudioBlob]   = useState<Blob | null>(null);
  const [ytUrl, setYtUrl]           = useState("");
  const [ytError, setYtError]       = useState("");

  const mrRef    = useRef<MediaRecorder | null>(null);
  const chunks   = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  /* ── File upload ─────────────────────────────────────────────── */
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(""); setUploading(true);
    try {
      const path = await uploadToStorage(f, f.name, f.type || "audio/mpeg", uploadEndpoint);
      onChange(path);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  /* ── Mic recording ───────────────────────────────────────────── */
  async function startRec() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mrRef.current = mr;
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.onstop = () => {
        setAudioBlob(new Blob(chunks.current, { type: "audio/webm" }));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setRecording(true);
      setAudioBlob(null);
    } catch {
      setError("تعذّر الوصول إلى الميكروفون — تأكد من منح الإذن");
    }
  }

  function stopRec() { mrRef.current?.stop(); setRecording(false); }

  async function uploadRec() {
    if (!audioBlob) return;
    setError(""); setUploading(true);
    try {
      const path = await uploadToStorage(audioBlob, `rec-${Date.now()}.webm`, "audio/webm", uploadEndpoint);
      onChange(path);
      setAudioBlob(null);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  /* ── YouTube ──────────────────────────────────────────────────── */
  function applyYt() {
    setYtError("");
    const id = extractYouTubeId(ytUrl);
    if (!id) { setYtError("رابط يوتيوب غير صالح — تحقق من الرابط"); return; }
    onChange(`yt:${id}`);
    setYtUrl("");
  }

  /* ── Styles ───────────────────────────────────────────────────── */
  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "6px 8px", borderRadius: 8, border: "none",
    background: active ? "#d97706" : "transparent",
    color: active ? "#fff" : "#92400e",
    fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
    transition: "background 0.15s",
  });

  const inp: React.CSSProperties = {
    display: "block", width: "100%", boxSizing: "border-box" as const,
    background: "#fff", color: "#1c1208", border: "1px solid #e8d8b8",
    borderRadius: 8, padding: "8px 12px", fontFamily: "inherit", fontSize: 14,
  };

  const actionBtn = (color = "#d97706"): React.CSSProperties => ({
    padding: "7px 16px", background: color, color: color === "#d97706" ? "#1c0f00" : "#fff",
    border: "none", borderRadius: 8, fontFamily: "inherit", fontWeight: 700,
    fontSize: 13, cursor: "pointer",
  });

  const recBlobUrl = audioBlob ? URL.createObjectURL(audioBlob) : null;

  return (
    <div style={{ border: "1px solid #e8d8b8", borderRadius: 12, padding: 12, background: "#fffbf0", marginBottom: 4 }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 3, marginBottom: 12, background: "#fef3c7", borderRadius: 10, padding: 3 }}>
        <button style={tabBtn(tab === "file")}   onClick={() => setTab("file")}>📁 رفع ملف</button>
        <button style={tabBtn(tab === "record")} onClick={() => setTab("record")}>🎙 تسجيل</button>
        <button style={tabBtn(tab === "youtube")} onClick={() => setTab("youtube")}>▶ يوتيوب</button>
      </div>

      {/* ── File tab ── */}
      {tab === "file" && (
        <div>
          <input type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav,.webm" onChange={handleFile}
            style={{ ...inp, padding: 6 }} disabled={uploading} />
          {uploading && <div style={{ fontSize: 12, color: "#92400e", marginTop: 4 }}>⏳ جاري الرفع…</div>}
          <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 4 }}>
            صيغ مدعومة: MP3 · M4A · OGG · WAV · حتى 25 MB
          </div>
        </div>
      )}

      {/* ── Record tab ── */}
      {tab === "record" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            {!recording
              ? <button onClick={startRec} disabled={uploading} style={actionBtn("#dc2626")}>⏺ بدء التسجيل</button>
              : <button onClick={stopRec} style={actionBtn("#b45309")}>⏹ إيقاف</button>
            }
            {recording && (
              <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 700 }}>🔴 جاري التسجيل…</span>
            )}
          </div>
          {recBlobUrl && !recording && (
            <div style={{ marginTop: 8 }}>
              <audio controls src={recBlobUrl} style={{ width: "100%", marginBottom: 8, borderRadius: 8 }} />
              <button onClick={uploadRec} disabled={uploading} style={actionBtn()}>
                {uploading ? "⏳ جاري الرفع…" : "⬆ رفع التسجيل"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── YouTube tab ── */}
      {tab === "youtube" && (
        <div>
          <input
            type="url" dir="ltr" lang="en"
            placeholder="https://youtube.com/watch?v=...  أو  youtu.be/..."
            value={ytUrl}
            onChange={e => { setYtUrl(e.target.value); setYtError(""); }}
            onKeyDown={e => e.key === "Enter" && applyYt()}
            style={{ ...inp, marginBottom: 8, direction: "ltr" }}
          />
          <button onClick={applyYt} style={actionBtn()}>إضافة</button>
          {ytError && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{ytError}</div>}
          <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 6 }}>
            سيُشغَّل الصوت فقط — لن يظهر مشغّل يوتيوب للطلاب
          </div>
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>{error}</div>}

      {/* Current value preview */}
      {value && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", background: "rgba(180,83,9,0.07)", borderRadius: 8, border: "1px solid rgba(180,83,9,0.18)" }}>
          <span style={{ fontSize: 13, color: "#92400e", fontWeight: 600, flex: 1, wordBreak: "break-all" as const }}>
            {value.startsWith("yt:")
              ? `🎬 يوتيوب · ${value.slice(3)}`
              : `🔊 ${value.split("/").pop()?.slice(0, 40) || value}`}
          </span>
          <button onClick={() => onChange(null)}
            style={{ padding: "2px 8px", background: "transparent", color: "#dc2626",
              border: "1px solid #fca5a5", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
