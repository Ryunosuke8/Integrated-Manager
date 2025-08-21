// Google Drive API設定
export const GOOGLE_DRIVE_CONFIG = {
  // Google Cloud Consoleで取得したAPIキー
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
  
  // Google Cloud Consoleで取得したクライアントID
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  
  // Google Cloud Consoleで取得したクライアントシークレット
  clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',
  
  // リダイレクトURI
  redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || 'http://localhost:5173/auth/callback',
  
  // スコープ
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file'
  ]
};

// パネルタイトルとフォルダ名のマッピング（Projectパネル用）
export const PANEL_FOLDER_MAPPING = {
  'Project': null  // nullの場合はIntegrated-Manager直下にプロジェクトを作成
};

// プロジェクトの共通フォルダ構造（AI処理対応）
export const PROJECT_FOLDER_STRUCTURE = [
  {
    name: 'Document',
    description: 'プロジェクト全般のドキュメント（ナラティブ、自分の考え、方向性制御用メモ）',
    icon: '📄',
    aiProcessing: ['要約・章立て整理', '分岐・方向性の自動抽出', '重複・冗長部分の検出と統合提案']
  },
  {
    name: 'Implementation',
    description: '実装関連（GitHubリポジトリやコード、設計図）',
    icon: '💻',
    aiProcessing: ['GitHub API連携での変更概要取得', '実装仕様書の自動生成', 'アーキテクチャ図作成']
  },
  {
    name: 'Presentation',
    description: 'プロジェクトの説明資料、スライド',
    icon: '📊',
    aiProcessing: ['スライド草案作成', '図表の自動生成', '外部サーチ情報の要約資料化']
  },
  {
    name: 'Reaching',
    description: '学会・イベント・発表機会の情報',
    icon: '🚀',
    aiProcessing: ['イベント要約', '関連性スコア付け', 'Google Sheet/CSV管理']
  },
  {
    name: 'Business',
    description: '商業展開案、ビジネスモデル、マーケ戦略',
    icon: '💼',
    aiProcessing: ['ビジネスキャンバス自動生成', '市場調査レポート要約', '収益モデル提案']
  },
  {
    name: 'Academia',
    description: '論文・研究背景資料',
    icon: '🎓',
    aiProcessing: ['引用候補論文要約', '技術的背景の章立て整理', 'トピック分類マップ作成']
  },
  {
    name: 'Paper',
    description: '論文草案（複数レパートリー）、Overleafフォーマット',
    icon: '📜',
    aiProcessing: ['引用文献・背景抽出', 'LaTeXテンプレート自動挿入', '図表生成と埋め込み']
  },
  {
    name: 'Material',
    description: '汎用画像・図・素材置き場',
    icon: '🧩',
    aiProcessing: ['自動タグ付け', '解像度・フォーマット変換', '使用履歴記録']
  }
]; 