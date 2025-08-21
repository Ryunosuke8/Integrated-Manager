// Google Drive APIを直接使用するため、googleDriveServiceは不要

/**
 * Reaching Service
 * プロジェクトに関連する学会、展示会、イベント、機関などを検索・管理
 */
class ReachingService {
  constructor() {
    this.searchResults = [];
    this.savedResults = [];
    this.loadSavedResults();
  }

  /**
   * 保存された検索結果を読み込み
   */
  loadSavedResults() {
    try {
      const saved = localStorage.getItem('reaching_results');
      if (saved) {
        this.savedResults = JSON.parse(saved);
      }
    } catch (error) {
      console.error('保存された検索結果の読み込みに失敗:', error);
    }
  }

  /**
   * 検索結果を保存
   */
  saveResults() {
    try {
      localStorage.setItem('reaching_results', JSON.stringify(this.savedResults));
    } catch (error) {
      console.error('検索結果の保存に失敗:', error);
    }
  }

  /**
   * 学会・展示会・イベントを検索
   * @param {Object} searchParams - 検索パラメータ
   * @returns {Promise<Array>} 検索結果
   */
  async searchEvents(searchParams) {
    const {
      keywords = [],
      eventType = 'all', // 'conference', 'exhibition', 'workshop', 'all'
      year = new Date().getFullYear(),
      location = '',
      category = ''
    } = searchParams;
    
    // パラメータをログに出力（使用していることを示す）
    console.log('Event search params:', { keywords, eventType, year, location, category });

    console.log('Reaching検索開始:', searchParams);

    // 実際のAPI呼び出しをシミュレート（後で実際のAPIに置き換え）
    const mockResults = await this.getMockEventResults(searchParams);
    
    this.searchResults = mockResults;
    return mockResults;
  }

  /**
   * 関連機関・法人を検索
   * @param {Object} searchParams - 検索パラメータ
   * @returns {Promise<Array>} 検索結果
   */
  async searchOrganizations(searchParams) {
    const {
      keywords = [],
      orgType = 'all', // 'research', 'company', 'government', 'university', 'all'
      location = '',
      category = ''
    } = searchParams;
    
    // パラメータをログに出力（使用していることを示す）
    console.log('Organization search params:', { keywords, orgType, location, category });

    console.log('機関検索開始:', searchParams);

    // 実際のAPI呼び出しをシミュレート
    const mockResults = await this.getMockOrganizationResults(searchParams);
    
    this.searchResults = mockResults;
    return mockResults;
  }

  /**
   * 総合Web検索を実行
   * @param {Object} searchParams - 検索パラメータ
   * @returns {Promise<Array>} 検索結果
   */
  async searchWeb(searchParams) {
    const {
      keywords = [],
      searchType = 'all', // 'all', 'events', 'organizations', 'news'
      maxResults = 20
    } = searchParams;
    
    // パラメータをログに出力（使用していることを示す）
    console.log('Web search params:', { keywords, searchType, maxResults });

    console.log('総合Web検索開始:', searchParams);

    try {
      // 複数の検索エンジンから結果を取得
      const results = await Promise.allSettled([
        this.searchWithGoogle(searchParams),
        this.searchWithBing(searchParams),
        this.searchWithDuckDuckGo(searchParams)
      ]);

      // 結果を統合・重複除去
      const allResults = [];
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          allResults.push(...result.value);
        }
      });

      console.log('Raw search results:', allResults);

      // 重複除去とスコアリング
      const uniqueResults = this.deduplicateAndScore(allResults, keywords);
      
      // 結果を分類
      const categorizedResults = this.categorizeResults(uniqueResults);

      const finalResults = categorizedResults.slice(0, maxResults);
      console.log('Final search results:', finalResults);

      return finalResults;
    } catch (error) {
      console.error('総合Web検索に失敗:', error);
      // フォールバック：モックデータを返す
      const fallbackResults = await this.getMockEventResults(searchParams);
      console.log('Using fallback results:', fallbackResults);
      return fallbackResults;
    }
  }

  /**
   * Google Custom Search APIを使用
   */
  async searchWithGoogle(searchParams) {
    // 新しいgoogleSearchServiceを使用
    const googleSearchService = await import('./googleSearchService.js').then(m => m.default);
    
    if (!googleSearchService.isConfigured()) {
      console.warn('Google Search API credentials not configured');
      return [];
    }

    try {
      const query = this.buildSearchQuery(searchParams);
      const results = await googleSearchService.searchSimple(query, { num: 10 });
      return this.parseGoogleResults(results);
    } catch (error) {
      console.error('Google Search failed:', error);
      return [];
    }
  }

  /**
   * Bing Search APIを使用
   */
  async searchWithBing(searchParams) {
    // 新しいbingSearchServiceを使用
    const bingSearchService = await import('./bingSearchService.js').then(m => m.default);
    
    if (!bingSearchService.isConfigured()) {
      console.warn('Bing Search API credentials not configured');
      return [];
    }

    try {
      const query = this.buildSearchQuery(searchParams);
      const results = await bingSearchService.searchSimple(query, { count: 10 });
      return this.parseBingResults(results);
    } catch (error) {
      console.error('Bing Search failed:', error);
      return [];
    }
  }

  /**
   * DuckDuckGo Instant Answer APIを使用
   */
  async searchWithDuckDuckGo(searchParams) {
    try {
      const query = this.buildSearchQuery(searchParams);
      const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      );

      if (!response.ok) {
        throw new Error(`DuckDuckGo API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseDuckDuckGoResults(data);
    } catch (error) {
      console.error('DuckDuckGo Search failed:', error);
      return [];
    }
  }

  /**
   * 検索クエリを構築
   */
  buildSearchQuery(searchParams) {
    const { keywords = [], searchType = 'all' } = searchParams;
    
    let query = keywords.join(' ');
    
    // 検索タイプに応じてクエリを調整
    switch (searchType) {
      case 'events':
        query += ' (conference OR exhibition OR workshop OR symposium OR event)';
        break;
      case 'organizations':
        query += ' (research institute OR university OR company OR organization)';
        break;
      case 'news':
        query += ' (news OR latest OR recent OR 2024 OR 2025)';
        break;
      default:
        query += ' (conference OR exhibition OR research OR institute OR organization)';
    }

    return query;
  }

  /**
   * Google検索結果をパース（新しいGoogleSearchService用）
   */
  parseGoogleResults(items) {
    return items.map((item, index) => ({
      id: `google_${index}`,
      name: item.title,
      url: item.url,
      description: item.snippet,
      category: this.categorizeByContent(item.title + ' ' + item.snippet),
      location: this.extractLocation(item.title + ' ' + item.snippet),
      date: this.extractDate(item.title + ' ' + item.snippet),
      type: this.determineType(item.title + ' ' + item.snippet),
      relevance: 'medium',
      source: 'Google Search'
    }));
  }

  /**
   * Bing検索結果をパース（新しいBingSearchService用）
   */
  parseBingResults(items) {
    return items.map((item, index) => ({
      id: `bing_${index}`,
      name: item.title,
      url: item.url,
      description: item.snippet,
      category: this.categorizeByContent(item.title + ' ' + item.snippet),
      location: this.extractLocation(item.title + ' ' + item.snippet),
      date: this.extractDate(item.title + ' ' + item.snippet),
      type: this.determineType(item.title + ' ' + item.snippet),
      relevance: 'medium',
      source: 'Bing Search'
    }));
  }

  /**
   * DuckDuckGo検索結果をパース
   */
  parseDuckDuckGoResults(data) {
    const results = [];
    
    // Abstract
    if (data.Abstract) {
      results.push({
        id: 'ddg_abstract',
        name: data.AbstractSource || 'DuckDuckGo Result',
        url: data.AbstractURL,
        description: data.Abstract,
        category: this.categorizeByContent(data.Abstract),
        location: this.extractLocation(data.Abstract),
        date: this.extractDate(data.Abstract),
        type: this.determineType(data.Abstract),
        relevance: 'high',
        source: 'DuckDuckGo'
      });
    }

    // Related Topics
    if (data.RelatedTopics) {
      data.RelatedTopics.forEach((topic, index) => {
        if (topic.Text) {
          results.push({
            id: `ddg_topic_${index}`,
            name: topic.Text.split(' - ')[0] || topic.Text,
            url: topic.FirstURL,
            description: topic.Text,
            category: this.categorizeByContent(topic.Text),
            location: this.extractLocation(topic.Text),
            date: this.extractDate(topic.Text),
            type: this.determineType(topic.Text),
            relevance: 'medium',
            source: 'DuckDuckGo'
          });
        }
      });
    }

    return results;
  }

  /**
   * 結果の重複除去とスコアリング
   */
  deduplicateAndScore(results, keywords) {
    const seen = new Set();
    const scoredResults = [];

    results.forEach(result => {
      const key = `${result.name}_${result.url}`;
      if (!seen.has(key)) {
        seen.add(key);
        
        // スコアリング
        let score = 0;
        keywords.forEach(keyword => {
          const text = `${result.name} ${result.description}`.toLowerCase();
          if (text.includes(keyword.toLowerCase())) {
            score += 2;
          }
        });

        // タイトルにキーワードが含まれる場合はボーナス
        keywords.forEach(keyword => {
          if (result.name.toLowerCase().includes(keyword.toLowerCase())) {
            score += 1;
          }
        });

        scoredResults.push({
          ...result,
          score
        });
      }
    });

    // スコアでソート
    return scoredResults.sort((a, b) => b.score - a.score);
  }

  /**
   * 結果を分類
   */
  categorizeResults(results) {
    return results.map(result => {
      const category = this.categorizeByContent(result.name + ' ' + result.description);
      const type = this.determineType(result.name + ' ' + result.description);
      
      return {
        ...result,
        category,
        type
      };
    });
  }

  /**
   * 内容からカテゴリを判定
   */
  categorizeByContent(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('conference') || lowerText.includes('会議') || lowerText.includes('学会')) {
      return 'Conference';
    }
    if (lowerText.includes('exhibition') || lowerText.includes('展示会') || lowerText.includes('見本市')) {
      return 'Exhibition';
    }
    if (lowerText.includes('workshop') || lowerText.includes('ワークショップ')) {
      return 'Workshop';
    }
    if (lowerText.includes('research') || lowerText.includes('研究')) {
      return 'Research';
    }
    if (lowerText.includes('university') || lowerText.includes('大学')) {
      return 'University';
    }
    if (lowerText.includes('company') || lowerText.includes('企業')) {
      return 'Company';
    }
    
    return 'General';
  }

  /**
   * 内容からタイプを判定
   */
  determineType(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('conference') || lowerText.includes('会議') || lowerText.includes('学会')) {
      return 'conference';
    }
    if (lowerText.includes('exhibition') || lowerText.includes('展示会')) {
      return 'exhibition';
    }
    if (lowerText.includes('workshop') || lowerText.includes('ワークショップ')) {
      return 'workshop';
    }
    if (lowerText.includes('research') || lowerText.includes('研究')) {
      return 'research';
    }
    if (lowerText.includes('university') || lowerText.includes('大学')) {
      return 'university';
    }
    if (lowerText.includes('company') || lowerText.includes('企業')) {
      return 'company';
    }
    
    return 'other';
  }

  /**
   * テキストから場所を抽出
   */
  extractLocation(text) {
    // 簡単な場所抽出（実際の実装ではより高度なNLPを使用）
    const locationPatterns = [
      /([A-Z][a-z]+,\s*[A-Z]{2})/g, // US format
      /([A-Z][a-z]+,\s*[A-Z][a-z]+)/g, // International format
      /(東京|大阪|京都|名古屋|福岡|札幌|仙台|横浜|神戸|広島)/g // Japanese cities
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return '';
  }

  /**
   * テキストから日付を抽出
   */
  extractDate(text) {
    // 簡単な日付抽出
    const datePatterns = [
      /(\d{4}-\d{2}-\d{2})/g, // YYYY-MM-DD
      /(\d{4}\/\d{2}\/\d{2})/g, // YYYY/MM/DD
      /(\d{4}年\d{1,2}月\d{1,2}日)/g // Japanese format
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return '';
  }

  /**
   * 検索結果を保存リストに追加
   * @param {Array} results - 保存する結果
   * @param {string} category - カテゴリ
   */
  addToSavedResults(results, category = 'general') {
    const timestamp = new Date().toISOString();
    const savedItem = {
      id: Date.now(),
      timestamp,
      category,
      results: results.map(result => ({
        ...result,
        savedAt: timestamp
      }))
    };

    this.savedResults.unshift(savedItem);
    this.saveResults();
  }

  /**
   * 保存された結果を削除
   * @param {number} id - 削除する結果のID
   */
  removeSavedResult(id) {
    this.savedResults = this.savedResults.filter(item => item.id !== id);
    this.saveResults();
  }

  /**
   * 検索結果をExcel形式でエクスポート
   * @param {Array} results - エクスポートする結果
   * @param {string} filename - ファイル名
   */
  exportToExcel(results, filename = 'reaching_results') {
    // ExcelJSライブラリを使用してExcelファイルを生成
    // 実際の実装ではExcelJSをインストールして使用
    console.log('Excel出力機能:', results);
    
    // 簡易版：CSV形式でダウンロード
    this.exportToCSV(results, filename);
  }

  /**
   * 検索結果をCSV形式でエクスポート
   * @param {Array} results - エクスポートする結果
   * @param {string} filename - ファイル名
   */
  exportToCSV(results, filename) {
    if (!results || results.length === 0) {
      console.warn('エクスポートする結果がありません');
      return;
    }

    // CSVヘッダーを生成
    const headers = ['名前', 'URL', '概要', 'カテゴリ', '場所', '日付', 'タイプ'];
    const csvContent = [
      headers.join(','),
      ...results.map(item => [
        `"${item.name || ''}"`,
        `"${item.url || ''}"`,
        `"${item.description || ''}"`,
        `"${item.category || ''}"`,
        `"${item.location || ''}"`,
        `"${item.date || ''}"`,
        `"${item.type || ''}"`
      ].join(','))
    ].join('\n');

    // ファイルダウンロード
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * モックイベント検索結果を生成
   * @param {Object} searchParams - 検索パラメータ
   * @returns {Promise<Array>} モック結果
   */
  async getMockEventResults(searchParams) {
    console.log('Generating mock event results for params:', searchParams);
    
    // 実際の実装では外部APIを呼び出す
    const mockEvents = [
      {
        id: 1,
        name: 'IEEE International Conference on Computer Vision (ICCV)',
        url: 'https://iccv2023.thecvf.com/',
        description: 'コンピュータビジョンの国際会議。最新の研究発表と技術展示。',
        category: 'Computer Vision',
        location: 'Paris, France',
        date: '2024-10-02',
        type: 'conference',
        relevance: 'high'
      },
      {
        id: 2,
        name: 'Consumer Electronics Show (CES)',
        url: 'https://www.ces.tech/',
        description: '世界最大級の消費者向け電子機器展示会。',
        category: 'Consumer Electronics',
        location: 'Las Vegas, USA',
        date: '2024-01-09',
        type: 'exhibition',
        relevance: 'medium'
      },
      {
        id: 3,
        name: 'Mobile World Congress (MWC)',
        url: 'https://www.mwcbarcelona.com/',
        description: 'モバイル技術の国際展示会・カンファレンス。',
        category: 'Mobile Technology',
        location: 'Barcelona, Spain',
        date: '2024-02-26',
        type: 'exhibition',
        relevance: 'high'
      },
      {
        id: 4,
        name: 'SIGGRAPH',
        url: 'https://www.siggraph.org/',
        description: 'コンピュータグラフィックスとインタラクティブ技術の国際会議。',
        category: 'Computer Graphics',
        location: 'Los Angeles, USA',
        date: '2024-07-28',
        type: 'conference',
        relevance: 'medium'
      },
      {
        id: 5,
        name: 'Japan IT Week',
        url: 'https://www.japan-it-week.com/',
        description: '日本のIT技術展示会。',
        category: 'Information Technology',
        location: 'Tokyo, Japan',
        date: '2024-05-08',
        type: 'exhibition',
        relevance: 'high'
      }
    ];

    // キーワードでフィルタリング
    let filteredEvents = mockEvents;
    if (searchParams.keywords && searchParams.keywords.length > 0) {
      filteredEvents = mockEvents.filter(event => 
        searchParams.keywords.some(keyword =>
          event.name.toLowerCase().includes(keyword.toLowerCase()) ||
          event.description.toLowerCase().includes(keyword.toLowerCase()) ||
          event.category.toLowerCase().includes(keyword.toLowerCase())
        )
      );
    }

    console.log('Mock events generated:', filteredEvents);
    return filteredEvents;
  }

  /**
   * モック機関検索結果を生成
   * @param {Object} searchParams - 検索パラメータ
   * @returns {Promise<Array>} モック結果
   */
  async getMockOrganizationResults(searchParams) {
    const mockOrganizations = [
      {
        id: 1,
        name: 'Google Research',
        url: 'https://research.google/',
        description: 'Googleの研究部門。AI、機械学習、コンピュータビジョンなどの研究。',
        category: 'Technology Research',
        location: 'Mountain View, USA',
        type: 'research',
        relevance: 'high'
      },
      {
        id: 2,
        name: 'Microsoft Research',
        url: 'https://www.microsoft.com/en-us/research/',
        description: 'Microsoftの研究部門。ソフトウェア技術の研究開発。',
        category: 'Software Research',
        location: 'Redmond, USA',
        type: 'research',
        relevance: 'high'
      },
      {
        id: 3,
        name: '国立情報学研究所 (NII)',
        url: 'https://www.nii.ac.jp/',
        description: '日本の情報学の研究機関。学術情報ネットワークの運営。',
        category: 'Academic Research',
        location: 'Tokyo, Japan',
        type: 'research',
        relevance: 'high'
      },
      {
        id: 4,
        name: '産業技術総合研究所 (AIST)',
        url: 'https://www.aist.go.jp/',
        description: '日本の産業技術の研究機関。様々な分野の研究開発。',
        category: 'Industrial Research',
        location: 'Tsukuba, Japan',
        type: 'research',
        relevance: 'medium'
      },
      {
        id: 5,
        name: 'OpenAI',
        url: 'https://openai.com/',
        description: '人工知能研究の非営利組織。GPTシリーズの開発。',
        category: 'AI Research',
        location: 'San Francisco, USA',
        type: 'research',
        relevance: 'high'
      }
    ];

    // キーワードでフィルタリング
    if (searchParams.keywords && searchParams.keywords.length > 0) {
      return mockOrganizations.filter(org => 
        searchParams.keywords.some(keyword =>
          org.name.toLowerCase().includes(keyword.toLowerCase()) ||
          org.description.toLowerCase().includes(keyword.toLowerCase()) ||
          org.category.toLowerCase().includes(keyword.toLowerCase())
        )
      );
    }

    return mockOrganizations;
  }

  /**
   * 検索履歴を取得
   * @returns {Array} 検索履歴
   */
  getSearchHistory() {
    return this.savedResults;
  }

  /**
   * 検索履歴をクリア
   */
  clearSearchHistory() {
    this.savedResults = [];
    this.saveResults();
  }

  /**
   * Google Drive APIが初期化されているかチェック
   */
  async ensureGoogleDriveAPI() {
    if (!window.gapi?.client?.drive) {
      throw new Error('Google Drive API is not initialized. Please sign in first.');
    }
  }

  /**
   * プロジェクト構造を取得
   * @param {string} projectId - プロジェクトID
   * @returns {Promise<Object>} プロジェクト構造
   */
  async getProjectStructure(projectId) {
    try {
      await this.ensureGoogleDriveAPI();
      
      const response = await window.gapi.client.drive.files.list({
        q: `'${projectId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)'
      });

      const folders = response.result.files.filter(file => 
        file.mimeType === 'application/vnd.google-apps.folder'
      );

      const documentFolder = folders.find(folder => folder.name === 'Document');
      const reachingFolder = folders.find(folder => folder.name === 'Reaching');

      return {
        documentFolder,
        reachingFolder,
        allFolders: folders
      };
    } catch (error) {
      console.error('Failed to get project structure:', error);
      throw error;
    }
  }

  /**
   * Mainドキュメントを読み込み
   * @param {string} documentFolderId - DocumentフォルダのID
   * @returns {Promise<Object>} Mainドキュメント
   */
  async readMainDocument(documentFolderId) {
    try {
      await this.ensureGoogleDriveAPI();
      
      // Documentフォルダ内のファイルを取得
      const response = await window.gapi.client.drive.files.list({
        q: `'${documentFolderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size, modifiedTime)',
        orderBy: 'modifiedTime desc'
      });

      if (!response.result.files || response.result.files.length === 0) {
        console.warn('No files found in Document folder');
        return null;
      }

      // Mainドキュメントを検索（複数のパターンで検索）
      const mainFile = this.findMainFile(response.result.files);

      if (!mainFile) {
        console.warn('Main document not found. Available files:', 
          response.result.files.map(f => f.name));
        return null;
      }

      console.log('Main document found:', mainFile.name);

      // ファイル内容を読み込み
      const content = await this.readFileContent(mainFile);
      
      return {
        id: mainFile.id,
        name: mainFile.name,
        content: content,
        source: 'Document/Main'
      };
    } catch (error) {
      console.error('Mainドキュメントの読み込みに失敗:', error);
      throw error;
    }
  }

  /**
   * Mainファイルを柔軟に検索
   */
  findMainFile(files) {
    // 優先順位付きでMainファイルを検索
    const searchPatterns = [
      // 完全一致
      (file) => file.name.toLowerCase() === 'main',
      (file) => file.name.toLowerCase() === 'main.md',
      (file) => file.name.toLowerCase() === 'main.txt',
      
      // 部分一致（先頭）
      (file) => file.name.toLowerCase().startsWith('main'),
      
      // 部分一致（含む）
      (file) => file.name.toLowerCase().includes('main'),
      
      // 代替キーワード
      (file) => file.name.toLowerCase().includes('overview'),
      (file) => file.name.toLowerCase().includes('project'),
      (file) => file.name.toLowerCase().includes('summary')
    ];

    for (const pattern of searchPatterns) {
      const found = files.find(pattern);
      if (found) {
        return found;
      }
    }

    // 見つからない場合は最初のファイルを返す
    return files[0];
  }

  /**
   * ファイル内容を読み込み
   */
  async readFileContent(file) {
    try {
      await this.ensureGoogleDriveAPI();
      
      if (file.mimeType === 'application/vnd.google-apps.document') {
        // Google Docsの場合 - Docs APIが利用可能かチェック
        if (!window.gapi?.client?.docs) {
          console.warn('Google Docs API not available, trying export instead');
          // Docs APIが利用できない場合は、エクスポート機能を使用
          return await this.exportGoogleDoc(file.id);
        }

        try {
          const response = await window.gapi.client.docs.documents.get({
            documentId: file.id
          });
          
          // ドキュメントの内容を抽出
          const content = response.result.body.content
            ?.map(item => item.paragraph?.elements?.map(el => el.textRun?.content || '').join('') || '')
            .join('\n') || '';
          
          return content;
        } catch (docsError) {
          console.warn('Failed to read with Docs API, trying export:', docsError);
          return await this.exportGoogleDoc(file.id);
        }
      } else {
        // その他のファイル形式の場合
        const response = await window.gapi.client.drive.files.get({
          fileId: file.id,
          alt: 'media'
        });
        
        return response.body || '';
      }
    } catch (error) {
      console.error('Failed to read file content:', error);
      
      // フォールバック：ファイル名から推測した内容を返す
      const fallbackContent = `プロジェクト: ${file.name}\n\nこのドキュメントの内容を読み取ることができませんでした。\nファイル形式: ${file.mimeType}\n\n一般的なキーワードで検索を実行します。`;
      console.warn('Using fallback content for file:', file.name);
      return fallbackContent;
    }
  }

  /**
   * Google Docをテキスト形式でエクスポート
   */
  async exportGoogleDoc(fileId) {
    try {
      await this.ensureGoogleDriveAPI();
      
      const response = await window.gapi.client.drive.files.export({
        fileId: fileId,
        mimeType: 'text/plain'
      });
      
      return response.body || '';
    } catch (exportError) {
      console.error('Failed to export Google Doc:', exportError);
      throw exportError;
    }
  }

  /**
   * プロジェクト内容を分析してキーワード抽出
   * @param {string} content - ドキュメント内容
   * @returns {Promise<Array>} キーワード配列
   */
  async analyzeProjectContent(content) {
    // 簡易的なキーワード抽出（実際の実装ではAIを使用）
    const keywords = [];
    
    // 技術キーワードの抽出
    const techKeywords = ['AI', 'machine learning', 'deep learning', 'computer vision', 'natural language processing', 'robotics', 'IoT', 'blockchain', 'cloud computing', 'mobile', 'web', 'database', 'API', 'framework', 'library'];
    
    techKeywords.forEach(keyword => {
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        keywords.push(keyword);
      }
    });

    // ドメインキーワードの抽出
    const domainKeywords = ['healthcare', 'finance', 'education', 'entertainment', 'automotive', 'manufacturing', 'retail', 'logistics', 'security', 'privacy', 'sustainability', 'energy'];
    
    domainKeywords.forEach(keyword => {
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        keywords.push(keyword);
      }
    });

    return keywords.length > 0 ? keywords : ['technology', 'research', 'development'];
  }

  /**
   * Reachingフォルダを作成または取得
   * @param {string} projectId - プロジェクトID
   * @returns {Promise<string>} ReachingフォルダID
   */
  async createOrGetReachingFolder(projectId) {
    try {
      await this.ensureGoogleDriveAPI();
      
      const folderName = 'Reaching';
      
      // 既存のReachingフォルダを検索
      const searchResponse = await window.gapi.client.drive.files.list({
        q: `name='${folderName}' and '${projectId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)'
      });

      if (searchResponse.result.files.length > 0) {
        console.log('Using existing Reaching folder');
        return searchResponse.result.files[0].id;
      }

      // フォルダが存在しない場合は新規作成
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [projectId]
      };

      const createResponse = await window.gapi.client.drive.files.create({
        resource: folderMetadata,
        fields: 'id, name'
      });

      console.log('Created new Reaching folder:', createResponse.result);
      return createResponse.result.id;
    } catch (error) {
      console.error('Reachingフォルダの作成に失敗:', error);
      throw error;
    }
  }

  /**
   * Google Spreadsheetを作成して保存
   * @param {string} folderId - 保存先フォルダID
   * @param {Array} results - 検索結果
   * @returns {Promise<Object>} 作成されたファイル情報
   */
  async createAndSaveExcelFile(folderId, results) {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `Reaching_Results_${timestamp}`;
      
      console.log('Creating Google Spreadsheet:', fileName, 'in folder:', folderId);
      
      // Google Spreadsheetを作成
      const spreadsheet = await this.createGoogleSpreadsheet(fileName, folderId);
      
      // データを書き込み
      await this.writeDataToSpreadsheet(spreadsheet.id, results);
      
      return {
        id: spreadsheet.id,
        name: spreadsheet.name,
        webViewLink: spreadsheet.webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheet.id}`
      };
    } catch (error) {
      console.error('Google Spreadsheetの作成に失敗:', error);
      throw error;
    }
  }

  /**
   * Google Spreadsheetを作成
   */
  async createGoogleSpreadsheet(fileName, parentId) {
    try {
      await this.ensureGoogleDriveAPI();
      
      const fileMetadata = {
        name: fileName,
        parents: [parentId],
        mimeType: 'application/vnd.google-apps.spreadsheet'
      };

      console.log('Creating Google Spreadsheet with metadata:', fileMetadata);
      
      const response = await window.gapi.client.drive.files.create({
        resource: fileMetadata,
        fields: 'id, name, webViewLink'
      });

      console.log('Google Spreadsheet created successfully:', response.result);
      return response.result;
    } catch (error) {
      console.error('Failed to create Google Spreadsheet:', error);
      throw error;
    }
  }

  /**
   * スプレッドシートにデータを書き込み
   */
  async writeDataToSpreadsheet(spreadsheetId, results) {
    try {
      console.log('Writing data to spreadsheet:', spreadsheetId);
      console.log('Results to write:', results);

      if (!results || results.length === 0) {
        console.warn('No results to write to spreadsheet');
        return;
      }

      // ヘッダー行を準備
      const headers = ['名前', 'URL', '概要', 'カテゴリ', '場所', '日付', 'タイプ', '関連度', 'ソース'];
      
      // データ行を準備
      const dataRows = results.map(item => [
        item.name || '',
        item.url || '',
        item.description || '',
        item.category || '',
        item.location || '',
        item.date || '',
        item.type || '',
        item.relevance || '',
        item.source || ''
      ]);

      // 全データを結合
      const allData = [headers, ...dataRows];

      // Google Sheets APIを使用してデータを書き込み
      const response = await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: 'A1:I' + (allData.length + 1),
        valueInputOption: 'RAW',
        resource: {
          values: allData
        }
      });

      console.log('Data written to spreadsheet successfully:', response.result);
    } catch (error) {
      console.error('Failed to write data to spreadsheet:', error);
      throw error;
    }
  }
}

export default new ReachingService();
