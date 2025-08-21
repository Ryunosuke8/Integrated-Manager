import { IEEE_CONFIG, IEEE_ERROR_MESSAGES } from '../config/ieeeConfig.js';

/**
 * IEEE Explore API サービス
 * IEEE Xplore Digital Library APIを使用して論文検索を実行
 */
class IEEEService {
  constructor() {
    this.apiKey = this.getApiKey();
    this.accessToken = this.getAccessToken();
    
    // 開発環境ではプロキシを使用、本番環境では直接APIを使用
    this.baseUrl = import.meta.env.DEV 
      ? '/ieee-api/rest/search'
      : IEEE_CONFIG.BASE_URL;
    
    // デバッグ用：ベースURLをログ出力
    console.log('IEEE Service initialized with baseUrl:', this.baseUrl);
    console.log('IEEE Service auth method:', this.apiKey ? 'API Key' : 'OAuth');
  }

  /**
   * API キーを取得（ローカルストレージから優先）
   */
  getApiKey() {
    // ローカルストレージからIEEE設定を読み込み
    const savedConfig = localStorage.getItem('ieee_config');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      if (config.apiKey) {
        return config.apiKey;
      }
    }
    
    // 環境変数から取得
    return IEEE_CONFIG.API_KEY;
  }

  /**
   * アクセストークンを取得（OAuth認証用）
   */
  getAccessToken() {
    const savedConfig = localStorage.getItem('ieee_config');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      if (config.accessToken) {
        return config.accessToken;
      }
    }
    return null;
  }

  /**
   * API キーを更新
   */
  updateApiKey(newApiKey) {
    this.apiKey = newApiKey;
  }

  /**
   * アクセストークンを更新
   */
  updateAccessToken(newAccessToken) {
    this.accessToken = newAccessToken;
  }

  /**
   * 認証情報の検証
   */
  validateAuth() {
    if (!this.apiKey && !this.accessToken) {
      throw new Error(IEEE_ERROR_MESSAGES.API_KEY_MISSING);
    }
    return true;
  }

  /**
   * 検索クエリを構築
   * @param {Array} keywords - 検索キーワードの配列
   * @param {Object} options - 検索オプション
   * @returns {string} 検索クエリ文字列
   */
  buildSearchQuery(keywords, options = {}) {
    if (!keywords || keywords.length === 0) {
      throw new Error('検索キーワードが指定されていません');
    }

    console.log('Building search query for keywords:', keywords);

    const {
      searchField = IEEE_CONFIG.SEARCH_FIELDS.ALL,
      yearRange = '',
      contentTypes = IEEE_CONFIG.CONTENT_TYPES.CONFERENCES + ',' + IEEE_CONFIG.CONTENT_TYPES.JOURNALS,
      maxRecords = IEEE_CONFIG.DEFAULT_PARAMS.max_records
    } = options;

    // キーワードを結合してクエリを作成（日本語キーワードを適切に処理）
    const keywordQuery = keywords.map(keyword => {
      // キーワードが既に引用符で囲まれている場合はそのまま使用
      if (keyword.startsWith('"') && keyword.endsWith('"')) {
        return keyword;
      }
      // 日本語キーワードは引用符で囲む
      return `"${keyword}"`;
    }).join(' OR ');
    
    console.log('Keyword query:', keywordQuery);
    
    // 検索フィールドに応じてクエリを構築
    let queryText = '';
    switch (searchField) {
      case IEEE_CONFIG.SEARCH_FIELDS.TITLE:
        queryText = `"Article Title":(${keywordQuery})`;
        break;
      case IEEE_CONFIG.SEARCH_FIELDS.ABSTRACT:
        queryText = `"Abstract":(${keywordQuery})`;
        break;
      case IEEE_CONFIG.SEARCH_FIELDS.KEYWORDS:
        queryText = `"Author Keywords":(${keywordQuery})`;
        break;
      case IEEE_CONFIG.SEARCH_FIELDS.AUTHORS:
        queryText = `"Authors":(${keywordQuery})`;
        break;
      case IEEE_CONFIG.SEARCH_FIELDS.PUBLICATION:
        queryText = `"Publication Title":(${keywordQuery})`;
        break;
      default:
        queryText = keywordQuery;
    }

    const searchParams = {
      queryText,
      search_field: searchField,
      year_range: yearRange,
      content_type: contentTypes,
      max_records: maxRecords,
      sort_field: IEEE_CONFIG.SORT_FIELDS.RELEVANCE
    };

    console.log('Built search params:', searchParams);
    return searchParams;
  }

  /**
   * IEEE API にリクエストを送信
   * @param {Object} searchParams - 検索パラメータ
   * @returns {Promise<Object>} API レスポンス
   */
  async searchPapers(searchParams) {
    try {
      this.validateAuth();

      // デバッグ用：検索パラメータをログ出力
      console.log('Search params received:', searchParams);

      let url;
      if (import.meta.env.DEV) {
        // 開発環境ではプロキシを使用
        console.log('Using proxy URL with origin:', window.location.origin);
        url = new URL(this.baseUrl, window.location.origin);
      } else {
        // 本番環境では直接APIを使用
        console.log('Using direct API URL');
        url = new URL(this.baseUrl);
      }
      
      // 認証情報を追加
      if (this.apiKey) {
        // APIキー認証
        url.searchParams.append('apikey', this.apiKey);
        console.log('Using API Key authentication');
      }
      
      // 検索パラメータをURLに追加
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value && value !== '') {
          url.searchParams.append(key, value);
          console.log(`Added param: ${key} = ${value}`);
        }
      });

      console.log('Final IEEE API Request URL:', url.toString());

      // リクエストヘッダーを設定
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };

      // OAuth認証の場合はアクセストークンをヘッダーに追加
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        console.log('Using OAuth authentication');
      }

      // IEEE APIはGETメソッドを使用
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // API エラーレスポンスのチェック
      if (data.error) {
        throw new Error(data.error.message || 'IEEE API エラーが発生しました');
      }

      return data;

    } catch (error) {
      console.error('IEEE API search failed:', error);
      
      // URL構築エラーの場合は特別なメッセージを表示
      if (error.message.includes('Invalid URL')) {
        console.error('URL construction failed. Base URL:', this.baseUrl);
        console.error('Search params:', searchParams);
        throw new Error('URL construction failed. Please check the base URL and search parameters.');
      }
      
      // CORSエラーの場合は特別なメッセージを表示
      if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
        console.warn('CORS error detected, IEEE API may not be accessible from browser');
        throw new Error('IEEE API is not accessible due to CORS restrictions. Please use a proxy server or backend service.');
      }
      
      // エラーメッセージを適切に処理
      if (error.message.includes('401')) {
        throw new Error(IEEE_ERROR_MESSAGES.API_KEY_INVALID);
      } else if (error.message.includes('429')) {
        throw new Error(IEEE_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
      } else if (error.message.includes('fetch')) {
        throw new Error(IEEE_ERROR_MESSAGES.NETWORK_ERROR);
      } else {
        throw error;
      }
    }
  }

  /**
   * IEEE API レスポンスを標準形式に変換
   * @param {Object} ieeeResponse - IEEE API レスポンス
   * @param {Array} originalKeywords - 元の検索キーワード
   * @returns {Array} 標準化された論文データの配列
   */
  transformIEEEResponse(ieeeResponse, originalKeywords) {
    if (!ieeeResponse.articles || ieeeResponse.articles.length === 0) {
      return [];
    }

    return ieeeResponse.articles.map(article => {
      // 関連度スコアを計算
      const relevanceScore = this.calculateRelevanceScore(article, originalKeywords);
      
      // 著者情報を処理
      const authors = this.extractAuthors(article.authors);
      
      // キーワードを抽出
      const keywords = this.extractKeywords(article);
      
      // ページ情報を処理
      const pages = this.extractPageInfo(article);
      
      return {
        title: article.title || 'タイトルなし',
        authors: authors,
        year: parseInt(article.publication_year) || new Date().getFullYear(),
        journal: article.publication_title || 'IEEE',
        url: this.buildIEEEUrl(article),
        abstract: article.abstract || '概要なし',
        keywords: keywords,
        relevanceScore: relevanceScore,
        doi: article.doi || '',
        volume: article.volume || '',
        issue: article.issue || '',
        pages: pages,
        publisher: 'IEEE',
        content_type: article.content_type || '',
        article_number: article.article_number || ''
      };
    });
  }

  /**
   * 関連度スコアを計算
   * @param {Object} article - IEEE 論文オブジェクト
   * @param {Array} keywords - 検索キーワード
   * @returns {number} 関連度スコア (0-1)
   */
  calculateRelevanceScore(article, keywords) {
    let score = 0;
    const title = (article.title || '').toLowerCase();
    const abstract = (article.abstract || '').toLowerCase();
    const articleKeywords = this.extractKeywords(article).map(k => k.toLowerCase());

    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      
      // タイトルでの一致（重み: 3）
      if (title.includes(keywordLower)) {
        score += 3;
      }
      
      // 抽象での一致（重み: 2）
      if (abstract.includes(keywordLower)) {
        score += 2;
      }
      
      // キーワードでの一致（重み: 4）
      if (articleKeywords.some(k => k.includes(keywordLower))) {
        score += 4;
      }
    });

    // スコアを0-1の範囲に正規化（最大スコア: キーワード数 * 9）
    const maxPossibleScore = keywords.length * 9;
    return maxPossibleScore > 0 ? Math.min(score / maxPossibleScore, 1) : 0;
  }

  /**
   * 著者情報を抽出・整形
   * @param {Array} authors - IEEE 著者配列
   * @returns {string} 著者文字列
   */
  extractAuthors(authors) {
    if (!authors || !Array.isArray(authors)) {
      return '著者情報なし';
    }

    return authors
      .map(author => author.preferred_name || author.full_name || author)
      .filter(author => author && author.trim() !== '')
      .join(', ');
  }

  /**
   * キーワードを抽出
   * @param {Object} article - IEEE 論文オブジェクト
   * @returns {Array} キーワード配列
   */
  extractKeywords(article) {
    const keywords = [];

    // Author Keywords
    if (article.author_keywords && Array.isArray(article.author_keywords)) {
      keywords.push(...article.author_keywords);
    }

    // Index Terms
    if (article.index_terms) {
      Object.values(article.index_terms).forEach(terms => {
        if (Array.isArray(terms)) {
          keywords.push(...terms);
        }
      });
    }

    // IEEE Terms
    if (article.ieee_terms && Array.isArray(article.ieee_terms)) {
      keywords.push(...article.ieee_terms);
    }

    return [...new Set(keywords)].filter(keyword => keyword && keyword.trim() !== '');
  }

  /**
   * ページ情報を抽出
   * @param {Object} article - IEEE 論文オブジェクト
   * @returns {string} ページ情報文字列
   */
  extractPageInfo(article) {
    const startPage = article.start_page || '';
    const endPage = article.end_page || '';
    
    if (startPage && endPage) {
      return `${startPage}-${endPage}`;
    } else if (startPage) {
      return startPage;
    } else if (article.article_number) {
      return `Article ${article.article_number}`;
    }
    
    return '';
  }

  /**
   * IEEE 論文のURLを構築
   * @param {Object} article - IEEE 論文オブジェクト
   * @returns {string} IEEE 論文URL
   */
  buildIEEEUrl(article) {
    if (article.pdf_url) {
      return article.pdf_url;
    }
    
    if (article.doi) {
      return `https://doi.org/${article.doi}`;
    }
    
    // IEEE Xplore の基本URL
    return `https://ieeexplore.ieee.org/document/${article.article_number || ''}`;
  }

  /**
   * 複数のキーワードセットで検索を実行
   * @param {Array} keywordSets - キーワードセットの配列
   * @param {Object} options - 検索オプション
   * @returns {Promise<Array>} 統合された検索結果
   */
  async searchWithMultipleKeywordSets(keywordSets, options = {}) {
    const allResults = [];
    const seenDois = new Set(); // 重複除去用

    for (const keywords of keywordSets) {
      try {
        const searchParams = this.buildSearchQuery(keywords, options);
        const response = await this.searchPapers(searchParams);
        const transformedResults = this.transformIEEEResponse(response, keywords);
        
        // 重複を除去して結果を追加
        transformedResults.forEach(paper => {
          if (paper.doi && !seenDois.has(paper.doi)) {
            seenDois.add(paper.doi);
            allResults.push(paper);
          } else if (!paper.doi) {
            // DOIがない場合はタイトルで重複チェック
            const titleExists = allResults.some(existing => 
              existing.title.toLowerCase() === paper.title.toLowerCase()
            );
            if (!titleExists) {
              allResults.push(paper);
            }
          }
        });

        // API レート制限を考慮して少し待機
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Search failed for keywords [${keywords.join(', ')}]:`, error);
        // エラーが発生しても他のキーワードセットでの検索を継続
      }
    }

    // 関連度スコアでソート
    return allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}

// シングルトンインスタンスをエクスポート
const ieeeService = new IEEEService();
export default ieeeService;
