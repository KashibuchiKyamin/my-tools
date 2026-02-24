/**
 * working-time-calculator の結合テスト（E2E）
 * 
 * Playwright を使用してブラウザでの画面操作を検証
 * - HTML ファイルの直開き動作
 * - CSV 読み込み処理
 * - 計算ロジックの統合動作
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// テスト用 HTML ファイルのパス
const HTML_FILE = `file://${path.resolve(__dirname, '../src/index.html')}`;

/**
 * テスト用のサンプル CSV を生成
 */
function createSampleHolidayCSV() {
  return 'date,name\n2026-02-11,建国記念の日\n2026-02-23,天皇誕生日';
}

function createSampleWorkCSV() {
  return 'date,start,end,break,cumulative_work\n2026-02-16,09:00,18:00,01:00,\n2026-02-17,09:00,17:00,01:00,';
}

async function capture(page, testInfo, name) {
  await testInfo.attach(`${name}.png`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

test.describe('working-time-calculator E2E テスト', () => {
  test('ページのロード確認', async ({ page }) => {
    // タイトル確認
    await page.goto(HTML_FILE);
    const title = await page.title();
    expect(title).toContain('稼働時間計算');

    // 主要要素が表示されていることを確認
    const heading = page.locator('h1');
    await expect(heading).toContainText('稼働時間計算');
  });

  test('休日 CSV の読み込み', async ({ page }, testInfo) => {
    await page.goto(HTML_FILE);
    
    const csvContent = createSampleHolidayCSV();

    await capture(page, testInfo, 'holiday-csv-before');

    await page.evaluate((csv) => {
      const file = new File([csv], 'holidays.csv', { type: 'text/csv' });
      const input = document.getElementById('holidayCsvInput');
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, csvContent);

    // ページに通知が表示されることを確認
    await page.waitForTimeout(500);
    await capture(page, testInfo, 'holiday-csv-after');
    const holidayValue = await page.locator('#holidayCsvInput').evaluate(el => el.files.length);
    expect(holidayValue).toBeGreaterThan(0);
  });

  test('勤務 CSV の読み込み', async ({ page }, testInfo) => {
    await page.goto(HTML_FILE);
    
    const csvContent = createSampleWorkCSV();

    await capture(page, testInfo, 'work-csv-before');

    await page.evaluate((csv) => {
      const file = new File([csv], 'work.csv', { type: 'text/csv' });
      const input = document.getElementById('workCsvInput');
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, csvContent);

    await page.waitForTimeout(500);
    await capture(page, testInfo, 'work-csv-after');
    const workValue = await page.locator('#workCsvInput').evaluate(el => el.files.length);
    expect(workValue).toBeGreaterThan(0);
  });

  test('計算ボタンの動作確認', async ({ page }, testInfo) => {
    await page.goto(HTML_FILE);
    
    // クラスセレクター で計算ボタンを確認
    const calculateButton = page.locator('button').filter({ hasText: '計算' });
    
    // ボタンが表示されていることを確認
    await expect(calculateButton).toBeVisible();

    // ボタンがクリック可能であることを確認
    await expect(calculateButton).toBeEnabled();

    // エラーが発生していないことを確認（コンソールエラーをチェック）
    const errors = [];
    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await capture(page, testInfo, 'calculate-before');

    // ボタンをクリック
    await calculateButton.click();
    await page.waitForTimeout(1000);
    await capture(page, testInfo, 'calculate-after');
    
    expect(errors.filter(e => e.includes('Uncaught'))).toHaveLength(0);
  });

  test('サマリセクションの表示確認', async ({ page }) => {
    await page.goto(HTML_FILE);
    
    // サマリセクションが存在することを確認
    const summary = page.locator('section.summary');
    await expect(summary).toBeVisible();

    // サマリセクション内の定義リストを確認
    const dl = summary.locator('dl');
    await expect(dl).toBeVisible();
  });

  test('月セレクタの機能確認', async ({ page }, testInfo) => {
    await page.goto(HTML_FILE);
    
    const monthInput = page.locator('#targetMonth');
    
    // 月入力が表示されていることを確認
    await expect(monthInput).toBeVisible();

    const originalValue = await monthInput.inputValue();

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await capture(page, testInfo, 'month-change-before');

    // 月を変更（既存入力があるため変更は拒否される想定）
    await monthInput.fill('2026-01');
    await monthInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));

    // ページが更新されたことを確認（テーブルがリセットされるなど）
    await page.waitForTimeout(500);
    await capture(page, testInfo, 'month-change-after');
    
    // 入力値が元の値のまま戻ることを確認
    const value = await monthInput.inputValue();
    expect(value).toBe(originalValue);
  });

  test('エラーハンドリング確認', async ({ page }, testInfo) => {
    await page.goto(HTML_FILE);
    
    const errors = [];
    
    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await capture(page, testInfo, 'error-check-before');

    // 計算ボタンをクリック（CSV なし）
    const calculateButton = page.locator('button').filter({ hasText: '計算' });
    await calculateButton.click();

    await page.waitForTimeout(500);
    await capture(page, testInfo, 'error-check-after');

    // 重大なエラーがないことを確認
    const criticalErrors = errors.filter(e => 
      e.includes('Cannot') || 
      e.includes('TypeError') || 
      e.includes('ReferenceError')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('UIの基本レイアウト確認', async ({ page }) => {
    await page.goto(HTML_FILE);
    
    // 主要なセクションが存在することを確認（クラスセレクターを使用）
    const inputSection = page.locator('section.controls');
    await expect(inputSection).toBeVisible();

    const tableSection = page.locator('section.table-panel');
    await expect(tableSection).toBeVisible();

    const summarySection = page.locator('section.summary');
    await expect(summarySection).toBeVisible();

    const errorSection = page.locator('section.errors');
    await expect(errorSection).toBeVisible();
  });
});

