/**
 * test-logic.js  — scorebook-logic.js のユニットテスト
 * 実行: node test-logic.js
 */
const assert = require('assert');
const {
  isOutResult, isStrikeout, isDoublePlay, isTriplePlay,
  atBatRunnerOuts, countAtBatOuts,
  replayBSO, calcStatsFromLog, calcScoreFromLog,
} = require('./scorebook-logic.js');

let passed = 0, failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${label}`);
    console.error(`     → ${e.message}`);
    failed++;
  }
}

// ── テスト用ヘルパー ──────────────────────────
// runnerOuts は opts で明示指定したときだけ付与する
// （未指定 = 旧形式ログを模擬し、結果文字列からのフォールバック推定を検証できる）
const mkAb = (num, name, result, opts = {}) => ({
  number: num, name, order: num, pos: "-",
  pitcherNumber: opts.pitcher ?? 18,
  result,
  runsScored:    opts.runs    ?? 0,
  runsScoredBy:  opts.scorers ?? [],
  events:        opts.events  ?? [],
  pitches:       opts.pitches ?? [],
  runnersAtStart: opts.runners ?? {},
  ...(opts.runnerOuts != null ? { runnerOuts: opts.runnerOuts } : {}),
});

const mkHalf = (topBottom, inning, atBats) => ({ topBottom, inning, atBats });

// ── isOutResult ───────────────────────────────
console.log('\n【isOutResult】');
test('ゴロアウト → true',          () => assert.ok(isOutResult("ゴロアウト")));
test('遊ゴロ → true',              () => assert.ok(isOutResult("遊ゴロ")));
test('センターフライ → true',      () => assert.ok(isOutResult("センターフライ")));
test('ライナー → true',            () => assert.ok(isOutResult("一直ライナー")));
test('三振 → true',                () => assert.ok(isOutResult("三振")));
test('犠飛 → true',                () => assert.ok(isOutResult("犠飛")));
test('バント（犠打）→ true',       () => assert.ok(isOutResult("バント")));
test('ゲッツー → true',            () => assert.ok(isOutResult("ゲッツー")));
test('ヒット → false',             () => assert.ok(!isOutResult("ヒット")));
test('二塁打 → false',             () => assert.ok(!isOutResult("二塁打")));
test('三塁打 → false',             () => assert.ok(!isOutResult("三塁打")));
test('本塁打 → false',             () => assert.ok(!isOutResult("本塁打")));
test('フォアボール → false',       () => assert.ok(!isOutResult("フォアボール")));
test('デッドボール → false',       () => assert.ok(!isOutResult("デッドボール")));
test('エラー → false',             () => assert.ok(!isOutResult("エラー")));
test('振り逃げ → false',           () => assert.ok(!isOutResult("振り逃げ")));
test('バント安打 → false (BUG-3)', () => assert.ok(!isOutResult("バント安打")));

// 実アプリが生成するラベル（方向プレフィックス付き）
console.log('\n【isOutResult - 実アプリのラベル】');
test('遊併殺打 → true',            () => assert.ok(isOutResult("遊併殺打")));
test('左フライ → true',            () => assert.ok(isOutResult("左フライ")));
test('中犠飛 → true',              () => assert.ok(isOutResult("中犠飛")));
test('投送りバント → true',        () => assert.ok(isOutResult("投送りバント")));
test('三振（K） → true',           () => assert.ok(isOutResult("三振（K）")));
test('三振（KS） → true',          () => assert.ok(isOutResult("三振（KS）")));
test('左ヒット → false',           () => assert.ok(!isOutResult("左ヒット")));
test('右二塁打 → false',           () => assert.ok(!isOutResult("右二塁打")));
test('三セーフティバント → false', () => assert.ok(!isOutResult("三セーフティバント")));
test('遊エラー → false',           () => assert.ok(!isOutResult("遊エラー")));
test('二FC（野選） → false',       () => assert.ok(!isOutResult("二FC（野選）")));

// ── isDoublePlay / isTriplePlay ──────────────
console.log('\n【isDoublePlay / isTriplePlay】');
test('遊併殺打 → DP true（新ラベル）',   () => assert.ok(isDoublePlay("遊併殺打")));
test('ゲッツー → DP true（旧ラベル）',   () => assert.ok(isDoublePlay("ゲッツー")));
test('ヒット → DP false',                () => assert.ok(!isDoublePlay("ヒット")));
test('null → DP false',                  () => assert.ok(!isDoublePlay(null)));
test('トリプルプレー → TP true',         () => assert.ok(isTriplePlay("トリプルプレー")));
test('遊併殺打 → TP false',              () => assert.ok(!isTriplePlay("遊併殺打")));

// ── countAtBatOuts / atBatRunnerOuts ─────────
console.log('\n【countAtBatOuts】');
test('遊ゴロ（runnerOuts:0）→ 1', () =>
  assert.strictEqual(countAtBatOuts(mkAb(1,"A","遊ゴロ",{runnerOuts:0})), 1));
test('遊併殺打（runnerOuts:1）→ 2（新形式）', () =>
  assert.strictEqual(countAtBatOuts(mkAb(1,"A","遊併殺打",{runnerOuts:1})), 2));
test('ゲッツー（runnerOutsなし）→ 2（旧形式フォールバック）', () =>
  assert.strictEqual(countAtBatOuts(mkAb(1,"A","ゲッツー")), 2));
test('トリプルプレー（runnerOutsなし）→ 3（旧形式フォールバック）', () =>
  assert.strictEqual(countAtBatOuts(mkAb(1,"A","トリプルプレー")), 3));
test('併殺崩れ：遊併殺打でも走者アウトなし（runnerOuts:0）→ 1', () =>
  assert.strictEqual(countAtBatOuts(mkAb(1,"A","遊併殺打",{runnerOuts:0})), 1));
test('左ヒット + 走塁死（runnerOuts:1）→ 1', () =>
  assert.strictEqual(countAtBatOuts(mkAb(1,"A","左ヒット",{runnerOuts:1})), 1));
test('振り逃げ → 0', () =>
  assert.strictEqual(countAtBatOuts(mkAb(1,"A","振り逃げ",{runnerOuts:0})), 0));
test('結果なし（打席途中）→ 0', () =>
  assert.strictEqual(countAtBatOuts(mkAb(1,"A",null,{runnerOuts:0})), 0));

// ── isStrikeout ──────────────────────────────
console.log('\n【isStrikeout】');
test('三振 → true',      () => assert.ok(isStrikeout("三振")));
test('振り逃げ → true',  () => assert.ok(isStrikeout("振り逃げ")));
test('ゴロ → false',     () => assert.ok(!isStrikeout("ゴロアウト")));
test('ヒット → false',   () => assert.ok(!isStrikeout("ヒット")));

// ── replayBSO ────────────────────────────────
console.log('\n【replayBSO】');
test('ボール4球 → {balls:4, strikes:0}', () => {
  const r = replayBSO(["B","B","B","B"]);
  assert.strictEqual(r.balls, 4); assert.strictEqual(r.strikes, 0);
});
test('空振り3球 → strikes は2で止まる', () => {
  const r = replayBSO(["S","S","S"]);
  assert.strictEqual(r.strikes, 2);
});
test('ファウルは2ストライク以降増えない', () => {
  const r = replayBSO(["S","S","F","F","F"]);
  assert.strictEqual(r.strikes, 2); assert.strictEqual(r.balls, 0);
});
test('B,S,B,F,B → {balls:3, strikes:2}', () => {
  const r = replayBSO(["B","S","B","F","B"]);
  assert.strictEqual(r.balls, 3); assert.strictEqual(r.strikes, 2);
});
test('見逃しストライク → strikes+1', () => {
  const r = replayBSO(["見逃","見逃"]);
  assert.strictEqual(r.strikes, 2);
});

// ── calcStatsFromLog: 打者成績 ───────────────
console.log('\n【calcStatsFromLog - 打者成績】');

test('ヒット → hits=1, pa=1, atBats=1', () => {
  const log = [mkHalf("表",1,[mkAb(1,"山田","ヒット")])];
  const { batting } = calcStatsFromLog(log, true);
  const p = batting.find(p => p.number === 1);
  assert.strictEqual(p.hits, 1); assert.strictEqual(p.pa, 1); assert.strictEqual(p.atBats, 1);
});

test('フォアボール → pa=1, atBats=0, bb=1', () => {
  const log = [mkHalf("表",1,[mkAb(1,"山田","フォアボール")])];
  const { batting } = calcStatsFromLog(log, true);
  const p = batting.find(p => p.number === 1);
  assert.strictEqual(p.pa, 1); assert.strictEqual(p.atBats, 0); assert.strictEqual(p.bb, 1);
});

test('故意四球 → ibb=1, bb=0', () => {
  const log = [mkHalf("表",1,[mkAb(1,"山田","故意四球")])];
  const { batting } = calcStatsFromLog(log, true);
  const p = batting.find(p => p.number === 1);
  assert.strictEqual(p.ibb, 1); assert.strictEqual(p.bb, 0);
});

test('デッドボール → hbp=1, atBats=0', () => {
  const log = [mkHalf("表",1,[mkAb(1,"山田","デッドボール")])];
  const { batting } = calcStatsFromLog(log, true);
  const p = batting.find(p => p.number === 1);
  assert.strictEqual(p.hbp, 1); assert.strictEqual(p.atBats, 0);
});

test('三振 → so=1, atBats=1', () => {
  const log = [mkHalf("表",1,[mkAb(1,"山田","三振")])];
  const { batting } = calcStatsFromLog(log, true);
  const p = batting.find(p => p.number === 1);
  assert.strictEqual(p.so, 1); assert.strictEqual(p.atBats, 1);
});

test('犠打 → sac=1, atBats=0', () => {
  const log = [mkHalf("表",1,[mkAb(1,"山田","犠打")])];
  const { batting } = calcStatsFromLog(log, true);
  const p = batting.find(p => p.number === 1);
  assert.strictEqual(p.sac, 1); assert.strictEqual(p.atBats, 0);
});

test('本塁打 → hr=1, tb=4', () => {
  const log = [mkHalf("表",1,[mkAb(1,"山田","本塁打",{runs:1})])];
  const { batting } = calcStatsFromLog(log, true);
  const p = batting.find(p => p.number === 1);
  assert.strictEqual(p.hr, 1); assert.strictEqual(p.tb, 4);
});

test('二塁打 → h2=1, tb=2', () => {
  const log = [mkHalf("表",1,[mkAb(1,"山田","二塁打")])];
  const { batting } = calcStatsFromLog(log, true);
  const p = batting.find(p => p.number === 1);
  assert.strictEqual(p.h2, 1); assert.strictEqual(p.tb, 2);
});

test('三塁打 → h3=1, tb=3', () => {
  const log = [mkHalf("表",1,[mkAb(1,"山田","三塁打")])];
  const { batting } = calcStatsFromLog(log, true);
  const p = batting.find(p => p.number === 1);
  assert.strictEqual(p.h3, 1); assert.strictEqual(p.tb, 3);
});

test('複数イニングの集計', () => {
  const log = [
    mkHalf("表",1,[mkAb(1,"山田","ヒット"), mkAb(2,"鈴木","三振")]),
    mkHalf("裏",1,[mkAb(9,"相手","ゴロアウト",{pitcher:1})]),
    mkHalf("表",2,[mkAb(1,"山田","二塁打"), mkAb(2,"鈴木","フォアボール")]),
  ];
  const { batting } = calcStatsFromLog(log, true);
  const p1 = batting.find(p => p.number === 1);
  assert.strictEqual(p1.pa, 2); assert.strictEqual(p1.hits, 2);
  assert.strictEqual(p1.tb, 3);  // ヒット(1) + 二塁打(2)
  const p2 = batting.find(p => p.number === 2);
  assert.strictEqual(p2.so, 1); assert.strictEqual(p2.bb, 1); assert.strictEqual(p2.atBats, 1);
});

test('裏の打席は isTop=true では集計されない', () => {
  const log = [
    mkHalf("表",1,[mkAb(1,"山田","ヒット")]),
    mkHalf("裏",1,[mkAb(9,"相手","三塁打",{pitcher:18})]),
  ];
  const { batting } = calcStatsFromLog(log, true);
  assert.ok(!batting.find(p => p.number === 9), "相手打者が表の成績に混入しない");
});

// ── 打点計算 ────────────────────────────────
console.log('\n【打点計算】');

test('タイムリー2点 → rbi=2', () => {
  const runners = { second: {name:"B",number:7}, third: {name:"C",number:8} };
  const log = [mkHalf("表",1,[mkAb(1,"山田","ヒット",{runs:2, runners})])];
  const { batting } = calcStatsFromLog(log, true);
  assert.strictEqual(batting.find(p=>p.number===1).rbi, 2);
});

test('ゲッツーは打点0（得点があっても・旧ラベル）', () => {
  const runners = { third: {name:"C",number:8} };
  const log = [mkHalf("表",1,[mkAb(1,"山田","ゲッツー",{runs:1, runners})])];
  const { batting } = calcStatsFromLog(log, true);
  assert.strictEqual(batting.find(p=>p.number===1).rbi, 0);
});

test('遊併殺打は打点0（得点があっても・実アプリのラベル）', () => {
  const runners = { first:{name:"A",number:5}, third:{name:"C",number:8} };
  const log = [mkHalf("表",1,[mkAb(1,"山田","遊併殺打",{runs:1, runners, runnerOuts:1})])];
  const { batting } = calcStatsFromLog(log, true);
  assert.strictEqual(batting.find(p=>p.number===1).rbi, 0);
});

test('左犠飛 → 打点1・打数0', () => {
  const runners = { third:{name:"C",number:8} };
  const log = [mkHalf("表",1,[mkAb(1,"山田","左犠飛",{runs:1, runners, runnerOuts:0})])];
  const { batting } = calcStatsFromLog(log, true);
  const p = batting.find(p=>p.number===1);
  assert.strictEqual(p.rbi, 1);
  assert.strictEqual(p.atBats, 0);
  assert.strictEqual(p.sf, 1);
});

test('満塁四球 → rbi=1', () => {
  const runners = { first:{name:"A",number:5}, second:{name:"B",number:6}, third:{name:"C",number:7} };
  const log = [mkHalf("表",1,[mkAb(1,"山田","フォアボール",{runs:1, runners})])];
  const { batting } = calcStatsFromLog(log, true);
  assert.strictEqual(batting.find(p=>p.number===1).rbi, 1);
});

test('非満塁四球は打点0', () => {
  const runners = { second:{name:"B",number:6} };
  const log = [mkHalf("表",1,[mkAb(1,"山田","フォアボール",{runs:0, runners})])];
  const { batting } = calcStatsFromLog(log, true);
  assert.strictEqual(batting.find(p=>p.number===1).rbi, 0);
});

// ── 盗塁帰属 ────────────────────────────────
console.log('\n【盗塁帰属】');

test('盗塁成功はランナー本人に帰属', () => {
  const events = ["ランナー #7 盗塁成功"];
  const log = [mkHalf("表",1,[mkAb(1,"山田","フォアボール",{events})])];
  const { batting } = calcStatsFromLog(log, true);
  const runner = batting.find(p => p.number === 7);
  assert.ok(runner, "ランナー#7が成績に登場");
  assert.strictEqual(runner.sb, 1);
  assert.strictEqual(batting.find(p=>p.number===1).sb, 0);
});

test('盗塁スタブに後から打席が来ても名前・打順が正しく更新される', () => {
  // #7 が先に盗塁スタブ（order=99, name="#7"）として作られ、後の打席で更新される
  const events = ["ランナー #7 盗塁成功"];
  const log = [
    mkHalf("表",1,[mkAb(1,"山田","ヒット",{events})]),   // 盗塁スタブ作成
    mkHalf("表",2,[mkAb(7,"田中","三振")]),               // 本人が打席
  ];
  const { batting } = calcStatsFromLog(log, true);
  const p7 = batting.find(p => p.number === 7);
  assert.strictEqual(p7.name, "田中");
  assert.strictEqual(p7.order, 7);
  assert.strictEqual(p7.sb, 1);
  assert.strictEqual(p7.so, 1);
});

// ── 投手成績 ────────────────────────────────
console.log('\n【calcStatsFromLog - 投手成績】');

test('3アウト → outs=3', () => {
  const log = [mkHalf("裏",1,[
    mkAb(10,"A","ゴロアウト",{pitcher:18}),
    mkAb(11,"B","フライアウト",{pitcher:18}),
    mkAb(12,"C","三振",{pitcher:18}),
  ])];
  const { pitching } = calcStatsFromLog(log, true);
  assert.strictEqual(pitching.find(p=>p.number===18).outs, 3);
});

test('ゲッツー → outs=2（旧ラベル・runnerOutsなしフォールバック）', () => {
  const log = [mkHalf("裏",1,[mkAb(10,"A","ゲッツー",{pitcher:18})])];
  const { pitching } = calcStatsFromLog(log, true);
  assert.strictEqual(pitching.find(p=>p.number===18).outs, 2);
});

test('遊併殺打（runnerOuts:1）→ outs=2（実アプリの新形式）', () => {
  const log = [mkHalf("裏",1,[mkAb(10,"A","遊併殺打",{pitcher:18, runnerOuts:1})])];
  const { pitching } = calcStatsFromLog(log, true);
  assert.strictEqual(pitching.find(p=>p.number===18).outs, 2);
});

test('トリプルプレー → outs=3', () => {
  const log = [mkHalf("裏",1,[mkAb(10,"A","トリプルプレー",{pitcher:18})])];
  const { pitching } = calcStatsFromLog(log, true);
  assert.strictEqual(pitching.find(p=>p.number===18).outs, 3);
});

test('実ラベル3アウト（遊ゴロ・左フライ・三振（K)) → outs=3', () => {
  const log = [mkHalf("裏",1,[
    mkAb(10,"A","遊ゴロ",{pitcher:18, runnerOuts:0}),
    mkAb(11,"B","左フライ",{pitcher:18, runnerOuts:0}),
    mkAb(12,"C","三振（K）",{pitcher:18, runnerOuts:0}),
  ])];
  const { pitching } = calcStatsFromLog(log, true);
  assert.strictEqual(pitching.find(p=>p.number===18).outs, 3);
});

test('ヒット + 走塁死（runnerOuts:1）→ 投手outs=1', () => {
  const log = [mkHalf("裏",1,[mkAb(10,"A","左ヒット",{pitcher:18, runnerOuts:1})])];
  const { pitching } = calcStatsFromLog(log, true);
  const ps = pitching.find(p=>p.number===18);
  assert.strictEqual(ps.outs, 1);
  assert.strictEqual(ps.pHits, 1);
});

test('三振（KS）は奪三振かつアウト', () => {
  const log = [mkHalf("裏",1,[mkAb(10,"A","三振（KS）",{pitcher:18, runnerOuts:0})])];
  const { pitching } = calcStatsFromLog(log, true);
  const ps = pitching.find(p=>p.number===18);
  assert.strictEqual(ps.strikeouts, 1);
  assert.strictEqual(ps.outs, 1);
});

test('振り逃げは奪三振だがアウトにならない', () => {
  const log = [mkHalf("裏",1,[mkAb(10,"A","振り逃げ",{pitcher:18, runnerOuts:0})])];
  const { pitching } = calcStatsFromLog(log, true);
  const ps = pitching.find(p=>p.number===18);
  assert.strictEqual(ps.strikeouts, 1);
  assert.strictEqual(ps.outs, 0);
});

test('バント安打は投手のアウトにならず被安打に計上', () => {
  // 裏ハーフ: 裏チーム打者#10 vs 表チーム投手#18
  const log = [mkHalf("裏",1,[mkAb(10,"A","バント安打",{pitcher:18})])];
  const { pitching } = calcStatsFromLog(log, true);  // 表チーム投手成績
  const { batting  } = calcStatsFromLog(log, false); // 裏チーム打者成績
  const ps = pitching.find(p=>p.number===18);
  assert.strictEqual(ps.outs,  0, "アウト0");
  assert.strictEqual(ps.pHits, 1, "被安打1");
  const batter = batting.find(p=>p.number===10);
  assert.strictEqual(batter.hits,   1, "打者hits=1");
  assert.strictEqual(batter.atBats, 1, "打者atBats=1");
  assert.strictEqual(batter.sac,    0, "犠打ではない");
});

test('与四球 → walks=1', () => {
  const log = [mkHalf("裏",1,[mkAb(10,"A","フォアボール",{pitcher:18})])];
  const { pitching } = calcStatsFromLog(log, true);
  assert.strictEqual(pitching.find(p=>p.number===18).walks, 1);
});

test('奪三振 → strikeouts=1', () => {
  const log = [mkHalf("裏",1,[mkAb(10,"A","三振",{pitcher:18})])];
  const { pitching } = calcStatsFromLog(log, true);
  assert.strictEqual(pitching.find(p=>p.number===18).strikeouts, 1);
});

test('被安打 → pHits=1', () => {
  const log = [mkHalf("裏",1,[mkAb(10,"A","ヒット",{pitcher:18})])];
  const { pitching } = calcStatsFromLog(log, true);
  assert.strictEqual(pitching.find(p=>p.number===18).pHits, 1);
});

test('失点が投手に加算される', () => {
  const log = [mkHalf("裏",1,[mkAb(10,"A","ヒット",{pitcher:18, runs:2})])];
  const { pitching } = calcStatsFromLog(log, true);
  assert.strictEqual(pitching.find(p=>p.number===18).runs, 2);
});

// ── calcScoreFromLog ─────────────────────────
console.log('\n【calcScoreFromLog】');

test('表3点、裏2点', () => {
  const log = [
    mkHalf("表",1,[mkAb(1,"A","ヒット",{runs:3})]),
    mkHalf("裏",1,[mkAb(9,"X","ヒット",{runs:2, pitcher:1})]),
  ];
  const { scoreA, scoreB } = calcScoreFromLog(log);
  assert.strictEqual(scoreA, 3); assert.strictEqual(scoreB, 2);
});

test('複数イニングのスコアが合算される', () => {
  const log = [
    mkHalf("表",1,[mkAb(1,"A","ヒット",{runs:1})]),
    mkHalf("裏",1,[mkAb(9,"X","三振",{pitcher:1})]),
    mkHalf("表",2,[mkAb(1,"A","本塁打",{runs:1})]),
    mkHalf("裏",2,[mkAb(9,"X","ヒット",{runs:2, pitcher:1})]),
  ];
  const { scoreA, scoreB } = calcScoreFromLog(log);
  assert.strictEqual(scoreA, 2); assert.strictEqual(scoreB, 2);
});

test('得点なし → 0-0', () => {
  const log = [mkHalf("表",1,[mkAb(1,"A","三振"), mkAb(2,"B","ゴロアウト")])];
  const { scoreA, scoreB } = calcScoreFromLog(log);
  assert.strictEqual(scoreA, 0); assert.strictEqual(scoreB, 0);
});

// ── 結果 ─────────────────────────────────────
console.log('\n' + '═'.repeat(55));
console.log(`結果: ✅ ${passed} PASS  /  ❌ ${failed} FAIL`);
console.log('═'.repeat(55));
if (failed > 0) process.exit(1);
