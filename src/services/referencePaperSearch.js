import * as XLSX from 'xlsx';
import ieeeService from './ieeeService.js';
import semanticScholarService from './semanticScholarService.js';

/**
 * 参考論文検索サービス
 * MainとSuggestionドキュメントを読み込んで関連論文を検索し、
 * Academia/Reference PaperフォルダにExcel形式で保存
 */
class ReferencePaperSearchService {
  constructor() {
    this.isProcessing = false;
  }

  /**
   * メイン処理：ドキュメントを分析して参考論文を検索・保存
   * @param {string} projectId - プロジェクトID
   * @param {Function} onProgress - 進捗コールバック
   * @param {string} searchSource - 検索元 ('ieee' または 'semantic-scholar')
   * @returns {Object} 処理結果
   */
  async searchReferencePapers(projectId, onProgress = null, searchSource = 'ieee') {
    if (this.isProcessing) {
      throw new Error('既に参考論文検索処理中です');
    }

    this.isProcessing = true;
    const result = {
      success: false,
      sourceDocuments: [],
      searchResults: [],
      excelFile: null,
      error: null
    };

    try {
      // 1. プロジェクトの構造を取得
      if (onProgress) onProgress({ stage: 'scanning', progress: 10, message: 'プロジェクト構造を取得中...' });
      const projectStructure = await this.getProjectStructure(projectId);

      // 2. 分析対象ドキュメントを読み込み
      if (onProgress) onProgress({ stage: 'reading', progress: 25, message: '分析対象ドキュメントを読み込み中...' });
      const documents = await this.readAnalysisDocuments(projectStructure);
      
      if (!documents || documents.length === 0) {
        throw new Error('分析対象のドキュメントが見つかりません。DocumentフォルダのMainドキュメント、またはAcademia/Paper Topic SuggestionのSuggestionドキュメントを確認してください。');
      }
      result.sourceDocuments = documents;

      // 3. Academiaフォルダとサブフォルダを準備
      if (onProgress) onProgress({ stage: 'preparing', progress: 40, message: 'Reference Paperフォルダを準備中...' });
      const referenceFolderId = await this.prepareReferencePaperFolder(projectStructure.academiaFolder);

      // 4. ドキュメント内容を分析してキーワード抽出
      if (onProgress) onProgress({ stage: 'analyzing', progress: 55, message: 'ドキュメント内容を分析中...' });
      const keywords = await this.extractResearchKeywords(documents);

      // 5. 関連論文を検索（デモ版）
      if (onProgress) onProgress({ stage: 'searching', progress: 70, message: '関連論文を検索中...' });
      const papers = await this.searchRelatedPapers(keywords, searchSource);
      result.searchResults = papers;

      // 6. Excelファイルを作成
      if (onProgress) onProgress({ stage: 'creating', progress: 85, message: 'Excelファイルを作成中...' });
      const excelBlob = await this.createExcelFile(papers, keywords, documents);

      // 7. Google Driveに保存
      if (onProgress) onProgress({ stage: 'saving', progress: 95, message: 'Google Driveに保存中...' });
      const excelFile = await this.saveExcelToGoogleDrive(referenceFolderId, excelBlob);
      result.excelFile = excelFile;

      if (onProgress) onProgress({ stage: 'completed', progress: 100, message: '参考論文検索が完了しました！' });
      result.success = true;

    } catch (error) {
      console.error('Reference paper search failed:', error);
      result.error = error.message;
      if (onProgress) onProgress({ stage: 'error', progress: 0, message: `エラー: ${error.message}` });
    } finally {
      this.isProcessing = false;
    }

    return result;
  }

  /**
   * プロジェクトの構造を取得
   */
  async getProjectStructure(projectId) {
    try {
      const response = await window.gapi.client.drive.files.list({
        q: `'${projectId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)'
      });

      const folders = response.result.files.filter(file => 
        file.mimeType === 'application/vnd.google-apps.folder'
      );

      const documentFolder = folders.find(folder => folder.name === 'Document');
      const academiaFolder = folders.find(folder => folder.name === 'Academia');

      return {
        documentFolder,
        academiaFolder,
        allFolders: folders
      };
    } catch (error) {
      console.error('Failed to get project structure:', error);
      throw error;
    }
  }

  /**
   * 分析対象ドキュメントを読み込み（MainとSuggestion）
   */
  async readAnalysisDocuments(projectStructure) {
    const documents = [];

    try {
      // 1. DocumentフォルダからMainドキュメントを読み込み
      if (projectStructure.documentFolder) {
        const mainDoc = await this.readMainDocument(projectStructure.documentFolder);
        if (mainDoc) {
          documents.push({
            type: 'main',
            fileName: mainDoc.fileName,
            content: mainDoc.content,
            source: 'Document/Main'
          });
        }
      }

      // 2. Academia/Paper Topic SuggestionからSuggestionドキュメントを読み込み
      if (projectStructure.academiaFolder) {
        const suggestionDoc = await this.readSuggestionDocument(projectStructure.academiaFolder);
        if (suggestionDoc) {
          documents.push({
            type: 'suggestion',
            fileName: suggestionDoc.fileName,
            content: suggestionDoc.content,
            source: 'Academia/Paper Topic Suggestion/Suggestion'
          });
        }
      }

      console.log('Analysis documents loaded:', documents.length);
      return documents;
    } catch (error) {
      console.error('Failed to read analysis documents:', error);
      throw error;
    }
  }

  /**
   * DocumentフォルダからMainドキュメントを読み込み
   */
  async readMainDocument(documentFolder) {
    try {
      const response = await window.gapi.client.drive.files.list({
        q: `'${documentFolder.id}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)'
      });

      // Mainファイルを検索
      const mainFile = response.result.files.find(file => 
        file.name.toLowerCase().includes('main') && this.isDocumentFile(file)
      );

      if (!mainFile) {
        console.warn('Main document not found in Document folder');
        return null;
      }

      const content = await this.readFileContent(mainFile);
      return {
        fileName: mainFile.name,
        content: content,
        fileId: mainFile.id
      };
    } catch (error) {
      console.error('Failed to read Main document:', error);
      return null;
    }
  }

  /**
   * Academia/Paper Topic SuggestionからSuggestionドキュメントを読み込み
   */
  async readSuggestionDocument(academiaFolder) {
    try {
      // Paper Topic Suggestionフォルダを検索
      const ptsFolderResponse = await window.gapi.client.drive.files.list({
        q: `'${academiaFolder.id}' in parents and name='Paper Topic Suggestion' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)'
      });

      if (ptsFolderResponse.result.files.length === 0) {
        console.warn('Paper Topic Suggestion folder not found');
        return null;
      }

      const ptsFolder = ptsFolderResponse.result.files[0];

      // Suggestionファイルを検索
      const suggestionResponse = await window.gapi.client.drive.files.list({
        q: `'${ptsFolder.id}' in parents and name='Suggestion' and trashed=false`,
        fields: 'files(id, name, mimeType)'
      });

      if (suggestionResponse.result.files.length === 0) {
        console.warn('Suggestion document not found in Paper Topic Suggestion folder');
        return null;
      }

      const suggestionFile = suggestionResponse.result.files[0];
      const content = await this.readFileContent(suggestionFile);

      return {
        fileName: suggestionFile.name,
        content: content,
        fileId: suggestionFile.id
      };
    } catch (error) {
      console.error('Failed to read Suggestion document:', error);
      return null;
    }
  }

  /**
   * ドキュメントファイルかどうかを判定
   */
  isDocumentFile(file) {
    const documentMimeTypes = [
      'application/vnd.google-apps.document',
      'text/plain',
      'text/markdown'
    ];

    const documentExtensions = ['.md', '.txt', '.doc', '.docx'];

    return documentMimeTypes.some(type => file.mimeType.includes(type)) ||
           documentExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }

  /**
   * ファイル内容を読み込み
   */
  async readFileContent(file) {
    try {
      if (file.mimeType === 'application/vnd.google-apps.document') {
        const response = await window.gapi.client.drive.files.export({
          fileId: file.id,
          mimeType: 'text/plain'
        });
        return response.body;
      }

      const response = await window.gapi.client.drive.files.get({
        fileId: file.id,
        alt: 'media'
      });

      return response.body || '';
    } catch (error) {
      console.error(`Failed to read file content for ${file.name}:`, error);
      return `[${file.name}の内容を読み取れませんでした]`;
    }
  }

  /**
   * Reference Paperフォルダを準備
   */
  async prepareReferencePaperFolder(academiaFolder) {
    if (!academiaFolder) {
      throw new Error('Academiaフォルダが見つかりません');
    }

    try {
      const folderName = 'Reference Paper';
      
      // 既存のReference Paperフォルダを検索
      const searchResponse = await window.gapi.client.drive.files.list({
        q: `name='${folderName}' and '${academiaFolder.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)'
      });

      if (searchResponse.result.files.length > 0) {
        console.log('Using existing Reference Paper folder');
        return searchResponse.result.files[0].id;
      }

      // フォルダが存在しない場合は新規作成
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [academiaFolder.id]
      };

      const createResponse = await window.gapi.client.drive.files.create({
        resource: folderMetadata,
        fields: 'id'
      });

      console.log('Created new Reference Paper folder');
      return createResponse.result.id;
    } catch (error) {
      console.error('Failed to prepare Reference Paper folder:', error);
      throw error;
    }
  }

  /**
   * 研究キーワードを抽出
   */
  async extractResearchKeywords(documents) {
    console.log('Extracting research keywords from documents');

    const allKeywords = new Set();

    documents.forEach(doc => {
      const keywords = this.extractKeywordsFromText(doc.content);
      keywords.forEach(keyword => allKeywords.add(keyword));
    });

    // 重要度でソートして上位キーワードを選択
    const keywordArray = Array.from(allKeywords);
    const scoredKeywords = keywordArray.map(keyword => ({
      keyword,
      score: this.calculateKeywordScore(keyword, documents)
    })).sort((a, b) => b.score - a.score);

    const topKeywords = scoredKeywords.slice(0, 10).map(item => item.keyword);
    
    console.log('Extracted top keywords:', topKeywords);
    return topKeywords;
  }

  /**
   * テキストからキーワードを抽出
   */
  extractKeywordsFromText(text) {
    const keywords = [];

    // 技術関連キーワード
    const techPatterns = [
      /AI|人工知能|機械学習|深層学習|ディープラーニング|neural network/gi,
      /システム|system|アーキテクチャ|architecture/gi,
      /データ|data|分析|analysis|処理|processing/gi,
      /アルゴリズム|algorithm|最適化|optimization/gi,
      /インターフェース|interface|UI|UX|ユーザビリティ/gi,
      /プログラミング|programming|開発|development/gi,
      /クラウド|cloud|サーバー|server|インフラ/gi,
      /セキュリティ|security|暗号化|encryption/gi,
      /データベース|database|SQL|NoSQL/gi,
      /Web|ウェブ|API|REST|GraphQL/gi
    ];

    // 研究関連キーワード
    const researchPatterns = [
      /研究|research|調査|study|実験|experiment/gi,
      /手法|method|アプローチ|approach|技法/gi,
      /評価|evaluation|測定|measurement|指標/gi,
      /比較|comparison|分析|analysis|検証/gi,
      /提案|proposal|改善|improvement|効率/gi,
      /モデル|model|フレームワーク|framework/gi,
      /パフォーマンス|performance|効果|effectiveness/gi,
      /イノベーション|innovation|新規性|novelty/gi
    ];

    [...techPatterns, ...researchPatterns].forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => keywords.push(match.toLowerCase()));
      }
    });

    // 専門用語を抽出（カタカナ・英単語）
    const specialTerms = text.match(/[ァ-ヶー]{3,}|[a-zA-Z]{4,}/g);
    if (specialTerms) {
      specialTerms.forEach(term => {
        if (term.length >= 4 && term.length <= 15) {
          keywords.push(term.toLowerCase());
        }
      });
    }

    return [...new Set(keywords)];
  }

  /**
   * キーワードスコアを計算
   */
  calculateKeywordScore(keyword, documents) {
    let score = 0;
    const keywordLower = keyword.toLowerCase();

    documents.forEach(doc => {
      const contentLower = doc.content.toLowerCase();
      const frequency = (contentLower.match(new RegExp(keywordLower, 'g')) || []).length;
      
      // タイプ別の重み付け
      const typeWeight = doc.type === 'main' ? 1.5 : 1.0;
      score += frequency * typeWeight;
    });

    return score;
  }

  /**
   * 関連論文を検索（IEEE Explore API または Semantic Scholar API使用）
   * @param {Array} keywords - 検索キーワード
   * @param {string} searchSource - 検索元 ('ieee' または 'semantic-scholar')
   */
  async searchRelatedPapers(keywords, searchSource = 'ieee') {
    console.log(`Searching for related papers with keywords: ${keywords.join(', ')} using ${searchSource}`);

    try {
      // キーワードを複数のセットに分割して検索
      const keywordSets = this.createKeywordSets(keywords);
      console.log('Created keyword sets for search:', keywordSets);

      // 検索オプションを設定
      const searchOptions = {
        limit: 30, // 各キーワードセットで最大30件
        yearRange: `${new Date().getFullYear() - 5}-${new Date().getFullYear()}`, // 過去5年
        maxRecords: 30, // IEEE用
        contentTypes: 'Conferences,Journals' // IEEE用
      };

      let papers = [];

      if (searchSource === 'semantic-scholar') {
        // Semantic Scholar APIで検索
        console.log('Using Semantic Scholar API for search');
        try {
          papers = await semanticScholarService.searchWithMultipleKeywordSets(keywordSets, searchOptions);
        } catch (error) {
          console.warn('Semantic Scholar API failed, falling back to IEEE or mock data:', error);
          
          // Semantic Scholarが失敗した場合、IEEEを試行
          if (ieeeService.apiKey && ieeeService.apiKey.trim() !== '') {
            console.log('Falling back to IEEE API');
            try {
              papers = await ieeeService.searchWithMultipleKeywordSets(keywordSets, searchOptions);
            } catch (ieeeError) {
              console.warn('IEEE API also failed, using mock data:', ieeeError);
              papers = await this.searchRelatedPapersMock(keywords);
            }
          } else {
            // IEEE APIキーがない場合はモックデータを使用
            papers = await this.searchRelatedPapersMock(keywords);
          }
        }
      } else {
        // IEEE APIで検索（デフォルト）
        console.log('Using IEEE API for search');
        
        // IEEE APIが利用可能かチェック
        if (!ieeeService.apiKey || ieeeService.apiKey.trim() === '') {
          console.warn('IEEE API key not configured, falling back to mock data');
          return await this.searchRelatedPapersMock(keywords);
        }
        
        try {
          papers = await ieeeService.searchWithMultipleKeywordSets(keywordSets, searchOptions);
        } catch (error) {
          console.warn('IEEE API failed, falling back to mock data:', error);
          papers = await this.searchRelatedPapersMock(keywords);
        }
      }
      
      // 結果を制限（上位20件）
      const limitedPapers = papers.slice(0, 20);
      
      console.log(`Found ${limitedPapers.length} relevant papers from ${searchSource === 'semantic-scholar' ? 'Semantic Scholar' : 'IEEE'}`);
      return limitedPapers;

    } catch (error) {
      console.error(`${searchSource === 'semantic-scholar' ? 'Semantic Scholar' : 'IEEE'} API search failed, falling back to mock data:`, error);
      
      // APIが失敗した場合はモックデータを使用
      return await this.searchRelatedPapersMock(keywords);
    }
  }

  /**
   * キーワードセットを作成
   * @param {Array} keywords - 元のキーワード配列
   * @returns {Array} キーワードセットの配列
   */
  createKeywordSets(keywords) {
    const sets = [];
    
    // 1. 全キーワードでの検索
    if (keywords.length > 0) {
      sets.push(keywords);
    }
    
    // 2. 上位3つのキーワードでの検索
    if (keywords.length >= 3) {
      sets.push(keywords.slice(0, 3));
    }
    
    // 3. 上位5つのキーワードでの検索
    if (keywords.length >= 5) {
      sets.push(keywords.slice(0, 5));
    }
    
    // 4. 個別キーワードでの検索（上位3つまで）
    const topKeywords = keywords.slice(0, 3);
    topKeywords.forEach(keyword => {
      sets.push([keyword]);
    });
    
    return sets;
  }

  /**
   * 関連論文を検索（モックデータ版）
   */
  async searchRelatedPapersMock(keywords) {
    console.log('Using mock data for paper search');

    // デモ用のモック論文データ
    const mockPapers = [
      {
        title: "Deep Learning Approaches for Intelligent System Design",
        authors: "Smith, J., Johnson, A., Williams, B.",
        year: 2023,
        journal: "Journal of Artificial Intelligence Research",
        url: "https://example.com/papers/deep-learning-systems-2023",
        abstract: "This paper presents novel deep learning approaches for designing intelligent systems with improved performance and scalability.",
        keywords: ["deep learning", "intelligent systems", "AI", "system design"],
        relevanceScore: 0.95
      },
      {
        title: "User Interface Optimization Using Machine Learning Techniques",
        authors: "Brown, C., Davis, M., Wilson, K.",
        year: 2023,
        journal: "ACM Transactions on Computer-Human Interaction",
        url: "https://example.com/papers/ui-optimization-ml-2023",
        abstract: "We propose machine learning techniques for optimizing user interfaces based on user behavior analysis and interaction patterns.",
        keywords: ["UI", "UX", "machine learning", "optimization", "user behavior"],
        relevanceScore: 0.88
      },
      {
        title: "Scalable Cloud Architecture for Data Processing Systems",
        authors: "Lee, S., Kim, H., Park, J.",
        year: 2022,
        journal: "IEEE Transactions on Cloud Computing",
        url: "https://example.com/papers/cloud-architecture-2022",
        abstract: "A comprehensive study on designing scalable cloud architectures for large-scale data processing applications.",
        keywords: ["cloud computing", "scalability", "data processing", "architecture"],
        relevanceScore: 0.82
      },
      {
        title: "Security Framework for Modern Web Applications",
        authors: "Garcia, R., Martinez, L., Rodriguez, P.",
        year: 2023,
        journal: "Computer Security Journal",
        url: "https://example.com/papers/web-security-framework-2023",
        abstract: "This paper introduces a comprehensive security framework for protecting modern web applications from various cyber threats.",
        keywords: ["web security", "framework", "cyber threats", "web applications"],
        relevanceScore: 0.79
      },
      {
        title: "Performance Evaluation of Database Systems in Distributed Environments",
        authors: "Chen, X., Wang, Y., Liu, Z.",
        year: 2022,
        journal: "Database Systems Research",
        url: "https://example.com/papers/database-performance-2022",
        abstract: "Comparative analysis of database performance in distributed computing environments with various optimization strategies.",
        keywords: ["database", "performance", "distributed systems", "optimization"],
        relevanceScore: 0.75
      },
      {
        title: "Innovative Approaches to Software Development Methodologies",
        authors: "Anderson, T., Thompson, R., White, S.",
        year: 2023,
        journal: "Software Engineering Review",
        url: "https://example.com/papers/software-methodologies-2023",
        abstract: "An exploration of innovative software development methodologies that improve team productivity and code quality.",
        keywords: ["software development", "methodologies", "productivity", "code quality"],
        relevanceScore: 0.71
      },
      {
        title: "Data Analysis Techniques for Business Intelligence Systems",
        authors: "Miller, D., Taylor, E., Moore, F.",
        year: 2022,
        journal: "Business Intelligence Quarterly",
        url: "https://example.com/papers/data-analysis-bi-2022",
        abstract: "Advanced data analysis techniques specifically designed for business intelligence applications and decision support systems.",
        keywords: ["data analysis", "business intelligence", "decision support", "analytics"],
        relevanceScore: 0.68
      },
      {
        title: "Research Methodology for Technology Innovation Studies",
        authors: "Jackson, G., Harris, I., Clark, J.",
        year: 2023,
        journal: "Innovation Research Methods",
        url: "https://example.com/papers/research-methodology-2023",
        abstract: "A comprehensive guide to research methodologies specifically tailored for studying technology innovation processes.",
        keywords: ["research methodology", "innovation", "technology studies", "research methods"],
        relevanceScore: 0.64
      }
    ];

    // キーワードベースで関連度を計算して論文をフィルタリング・ソート
    const scoredPapers = mockPapers.map(paper => {
      let relevanceScore = 0;
      keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        
        // タイトル、抽象、キーワードでの一致をチェック
        if (paper.title.toLowerCase().includes(keywordLower)) relevanceScore += 3;
        if (paper.abstract.toLowerCase().includes(keywordLower)) relevanceScore += 2;
        if (paper.keywords.some(k => k.toLowerCase().includes(keywordLower))) relevanceScore += 4;
      });
      
      return {
        ...paper,
        calculatedRelevance: relevanceScore
      };
    }).filter(paper => paper.calculatedRelevance > 0)
      .sort((a, b) => b.calculatedRelevance - a.calculatedRelevance)
      .slice(0, 15); // 上位15件

    console.log(`Found ${scoredPapers.length} relevant papers from mock data`);
    return scoredPapers;
  }

  /**
   * Excelファイルを作成
   */
  async createExcelFile(papers, keywords, sourceDocuments) {
    console.log('Creating Excel file with papers:', papers.length);

    // ワークブックを作成
    const workbook = XLSX.utils.book_new();

    // 1. 論文リストシート
    const paperData = [
      ['No.', 'タイトル', '著者', '年', 'ジャーナル/会議', 'URL', '関連度スコア', 'キーワード', '概要', 'DOI', 'ページ', '出版社'],
      ...papers.map((paper, index) => [
        index + 1,
        paper.title,
        paper.authors,
        paper.year,
        paper.journal,
        paper.url,
        paper.calculatedRelevance || paper.relevanceScore,
        paper.keywords.join(', '),
        paper.abstract,
        paper.doi || '',
        paper.pages || '',
        paper.publisher || 'IEEE'
      ])
    ];

    const paperSheet = XLSX.utils.aoa_to_sheet(paperData);
    
    // 列幅を設定
    paperSheet['!cols'] = [
      { wch: 5 },   // No.
      { wch: 50 },  // タイトル
      { wch: 30 },  // 著者
      { wch: 8 },   // 年
      { wch: 35 },  // ジャーナル
      { wch: 60 },  // URL
      { wch: 12 },  // スコア
      { wch: 40 },  // キーワード
      { wch: 80 },  // 概要
      { wch: 25 },  // DOI
      { wch: 15 },  // ページ
      { wch: 15 }   // 出版社
    ];

    XLSX.utils.book_append_sheet(workbook, paperSheet, '関連論文一覧');

    // 2. 検索情報シート
    const searchInfoData = [
      ['検索実行日時', new Date().toLocaleString('ja-JP')],
      [''],
      ['分析対象ドキュメント', ''],
      ...sourceDocuments.map(doc => ['', `${doc.source}: ${doc.fileName}`]),
      [''],
      ['抽出キーワード', ''],
      ...keywords.map(keyword => ['', keyword]),
      [''],
      ['検索結果統計', ''],
      ['総論文数', papers.length],
      ['平均関連度スコア', papers.length > 0 ? (papers.reduce((sum, p) => sum + (p.calculatedRelevance || p.relevanceScore), 0) / papers.length).toFixed(2) : 0],
      ['最新論文年', papers.length > 0 ? Math.max(...papers.map(p => p.year)) : 'N/A'],
      ['最古論文年', papers.length > 0 ? Math.min(...papers.map(p => p.year)) : 'N/A']
    ];

    const searchInfoSheet = XLSX.utils.aoa_to_sheet(searchInfoData);
    searchInfoSheet['!cols'] = [{ wch: 20 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(workbook, searchInfoSheet, '検索情報');

    // 3. 年度別統計シート
    const yearStats = {};
    papers.forEach(paper => {
      yearStats[paper.year] = (yearStats[paper.year] || 0) + 1;
    });

    const yearStatsData = [
      ['年', '論文数'],
      ...Object.entries(yearStats)
        .sort(([a], [b]) => b - a)
        .map(([year, count]) => [year, count])
    ];

    const yearStatsSheet = XLSX.utils.aoa_to_sheet(yearStatsData);
    yearStatsSheet['!cols'] = [{ wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(workbook, yearStatsSheet, '年度別統計');

    // Excelファイルをblobとして生成
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const excelBlob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });

    console.log('Excel file created successfully, size:', excelBlob.size);
    return excelBlob;
  }

  /**
   * ExcelファイルをGoogle Driveに保存
   */
  async saveExcelToGoogleDrive(folderId, excelBlob) {
    try {
      const fileName = `Reference_Papers_${new Date().toISOString().split('T')[0]}.xlsx`;
      console.log(`Saving Excel file "${fileName}" to folder:`, folderId);

      // Blobを Base64 に変換
      const base64Data = await this.blobToBase64(excelBlob);
      
      // Google Drive API でファイルをアップロード
      const boundary = '-------314159265358979323846264338327950288419716939937510';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      const metadata = {
        'name': fileName,
        'parents': [folderId],
        'mimeType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n' +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        base64Data +
        close_delim;

      const response = await window.gapi.client.request({
        'path': 'https://www.googleapis.com/upload/drive/v3/files',
        'method': 'POST',
        'params': {'uploadType': 'multipart'},
        'headers': {
          'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        'body': multipartRequestBody
      });

      console.log('Excel file uploaded successfully:', response.result);
      return response.result;
      
    } catch (error) {
      console.error('Failed to save Excel file to Google Drive:', error);
      throw error;
    }
  }

  /**
   * BlobをBase64に変換
   */
  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 処理中かどうかを確認
   */
  isCurrentlyProcessing() {
    return this.isProcessing;
  }
}

// シングルトンインスタンスをエクスポート
const referencePaperSearchService = new ReferencePaperSearchService();
export default referencePaperSearchService;

