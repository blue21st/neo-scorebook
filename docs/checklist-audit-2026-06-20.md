# neo-scorebook.html 監査レポート
## 100項目チェックリスト照合

**実施日**: 2026-06-20  
**ファイル**: neo-scorebook.html（2868行）  
**監査状況**: 完全監査完了

---

## 🔴 確定バグ（修正必須）

### BUG-1: `handleWildStrike` が振り逃げ不成立条件を無視する

**場所**: L1956–1971  
**重大度**: 🔴 高（野球ルール違反）

```js
const handleWildStrike = () => {
    // 1塁にランナーがいて0-1アウトでも振り逃げとして処理される
    const queue = buildRunnerQueue(runners, runnerNames);
    setPendingIsOut(false); // ← 常にアウトなし
```

**振り逃げ成立条件（公認野球規則 5.05(b)(2)）**：  
「1塁が空か、2アウトの時にのみ振り逃げ成立」

コードには `runners.first && outs < 2` のガードがない。  
0〜1アウトで1塁にランナーがいる場合でも振り逃げとして処理される。

**修正**:
```js
const handleWildStrike = () => {
  // 振り逃げ不成立: 1塁にランナーがいて2アウト未満
  if (runners.first && outs < 2) {
    closeCurrentAtBat("三振（KS）", runners);
    showToast("三振（KS）");
    doOut(runners);
    return;
  }
  // 以下は既存の振り逃げロジック...
```

---

### BUG-2: ゲッツーが投手のアウト数を1しか増やさない

**場所**: `calcStats` L471–473  
**重大度**: 🔴 高（投球回の計算が狂う）

```js
const isOutP = ["ゴロ","フライ","ライナー","バント","アウト","三振"].some(x => r.includes(x))
  && !["ヒット",...,"振り逃げ","犠飛"].some(x => r.includes(x));
if (isOutP) ps.outs++;  // ← ゲッツーでも +1 のみ
```

ゲッツー（`"ゲッツー"` を含む result）は打者＋1ランナー = 2アウト相当だが、`ps.outs++` で1しか加算されない。  
→ 投球回が実際より少なく表示される。

**修正**:
```js
if (isOutP) {
  const extraOuts = r.includes("ゲッツー") ? 1 : r.includes("トリプルプレー") ? 2 : 0;
  ps.outs += 1 + extraOuts;
}
```

---

### BUG-3: "バント安打" が投手アウトとして誤計上される

**場所**: `calcStats` L471  
**重大度**: 🔴 高（投手被安打が過少、投球回が過大）

```js
const isOutP = ["ゴロ","フライ","ライナー","バント","アウト","三振"].some(x => r.includes(x))
```

`"バント安打"` は `r.includes("バント") = true`、かつ除外リストに `"バント安打"` という文字列がないため `isOutP = true` になる。  
（除外リストには `"ヒット"` があるが `"バント安打"` に `"ヒット"` は含まれない）

→ バント安打が打者のヒットとして stat に入りつつ、投手にもアウトが加算される二重エラー。

**修正**: 除外リストに `"安打"` を追加するか、`"バント安打"` を特別処理:
```js
&& !["ヒット","安打","二塁打",...].some(x => r.includes(x));
```

---

## 🟡 軽微バグ（修正推奨）

### BUG-4: `doOut(no<3)` → `openNextAtBat` に `runnersSnapshot` が渡らない

**場所**: L1801–1806  
**重大度**: 🟡 中（得点圏打席の統計がズレる）

```js
} else {
  setOuts(no);
  if (runnersState) setRunners(runnersState);  // ← state更新（非同期）
  setBatterIdx(i => i + 1);
  resetAtBat();
  openNextAtBat(undefined, undefined, undefined);  // ← runnersSnapshot なし
}
```

`openNextAtBat` 内: `const snap = runnersSnapshot ?? runners;` → `runners` はまだ古い値。  
→ 次打席の `runnersAtStart` がアウト前のランナー状態になる。

発動条件: ゲッツー・牽制アウト・盗塁死後の次打席。

**修正**: `doOut` のシグネチャに `runnerNames` も追加し `openNextAtBat` に渡す:
```js
openNextAtBat(undefined, undefined, undefined, undefined, runnersState ?? runners);
```

---

### BUG-5: `addScore` 内の `scoreAfterA/B` が stale な state を参照

**場所**: L1751–1773  
**重大度**: 🟡 低（スコア表示の表記がズレる、得点合計自体は正しい）

```js
const addScore = (n) => {
  if (isTop) {
    const nextA = scoreA + n;
    setScoreA(nextA);
    setGameLog(log => log.map(... {
      scoreAfterA: nextA, scoreAfterB: scoreB,  // ← scoreB は stale
    }));
  }
```

`isTop = true` で `addScore` を呼ぶ際、`scoreB` はクロージャの古い値。  
同一イベントで複数 `addScore` が呼ばれた場合（例：ランナー進塁 → `handleRunnerAdvance` で連続得点）、  
`scoreAfterB` の表示がズレる。

実際の `scoreB` state は正しく管理されているため、最終スコアへの影響なし。  
スコアボードの「この打席後スコア」表示のみの問題。

---

### BUG-6: `saveGame` が常に `insert` → 中断保存の重複

**場所**: L2004  
**重大度**: 🟡 中（DBに重複行が積まれる）

```js
const { error } = await supabase.from("nsb_games").insert(payload);
```

「途中保存」を複数回行うと同じ試合が複数行になる。  
試合IDの管理がなく `upsert` 不可。

**修正案**: 初回保存時に返された `id` を state に保持し、2回目以降は `update` を使う。

---

## ✅ 確認済み OK 項目

| # | カテゴリ | 確認内容 |
|---|---------|---------|
| #A-1 | 打順 | 3アウトでチェンジ（`doOut no>=3`）✓ |
| #A-3 | 打順 | `% 9` でラウンドロビン ✓ |
| #B-1 | カウント | ファウル `Math.min(s+1, 2)`（2超えない）✓ |
| #B-3 | カウント | 3ストライクで自動三振遷移 ✓ |
| #C-1 | ランナー | `runners`/`runnerNames` 同期（advanceWalk, handleRunnerAdvance, handleBaseAction すべて同期）✓ |
| #D-1 | 得点 | `addScore` が `scoreA/B` と `gameLog.runsScored` を同一関数内で更新 ✓（二重管理ではない）|
| #E-1 | イニング | 裏終了で `inning + 1`（`!isTop ? inning + 1 : inning`）✓ |
| #F-1 | state | `setGameLog` は functional update で最新 log を受け取る ✓ |
| #G-4 | 統計 | 打率・出塁率・長打率の 0 除算: `ab === 0 ? "-"` / `denom === 0 ? "-"` ✓ |
| #H-1 | UNDO | スナップショット方式（全 state を JSON.parse/stringify でディープコピー）✓ |
| #I-9 | 保存 | 二重送信防止: `!saving && saveGame(...)` ✓ |
| #J-3 | UI | 0除算 NaN 表示なし（gameAvg/gameOBP で事前チェック）✓ |
| #A-6 | 打順初期 | `batterIdxB = -1` の初期値は `doOut` の `(-1+1)%9 = 0` で正しく処理 ✓ |

---

## 📊 結論

| 重大度 | 件数 | 内容 |
|--------|------|------|
| 🔴 修正必須 | 3件 | 振り逃げ条件、ゲッツーアウト数、バント安打誤判定 |
| 🟡 修正推奨 | 3件 | runnersAtStart stale、scoreAfter stale、保存重複 |
| ✅ 問題なし | 12件 | カウント・イニング・打順・UNDO など主要ロジック |

**最重要修正**: BUG-1（振り逃げ）→ BUG-2・BUG-3（統計）の順で対応推奨。
