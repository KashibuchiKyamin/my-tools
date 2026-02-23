# 開発運用ルール

## 目的

- `main` は完成済みの状態のみを保持する。
- 1つの開発テーマを、段階（要件定義 / 設計 / 実装 / テスト）に分けて安全に進める。

## 基本方針

- `main` に直接コミットしない。
- **1開発につき親ブランチを1本**作成する。
- 段階ごとに子ブランチを切り、PRで親ブランチへマージする。
- 全段階完了後に、親ブランチから `main` へPRを作成してマージする。

---

## ブランチ構成

### 1) 親ブランチ（開発単位）

- 形式: `feature/<dev-topic>`
- 例: `feature/working-time-calculator`

### 2) 子ブランチ（作業段階単位）

- 形式: `feature/<dev-topic>/<phase>`
- `phase` の例:
  - `requirements`
  - `design`
  - `implementation`
  - `test`

例:

- `feature/working-time-calculator/requirements`
- `feature/working-time-calculator/design`
- `feature/working-time-calculator/implementation`
- `feature/working-time-calculator/test`

---

## 開発フロー

1. `main` 最新を取得
2. 親ブランチ `feature/<dev-topic>` を作成
3. 子ブランチ `feature/<dev-topic>/requirements` を作成して作業
4. PR: 子ブランチ → 親ブランチ（レビュー後マージ）
5. 同様に `design` → `implementation` → `test` を進める
6. すべて完了後、PR: 親ブランチ → `main`
7. `main` へマージ後、親/子ブランチを削除

---

## PRルール

- PRは小さく分ける（1段階1PRを基本）。
- PR本文に最低限以下を記載する。
  - 目的
  - 変更内容
  - 未対応/次PR予定
  - 確認方法（必要なら）

---

## 最小コマンド例

### 親ブランチ作成

```bash
git checkout main
git pull
git checkout -b feature/working-time-calculator
git push -u origin feature/working-time-calculator
```

### 子ブランチ（要件）作成

```bash
git checkout feature/working-time-calculator
git checkout -b feature/working-time-calculator/requirements
```

### 子ブランチ作業後

```bash
git add -A
git commit -m "Add requirements for working-time-calculator"
git push -u origin feature/working-time-calculator/requirements
```

この後、GitHubで PR:  
`feature/working-time-calculator/requirements` → `feature/working-time-calculator`

---

## 実装済みプロジェクトへの追加開発の場合

### 原則

新しい開発テーマごとに、新たに親ブランチを作成する。

既に `main` に統合されたプロジェクト（例：`working-time-calculator`）に対して、新しい機能追加や改善を行う場合：

### ブランチ命名例

親ブランチ: `feature/<project>/<feature-theme>`

- 例：`feature/working-time-calculator/auto-load-csv`
- 例：`feature/working-time-calculator/performance-improvement`

子ブランチ: `feature/<project>/<feature-theme>/<phase>`

- 例：`feature/working-time-calculator/auto-load-csv/requirements`
- 例：`feature/working-time-calculator/auto-load-csv/design`
- 例：`feature/working-time-calculator/auto-load-csv/implementation`
- 例：`feature/working-time-calculator/auto-load-csv/test`

### 実装済みプロジェクトの開発フロー例

```text
main（既存プロジェクト統合済み）
  └─ feature/working-time-calculator/auto-load-csv（新規親ブランチ）
      ├─ feature/working-time-calculator/auto-load-csv/requirements
      ├─ feature/working-time-calculator/auto-load-csv/design
      ├─ feature/working-time-calculator/auto-load-csv/implementation
      └─ feature/working-time-calculator/auto-load-csv/test
```

### コマンド例

```bash
# 親ブランチ作成
git checkout main
git pull
git checkout -b feature/working-time-calculator/auto-load-csv

# 子ブランチ作成
git checkout -b feature/working-time-calculator/auto-load-csv/requirements

# 作業とコミット
git add -A
git commit -m "Add requirements for CSV auto-load feature"
git push -u origin feature/working-time-calculator/auto-load-csv/requirements
```

---

## 運用上の注意

- 緊急修正以外は `main` への直接PRを禁止する。
- 親ブランチが長期化する場合、定期的に `main` を取り込む。
- マージ方式（merge/squash/rebase）はリポジトリ設定に従う。
- **既存プロジェクトへの新機能であっても、新たに親ブランチを作成し階層的に管理する。**これにより、各開発テーマの独立性と追跡可能性が確保される。
