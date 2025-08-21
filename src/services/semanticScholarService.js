/**
 * Semantic Scholar API サービス
 * Semantic Scholar APIを使用して論文検索を実行
 * 参考: https://zenn.dev/soybeans_yam/articles/9f6a48d4e029f3
 */
class SemanticScholarService {
  constructor() {
    this.baseUrl = 'https://api.semanticscholar.org/graph/v1';
    console.log('Semantic Scholar Service initialized');
  }

  /**
   * 検索クエリを構築
   * @param {Array} keywords - 検索キーワードの配列
   * @param {Object} options - 検索オプション
   * @returns {Object} 検索パラメータ
   */
  buildSearchQuery(keywords, options = {}) {
    if (!keywords || keywords.length === 0) {
      throw new Error('検索キーワードが指定されていません');
    }

    console.log('Building Semantic Scholar search query for keywords:', keywords);

    const {
      limit = 20,
      yearRange = '',
      fields = 'title,abstract,venue,externalIds,fieldsOfStudy,year,authors,citationCount,url'
    } = options;

    // キーワードを結合してクエリを作成
    const query = keywords.join(' ');

    const searchParams = {
      query,
      limit,
      fields
    };

    // 年範囲フィルターを追加（Semantic Scholar APIの制限により、クエリに含める）
    if (yearRange) {
      const [startYear, endYear] = yearRange.split('-');
      if (startYear && endYear) {
        searchParams.query += ` year:${startYear}-${endYear}`;
      }
    }

    console.log('Built Semantic Scholar search params:', searchParams);
    return searchParams;
  }

  /**
   * Semantic Scholar API にリクエストを送信
   * @param {Object} searchParams - 検索パラメータ
   * @returns {Promise<Object>} API レスポンス
   */
  async searchPapers(searchParams) {
    try {
      console.log('Search params received for Semantic Scholar:', searchParams);

      const url = new URL(`${this.baseUrl}/paper/search`);
      
      // 検索パラメータをURLに追加
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value && value !== '') {
          url.searchParams.append(key, value);
          console.log(`Added param: ${key} = ${value}`);
        }
      });

      console.log('Final Semantic Scholar API Request URL:', url.toString());

      // 複数のCORSプロキシオプションを試行
      const proxyOptions = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url.toString())}`,
        `https://cors-anywhere.herokuapp.com/${url.toString()}`,
        `https://thingproxy.freeboard.io/fetch/${url.toString()}`
      ];
      
      let proxyUrl = proxyOptions[0]; // デフォルトで最初のプロキシを使用
      
      // リクエストヘッダーを設定
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': window.location.origin
      };

      // プロキシ経由でSemantic Scholar APIにアクセス
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('API rate limit exceeded. Please try again later.');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // API エラーレスポンスのチェック
      if (data.error) {
        throw new Error(data.error.message || 'Semantic Scholar API エラーが発生しました');
      }

      return data;

    } catch (error) {
      console.error('Semantic Scholar API search failed:', error);
      
      // プロキシエラーの場合は他のプロキシを試行
      if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
        console.warn('First proxy failed, trying alternative proxies...');
        return await this.tryAlternativeProxies(url.toString(), searchParams);
      }
      
      // エラーメッセージを適切に処理
      if (error.message.includes('429')) {
        throw new Error('API rate limit exceeded. Please try again later.');
      } else if (error.message.includes('fetch')) {
        throw new Error('Network error occurred while accessing Semantic Scholar API.');
      } else {
        throw error;
      }
    }
  }

  /**
   * 代替プロキシを試行
   * @param {string} originalUrl - 元のURL
   * @param {Object} searchParams - 検索パラメータ
   * @returns {Promise<Object>} API レスポンス
   */
  async tryAlternativeProxies(originalUrl, searchParams) {
    const proxyOptions = [
      `https://cors-anywhere.herokuapp.com/${originalUrl}`,
      `https://thingproxy.freeboard.io/fetch/${originalUrl}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`
    ];

    for (let i = 1; i < proxyOptions.length; i++) {
      try {
        console.log(`Trying proxy ${i + 1}: ${proxyOptions[i]}`);
        
        const response = await fetch(proxyOptions[i], {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Proxy ${i + 1} succeeded`);
          return data;
        }
      } catch (error) {
        console.warn(`Proxy ${i + 1} failed:`, error);
        continue;
      }
    }

    // すべてのプロキシが失敗した場合、直接APIを試行
    console.warn('All proxies failed, trying direct API access...');
    return await this.tryDirectAPIAccess(originalUrl, searchParams);
  }

  /**
   * 直接APIアクセスを試行（フォールバック）
   * @param {string} _originalUrl - 元のURL（未使用）
   * @param {Object} searchParams - 検索パラメータ
   * @returns {Promise<Object>} API レスポンス
   */
  async tryDirectAPIAccess(_originalUrl, searchParams) {
    try {
      const url = new URL(`${this.baseUrl}/paper/search`);
      
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value && value !== '') {
          url.searchParams.append(key, value);
        }
      });

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Direct API access failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Direct API access also failed:', error);
      throw new Error('Semantic Scholar API is not accessible. Please try using IEEE Xplore instead or check your internet connection.');
    }
  }

  /**
   * Semantic Scholar API レスポンスを標準形式に変換
   * @param {Object} scholarResponse - Semantic Scholar API レスポンス
   * @param {Array} originalKeywords - 元の検索キーワード
   * @returns {Array} 標準化された論文データの配列
   */
  transformScholarResponse(scholarResponse, originalKeywords) {
    if (!scholarResponse.data || scholarResponse.data.length === 0) {
      return [];
    }

    return scholarResponse.data.map(paper => {
      // 関連度スコアを計算
      const relevanceScore = this.calculateRelevanceScore(paper, originalKeywords);
      
      // 著者情報を処理
      const authors = this.extractAuthors(paper.authors);
      
      // キーワードを抽出
      const keywords = this.extractKeywords(paper);
      
      return {
        title: paper.title || 'タイトルなし',
        authors: authors,
        year: parseInt(paper.year) || new Date().getFullYear(),
        journal: paper.venue || 'Semantic Scholar',
        url: paper.url || '',
        abstract: paper.abstract || '概要なし',
        keywords: keywords,
        relevanceScore: relevanceScore,
        doi: paper.externalIds?.DOI || '',
        volume: '',
        issue: '',
        pages: '',
        publisher: 'Semantic Scholar',
        content_type: '',
        article_number: '',
        citationCount: paper.citationCount || 0,
        fieldsOfStudy: paper.fieldsOfStudy || []
      };
    });
  }

  /**
   * 関連度スコアを計算
   * @param {Object} paper - Semantic Scholar 論文オブジェクト
   * @param {Array} keywords - 検索キーワード
   * @returns {number} 関連度スコア (0-1)
   */
  calculateRelevanceScore(paper, keywords) {
    let score = 0;
    const title = (paper.title || '').toLowerCase();
    const abstract = (paper.abstract || '').toLowerCase();
    const fieldsOfStudy = (paper.fieldsOfStudy || []).map(f => f.toLowerCase());

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
      
      // 研究分野での一致（重み: 4）
      if (fieldsOfStudy.some(field => field.includes(keywordLower))) {
        score += 4;
      }
    });

    // 引用数によるボーナス（重み: 1）
    if (paper.citationCount) {
      score += Math.min(paper.citationCount / 100, 1);
    }

    // スコアを0-1の範囲に正規化（最大スコア: キーワード数 * 9 + 1）
    const maxPossibleScore = keywords.length * 9 + 1;
    return maxPossibleScore > 0 ? Math.min(score / maxPossibleScore, 1) : 0;
  }

  /**
   * 著者情報を抽出・整形
   * @param {Array} authors - Semantic Scholar 著者配列
   * @returns {string} 著者文字列
   */
  extractAuthors(authors) {
    if (!authors || !Array.isArray(authors)) {
      return '著者情報なし';
    }

    return authors
      .map(author => author.name || author)
      .filter(author => author && author.trim() !== '')
      .join(', ');
  }

  /**
   * キーワードを抽出
   * @param {Object} paper - Semantic Scholar 論文オブジェクト
   * @returns {Array} キーワード配列
   */
  extractKeywords(paper) {
    const keywords = [];

    // 研究分野をキーワードとして追加
    if (paper.fieldsOfStudy && Array.isArray(paper.fieldsOfStudy)) {
      keywords.push(...paper.fieldsOfStudy);
    }

    // タイトルから重要な単語を抽出
    if (paper.title) {
      const titleWords = paper.title
        .split(/\s+/)
        .filter(word => word.length > 3 && /^[a-zA-Z]+$/.test(word))
        .slice(0, 5); // 上位5つの単語
      keywords.push(...titleWords);
    }

    return [...new Set(keywords)].filter(keyword => keyword && keyword.trim() !== '');
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
        const transformedResults = this.transformScholarResponse(response, keywords);
        
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
        console.error(`Semantic Scholar search failed for keywords [${keywords.join(', ')}]:`, error);
        // エラーが発生しても他のキーワードセットでの検索を継続
      }
    }

    // 関連度スコアでソート
    return allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * 単一の検索を実行
   * @param {Array} keywords - 検索キーワード
   * @param {Object} options - 検索オプション
   * @returns {Promise<Array>} 検索結果
   */
  async searchPapersSimple(keywords, options = {}) {
    const searchParams = this.buildSearchQuery(keywords, options);
    const response = await this.searchPapers(searchParams);
    return this.transformScholarResponse(response, keywords);
  }
}

// シングルトンインスタンスをエクスポート
const semanticScholarService = new SemanticScholarService();
export default semanticScholarService;
