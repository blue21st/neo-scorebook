/**
 * scorebook-logic.js
 * 純粋関数のロジック層。ブラウザ（グローバル変数）と Node.js（module.exports）の両方で動作。
 */

const OUT_KEYWORDS     = ["ゴロ","フライ","ライナー","バント","アウト","三振","犠飛","ゲッツー","トリプルプレー","併殺打"];
const NON_OUT_KEYWORDS = ["ヒット","セーフティバント","安打","振り逃げ"];

const isOutResult  = (r) =>
  OUT_KEYWORDS.some(x => r.includes(x)) && !NON_OUT_KEYWORDS.some(x => r.includes(x));
const isStrikeout  = (r) => r.includes("三振") || r.includes("振り逃げ");

const replayBSO = (pitches) => {
  let b = 0, s = 0;
  for (const p of pitches) {
    if (p === "B") b++;
    else if (p === "S" || p === "●" || p === "見逃" || p === "空振") s = Math.min(s + 1, 2);
    else if (p === "F") s = Math.min(s + 1, 2);
  }
  return { balls: b, strikes: s };
};

/**
 * gameLog から1試合の打者・投手成績を集計する純粋関数。
 * StatsView コンポーネント内の calcStats(isTop) と同一ロジック。
 */
const calcStatsFromLog = (gameLog, isTop) => {
  const stats = {};
  gameLog.forEach(half => {
    if ((half.topBottom === "表") !== isTop) return;
    half.atBats.forEach(ab => {
      if (!stats[ab.number]) {
        stats[ab.number] = {
          playerId: ab.playerId ?? null,
          number: ab.number, name: ab.name, order: ab.order, pos: ab.pos,
          pa: 0, atBats: 0, hits: 0, rbi: 0, hr: 0, sb: 0,
          bb: 0, ibb: 0, hbp: 0, so: 0, sac: 0, sf: 0,
          h1: 0, h2: 0, h3: 0, tb: 0, run: 0,
          risp_ab: 0, risp_hit: 0,
        };
      } else if (stats[ab.number].order === 99 || stats[ab.number].name === `#${ab.number}`) {
        stats[ab.number].name  = ab.name;
        stats[ab.number].order = ab.order;
        stats[ab.number].pos   = ab.pos;
      }
      const s = stats[ab.number];
      const r = ab.result;
      if (!r) return;

      const isHit = ["ヒット","セーフティバント","安打","二塁打","三塁打","本塁打","1塁打","2塁打","3塁打","ホームラン"].some(h => r.includes(h));
      const isH2  = r.includes("二塁打") || r.includes("2塁打");
      const isH3  = r.includes("三塁打") || r.includes("3塁打");
      const isHR  = r.includes("本塁打") || r.includes("ホームラン");
      const isH1  = isHit && !isH2 && !isH3 && !isHR;
      const isSF  = r.includes("犠飛");
      const isSAC = !isHit && (r.includes("犠打") || r.includes("バント")); // バント安打は除外
      const isIBB = r.includes("故意四球");
      const isBB  = r.includes("フォアボール") && !isIBB;
      const isHBP = r.includes("デッドボール");
      const isAB  = !isSF && !isSAC && !isBB && !isIBB && !isHBP;

      s.pa++;
      if (isAB)  s.atBats++;
      if (isHit) s.hits++;
      if (isBB)  s.bb++;
      if (isIBB) s.ibb++;
      if (isHBP) s.hbp++;
      if (isStrikeout(r)) s.so++;
      if (isSF)  s.sf++;
      if (isSAC) s.sac++;
      if (isH1) { s.h1++; s.tb += 1; }
      if (isH2) { s.h2++; s.tb += 2; }
      if (isH3) { s.h3++; s.tb += 3; }
      if (isHR) { s.hr++; s.tb += 4; }

      const rs = ab.runnersAtStart || {};
      if (rs.second || rs.third) {
        s.risp_ab  += isAB  ? 1 : 0;
        s.risp_hit += isHit ? 1 : 0;
      }

      const runs = ab.runsScored || 0;
      if (runs > 0) {
        const isDP = r.includes("ゲッツー");
        if (!isDP) {
          if ((isBB || isIBB || isHBP) && rs.first && rs.second && rs.third) s.rbi += 1;
          else if (!isBB && !isIBB && !isHBP) s.rbi += runs;
        }
      }

      (ab.runsScoredBy || []).forEach(v => {
        let num;
        if (typeof v === 'string') {
          if (v.startsWith('num:')) {
            num = parseInt(v.slice(4));
          } else if (v.startsWith('pid:')) {
            const pid = parseInt(v.slice(4));
            num = Object.keys(stats).find(k => stats[k].playerId == pid);
            if (num != null) num = parseInt(num);
          }
        } else {
          num = v; // 旧形式（生の背番号整数）
        }
        if (num != null && stats[num]) stats[num].run++;
      });

      ab.events?.forEach(ev => {
        const m = ev.match(/ランナー .+?\(#(\d+)\) 盗塁成功/) || ev.match(/ランナー #(\d+) 盗塁成功/);
        if (!m) return;
        const rn = parseInt(m[1]);
        if (!stats[rn]) {
          stats[rn] = { number: rn, name: `#${rn}`, order: 99, pos: "-",
            pa: 0, atBats: 0, hits: 0, rbi: 0, hr: 0, sb: 0,
            bb: 0, ibb: 0, hbp: 0, so: 0, sac: 0, sf: 0,
            h1: 0, h2: 0, h3: 0, tb: 0, run: 0, risp_ab: 0, risp_hit: 0 };
        }
        stats[rn].sb++;
      });
    });
  });

  const teamRegistry = {};
  Object.values(stats).forEach(p => { teamRegistry[p.number] = p; });

  const pitcherStats = {};
  gameLog.forEach(half => {
    if ((half.topBottom === "表") === isTop) return;
    half.atBats.forEach(ab => {
      const r = ab.result;
      if (!r || !ab.pitcherNumber) return;
      if (!pitcherStats[ab.pitcherNumber]) {
        const info = teamRegistry[ab.pitcherNumber]
          || { number: ab.pitcherNumber, name: `#${ab.pitcherNumber}`, order: 99, pos: "投" };
        pitcherStats[ab.pitcherNumber] = { ...info, pitches: 0, outs: 0, pHits: 0, strikeouts: 0, walks: 0, pHbp: 0, runs: 0 };
      }
      const ps = pitcherStats[ab.pitcherNumber];
      ps.pitches += ab.pitches?.length || 0;
      if (isOutResult(r)) {
        const extra = r.includes("トリプルプレー") ? 2 : r.includes("ゲッツー") ? 1 : 0;
        ps.outs += 1 + extra;
      }
      if (["ヒット","セーフティバント","安打","二塁打","三塁打","本塁打","1塁打","2塁打","3塁打","ホームラン"].some(h => r.includes(h))) ps.pHits++;
      if (isStrikeout(r)) ps.strikeouts++;
      if (r.includes("フォアボール")) ps.walks++;
      if (r.includes("デッドボール")) ps.pHbp++;
      ps.runs += ab.runsScored || 0;
    });
  });

  return {
    batting:  Object.values(stats).sort((a, b) => a.order - b.order),
    pitching: Object.values(pitcherStats),
  };
};

/** gameLog から表・裏の合計スコアを計算 */
const calcScoreFromLog = (gameLog) => ({
  scoreA: gameLog.filter(h => h.topBottom === "表").flatMap(h => h.atBats).reduce((s, ab) => s + (ab.runsScored || 0), 0),
  scoreB: gameLog.filter(h => h.topBottom === "裏").flatMap(h => h.atBats).reduce((s, ab) => s + (ab.runsScored || 0), 0),
});

// CommonJS export（Node.js テスト用）
if (typeof module !== "undefined" && module.exports) {
  module.exports = { OUT_KEYWORDS, NON_OUT_KEYWORDS, isOutResult, isStrikeout, replayBSO, calcStatsFromLog, calcScoreFromLog };
}
