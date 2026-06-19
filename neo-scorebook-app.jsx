import { useState, useRef } from "react";
import { PenLine, ScrollText, BarChart2, Settings, Users, Calendar, ChevronRight, TrendingUp, GripVertical, Save, Plus, X, ChevronDown, Check } from "lucide-react";

/*
 * ═══════════════════════════════════════════
 * neo score book - アプリ階層構成 v1.0
 * ═══════════════════════════════════════════
 *
 * neo score book
 * ├── 試合
 * │     ├── 試合一覧
 * │     ├── 試合詳細
 * │     │     ├── スコア・経過
 * │     │     └── 成績（打者・投手）
 * │     └── 試合記録　← 現在開発中
 * │           ├── 記録ビュー
 * │           ├── 経過ビュー
 * │           └── 成績ビュー
 * │
 * ├── 選手
 * │     ├── 選手一覧
 * │     └── 選手詳細
 * │           ├── プロフィール
 * │           ├── 通算成績
 * │           └── 試合別推移
 * │
 * └── チーム
 *       ├── チーム情報
 *       ├── メンバー管理
 *       └── アカウント設定
 *
 * ボトムタブ：試合 / 選手 / チーム
 * 対象：スコアラー・コーチ・選手（小学〜高校）
 * 入力担当：スコアラー・マネージャー
 * プラットフォーム：スマホ＋Web両対応
 * 認証：チームID＋パスワード
 * ═══════════════════════════════════════════
 */

// カラーパレット
const C = {
  bg:          "#F2F4F0",
  card:        "#FFFFFF",
  cardShadow:  "0 2px 16px rgba(0,0,0,0.07)",
  brand:       "#3D6B3D",
  brandLight:  "#EBF2EB",
  brandText:   "#FFFFFF",
  textPri:     "#1A1A1A",
  textSec:     "#888888",
  textTer:     "#AAAAAA",
  divider:     "#F0F0F0",
  scoreBg:     "#2A4F2A",
  scoreText:   "#F0F8F0",
  scoreSubText:"#8CB88C",
  bsoB:        "#3D7A3D",
  bsoS:        "#8B6914",
  bsoO:        "#8B2020",
};

const TEAM_A = "阪神";
const TEAM_B = "巨人";

const BATTERS_A = [
  { order: 1, number: 1,  name: "近本 光司",  pos: "センター" },
  { order: 2, number: 8,  name: "中野 拓夢",  pos: "セカンド" },
  { order: 3, number: 99, name: "森下 翔太",  pos: "ライト" },
  { order: 4, number: 6,  name: "大山 悠輔",  pos: "ファースト" },
  { order: 5, number: 5,  name: "佐藤 輝明",  pos: "サード" },
  { order: 6, number: 44, name: "ノイジー",   pos: "レフト" },
  { order: 7, number: 2,  name: "木浪 聖也",  pos: "ショート" },
  { order: 8, number: 27, name: "坂本 誠志郎", pos: "キャッチャー" },
  { order: 9, number: 18, name: "青柳 晃洋",  pos: "ピッチャー" },
];
const BATTERS_B = [
  { order: 1, number: 7,  name: "丸 佳浩",   pos: "センター" },
  { order: 2, number: 6,  name: "吉川 尚輝",  pos: "セカンド" },
  { order: 3, number: 3,  name: "岡本 和真",  pos: "ファースト" },
  { order: 4, number: 25, name: "ブリンソン",  pos: "ライト" },
  { order: 5, number: 55, name: "秋広 優人",  pos: "サード" },
  { order: 6, number: 9,  name: "坂本 勇人",  pos: "ショート" },
  { order: 7, number: 34, name: "オコエ 瑠偉", pos: "レフト" },
  { order: 8, number: 32, name: "大城 卓三",  pos: "キャッチャー" },
  { order: 9, number: 17, name: "菅野 智之",  pos: "ピッチャー" },
];
const PITCHER_A = { number: 18, name: "青柳 晃洋" };
const PITCHER_B = { number: 17, name: "菅野 智之" };

const INPLAY_RESULTS = [
  { label: "1塁打",    type: "safe", batterBase: 1 },
  { label: "2塁打",    type: "safe", batterBase: 2 },
  { label: "3塁打",    type: "safe", batterBase: 3 },
  { label: "ホームラン", type: "safe", batterBase: null },
  { label: "エラー出塁", type: "safe", batterBase: 1 },
  { label: "FC（野選）", type: "safe", batterBase: 1 },
  { label: "ゴロアウト",   type: "out" },
  { label: "フライアウト",  type: "out" },
  { label: "ライナーアウト", type: "out" },
  { label: "バントアウト",  type: "out" },
  { label: "犠飛",        type: "out", isSF: true },
];

const BASE_NAMES = { 1: "1塁", 2: "2塁", 3: "3塁", 4: "ホーム（得点）" };
const RUNNERS_INIT = { first: null, second: null, third: null };
const nextBase = (base) => base === "first" ? "second" : base === "second" ? "third" : null;

// ── 初期ハーフイニング生成 ──
const makeHalf = (inning, topBottom, batters) => ({
  inning, topBottom,
  atBats: [makeBat(batters[0])],
});
const makeBat = (player, pitcherNumber = null, runnersAtStart = { first: false, second: false, third: false }) => ({
  order: player.order, number: player.number,
  name: player.name, pos: player.pos,
  pitches: [], events: [], result: null,
  runsScored: 0, scoreAfterA: null, scoreAfterB: null,
  pitcherNumber, runnersAtStart,
  runnersAfter: null, // 打席終了後のランナー状態
});

// ── Diamond ──
function Diamond({ runners, onBaseClick }) {
  const S = 20, cx = 40;
  const bp = (filled) => ({ fill: filled ? "#639922" : "transparent", stroke: filled ? "#3B6D11" : "#B4B2A9", strokeWidth: 1.5 });
  return (
    <svg viewBox="-6 -6 92 92" width="80" height="80" fill="none">
      <g transform={`rotate(45 ${cx} 12)`} onClick={() => runners.second && onBaseClick?.("second")} style={{ cursor: runners.second ? "pointer" : "default" }}>
        <rect x={cx-S/2} y={2} width={S} height={S} rx={3} {...bp(runners.second)}/>
      </g>
      <g transform={`rotate(45 12 ${cx})`} onClick={() => runners.third && onBaseClick?.("third")} style={{ cursor: runners.third ? "pointer" : "default" }}>
        <rect x={2} y={cx-S/2} width={S} height={S} rx={3} {...bp(runners.third)}/>
      </g>
      <g transform={`rotate(45 ${cx*2-12} ${cx})`} onClick={() => runners.first && onBaseClick?.("first")} style={{ cursor: runners.first ? "pointer" : "default" }}>
        <rect x={cx*2-12-S/2} y={cx-S/2} width={S} height={S} rx={3} {...bp(runners.first)}/>
      </g>
      <g transform={`rotate(45 ${cx} ${cx*2-12})`}>
        <rect x={cx-S/2} y={cx*2-12-S/2} width={S} height={S} rx={3} fill="transparent" stroke="#C0BEB8" strokeWidth={1}/>
      </g>
    </svg>
  );
}

function Dot({ filled, color }) {
  return <span style={{ width:10, height:10, borderRadius:"50%", background: filled ? color : "#DDDDDD", display:"inline-block", transition:"background 0.15s" }}/>;
}

const CHIP = {
  B:    { bg:"#E8F5E8", color:"#2D5C2D", label:"B" },
  見逃: { bg:"#F5F0E8", color:"#6B5A2D", label:"見" },
  空振: { bg:"#F5F0E8", color:"#6B5A2D", label:"空" },
  F:    { bg:"#F1EFE8", color:"#5F5E5A", label:"F" },
  IP:   { bg:C.brandText, color:C.brand, label:"安" },
  DB:   { bg:"#F5EAEA", color:"#6B2020", label:"死" },
  振:   { bg:"#F0EFF5", color:"#3D3D6B", label:"振" },
};

function PitchChip({ type }) {
  const s = CHIP[type] || { bg:"#F1EFE8", color:"#444", label:type };
  return <span style={{ fontSize:11, padding:"3px 8px", borderRadius:20, fontWeight:600, background:s.bg, color:s.color, border:`0.5px solid ${s.color}33` }}>{s.label}</span>;
}

const makeShadow = (color) => {
  // 影の色をボタン色から生成（暗めに）
  return color.replace("#", "").length === 6
    ? `0 3px 0 ${color}88`
    : "0 3px 0 rgba(0,0,0,0.15)";
};

const Btn = ({ label, bg, border, color, onClick, disabled, style={} }) => (
  <div onClick={disabled?undefined:onClick} style={{
    borderRadius:10, border:`1px solid ${disabled?"#C4C2B8":border}`,
    background:disabled?C.bg:bg,
    fontSize:13, fontWeight:700, cursor:disabled?"not-allowed":"pointer",
    textAlign:"center", color:disabled?"#B4B2A9":color,
    userSelect:"none", padding:"15px 6px", opacity:disabled?0.5:1,
    boxShadow: disabled ? "none" : `0 3px 0 ${border}99`,
    transition:"transform 0.08s, box-shadow 0.08s",
    ...style,
  }}
    onPointerDown={e => { if (!disabled) { e.currentTarget.style.transform="translateY(3px)"; e.currentTarget.style.boxShadow="none"; }}}
    onPointerUp={e => { if (!disabled) { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=`0 3px 0 ${border}99`; }}}
    onPointerLeave={e => { if (!disabled) { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=`0 3px 0 ${border}99`; }}}
  >{label}</div>
);

// ── 経過ビュー ──
const RUNNERS_INIT_CONST = { first: null, second: null, third: null };

function MiniDiamond({ runners }) {
  const r = runners ?? RUNNERS_INIT_CONST;
  const base = (filled) => ({ fill: filled ? "#639922" : "transparent", stroke: filled ? "#3B6D11" : "#B4B2A9", strokeWidth: 1 });
  const S = 10, cx = 22;
  return (
    <svg viewBox="-4 -4 52 52" width="40" height="40" fill="none">
      <g transform={`rotate(45 ${cx} 8)`}><rect x={cx-S/2} y={2} width={S} height={S} rx={2} {...base(r.second)}/></g>
      <g transform={`rotate(45 8 ${cx})`}><rect x={2} y={cx-S/2} width={S} height={S} rx={2} {...base(r.third)}/></g>
      <g transform={`rotate(45 ${cx*2-8} ${cx})`}><rect x={cx*2-8-S/2} y={cx-S/2} width={S} height={S} rx={2} {...base(r.first)}/></g>
      <g transform={`rotate(45 ${cx} ${cx*2-8})`}><rect x={cx-S/2} y={cx*2-8-S/2} width={S} height={S} rx={2} fill="transparent" stroke="#C0BEB8" strokeWidth={1}/></g>
    </svg>
  );
}

function HistoryView({ gameLog }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }));

  const resultColor = (result) => {
    if (!result) return C.textTer;
    if (["ヒット","二塁打","三塁打","本塁打","1塁打","2塁打","3塁打","ホームラン","エラー","野選","FC","フォアボール","デッドボール","振り逃げ","犠飛"].some(r => result.includes(r))) return C.brand;
    if (["ゴロ","フライ","ライナー","バント","アウト","三振"].some(r => result.includes(r))) return "#8B2020";
    return C.textPri;
  };

  if (gameLog.length === 0) {
    return <div style={{ padding:"40px 14px", textAlign:"center", color: C.textTer, fontSize:13 }}>まだ記録がありません</div>;
  }

  // イニングごとの累積スコアを計算
  let runA = 0, runB = 0;
  const atBatScores = [];
  gameLog.forEach(half => {
    half.atBats.forEach(ab => {
      const runs = ab.runsScored || 0;
      if (half.topBottom === "表") runA += runs; else runB += runs;
      atBatScores.push({ a: runA, b: runB });
    });
  });
  let abGlobalIdx = 0;

  return (
    <div style={{ overflowY:"auto", maxHeight:480, background: C.bg }}>
      {gameLog.map((half, hi) => {
        const inningRuns = half.atBats.reduce((sum, ab) => sum + (ab.runsScored || 0), 0);
        const isAttackA = half.topBottom === "表";
        return (
          <div key={hi}>
            {/* イニングヘッダー */}
            <div style={{ padding:"8px 16px", background: C.scoreBg, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:12, fontWeight:700, color: C.scoreText }}>{half.inning}回 {half.topBottom === "表" ? "▲ 表" : "▼ 裏"}</span>
              {inningRuns > 0
                ? <span style={{ fontSize:12, fontWeight:700, color:"#F0C040" }}>+{inningRuns}点</span>
                : <span style={{ fontSize:11, color: C.scoreSubText }}>得点なし</span>
              }
            </div>
            {/* 打席一覧 */}
            {half.atBats.map((ab, ai) => {
              const key = `${hi}-${ai}`;
              const isOpen = expanded[key];
              const scored = (ab.runsScored || 0) > 0;
              const scores = atBatScores[abGlobalIdx++];
              const scoreStr = scored && scores ? `${scores.a} - ${scores.b}` : null;
              return (
                <div key={ai} style={{ borderBottom:`1px solid ${C.divider}`, background: scored ? "#F0F8F0" : C.card, margin:"0 16px 0", borderRadius: isOpen ? "0" : "0" }}>
                  <div onClick={() => toggle(key)} style={{ padding:"10px 14px", display:"flex", alignItems:"center", gap:6, cursor:"pointer", userSelect:"none" }}>
                    <span style={{ fontSize:11, color: C.textTer, width:28, flexShrink:0 }}>{ab.order}番</span>
                    <span style={{ fontSize:13, fontWeight:600, color: C.textPri, flex:1 }}>#{ab.number} {ab.name}</span>
                    <span style={{ fontSize:12, fontWeight:600, color:resultColor(ab.result) }}>{ab.result ?? "打席中"}</span>
                    {scored && (
                      <span style={{ fontSize:11, fontWeight:700, background: C.brandLight, color: C.brand, padding:"2px 8px", borderRadius:20, flexShrink:0 }}>
                        +{ab.runsScored}
                      </span>
                    )}
                    {scoreStr && (
                      <span style={{ fontSize:11, fontWeight:600, color: C.brand, flexShrink:0 }}>
                        → {scoreStr}
                      </span>
                    )}
                    <span style={{ fontSize:10, color: C.textTer, display:"inline-block", transform:isOpen?"rotate(180deg)":"rotate(0deg)", transition:"transform 0.15s" }}>▼</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding:"8px 14px 12px", background: C.bg }}>
                      {/* ランナーの動き */}
                      {(ab.runnersAtStart || ab.runnersAfter) && (
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                          <div style={{ textAlign:"center" }}>
                            <div style={{ fontSize:9, color: C.textTer, marginBottom:3 }}>打席前</div>
                            <MiniDiamond runners={ab.runnersAtStart ?? RUNNERS_INIT}/>
                          </div>
                          <div style={{ fontSize:16, color: C.textTer }}>→</div>
                          <div style={{ textAlign:"center" }}>
                            <div style={{ fontSize:9, color: C.textTer, marginBottom:3 }}>打席後</div>
                            <MiniDiamond runners={ab.runnersAfter ?? ab.runnersAtStart ?? RUNNERS_INIT}/>
                          </div>
                        </div>
                      )}
                      {/* 投球チップ */}
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:ab.events.length?6:0 }}>
                        {ab.pitches.map((p, pi) => {
                          const s = CHIP[p] || { bg: C.brandLight, color: C.brand };
                          return <span key={pi} style={{ fontSize:10, padding:"2px 8px", borderRadius:20, fontWeight:600, background:s.bg, color:s.color }}>{CHIP[p]?.label ?? p}</span>;
                        })}
                      </div>
                      {ab.events.map((ev, ei) => (
                        <div key={ei} style={{ fontSize:11, color: C.brand, marginTop:4 }}>▶ {ev}</div>
                      ))}
                      {ab.pitches.length === 0 && ab.events.length === 0 && (
                        <span style={{ fontSize:11, color: C.textTer }}>投球なし</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ height:8, background: C.bg }}/>
          </div>
        );
      })}
    </div>
  );
}

// ── メインコンポーネント ──
function StatsView({ gameLog, battersA, battersB }) {
  const [tab, setTab] = useState("batter");

  // gameLogから打者・投手成績を集計
  const calcStats = (batters, isTop) => {
    const stats = {};
    batters.forEach(b => {
      stats[b.number] = {
        ...b, atBats: 0, hits: 0, rbi: 0, hr: 0, sb: 0,
        bb: 0, hbp: 0, so: 0, sac: 0,
        // 投手
        pitches: 0, outs: 0, pHits: 0, strikeouts: 0, walks: 0, pHbp: 0, runs: 0,
      };
    });

    gameLog.forEach(half => {
      if ((half.topBottom === "表") !== isTop) return;
      half.atBats.forEach(ab => {
        const s = stats[ab.number];
        if (!s) return;
        const r = ab.result;
        if (!r) return;

        // 打者成績
        const isHit = ["ヒット","二塁打","三塁打","本塁打","1塁打","2塁打","3塁打","ホームラン"].some(h => r.includes(h));
        const isSF  = r.includes("犠飛");
        const isSAC = r.includes("犠打") || r.includes("バント");
        const isIBB = r.includes("故意四球");
        const isBB  = r.includes("フォアボール") && !isIBB;
        const isAB  = !["フォアボール","故意四球","デッドボール","犠打","犠飛","バント"].some(x => r.includes(x));
        if (isAB) s.atBats++;
        if (isHit) s.hits++;
        if (r.includes("本塁打") || r.includes("ホームラン")) s.hr++;
        if (isBB) s.bb++;
        if (isIBB) s.ibb = (s.ibb||0) + 1;
        if (r.includes("デッドボール")) s.hbp++;
        if (r.includes("三振")) s.so++;
        if (isSF)  s.sf  = (s.sf||0)  + 1;
        if (isSAC) s.sac = (s.sac||0) + 1;

        // 塁打数（長打率計算用）
        if (r.includes("ヒット") && !r.includes("二塁打") && !r.includes("三塁打")) s.tb = (s.tb||0) + 1;
        if (r.includes("1塁打"))  s.tb = (s.tb||0) + 1;
        if (r.includes("二塁打") || r.includes("2塁打")) s.tb = (s.tb||0) + 2;
        if (r.includes("三塁打") || r.includes("3塁打")) s.tb = (s.tb||0) + 3;
        if (r.includes("本塁打") || r.includes("ホームラン")) s.tb = (s.tb||0) + 4;

        // 得点圏打席・得点圏安打（runnersAtStartに2塁か3塁があれば得点圏）
        const rs = ab.runnersAtStart || {};
        if (rs.second || rs.third) {
          s.risp_ab  = (s.risp_ab||0)  + (isAB ? 1 : 0);
          s.risp_hit = (s.risp_hit||0) + (isHit ? 1 : 0);
        }

        // 打点計算（公認野球規則 9.04準拠）
        const runs = ab.runsScored || 0;
        if (runs > 0) {
          const isHBP = r.includes("デッドボール");
          const isDP  = r.includes("ゲッツー");
          if (isDP) {
            // ゲッツー完成時は打点なし
          } else if ((isBB || isIBB || isHBP) && rs.first && rs.second && rs.third) {
            // 四球・死球・故意四球は満塁押し出し時のみ打点1
            s.rbi += 1;
          } else if (!isBB && !isIBB && !isHBP) {
            s.rbi += runs;
          }
        }

        // 走塁イベントから盗塁
        ab.events?.forEach(ev => { if (ev.includes("盗塁成功")) s.sb++; });
      });
    });

    // 投手成績（相手の攻撃イニングを集計）
    const pitcherStats = {};
    batters.filter(b => b.pos === "ピッチャー").forEach(b => {
      pitcherStats[b.number] = { ...b, pitches: 0, outs: 0, pHits: 0, strikeouts: 0, walks: 0, pHbp: 0, runs: 0 };
    });

    // 相手チームの攻撃イニングを集計（各打席のpitcherNumberで投手を特定）
    gameLog.forEach(half => {
      if ((half.topBottom === "表") === isTop) return; // 相手の攻撃のみ
      half.atBats.forEach(ab => {
        const r = ab.result;
        if (!r) return;
        // この打席の投手を特定
        const ps = ab.pitcherNumber ? pitcherStats[ab.pitcherNumber] : null;
        if (!ps) return;
        // 投球数
        ps.pitches += ab.pitches?.length || 0;
        // アウト（新表記：遊ゴロ・左フライ等、旧表記：ゴロアウト等、三振）
        const isOutP = ["ゴロ","フライ","ライナー","バント","アウト","三振"].some(x => r.includes(x))
          && !["ヒット","二塁打","三塁打","本塁打","1塁打","2塁打","3塁打","ホームラン","エラー","野選","FC","フォアボール","デッドボール","振り逃げ","犠飛"].some(x => r.includes(x));
        if (isOutP) ps.outs++;
        // 被安打（新旧両表記対応）
        if (["ヒット","二塁打","三塁打","本塁打","1塁打","2塁打","3塁打","ホームラン"].some(h => r.includes(h))) ps.pHits++;
        // 奪三振
        if (r.includes("三振")) ps.strikeouts++;
        // 与四球
        if (r.includes("フォアボール")) ps.walks++;
        // 与死球
        if (r.includes("デッドボール")) ps.pHbp++;
        // 失点（得点が入った打席の投手に加算）
        ps.runs += ab.runsScored || 0;
      });
    });

    return {
      batting: Object.values(stats).sort((a, b) => a.order - b.order),
      pitching: Object.values(pitcherStats),
    };
  };

  const statsA = calcStats(battersA, true);
  const statsB = calcStats(battersB, false);
  const gameAvg  = (h, ab) => ab === 0 ? "-" : (h / ab).toFixed(3).replace("0.", ".");
  const gameOBP  = (b) => {
    const denom = b.atBats + (b.bb||0) + (b.hbp||0) + (b.sf||0);
    return denom === 0 ? "-" : ((b.hits + (b.bb||0) + (b.hbp||0)) / denom).toFixed(3).replace("0.", ".");
  };
  const gameSLG  = (b) => b.atBats === 0 ? "-" : ((b.tb||0) / b.atBats).toFixed(3).replace("0.", ".");
  const gameOPS  = (b) => {
    const obp = parseFloat(("0" + gameOBP(b)).replace("-","0"));
    const slg = parseFloat(("0" + gameSLG(b)).replace("-","0"));
    return (obp + slg).toFixed(3).replace("0.", ".");
  };
  const gameRISP = (b) => (b.risp_ab||0) === 0 ? "-" : ((b.risp_hit||0) / b.risp_ab).toFixed(3).replace("0.", ".");

  const Cell = ({ val, highlight }) => (
    <div style={{ width: 32, textAlign: "center", fontSize: 12, flexShrink: 0, color: highlight && val > 0 ? C.brand : C.textPri, fontWeight: highlight && val > 0 ? 700 : 400 }}>{val}</div>
  );

  const HCell = ({ label }) => (
    <div style={{ width: 32, textAlign: "center", fontSize: 10, color: C.textTer, fontWeight: 600, flexShrink: 0 }}>{label}</div>
  );

  const calcTotals = (batting) => batting.reduce((acc, b) => ({
    atBats: acc.atBats + b.atBats, hits: acc.hits + b.hits,
    rbi: acc.rbi + b.rbi, hr: acc.hr + b.hr, sb: acc.sb + b.sb,
  }), { atBats: 0, hits: 0, rbi: 0, hr: 0, sb: 0 });

  const totalsA = calcTotals(statsA.batting);
  const totalsB = calcTotals(statsB.batting);

  const BatterTable = ({ stats, totals, teamName }) => (
    <>
      <div style={{ padding: "6px 14px", background: C.scoreBg, borderBottom: `1px solid ${C.divider}` }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.brand }}>{teamName}</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 480 }}>
          {/* ヘッダー */}
          <div style={{ padding: "5px 14px", background: C.bg, display: "flex", alignItems: "center", borderBottom: `1px solid ${C.divider}` }}>
            <div style={{ width: 100, fontSize: 10, color: C.textTer, fontWeight: 600, flexShrink: 0 }}>選手名</div>
            {["打率","打","安","点","本","盗","出塁率","長打率","OPS","得点圏"].map(h => <HCell key={h} label={h}/>)}
          </div>
          {/* 選手行 */}
          {stats.map((b, i) => (
            <div key={i} style={{ padding: "7px 14px", display: "flex", alignItems: "center", borderBottom: `1px solid ${C.divider}` }}>
              <div style={{ width: 100, fontSize: 11, fontWeight: 500, color: C.textPri, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {b.order}番 {b.name}
              </div>
              <div style={{ width: 32, textAlign: "center", fontSize: 11, flexShrink: 0, color: C.textPri }}>
                {b.pos === "ピッチャー" ? "-" : gameAvg(b.hits, b.atBats)}
              </div>
              <Cell val={b.atBats}/>
              <Cell val={b.hits} highlight/>
              <Cell val={b.rbi} highlight/>
              <Cell val={b.hr} highlight/>
              <Cell val={b.sb} highlight/>
              <div style={{ width: 32, textAlign: "center", fontSize: 11, flexShrink: 0, color: C.textSec }}>{b.pos === "ピッチャー" ? "-" : gameOBP(b)}</div>
              <div style={{ width: 32, textAlign: "center", fontSize: 11, flexShrink: 0, color: C.textSec }}>{b.pos === "ピッチャー" ? "-" : gameSLG(b)}</div>
              <div style={{ width: 32, textAlign: "center", fontSize: 11, flexShrink: 0, fontWeight: 600, color: C.brand }}>{b.pos === "ピッチャー" ? "-" : gameOPS(b)}</div>
              <div style={{ width: 32, textAlign: "center", fontSize: 11, flexShrink: 0, color: (b.risp_ab||0) > 0 ? C.brand : C.textTer }}>{b.pos === "ピッチャー" ? "-" : gameRISP(b)}</div>
            </div>
          ))}
          {/* チーム計 */}
          <div style={{ padding: "7px 14px", display: "flex", alignItems: "center", background: C.bg, borderTop: `1px solid ${C.divider}` }}>
            <div style={{ width: 100, fontSize: 12, fontWeight: 700, color: C.textPri, flexShrink: 0 }}>チーム計</div>
            <div style={{ width: 32, textAlign: "center", fontSize: 11, flexShrink: 0, fontWeight: 700 }}>{gameAvg(totals.hits, totals.atBats)}</div>
            <Cell val={totals.atBats}/>
            <Cell val={totals.hits} highlight/>
            <Cell val={totals.rbi} highlight/>
            <Cell val={totals.hr} highlight/>
            <Cell val={totals.sb} highlight/>
            <div style={{ width: 32 }}/>
            <div style={{ width: 32 }}/>
            <div style={{ width: 32 }}/>
            <div style={{ width: 32 }}/>
          </div>
        </div>
      </div>
    </>
  );

  const PitcherTable = ({ pitchers, stats, teamName }) => (
    <>
      <div style={{ padding: "6px 14px", background: C.scoreBg, borderBottom: `1px solid ${C.divider}` }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.brand }}>{teamName}</span>
      </div>
      <div style={{ padding: "5px 14px", background: C.bg, display: "flex", alignItems: "center", borderBottom: `1px solid ${C.divider}` }}>
        <div style={{ flex: 1, fontSize: 10, color: C.textTer, fontWeight: 600 }}>選手名</div>
        {["回","球","安","振","四","死","失"].map(h => (
          <div key={h} style={{ width: 30, fontSize: 10, color: C.textTer, fontWeight: 600, textAlign: "center", flexShrink: 0 }}>{h}</div>
        ))}
      </div>
      {pitchers.map((b, i) => {
        const ps = stats.pitching.find(p => p.number === b.number);
        const innings = ps ? `${Math.floor(ps.outs / 3)}${ps.outs % 3 > 0 ? "." + (ps.outs % 3) : ""}` : "0";
        return (
          <div key={i} style={{ padding: "8px 14px", display: "flex", alignItems: "center", borderBottom: `1px solid ${C.divider}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.textPri }}>#{b.number} {b.name}</div>
            </div>
            {[innings, ps?.pitches ?? 0, ps?.pHits ?? 0, ps?.strikeouts ?? 0, ps?.walks ?? 0, ps?.pHbp ?? 0, ps?.runs ?? 0].map((v, vi) => (
              <div key={vi} style={{ width: 30, fontSize: 12, textAlign: "center", flexShrink: 0, color: vi === 6 && v > 0 ? "#8B2020" : C.textPri, fontWeight: vi === 6 && v > 0 ? 700 : 400 }}>{v}</div>
            ))}
          </div>
        );
      })}
    </>
  );

  return (
    <div style={{ overflowY: "auto", maxHeight: 520 }}>
      {/* 打者/投手タブ */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.divider}` }}>
        {[{ id: "batter", label: "打者成績" }, { id: "pitcher", label: "投手成績" }].map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "10px", textAlign: "center",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            color: tab === t.id ? C.brand : C.textTer,
            borderBottom: tab === t.id ? `2px solid ${C.brand}` : "2px solid transparent",
          }}>{t.label}</div>
        ))}
      </div>

      {/* 打者成績 */}
      {tab === "batter" && <>
        <BatterTable stats={statsA.batting} totals={totalsA} teamName={TEAM_A}/>
        <div style={{ height: 8, background: C.bg }}/>
        <BatterTable stats={statsB.batting} totals={totalsB} teamName={TEAM_B}/>
      </>}

      {/* 投手成績 */}
      {tab === "pitcher" && <>
        <PitcherTable pitchers={battersA.filter(b => b.pos === "ピッチャー")} stats={statsA} teamName={TEAM_A}/>
        <div style={{ height: 8, background: C.bg }}/>
        <PitcherTable pitchers={battersB.filter(b => b.pos === "ピッチャー")} stats={statsB} teamName={TEAM_B}/>
        <div style={{ padding: "16px 14px", textAlign: "center", fontSize: 11, color: C.textTer }}>
          投手成績の詳細集計は今後実装予定
        </div>
      </>}
    </div>
  );
}

const HIT_DIRECTIONS = ["-", "投", "捕", "一", "二", "三", "遊", "左", "左中", "中", "右中", "右"];
const HIT_RESULTS_SAFE = ["ヒット", "二塁打", "三塁打", "本塁打", "エラー", "FC（野選）"];
const HIT_RESULTS_OUT  = ["ゴロ", "フライ", "ライナー", "バント", "犠飛", "ファールフライ", "ファールライナー"];

function InplayScreen({ batter, onResult }) {
  const [tab, setTab] = useState("inplay"); // inplay | special
  const [dir, setDir] = useState("-");
  const [result, setResult] = useState("-");

  const canConfirm = dir !== "-" && result !== "-";

  const handleConfirm = () => {
    if (!canConfirm) return;
    const isSafe = HIT_RESULTS_SAFE.includes(result);
    const batterBase = result === "ヒット" ? 1 : result === "二塁打" ? 2 : result === "三塁打" ? 3 : result === "本塁打" ? null : isSafe ? 1 : null;
    onResult({ label: `${dir}${result}`, type: isSafe ? "safe" : "out", batterBase });
  };

  const selectStyle = {
    width: "100%", padding: "12px 28px 12px 12px",
    fontSize: 16, fontWeight: 500,
    border: `1px solid ${C.divider}`,
    borderRadius: 10,
    background: C.bg,
    color: C.textPri,
    appearance: "none", WebkitAppearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    cursor: "pointer",
  };

  return (
    <>
      {/* ヘッダー */}
      <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.divider}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:12, color:C.textSec }}>#{batter.number} {batter.name}</span>
        <span style={{ fontSize:13, fontWeight:600 }}>打席結果を選択</span>
      </div>

      {/* タブ */}
      <div style={{ display:"flex", borderBottom:`1px solid ${C.divider}` }}>
        {[{ id:"inplay", label:"インプレー" },{ id:"special", label:"死球 / 四球 / 振逃" }].map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{
            flex:1, padding:"9px", textAlign:"center", fontSize:12, fontWeight:600,
            cursor:"pointer", userSelect:"none",
            color: tab === t.id ? C.brand : C.textTer,
            borderBottom: tab === t.id ? `2px solid ${C.brand}` : "2px solid transparent",
          }}>{t.label}</div>
        ))}
      </div>

      {/* インプレータブ */}
      {tab === "inplay" && <>
        <div style={{ padding:"14px 14px 10px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div>
            <div style={{ fontSize:11, color:C.textTer, fontWeight:600, marginBottom:6 }}>方向</div>
            <select value={dir} onChange={e => setDir(e.target.value)} style={selectStyle}>
              {HIT_DIRECTIONS.map(d => (
                <option key={d} value={d}>{d === "-" ? "-- 方向 --" : d}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:C.textTer, fontWeight:600, marginBottom:6 }}>結果</div>
            <select value={result} onChange={e => setResult(e.target.value)} style={selectStyle}>
              <option value="-">-- 結果 --</option>
              <optgroup label="出塁">
                {HIT_RESULTS_SAFE.map(r => <option key={r} value={r}>{r}</option>)}
              </optgroup>
              <optgroup label="凡退">
                {HIT_RESULTS_OUT.map(r => <option key={r} value={r}>{r}</option>)}
              </optgroup>
            </select>
          </div>
        </div>

        <div style={{ margin:"0 14px 12px", padding:"10px 14px", borderRadius:8, background:C.bg, display:"flex", alignItems:"center", gap:8, minHeight:44 }}>
          {canConfirm ? (
            <>
              <span style={{ fontSize:20, fontWeight:700, color:C.textPri }}>{dir}</span>
              <span style={{ fontSize:13, color:C.textTer }}>×</span>
              <span style={{ fontSize:20, fontWeight:700, color: HIT_RESULTS_SAFE.includes(result) ? C.brand : "#8B2020" }}>{result}</span>
            </>
          ) : (
            <span style={{ fontSize:12, color:C.textTer }}>方向と結果を選んでください</span>
          )}
        </div>

        <div style={{ padding:"0 14px 14px" }}>
          <div
            onClick={handleConfirm}
            style={{
              padding:"14px", borderRadius:10, textAlign:"center",
              fontSize:15, fontWeight:700, userSelect:"none",
              background: canConfirm ? C.brand : C.bg,
              color: canConfirm ? C.brandText : C.textTer,
              border:`1px solid ${canConfirm ? C.brand : C.divider}`,
              cursor: canConfirm ? "pointer" : "not-allowed",
            }}
            onPointerDown={e => canConfirm && (e.currentTarget.style.opacity = "0.7")}
            onPointerUp={e => e.currentTarget.style.opacity = "1"}
            onPointerLeave={e => e.currentTarget.style.opacity = "1"}
          >
            {canConfirm ? `${dir} × ${result} を記録` : "方向と結果を選んでください"}
          </div>
        </div>
      </>}

      {/* 特殊タブ */}
      {tab === "special" && (
        <div style={{ padding:"14px", display:"flex", flexDirection:"column", gap:8 }}>
          {[
            { label:"死球", type:"DB" },
            { label:"故意四球", type:"IBB" },
            { label:"振り逃げ", type:"振" },
          ].map(b => (
            <div key={b.label} onClick={() => onResult({ label: b.label, type: "safe", batterBase: 1, special: b.type })} style={{
              padding:"15px", borderRadius:10, textAlign:"center",
              fontSize:14, fontWeight:700, cursor:"pointer", userSelect:"none",
              background:C.bg,
              border:"1px solid #B0AEA8", color:C.textPri,
              boxShadow:`0 3px 0 ${C.divider}`,
            }}
              onPointerDown={e => { e.currentTarget.style.transform="translateY(3px)"; e.currentTarget.style.boxShadow="none"; }}
              onPointerUp={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=`0 3px 0 ${C.divider}`; }}
              onPointerLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=`0 3px 0 ${C.divider}`; }}
            >{b.label}</div>
          ))}
        </div>
      )}
    </>
  );
}



// ─────────────────────────────
// 選手管理
// ─────────────────────────────



const INITIAL_PLAYERS = [
  { id: 1, number: 1,  name: "近本 光司",   note: "" },
  { id: 2, number: 8,  name: "中野 拓夢",   note: "" },
  { id: 3, number: 99, name: "森下 翔太",   note: "" },
  { id: 4, number: 6,  name: "大山 悠輔",   note: "" },
  { id: 5, number: 5,  name: "佐藤 輝明",   note: "" },
  { id: 6, number: 44, name: "ノイジー",    note: "" },
  { id: 7, number: 2,  name: "木浪 聖也",   note: "" },
  { id: 8, number: 27, name: "坂本 誠志郎", note: "" },
  { id: 9, number: 18, name: "青柳 晃洋",   note: "" },
];

function PlayerManagement() {
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [screen, setScreen] = useState("list"); // list | form
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: "", number: "", pos: "投手" });
  const [error, setError] = useState({});

  const openNew = () => {
    setForm({ name: "", number: "", note: "" });
    setEditTarget(null);
    setError({});
    setScreen("form");
  };

  const openEdit = (player) => {
    setForm({ name: player.name, number: String(player.number), note: player.note || "" });
    setEditTarget(player.id);
    setError({});
    setScreen("form");
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "名前を入力してください";
    if (!form.number || isNaN(form.number) || form.number < 0 || form.number > 99) e.number = "0〜99の数字を入力してください";
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length) { setError(e); return; }
    if (editTarget) {
      setPlayers(ps => ps.map(p => p.id === editTarget ? { ...p, name: form.name, number: parseInt(form.number), note: form.note } : p));
    } else {
      setPlayers(ps => [...ps, { id: Date.now(), name: form.name, number: parseInt(form.number), note: form.note }]);
    }
    setScreen("list");
  };

  const handleDelete = (id) => {
    setPlayers(ps => ps.filter(p => p.id !== id));
    setScreen("list");
  };

  const sorted = [...players].sort((a, b) => a.number - b.number);

  // ── 選手一覧 ──
  if (screen === "list") return (
    <div style={{ background: C.bg, minHeight: "100vh", maxWidth: 320, margin: "0 auto", fontFamily: "'Noto Sans JP', sans-serif" }}>
      {/* ヘッダー */}
      <div style={{ background: C.card, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 0 #F0F0F0" }}>
        <div>
          <div style={{ fontSize: 10, color: C.textTer, marginBottom: 2 }}>阪神</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.textPri }}>選手一覧</div>
        </div>
        <div
          onClick={openNew}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 50, background: C.brand, cursor: "pointer", userSelect: "none", boxShadow: "0 2px 8px rgba(61,107,61,0.3)" }}
          onPointerDown={e => e.currentTarget.style.opacity = "0.8"}
          onPointerUp={e => e.currentTarget.style.opacity = "1"}
          onPointerLeave={e => e.currentTarget.style.opacity = "1"}
        >
          <Plus size={14} color={C.brandText} strokeWidth={2.5}/>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.brandText }}>登録</span>
        </div>
      </div>

      {/* テーブルヘッダー */}
      <div style={{ display: "flex", alignItems: "center", padding: "8px 20px", background: C.bg }}>
        <div style={{ width: 44, fontSize: 11, color: C.textTer, fontWeight: 600 }}>背番号</div>
        <div style={{ flex: 1, fontSize: 11, color: C.textTer, fontWeight: 600 }}>氏名</div>
        <div style={{ width: 60, fontSize: 11, color: C.textTer, fontWeight: 600, textAlign: "center" }}>操作</div>
      </div>

      {/* 選手リスト */}
      <div style={{ background: C.card, margin: "0 0", boxShadow: C.cardShadow }}>
        {sorted.map((p, i) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: i < sorted.length - 1 ? `1px solid ${C.divider}` : "none" }}>
            {/* 背番号 */}
            <div style={{ width: 44, fontSize: 15, fontWeight: 800, color: C.brand }}>{p.number}</div>
            {/* 氏名・備考 */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.textPri }}>{p.name}</div>
              {p.note && <div style={{ fontSize: 11, color: C.textTer, marginTop: 2 }}>{p.note}</div>}
            </div>
            {/* 編集ボタン */}
            <div
              onClick={() => openEdit(p)}
              style={{ width: 52, padding: "6px 0", borderRadius: 8, background: C.brandLight, textAlign: "center", fontSize: 12, fontWeight: 700, color: C.brand, cursor: "pointer", userSelect: "none" }}
              onPointerDown={e => e.currentTarget.style.opacity = "0.7"}
              onPointerUp={e => e.currentTarget.style.opacity = "1"}
              onPointerLeave={e => e.currentTarget.style.opacity = "1"}
            >編集</div>
          </div>
        ))}
      </div>

      {/* 選手数 */}
      <div style={{ padding: "12px 20px" }}>
        <span style={{ fontSize: 11, color: C.textTer }}>{players.length}名登録中</span>
      </div>
    </div>
  );

  // ── 選手登録/編集 ──
  return (
    <div style={{ background: C.bg, minHeight: "100vh", maxWidth: 320, margin: "0 auto", fontFamily: "'Noto Sans JP', sans-serif" }}>
      {/* ヘッダー */}
      <div style={{ background: C.card, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 0 #F0F0F0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div onClick={() => setScreen("list")} style={{ cursor: "pointer", padding: 4 }}>
            <X size={20} color={C.textSec}/>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.textPri }}>
            {editTarget ? "選手を編集" : "選手を登録"}
          </div>
        </div>
        <div
          onClick={handleSave}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 50, background: C.brand, cursor: "pointer", userSelect: "none", boxShadow: "0 2px 8px rgba(61,107,61,0.3)" }}
          onPointerDown={e => e.currentTarget.style.opacity = "0.8"}
          onPointerUp={e => e.currentTarget.style.opacity = "1"}
          onPointerLeave={e => e.currentTarget.style.opacity = "1"}
        >
          <Check size={14} color={C.brandText} strokeWidth={2.5}/>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.brandText }}>保存</span>
        </div>
      </div>

      {/* フォーム */}
      <div style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* 名前 */}
        <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, letterSpacing: "0.08em", marginBottom: 8 }}>選手名</div>
          <input
            type="text"
            placeholder="例：近本 光司"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            style={{ width: "100%", border: "none", outline: "none", fontSize: 16, color: C.textPri, background: "transparent", fontFamily: "inherit" }}
          />
          {error.name && <div style={{ fontSize: 11, color: "#8B2020", marginTop: 6 }}>{error.name}</div>}
        </div>

        {/* 背番号 */}
        <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, letterSpacing: "0.08em", marginBottom: 8 }}>背番号</div>
          <input
            type="number"
            placeholder="0〜99"
            value={form.number}
            onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
            style={{ width: "100%", border: "none", outline: "none", fontSize: 16, color: C.textPri, background: "transparent", fontFamily: "inherit" }}
          />
          {error.number && <div style={{ fontSize: 11, color: "#8B2020", marginTop: 6 }}>{error.number}</div>}
        </div>

        {/* 備考 */}
        <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, letterSpacing: "0.08em", marginBottom: 8 }}>備考</div>
          <textarea
            placeholder="例：投手兼外野手、キャプテンなど"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            rows={3}
            style={{ width: "100%", border: "none", outline: "none", fontSize: 14, color: C.textPri, background: "transparent", fontFamily: "inherit", resize: "none", lineHeight: 1.6 }}
          />
        </div>

        {/* 削除ボタン（編集時のみ） */}
        {editTarget && (
          <div
            onClick={() => handleDelete(editTarget)}
            style={{ padding: "14px", borderRadius: 14, textAlign: "center", fontSize: 14, fontWeight: 700, color: "#8B2020", background: "#FFF0F0", cursor: "pointer", userSelect: "none" }}
            onPointerDown={e => e.currentTarget.style.opacity = "0.7"}
            onPointerUp={e => e.currentTarget.style.opacity = "1"}
            onPointerLeave={e => e.currentTarget.style.opacity = "1"}
          >
            この選手を削除
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────
// オーダー登録
// ─────────────────────────────


const POSITIONS = ["-", "投", "捕", "一", "二", "三", "遊", "左", "中", "右", "DH"];

const MY_PLAYERS = [
  { id: 1,  number: 1,  name: "近本 光司" },
  { id: 2,  number: 8,  name: "中野 拓夢" },
  { id: 3,  number: 99, name: "森下 翔太" },
  { id: 4,  number: 6,  name: "大山 悠輔" },
  { id: 5,  number: 5,  name: "佐藤 輝明" },
  { id: 6,  number: 44, name: "ノイジー" },
  { id: 7,  number: 2,  name: "木浪 聖也" },
  { id: 8,  number: 27, name: "坂本 誠志郎" },
  { id: 9,  number: 18, name: "青柳 晃洋" },
  { id: 10, number: 14, name: "西 勇輝" },
  { id: 11, number: 31, name: "岩崎 優" },
];

const PAST_TEAMS = [
  {
    id: 1, name: "巨人",
    players: [
      { id: 101, number: 7,  name: "丸 佳浩" },
      { id: 102, number: 6,  name: "吉川 尚輝" },
      { id: 103, number: 3,  name: "岡本 和真" },
      { id: 104, number: 25, name: "ブリンソン" },
      { id: 105, number: 55, name: "秋広 優人" },
      { id: 106, number: 9,  name: "坂本 勇人" },
      { id: 107, number: 34, name: "オコエ 瑠偉" },
      { id: 108, number: 32, name: "大城 卓三" },
      { id: 109, number: 17, name: "菅野 智之" },
    ],
    lastOrder: [
      { order: 1, playerId: 101, pos: "中" },
      { order: 2, playerId: 102, pos: "二" },
      { order: 3, playerId: 103, pos: "一" },
      { order: 4, playerId: 104, pos: "右" },
      { order: 5, playerId: 105, pos: "三" },
      { order: 6, playerId: 106, pos: "遊" },
      { order: 7, playerId: 107, pos: "左" },
      { order: 8, playerId: 108, pos: "捕" },
      { order: 9, playerId: 109, pos: "投" },
    ],
  },
  { id: 2, name: "中日", players: [], lastOrder: [] },
  { id: 3, name: "広島", players: [], lastOrder: [] },
];

const makeEmptyOrder = () =>
  Array.from({ length: 9 }, (_, i) => ({ order: i + 1, playerId: null, pos: "-" }));

// ── ドラッグ可能なオーダー行 ──
function OrderRow({ row, idx, players, stamenIds, onPlayerChange, onPosChange, onDragStart, onDragOver, onDrop, isLast }) {
  const player = players.find(p => p.id === row.playerId);
  const selectStyle = {
    border: "none", outline: "none", background: "transparent",
    fontSize: 13, color: C.textPri, fontFamily: "inherit",
    cursor: "pointer", appearance: "none", WebkitAppearance: "none",
  };

  return (
    <div
      draggable
      onDragStart={() => onDragStart(idx)}
      onDragOver={e => { e.preventDefault(); onDragOver(idx); }}
      onDrop={onDrop}
      style={{ display: "flex", alignItems: "center", padding: "10px 12px", borderBottom: !isLast ? `1px solid ${C.divider}` : "none", gap: 8, background: C.card }}
    >
      <div style={{ cursor: "grab", color: C.textTer, flexShrink: 0 }}><GripVertical size={16}/></div>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: C.brandLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.brand }}>{row.order}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <select value={row.playerId || ""} onChange={e => onPlayerChange(row.order, e.target.value)}
          style={{ ...selectStyle, width: "100%", fontSize: 14, fontWeight: player ? 600 : 400, color: player ? C.textPri : C.textTer }}>
          <option value="">-- 選択 --</option>
          {players.map(p => (
            <option key={p.id} value={p.id} disabled={stamenIds.includes(p.id) && p.id !== row.playerId}>
              #{p.number} {p.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ width: 44, display: "flex", alignItems: "center", justifyContent: "center", background: C.brandLight, borderRadius: 8, padding: "4px 2px" }}>
        <select value={row.pos} onChange={e => onPosChange(row.order, e.target.value)}
          style={{ ...selectStyle, fontSize: 13, fontWeight: 700, color: C.brand, textAlign: "center", width: "100%" }}>
          {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
    </div>
  );
}

// ── 自チームタブ ──
function MyTeamTab() {
  const [lineup, setLineup] = useState([
    { order: 1, playerId: 1,  pos: "中" },
    { order: 2, playerId: 2,  pos: "二" },
    { order: 3, playerId: 3,  pos: "右" },
    { order: 4, playerId: 4,  pos: "一" },
    { order: 5, playerId: 5,  pos: "三" },
    { order: 6, playerId: 6,  pos: "左" },
    { order: 7, playerId: 7,  pos: "遊" },
    { order: 8, playerId: 8,  pos: "捕" },
    { order: 9, playerId: 9,  pos: "投" },
  ]);
  const [players, setPlayers] = useState(MY_PLAYERS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: "", number: "" });
  const dragIdx = useRef(null);
  const dragOverIdx = useRef(null);

  const stamenIds = lineup.map(l => l.playerId).filter(Boolean);
  const bench = players.filter(p => !stamenIds.includes(p.id));

  const updatePlayer = (order, val) => setLineup(l => l.map(r => r.order === order ? { ...r, playerId: parseInt(val) || null } : r));
  const updatePos = (order, pos) => setLineup(l => l.map(r => r.order === order ? { ...r, pos } : r));

  const handleDrop = () => {
    if (dragIdx.current === null || dragOverIdx.current === null) return;
    const arr = [...lineup];
    const [moved] = arr.splice(dragIdx.current, 1);
    arr.splice(dragOverIdx.current, 0, moved);
    setLineup(arr.map((r, i) => ({ ...r, order: i + 1 })));
    dragIdx.current = null; dragOverIdx.current = null;
  };

  const addPlayer = () => {
    if (!newPlayer.name.trim() || !newPlayer.number) return;
    const id = Date.now();
    setPlayers(p => [...p, { id, number: parseInt(newPlayer.number), name: newPlayer.name }]);
    setNewPlayer({ name: "", number: "" });
    setShowAddForm(false);
  };

  return (
    <div>
      {/* テーブルヘッダー */}
      <div style={{ display: "flex", alignItems: "center", padding: "0 12px 6px", gap: 8 }}>
        <div style={{ width: 24 }}/><div style={{ width: 20 }}/>
        <div style={{ flex: 1, fontSize: 10, color: C.textTer, fontWeight: 600 }}>選手</div>
        <div style={{ width: 44, fontSize: 10, color: C.textTer, fontWeight: 600, textAlign: "center" }}>位置</div>
      </div>

      {/* スタメン */}
      <div style={{ background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: C.cardShadow, marginBottom: 8 }}>
        {lineup.map((row, idx) => (
          <OrderRow key={row.order} row={row} idx={idx} players={players} stamenIds={stamenIds}
            onPlayerChange={updatePlayer} onPosChange={updatePos}
            onDragStart={i => { dragIdx.current = i; }} onDragOver={i => { dragOverIdx.current = i; }} onDrop={handleDrop}
            isLast={idx === 8}
          />
        ))}
      </div>

      {/* 新規選手追加ボタン */}
      <div onClick={() => setShowAddForm(s => !s)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", marginBottom: 8, cursor: "pointer", userSelect: "none" }}>
        <Plus size={14} color={C.brand}/>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.brand }}>選手をその場で追加</span>
      </div>

      {/* 新規選手フォーム */}
      {showAddForm && (
        <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow, marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <input placeholder="名前" value={newPlayer.name} onChange={e => setNewPlayer(n => ({ ...n, name: e.target.value }))}
            style={{ flex: 1, border: "none", borderBottom: `1px solid ${C.divider}`, outline: "none", fontSize: 13, padding: "4px 0", fontFamily: "inherit" }}/>
          <input placeholder="#" type="number" value={newPlayer.number} onChange={e => setNewPlayer(n => ({ ...n, number: e.target.value }))}
            style={{ width: 40, border: "none", borderBottom: `1px solid ${C.divider}`, outline: "none", fontSize: 13, padding: "4px 0", textAlign: "center", fontFamily: "inherit" }}/>
          <div onClick={addPlayer} style={{ padding: "6px 12px", borderRadius: 20, background: C.brand, fontSize: 12, fontWeight: 700, color: C.brandText, cursor: "pointer" }}>追加</div>
          <X size={16} color={C.textTer} style={{ cursor: "pointer" }} onClick={() => setShowAddForm(false)}/>
        </div>
      )}

      {/* 控え */}
      <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, letterSpacing: "0.08em", margin: "12px 0 8px" }}>控え</div>
      <div style={{ background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: C.cardShadow }}>
        {bench.length === 0
          ? <div style={{ padding: "14px 16px", fontSize: 13, color: C.textTer, textAlign: "center" }}>控え選手なし</div>
          : bench.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: i < bench.length - 1 ? `1px solid ${C.divider}` : "none", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.textSec }}>{p.number}</span>
              </div>
              <span style={{ fontSize: 13, color: C.textSec }}>{p.name}</span>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── 相手チームタブ ──
function OpponentTab() {
  const [step, setStep] = useState("select"); // select | order
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamName, setTeamName] = useState("");
  const [lineup, setLineup] = useState(makeEmptyOrder());
  const [players, setPlayers] = useState([]);
  const [pastOpen, setPastOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: "", number: "" });
  const dragIdx = useRef(null);
  const dragOverIdx = useRef(null);

  const selectPast = (team) => {
    setSelectedTeam(team);
    setTeamName(team.name);
    setPlayers(team.players);
    setLineup(team.lastOrder.length ? [...team.lastOrder] : makeEmptyOrder());
    setPastOpen(false);
    setStep("order");
  };

  const startNew = () => {
    if (!teamName.trim()) return;
    setSelectedTeam(null);
    setPlayers([]);
    setLineup(makeEmptyOrder());
    setStep("order");
  };

  const stamenIds = lineup.map(l => l.playerId).filter(Boolean);
  const bench = players.filter(p => !stamenIds.includes(p.id));

  const updatePlayer = (order, val) => setLineup(l => l.map(r => r.order === order ? { ...r, playerId: parseInt(val) || null } : r));
  const updatePos = (order, pos) => setLineup(l => l.map(r => r.order === order ? { ...r, pos } : r));
  const handleDrop = () => {
    if (dragIdx.current === null || dragOverIdx.current === null) return;
    const arr = [...lineup];
    const [moved] = arr.splice(dragIdx.current, 1);
    arr.splice(dragOverIdx.current, 0, moved);
    setLineup(arr.map((r, i) => ({ ...r, order: i + 1 })));
    dragIdx.current = null; dragOverIdx.current = null;
  };

  const addPlayer = () => {
    if (!newPlayer.name.trim()) return;
    const id = Date.now();
    setPlayers(p => [...p, { id, number: parseInt(newPlayer.number) || 0, name: newPlayer.name }]);
    setNewPlayer({ name: "", number: "" });
    setShowAddForm(false);
  };

  // チーム選択画面
  if (step === "select") return (
    <div>
      {/* 新規チーム（上） */}
      <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, letterSpacing: "0.08em", marginBottom: 8 }}>新規チーム</div>
      <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow, display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <input
          placeholder="チーム名を入力"
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          style={{ flex: 1, border: "none", borderBottom: `1px solid ${C.divider}`, outline: "none", fontSize: 14, padding: "4px 0", fontFamily: "inherit" }}
        />
        <div
          onClick={startNew}
          style={{ padding: "8px 14px", borderRadius: 20, background: teamName.trim() ? C.brand : C.bg, fontSize: 13, fontWeight: 700, color: teamName.trim() ? C.brandText : C.textTer, cursor: teamName.trim() ? "pointer" : "default", transition: "background 0.15s" }}
        >次へ</div>
      </div>

      {/* 過去のチーム（折りたたみ） */}
      <div
        onClick={() => setPastOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: C.card, borderRadius: pastOpen ? "14px 14px 0 0" : 14, boxShadow: C.cardShadow, cursor: "pointer", userSelect: "none" }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: C.textPri }}>過去の対戦チームから選ぶ</span>
        <ChevronDown size={16} color={C.textTer} style={{ transform: pastOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}/>
      </div>

      {pastOpen && (
        <div style={{ background: C.card, borderRadius: "0 0 14px 14px", overflow: "hidden", boxShadow: C.cardShadow }}>
          <div style={{ height: "0.5px", background: C.divider }}/>
          {PAST_TEAMS.map((team, i) => (
            <div key={team.id} onClick={() => selectPast(team)}
              style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: i < PAST_TEAMS.length - 1 ? `1px solid ${C.divider}` : "none", cursor: "pointer" }}
              onPointerDown={e => e.currentTarget.style.background = C.brandLight}
              onPointerUp={e => e.currentTarget.style.background = "transparent"}
              onPointerLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri }}>{team.name}</div>
                <div style={{ fontSize: 11, color: C.textTer, marginTop: 2 }}>{team.players.length}名登録済</div>
              </div>
              <span style={{ fontSize: 11, color: C.brand, fontWeight: 600 }}>使う →</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // オーダー登録画面
  return (
    <div>
      {/* チーム名 + 戻るリンク */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri }}>{teamName || "相手チーム"}</div>
        <span onClick={() => setStep("select")} style={{ fontSize: 12, color: C.brand, cursor: "pointer", borderBottom: `1px dashed ${C.brand}` }}>チームを変更</span>
      </div>

      {selectedTeam && (
        <div style={{ padding: "8px 12px", background: C.brandLight, borderRadius: 10, marginBottom: 10, fontSize: 11, color: C.brand, fontWeight: 600 }}>
          前回のオーダーを使用中。変更可能です。
        </div>
      )}

      {/* テーブルヘッダー */}
      <div style={{ display: "flex", alignItems: "center", padding: "0 12px 6px", gap: 8 }}>
        <div style={{ width: 24 }}/><div style={{ width: 20 }}/>
        <div style={{ flex: 1, fontSize: 10, color: C.textTer, fontWeight: 600 }}>選手</div>
        <div style={{ width: 44, fontSize: 10, color: C.textTer, fontWeight: 600, textAlign: "center" }}>位置</div>
      </div>

      <div style={{ background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: C.cardShadow, marginBottom: 8 }}>
        {lineup.map((row, idx) => (
          <OrderRow key={row.order} row={row} idx={idx} players={players} stamenIds={stamenIds}
            onPlayerChange={updatePlayer} onPosChange={updatePos}
            onDragStart={i => { dragIdx.current = i; }} onDragOver={i => { dragOverIdx.current = i; }} onDrop={handleDrop}
            isLast={idx === 8}
          />
        ))}
      </div>

      {/* 選手をその場で追加 */}
      <div onClick={() => setShowAddForm(s => !s)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", marginBottom: 8, cursor: "pointer", userSelect: "none" }}>
        <Plus size={14} color={C.brand}/>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.brand }}>選手をその場で追加</span>
      </div>

      {showAddForm && (
        <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow, marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <input placeholder="名前" value={newPlayer.name} onChange={e => setNewPlayer(n => ({ ...n, name: e.target.value }))}
            style={{ flex: 1, border: "none", borderBottom: `1px solid ${C.divider}`, outline: "none", fontSize: 13, padding: "4px 0", fontFamily: "inherit" }}/>
          <input placeholder="#" type="number" value={newPlayer.number} onChange={e => setNewPlayer(n => ({ ...n, number: e.target.value }))}
            style={{ width: 40, border: "none", borderBottom: `1px solid ${C.divider}`, outline: "none", fontSize: 13, padding: "4px 0", textAlign: "center", fontFamily: "inherit" }}/>
          <div onClick={addPlayer} style={{ padding: "6px 12px", borderRadius: 20, background: C.brand, fontSize: 12, fontWeight: 700, color: C.brandText, cursor: "pointer" }}>追加</div>
          <X size={16} color={C.textTer} style={{ cursor: "pointer" }} onClick={() => setShowAddForm(false)}/>
        </div>
      )}

      {/* 控え */}
      {bench.length > 0 && <>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, letterSpacing: "0.08em", margin: "12px 0 8px" }}>控え</div>
        <div style={{ background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: C.cardShadow }}>
          {bench.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: i < bench.length - 1 ? `1px solid ${C.divider}` : "none", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.textSec }}>{p.number}</span>
              </div>
              <span style={{ fontSize: 13, color: C.textSec }}>{p.name}</span>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}

// ── メイン ──
function OrderRegistration({ onNext, onBack }) {
  const [tab, setTab] = useState("my");

  return (
    <div style={{ background: C.bg, minHeight: "100vh", maxWidth: 320, margin: "0 auto", fontFamily: "'Noto Sans JP', sans-serif" }}>
      {/* ヘッダー */}
      <div style={{ background: C.card, padding: "16px 20px 0", boxShadow: "0 1px 0 #F0F0F0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: C.textTer, marginBottom: 2 }}>6月10日</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.textPri }}>オーダー登録</div>
          </div>
          <div
            onClick={onNext}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 50, background: C.brand, cursor: "pointer", userSelect: "none", boxShadow: "0 2px 8px rgba(61,107,61,0.3)" }}
            onPointerDown={e => e.currentTarget.style.opacity = "0.8"}
            onPointerUp={e => e.currentTarget.style.opacity = "1"}
            onPointerLeave={e => e.currentTarget.style.opacity = "1"}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: C.brandText }}>記録開始 →</span>
          </div>
        </div>

        {/* タブ */}
        <div style={{ display: "flex" }}>
          {[{ id: "my", label: "自チーム（阪神）" }, { id: "opp", label: "相手チーム" }].map(t => (
            <div key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "10px 8px", textAlign: "center",
              fontSize: 13, fontWeight: 600, cursor: "pointer", userSelect: "none",
              color: tab === t.id ? C.brand : C.textTer,
              borderBottom: tab === t.id ? `2px solid ${C.brand}` : "2px solid transparent",
              transition: "color 0.15s, border-color 0.15s",
            }}>{t.label}</div>
          ))}
        </div>
      </div>

      {/* コンテンツ */}
      <div style={{ padding: "16px 16px 32px" }}>
        {tab === "my" ? <MyTeamTab/> : <OpponentTab/>}
      </div>
    </div>
  );
}

// ─────────────────────────────
// 試合記録
// ─────────────────────────────
function GameRecordScreen() {
  const [activeView, setActiveView] = useState("record");
  const [darkMode, setDarkMode] = useState(false);
  const [screen, setScreen] = useState("main");
  const [history, setHistory] = useState([]);

  const [balls, setBalls] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [outs, setOuts] = useState(0);
  const [inning, setInning] = useState(1);
  const [isTop, setIsTop] = useState(true);
  const [batterIdxA, setBatterIdxA] = useState(0);
  const [batterIdxB, setBatterIdxB] = useState(0);
  const [runners, setRunners] = useState({ ...RUNNERS_INIT });
  const [pitchCount, setPitchCount] = useState(0);
  const [stateHistory, setStateHistory] = useState([]); // スナップショット履歴
  const [toast, setToast] = useState(null);
  const [alert, setAlert] = useState(null);

  // 進塁確認フロー
  const [pendingResult, setPendingResult] = useState(null);
  const [runnerQueue, setRunnerQueue] = useState([]);
  const [currentRunnerIdx, setCurrentRunnerIdx] = useState(0);
  const [newRunners, setNewRunners] = useState({ ...RUNNERS_INIT });
  const [pendingBatterBase, setPendingBatterBase] = useState(null);
  const [pendingIsOut, setPendingIsOut] = useState(false);
  const [selectedBase, setSelectedBase] = useState(null);

  // ── gameLog：経過ビューと共有するデータ ──
  const getPitcherNumber = (top) => top ? PITCHER_B.number : PITCHER_A.number;

  const initHalf = (inn, top, batters, idx) => ({
    inning: inn, topBottom: top ? "表" : "裏",
    atBats: [{ ...makeBat(batters[idx % 9], getPitcherNumber(top), { first: false, second: false, third: false }) }],
  });

  const [gameLog, setGameLog] = useState([
    initHalf(1, true, BATTERS_A, 0)
  ]);

  const scoreA = gameLog.reduce((sum, h) => h.topBottom === "表" ? sum + h.atBats.reduce((s, ab) => s + (ab.runsScored||0), 0) : sum, 0);
  const scoreB = gameLog.reduce((sum, h) => h.topBottom === "裏" ? sum + h.atBats.reduce((s, ab) => s + (ab.runsScored||0), 0) : sum, 0);

  // 現在のハーフイニングと打席へのアクセサ
  const currentHalfIdx = gameLog.length - 1;
  const currentHalf = gameLog[currentHalfIdx];
  const currentAtBatIdx = currentHalf.atBats.length - 1;
  const currentAtBat = currentHalf.atBats[currentAtBatIdx];

  const batters = isTop ? BATTERS_A : BATTERS_B;
  const batterIdx = isTop ? batterIdxA : batterIdxB;
  const setBatterIdx = isTop ? setBatterIdxA : setBatterIdxB;
  const pitcher = isTop ? PITCHER_B : PITCHER_A;
  const batter = batters[batterIdx % 9];
  const next1 = batters[(batterIdx + 1) % 9];
  const next2 = batters[(batterIdx + 2) % 9];

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };
  const goTo = (s) => { setHistory(h => [...h, screen]); setScreen(s); };
  const goBack = () => {
    if (!history.length) return;
    setScreen(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
  };

  // gameLog更新ヘルパー
  const updateCurrentPitches = (updater) => {
    setGameLog(log => {
      const next = log.map((h, hi) => hi !== currentHalfIdx ? h : {
        ...h,
        atBats: h.atBats.map((ab, ai) => ai !== currentAtBatIdx ? ab : { ...ab, pitches: updater(ab.pitches) })
      });
      return next;
    });
  };

  const addEvent = (event) => {
    setGameLog(log => log.map((h, hi) => hi !== currentHalfIdx ? h : {
      ...h,
      atBats: h.atBats.map((ab, ai) => ai !== currentAtBatIdx ? ab : { ...ab, events: [...ab.events, event] })
    }));
  };

  const closeCurrentAtBat = (result, runnersAfter = null) => {
    setGameLog(log => log.map((h, hi) => hi !== currentHalfIdx ? h : {
      ...h,
      atBats: h.atBats.map((ab, ai) => ai !== currentAtBatIdx ? ab : {
        ...ab, result,
        runnersAfter: runnersAfter ?? runners,
      })
    }));
  };

  const openNextAtBat = (newIsTop, newInning, newBatters, newIdx, runnersSnapshot) => {
    const top = newIsTop ?? isTop;
    const inn = newInning ?? inning;
    const bs = newBatters ?? batters;
    const idx = newIdx ?? ((batterIdx + 1) % 9);
    const player = bs[idx];
    const snap = runnersSnapshot ?? runners;

    setGameLog(log => {
      // チェンジでハーフイニング追加
      if (newIsTop !== undefined) {
        return [...log, initHalf(inn, top, bs, idx % 9)];
      }
      // 同じハーフに打席追加
      return log.map((h, hi) => hi !== currentHalfIdx ? h : {
        ...h,
        atBats: [...h.atBats, { ...makeBat(player, getPitcherNumber(top), { ...snap }) }]
      });
    });
  };

  const addScore = (n) => {
    if (n <= 0) return;
    setGameLog(log => log.map((h, hi) => hi !== currentHalfIdx ? h : {
      ...h,
      atBats: h.atBats.map((ab, ai) => ai !== currentAtBatIdx ? ab : {
        ...ab, runsScored: (ab.runsScored||0) + n,
      })
    }));
  };

  const resetAtBat = () => { setBalls(0); setStrikes(0); };

  const nextAtBat = (newIsTop, newInning, newBatters) => {
    const newIdx = newIsTop !== undefined ? 0 : (batterIdx + 1) % 9;
    setBatterIdx(newIsTop !== undefined ? (i => i) : (i => i + 1));
    resetAtBat();
    openNextAtBat(newIsTop, newInning, newBatters, newIdx);
  };

  const doOut = (runnersState) => {
    const no = outs + 1;
    if (no >= 3) {
      showToast("チェンジ！");
      setOuts(0);
      setRunners({ ...RUNNERS_INIT });
      const newTop = !isTop;
      const newInn = !isTop ? inning + 1 : inning;
      if (!isTop) setInning(i => i + 1);
      setIsTop(newTop);
      const newBatters = newTop ? BATTERS_A : BATTERS_B;
      // バッターがアウトになってチェンジ → そのバッターの打席は終わったので次の打者へ進める
      if (isTop) setBatterIdxA(i => i + 1); else setBatterIdxB(i => i + 1);
      const newIdx = newTop ? batterIdxA % 9 : batterIdxB % 9;
      setBalls(0); setStrikes(0);
      setGameLog(log => [...log, initHalf(newInn, newTop, newBatters, newIdx)]);
    } else {
      setOuts(no);
      if (runnersState) setRunners(runnersState);
      setBatterIdx(i => i + 1);
      resetAtBat();
      openNextAtBat(undefined, undefined, undefined);
    }
  };

  const advanceWalk = (currentRunners, batterNumber) => {
    const next = { ...(currentRunners ?? runners) };
    if (next.first && next.second && next.third) {
      addScore(1);
      next.third = next.second;
      next.second = next.first;
      next.first = batterNumber;
    } else if (next.first && next.second) {
      next.third = next.second;
      next.second = next.first;
      next.first = batterNumber;
    } else if (next.first) {
      next.second = next.first;
      next.first = batterNumber;
    } else {
      next.first = batterNumber;
    }
    setRunners(next);
    return next;
  };

  const buildRunnerQueue = (r) => {
    const allBatters = [...BATTERS_A, ...BATTERS_B];
    const findPlayer = (num) => allBatters.find(b => b.number === num) ?? { number: num, name: "?" };
    const q = [];
    if (r.first)  q.push({ base:"first",  label:"1塁", baseNum:1, player: findPlayer(r.first) });
    if (r.second) q.push({ base:"second", label:"2塁", baseNum:2, player: findPlayer(r.second) });
    if (r.third)  q.push({ base:"third",  label:"3塁", baseNum:3, player: findPlayer(r.third) });
    return q;
  };

  const startRunnerFlow = (result, isOut, batterBase) => {
    const queue = buildRunnerQueue(runners);
    setPendingResult(result);
    setPendingBatterBase(batterBase);
    setPendingIsOut(isOut);
    setNewRunners({ ...RUNNERS_INIT });
    setCurrentRunnerIdx(0);
    setRunnerQueue(queue);
    if (queue.length === 0) {
      finishAtBat(isOut, batterBase, { ...RUNNERS_INIT });
      return;
    }
    if (isOut) { setScreen("askAdvance"); setHistory(h => [...h, "inplay"]); }
    else { setScreen("runnerAdvance"); setHistory(h => [...h, "inplay"]); }
  };

  const handleInplayResult = (result) => {
    // 特殊結果（死球・故意四球・振り逃げ）は専用ハンドラへ
    if (result.special === "DB")  { handlePitch("DB");  return; }
    if (result.special === "IBB") { handlePitch("IBB"); return; }
    if (result.special === "振")  { handlePitch("振");  return; }
    if (result.label.includes("本塁打") || result.label.includes("ホームラン")) {
      const sc = (runners.first?1:0)+(runners.second?1:0)+(runners.third?1:0)+1;
      closeCurrentAtBat(result.label, { ...RUNNERS_INIT }); // runnersAfter = 全員生還でリセット
      addScore(sc);
      setRunners({ ...RUNNERS_INIT });
      showToast("ホームラン！");
      setBatterIdx(i => i + 1); resetAtBat();
      openNextAtBat(undefined, undefined, undefined, undefined, { ...RUNNERS_INIT });
      setScreen("main"); setHistory([]); return;
    }
    closeCurrentAtBat(result.label);
    startRunnerFlow(result, result.type === "out", result.batterBase ?? null);
    setHistory(h => { const nh=[...h]; nh[nh.length-1]="inplay"; return nh; });
  };

  const handleAskAdvance = (yes) => {
    if (!yes) { finishAtBat(true, null, runners); setScreen("main"); setHistory([]); }
    else setScreen("runnerAdvance");
  };

  const handleRunnerAdvance = (toBase) => {
    let score = 0;
    const next = { ...newRunners };
    if (toBase === 4) score = 1;
    else if (toBase !== "out") {
      const runnerNum = currentRunner.player.number;
      if (toBase === 1) next.first = runnerNum;
      if (toBase === 2) next.second = runnerNum;
      if (toBase === 3) next.third = runnerNum;
    }
    addScore(score);
    const nextIdx = currentRunnerIdx + 1;
    if (nextIdx >= runnerQueue.length) {
      finishAtBat(pendingIsOut, pendingBatterBase, next);
      setScreen("main"); setHistory([]);
    } else {
      setNewRunners(next);
      setCurrentRunnerIdx(nextIdx);
    }
  };

  const finishAtBat = (isOut, batterBase, finalRunners) => {
    if (isOut) {
      showToast(pendingResult?.label ?? "アウト");
      setGameLog(log => log.map((h, hi) => hi !== currentHalfIdx ? h : {
        ...h,
        atBats: h.atBats.map((ab, ai) => ai !== currentAtBatIdx ? ab : { ...ab, runnersAfter: finalRunners })
      }));
      doOut(finalRunners);
    } else {
      const next = { ...finalRunners };
      // 打者を指定塁に配置。すでにランナーがいる場合は1塁ずつ押し出し
      const placeAt = (base, num, state) => {
        if (base === 1) {
          if (state.first) {
            if (state.second) {
              if (state.third) { addScore(1); }
              else state.third = state.second;
            }
            state.second = state.first;
          }
          state.first = num;
        } else if (base === 2) {
          if (state.second) {
            if (state.third) { addScore(1); }
            else state.third = state.second;
          }
          state.second = num;
        } else if (base === 3) {
          if (state.third) addScore(1);
          state.third = num;
        }
      };
      if (batterBase !== null && batterBase !== undefined) placeAt(batterBase, batter.number, next);
      showToast(pendingResult?.label ?? "出塁");
      setGameLog(log => log.map((h, hi) => hi !== currentHalfIdx ? h : {
        ...h,
        atBats: h.atBats.map((ab, ai) => ai !== currentAtBatIdx ? ab : { ...ab, runnersAfter: next })
      }));
      setRunners(next);
      setBatterIdx(i => i + 1); resetAtBat();
      openNextAtBat(undefined, undefined, undefined, undefined, next);
    }
    setScreen("main");
    setHistory([]);
  };

  const handleWildStrike = () => {
    updateCurrentPitches(p => [...p, "振"]);
    const queue = buildRunnerQueue(runners);
    setPendingResult({ label:"振り逃げ", type:"safe" });
    setPendingBatterBase(1); setPendingIsOut(false);
    setNewRunners({ ...RUNNERS_INIT }); setCurrentRunnerIdx(0); setRunnerQueue(queue);
    if (queue.length === 0) {
      const nextRunners = advanceWalk(runners, batter.number);
      closeCurrentAtBat("振り逃げ", nextRunners);
      showToast("振り逃げ");
      setBatterIdx(i => i + 1); resetAtBat(); openNextAtBat(undefined, undefined, undefined, undefined, nextRunners);
    } else {
      closeCurrentAtBat("振り逃げ");
      setScreen("runnerAdvance"); setHistory(h => [...h, "main"]);
    }
  };

  // スナップショットを保存
  const saveSnapshot = () => {
    setStateHistory(h => [...h, {
      balls, strikes, outs, inning, isTop,
      batterIdxA, batterIdxB,
      runners: { ...runners }, pitchCount,
      gameLog: JSON.parse(JSON.stringify(gameLog)),
    }]);
  };

  // 1球取消（スナップショット巻き戻し）
  const handleUndo = () => {
    if (stateHistory.length === 0) return;
    const prev = stateHistory[stateHistory.length - 1];
    setBalls(prev.balls);
    setStrikes(prev.strikes);
    setOuts(prev.outs);
    setInning(prev.inning);
    setIsTop(prev.isTop);
    setBatterIdxA(prev.batterIdxA);
    setBatterIdxB(prev.batterIdxB);
    setRunners(prev.runners);
    setPitchCount(prev.pitchCount);
    setGameLog(prev.gameLog);
    setStateHistory(h => h.slice(0, -1));
    setScreen("main");
    setHistory([]);
    showToast("1球取消しました");
  };

  const handlePitch = (type) => {
    if (type !== "IP") saveSnapshot(); // IPはhandleInplayResultで保存
    setPitchCount(c => c + 1);
    updateCurrentPitches(p => [...p, type]);
    if (type === "B") {
      const nb = balls + 1;
      if (nb >= 4) {
        const nextRunners = advanceWalk(runners, batter.number);
        closeCurrentAtBat("フォアボール", nextRunners);
        showToast("フォアボール");
        setBatterIdx(i => i + 1); resetAtBat(); openNextAtBat(undefined, undefined, undefined, undefined, nextRunners);
      } else setBalls(nb);
    } else if (type === "見逃" || type === "空振") {
      const ns = strikes + 1;
      if (ns >= 3) {
        const strikeoutLabel = type === "見逃" ? "三振（K）" : "三振（KS）";
        closeCurrentAtBat(strikeoutLabel, runners);
        showToast(strikeoutLabel);
        doOut(runners);
      } else setStrikes(ns);
    } else if (type === "振") {
      handleWildStrike();
    } else if (type === "F") {
      setStrikes(s => Math.min(s + 1, 2));
    } else if (type === "IP") {
      saveSnapshot(); // インプレー画面に入る前に保存
      goTo("inplay");
    } else if (type === "DB") {
      const nextRunners = advanceWalk(runners, batter.number);
      closeCurrentAtBat("デッドボール", nextRunners);
      showToast("デッドボール");
      setBatterIdx(i => i + 1); resetAtBat(); openNextAtBat(undefined, undefined, undefined, undefined, nextRunners);
    } else if (type === "IBB") {
      const nextRunners = advanceWalk(runners, batter.number);
      closeCurrentAtBat("故意四球", nextRunners);
      showToast("故意四球");
      setBatterIdx(i => i + 1); resetAtBat(); openNextAtBat(undefined, undefined, undefined, undefined, nextRunners);
    }
  };

  const handleBaseClick = (base) => { setSelectedBase(base); goTo("baseAction"); };

  const handleBaseAction = (action) => {
    const base = selectedBase;
    const nb = nextBase(base);
    if (action === "盗塁成功" && nb && runners[nb]) { setAlert("前にランナーがいます"); return; }
    saveSnapshot();
    if (action === "盗塁成功") {
      addEvent("盗塁成功");
      setRunners(r => {
        const next = { ...r };
        const runnerNum = r[base];
        next[base] = null;
        if (base === "first") next.second = runnerNum;
        else if (base === "second") next.third = runnerNum;
        else { addScore(1); }
        return next;
      });
      showToast("盗塁成功");
    } else if (action === "盗塁死" || action === "牽制アウト") {
      addEvent(action);
      setRunners(r => ({ ...r, [base]: null }));
      showToast(action);
      const no = outs + 1;
      if (no >= 3) { setOuts(0); setRunners({ ...RUNNERS_INIT }); if (!isTop) setInning(i=>i+1); setIsTop(t=>!t); }
      else setOuts(no);
    } else if (action === "牽制セーフ") {
      addEvent("牽制セーフ"); showToast("牽制セーフ");
    }
    goBack();
  };

  const canGoBack = history.length > 0;
  const currentRunner = runnerQueue[currentRunnerIdx];
  const advanceOptions = (baseNum) => {
    const opts = [];
    for (let b = baseNum; b <= 3; b++) opts.push({ label: BASE_NAMES[b], value: b });
    opts.push({ label:"ホーム（得点）", value:4 });
    opts.push({ label:"アウト（走塁死）", value:"out" });
    return opts;
  };

  // 現在の打席の投球履歴（gameLogから取得）
  const currentPitches = currentAtBat?.pitches ?? [];

  return (
    <div style={{ display:"flex", justifyContent:"center", padding:"0 0 16px", background: C.bg, minHeight:"100vh" }}>
      <div style={{ background: C.bg, borderRadius:0, padding:0, width:320, position:"relative" }}>

        {/* アラート */}
        {alert && (
          <div style={{ position:"absolute", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.4)", borderRadius:24 }}>
            <div style={{ background:C.card, borderRadius:12, padding:"20px 24px", width:220, textAlign:"center" }}>
              <div style={{ fontSize:14, fontWeight:600, color:C.textPri, marginBottom:16 }}>{alert}</div>
              <Btn label="OK" bg={C.brandLight} border={C.brand} color={C.brand} onClick={() => setAlert(null)}/>
            </div>
          </div>
        )}

        <div style={{ background: C.bg, borderRadius:0 }}>

          {/* スコアバー */}
          <div style={{ background: C.scoreBg, padding:"14px 20px 16px" }}>
            <div style={{ fontSize:9, color:C.scoreSubText, textAlign:"center", letterSpacing:"0.15em", marginBottom:10, opacity:0.9, fontWeight:500 }}>NEO SCORE BOOK</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
              <div style={{ opacity:isTop?1:0.35, transition:"opacity 0.2s" }}>
                <div style={{ color:C.scoreSubText, fontSize:11, marginBottom:2 }}>{TEAM_A}</div>
                <div style={{ color:C.scoreText, fontSize:isTop?36:28, fontWeight:800, lineHeight:1 }}>{scoreA}</div>
              </div>
              <div style={{ textAlign:"center", paddingBottom:4 }}>
                <div style={{ color:C.scoreSubText, fontSize:12 }}>{inning}回 {isTop?"▲ 表":"▼ 裏"}</div>
              </div>
              <div style={{ textAlign:"right", opacity:isTop?0.35:1, transition:"opacity 0.2s" }}>
                <div style={{ color:C.scoreSubText, fontSize:11, marginBottom:2 }}>{TEAM_B}</div>
                <div style={{ color:C.scoreText, fontSize:isTop?28:36, fontWeight:800, lineHeight:1 }}>{scoreB}</div>
              </div>
            </div>
          </div>

          {/* 経過ビュー */}
          {activeView === "history" && <HistoryView gameLog={gameLog} />}

          {/* 成績ビュー */}
          {activeView === "stats" && (
            <StatsView gameLog={gameLog} battersA={BATTERS_A} battersB={BATTERS_B} />
          )}

          {activeView === "settings" && (
            <div style={{ padding:"24px 14px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.textPri, marginBottom:16 }}>設定</div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", background:C.bg, borderRadius:10, border:`1px solid ${C.divider}`, marginBottom:8 }}>
                <span style={{ fontSize:13, color:C.textPri }}>ダークモード</span>
                <div onClick={() => setDarkMode(d => !d)} style={{ width:44, height:26, borderRadius:13, background: darkMode?C.brand:"#DDDDDD", position:"relative", cursor:"pointer", transition:"background 0.2s" }}>
                  <div style={{ width:20, height:20, borderRadius:"50%", background:"white", position:"absolute", top:3, left: darkMode?21:3, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" }}/>
                </div>
              </div>
              <div style={{ padding:"12px 14px", background:C.bg, borderRadius:10, border:`1px solid ${C.divider}` }}>
                <div style={{ fontSize:11, color:C.textTer, marginBottom:4 }}>バージョン</div>
                <div style={{ fontSize:13, color:C.textPri }}>neo score book v0.1.0</div>
              </div>
            </div>
          )}

          {/* 記録ビュー */}
          {activeView === "record" && <>

            {/* 戻るバー */}
            <div style={{ padding:"6px 14px", borderBottom:`1px solid ${C.divider}`, display:"flex", alignItems:"center" }}>
              <div onClick={canGoBack?goBack:undefined} style={{ display:"flex", alignItems:"center", gap:3, fontSize:12, cursor:canGoBack?"pointer":"default", color:canGoBack?C.textSec:C.textTer }}>
                <i className="ti ti-chevron-left" style={{ fontSize:14 }} aria-hidden="true"/>
                {canGoBack?"戻る":""}
              </div>
            </div>

            {/* メイン画面 */}
            {screen === "main" && <>

              {/* 状況エリア */}
              <div style={{ padding:"12px 20px", display:"flex", alignItems:"center", gap:12, background: C.card, boxShadow: C.cardShadow, margin:"12px 16px 0", borderRadius:20 }}>
                <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                  {[
                    { label:"B", count:balls,   max:3, color: C.bsoB },
                    { label:"S", count:strikes, max:2, color: C.bsoS },
                    { label:"O", count:outs,    max:2, color: C.bsoO },
                  ].map(r => (
                    <div key={r.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ width:12, fontSize:11, fontWeight:700, color: C.textSec }}>{r.label}</span>
                      <div style={{ display:"flex", gap:4 }}>
                        {Array.from({length:r.max}).map((_,i) => <Dot key={i} filled={i<r.count} color={r.color}/>)}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ flex:1, display:"flex", justifyContent:"center" }}>
                  <Diamond runners={runners} onBaseClick={handleBaseClick}/>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:10, color: C.textTer, marginBottom:2 }}>ピッチャー</div>
                  <div style={{ fontSize:13, fontWeight:700, color: C.textPri }}>#{pitcher.number} {pitcher.name}</div>
                  <div style={{ marginTop:4, display:"inline-block", padding:"2px 10px", background: C.brandLight, borderRadius:20, fontSize:11, fontWeight:600, color: C.brand }}>{pitchCount}球</div>
                </div>
              </div>

              {/* 打者エリア */}
              <div style={{ padding:"12px 20px 0", margin:"12px 16px 0", background: C.card, borderRadius:20, boxShadow: C.cardShadow }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:11, fontWeight:700, color: C.brand, background: C.brandLight, padding:"2px 10px", borderRadius:20 }}>{batter.order}番</span>
                  <span style={{ fontSize:10, color: C.textTer }}>{batter.pos}　#{batter.number}</span>
                </div>
                <div style={{ fontSize:22, fontWeight:800, color: C.textPri, lineHeight:1, marginBottom:10 }}>{batter.name}</div>

                {/* 投球履歴 */}
                <div style={{ position:"relative", paddingBottom:10, display:"flex", gap:5, flexWrap:"wrap", minHeight:30, alignItems:"center", borderTop:`1px solid ${C.divider}`, paddingTop:8 }}>
                  {currentPitches.length === 0
                    ? <span style={{ fontSize:11, color: C.textTer }}>投球なし</span>
                    : currentPitches.map((p,i) => <PitchChip key={i} type={p}/>)
                  }
                  {toast && (
                    <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background: C.brand, color: C.brandText, fontSize:13, fontWeight:600, pointerEvents:"none", borderRadius:12 }}>{toast}</div>
                  )}
                </div>
              </div>

              {/* 投球ボタン */}
              <div style={{ padding:"16px 20px 16px", margin:"12px 16px 0", background: C.card, borderRadius:20, boxShadow: C.cardShadow }}>
                <div style={{ fontSize:9, fontWeight:700, color: C.textTer, letterSpacing:"0.1em", marginBottom:16 }}>投　球</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12 }}>
                  {[
                    { l:"-",  s:"ボール",   type:"B" },
                    { l:"○", s:"見逃しS",  type:"見逃" },
                    { l:"●", s:"空振りS",  type:"空振" },
                    { l:"v",  s:"ファウル", type:"F" },
                  ].map(b => (
                    <div key={b.l} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                      <div
                        onClick={() => handlePitch(b.type)}
                        style={{ width:"100%", aspectRatio:"1", borderRadius:"50%", background:"#F5F7F5", border:"none", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:800, color: C.textPri, cursor:"pointer", userSelect:"none", boxShadow:"0 2px 8px rgba(0,0,0,0.08)", transition:"transform 0.08s, background 0.1s" }}
                        onPointerDown={e => { e.currentTarget.style.transform="scale(0.93)"; e.currentTarget.style.background=C.brandLight; }}
                        onPointerUp={e => { e.currentTarget.style.transform=""; e.currentTarget.style.background="#F5F7F5"; }}
                        onPointerLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.background="#F5F7F5"; }}
                      >{b.l}</div>
                      <div style={{ fontSize:10, color: C.textSec, fontWeight:600, whiteSpace:"nowrap" }}>{b.s}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 打席結果 */}
              <div style={{ padding:"12px 16px 8px" }}>
                <div style={{ fontSize:9, fontWeight:700, color: C.textTer, letterSpacing:"0.1em", marginBottom:10 }}>打席結果</div>
                <div
                  onClick={() => handlePitch("IP")}
                  style={{ padding:"16px 24px", borderRadius:50, background: C.brand, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", userSelect:"none", boxShadow:"0 4px 16px rgba(61,107,61,0.35)", transition:"transform 0.08s, box-shadow 0.08s" }}
                  onPointerDown={e => { e.currentTarget.style.transform="scale(0.97)"; e.currentTarget.style.boxShadow="none"; }}
                  onPointerUp={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 4px 16px rgba(61,107,61,0.35)"; }}
                  onPointerLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 4px 16px rgba(61,107,61,0.35)"; }}
                >
                  <span style={{ fontSize:15, fontWeight:800, color: C.brandText }}>打席結果を入力</span>
                </div>
              </div>

              {/* サブ操作 */}
              <div style={{ padding:"8px 16px 16px", display:"flex", justifyContent:"center", gap:24 }}>
                <span style={{ fontSize:11, color: C.textTer, cursor:"pointer" }}>選手交代</span>
                <span
                  onClick={stateHistory.length > 0 ? handleUndo : undefined}
                  style={{
                    fontSize:11, cursor: stateHistory.length > 0 ? "pointer" : "default",
                    color: stateHistory.length > 0 ? C.textSec : C.textTer,
                    borderBottom: stateHistory.length > 0 ? `1px dashed ${C.textTer}` : "none",
                  }}
                >1球取消</span>
                <span style={{ fontSize:11, color: C.textTer, cursor:"pointer" }}>特殊処理</span>
              </div>

              {/* スコアボード */}
              <div style={{ overflowX: "auto", borderTop: `1px solid ${C.divider}` }}>
                <div style={{ minWidth: 9 * 28 + 88 + 28, padding: "0 14px" }}>
                  <div style={{ display: "flex", borderBottom: `1px solid ${C.divider}` }}>
                    <div style={{ width: 60, fontSize: 10, color: C.textTer, padding: "5px 0", flexShrink: 0 }}>チーム</div>
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} style={{ width: 28, textAlign: "center", fontSize: 10, color: i + 1 === inning ? C.brand : C.textTer, fontWeight: i + 1 === inning ? 700 : 400, padding: "5px 0", flexShrink: 0 }}>{i + 1}</div>
                    ))}
                    <div style={{ width: 28, textAlign: "center", fontSize: 10, fontWeight: 700, color: C.textPri, padding: "5px 0", flexShrink: 0 }}>計</div>
                  </div>
                  {[
                    { name: TEAM_A, isTop: true,  score: scoreA },
                    { name: TEAM_B, isTop: false, score: scoreB },
                  ].map(team => {
                    const inningScores = {};
                    gameLog.forEach(half => {
                      if ((half.topBottom === "表") !== team.isTop) return;
                      const runs = half.atBats.reduce((s, ab) => s + (ab.runsScored || 0), 0);
                      inningScores[half.inning] = (inningScores[half.inning] || 0) + runs;
                    });
                    return (
                      <div key={team.name} style={{ display: "flex", borderBottom: `1px solid ${C.divider}` }}>
                        <div style={{ width: 60, fontSize: 11, fontWeight: 600, color: C.textPri, padding: "6px 0", flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{team.name}</div>
                        {Array.from({ length: 9 }).map((_, i) => {
                          const isPast = i + 1 < inning || (i + 1 === inning && !isTop && !team.isTop);
                          const isCurrent = i + 1 === inning;
                          const val = inningScores[i+1];
                          return (
                            <div key={i} style={{
                              width: 28, textAlign: "center", fontSize: 12, padding: "6px 0", flexShrink: 0,
                              color: val > 0 ? C.brand : isCurrent ? C.textPri : C.textTer,
                              fontWeight: val > 0 ? 700 : 400,
                            }}>
                              {val !== undefined ? val : (isPast || isCurrent ? 0 : "-")}
                            </div>
                          );
                        })}
                        <div style={{ width: 28, textAlign: "center", fontSize: 13, fontWeight: 800, color: C.textPri, padding: "6px 0", flexShrink: 0 }}>{team.score}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>}

            {/* インプレー結果 */}
            {screen === "inplay" && <InplayScreen batter={batter} onResult={handleInplayResult} onBack={goBack}/>}

            {/* 凡退時：進塁した？ */}
            {screen === "askAdvance" && <>
              <div style={{ padding:"16px 14px", borderBottom:`1px solid ${C.divider}` }}>
                <div style={{ fontSize:13, fontWeight:600, color:C.textPri, marginBottom:4 }}>{pendingResult?.label}</div>
                <div style={{ fontSize:14, color:C.textSec }}>ランナーは進塁しましたか？</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, padding:"14px" }}>
                <Btn label="はい"   bg={C.brandLight} border={C.brand} color={C.brand} onClick={() => handleAskAdvance(true)}/>
                <Btn label="いいえ" bg="#F1EFE8" border="#9B9A94" color="#3A3A38" onClick={() => handleAskAdvance(false)}/>
              </div>
            </>}

            {/* ランナー進塁確認 */}
            {screen === "runnerAdvance" && currentRunner && <>
              <div style={{ padding:"12px 14px", borderBottom:`1px solid ${C.divider}` }}>
                <div style={{ fontSize:11, color:C.textTer, marginBottom:4 }}>{currentRunnerIdx+1} / {runnerQueue.length}人目</div>
                <div style={{ fontSize:14, fontWeight:600, color:C.textPri }}>
                  {currentRunner.label}ランナー #{currentRunner.player.number} {currentRunner.player.name}
                </div>
                <div style={{ fontSize:13, color:C.textSec, marginTop:4 }}>どこまで進みましたか？</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:7, padding:"12px 14px" }}>
                {advanceOptions(currentRunner.baseNum).map(opt => (
                  <Btn key={opt.value} label={opt.label}
                    bg={opt.value==="out"?"#F5EAEA":opt.value===4?C.brandLight:C.bg}
                    border={opt.value==="out"?"#8B2020":opt.value===4?C.brand:C.divider}
                    color={opt.value==="out"?"#8B2020":opt.value===4?C.brand:C.textPri}
                    onClick={() => handleRunnerAdvance(opt.value)}
                  />
                ))}
              </div>
            </>}

            {/* バンク図タップ：走塁アクション */}
            {screen === "baseAction" && <>
              <div style={{ padding:"12px 14px", borderBottom:`1px solid ${C.divider}` }}>
                <div style={{ fontSize:11, color:C.textTer, marginBottom:4 }}>
                  {selectedBase==="first"?"1塁":selectedBase==="second"?"2塁":"3塁"}ランナー
                </div>
                <div style={{ fontSize:14, fontWeight:600, color:C.textPri }}>アクションを選択</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:7, padding:"12px 14px" }}>
                <Btn label="盗塁成功"   bg={C.brandLight} border={C.brand} color={C.brand}
                  disabled={!!(nextBase(selectedBase) && runners[nextBase(selectedBase)])}
                  onClick={() => handleBaseAction("盗塁成功")}/>
                <Btn label="盗塁死"    bg="#F5EAEA" border="#8B2020" color="#8B2020" onClick={() => handleBaseAction("盗塁死")}/>
                <Btn label="牽制セーフ" bg="#F1EFE8" border="#9B9A94" color="#3A3A38" onClick={() => handleBaseAction("牽制セーフ")}/>
                <Btn label="牽制アウト" bg="#F5EAEA" border="#8B2020" color="#8B2020" onClick={() => handleBaseAction("牽制アウト")}/>
              </div>
            </>}

          </>}

          {/* ── ボトムタブバー ── */}
          <div style={{ borderTop:`1px solid ${C.divider}`, display:"flex", background: C.card, boxShadow:"0 -4px 20px rgba(0,0,0,0.05)", padding:"8px 0 12px" }}>
            {[
              { id:"record",   label:"記録", Icon: PenLine },
              { id:"history",  label:"経過", Icon: ScrollText },
              { id:"stats",    label:"成績", Icon: BarChart2 },
              { id:"settings", label:"設定", Icon: Settings },
            ].map(tab => (
              <div key={tab.id} onClick={() => setActiveView(tab.id)} style={{
                flex:1, display:"flex", flexDirection:"column",
                alignItems:"center", gap:3, cursor:"pointer", userSelect:"none",
              }}>
                <div style={{ padding:"4px 14px", borderRadius:50, background: activeView===tab.id ? C.brandLight : "transparent", transition:"background 0.15s" }}>
                  <tab.Icon size={20} color={activeView===tab.id ? C.brand : C.textTer} strokeWidth={activeView===tab.id ? 2.5 : 1.8}/>
                </div>
                <span style={{ fontSize:10, fontWeight: activeView===tab.id ? 700 : 400, color: activeView===tab.id ? C.brand : C.textTer }}>{tab.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────
// ホーム画面（試合タブ）
// ─────────────────────────────
const RECENT_GAMES = [
  { id: 1, date: "6月8日",  opponent: "巨人", scoreA: 5, scoreB: 3, result: "勝" },
  { id: 2, date: "6月5日",  opponent: "中日", scoreA: 2, scoreB: 4, result: "負" },
  { id: 3, date: "6月1日",  opponent: "広島", scoreA: 7, scoreB: 2, result: "勝" },
];
const TEAM_STATS = { games: 12, wins: 8, losses: 4, winRate: ".667" };

function GamesTab({ onStartRecord, onStartOrder }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ background: C.scoreBg, padding: "20px 20px 24px" }}>
        <div style={{ fontSize: 9, color: C.scoreSubText, letterSpacing: "0.15em", marginBottom: 8, opacity: 0.8 }}>NEO SCORE BOOK</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.scoreText, marginBottom: 2 }}>阪神タイガース</div>
        <div style={{ fontSize: 12, color: C.scoreSubText }}>{TEAM_STATS.games}試合　{TEAM_STATS.wins}勝 {TEAM_STATS.losses}敗　勝率 {TEAM_STATS.winRate}</div>
      </div>

      <div style={{ padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* 試合を記録する */}
        <div onClick={onStartOrder} style={{ background: C.brand, borderRadius: 20, padding: "20px", boxShadow: "0 4px 20px rgba(61,107,61,0.35)", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
          onPointerDown={e => e.currentTarget.style.opacity = "0.85"}
          onPointerUp={e => e.currentTarget.style.opacity = "1"}
          onPointerLeave={e => e.currentTarget.style.opacity = "1"}
        >
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <PenLine size={22} color={C.brandText}/>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.brandText }}>試合を記録する</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>オーダー登録 → 記録開始</div>
          </div>
          <ChevronRight size={20} color="rgba(255,255,255,0.6)" style={{ marginLeft: "auto" }}/>
        </div>

        {/* 直近の試合 */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textSec, display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={13} color={C.textSec}/>直近の試合
            </div>
          </div>
          <div style={{ background: C.card, borderRadius: 16, overflow: "hidden", boxShadow: C.cardShadow }}>
            {RECENT_GAMES.map((g, i) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: i < RECENT_GAMES.length - 1 ? `1px solid ${C.divider}` : "none", cursor: "pointer" }}
                onPointerDown={e => e.currentTarget.style.background = C.brandLight}
                onPointerUp={e => e.currentTarget.style.background = "transparent"}
                onPointerLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ width: 40, fontSize: 11, color: C.textTer, flexShrink: 0 }}>{g.date}</div>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.textPri }}>vs {g.opponent}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.textPri, marginRight: 8 }}>{g.scoreA} - {g.scoreB}</div>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: g.result === "勝" ? C.brandLight : "#FEF0F0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: g.result === "勝" ? C.brand : "#8B2020" }}>{g.result}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* チーム成績 */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textSec, display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <TrendingUp size={13} color={C.textSec}/>チーム成績
          </div>
          <div style={{ background: C.card, borderRadius: 16, padding: "16px", boxShadow: C.cardShadow, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            {[{ label: "試合", value: TEAM_STATS.games }, { label: "勝利", value: TEAM_STATS.wins }, { label: "敗北", value: TEAM_STATS.losses }, { label: "勝率", value: TEAM_STATS.winRate }].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.textPri }}>{s.value}</div>
                <div style={{ fontSize: 10, color: C.textTer, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────
// 成績・設定プレースホルダー
// ─────────────────────────────
function PlaceholderTab({ label }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 32 }}>🚧</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.textSec }}>{label}</div>
      <div style={{ fontSize: 12, color: C.textTer }}>準備中です</div>
    </div>
  );
}

// ─────────────────────────────
// メインアプリ
// ─────────────────────────────
export default function NeoScoreBookApp() {
  const [activeTab, setActiveTab] = useState("games");
  const [screen, setScreen] = useState("home"); // home | order | record

  const tabs = [
    { id: "games",   label: "試合",  Icon: Calendar },
    { id: "players", label: "選手",  Icon: Users },
    { id: "stats",   label: "成績",  Icon: BarChart2 },
    { id: "settings",label: "設定",  Icon: Settings },
  ];

  const renderContent = () => {
    // 試合タブの画面遷移
    if (activeTab === "games") {
      if (screen === "order") return <OrderRegistration onBack={() => setScreen("home")} onNext={() => setScreen("record")}/>;
      if (screen === "record") return <GameRecordScreen onBack={() => setScreen("home")}/>;
      return <GamesTab onStartOrder={() => setScreen("order")} onStartRecord={() => setScreen("record")}/>;
    }
    if (activeTab === "players") return <PlayerManagement/>;
    if (activeTab === "stats")   return <PlaceholderTab label="成績"/>;
    if (activeTab === "settings") return <PlaceholderTab label="設定"/>;
  };

  const handleTabChange = (id) => {
    setActiveTab(id);
    if (id === "games") setScreen("home");
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", maxWidth: 320, margin: "0 auto", fontFamily: "'Noto Sans JP', sans-serif", display: "flex", flexDirection: "column" }}>

      {/* メインコンテンツ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingBottom: 64 }}>
        {renderContent()}
      </div>

      {/* ボトムタブバー */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 320, borderTop: `1px solid ${C.divider}`, display: "flex", background: C.card, boxShadow: "0 -4px 20px rgba(0,0,0,0.05)", padding: "8px 0 12px", zIndex: 100 }}>
        {tabs.map(tab => (
          <div key={tab.id} onClick={() => handleTabChange(tab.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer" }}>
            <div style={{ padding: "4px 14px", borderRadius: 50, background: activeTab === tab.id ? C.brandLight : "transparent", transition: "background 0.15s" }}>
              <tab.Icon size={20} color={activeTab === tab.id ? C.brand : C.textTer} strokeWidth={activeTab === tab.id ? 2.5 : 1.8}/>
            </div>
            <span style={{ fontSize: 10, fontWeight: activeTab === tab.id ? 700 : 400, color: activeTab === tab.id ? C.brand : C.textTer }}>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
