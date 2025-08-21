# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# Integrated Developer

統合開発者向けのプロジェクト管理アプリケーションです。単一の「Project」パネルでプロジェクトを管理し、Google Drive と連携してプロジェクトの作成・管理を行います。

## 機能

### パネル管理

- **Project**: 全てのプロジェクトを統合管理するメインパネル

### AI 連携プロジェクト管理機能

各プロジェクトには以下の 8 つのフォルダ構造が作成され、それぞれに AI 処理が対応しています：

- **Document**: プロジェクト全般のドキュメント
  - AI 処理: 要約・章立て整理、分岐・方向性の自動抽出、重複・冗長部分の検出と統合提案
- **Implementation**: 実装関連（GitHub リポジトリやコード、設計図）
  - AI 処理: GitHub API 連携での変更概要取得、実装仕様書の自動生成、アーキテクチャ図作成
- **Presentation**: プロジェクトの説明資料、スライド
  - AI 処理: スライド草案作成、図表の自動生成、外部サーチ情報の要約資料化
- **Reaching**: 学会・イベント・発表機会の情報
  - AI 処理: イベント要約、関連性スコア付け、Google Sheet/CSV 管理
- **Business**: 商業展開案、ビジネスモデル、マーケ戦略
  - AI 処理: ビジネスキャンバス自動生成、市場調査レポート要約、収益モデル提案
- **Academia**: 論文・研究背景資料
  - AI 処理: 引用候補論文要約、技術的背景の章立て整理、トピック分類マップ作成
- **Paper**: 論文草案（複数レパートリー）、Overleaf フォーマット
  - AI 処理: 引用文献・背景抽出、LaTeX テンプレート自動挿入、図表生成と埋め込み
- **Material**: 汎用画像・図・素材置き場
  - AI 処理: 自動タグ付け、解像度・フォーマット変換、使用履歴記録

### 差分検出と AI 処理システム

1. **変更スキャン**: プロジェクト内の全フォルダをスキャンして変更を効率的に検出
2. **差分分析**: 前回スキャン結果との比較で、変更・追加・削除されたファイルを特定
3. **AI 処理実行**: 変更されたフォルダに対してそれぞれ特化した AI 処理を実行
4. **結果保存**: 生成されたコンテンツを自動的に Google Drive に保存

### フォルダ構造

プロジェクトは Google Drive の `Integrated-Manager` フォルダ直下に作成されます。各パネルごとのサブフォルダは使用せず、すべてのプロジェクトが同一階層で管理されます。

### その他の機能

- ドラッグ&ドロップでプロジェクトを ChatGPT にアタッチ
- プロジェクト用のメモ帳機能
- Google Drive との連携

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Google Drive API 設定

#### Google Cloud Console での設定

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成
3. Google Drive API を有効化
4. OAuth 2.0 クライアント ID を作成
5. 承認済みのリダイレクト URI に `http://localhost:5173/auth/callback` を追加

#### 環境変数の設定

プロジェクトルートに `.env.local` ファイルを作成し、以下を設定：

```env
# Google Drive API設定
VITE_GOOGLE_API_KEY=your_google_api_key_here
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here

# IEEE Explore API設定（オプション）
VITE_IEEE_API_KEY=your_ieee_api_key_here
```

**IEEE API キーの取得方法:**

1. [IEEE Xplore](https://ieeexplore.ieee.org/) でアカウント作成
2. [IEEE API Portal](https://developer.ieee.org/) で API キーを申請
3. 承認後、取得したキーを `VITE_IEEE_API_KEY` に設定

詳細は [IEEE_API_SETUP.md](./IEEE_API_SETUP.md) を参照してください。

## 🌐 総合検索機能の設定

Reaching 機能で総合 Web 検索を使用する場合は、以下の環境変数を設定してください：

### Google Custom Search API

```bash
VITE_GOOGLE_SEARCH_API_KEY=your_google_search_api_key
VITE_GOOGLE_SEARCH_ENGINE_ID=your_custom_search_engine_id
```

### Bing Search API

```bash
VITE_BING_SEARCH_API_KEY=your_bing_search_api_key
```

### 設定手順

1. **Google Custom Search API**

   - [Google Cloud Console](https://console.cloud.google.com/)で API を有効化
   - [Custom Search Engine](https://cse.google.com/)で検索エンジンを作成
   - API キーと検索エンジン ID を取得

2. **Bing Search API**

   - [Microsoft Azure Portal](https://portal.azure.com/)で Bing Search API を有効化
   - サブスクリプションキーを取得

3. **環境変数の設定**
   - `.env`ファイルに上記の環境変数を追加
   - アプリケーションを再起動

### 検索機能の特徴

- **複数検索エンジン統合**: Google、Bing、DuckDuckGo から結果を取得
- **重複除去**: 同じ結果の重複を自動除去
- **スコアリング**: キーワードマッチングによる関連度スコアリング
- **自動分類**: 内容に基づく自動カテゴリ分類
- **フォールバック**: API 失敗時はモックデータで動作継続

### 3. 開発サーバーの起動

```bash
npm run dev
```

## 使用方法

1. 各パネルの右上にある 📁 ボタンをクリックしてプロジェクト管理を開く
2. 「新しいプロジェクト名を入力」でプロジェクトを作成
3. プロジェクトをクリックして Google Drive で開く
4. 各フォルダにファイルをアップロード

## 技術スタック

- React 19
- Vite
- Tailwind CSS
- Google Drive API
- Google API Client Library

## 開発

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# プレビュー
npm run preview

# リント
npm run lint
```
