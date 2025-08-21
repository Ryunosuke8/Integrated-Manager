# Integrated Manager 設計書（Google Drive + AI連携）

## 目的
Google Drive上で管理する **8フォルダ構成のプロジェクト管理環境** において、
- A: フォルダ内データの差分検出（効率的・安価）
- B: AIによる自動生成・更新作業（ユーザー手動ボタン実行）
を実現する。

---

## フォルダ構成とAI処理方針

### 1. Document
- **内容**: プロジェクト全般のドキュメント（ナラティブ、自分の考え、方向性制御用メモ）
- **AI処理**:
  - 要約・章立て整理
  - 分岐・方向性を自動抽出してマインドマップ形式の概要を生成
  - 重複・冗長部分の検出と統合提案

### 2. Implementation
- **内容**: 実装関連（GitHubリポジトリやコード、設計図）
- **AI処理**:
  - GitHub APIと連携して最新コードの変更概要を取得
  - 実装仕様書の自動生成
  - コードからアーキテクチャ図作成（Mermaid等）

### 3. Presentation
- **内容**: プロジェクトの説明資料、スライド
- **AI処理**:
  - Document・Implementationからプレゼン用スライド草案作成
  - 図表の自動生成（円グラフ、棒グラフ、構造図）
  - 外部サーチ情報（Web/Twitter）を要約して資料化

### 4. Reaching
- **内容**: 学会・イベント・発表機会の情報
- **AI処理**:
  - Google SheetやCSVでの管理
  - 各イベントの要約（場所、日程、応募条件）
  - 関連性スコア付け（プロジェクトテーマとの一致度）

### 5. Business
- **内容**: 商業展開案、ビジネスモデル、マーケ戦略
- **AI処理**:
  - ビジネスキャンバスの自動生成
  - 市場調査レポートの要約
  - 収益モデルのパターン提案

### 6. Academia
- **内容**: 論文・研究背景資料
- **AI処理**:
  - 引用候補論文の要約（タイトル、著者、要旨、リンク）
  - 技術的背景（Background）を章立て整理
  - 図・画像の分類整理
  - トピック分類マップ作成

### 7. Paper
- **内容**: 論文草案（複数レパートリー）、Overleafフォーマット
- **AI処理**:
  - Academiaフォルダから引用文献・背景を抽出
  - 論文テンプレート（LaTeX）に自動挿入
  - 図表生成と埋め込み

### 8. Material
- **内容**: 汎用画像・図・素材置き場
- **AI処理**:
  - 自動タグ付け（検索性向上）
  - 解像度変換・フォーマット変換
  - 使用履歴の記録（どの資料で使ったか）

---

## 更新フロー
1. ユーザーがUI上の「更新」ボタンを押す
2. Google Drive APIで全フォルダの`modifiedTime`を取得
3. 差分検出モジュールが変更/追加ファイルを抽出
4. 対象フォルダごとのAI処理を実行
5. 結果をGoogle Driveに保存（必要に応じて別フォルダに生成物）

---

## 差分検出ロジック（擬似コード）
```python
def detect_changes(current_scan, last_scan):
    changes = []
    last_files = {f["id"]: f for f in last_scan["files"]}
    for f in current_scan["files"]:
        if f["id"] not in last_files or f["modifiedTime"] > last_files[f["id"]]["modifiedTime"]:
            changes.append(f)
    return changes


