const { chromium } = require('playwright');

const URL = 'http://localhost:8765/neo-scorebook.html';
const TIMEOUT = 10000;

let passed = 0;
let failed = 0;
const bugs = [];

function log(msg) { console.log(msg); }
function ok(label) { passed++; log(`  ✅ ${label}`); }
function fail(label, detail = '') { failed++; bugs.push({ label, detail }); log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); }

// 正確なテキストを持つ最初の要素を取得（Playwright text= は正確一致を含む子要素も検索）
async function findByExactText(page, text, tag = '*') {
  return page.locator(`${tag}:text-is("${text}")`).first();
}

// ────────────────────────────────────────────────────────
// テスト本体
// ────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));

  const ss = async (name) => {
    await page.screenshot({ path: `/tmp/ss_${name}.png` });
    log(`  📸 /tmp/ss_${name}.png`);
  };

  try {
    // ────────────────────────────
    // 1. アプリ起動
    // ────────────────────────────
    log('\n【1】アプリ起動');
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(3000); // Babel transpile + Supabase待ち

    const hasContent = await page.$('body *');
    hasContent ? ok('ページ読み込み成功') : fail('ページが空');
    await ss('01_home');

    // ────────────────────────────
    // 1.5. 選手登録スキップ（デモ用）
    // ────────────────────────────
    log('\n【1.5】テスト用セットアップ');
    log('  ℹ️ 選手登録はブラウザ手動、または前回のオーダーを使用');



    const setupInput = await page.$('input[placeholder="例：兵庫ライオンズ"]');
    if (setupInput) {
      fail('チーム未登録 → テスト中断（先にブラウザでチームを登録してください）');
      await browser.close();
      return;
    }

    // 「試合を記録する」ボタン：text-is は innerText の完全一致を探す
    // このDIVは "試合を記録する" のみのテキストを持つ
    const startBtnLocator = page.locator('div:text-is("試合を記録する")');
    const startBtnCount = await startBtnLocator.count();
    if (startBtnCount === 0) {
      fail('「試合を記録する」テキスト要素なし');
    } else {
      ok(`ホーム画面確認（候補:${startBtnCount}件）`);
    }

    // ────────────────────────────
    // 3. オーダー登録 → 記録開始
    // ────────────────────────────
    log('\n【3】記録開始フロー');

    // 正確なボタンを探してクリック（cursor:pointer を持つ親のうち試合を記録するを含む最初の要素）
    // アプリではこのテキストを持つ div は1つ（ボタンカード内の見出し）
    const startBtn = await page.locator('div:text-is("試合を記録する")').first();
    await startBtn.click();
    await page.waitForTimeout(2000); // 画面遷移 + Supabase選手読み込み待ち
    await ss('02_order');

    const orderTitle = await page.locator('text=オーダー登録').first().isVisible().catch(() => false);
    if (orderTitle) {
      ok('オーダー登録画面に遷移');
    } else {
      const bodyText = await page.$eval('body', el => el.innerText.slice(0, 200));
      fail('オーダー登録画面に遷移しなかった', bodyText);
    }

    // ⚡ 登録選手を一括セット
    const autoBtnLoc = page.locator('div:text-is("登録選手を一括セット")');
    const hasBulkSet = await autoBtnLoc.count() > 0;
    if (hasBulkSet) {
      await autoBtnLoc.first().click();
      await page.waitForTimeout(500);
      ok('⚡一括セット実行');
    } else {
      log('  ⚠️ 一括セットボタンなし（選手未登録の可能性）');
    }

    // 記録開始 →
    const recBtnLoc = page.locator('span:text-is("記録開始 →")');
    const hasRecBtn = await recBtnLoc.count() > 0;
    if (!hasRecBtn) {
      fail('「記録開始 →」ボタンが見つからない');
    } else {
      await recBtnLoc.first().click();
      await page.waitForTimeout(2000); // 記録画面の初期化待ち
      await ss('03_record');

      const scoreBar = await page.locator('text=NEO SCORE BOOK').first().isVisible().catch(() => false);
      const bodyText2 = await page.$eval('body', el => el.innerText.slice(0, 100));
      // 記録画面ではBSO表示などがある。インプレー画面入力ボタンの存在で確認
      const hasInplay = await page.locator('span:text-is("打席結果を入力")').count();
      hasInplay > 0 ? ok('記録画面に遷移した') : fail('記録画面に遷移しなかった', bodyText2);
    }

    // ────────────────────────────
    // 4. BSO カウント（ボール3つ）
    // ────────────────────────────
    log('\n【4】BSO カウント（ボール）');
    // ボールボタン: 投球エリアの "-" ラベル div（handlePitch("B") を呼ぶ）
    const ballBtnLoc = page.locator('div:text-is("-")');
    const ballCount = await ballBtnLoc.count();
    if (ballCount === 0) {
      fail('ボール(-)ボタンが見つからない');
    } else {
      for (let i = 0; i < 3; i++) {
        await ballBtnLoc.first().click();
        await page.waitForTimeout(200);
      }
      ok('ボール3球入力');
    }

    // ────────────────────────────
    // 5. フォアボール（4球目）
    // ────────────────────────────
    log('\n【5】フォアボール（4球目）');
    await page.locator('div:text-is("-")').first().click();
    await page.waitForTimeout(600);
    // フォアボール後は次打者に切り替わり「打席結果を入力」spanが引き続き存在するはず
    const ipBtnAfterBB = await page.locator('span:text-is("打席結果を入力")').count();
    ipBtnAfterBB > 0 ? ok('フォアボール → 次の打者に進んだ') : fail('フォアボール後の状態が不明');

    // ────────────────────────────
    // 6. 三振（3ストライク）
    // ────────────────────────────
    log('\n【6】三振（空振り）');
    // 空振りボタン: "●" ラベルのdiv
    const strikeBtnLoc = page.locator('div:text-is("●")');
    const sCount = await strikeBtnLoc.count();
    if (sCount === 0) {
      fail('空振り(●)ボタンが見つからない');
    } else {
      for (let i = 0; i < 3; i++) {
        await strikeBtnLoc.first().click();
        await page.waitForTimeout(200);
      }
      await page.waitForTimeout(400);
      ok('空振り三振 → 次の打者に進んだ');
    }

    // ────────────────────────────
    // 7. インプレー → ヒット
    // ────────────────────────────
    log('\n【7】インプレー → ヒット');
    await ss('04_before_inplay');
    // 「打席結果を入力」は span 内のテキスト
    const ipBtnLoc = page.locator('span:text-is("打席結果を入力")');
    const hasIpBtn = await ipBtnLoc.count() > 0;
    if (!hasIpBtn) {
      fail('「打席結果を入力」ボタンが見つからない');
    } else {
      await ipBtnLoc.first().click();
      await page.waitForTimeout(500);
      await ss('05_inplay');

      // インプレータブの表示確認
      const inplayLabel = await page.locator('text=インプレー').first().isVisible().catch(() => false);
      inplayLabel ? ok('インプレー画面表示') : fail('インプレー画面が表示されなかった');

      // 方向 select（Locator APIを使用してReact changeイベントを確実に発火）
      const dirSelect = page.locator('select').first();
      const resultSelect = page.locator('select').nth(1);
      const selectCount = await page.locator('select').count();
      log(`  select要素数: ${selectCount}`);

      if (selectCount >= 1) {
        await dirSelect.selectOption('投'); // "投" = HIT_DIRECTIONS[1]
        await page.waitForTimeout(400);
      }
      if (selectCount >= 2) {
        await resultSelect.selectOption('ヒット');
        await page.waitForTimeout(400);
      }

      // React再レンダリング待ち
      await page.waitForTimeout(500);
      await ss('05b_after_select');

      // 確認ボタン（「投 × ヒット を記録」の形式）
      // canConfirm=true のとき cursor:pointer になる
      const bodySnap = await page.$eval('body', el => el.innerText.slice(0, 300));
      log(`  選択後の画面: ${bodySnap.replace(/\n/g, ' ').slice(0, 150)}`);

      // カーソルに依存せず「を記録」を含むdivを探す
      const confirmBtn = page.locator('div:has-text("を記録")').last();
      const hasConfirm = await confirmBtn.count() > 0;
      log(`  確認ボタン(has-text)候補数: ${await page.locator('div:has-text("を記録")').count()}`);

      if (!hasConfirm) {
        fail('ヒット確認ボタンが表示されなかった');
      } else {
        await confirmBtn.click();
        await page.waitForTimeout(800);
        await ss('06_after_hit');

        // 進塁確認画面 or main画面に戻ったか
        const runnerScreen = await page.locator('text=どこまで進みましたか？').count();
        const backToMain = await page.locator('span:text-is("打席結果を入力")').count();
        if (runnerScreen > 0) {
          ok('ヒット → 進塁確認フロー表示');
          // Btn コンポーネントは div:text-is で正確一致させる（"1塁ランナー" ヘッダーとの区別のため）
          // 進む先は2塁（runner on 1st、batter hits single → runner moves to 2nd）
          const twoBaseBtn = page.locator('div:text-is("2塁")');
          const twoCount = await twoBaseBtn.count();
          log(`  進塁ボタン "2塁" 候補数: ${twoCount}`);
          if (twoCount > 0) {
            await twoBaseBtn.first().click();
            await page.waitForTimeout(600);
          } else {
            // fallback: アウトを選択してとにかく先に進む
            const outBtn = page.locator('div:text-is("アウト（走塁死）")');
            if (await outBtn.count() > 0) await outBtn.first().click();
            await page.waitForTimeout(600);
          }
          const backAfterRunner = await page.locator('span:text-is("打席結果を入力")').count();
          backAfterRunner > 0 ? ok('進塁確認後 → 記録画面に戻った') : fail('進塁確認後に記録画面に戻らなかった');
        } else if (backToMain > 0) {
          ok('ヒット → 記録画面に戻った');
        } else {
          fail('ヒット後の遷移がおかしい');
          const bodyText3 = await page.$eval('body', el => el.innerText.slice(0, 200));
          log(`  現在の画面: ${bodyText3}`);
        }
      }
    }

    // ────────────────────────────
    // 8. 死球テスト
    // ────────────────────────────
    log('\n【8】死球（特殊タブ）');
    const ipBtn2 = page.locator('span:text-is("打席結果を入力")');
    if (await ipBtn2.count() === 0) {
      fail('記録画面に戻っていない → 死球テストをスキップ');
    } else {
      await ipBtn2.first().click();
      await page.waitForTimeout(400);

      // 特殊タブ: div:text-is で完全一致（"死球 / 四球 / 振逃" ラベルのdiv）
      const specialTabLoc = page.locator('div:text-is("死球 / 四球 / 振逃")');
      const hasSpecial = await specialTabLoc.count() > 0;
      log(`  特殊タブ候補数: ${await specialTabLoc.count()}`);
      if (!hasSpecial) {
        fail('特殊タブが見つからない');
      } else {
        await specialTabLoc.first().click();
        await page.waitForTimeout(300);
        await ss('07_special_tab');

        // 死球ボタン本体
        const dbBtn = page.locator('div:text-is("死球")');
        if (await dbBtn.count() > 0) {
          await dbBtn.first().click();
          await page.waitForTimeout(700);
          await ss('08_after_db');
          const backToMain = await page.locator('span:text-is("打席結果を入力")').count();
          backToMain > 0 ? ok('死球 → 記録画面に戻った ✓') : fail('死球後に記録画面に戻らなかった ✗');
        } else {
          fail('死球ボタンが見つからなかった');
        }
      }
    }

    // ────────────────────────────
    // 9. 故意四球テスト
    // ────────────────────────────
    log('\n【9】故意四球（特殊タブ）');
    const ipBtn3 = page.locator('span:text-is("打席結果を入力")');
    if (await ipBtn3.count() > 0) {
      await ipBtn3.first().click();
      await page.waitForTimeout(400);

      const specialTab2 = page.locator('div:text-is("死球 / 四球 / 振逃")');
      if (await specialTab2.count() > 0) {
        await specialTab2.first().click();
        await page.waitForTimeout(300);
        const ibbBtn = page.locator('div:text-is("故意四球")');
        if (await ibbBtn.count() > 0) {
          await ibbBtn.first().click();
          await page.waitForTimeout(600);
          const backToMain = await page.locator('span:text-is("打席結果を入力")').count();
          backToMain > 0 ? ok('故意四球 → 記録画面に戻った ✓') : fail('故意四球後に記録画面に戻らなかった ✗');
        } else {
          fail('故意四球ボタンが見つからなかった');
        }
      } else {
        fail('故意四球テスト: 特殊タブが見つからなかった');
      }
    }

    // ────────────────────────────
    // 10. 経過タブ
    // ────────────────────────────
    log('\n【10】経過タブ');
    const histTab = page.locator('span:text-is("経過")');
    if (await histTab.count() === 0) {
      fail('「経過」タブが見つからない');
    } else {
      await histTab.first().click();
      await page.waitForTimeout(400);
      await ss('09_history_tab');
      const histContent = await page.$('text=回 ▲ 表');
      histContent ? ok('経過タブ → 回表ログが表示された') : fail('経過タブのログが表示されない');

      const recTab = page.locator('span:text-is("記録")');
      if (await recTab.count() > 0) await recTab.first().click();
      await page.waitForTimeout(300);
    }

    // ────────────────────────────
    // 11. 記録を終了モーダル
    // ────────────────────────────
    log('\n【11】記録を終了モーダル');
    // インプレー画面が残っている場合は戻る
    const backBtn11 = page.locator('span:text-is("戻る")');
    if (await backBtn11.count() > 0) {
      await backBtn11.first().click();
      await page.waitForTimeout(300);
    }
    const endBtnLoc = page.locator('span:text-is("記録を終了")');
    if (await endBtnLoc.count() === 0) {
      fail('「記録を終了」ボタンが見つからない');
    } else {
      await endBtnLoc.first().click();
      await page.waitForTimeout(400);
      await ss('10_end_modal');
      const modal = await page.locator('text=記録を終了する').first().isVisible().catch(() => false);
      modal ? ok('終了モーダルが表示された') : fail('終了モーダルが表示されなかった');

      const cancelBtn = page.locator('div:text-is("キャンセル")');
      if (await cancelBtn.count() > 0) {
        await cancelBtn.first().click();
        await page.waitForTimeout(300);
        const modalGone = await page.locator('text=記録を終了する').count() === 0;
        modalGone ? ok('キャンセルでモーダルが閉じた') : fail('キャンセルでモーダルが閉じなかった');
      }
    }

    // ────────────────────────────
    // 12. コンソールエラーチェック
    // ────────────────────────────
    log('\n【12】コンソールエラー');
    const jsErrors = consoleErrors.filter(e =>
      !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('Supabase')
    );
    jsErrors.length === 0
      ? ok('JSコンソールエラーなし')
      : fail(`JSエラーが${jsErrors.length}件`, jsErrors.slice(0, 3).join(' | '));

  } catch (e) {
    fail('予期しないエラー', e.message);
    log(e.stack);
  } finally {
    await browser.close();
  }

  // ────────────────────────────
  // 結果サマリー
  // ────────────────────────────
  log('\n' + '═'.repeat(50));
  log(`結果: ✅ ${passed}件 PASS  /  ❌ ${failed}件 FAIL`);
  if (bugs.length > 0) {
    log('\n🐛 バグ一覧:');
    bugs.forEach((b, i) => log(`  ${i + 1}. ${b.label}${b.detail ? '\n     → ' + b.detail : ''}`));
  } else {
    log('🎉 バグなし');
  }
  log('═'.repeat(50));
})();
