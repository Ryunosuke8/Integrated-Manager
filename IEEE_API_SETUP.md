# IEEE Explore API 設定ガイド

## 概要

このプロジェクトでは、IEEE Xplore Digital Library API を使用して参考論文検索機能を実装しています。

## IEEE API の認証方法

IEEE API には 2 つの認証方法があります：

### 1. API キー認証（推奨）

- シンプルな認証方法
- API キーをクエリパラメータとして送信
- 設定が簡単

### 2. OAuth 認証

- より安全な認証方法
- コールバック URL の設定が必要
- アクセストークンを使用

## IEEE API の正しい使用方法

### API エンドポイント

- **基本 URL**: `https://ieeexplore.ieee.org/rest/search`
- **メソッド**: GET
- **認証**: API キーまたは OAuth アクセストークン

### リクエスト形式

#### API キー認証の場合

```
GET https://ieeexplore.ieee.org/rest/search?apikey=YOUR_API_KEY&queryText=YOUR_QUERY&max_records=50
```

#### OAuth 認証の場合

```
GET https://ieeexplore.ieee.org/rest/search?queryText=YOUR_QUERY&max_records=50
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 主要パラメータ

- `apikey`: IEEE API キー（API キー認証の場合）
- `queryText`: 検索クエリ（必須）
- `max_records`: 最大取得件数（デフォルト: 50）
- `year_range`: 出版年範囲（例: "2020-2024"）
- `content_type`: コンテンツタイプ（例: "Conferences,Journals"）
- `sort_field`: ソート順（例: "relevance"）

### レスポンス形式

```json
{
  "total_records": 100,
  "total_searched": 100,
  "articles": [
    {
      "title": "論文タイトル",
      "authors": [...],
      "abstract": "論文概要",
      "publication_year": "2024",
      "publication_title": "ジャーナル名",
      "doi": "10.1109/...",
      "pdf_url": "https://...",
      "article_number": "12345678"
    }
  ]
}
```

## IEEE API キーの取得方法

### 1. IEEE Xplore アカウントの作成

1. [IEEE Xplore](https://ieeexplore.ieee.org/) にアクセス
2. 右上の「Sign In」をクリック
3. 「Create Account」でアカウントを作成

### 2. API キーの申請

1. IEEE Xplore にログイン
2. [IEEE API Portal](https://developer.ieee.org/) にアクセス
3. 「Get API Key」をクリック
4. 申請フォームに必要事項を記入
   - 用途: Academic Research
   - 使用目的: 論文検索・分析
5. 申請を送信（通常 1-2 営業日で承認）

### 3. API キーの確認

- 承認後、IEEE API Portal で API キーを確認できます
- キーは `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` の形式（32 文字）

## OAuth 認証の設定（オプション）

### 1. コールバック URL の設定

IEEE API Portal で以下のコールバック URL を設定してください：

```
http://localhost:5173/callback
```

### 2. クライアント ID の取得

OAuth 認証を使用する場合は、IEEE API Portal でクライアント ID も取得してください。

## 環境変数の設定

### 開発環境（.env.local）

プロジェクトのルートディレクトリに `.env.local` ファイルを作成：

```bash
# IEEE Explore API キー（APIキー認証）
VITE_IEEE_API_KEY=your_ieee_api_key_here

# IEEE Client ID（OAuth認証）
VITE_IEEE_CLIENT_ID=your_ieee_client_id_here
```

### 本番環境

本番環境では、ホスティングサービスの環境変数設定で以下を追加：

```bash
VITE_IEEE_API_KEY=your_ieee_api_key_here
VITE_IEEE_CLIENT_ID=your_ieee_client_id_here
```

## API の制限事項

### レート制限

- 1 日あたりのリクエスト数制限があります
- 詳細は IEEE API Portal で確認してください

### 検索制限

- 1 回の検索で最大 100 件まで取得可能
- 年範囲指定で過去の論文を検索可能

## 使用方法

### 基本的な使用

API キーまたはクライアント ID を設定すると、参考論文検索機能が自動的に IEEE API を使用します。

### フォールバック機能

- 認証情報が設定されていない場合
- API エラーが発生した場合
- ネットワークエラーが発生した場合

上記の場合、システムは自動的にモックデータを使用して検索を継続します。

## トラブルシューティング

### よくある問題

#### 1. API キーが無効

```
エラー: IEEE API キーが無効です。
```

**解決方法:**

- API キーが正しく設定されているか確認
- IEEE API Portal でキーの有効性を確認

#### 2. アクセストークンが無効

```
エラー: IEEE API アクセストークンが無効です。
```

**解決方法:**

- OAuth 認証フローを再実行
- クライアント ID が正しく設定されているか確認

#### 3. レート制限エラー

```
エラー: API レート制限に達しました。しばらく待ってから再試行してください。
```

**解決方法:**

- しばらく待ってから再試行
- 検索キーワードを絞り込んでリクエスト数を削減

#### 4. ネットワークエラー

```
エラー: ネットワークエラーが発生しました。インターネット接続を確認してください。
```

**解決方法:**

- インターネット接続を確認
- ファイアウォール設定を確認

#### 5. HTTP 405 エラー（Method Not Allowed）

```
エラー: HTTP error! status: 405
```

**解決方法:**

- IEEE API は GET メソッドを使用することを確認
- プロキシ設定が正しく動作しているか確認

#### 6. OAuth 認証エラー

```
エラー: OAuth認証エラーが発生しました。
```

**解決方法:**

- コールバック URL が正しく設定されているか確認
- クライアント ID が正しく設定されているか確認

### デバッグ方法

#### コンソールログの確認

ブラウザの開発者ツールでコンソールを確認：

```javascript
// IEEE API リクエストURL
IEEE API Request URL: https://ieeexplore.ieee.org/rest/search?apikey=...

// 認証方法
IEEE Service auth method: API Key

// 検索結果
Found X relevant papers from IEEE
```

#### 環境変数の確認

```javascript
// ブラウザコンソールで実行
console.log(import.meta.env.VITE_IEEE_API_KEY);
console.log(import.meta.env.VITE_IEEE_CLIENT_ID);
```

## セキュリティ注意事項

### API キーの保護

- API キーをソースコードに直接記述しない
- `.env.local` ファイルを `.gitignore` に追加
- 本番環境では環境変数を使用

### OAuth 認証の保護

- クライアント ID をソースコードに直接記述しない
- アクセストークンを適切に管理
- コールバック URL を正しく設定

### 推奨設定

```bash
# .gitignore に追加
.env.local
.env.production.local
```

## サポート

### IEEE API サポート

- [IEEE API Documentation](https://developer.ieee.org/docs)
- [IEEE API Portal](https://developer.ieee.org/)

### プロジェクトサポート

問題が発生した場合は、以下を確認してください：

1. IEEE API キーまたはクライアント ID が正しく設定されているか
2. ネットワーク接続が正常か
3. ブラウザのコンソールでエラーメッセージを確認
4. プロキシ設定が正しく動作しているか（開発環境）
5. コールバック URL が正しく設定されているか（OAuth 認証の場合）
