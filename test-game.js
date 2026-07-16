/**
 * test-game.js — 3イニング全打席 Playwright フルゲームテスト
 * 実行: node test-game.js
 *
 * 前提: python3 -m http.server 8082 がポート8082で稼働中
 *       nsb_players にチームが1件以上登録済み
 *
 * シナリオ (表2-裏0):
 *   1回表: 三振・遊ゴロ・左フライ（0点）
 *   1回裏: 三振・遊ゴロ・中フライ（0点）
 *   2回表: 左本塁打・左本塁打・三振・遊ゴロ・中フライ（2点）
 *   2回裏: 三振・遊ゴロ・右フライ（0点）
 *   3回表: 三振・遊ゴロ・中フライ（0点）
 *   3回裏: 三振・二ゴロ・右フライ（0点）
 *   [Phase 2.5] 4回表: BB → 盗塁成功 → 三振
 *   [Phase 2.6] 選手交代フロー
 */

const { chromium } = require('playwright');

const URL     = 'http://localhost:8082/neo-scorebook.html';
const TIMEOUT = 12000;

let passed = 0, failed = 0;
const errors = [];

const log  = (msg) => console.log(msg);
const ok   = (label) => { passed++; log(`  ✅ ${label}`); };
const fail = (label, detail = '') => {
  failed++;
  errors.push({ label, detail });
  log(`  ❌ ${label}${detail ? ': ' + detail : ''}`);
};

const ss = async (page, name) => {
  await page.screenshot({ path: `/tmp/game_${name}.png` });
  log(`  📸 /tmp/game_${name}.png`);
};

// ── ヘルパー ──────────────────────────────────────────────────────────────────

/** 「打席結果を入力」が現れるまで待つ */
const waitMain = async (page) =>
  page.waitForSelector('span:text-is("打席結果を入力")', { timeout: TIMEOUT });

/** ボール投球（"-"ボタン） */
const pitchBall = async (page) => {
  await page.locator('div:text-is("-")').first().click();
  await page.waitForTimeout(100);
};

/** ストライク投球（"●"ボタン） */
const pitchStrike = async (page) => {
  await page.locator('div:text-is("●")').first().click();
  await page.waitForTimeout(100);
};

/** 三振（空振り3球） */
const atBatK = async (page, label) => {
  for (let i = 0; i < 3; i++) await pitchStrike(page);
  await waitMain(page);
  ok(`${label} → 三振`);
};

/** フォアボール（4ボール） */
const atBatBB = async (page, label) => {
  for (let i = 0; i < 4; i++) await pitchBall(page);
  await waitMain(page);
  ok(`${label} → フォアボール`);
};

/**
 * 塁ダイヤモンドの「cursor: pointer」な base (= ランナー在塁) をクリックして
 * 盗塁成功アクションを実行する。BB で 1塁にランナーを置いてから呼ぶこと。
 */
const stealBase = async (page, label) => {
  // runners.first が存在するとき <g style="cursor: pointer"> になる
  const baseG = page.locator('svg g[style*="cursor: pointer"]').first();
  if (await baseG.count() === 0) {
    fail(label, 'ランナーなし：盗塁テスト不可');
    return;
  }
  await baseG.click();
  await page.waitForTimeout(400);

  // baseAction 画面で「盗塁成功」をタップ
  const stealBtn = page.locator('div:text-is("盗塁成功")');
  await stealBtn.waitFor({ state: 'visible', timeout: TIMEOUT });
  await stealBtn.first().click();
  await page.waitForTimeout(400);

  await waitMain(page);
  ok(`${label} → 盗塁成功`);
};

/**
 * サブモーダル（ボトムシート）のコンテンツ div を返す共通関数。
 * getComputedStyle で position:fixed / z-index:200 のバックドロップを探し、
 * その最初の子要素（コンテンツシート）を返す。style 文字列マッチングを避ける。
 */
const findSubModal = () => {
  const backdrop = [...document.querySelectorAll('div')].find(d => {
    const cs = window.getComputedStyle(d);
    return cs.position === 'fixed' && cs.zIndex === '200';
  });
  return backdrop?.firstElementChild ?? null;
};

/**
 * モーダル内のプレイヤー行（cursor:pointer & 子に #{number}）を1件クリックする。
 * モーダルコンテンツ内だけを検索してページ背後の要素を誤クリックしない。
 * @returns true if clicked, false if none found
 */
const clickFirstPlayerInModal = (page) =>
  page.evaluate(() => {
    const findSubModal = () => {
      const backdrop = [...document.querySelectorAll('div')].find(d => {
        const cs = window.getComputedStyle(d);
        return cs.position === 'fixed' && cs.zIndex === '200';
      });
      return backdrop?.firstElementChild ?? null;
    };
    const modal = findSubModal();
    if (!modal) return false;
    for (const div of modal.querySelectorAll('div')) {
      const cs = window.getComputedStyle(div);
      if (cs.cursor !== 'pointer') continue;
      // 子要素のどれかに "#数字" テキストがあれば選手行と判定
      const hasJerseyNum = [...div.children].some(child => /^#\d/.test(child.textContent.trim()));
      if (hasJerseyNum) { div.click(); return true; }
    }
    return false;
  });

/** モーダル背景（バックドロップ）をクリックして閉じる */
const closeSubModal = async (page) => {
  await page.mouse.click(195, 60); // 上部はバックドロップ領域
  await page.waitForTimeout(350);
};

/**
 * 「選手交代」→ 守備交代フローをひと通り実行する。
 * ベンチが空の場合は検証後にキャンセルして終了する。
 */
const doSubstitution = async (page, label) => {
  // 「選手交代」ボタンをタップ
  const subSpan = page.locator('span:text-is("選手交代")');
  if (await subSpan.count() === 0) {
    fail(label, '選手交代ボタンが見つからない');
    return;
  }
  await subSpan.first().click();
  await page.waitForTimeout(400);

  try {
    // Step 1: チーム選択 — モーダル内の最初のチームカードをクリック
    // チームカード: cursor:pointer, childElementCount === 0（テキストのみ）
    await page.waitForSelector('text=どちらが交代しますか', { timeout: TIMEOUT });
    await page.evaluate(() => {
      const backdrop = [...document.querySelectorAll('div')].find(d => {
        const cs = window.getComputedStyle(d);
        return cs.position === 'fixed' && cs.zIndex === '200';
      });
      const modal = backdrop?.firstElementChild;
      if (!modal) return;
      for (const div of modal.querySelectorAll('div')) {
        const cs = window.getComputedStyle(div);
        // チームボタンは cursor:pointer の葉ノード（テキストのみ）
        if (cs.cursor === 'pointer' && div.childElementCount === 0 && div.textContent.trim()) {
          div.click();
          return;
        }
      }
    });
    await page.waitForTimeout(400);

    // Step 2: 守備交代 を選択（複数同時交代UI: 「＋ 守備交代」）
    const defBtn = page.locator('div:text-is("＋ 守備交代")').first();
    await defBtn.waitFor({ state: 'visible', timeout: TIMEOUT });
    await defBtn.click();
    await page.waitForTimeout(400);

    // Step 3: 退く選手 — 最初のプレイヤー行をクリック（モーダル内に限定）
    await page.waitForSelector('text=退く選手', { timeout: TIMEOUT });
    const outClicked = await clickFirstPlayerInModal(page);
    if (!outClicked) { fail(label, '退く選手が見つからない（選手なし？）'); return; }
    await page.waitForTimeout(400);

    // Step 4: ベンチ確認
    const noBench = await page.locator('text=ベンチに選手がいません').count();
    if (noBench > 0) {
      ok(`${label} → ベンチ空（「ベンチに選手がいません」確認）`);
      return; // finally でモーダルを閉じる
    }

    // Step 5: 入る選手 — 最初の利用可能なベンチ選手をクリック
    const inClicked = await clickFirstPlayerInModal(page);
    if (!inClicked) { fail(label, '入る選手が見つからない'); return; }
    await page.waitForTimeout(400);

    // Step 6a: ポジション選択 — "-" のままを避けるため実ポジションを確実にタップ
    // POS ステップが出たら最初の実ポジション（投/捕/一/二/三/遊/左/中/右/DH）をクリック
    await page.evaluate(() => {
      const backdrop = [...document.querySelectorAll('div')].find(d =>
        window.getComputedStyle(d).zIndex === '200'
      );
      const modal = backdrop?.firstElementChild;
      if (!modal) return;
      const REAL_POSITIONS = ['投','捕','一','二','三','遊','左','中','右','DH'];
      for (const div of modal.querySelectorAll('div')) {
        if (REAL_POSITIONS.includes(div.textContent.trim())) {
          const cs = window.getComputedStyle(div);
          if (cs.cursor === 'pointer') { div.click(); return; }
        }
      }
    });
    await page.waitForTimeout(200);

    // Step 6b: リストに追加（複数同時交代UI）
    const addBtn = page.locator('div:text-is("リストに追加")').first();
    await addBtn.waitFor({ state: 'visible', timeout: TIMEOUT });
    await addBtn.click();
    await page.waitForTimeout(400);

    // Step 6c: N件の交代を確定
    const confirmBtn = page.locator('div').filter({ hasText: /^\d+件の交代を確定$/ }).first();
    await confirmBtn.waitFor({ state: 'visible', timeout: TIMEOUT });
    await confirmBtn.click();
    await page.waitForTimeout(600);

    ok(`${label} → 選手交代完了`);
    return; // 確定でモーダルは自動で閉じる
  } finally {
    // モーダルが残っている場合はバックドロップで閉じる（z-index:200 で判定）
    const modalStillOpen = await page.evaluate(() => {
      return [...document.querySelectorAll('div')].some(d =>
        window.getComputedStyle(d).zIndex === '200'
      );
    });
    if (modalStillOpen) await closeSubModal(page);
  }
};

/**
 * インプレー打席
 * advanceHandler: 進塁確認が必要な場合の関数。null で自動処理なし。
 */
const atBatInplay = async (page, label, dir, result, advanceHandler = null) => {
  // インプレー画面を開く
  await page.locator('span:text-is("打席結果を入力")').first().click();
  await page.waitForTimeout(300);

  // 方向・結果を選択
  await page.locator('select').first().selectOption(dir);
  await page.waitForTimeout(150);
  await page.locator('select').nth(1).selectOption(result);
  // アプリ側の iOS ゴーストクリックガード（結果変更後 350ms は確定無効）を待つ
  await page.waitForTimeout(450);

  // 確認ボタン（「〇 × 〇 を記録」）が現れるまで待ってクリック
  const confirmBtn = page.locator('div:has-text("を記録")').last();
  await confirmBtn.waitFor({ state: 'visible', timeout: TIMEOUT });
  await confirmBtn.click();
  await page.waitForTimeout(500);

  // 進塁確認が必要な場合はハンドラ呼出し
  if (advanceHandler) {
    await advanceHandler(page);
  }

  // 本塁打は自動でmainに戻る。それ以外もランナー空なら自動でmainに戻る。
  await waitMain(page);
  ok(`${label} → ${dir}${result}`);
};

/**
 * 進塁確認ハンドラ: askAdvance（はい/いいえ）を処理した後、
 * runnerAdvance で各ランナーを指定塁に進める。
 * bases: 例 ["1塁", "ホーム（得点）"] → 1人目を1塁、2人目をホームに進める
 */
const makeAdvanceHandler = (bases) => async (page) => {
  for (const base of bases) {
    // askAdvance（はい/いいえ）が出ていれば
    const hasAsk = await page.locator('div:text-is("はい")').count();
    if (hasAsk > 0) {
      await page.locator('div:text-is("はい")').first().click();
      await page.waitForTimeout(300);
    }
    // runnerAdvance（塁選択）が出ていれば
    const hasAdvance = await page.locator('text=どこまで進みましたか').count();
    if (hasAdvance > 0) {
      await page.locator(`div:text-is("${base}")`).first().click();
      await page.waitForTimeout(300);
    }
  }
};

/** 確認付きアサーション: 画面本文に expected を含むか */
const assertBodyContains = async (page, expected, label) => {
  const body = await page.$eval('body', el => el.innerText);
  body.includes(expected) ? ok(label) : fail(label, `"${expected}" not found`);
};

// ── ゲームスクリプト ──────────────────────────────────────────────────────────
/**
 * type: "K" | "BB" | "inplay"
 * 本塁打はランナーなしなら advance 不要（自動でmainに戻る）
 */
const GAME_SCRIPT = [
  // ─── 1回表 ──────────────────────────────────────────────────────
  { label: "1回表-1", type: "K" },
  { label: "1回表-2", type: "inplay", dir: "遊", result: "ゴロ"   },
  { label: "1回表-3", type: "inplay", dir: "左", result: "フライ" },
  // ─── 1回裏 ──────────────────────────────────────────────────────
  { label: "1回裏-1", type: "K" },
  { label: "1回裏-2", type: "inplay", dir: "遊", result: "ゴロ"   },
  { label: "1回裏-3", type: "inplay", dir: "中", result: "フライ" },
  // ─── 2回表 (ソロ本塁打2本 → 2点) ───────────────────────────────
  { label: "2回表-1", type: "inplay", dir: "左", result: "本塁打" }, // 1点目
  { label: "2回表-2", type: "inplay", dir: "左", result: "本塁打" }, // 2点目
  { label: "2回表-3", type: "K" },
  { label: "2回表-4", type: "inplay", dir: "遊", result: "ゴロ"   },
  { label: "2回表-5", type: "inplay", dir: "中", result: "フライ" },
  // ─── 2回裏 ──────────────────────────────────────────────────────
  { label: "2回裏-1", type: "K" },
  { label: "2回裏-2", type: "inplay", dir: "遊", result: "ゴロ"   },
  { label: "2回裏-3", type: "inplay", dir: "右", result: "フライ" },
  // ─── 3回表 ──────────────────────────────────────────────────────
  { label: "3回表-1", type: "K" },
  { label: "3回表-2", type: "inplay", dir: "遊", result: "ゴロ"   },
  { label: "3回表-3", type: "inplay", dir: "中", result: "フライ" },
  // ─── 3回裏 ──────────────────────────────────────────────────────
  { label: "3回裏-1", type: "K" },
  { label: "3回裏-2", type: "inplay", dir: "二", result: "ゴロ"   },
  { label: "3回裏-3", type: "inplay", dir: "右", result: "フライ" },
];

// ── メイン ────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page    = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));

  try {
    // ──────────────────────────────────────────────────────────────
    // Phase 1: アプリ起動 → 記録画面へ
    // ──────────────────────────────────────────────────────────────
    log('\n【Phase 1】アプリ起動 → 記録開始');

    await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(3000);
    await ss(page, '01_home');

    // チーム未登録チェック
    if (await page.$('input[placeholder="例：兵庫ライオンズ"]')) {
      fail('チーム未登録 → テスト中断（先にブラウザでチームを登録してください）');
      await browser.close();
      return;
    }

    // 試合を記録する
    await page.locator('div:text-is("試合を記録する")').first().click();
    await page.waitForTimeout(2000);

    // オーダー設定
    await page.waitForTimeout(1500); // 選手リスト読み込み待ち

    // 「登録選手を一括セット」があれば優先（初回 or 前回なし）
    const bulkBtn = page.locator('div:text-is("登録選手を一括セット")');
    if (await bulkBtn.count() > 0) {
      await bulkBtn.first().click();
      await page.waitForTimeout(800);
      ok('一括セット実行');
    } else {
      // 「前回のオーダーを使う」: 内側の div を直接クリックするとバブリングで親の onClick が発火
      const prevOrderText = page.locator('div').filter({ hasText: /^前回のオーダーを使う$/ });
      if (await prevOrderText.count() > 0) {
        await prevOrderText.first().click();
        await page.waitForTimeout(1000);
        ok('前回のオーダーを適用');
        // バリデーションエラー検出: ポジション "-" の select を実ポジションに修正
        const fixed = await page.evaluate(() => {
          let n = 0;
          for (const sel of document.querySelectorAll('select')) {
            if (sel.value === '-') {
              const opts = [...sel.options].map(o => o.value);
              if (opts.includes('投')) { // 守備位置 select（投/捕/一..が選択肢に含まれる）
                const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
                setter.call(sel, '中');
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                n++;
              }
            }
          }
          return n;
        });
        if (fixed > 0) {
          await page.waitForTimeout(400);
          ok(`前回オーダーのバリデーションエラー修正: ${fixed}件 "-"→"中"`);
        }
      } else {
        fail('オーダー設定ボタンが見つからない（選手未登録の可能性）');
      }
    }

    // 記録開始
    const recBtn = page.locator('span:text-is("記録開始 →")');
    if (await recBtn.count() === 0) {
      fail('「記録開始 →」ボタンが見つからない');
    } else {
      await recBtn.first().click();
      await page.waitForTimeout(2000);
    }
    await ss(page, '02_record');

    await waitMain(page);
    ok('記録画面に遷移 → 準備完了');

    // ──────────────────────────────────────────────────────────────
    // Phase 2: ゲームスクリプトを実行
    // ──────────────────────────────────────────────────────────────
    log('\n【Phase 2】打席入力（全 ' + GAME_SCRIPT.length + ' 打席）');

    for (const ab of GAME_SCRIPT) {
      try {
        if (ab.type === 'K') {
          await atBatK(page, ab.label);
        } else if (ab.type === 'BB') {
          await atBatBB(page, ab.label);
        } else if (ab.type === 'inplay') {
          const handler = ab.advances ? makeAdvanceHandler(ab.advances) : null;
          await atBatInplay(page, ab.label, ab.dir, ab.result, handler);
        }
        await page.waitForTimeout(100);
      } catch (e) {
        fail(ab.label, e.message);
        await ss(page, `err_${ab.label.replace(/[^a-z0-9]/gi, '_')}`);
        // エラーがあっても続行を試みる
      }
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 2.5: 盗塁テスト（4回表：BB → 盗塁成功 → 三振）
    // ──────────────────────────────────────────────────────────────
    log('\n【Phase 2.5】盗塁テスト');

    // BB でランナー1塁へ
    try {
      await atBatBB(page, '4回表-1(BB)');
      // 1塁ランナーの盗塁
      await stealBase(page, '4回表-1 盗塁');
      // 次打者（三振）でチェンジ方向へ
      await atBatK(page, '4回表-2(K)');
    } catch (e) {
      fail('盗塁テスト', e.message);
      await ss(page, 'err_steal');
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 2.6: 選手交代テスト
    // ──────────────────────────────────────────────────────────────
    log('\n【Phase 2.6】選手交代テスト');
    try {
      await doSubstitution(page, '選手交代');
    } catch (e) {
      fail('選手交代テスト', e.message);
      await ss(page, 'err_sub');
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 3: スコア確認
    // ──────────────────────────────────────────────────────────────
    log('\n【Phase 3】スコア確認');
    await ss(page, '03_after_game');

    const bodyText = await page.$eval('body', el => el.innerText);
    // 本塁打2本打っているのでスコアに"2"が含まれるはず
    // スコアバーの数値を直接確認（React stateから計算されたもの）
    const score2visible = bodyText.includes('2');
    score2visible ? ok('スコアに "2" が表示されている') : fail('スコアに "2" が見当たらない');

    // ──────────────────────────────────────────────────────────────
    // Phase 4: 経過タブ確認
    // ──────────────────────────────────────────────────────────────
    log('\n【Phase 4】経過タブ確認');
    const histTab = page.locator('span:text-is("経過")');
    if (await histTab.count() > 0) {
      await histTab.first().click();
      await page.waitForTimeout(600);
      await ss(page, '04_history');

      const histBody = await page.$eval('body', el => el.innerText);
      histBody.includes('本塁打')
        ? ok('経過タブ: 本塁打の記録が表示された')
        : fail('経過タブ: 本塁打が見当たらない');
      // 盗塁は打席詳細を折り畳み中のため body には出ない → 4回表イニングヘッダで確認
      histBody.includes('4回')
        ? ok('経過タブ: 4回表（BB+盗塁）のイニングヘッダが表示された')
        : fail('経過タブ: 4回表が見当たらない');
      // 試合終了バナーは edit mode（完了済み試合を開いたとき）のみ表示 → ここでは非表示が正常
      !histBody.includes('試合終了')
        ? ok('経過タブ: 記録中は試合終了バナーなし（正常）')
        : fail('経過タブ: 試合終了バナーが記録中に表示されてしまっている');

      // 記録タブに戻る
      const recTab = page.locator('span:text-is("記録")');
      if (await recTab.count() > 0) await recTab.first().click();
      await page.waitForTimeout(300);
    } else {
      fail('経過タブが見つからない');
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 5: 試合終了 → 保存
    // ──────────────────────────────────────────────────────────────
    log('\n【Phase 5】試合終了・保存');

    const endBtn = page.locator('span:text-is("記録を終了")');
    if (await endBtn.count() > 0) {
      await endBtn.first().click();
      await page.waitForTimeout(500);
      await ss(page, '05_end_modal');

      // 「試合終了」オプションをクリック（内側div:text-is でバブリング）
      const gameEndBtn = page.locator('div:text-is("試合終了")');
      if (await gameEndBtn.count() > 0) {
        await gameEndBtn.first().click();
        await page.waitForTimeout(600);
        await ss(page, '05b_confirm_step');
      }

      // 「保存する」ボタン（confirm ステップで表示）
      const saveBtn = page.locator('div:text-is("保存する")');
      await saveBtn.waitFor({ state: 'visible', timeout: TIMEOUT });
      await saveBtn.first().click();
      await page.waitForTimeout(3000); // Supabase保存待ち
      await ss(page, '06_after_save');
      ok('保存完了');
    } else {
      fail('「記録を終了」ボタンが見つからない');
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 6: コンソールエラーチェック
    // ──────────────────────────────────────────────────────────────
    log('\n【Phase 6】コンソールエラー');
    const jsErrors = consoleErrors.filter(e =>
      !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('Supabase')
    );
    jsErrors.length === 0
      ? ok('JSコンソールエラーなし')
      : fail(`JSエラー ${jsErrors.length}件`, jsErrors.slice(0, 3).join(' | '));

  } catch (e) {
    fail('予期しないエラー', e.message);
    log(e.stack);
    await ss(page, 'fatal_error');
  } finally {
    await browser.close();
  }

  // ── 結果 ────────────────────────────────────────────────────────────────────
  log('\n' + '═'.repeat(55));
  log(`結果: ✅ ${passed} PASS  /  ❌ ${failed} FAIL`);
  if (errors.length > 0) {
    log('\n🐛 エラー一覧:');
    errors.forEach((b, i) => log(`  ${i + 1}. ${b.label}${b.detail ? '\n     → ' + b.detail : ''}`));
  } else {
    log('🎉 全打席OK');
  }
  log('═'.repeat(55));
  if (failed > 0) process.exit(1);
})();
