/**
 * Google Custom Search API サービス
 * Google Custom Search APIを使用して外部情報検索を実行
 */
class GoogleSearchService {
  constructor() {
    this.config = this.loadConfig();
    this.baseUrl = 'https://www.googleapis.com/customsearch/v1';
    console.log('Google Search Service initialized');
  }

  /**
   * 設定を読み込み
   */
  loadConfig() {
    try {
      const savedConfig = localStorage.getItem('google_search_config');
      return savedConfig ? JSON.parse(savedConfig) : null;
    } catch (error) {
      console.error('Failed to load Google Search config:', error);
      return null;
    }
  }

  /**
   * 設定が有効かチェック
   */
  isConfigured() {
    return this.config && 
           this.config.apiKey && 
           this.config.apiKey.trim() !== '' && 
           this.config.engineId && 
           this.config.engineId.trim() !== '';
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig) {
    this.config = newConfig;
    localStorage.setItem('google_search_config', JSON.stringify(newConfig));
  }

  /**
   * 検索クエリを構築
   * @param {string} query - 検索クエリ
   * @param {Object} options - 検索オプション
   * @returns {Object} 検索パラメータ
   */
  buildSearchQuery(query, options = {}) {
    if (!query || query.trim() === '') {
      throw new Error('検索クエリが指定されていません');
    }

    console.log('Building Google Custom Search query:', query);

    const {
      num = 10,           // 取得件数
      start = 1,          // 開始位置
      lr = 'lang_ja',     // 言語制限
      safe = 'medium',    // セーフサーチ
      fileType = '',      // ファイルタイプ
      siteSearch = '',    // サイト制限
      dateRestrict = ''   // 日付制限
    } = options;

    const searchParams = {
      key: this.config.apiKey,
      cx: this.config.engineId,
      q: query,
      num: Math.min(num, 10), // 1回のリクエストで最大10件
      start,
      lr,
      safe
    };

    // オプションパラメータを追加
    if (fileType) searchParams.fileType = fileType;
    if (siteSearch) searchParams.siteSearch = siteSearch;
    if (dateRestrict) searchParams.dateRestrict = dateRestrict;

    console.log('Built Google Search params:', searchParams);
    return searchParams;
  }

  /**
   * Google Custom Search API にリクエストを送信
   * @param {Object} searchParams - 検索パラメータ
   * @returns {Promise<Object>} API レスポンス
   */
  async searchWeb(searchParams) {
    if (!this.isConfigured()) {
      throw new Error('Google Custom Search API設定が完了していません。設定画面でAPIキーとエンジンIDを入力してください。');
    }

    try {
      console.log('Google Search params received:', searchParams);

      const url = new URL(this.baseUrl);
      
      // 検索パラメータをURLに追加
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value && value !== '') {
          url.searchParams.append(key, value);
          console.log(`Added param: ${key} = ${value}`);
        }
      });

      console.log('Final Google Custom Search API Request URL:', url.toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Google Custom Search API の利用制限に達しました。APIキーまたは検索エンジンIDを確認してください。');
        } else if (response.status === 400) {
          throw new Error('Google Custom Search API のリクエストが不正です。パラメータを確認してください。');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // API エラーレスポンスのチェック
      if (data.error) {
        throw new Error(data.error.message || 'Google Custom Search API エラーが発生しました');
      }

      return data;

    } catch (error) {
      console.error('Google Custom Search API search failed:', error);
      throw error;
    }
  }

  /**
   * Google Search API レスポンスを標準形式に変換
   * @param {Object} googleResponse - Google API レスポンス
   * @param {string} originalQuery - 元の検索クエリ
   * @returns {Array} 標準化された検索結果データの配列
   */
  transformGoogleResponse(googleResponse, originalQuery) {
    if (!googleResponse.items || googleResponse.items.length === 0) {
      return [];
    }

    return googleResponse.items.map((item, index) => {
      // 関連度スコアを計算（順位と内容から）
      const relevanceScore = this.calculateRelevanceScore(item, originalQuery, index);
      
      return {
        title: item.title || 'タイトルなし',
        url: item.link || '',
        snippet: item.snippet || '説明なし',
        displayLink: item.displayLink || '',
        formattedUrl: item.formattedUrl || '',
        cacheId: item.cacheId || '',
        relevanceScore: relevanceScore,
        searchRank: index + 1,
        source: 'Google Custom Search'
      };
    });
  }

  /**
   * 関連度スコアを計算
   * @param {Object} item - Google 検索結果アイテム
   * @param {string} query - 検索クエリ
   * @param {number} index - 結果の順位
   * @returns {number} 関連度スコア (0-1)
   */
  calculateRelevanceScore(item, query, index) {
    let score = 0;
    const title = (item.title || '').toLowerCase();
    const snippet = (item.snippet || '').toLowerCase();
    const queryLower = query.toLowerCase();
    
    // クエリキーワードでの一致
    const queryWords = queryLower.split(/\s+/);
    queryWords.forEach(word => {
      if (word.length > 2) { // 2文字以下は無視
        // タイトルでの一致（重み: 3）
        if (title.includes(word)) {
          score += 3;
        }
        
        // スニペットでの一致（重み: 1）
        if (snippet.includes(word)) {
          score += 1;
        }
      }
    });

    // 順位による調整（上位ほど高スコア）
    const rankBonus = Math.max(0, (10 - index) / 10);
    score += rankBonus * 2;

    // スコアを0-1の範囲に正規化
    const maxPossibleScore = queryWords.length * 4 + 2;
    return maxPossibleScore > 0 ? Math.min(score / maxPossibleScore, 1) : 0;
  }

  /**
   * 複数のクエリで検索を実行
   * @param {Array} queries - 検索クエリの配列
   * @param {Object} options - 検索オプション
   * @returns {Promise<Array>} 統合された検索結果
   */
  async searchWithMultipleQueries(queries, options = {}) {
    const allResults = [];
    const seenUrls = new Set(); // 重複除去用

    for (const query of queries) {
      try {
        const searchParams = this.buildSearchQuery(query, options);
        const response = await this.searchWeb(searchParams);
        const transformedResults = this.transformGoogleResponse(response, query);
        
        // 重複を除去して結果を追加
        transformedResults.forEach(result => {
          if (!seenUrls.has(result.url)) {
            seenUrls.add(result.url);
            allResults.push(result);
          }
        });

        // API レート制限を考慮して少し待機
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Google Search failed for query "${query}":`, error);
        // エラーが発生しても他のクエリでの検索を継続
      }
    }

    // 関連度スコアでソート
    return allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * 単一の検索を実行
   * @param {string} query - 検索クエリ
   * @param {Object} options - 検索オプション
   * @returns {Promise<Array>} 検索結果
   */
  async searchSimple(query, options = {}) {
    const searchParams = this.buildSearchQuery(query, options);
    const response = await this.searchWeb(searchParams);
    return this.transformGoogleResponse(response, query);
  }

  /**
   * API設定のテスト
   */
  async testConnection() {
    try {
      const searchParams = this.buildSearchQuery('test', { num: 1 });
      const response = await this.searchWeb(searchParams);
      return response && response.items && response.items.length > 0;
    } catch (error) {
      console.error('Google Search API connection test failed:', error);
      return false;
    }
  }
}

// シングルトンインスタンスをエクスポート
const googleSearchService = new GoogleSearchService();
export default googleSearchService;