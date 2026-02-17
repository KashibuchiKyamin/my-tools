# Copilot Instructions

このリポジトリで作業する際は、以下を優先します。

## 開発フロー
- `main` へ直接コミットしない。
- 1開発につき親ブランチを作成し、段階ごとに子ブランチでPRする。
- 運用詳細は `DEVELOPMENT_WORKFLOW.md` に従う。

## ドキュメント優先
- 実装前に `requirements` と `design` を更新する。
- 仕様変更時は実装と同時に要件/設計も更新する。

## 実装方針（working-time-calculator）
- まずMVPを維持する。
- 追加機能より、既存要件との整合を優先する。
- 不要な依存導入を避ける。
