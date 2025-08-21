/**
 * IEEE Explore API設定
 * IEEE Xplore Digital Library APIの設定とエンドポイント
 */

export const IEEE_CONFIG = {
  // IEEE Xplore API エンドポイント
  BASE_URL: 'https://ieeexplore.ieee.org/rest/search',
  
  // 代替エンドポイント（必要に応じて）
  ALTERNATIVE_URL: 'https://ieeexplore.ieee.org/rest/search',
  
  // API キー（環境変数から取得することを推奨）
  API_KEY: import.meta.env.VITE_IEEE_API_KEY || '',
  
  // OAuth認証設定
  OAUTH: {
    // コールバックURL（IEEE API Portalで設定したもの）
    CALLBACK_URL: 'http://localhost:5173/callback',
    
    // 認証エンドポイント
    AUTH_URL: 'https://ieeexplore.ieee.org/oauth/authorize',
    
    // トークンエンドポイント
    TOKEN_URL: 'https://ieeexplore.ieee.org/oauth/token',
    
    // クライアントID（IEEE API Portalで取得）
    CLIENT_ID: import.meta.env.VITE_IEEE_CLIENT_ID || '',
    
    // スコープ
    SCOPES: ['read']
  },
  
  // デフォルト検索パラメータ
  DEFAULT_PARAMS: {
    // 検索結果の最大件数
    max_records: 50,
    
    // 結果の並び順（関連度順）
    sort_field: 'relevance',
    
    // 検索対象フィールド
    queryText: '',
    
    // 出版年範囲（例：2020-2024）
    year_range: '',
    
    // コンテンツタイプ（論文、会議録など）
    content_type: 'Conferences,Journals',
    
    // 検索対象フィールド
    search_field: 'Search_All'
  },
  
  // 検索フィールドのオプション
  SEARCH_FIELDS: {
    ALL: 'Search_All',
    TITLE: 'Article_Title',
    ABSTRACT: 'Abstract',
    KEYWORDS: 'Author_Keywords',
    AUTHORS: 'Authors',
    PUBLICATION: 'Publication_Title'
  },
  
  // コンテンツタイプ
  CONTENT_TYPES: {
    CONFERENCES: 'Conferences',
    JOURNALS: 'Journals',
    BOOKS: 'Books',
    STANDARDS: 'Standards',
    EDUCATIONAL_COURSES: 'Educational_Courses'
  },
  
  // 並び順オプション
  SORT_FIELDS: {
    RELEVANCE: 'relevance',
    PUBLICATION_YEAR: 'publication_year',
    TITLE: 'article_title',
    AUTHORS: 'authors'
  }
};

/**
 * IEEE API エラーメッセージ
 */
export const IEEE_ERROR_MESSAGES = {
  API_KEY_MISSING: 'IEEE API キーまたはアクセストークンが設定されていません。環境変数 VITE_IEEE_API_KEY または IEEE API Portal での認証設定を確認してください。',
  API_KEY_INVALID: 'IEEE API キーが無効です。',
  ACCESS_TOKEN_INVALID: 'IEEE API アクセストークンが無効です。',
  RATE_LIMIT_EXCEEDED: 'API レート制限に達しました。しばらく待ってから再試行してください。',
  NETWORK_ERROR: 'ネットワークエラーが発生しました。インターネット接続を確認してください。',
  NO_RESULTS: '検索条件に一致する論文が見つかりませんでした。',
  INVALID_PARAMS: '検索パラメータが無効です。',
  OAUTH_ERROR: 'OAuth認証エラーが発生しました。IEEE API Portal での設定を確認してください。'
};

/**
 * IEEE API レスポンスの構造
 */
export const IEEE_RESPONSE_STRUCTURE = {
  // 成功レスポンス
  SUCCESS: {
    total_records: 0,
    total_searched: 0,
    articles: []
  },
  
  // 論文オブジェクトの構造
  ARTICLE: {
    title: '',
    authors: [],
    abstract: '',
    publication_year: '',
    publication_title: '',
    doi: '',
    pdf_url: '',
    article_number: '',
    start_page: '',
    end_page: '',
    volume: '',
    issue: '',
    keywords: [],
    index_terms: {},
    content_type: '',
    publisher: 'IEEE'
  }
};
