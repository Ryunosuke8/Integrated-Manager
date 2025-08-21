/**
 * Bing Search API サービス
 * Microsoft Bing Search APIを使用して外部情報検索を実行
 */
class BingSearchService {
  constructor() {
    this.config = this.loadConfig();
    this.baseUrl = 'https://api.bing.microsoft.com/v7.0/search';
    console.log('Bing Search Service initialized');
  }

  /**
   * 設定を読み込み
   */
  loadConfig() {
    try {
      const savedConfig = localStorage.getItem('bing_search_config');
      return savedConfig ? JSON.parse(savedConfig) : null;
    } catch (error) {
      console.error('Failed to load Bing Search config:', error);
      return null;
    }
  }

  /**
   * 設定が有効かチェック
   */
  isConfigured() {
    return this.config && 
           this.config.apiKey && 
           this.config.apiKey.trim() !== '';
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig) {
    this.config = newConfig;
    localStorage.setItem('bing_search_config', JSON.stringify(newConfig));
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

    console.log('Building Bing Search query:', query);

    const {
      count = 10,           // 取得件数（最大50）
      offset = 0,           // オフセット
      mkt = 'ja-JP',        // マーケット
      safeSearch = 'Moderate', // セーフサーチ
      textDecorations = true,  // テキスト装飾
      textFormat = 'HTML',     // テキストフォーマット
      freshness = '',          // 新しさ（Day, Week, Month）
      answerCount = 3,         // 回答数
      promote = '',            // プロモート（Videos, Images, News, etc.）
      responseFilter = ''      // レスポンスフィルター
    } = options;

    const searchParams = {
      q: query,
      count: Math.min(count, 50), // 最大50件
      offset,
      mkt,
      safeSearch,
      textDecorations,
      textFormat,
      answerCount
    };

    // オプションパラメータを追加
    if (freshness) searchParams.freshness = freshness;
    if (promote) searchParams.promote = promote;
    if (responseFilter) searchParams.responseFilter = responseFilter;

    console.log('Built Bing Search params:', searchParams);
    return searchParams;
  }

  /**
   * Bing Search API にリクエストを送信
   * @param {Object} searchParams - 検索パラメータ
   * @returns {Promise<Object>} API レスポンス
   */
  async searchWeb(searchParams) {
    if (!this.isConfigured()) {
      throw new Error('Bing Search API設定が完了していません。設定画面でAPIキーを入力してください。');
    }

    try {
      console.log('Bing Search params received:', searchParams);

      const url = new URL(this.baseUrl);
      
      // 検索パラメータをURLに追加
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          url.searchParams.append(key, value);
          console.log(`Added param: ${key} = ${value}`);
        }
      });

      console.log('Final Bing Search API Request URL:', url.toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Bing Search API の認証に失敗しました。APIキーを確認してください。');
        } else if (response.status === 403) {
          throw new Error('Bing Search API の利用制限に達しました。サブスクリプションを確認してください。');
        } else if (response.status === 429) {
          throw new Error('Bing Search API のレート制限に達しました。しばらく待ってから再試行してください。');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // API エラーレスポンスのチェック
      if (data.errors && data.errors.length > 0) {
        throw new Error(data.errors[0].message || 'Bing Search API エラーが発生しました');
      }

      return data;

    } catch (error) {
      console.error('Bing Search API search failed:', error);
      
      // CORSエラーの場合は特別なメッセージを表示
      if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
        console.warn('CORS error detected, Bing Search API may not be accessible from browser');
        throw new Error('Bing Search API is not accessible due to CORS restrictions. Please use a proxy server or backend service.');
      }
      
      throw error;
    }
  }

  /**
   * Bing Search API レスポンスを標準形式に変換
   * @param {Object} bingResponse - Bing API レスポンス
   * @param {string} originalQuery - 元の検索クエリ
   * @returns {Array} 標準化された検索結果データの配列
   */
  transformBingResponse(bingResponse, originalQuery) {
    if (!bingResponse.webPages || !bingResponse.webPages.value || bingResponse.webPages.value.length === 0) {
      return [];
    }

    return bingResponse.webPages.value.map((item, index) => {
      // 関連度スコアを計算（順位と内容から）
      const relevanceScore = this.calculateRelevanceScore(item, originalQuery, index);
      
      return {
        title: item.name || 'タイトルなし',
        url: item.url || '',
        snippet: item.snippet || '説明なし',
        displayLink: this.extractDomainFromUrl(item.url),
        formattedUrl: item.displayUrl || item.url || '',
        dateLastCrawled: item.dateLastCrawled || '',
        relevanceScore: relevanceScore,
        searchRank: index + 1,
        source: 'Bing Search',
        deepLinks: item.deepLinks || []
      };
    });
  }

  /**
   * URLからドメインを抽出
   * @param {string} url - URL
   * @returns {string} ドメイン名
   */
  extractDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  }

  /**
   * 関連度スコアを計算
   * @param {Object} item - Bing 検索結果アイテム
   * @param {string} query - 検索クエリ
   * @param {number} index - 結果の順位
   * @returns {number} 関連度スコア (0-1)
   */
  calculateRelevanceScore(item, query, index) {
    let score = 0;
    const title = (item.name || '').toLowerCase();
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

    // ディープリンクがある場合はボーナス
    if (item.deepLinks && item.deepLinks.length > 0) {
      score += 0.5;
    }

    // スコアを0-1の範囲に正規化
    const maxPossibleScore = queryWords.length * 4 + 2.5;
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
        const transformedResults = this.transformBingResponse(response, query);
        
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
        console.error(`Bing Search failed for query "${query}":`, error);
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
    return this.transformBingResponse(response, query);
  }

  /**
   * ニュース検索
   * @param {string} query - 検索クエリ
   * @param {Object} options - 検索オプション
   * @returns {Promise<Array>} ニュース検索結果
   */
  async searchNews(query, options = {}) {
    const newsUrl = 'https://api.bing.microsoft.com/v7.0/news/search';
    
    const searchParams = {
      q: query,
      count: options.count || 10,
      offset: options.offset || 0,
      mkt: options.mkt || 'ja-JP',
      safeSearch: options.safeSearch || 'Moderate',
      textFormat: options.textFormat || 'HTML'
    };

    if (options.freshness) searchParams.freshness = options.freshness;
    if (options.category) searchParams.category = options.category;

    try {
      const url = new URL(newsUrl);
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          url.searchParams.append(key, value);
        }
      });

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.value || data.value.length === 0) {
        return [];
      }

      return data.value.map((item, index) => ({
        title: item.name || 'タイトルなし',
        url: item.url || '',
        snippet: item.description || '説明なし',
        datePublished: item.datePublished || '',
        provider: item.provider?.[0]?.name || 'Unknown',
        category: item.category || 'General',
        searchRank: index + 1,
        source: 'Bing News'
      }));

    } catch (error) {
      console.error('Bing News search failed:', error);
      throw error;
    }
  }

  /**
   * API設定のテスト
   */
  async testConnection() {
    try {
      const searchParams = this.buildSearchQuery('test', { count: 1 });
      const response = await this.searchWeb(searchParams);
      return response && response.webPages && response.webPages.value && response.webPages.value.length > 0;
    } catch (error) {
      console.error('Bing Search API connection test failed:', error);
      return false;
    }
  }
}

// シングルトンインスタンスをエクスポート
const bingSearchService = new BingSearchService();
export default bingSearchService;