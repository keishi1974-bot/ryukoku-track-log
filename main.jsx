import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ── 定数 ──────────────────────────────────────────────────────────────────────
const EVENTS = {
  run:  [{ id: "100m", label: "100m" }, { id: "200m", label: "200m" }, { id: "400m", label: "400m" }, { id: "800m", label: "800m" }, { id: "1500m", label: "1500m" }, { id: "3000m", label: "3000m" }, { id: "5000m", label: "5000m" }, { id: "10000m", label: "10000m" }, { id: "100mh", label: "100mH" }, { id: "110mh", label: "110mH" }, { id: "400mh", label: "400mH" }],
  jump: [{ id: "long_jump", label: "走幅跳" }, { id: "high_jump", label: "走高跳" }, { id: "triple_jump", label: "三段跳" }, { id: "pole_vault", label: "棒高跳" }],
  throw: [{ id: "shot_put", label: "砲丸投" }, { id: "javelin", label: "やり投" }, { id: "hammer", label: "ハンマー投" }, { id: "discus", label: "円盤投" }],
};
const ALL_EVENTS    = [...EVENTS.run, ...EVENTS.jump, ...EVENTS.throw];
const JUMP_IDS      = EVENTS.jump.map((e) => e.id);
const THROW_IDS     = EVENTS.throw.map((e) => e.id);
// 試技（6本・ファウル）方式の種目：走幅跳・三段跳・投擲4種目
const TRIAL_JUMP_IDS = ["long_jump", "triple_jump", ...THROW_IDS];
const RUN_IDS       = EVENTS.run.map((e) => e.id);

const WEATHER_OPTIONS = ["晴れ", "曇り", "雨", "小雨", "雪"];
const WIND_DIR        = ["追い風", "向かい風", "横風", "無風"];
const FEEL_OPTIONS    = [
  { val: "perfect", label: "バッチリ", color: "#4ade80" },
  { val: "good",    label: "まあまあ", color: "#e8ff47" },
  { val: "off",     label: "ズレた",   color: "#fb923c" },
  { val: "bad",     label: "全然ダメ", color: "#ff4747" },
];
// 走種目のラウンド名
const ROUND_OPTIONS = ["予選", "準決勝", "決勝", "A決勝", "B決勝", "記録会"];
const MAX_JUMP_TRIALS = 6;

const C = {
  bg: "#0d0f14", surface: "#161921", card: "#1e2330",
  accent: "#e8ff47", text: "#f0f2f5", muted: "#6b7280",
  border: "#2a3040", run: "#47b3ff", jump: "#ff7f47", danger: "#ff4747",
};

// ── ユーティリティ ────────────────────────────────────────────────────────────
const evLabel      = (id) => ALL_EVENTS.find((e) => e.id === id)?.label ?? id;
const isJump       = (id) => JUMP_IDS.includes(id) || THROW_IDS.includes(id); // 距離/高さで評価する種目（跳躍+投擲）
const isThrow      = (id) => THROW_IDS.includes(id);
const isRunwayJump = (id) => JUMP_IDS.includes(id); // 助走・踏切がある跳躍
const isTrialJump  = (id) => TRIAL_JUMP_IDS.includes(id);
const isRun        = (id) => RUN_IDS.includes(id);
const feelLabel    = (v)  => FEEL_OPTIONS.find((f) => f.val === v)?.label ?? v;
const feelColor    = (v)  => FEEL_OPTIONS.find((f) => f.val === v)?.color ?? C.muted;
const fmtDate      = (iso) => new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });

const timeToSec = (t) => {
  if (!t) return null;
  const m = t.match(/^(\d+):(\d+\.?\d*)$/);
  if (m) return parseFloat(m[1]) * 60 + parseFloat(m[2]);
  return parseFloat(t) || null;
};

// 走幅跳・三段跳：有効試技の最長距離
const getBestDistance = (r) => {
  if (!isTrialJump(r.event)) return parseFloat(r.distance) || null;
  const valid = (r.trials ?? []).filter((t) => !t.foul && t.distance).map((t) => parseFloat(t.distance));
  return valid.length ? Math.max(...valid) : (parseFloat(r.distance) || null);
};

// 走種目：ラウンドの中で最速タイム
// 秒数を表示用に整形（60秒以上なら 分:秒、未満ならそのまま秒）
const secToDisplay = (sec) => {
  if (sec == null) return "-";
  if (sec < 60) return sec.toFixed(2);
  const m = Math.floor(sec / 60);
  const s = (sec - m * 60).toFixed(2).padStart(5, "0");
  return `${m}:${s}`;
};

const getBestTime = (r) => {
  if (!isRun(r.event)) return r.time || null;
  if (r.rounds?.length) {
    // 最速ラウンドの「元の表記」をそのまま返す
    let bestStr = null, bestSec = Infinity;
    r.rounds.forEach((rd) => {
      const sec = timeToSec(rd.time);
      if (sec != null && sec < bestSec) { bestSec = sec; bestStr = rd.time; }
    });
    if (bestStr != null) return bestStr;
  }
  return r.time || null;
};

const fmtResult = (r) => {
  if (!r?.event) return "-";
  if (isJump(r.event)) { const d = getBestDistance(r); return d ? `${d.toFixed(2)} m` : "-"; }
  const t = getBestTime(r); return t ? t + " 秒" : "-";
};

const getPB = (records) => {
  const pb = {};
  [...records].sort((a, b) => a.date.localeCompare(b.date)).forEach((r) => {
    const k = r.event;
    if (isJump(k)) {
      const d = getBestDistance(r);
      if (!pb[k]) { pb[k] = r; return; }
      const pd = getBestDistance(pb[k]);
      if (d && (!pd || d > pd)) pb[k] = r;
    } else {
      if (!pb[k]) { pb[k] = r; return; }
      const s = timeToSec(getBestTime(r)), ps = timeToSec(getBestTime(pb[k]));
      if (s && ps && s < ps) pb[k] = r;
    }
  });
  return pb;
};

const emptyTrial = () => ({ foul: false, distance: "", feel: "", note: "" });
const emptyRound = () => ({ round: "予選", time: "", windDir: "追い風", windSpeed: "", note: "" });

// ── サンプルデータ ────────────────────────────────────────────────────────────
const SAMPLE_RECORDS = [
  {
    id: "s1", date: "2024-06-22", event: "100m", gender: "男子", venue: "県立競技場", meet: "地区大会",
    weather: "晴れ", startPos: "", steps: "", notes: "決勝で自己ベスト！",
    rounds: [
      { round: "予選",   time: "11.35", windDir: "追い風", windSpeed: "1.2", note: "余裕を持って通過" },
      { round: "準決勝", time: "11.28", windDir: "追い風", windSpeed: "0.9", note: "少し上げた" },
      { round: "決勝",   time: "11.21", windDir: "追い風", windSpeed: "1.8", note: "全力！PB更新" },
    ],
  },
  {
    id: "s2", date: "2024-10-12", event: "100m", gender: "男子", venue: "県立競技場", meet: "秋季大会",
    weather: "晴れ", startPos: "", steps: "", notes: "今シーズンベスト",
    rounds: [
      { round: "予選",   time: "11.18", windDir: "追い風", windSpeed: "1.5", note: "調子良い" },
      { round: "決勝",   time: "11.05", windDir: "追い風", windSpeed: "2.0", note: "シーズンベスト！" },
    ],
  },
  {
    id: "s6", date: "2024-04-10", event: "long_jump", gender: "男子", venue: "市営陸上競技場", meet: "春季記録会",
    weather: "晴れ", windDir: "追い風", windSpeed: "1.2", startPos: "38", steps: "18",
    notes: "踏切がズレた。スタート位置を見直したい。",
    trials: [
      { foul: true,  distance: "",     feel: "bad",     note: "踏切板を越えてしまった" },
      { foul: false, distance: "6.02", feel: "off",     note: "ズレたが何とか踏んだ" },
      { foul: false, distance: "6.12", feel: "good",    note: "少し合ってきた" },
      { foul: false, distance: "5.98", feel: "off",     note: "疲れてきた" },
      { foul: true,  distance: "",     feel: "bad",     note: "また越えた" },
      { foul: false, distance: "6.05", feel: "good",    note: "最後は合った" },
    ],
  },
  {
    id: "s7", date: "2024-10-12", event: "long_jump", gender: "男子", venue: "県立競技場", meet: "秋季大会",
    weather: "晴れ", windDir: "追い風", windSpeed: "2.0", startPos: "40", steps: "20",
    notes: "PB更新！踏切がはまった日。",
    trials: [
      { foul: false, distance: "6.55", feel: "good",    note: "まずまず" },
      { foul: false, distance: "6.78", feel: "perfect", note: "全部合った！今季最高" },
      { foul: true,  distance: "",     feel: "off",     note: "攻めすぎてファウル" },
      { foul: false, distance: "6.61", feel: "good",    note: "安定" },
      { foul: false, distance: "6.70", feel: "good",    note: "いい感じ" },
      { foul: false, distance: "6.65", feel: "good",    note: "最後も安定" },
    ],
  },
  {
    id: "s9", date: "2024-10-12", event: "shot_put", gender: "男子", venue: "県立競技場", meet: "秋季大会",
    weather: "曇り", notes: "後半リリースが安定してきた。",
    trials: [
      { foul: false, distance: "12.40", feel: "off",     note: "突き出しが詰まった" },
      { foul: true,  distance: "",      feel: "bad",     note: "足が出てファウル" },
      { foul: false, distance: "13.15", feel: "good",    note: "リリース良い" },
      { foul: false, distance: "13.02", feel: "good",    note: "安定" },
      { foul: false, distance: "13.55", feel: "perfect", note: "完璧な突き出し！自己ベスト" },
      { foul: false, distance: "13.20", feel: "good",    note: "最後もまとめた" },
    ],
  },
];

// ── スタイル ──────────────────────────────────────────────────────────────────
const inputStyle = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const btnBase   = { border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700 };

// ── 共通コンポーネント ────────────────────────────────────────────────────────
// アプリアイコン：陸上トラック＋「龍」
function AppIcon({ size = 40 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: `linear-gradient(145deg, ${C.accent} 0%, ${C.run} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}>
      <svg width={size * 0.78} height={size * 0.78} viewBox="0 0 100 100" fill="none">
        {/* 陸上トラック（オーバル） */}
        <ellipse cx="50" cy="50" rx="40" ry="30" stroke="#0d0f14" strokeWidth="6" fill="none" opacity="0.35" />
        <ellipse cx="50" cy="50" rx="28" ry="19" stroke="#0d0f14" strokeWidth="4" fill="none" opacity="0.25" />
        {/* 龍 の文字 */}
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize="46" fontWeight="900" fill="#0d0f14" fontFamily="'Hiragino Mincho ProN','Yu Mincho',serif">龍</text>
      </svg>
    </div>
  );
}

function Tag({ color, children }) {
  return <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 4, padding: "1px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }}>{children}</span>;
}
function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}
function SectionLabel({ children }) {
  return <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{children}</p>;
}

// ── 走種目：ラウンド入力行 ────────────────────────────────────────────────────
function RoundRow({ idx, round, onChange, onRemove }) {
  const set = (k, v) => onChange({ ...round, [k]: v });
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <select style={{ ...inputStyle, width: "auto", flex: 1 }} value={round.round} onChange={(e) => set("round", e.target.value)}>
          {ROUND_OPTIONS.map((r) => <option key={r}>{r}</option>)}
        </select>
        <button onClick={onRemove} style={{ ...btnBase, background: "none", border: "none", color: C.muted, fontSize: 20, padding: "0 6px" }}>×</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field label="タイム">
          <input style={inputStyle} placeholder="10.58 / 2:05.34" value={round.time} onChange={(e) => set("time", e.target.value)} />
        </Field>
        <Field label="風向き">
          <select style={inputStyle} value={round.windDir} onChange={(e) => set("windDir", e.target.value)}>
            {WIND_DIR.map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="風速 (m/s)">
          <input style={inputStyle} type="number" step="0.1" placeholder="1.5" value={round.windSpeed} onChange={(e) => set("windSpeed", e.target.value)} />
        </Field>
      </div>
      <Field label="メモ">
        <input style={inputStyle} placeholder="感触・戦略など" value={round.note} onChange={(e) => set("note", e.target.value)} />
      </Field>
    </div>
  );
}

// ── 跳躍・投擲：試技入力行 ────────────────────────────────────────────────────
function TrialRow({ idx, trial, onChange, onRemove, feelLabelText = "踏切の感覚" }) {
  const set = (k, v) => onChange({ ...trial, [k]: v });
  return (
    <div style={{ background: trial.foul ? C.danger + "11" : C.bg, border: `1px solid ${trial.foul ? C.danger + "44" : C.border}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.muted, minWidth: 36 }}>第{idx + 1}試技</span>
        <button onClick={() => set("foul", !trial.foul)}
          style={{ ...btnBase, background: trial.foul ? C.danger : C.card, color: trial.foul ? "#fff" : C.muted, border: `1px solid ${trial.foul ? C.danger : C.border}`, padding: "4px 12px", fontSize: 12 }}>
          {trial.foul ? "⛔ ファウル" : "ファウル"}
        </button>
        <button onClick={onRemove} style={{ ...btnBase, background: "none", border: "none", color: C.muted, fontSize: 20, padding: "0 6px", marginLeft: "auto" }}>×</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: trial.foul ? "1fr" : "1fr 1fr", gap: 10 }}>
        {!trial.foul && (
          <Field label="距離 (m)">
            <input style={inputStyle} type="number" step="0.01" placeholder="6.78" value={trial.distance} onChange={(e) => set("distance", e.target.value)} />
          </Field>
        )}
        <Field label={feelLabelText}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {FEEL_OPTIONS.map((f) => (
              <button key={f.val} onClick={() => set("feel", trial.feel === f.val ? "" : f.val)}
                style={{ ...btnBase, background: trial.feel === f.val ? f.color + "33" : C.card, color: trial.feel === f.val ? f.color : C.muted, border: `1px solid ${trial.feel === f.val ? f.color : C.border}`, padding: "4px 9px", fontSize: 11 }}>
                {f.label}
              </button>
            ))}
          </div>
        </Field>
      </div>
      <Field label="メモ">
        <input style={inputStyle} placeholder="感覚・気づきなど" value={trial.note} onChange={(e) => set("note", e.target.value)} />
      </Field>
    </div>
  );
}

// ── 記録フォーム ──────────────────────────────────────────────────────────────
function RecordForm({ onSave, onCancel, initial }) {
  const empty = {
    date: new Date().toISOString().slice(0, 10),
    event: "100m", gender: "男子", venue: "", meet: "", weather: "晴れ",
    windDir: "追い風", windSpeed: "",
    time: "", distance: "", startPos: "", steps: "", notes: "",
    rounds: [], trials: [],
  };
  const [form, setForm] = useState(initial ?? empty);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const jump       = isJump(form.event);
  const trialJump  = isTrialJump(form.event);
  const run        = isRun(form.event);
  const thrown     = isThrow(form.event);
  const runwayJump = isRunwayJump(form.event);

  const addRound  = () => { if (form.rounds.length < 10) set("rounds", [...form.rounds, emptyRound()]); };
  const updRound  = (i, v) => set("rounds", form.rounds.map((x, j) => j === i ? v : x));
  const delRound  = (i) => set("rounds", form.rounds.filter((_, j) => j !== i));

  const addTrial  = () => { if (form.trials.length < MAX_JUMP_TRIALS) set("trials", [...form.trials, emptyTrial()]); };
  const updTrial  = (i, v) => set("trials", form.trials.map((x, j) => j === i ? v : x));
  const delTrial  = (i) => set("trials", form.trials.filter((_, j) => j !== i));

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>{initial ? "記録を編集" : "新しい記録"}</h2>

      {/* 基本情報 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="日付"><input type="date" style={inputStyle} value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="種目">
          <select style={inputStyle} value={form.event} onChange={(e) => set("event", e.target.value)}>
            <optgroup label="走種目">{EVENTS.run.map((ev) => <option key={ev.id} value={ev.id}>{ev.label}</option>)}</optgroup>
            <optgroup label="跳躍種目">{EVENTS.jump.map((ev) => <option key={ev.id} value={ev.id}>{ev.label}</option>)}</optgroup>
            <optgroup label="投擲種目">{EVENTS.throw.map((ev) => <option key={ev.id} value={ev.id}>{ev.label}</option>)}</optgroup>
          </select>
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="性別">
          <div style={{ display: "flex", gap: 8 }}>
            {["男子", "女子"].map((g) => (
              <button key={g} onClick={() => set("gender", g)}
                style={{ ...btnBase, flex: 1, padding: "8px 0", fontSize: 13, background: form.gender === g ? C.accent : C.bg, color: form.gender === g ? "#0d0f14" : C.text, border: `1px solid ${form.gender === g ? C.accent : C.border}` }}>
                {g}
              </button>
            ))}
          </div>
        </Field>
        <Field label="競技場"><input style={inputStyle} placeholder="例: 国立競技場" value={form.venue} onChange={(e) => set("venue", e.target.value)} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <Field label="大会名（任意）"><input style={inputStyle} placeholder="例: 全国陸上" value={form.meet} onChange={(e) => set("meet", e.target.value)} /></Field>
      </div>

      {/* 天候（跳躍は風あり・走種目と投擲はラウンド/別管理なので簡略） */}
      <div style={{ background: C.bg, borderRadius: 10, padding: 14, display: "grid", gridTemplateColumns: (run || thrown) ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
        <Field label="天候">
          <select style={inputStyle} value={form.weather} onChange={(e) => set("weather", e.target.value)}>
            {WEATHER_OPTIONS.map((w) => <option key={w}>{w}</option>)}
          </select>
        </Field>
        {!run && !thrown && (
          <>
            <Field label="風向き">
              <select style={inputStyle} value={form.windDir} onChange={(e) => set("windDir", e.target.value)}>
                {WIND_DIR.map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="風速 (m/s)">
              <input style={inputStyle} type="number" step="0.1" placeholder="2.5" value={form.windSpeed} onChange={(e) => set("windSpeed", e.target.value)} />
            </Field>
          </>
        )}
      </div>

      {/* 走高跳・棒高跳（試技UIなし・高さ1つ） */}
      {jump && !trialJump && (
        <Field label="記録 (m)">
          <input style={inputStyle} type="number" step="0.01" placeholder="1.85" value={form.distance} onChange={(e) => set("distance", e.target.value)} />
        </Field>
      )}

      {/* 助走情報（走幅跳・三段跳・走高跳・棒高跳のみ。投擲は対象外） */}
      {runwayJump && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="助走スタート位置 (m)">
            <input style={inputStyle} type="number" step="0.5" placeholder="40.0" value={form.startPos} onChange={(e) => set("startPos", e.target.value)} />
          </Field>
          <Field label="助走歩数">
            <input style={inputStyle} type="number" placeholder="20" value={form.steps} onChange={(e) => set("steps", e.target.value)} />
          </Field>
        </div>
      )}

      {/* ── 走種目：ラウンド（予選・準決・決勝…） ── */}
      {run && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <SectionLabel>ラウンド別タイム</SectionLabel>
            <button onClick={addRound}
              style={{ ...btnBase, background: C.run + "22", color: C.run, border: `1px solid ${C.run}44`, padding: "5px 14px", fontSize: 12 }}>
              ＋ ラウンドを追加
            </button>
          </div>
          {form.rounds.length === 0 && <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>予選・準決勝・決勝など、ラウンドごとに追加できます</p>}
          {form.rounds.map((rd, i) => <RoundRow key={i} idx={i} round={rd} onChange={(v) => updRound(i, v)} onRemove={() => delRound(i)} />)}
        </div>
      )}

      {/* ── 走幅跳・三段跳：試技（最大6本） ── */}
      {trialJump && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <SectionLabel>試技ごとの記録（最大6本）</SectionLabel>
            <button onClick={addTrial} disabled={form.trials.length >= MAX_JUMP_TRIALS}
              style={{ ...btnBase, background: form.trials.length >= MAX_JUMP_TRIALS ? C.border : C.jump + "22", color: form.trials.length >= MAX_JUMP_TRIALS ? C.muted : C.jump, border: `1px solid ${form.trials.length >= MAX_JUMP_TRIALS ? C.border : C.jump + "44"}`, padding: "5px 14px", fontSize: 12 }}>
              ＋ 試技を追加 ({form.trials.length}/{MAX_JUMP_TRIALS})
            </button>
          </div>
          {form.trials.length === 0 && <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>「＋ 試技を追加」で1本ずつ記録できます（最大6本）</p>}
          {form.trials.map((t, i) => <TrialRow key={i} idx={i} trial={t} onChange={(v) => updTrial(i, v)} onRemove={() => delTrial(i)} feelLabelText={thrown ? "投げの感覚" : "踏切の感覚"} />)}
        </div>
      )}

      {/* 総合メモ */}
      <Field label="総合メモ・感想">
        <textarea style={{ ...inputStyle, minHeight: 72, resize: "vertical" }} placeholder="試技・レース全体を通じた感想・課題など" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ ...btnBase, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, padding: "9px 20px" }}>キャンセル</button>
        <button onClick={() => onSave({ ...form, id: initial?.id ?? Date.now().toString() })}
          style={{ ...btnBase, background: C.accent, color: "#0d0f14", padding: "9px 24px", fontWeight: 800 }}>保存</button>
      </div>
    </div>
  );
}

// ── ラウンドサマリー表示 ──────────────────────────────────────────────────────
function RoundsSummary({ rounds }) {
  if (!rounds?.length) return null;
  const times = rounds.map((r) => timeToSec(r.time)).filter(Boolean);
  const best  = times.length ? Math.min(...times) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
      {rounds.map((rd, i) => {
        const sec = timeToSec(rd.time);
        const isBest = sec && sec === best;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: C.bg, borderRadius: 8, padding: "7px 12px", border: `1px solid ${isBest ? C.accent + "55" : C.border}` }}>
            <span style={{ fontSize: 11, background: C.run + "22", color: C.run, border: `1px solid ${C.run}33`, borderRadius: 4, padding: "1px 7px", fontWeight: 700 }}>{rd.round}</span>
            <span style={{ fontWeight: 900, fontSize: 16, color: isBest ? C.accent : C.text, fontVariantNumeric: "tabular-nums" }}>
              {rd.time || "-"}{rd.time && " 秒"}
              {isBest && <span style={{ fontSize: 10, color: C.accent, marginLeft: 5 }}>BEST</span>}
            </span>
            {rd.windDir && <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>💨 {rd.windDir}{rd.windSpeed ? ` ${rd.windSpeed}m/s` : ""}</span>}
            {rd.note && <span style={{ fontSize: 11, color: C.muted }}>— {rd.note}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── 試技サマリー表示 ──────────────────────────────────────────────────────────
function TrialsSummary({ trials }) {
  if (!trials?.length) return null;
  const dists = trials.filter((t) => !t.foul && t.distance).map((t) => parseFloat(t.distance));
  const best  = dists.length ? Math.max(...dists) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
      {trials.map((t, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: t.foul ? C.danger + "11" : C.bg, borderRadius: 8, padding: "7px 12px", border: `1px solid ${t.foul ? C.danger + "33" : (parseFloat(t.distance) === best ? C.accent + "55" : C.border)}` }}>
          <span style={{ fontSize: 11, color: C.muted, minWidth: 32 }}>第{i + 1}</span>
          {t.foul
            ? <span style={{ fontWeight: 800, color: C.danger, fontSize: 13 }}>⛔ ファウル</span>
            : <span style={{ fontWeight: 900, color: parseFloat(t.distance) === best ? C.accent : C.text, fontSize: 16, fontVariantNumeric: "tabular-nums" }}>
                {t.distance ? `${parseFloat(t.distance).toFixed(2)} m` : "-"}
                {parseFloat(t.distance) === best && <span style={{ fontSize: 10, color: C.accent, marginLeft: 4 }}>BEST</span>}
              </span>
          }
          {t.feel && <span style={{ fontSize: 11, color: feelColor(t.feel), border: `1px solid ${feelColor(t.feel)}44`, borderRadius: 4, padding: "1px 7px", marginLeft: "auto" }}>{feelLabel(t.feel)}</span>}
          {t.note && <span style={{ fontSize: 11, color: C.muted }}>{t.feel ? "— " : ""}{t.note}</span>}
        </div>
      ))}
    </div>
  );
}

// ── 記録カード ────────────────────────────────────────────────────────────────
function RecordCard({ rec, onEdit, onDelete }) {
  const jump      = isJump(rec.event);
  const thrown    = isThrow(rec.event);
  const runwayJump = isRunwayJump(rec.event);
  const trialJump = isTrialJump(rec.event);
  const run       = isRun(rec.event);
  const color     = thrown ? "#c084fc" : jump ? C.jump : C.run;
  const [expanded, setExpanded] = useState(false);
  const hasFoul   = rec.trials?.some((t) => t.foul);
  const roundCount = rec.rounds?.length ?? 0;
  const trialCount = rec.trials?.length ?? 0;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Tag color={color}>{evLabel(rec.event)}</Tag>
        {rec.gender && <Tag color={C.muted}>{rec.gender}</Tag>}
        {rec.meet && <Tag color={C.accent}>{rec.meet}</Tag>}
        {hasFoul && <Tag color={C.danger}>ファウルあり</Tag>}
        <span style={{ marginLeft: "auto", fontSize: 12, color: C.muted }}>{fmtDate(rec.date)}</span>
      </div>

      {/* ベスト記録 */}
      <div style={{ fontSize: 32, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{fmtResult(rec)}</div>

      {/* サブ情報 */}
      <div style={{ display: "flex", gap: 12, fontSize: 12, color: C.muted, flexWrap: "wrap" }}>
        {rec.venue && <span>📍 {rec.venue}</span>}
        {rec.weather && <span>🌤 {rec.weather}</span>}
        {runwayJump && rec.windDir && <span>💨 {rec.windDir}{rec.windSpeed ? ` ${rec.windSpeed}m/s` : ""}</span>}
        {runwayJump && rec.startPos && <span>🏃 スタート {rec.startPos}m地点</span>}
        {runwayJump && rec.steps && <span>👣 {rec.steps}歩</span>}
        {run && roundCount > 0 && <span>🏁 {roundCount}ラウンド</span>}
        {trialJump && trialCount > 0 && <span>{trialCount}本中{rec.trials.filter((t) => t.foul).length}ファウル</span>}
      </div>

      {/* 展開ボタン */}
      {run && roundCount > 0 && (
        <div>
          <button onClick={() => setExpanded((v) => !v)}
            style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, padding: 0 }}>
            {expanded ? "▲ ラウンドを閉じる" : `▼ ラウンドを見る（${roundCount}本）`}
          </button>
          {expanded && <RoundsSummary rounds={rec.rounds} />}
        </div>
      )}
      {trialJump && trialCount > 0 && (
        <div>
          <button onClick={() => setExpanded((v) => !v)}
            style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, padding: 0 }}>
            {expanded ? "▲ 試技を閉じる" : `▼ 試技を見る（${trialCount}本）`}
          </button>
          {expanded && <TrialsSummary trials={rec.trials} />}
        </div>
      )}

      {rec.notes && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, background: C.bg, borderRadius: 8, padding: "9px 12px" }}>{rec.notes}</p>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={() => onEdit(rec)} style={{ ...btnBase, background: "none", border: `1px solid ${C.border}`, color: C.muted, padding: "4px 12px", fontSize: 12 }}>編集</button>
        <button onClick={() => onDelete(rec.id)} style={{ ...btnBase, background: "none", border: `1px solid ${C.danger}33`, color: C.danger, padding: "4px 12px", fontSize: 12 }}>削除</button>
      </div>
    </div>
  );
}

// ── グラフページ ──────────────────────────────────────────────────────────────
function GraphPage({ records }) {
  const [selEvent, setSelEvent] = useState("100m");
  const jump = isJump(selEvent);
  const lineColor = isThrow(selEvent) ? "#c084fc" : jump ? C.jump : C.run;

  const evRecs = [...records]
    .filter((r) => r.event === selEvent)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      const val = jump ? getBestDistance(r) : timeToSec(getBestTime(r));
      return { ...r, val, label: fmtDate(r.date) };
    }).filter((r) => r.val != null);

  const vals = evRecs.map((r) => r.val);
  const best = jump ? Math.max(...vals) : Math.min(...vals);
  const worst = jump ? Math.min(...vals) : Math.max(...vals);
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
  const improvement = vals.length >= 2 ? (jump ? vals[vals.length - 1] - vals[0] : vals[0] - vals[vals.length - 1]).toFixed(2) : null;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
        <div style={{ color: C.muted, marginBottom: 4 }}>{d.label}{d.meet ? ` — ${d.meet}` : ""}</div>
        <div style={{ fontWeight: 900, fontSize: 18, color: C.accent }}>{fmtResult(d)}</div>
        {d.rounds?.length > 0 && <div style={{ color: C.muted, marginTop: 4 }}>{d.rounds.length}ラウンド</div>}
        {d.trials?.some((t) => t.foul) && <div style={{ color: C.danger, marginTop: 2 }}>ファウル {d.trials.filter((t) => t.foul).length}本</div>}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {ALL_EVENTS.map((ev) => {
          const has = records.some((r) => r.event === ev.id);
          return (
            <button key={ev.id} onClick={() => setSelEvent(ev.id)}
              style={{ ...btnBase, background: selEvent === ev.id ? C.accent : C.card, color: selEvent === ev.id ? "#0d0f14" : has ? C.text : C.muted, border: `1px solid ${selEvent === ev.id ? C.accent : C.border}`, padding: "6px 14px", fontSize: 13, opacity: has ? 1 : 0.4 }}>
              {ev.label}
            </button>
          );
        })}
      </div>

      {evRecs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <p style={{ margin: 0 }}>{evLabel(selEvent)} の記録がまだありません</p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
            {[
              { label: "記録数", val: vals.length + "回" },
              { label: jump ? "ベスト" : "最速", val: jump ? `${best.toFixed(2)}m` : secToDisplay(best) },
              { label: "平均", val: jump ? `${avg}m` : secToDisplay(parseFloat(avg)) },
              { label: "伸び", val: improvement ? (improvement > 0 ? `+${improvement}` : improvement) + (jump ? "m" : "秒") : "-" },
            ].map((s) => (
              <div key={s.label} style={{ background: C.card, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{s.val}</div>
              </div>
            ))}
          </div>
          <div style={{ background: C.card, borderRadius: 12, padding: 20 }}>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: C.muted }}>{jump ? "ベスト距離推移 (m)" : "ベストタイム推移 (秒)"}</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={evRecs} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid stroke={C.border} strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} axisLine={false}
                  domain={jump ? [Math.floor((worst - 0.1) * 10) / 10, Math.ceil((best + 0.1) * 10) / 10]
                    : [Math.floor((best - 0.3) * 10) / 10, Math.ceil((worst + 0.3) * 10) / 10]} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={best} stroke={C.accent} strokeDasharray="4 2" strokeWidth={1} />
                <Line type="monotone" dataKey="val" stroke={lineColor} strokeWidth={2.5}
                  dot={{ fill: lineColor, r: 5, strokeWidth: 0 }} activeDot={{ r: 7, fill: C.accent }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ── 大会内の1種目カード ──────────────────────────────────────────────────────
function MeetEventCard({ r }) {
  const jump = isJump(r.event), trialJump = isTrialJump(r.event), run = isRun(r.event);
  const thrown = isThrow(r.event), runwayJump = isRunwayJump(r.event);
  const color = thrown ? "#c084fc" : jump ? C.jump : C.run;
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: C.card, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Tag color={color}>{evLabel(r.event)}</Tag>
        {r.gender && <Tag color={C.muted}>{r.gender}</Tag>}
        {r.trials?.some((t) => t.foul) && <Tag color={C.danger}>ファウルあり</Tag>}
        <span style={{ fontSize: 28, fontWeight: 900, marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{fmtResult(r)}</span>
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 12, color: C.muted, flexWrap: "wrap" }}>
        {r.weather && <span>🌤 {r.weather}</span>}
        {runwayJump && r.windDir && <span>💨 {r.windDir}{r.windSpeed ? ` ${r.windSpeed}m/s` : ""}</span>}
        {runwayJump && r.startPos && <span>🏃 {r.startPos}m地点</span>}
        {runwayJump && r.steps && <span>👣 {r.steps}歩</span>}
        {run && r.rounds?.length > 0 && <span>🏁 {r.rounds.length}ラウンド</span>}
      </div>
      {(run && r.rounds?.length > 0) && (
        <div>
          <button onClick={() => setOpen((v) => !v)}
            style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, padding: 0 }}>
            {open ? "▲ ラウンドを閉じる" : `▼ ラウンド詳細（${r.rounds.length}本）`}
          </button>
          {open && <RoundsSummary rounds={r.rounds} />}
        </div>
      )}
      {(trialJump && r.trials?.length > 0) && (
        <div>
          <button onClick={() => setOpen((v) => !v)}
            style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, padding: 0 }}>
            {open ? "▲ 試技を閉じる" : `▼ 試技詳細（${r.trials.length}本）`}
          </button>
          {open && <TrialsSummary trials={r.trials} />}
        </div>
      )}
      {r.notes && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, background: C.bg, borderRadius: 8, padding: "8px 12px" }}>{r.notes}</p>}
    </div>
  );
}

// ── 大会まとめページ ──────────────────────────────────────────────────────────
function MeetsPage({ records }) {
  const meetNames = [...new Set(records.map((r) => r.meet).filter(Boolean))].sort();
  const [selMeet, setSelMeet] = useState(meetNames[0] ?? null);
  useEffect(() => { if (!selMeet && meetNames.length) setSelMeet(meetNames[0]); }, [meetNames.length]);

  const meetRecs = selMeet ? records.filter((r) => r.meet === selMeet).sort((a, b) => a.date.localeCompare(b.date)) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {!meetNames.length ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
          <p style={{ margin: 0 }}>大会名を入力した記録がまだありません</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {meetNames.map((m) => (
              <button key={m} onClick={() => setSelMeet(m)}
                style={{ ...btnBase, padding: "7px 16px", fontSize: 13, background: selMeet === m ? C.accent : C.card, color: selMeet === m ? "#0d0f14" : C.text, border: `1px solid ${selMeet === m ? C.accent : C.border}` }}>
                {m}
              </button>
            ))}
          </div>
          {selMeet && (
            <>
              <div style={{ background: C.card, borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>🏆 {selMeet}</div>
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: C.muted }}>
                  {meetRecs[0]?.venue && <span>📍 {meetRecs[0].venue}</span>}
                  {meetRecs[0]?.date && <span>📅 {fmtDate(meetRecs[0].date)}</span>}
                  <span>{meetRecs.length}種目</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {meetRecs.map((r) => <MeetEventCard key={r.id} r={r} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── AI分析ページ ──────────────────────────────────────────────────────────────
function AIPage({ records }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selEvent, setSelEvent] = useState("all");
  const eventsWithData = ALL_EVENTS.filter((ev) => records.some((r) => r.event === ev.id));

  const analyze = useCallback(async () => {
    setLoading(true); setError(null); setResult(null);
    const target = selEvent === "all" ? records : records.filter((r) => r.event === selEvent);
    if (!target.length) { setError("対象の記録がありません。"); setLoading(false); return; }

    const pb = getPB(records);
    const pbSummary = Object.entries(pb).map(([ev, r]) => `${evLabel(ev)}: ${fmtResult(r)} (${fmtDate(r.date)})`).join("\n");

    const recSummary = target.slice(0, 30).map((r) => {
      const thrown = isThrow(r.event);
      const roundStr = r.rounds?.length
        ? r.rounds.map((rd) => `  ${rd.round}: ${rd.time || "-"} ${rd.windDir || ""}${rd.windSpeed ? rd.windSpeed + "m/s" : ""} ${rd.note || ""}`).join("\n")
        : "";
      const feelTitle = thrown ? "投げの感覚" : "踏切感覚";
      const trialStr = r.trials?.length
        ? r.trials.map((t, i) => `  第${i + 1}試技: ${t.foul ? "ファウル" : t.distance + "m"} ${feelTitle}:${feelLabel(t.feel) || "未記入"} ${t.note || ""}`).join("\n")
        : "";
      return `[${fmtDate(r.date)}] ${r.gender || ""}${evLabel(r.event)} ベスト:${fmtResult(r)} 天候:${r.weather} メモ:${r.notes || "なし"}\n${roundStr}${trialStr}`;
    }).join("\n\n");

    const prompt = `あなたは陸上競技のコーチです。以下の選手の記録を分析して日本語でアドバイスしてください。

## 自己ベスト
${pbSummary}

## 記録ログ
${recSummary}

以下の観点で分析してください：
1. **記録の傾向**：伸びている点・停滞している点
2. **大会でのラウンド別パターン**（走種目）：予選→決勝の変化・消耗の傾向
3. **ファウルのパターン**（跳躍・投擲）：ファウルが多い状況・原因の推測
4. **踏切・投げの感覚と記録の関係**（跳躍・投擲）
5. **次の練習で取り組むべきこと**（具体的に3点）

選手が実際に使えるアドバイスを、励ましながら具体的に伝えてください。`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      const text = data.content?.map((b) => b.text || "").join("") ?? "";
      if (!text) throw new Error("応答が空でした");
      setResult(text);
    } catch (e) {
      setError("分析に失敗しました: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [records, selEvent]);

  const renderText = (text) =>
    text.split("\n").map((line, i) => {
      if (line.startsWith("## ")) return <h3 key={i} style={{ color: C.accent, fontSize: 15, margin: "16px 0 6px", fontWeight: 800 }}>{line.slice(3)}</h3>;
      const parts = line.split(/\*\*(.*?)\*\*/g);
      if (parts.length > 1) return <p key={i} style={{ margin: "4px 0", fontSize: 14, lineHeight: 1.7 }}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: C.accent }}>{p}</strong> : p)}</p>;
      if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
      return <p key={i} style={{ margin: "3px 0", fontSize: 14, lineHeight: 1.7 }}>{line}</p>;
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: C.card, borderRadius: 12, padding: 20 }}>
        <SectionLabel>分析対象</SectionLabel>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <button onClick={() => setSelEvent("all")}
            style={{ ...btnBase, padding: "7px 16px", fontSize: 13, background: selEvent === "all" ? C.accent : C.bg, color: selEvent === "all" ? "#0d0f14" : C.text, border: `1px solid ${selEvent === "all" ? C.accent : C.border}` }}>
            全種目
          </button>
          {eventsWithData.map((ev) => (
            <button key={ev.id} onClick={() => setSelEvent(ev.id)}
              style={{ ...btnBase, padding: "7px 16px", fontSize: 13, background: selEvent === ev.id ? C.accent : C.bg, color: selEvent === ev.id ? "#0d0f14" : C.text, border: `1px solid ${selEvent === ev.id ? C.accent : C.border}` }}>
              {ev.label}
            </button>
          ))}
        </div>
        <button onClick={analyze} disabled={loading || !records.length}
          style={{ ...btnBase, background: loading ? C.border : C.accent, color: loading ? C.muted : "#0d0f14", padding: "12px 28px", fontSize: 15, fontWeight: 900, width: "100%", opacity: records.length === 0 ? 0.4 : 1 }}>
          {loading ? "⏳ AIが分析中..." : "🤖 AIに分析してもらう"}
        </button>
      </div>
      {error && <div style={{ background: C.danger + "22", border: `1px solid ${C.danger}44`, borderRadius: 10, padding: 14, color: C.danger, fontSize: 13 }}>⚠️ {error}</div>}
      {result && (
        <div style={{ background: C.card, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ background: C.accent, color: "#0d0f14", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 800 }}>AI分析レポート</div>
            <span style={{ fontSize: 12, color: C.muted }}>{selEvent === "all" ? "全種目" : evLabel(selEvent)}</span>
          </div>
          <div>{renderText(result)}</div>
        </div>
      )}
    </div>
  );
}

// ── 個人カルテ ────────────────────────────────────────────────────────────────
const KARTE_KEY = "tracklog_karte_v1";

// 筋力測定項目（体力テスト系）
const STRENGTH_FIELDS = [
  { id: "grip_r",   label: "握力（右）", unit: "kg" },
  { id: "grip_l",   label: "握力（左）", unit: "kg" },
  { id: "back",     label: "背筋力",     unit: "kg" },
  { id: "sit_reach",label: "長座体前屈", unit: "cm" },
  { id: "vertical", label: "垂直跳び",   unit: "cm" },
];
// ウエイト（挙上重量）項目
const LIFT_FIELDS = [
  { id: "bench",    label: "ベンチプレス",   unit: "kg" },
  { id: "squat",    label: "スクワット",     unit: "kg" },
  { id: "deadlift", label: "デッドリフト",   unit: "kg" },
  { id: "clean",    label: "クリーン",       unit: "kg" },
  { id: "snatch",   label: "スナッチ",       unit: "kg" },
];
const ALL_MEASURE_FIELDS = [...STRENGTH_FIELDS, ...LIFT_FIELDS];

const ageFromBirth = (birth) => {
  if (!birth) return null;
  const b = new Date(birth), now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 150 ? age : null;
};

// 測定セッション入力フォーム
function MeasureForm({ onSave, onCancel, initial }) {
  const empty = { date: new Date().toISOString().slice(0, 10), height: "", weight: "", values: {}, note: "" };
  const [form, setForm] = useState(initial ?? empty);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setVal = (id, v) => setForm((f) => ({ ...f, values: { ...f.values, [id]: v } }));

  const renderGroup = (title, fields) => (
    <div style={{ background: C.bg, borderRadius: 10, padding: 14 }}>
      <SectionLabel>{title}</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {fields.map((f) => (
          <Field key={f.id} label={`${f.label} (${f.unit})`}>
            <input style={inputStyle} type="number" step="0.1" placeholder="-"
              value={form.values[f.id] ?? ""} onChange={(e) => setVal(f.id, e.target.value)} />
          </Field>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>{initial ? "測定を編集" : "測定を記録"}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="測定日"><input type="date" style={inputStyle} value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="身長 (cm)"><input style={inputStyle} type="number" step="0.1" placeholder="170" value={form.height} onChange={(e) => set("height", e.target.value)} /></Field>
        <Field label="体重 (kg)"><input style={inputStyle} type="number" step="0.1" placeholder="60" value={form.weight} onChange={(e) => set("weight", e.target.value)} /></Field>
      </div>
      {renderGroup("筋力・体力測定", STRENGTH_FIELDS)}
      {renderGroup("ウエイト（挙上重量）", LIFT_FIELDS)}
      <Field label="メモ">
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder="コンディション・気づきなど" value={form.note} onChange={(e) => set("note", e.target.value)} />
      </Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ ...btnBase, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, padding: "9px 20px" }}>キャンセル</button>
        <button onClick={() => onSave({ ...form, id: initial?.id ?? Date.now().toString() })}
          style={{ ...btnBase, background: C.accent, color: "#0d0f14", padding: "9px 24px", fontWeight: 800 }}>保存</button>
      </div>
    </div>
  );
}

function KartePage() {
  const [karte, setKarte] = useState(() => {
    try { const s = localStorage.getItem(KARTE_KEY); return s ? JSON.parse(s) : { profile: { name: "", birth: "", gender: "男子" }, measures: [] }; }
    catch { return { profile: { name: "", birth: "", gender: "男子" }, measures: [] }; }
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState(karte.profile);
  const [measureView, setMeasureView] = useState("list"); // list | new | edit
  const [editingMeasure, setEditingMeasure] = useState(null);
  const [graphField, setGraphField] = useState("bench");

  useEffect(() => { localStorage.setItem(KARTE_KEY, JSON.stringify(karte)); }, [karte]);

  const saveProfile = () => { setKarte((k) => ({ ...k, profile: profileDraft })); setEditingProfile(false); };
  const saveMeasure = (m) => {
    setKarte((k) => {
      const idx = k.measures.findIndex((x) => x.id === m.id);
      const measures = idx >= 0 ? k.measures.map((x) => x.id === m.id ? m : x) : [m, ...k.measures];
      return { ...k, measures };
    });
    setMeasureView("list"); setEditingMeasure(null);
  };
  const deleteMeasure = (id) => {
    if (!window.confirm("この測定記録を削除しますか？")) return;
    setKarte((k) => ({ ...k, measures: k.measures.filter((m) => m.id !== id) }));
  };

  const measures = [...karte.measures].sort((a, b) => b.date.localeCompare(a.date));
  const latest = measures[0];
  const age = ageFromBirth(karte.profile.birth);

  // グラフ用データ
  const graphData = [...karte.measures]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ label: fmtDate(m.date), val: parseFloat(m.values?.[graphField]) || null }))
    .filter((d) => d.val != null);
  const fieldDef = ALL_MEASURE_FIELDS.find((f) => f.id === graphField);

  if (measureView === "new" || measureView === "edit") {
    return <MeasureForm initial={editingMeasure} onSave={saveMeasure} onCancel={() => { setMeasureView("list"); setEditingMeasure(null); }} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* プロフィール */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
        {editingProfile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel>プロフィール編集</SectionLabel>
            <Field label="名前"><input style={inputStyle} placeholder="山田 太郎" value={profileDraft.name} onChange={(e) => setProfileDraft({ ...profileDraft, name: e.target.value })} /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="生年月日"><input type="date" style={inputStyle} value={profileDraft.birth} onChange={(e) => setProfileDraft({ ...profileDraft, birth: e.target.value })} /></Field>
              <Field label="性別">
                <div style={{ display: "flex", gap: 8 }}>
                  {["男子", "女子"].map((g) => (
                    <button key={g} onClick={() => setProfileDraft({ ...profileDraft, gender: g })}
                      style={{ ...btnBase, flex: 1, padding: "8px 0", fontSize: 13, background: profileDraft.gender === g ? C.accent : C.bg, color: profileDraft.gender === g ? "#0d0f14" : C.text, border: `1px solid ${profileDraft.gender === g ? C.accent : C.border}` }}>{g}</button>
                  ))}
                </div>
              </Field>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setProfileDraft(karte.profile); setEditingProfile(false); }} style={{ ...btnBase, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, padding: "8px 18px" }}>キャンセル</button>
              <button onClick={saveProfile} style={{ ...btnBase, background: C.accent, color: "#0d0f14", padding: "8px 22px", fontWeight: 800 }}>保存</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ background: C.accent, color: "#0d0f14", borderRadius: 16, width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 24 }}>
              {karte.profile.name ? karte.profile.name[0] : "?"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{karte.profile.name || "名前未設定"}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                {karte.profile.gender && <span>{karte.profile.gender}</span>}
                {age != null && <span>{age}歳</span>}
                {karte.profile.birth && <span>{fmtDate(karte.profile.birth)}生</span>}
                {latest?.height && <span>身長 {latest.height}cm</span>}
                {latest?.weight && <span>体重 {latest.weight}kg</span>}
              </div>
            </div>
            <button onClick={() => { setProfileDraft(karte.profile); setEditingProfile(true); }}
              style={{ ...btnBase, background: "none", border: `1px solid ${C.border}`, color: C.muted, padding: "6px 14px", fontSize: 12 }}>編集</button>
          </div>
        )}
      </div>

      {/* 最新測定値サマリー */}
      {latest && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
          <SectionLabel>最新の測定値（{fmtDate(latest.date)}）</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {ALL_MEASURE_FIELDS.filter((f) => latest.values?.[f.id]).map((f) => {
              const lift = LIFT_FIELDS.some((x) => x.id === f.id);
              return (
                <div key={f.id} style={{ background: C.bg, borderRadius: 10, padding: "8px 14px", minWidth: 86 }}>
                  <div style={{ fontSize: 10, color: lift ? "#c084fc" : C.run, fontWeight: 700, marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{latest.values[f.id]}<span style={{ fontSize: 11, color: C.muted, marginLeft: 2 }}>{f.unit}</span></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 推移グラフ */}
      {graphData.length > 0 && (
        <div style={{ background: C.card, borderRadius: 12, padding: 20 }}>
          <SectionLabel>推移グラフ</SectionLabel>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {ALL_MEASURE_FIELDS.filter((f) => karte.measures.some((m) => m.values?.[f.id])).map((f) => (
              <button key={f.id} onClick={() => setGraphField(f.id)}
                style={{ ...btnBase, padding: "5px 12px", fontSize: 12, background: graphField === f.id ? C.accent : C.bg, color: graphField === f.id ? "#0d0f14" : C.text, border: `1px solid ${graphField === f.id ? C.accent : C.border}` }}>
                {f.label}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={graphData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="4 4" />
              <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8 }} labelStyle={{ color: C.muted }} formatter={(v) => [`${v} ${fieldDef?.unit ?? ""}`, fieldDef?.label ?? ""]} />
              <Line type="monotone" dataKey="val" stroke={C.accent} strokeWidth={2.5} dot={{ fill: C.accent, r: 5, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 測定履歴 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <SectionLabel>測定履歴</SectionLabel>
        <button onClick={() => { setEditingMeasure(null); setMeasureView("new"); }}
          style={{ ...btnBase, background: C.accent, color: "#0d0f14", padding: "6px 16px", fontSize: 13, fontWeight: 800 }}>＋ 測定を記録</button>
      </div>
      {measures.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📏</div>
          <p style={{ margin: 0 }}>「＋ 測定を記録」から筋力や体重を入力しましょう</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {measures.map((m) => (
            <div key={m.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 800 }}>{fmtDate(m.date)}</span>
                {m.weight && <Tag color={C.run}>体重 {m.weight}kg</Tag>}
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button onClick={() => { setEditingMeasure(m); setMeasureView("edit"); }} style={{ ...btnBase, background: "none", border: `1px solid ${C.border}`, color: C.muted, padding: "4px 12px", fontSize: 12 }}>編集</button>
                  <button onClick={() => deleteMeasure(m.id)} style={{ ...btnBase, background: "none", border: `1px solid ${C.danger}33`, color: C.danger, padding: "4px 12px", fontSize: 12 }}>削除</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: C.muted }}>
                {ALL_MEASURE_FIELDS.filter((f) => m.values?.[f.id]).map((f) => (
                  <span key={f.id}>{f.label}: <strong style={{ color: C.text }}>{m.values[f.id]}{f.unit}</strong></span>
                ))}
              </div>
              {m.note && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, background: C.bg, borderRadius: 8, padding: "8px 12px" }}>{m.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 練習記録 ──────────────────────────────────────────────────────────────────
const PRACTICE_KEY = "tracklog_practice_v1";

// 練習種類
const PRACTICE_TYPES = [
  { val: "speed",     label: "スピード",   color: "#47b3ff" },
  { val: "endurance", label: "持久",       color: "#4ade80" },
  { val: "tech",      label: "技術",       color: "#e8ff47" },
  { val: "strength",  label: "補強・筋トレ", color: "#c084fc" },
  { val: "jump",      label: "跳躍",       color: "#ff7f47" },
  { val: "throw",     label: "投擲",       color: "#f472b6" },
  { val: "jog",       label: "ジョグ・回復", color: "#94a3b8" },
];
// 体調・疲労度
const CONDITION_OPTIONS = [
  { val: "great", label: "絶好調", color: "#4ade80" },
  { val: "good",  label: "良い",   color: "#e8ff47" },
  { val: "normal",label: "普通",   color: "#94a3b8" },
  { val: "tired", label: "疲れ気味", color: "#fb923c" },
  { val: "bad",   label: "不調",   color: "#ff4747" },
];
const ptLabel = (v) => PRACTICE_TYPES.find((t) => t.val === v)?.label ?? v;
const ptColor = (v) => PRACTICE_TYPES.find((t) => t.val === v)?.color ?? C.muted;
const condLabel = (v) => CONDITION_OPTIONS.find((c) => c.val === v)?.label ?? v;
const condColor = (v) => CONDITION_OPTIONS.find((c) => c.val === v)?.color ?? C.muted;

const emptyMenu = () => ({ name: "", reps: "", times: "", rest: "", note: "" });

// 練習メニュー入力行
function PracticeMenuRow({ idx, menu, onChange, onRemove }) {
  const set = (k, v) => onChange({ ...menu, [k]: v });
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.muted, minWidth: 36 }}>{idx + 1}本目</span>
        <button onClick={onRemove} style={{ ...btnBase, background: "none", border: "none", color: C.muted, fontSize: 20, padding: "0 6px", marginLeft: "auto" }}>×</button>
      </div>
      <Field label="メニュー名">
        <input style={inputStyle} placeholder="例: 150m / ジョグ / スクワット" value={menu.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field label="本数・セット"><input style={inputStyle} placeholder="5本" value={menu.reps} onChange={(e) => set("reps", e.target.value)} /></Field>
        <Field label="タイム・記録"><input style={inputStyle} placeholder="18.5" value={menu.times} onChange={(e) => set("times", e.target.value)} /></Field>
        <Field label="レスト"><input style={inputStyle} placeholder="5分" value={menu.rest} onChange={(e) => set("rest", e.target.value)} /></Field>
      </div>
      <Field label="メモ">
        <input style={inputStyle} placeholder="感触・タイム詳細など" value={menu.note} onChange={(e) => set("note", e.target.value)} />
      </Field>
    </div>
  );
}

// 練習記録フォーム
function PracticeForm({ onSave, onCancel, initial }) {
  const empty = {
    date: new Date().toISOString().slice(0, 10),
    venue: "", types: [], condition: "normal", weather: "晴れ",
    menus: [], notes: "",
  };
  const [form, setForm] = useState(initial ?? empty);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleType = (t) => set("types", form.types.includes(t) ? form.types.filter((x) => x !== t) : [...form.types, t]);
  const addMenu = () => set("menus", [...form.menus, emptyMenu()]);
  const updMenu = (i, v) => set("menus", form.menus.map((x, j) => j === i ? v : x));
  const delMenu = (i) => set("menus", form.menus.filter((_, j) => j !== i));

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>{initial ? "練習を編集" : "練習を記録"}</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="日付"><input type="date" style={inputStyle} value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="場所"><input style={inputStyle} placeholder="例: 学校グラウンド" value={form.venue} onChange={(e) => set("venue", e.target.value)} /></Field>
      </div>

      <Field label="練習の種類（複数選択可）">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PRACTICE_TYPES.map((t) => (
            <button key={t.val} onClick={() => toggleType(t.val)}
              style={{ ...btnBase, padding: "6px 12px", fontSize: 12, background: form.types.includes(t.val) ? t.color + "33" : C.bg, color: form.types.includes(t.val) ? t.color : C.muted, border: `1px solid ${form.types.includes(t.val) ? t.color : C.border}`, fontWeight: form.types.includes(t.val) ? 800 : 400 }}>
              {t.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="体調・疲労度">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CONDITION_OPTIONS.map((c) => (
            <button key={c.val} onClick={() => set("condition", c.val)}
              style={{ ...btnBase, padding: "6px 12px", fontSize: 12, background: form.condition === c.val ? c.color + "33" : C.bg, color: form.condition === c.val ? c.color : C.muted, border: `1px solid ${form.condition === c.val ? c.color : C.border}`, fontWeight: form.condition === c.val ? 800 : 400 }}>
              {c.label}
            </button>
          ))}
        </div>
      </Field>

      {/* メニュー */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <SectionLabel>練習メニュー</SectionLabel>
          <button onClick={addMenu} style={{ ...btnBase, background: C.run + "22", color: C.run, border: `1px solid ${C.run}44`, padding: "5px 14px", fontSize: 12 }}>＋ メニュー追加</button>
        </div>
        {form.menus.length === 0 && <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>「＋ メニュー追加」でインターバル走や補強などを記録できます</p>}
        {form.menus.map((m, i) => <PracticeMenuRow key={i} idx={i} menu={m} onChange={(v) => updMenu(i, v)} onRemove={() => delMenu(i)} />)}
      </div>

      <Field label="練習全体のメモ・振り返り">
        <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} placeholder="今日の練習の振り返り、課題、気づきなど自由に" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ ...btnBase, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, padding: "9px 20px" }}>キャンセル</button>
        <button onClick={() => onSave({ ...form, id: initial?.id ?? Date.now().toString() })}
          style={{ ...btnBase, background: C.accent, color: "#0d0f14", padding: "9px 24px", fontWeight: 800 }}>保存</button>
      </div>
    </div>
  );
}

// 練習カード
function PracticeCard({ p, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 800 }}>{fmtDate(p.date)}</span>
        {p.condition && <Tag color={condColor(p.condition)}>{condLabel(p.condition)}</Tag>}
        <span style={{ marginLeft: "auto", fontSize: 12, color: C.muted }}>{p.venue}</span>
      </div>
      {p.types?.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {p.types.map((t) => <Tag key={t} color={ptColor(t)}>{ptLabel(t)}</Tag>)}
        </div>
      )}
      {p.menus?.length > 0 && (
        <div>
          <button onClick={() => setOpen((v) => !v)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, padding: 0 }}>
            {open ? "▲ メニューを閉じる" : `▼ メニューを見る（${p.menus.length}本）`}
          </button>
          {open && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {p.menus.map((m, i) => (
                <div key={i} style={{ background: C.bg, borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, color: C.text }}>{m.name || "（無題）"}</span>
                    {m.reps && <span style={{ fontSize: 12, color: C.muted }}>{m.reps}</span>}
                    {m.times && <span style={{ fontSize: 13, color: C.accent, fontWeight: 700 }}>{m.times}</span>}
                    {m.rest && <span style={{ fontSize: 11, color: C.muted }}>レスト{m.rest}</span>}
                  </div>
                  {m.note && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{m.note}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {p.notes && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, background: C.bg, borderRadius: 8, padding: "9px 12px" }}>{p.notes}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={() => onEdit(p)} style={{ ...btnBase, background: "none", border: `1px solid ${C.border}`, color: C.muted, padding: "4px 12px", fontSize: 12 }}>編集</button>
        <button onClick={() => onDelete(p.id)} style={{ ...btnBase, background: "none", border: `1px solid ${C.danger}33`, color: C.danger, padding: "4px 12px", fontSize: 12 }}>削除</button>
      </div>
    </div>
  );
}

// 練習ページ
function PracticePage() {
  const [practices, setPractices] = useState(() => {
    try { const s = localStorage.getItem(PRACTICE_KEY); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(null);
  const [filterType, setFilterType] = useState("all");

  useEffect(() => { localStorage.setItem(PRACTICE_KEY, JSON.stringify(practices)); }, [practices]);

  const save = (p) => {
    setPractices((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      return idx >= 0 ? prev.map((x) => x.id === p.id ? p : x) : [p, ...prev];
    });
    setView("list"); setEditing(null);
  };
  const del = (id) => {
    if (!window.confirm("この練習記録を削除しますか？")) return;
    setPractices((prev) => prev.filter((p) => p.id !== id));
  };

  const list = [...practices]
    .filter((p) => filterType === "all" || p.types?.includes(filterType))
    .sort((a, b) => b.date.localeCompare(a.date));

  // 今週の練習回数
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const weekCount = practices.filter((p) => p.date >= weekAgo).length;

  if (view === "new" || view === "edit") {
    return <PracticeForm initial={editing} onSave={save} onCancel={() => { setView("list"); setEditing(null); }} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* サマリー＋追加ボタン */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>今週の練習</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{weekCount}<span style={{ fontSize: 12, color: C.muted, marginLeft: 3 }}>回</span></div>
        </div>
        <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>総練習数</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{practices.length}<span style={{ fontSize: 12, color: C.muted, marginLeft: 3 }}>回</span></div>
        </div>
      </div>
      <button onClick={() => { setEditing(null); setView("new"); }}
        style={{ ...btnBase, background: C.accent, color: "#0d0f14", padding: "14px", fontSize: 15, fontWeight: 900 }}>＋ 練習を記録する</button>

      {/* フィルタ */}
      {practices.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setFilterType("all")}
            style={{ ...btnBase, padding: "5px 12px", fontSize: 12, background: filterType === "all" ? C.accent : C.card, color: filterType === "all" ? "#0d0f14" : C.text, border: `1px solid ${filterType === "all" ? C.accent : C.border}` }}>すべて</button>
          {PRACTICE_TYPES.filter((t) => practices.some((p) => p.types?.includes(t.val))).map((t) => (
            <button key={t.val} onClick={() => setFilterType(t.val)}
              style={{ ...btnBase, padding: "5px 12px", fontSize: 12, background: filterType === t.val ? t.color : C.card, color: filterType === t.val ? "#0d0f14" : C.text, border: `1px solid ${filterType === t.val ? t.color : C.border}` }}>{t.label}</button>
          ))}
        </div>
      )}

      {/* 一覧 */}
      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏃</div>
          <p style={{ margin: 0 }}>{practices.length === 0 ? "「＋ 練習を記録する」から今日の練習を記録しましょう" : "条件に合う練習がありません"}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((p) => <PracticeCard key={p.id} p={p} onEdit={(x) => { setEditing(x); setView("edit"); }} onDelete={del} />)}
        </div>
      )}
    </div>
  );
}

// ── ホーム（トップ） ──────────────────────────────────────────────────────────
function HomePage({ records, onNavigate }) {
  // カルテ情報を読む
  let karte = { profile: { name: "", birth: "", gender: "" }, measures: [] };
  try { const s = localStorage.getItem(KARTE_KEY); if (s) karte = JSON.parse(s); } catch {}
  const profile = karte.profile ?? {};
  const age = ageFromBirth(profile.birth);
  const measures = [...(karte.measures ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const latest = measures[0];
  const pb = getPB(records);
  const pbCount = Object.keys(pb).length;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return "おつかれさま";
    if (h < 11) return "おはよう";
    if (h < 18) return "こんにちは";
    return "こんばんは";
  })();

  const today = new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });

  const menus = [
    { id: "karte", icon: "🪪", title: "カルテ",   desc: "プロフィール・筋力測定", color: "#c084fc" },
    { id: "list",  icon: "📋", title: "記録",     desc: "競技記録を追加・確認",   color: C.run },
    { id: "practice", icon: "🏃", title: "練習",  desc: "日々の練習を記録",       color: "#f472b6" },
    { id: "graph", icon: "📈", title: "グラフ",   desc: "記録の推移を見る",       color: "#4ade80" },
    { id: "meets", icon: "🏆", title: "大会",     desc: "大会ごとの結果",         color: C.accent },
    { id: "ai",    icon: "🤖", title: "AI分析",   desc: "コーチからのアドバイス", color: C.jump },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ヒーロー */}
      <div style={{
        background: `linear-gradient(135deg, ${C.accent}22 0%, ${C.run}22 60%, ${C.jump}22 100%)`,
        border: `1px solid ${C.border}`, borderRadius: 20, padding: 24,
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <AppIcon size={44} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>旭川龍谷高校 陸上部ログ</div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", marginTop: 2 }}>{today}</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.2 }}>
            {greeting}{profile.name ? `、${profile.name}さん` : ""}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>今日も一本一本、記録に残していこう</div>
        </div>

        {/* ステータス3つ */}
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "登録記録", val: records.length, unit: "件" },
            { label: "自己ベスト", val: pbCount, unit: "種目" },
            { label: "体重", val: latest?.weight || "—", unit: latest?.weight ? "kg" : "" },
          ].map((s) => (
            <div key={s.label} style={{ flex: 1, background: C.bg + "cc", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{s.val}<span style={{ fontSize: 11, color: C.muted, marginLeft: 2 }}>{s.unit}</span></div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* クイックアクション：記録を追加 */}
      <button onClick={() => onNavigate("list", true)}
        style={{ ...btnBase, background: C.accent, color: "#0d0f14", padding: "16px", fontSize: 16, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        ＋ 今日の記録を追加する
      </button>

      {/* 自己ベスト一覧 */}
      {pbCount > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <SectionLabel>自己ベスト</SectionLabel>
            <button onClick={() => onNavigate("graph")} style={{ ...btnBase, background: "none", border: "none", color: C.accent, fontSize: 12, padding: 0 }}>推移を見る →</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {ALL_EVENTS.filter((ev) => pb[ev.id]).map((ev) => {
              const c = isThrow(ev.id) ? "#c084fc" : isJump(ev.id) ? C.jump : C.run;
              const r = pb[ev.id];
              return (
                <div key={ev.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", borderLeft: `3px solid ${c}` }}>
                  <div style={{ fontSize: 11, color: c, fontWeight: 700, marginBottom: 3 }}>{ev.label}{r.gender ? `・${r.gender}` : ""}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{fmtResult(r)}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{fmtDate(r.date)}{r.meet ? ` ・ ${r.meet}` : ""}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* メニューボタン群 */}
      <div>
        <SectionLabel>メニュー</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {menus.map((m) => (
            <button key={m.id} onClick={() => onNavigate(m.id)}
              style={{
                ...btnBase, background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: 18, textAlign: "left",
                display: "flex", flexDirection: "column", gap: 8, cursor: "pointer",
              }}>
              <div style={{ fontSize: 28, width: 48, height: 48, borderRadius: 12, background: m.color + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>{m.icon}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{m.title}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontWeight: 400 }}>{m.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 最新測定（あれば） */}
      {latest && (
        <button onClick={() => onNavigate("karte")}
          style={{ ...btnBase, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, textAlign: "left", cursor: "pointer" }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 8 }}>最新の測定 — {fmtDate(latest.date)}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {ALL_MEASURE_FIELDS.filter((f) => latest.values?.[f.id]).slice(0, 4).map((f) => (
              <span key={f.id} style={{ fontSize: 12, color: C.muted }}>{f.label}: <strong style={{ color: C.text }}>{latest.values[f.id]}{f.unit}</strong></span>
            ))}
          </div>
        </button>
      )}
    </div>
  );
}

// ── メインアプリ ──────────────────────────────────────────────────────────────
const STORAGE_KEY = "tracklog_records_v5";
const TABS = [
  { id: "home",  label: "ホーム", icon: "🏠" },
  { id: "karte", label: "カルテ", icon: "🪪" },
  { id: "list",  label: "記録",   icon: "📋" },
  { id: "practice", label: "練習", icon: "🏃" },
  { id: "graph", label: "グラフ", icon: "📈" },
  { id: "meets", label: "大会",   icon: "🏆" },
  { id: "ai",    label: "AI分析", icon: "🤖" },
];

export default function App() {
  const [records, setRecords] = useState(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : SAMPLE_RECORDS; }
    catch { return SAMPLE_RECORDS; }
  });
  const [tab,         setTab]         = useState("home");
  const [view,        setView]        = useState("list");
  const [editing,     setEditing]     = useState(null);
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterMeet,  setFilterMeet]  = useState("all");

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }, [records]);

  const saveRecord = (rec) => {
    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === rec.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = rec; return n; }
      return [rec, ...prev];
    });
    setView("list"); setEditing(null);
  };
  const deleteRecord = (id) => {
    if (!window.confirm("この記録を削除しますか？")) return;
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const pb     = getPB(records);
  const meets  = ["all", ...new Set(records.map((r) => r.meet).filter(Boolean))];
  const filtered = records
    .filter((r) => (filterEvent === "all" || r.event === filterEvent) && (filterMeet === "all" || r.meet === filterMeet))
    .sort((a, b) => b.date.localeCompare(a.date));

  const onNavigate = (id, addNew = false) => {
    setTab(id);
    if (id === "list" && addNew) { setEditing(null); setView("new"); }
    else setView("list");
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif" }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={() => onNavigate("home")} style={{ ...btnBase, background: "none", border: "none", padding: 0, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <AppIcon size={34} />
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text, lineHeight: 1.2, textAlign: "left" }}>旭川龍谷高校<br />陸上部ログ</h1>
        </button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: C.muted }}>{records.length}件</span>
        {tab === "list" && view === "list" && (
          <button onClick={() => { setEditing(null); setView("new"); }}
            style={{ ...btnBase, background: C.accent, color: "#0d0f14", padding: "8px 16px", fontSize: 13, fontWeight: 800 }}>＋ 追加</button>
        )}
      </div>

      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", padding: "0 8px", overflowX: "auto" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setView("list"); }}
            style={{ ...btnBase, background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? C.accent : "transparent"}`, color: tab === t.id ? C.accent : C.muted, padding: "12px 12px", fontSize: 13, borderRadius: 0, fontWeight: tab === t.id ? 700 : 400, whiteSpace: "nowrap", flexShrink: 0 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px" }}>
        {tab === "home" && <HomePage records={records} onNavigate={onNavigate} />}

        {tab === "list" && (view === "new" || view === "edit") && (
          <RecordForm initial={editing} onSave={saveRecord} onCancel={() => { setView("list"); setEditing(null); }} />
        )}

        {tab === "list" && view === "list" && (
          <>
            {records.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <SectionLabel>自己ベスト</SectionLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {ALL_EVENTS.filter((ev) => pb[ev.id]).map((ev) => (
                    <div key={ev.id} style={{ background: C.bg, borderRadius: 10, padding: "8px 14px", minWidth: 90 }}>
                      <div style={{ fontSize: 10, color: isThrow(ev.id) ? "#c084fc" : isJump(ev.id) ? C.jump : C.run, fontWeight: 700, marginBottom: 2 }}>{ev.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>{fmtResult(pb[ev.id])}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {records.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <select style={{ ...inputStyle, width: "auto", flex: 1 }} value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)}>
                  <option value="all">全種目</option>
                  {ALL_EVENTS.map((ev) => <option key={ev.id} value={ev.id}>{ev.label}</option>)}
                </select>
                <select style={{ ...inputStyle, width: "auto", flex: 1 }} value={filterMeet} onChange={(e) => setFilterMeet(e.target.value)}>
                  {meets.map((m) => <option key={m} value={m}>{m === "all" ? "全大会" : m}</option>)}
                </select>
              </div>
            )}
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🏃</div>
                <p style={{ margin: 0 }}>{records.length === 0 ? "「＋ 追加」から最初の記録を入力しましょう" : "条件に合う記録がありません"}</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filtered.map((rec) => (
                  <RecordCard key={rec.id} rec={rec} onEdit={(r) => { setEditing(r); setView("edit"); }} onDelete={deleteRecord} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "graph" && <GraphPage records={records} />}
        {tab === "meets" && <MeetsPage records={records} />}
        {tab === "practice" && <PracticePage />}
        {tab === "karte" && <KartePage />}
        {tab === "ai"    && <AIPage records={records} />}
      </div>
    </div>
  );
}
