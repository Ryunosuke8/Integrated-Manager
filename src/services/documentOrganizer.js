/**
 * Document自動整理サービス
 * Documentフォルダの内容を分析してMain、Topic、ForTech、ForAcaに自動分類
 */
class DocumentOrganizerService {
  constructor() {
    this.isProcessing = false;
  }

  /**
   * メイン処理：Documentフォルダを分析して自動整理
   * @param {string} projectId - プロジェクトID
   * @param {Function} onProgress - 進捗コールバック
   * @param {Object} selectedCategories - 選択されたカテゴリ
   * @returns {Object} 処理結果
   */
  async organizeDocuments(projectId, onProgress = null, selectedCategories = null) {
    if (this.isProcessing) {
      throw new Error('既にDocument自動整理処理中です');
    }

    this.isProcessing = true;
    const result = {
      success: false,
      sourceDocuments: [],
      classificationResults: {},
      organizedDocuments: {},
      reportFile: null,
      error: null
    };

    try {
      // 1. プロジェクトの構造を取得
      if (onProgress) onProgress({ stage: 'scanning', progress: 10, message: 'プロジェクト構造を取得中...' });
      const projectStructure = await this.getProjectStructure(projectId);

      // 2. Documentフォルダの内容を読み込み
      if (onProgress) onProgress({ stage: 'reading', progress: 25, message: 'Documentフォルダを読み込み中...' });
      const documents = await this.readDocumentFolder(projectStructure.documentFolder);
      
      if (!documents || documents.length === 0) {
        throw new Error('Documentフォルダにドキュメントが見つかりません。整理対象のファイルを追加してください。');
      }
      result.sourceDocuments = documents;

      // 3. ドキュメント内容を分析・分類
      if (onProgress) onProgress({ stage: 'analyzing', progress: 45, message: 'ドキュメント内容を分析中...' });
      const classificationResults = await this.classifyDocuments(documents);
      result.classificationResults = classificationResults;

      // 4. 分類されたドキュメントを作成（選択されたカテゴリのみ）
      if (onProgress) onProgress({ stage: 'creating', progress: 65, message: '整理されたドキュメントを作成中...' });
      const organizedDocs = await this.createOrganizedDocuments(classificationResults, selectedCategories);
      result.organizedDocuments = organizedDocs;

      // 5. 整理されたドキュメントをDocumentフォルダに保存
      if (onProgress) onProgress({ stage: 'saving', progress: 80, message: 'Google Driveに保存中...' });
      await this.saveOrganizedDocuments(projectStructure.documentFolder.id, organizedDocs);

      // 6. 整理結果レポートを作成・保存
      if (onProgress) onProgress({ stage: 'reporting', progress: 95, message: '整理結果レポートを作成中...' });
      const reportFile = await this.createOrganizationReport(
        projectStructure.documentFolder.id, 
        documents, 
        classificationResults, 
        organizedDocs
      );
      result.reportFile = reportFile;

      if (onProgress) onProgress({ stage: 'completed', progress: 100, message: 'Document自動整理が完了しました！' });
      result.success = true;

    } catch (error) {
      console.error('Document organization failed:', error);
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

      return {
        documentFolder,
        allFolders: folders
      };
    } catch (error) {
      console.error('Failed to get project structure:', error);
      throw error;
    }
  }

  /**
   * Documentフォルダの内容を読み込み
   */
  async readDocumentFolder(documentFolder) {
    if (!documentFolder) {
      throw new Error('Documentフォルダが見つかりません');
    }

    try {
      console.log('Reading Document folder contents:', documentFolder.id);
      
      const response = await window.gapi.client.drive.files.list({
        q: `'${documentFolder.id}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size, modifiedTime)',
        orderBy: 'modifiedTime desc'
      });

      console.log('Files found in Document folder:', response.result.files);

      if (!response.result.files || response.result.files.length === 0) {
        return null;
      }

      // ドキュメントファイルのみを対象とする
      const documentFiles = response.result.files.filter(file => 
        this.isDocumentFile(file) && !this.isOrganizedDocument(file.name)
      );

      if (documentFiles.length === 0) {
        return null;
      }

      // 各ファイルの内容を読み込み
      const documents = [];
      for (const file of documentFiles) {
        try {
          const content = await this.readFileContent(file);
          documents.push({
            fileName: file.name,
            content: content,
            fileId: file.id,
            mimeType: file.mimeType,
            size: file.size || 0,
            modifiedTime: file.modifiedTime
          });
        } catch (error) {
          console.warn(`Failed to read file ${file.name}:`, error);
        }
      }

      return documents.length > 0 ? documents : null;
    } catch (error) {
      console.error('Failed to read Document folder:', error);
      throw error;
    }
  }

  /**
   * 既に整理済みのドキュメントかどうかを判定
   */
  isOrganizedDocument(fileName) {
    const organizedPrefixes = ['Main_', 'Topic_', 'ForTech_', 'ForAca_', 'Organization_Report_'];
    return organizedPrefixes.some(prefix => fileName.startsWith(prefix));
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
   * ドキュメントを分析・分類
   */
  async classifyDocuments(documents) {
    console.log('Classifying documents:', documents.length);

    const classificationResults = {
      Main: [],
      Topic: [],
      ForTech: [],
      ForAca: []
    };

    documents.forEach(doc => {
      const classification = this.classifyDocument(doc);
      classification.categories.forEach(category => {
        classificationResults[category].push({
          document: doc,
          confidence: classification.confidence[category],
          reasons: classification.reasons[category]
        });
      });
    });

    // 各カテゴリで信頼度順にソート
    Object.keys(classificationResults).forEach(category => {
      classificationResults[category].sort((a, b) => b.confidence - a.confidence);
    });

    console.log('Classification results:', classificationResults);
    return classificationResults;
  }

  /**
   * 単一ドキュメントを分類
   */
  classifyDocument(document) {
    const content = document.content.toLowerCase();
    const fileName = document.fileName.toLowerCase();
    
    const classification = {
      categories: [],
      confidence: {},
      reasons: {}
    };

    // Main（大きい方向性）の判定
    const mainScore = this.calculateMainScore(content, fileName);
    console.log(`Main score for ${document.fileName}:`, mainScore.score, mainScore.reasons);
    if (mainScore.score > 0.2) {  // 閾値を0.3から0.2に下げる
      classification.categories.push('Main');
      classification.confidence.Main = mainScore.score;
      classification.reasons.Main = mainScore.reasons;
    }

    // Topic（分岐したトピック）の判定
    const topicScore = this.calculateTopicScore(content, fileName);
    console.log(`Topic score for ${document.fileName}:`, topicScore.score, topicScore.reasons);
    if (topicScore.score > 0.2) {  // 閾値を0.3から0.2に下げる
      classification.categories.push('Topic');
      classification.confidence.Topic = topicScore.score;
      classification.reasons.Topic = topicScore.reasons;
    }

    // ForTech（技術系イシュー）の判定
    const techScore = this.calculateTechScore(content, fileName);
    console.log(`Tech score for ${document.fileName}:`, techScore.score, techScore.reasons);
    if (techScore.score > 0.2) {  // 閾値を0.3から0.2に下げる
      classification.categories.push('ForTech');
      classification.confidence.ForTech = techScore.score;
      classification.reasons.ForTech = techScore.reasons;
    }

    // ForAca（学術系イシュー）の判定
    const acaScore = this.calculateAcademicScore(content, fileName);
    console.log(`Academic score for ${document.fileName}:`, acaScore.score, acaScore.reasons);
    if (acaScore.score > 0.2) {  // 閾値を0.3から0.2に下げる
      classification.categories.push('ForAca');
      classification.confidence.ForAca = acaScore.score;
      classification.reasons.ForAca = acaScore.reasons;
    }

    // 少なくとも1つのカテゴリに分類されるようにする
    if (classification.categories.length === 0) {
      const scores = [
        { category: 'Main', score: mainScore.score, reasons: mainScore.reasons },
        { category: 'Topic', score: topicScore.score, reasons: topicScore.reasons },
        { category: 'ForTech', score: techScore.score, reasons: techScore.reasons },
        { category: 'ForAca', score: acaScore.score, reasons: acaScore.reasons }
      ];
      
      const bestMatch = scores.sort((a, b) => b.score - a.score)[0];
      classification.categories.push(bestMatch.category);
      classification.confidence[bestMatch.category] = Math.max(bestMatch.score, 0.15);
      classification.reasons[bestMatch.category] = bestMatch.reasons.length > 0 
        ? bestMatch.reasons 
        : ['自動分類により最も適合度の高いカテゴリとして選択'];
    }

    // 各ドキュメントを少なくとも2つのカテゴリに分類するように改善
    const allScores = [
      { category: 'Main', score: mainScore.score, reasons: mainScore.reasons },
      { category: 'Topic', score: topicScore.score, reasons: topicScore.reasons },
      { category: 'ForTech', score: techScore.score, reasons: techScore.reasons },
      { category: 'ForAca', score: acaScore.score, reasons: acaScore.reasons }
    ].sort((a, b) => b.score - a.score);

    // トップ2カテゴリを追加（まだ追加されていない場合）
    allScores.slice(0, 2).forEach(scoreObj => {
      if (!classification.categories.includes(scoreObj.category) && scoreObj.score > 0.1) {
        classification.categories.push(scoreObj.category);
        classification.confidence[scoreObj.category] = Math.max(scoreObj.score, 0.15);
        classification.reasons[scoreObj.category] = scoreObj.reasons.length > 0 
          ? scoreObj.reasons 
          : ['副次的なカテゴリとして分類'];
      }
    });

    return classification;
  }

  /**
   * Main（大きい方向性）スコアを計算
   */
  calculateMainScore(content, fileName) {
    let score = 0;
    const reasons = [];

    // ファイル名での判定（より積極的に）
    if (fileName === 'main' || fileName === 'main.md' || fileName === 'main.txt') {
      score += 0.8;  // Mainファイルは確実にMain分類
      reasons.push('ファイル名が "Main" と完全一致');
    } else if (fileName.includes('main') || fileName.includes('概要') || fileName.includes('overview')) {
      score += 0.4;
      reasons.push('ファイル名にMainキーワードを含む');
    }

    // 内容での判定
    const mainKeywords = [
      '目的', '目標', '概要', 'overview', 'main', '全体', '方向性', '戦略',
      'プロジェクト', 'project', '計画', 'plan', '構想', 'vision',
      '基本', 'basic', '根本', 'fundamental', '核心', 'core'
    ];

    let keywordCount = 0;
    mainKeywords.forEach(keyword => {
      if (content.includes(keyword)) {
        keywordCount++;
      }
    });

    if (keywordCount >= 3) {
      score += 0.5;
      reasons.push(`Mainキーワード${keywordCount}個を検出`);
    } else if (keywordCount >= 1) {
      score += 0.2;
      reasons.push(`Mainキーワード${keywordCount}個を検出`);
    }

    // 文書構造での判定
    if (content.includes('# ') && content.includes('## ')) {
      score += 0.2;
      reasons.push('階層的な文書構造を持つ');
    }

    return { score: Math.min(score, 1.0), reasons };
  }

  /**
   * Topic（分岐したトピック）スコアを計算
   */
  calculateTopicScore(content, fileName) {
    let score = 0;
    const reasons = [];

    // ファイル名での判定
    if (fileName.includes('topic') || fileName.includes('トピック') || fileName.includes('分岐') || fileName.includes('項目')) {
      score += 0.4;
      reasons.push('ファイル名にTopicキーワードを含む');
    }

    // 内容での判定
    const topicKeywords = [
      'トピック', 'topic', '項目', 'item', '課題', 'issue', '論点',
      '分岐', '選択肢', 'option', '候補', 'candidate', '案', 'idea',
      'リスト', 'list', '一覧', '種類', 'type', 'category'
    ];

    let keywordCount = 0;
    topicKeywords.forEach(keyword => {
      if (content.includes(keyword)) {
        keywordCount++;
      }
    });

    if (keywordCount >= 3) {
      score += 0.4;
      reasons.push(`Topicキーワード${keywordCount}個を検出`);
    } else if (keywordCount >= 1) {
      score += 0.2;
      reasons.push(`Topicキーワード${keywordCount}個を検出`);
    }

    // リスト構造での判定
    const listPatterns = [/^[-*+]\s/gm, /^\d+\.\s/gm];
    let listCount = 0;
    listPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches && matches.length >= 3) {
        listCount++;
      }
    });

    if (listCount > 0) {
      score += 0.3;
      reasons.push('リスト形式の内容を含む');
    }

    return { score: Math.min(score, 1.0), reasons };
  }

  /**
   * ForTech（技術系イシュー）スコアを計算
   */
  calculateTechScore(content, fileName) {
    let score = 0;
    const reasons = [];

    // ファイル名での判定
    if (fileName.includes('tech') || fileName.includes('技術') || fileName.includes('実装') || fileName.includes('開発')) {
      score += 0.4;
      reasons.push('ファイル名に技術キーワードを含む');
    }

    // 技術関連キーワード
    const techKeywords = [
      '技術', 'technology', 'tech', '実装', 'implementation', '開発', 'development',
      'プログラミング', 'programming', 'コード', 'code', 'システム', 'system',
      'アーキテクチャ', 'architecture', 'データベース', 'database', 'api',
      'フレームワーク', 'framework', 'ライブラリ', 'library', 'サーバー', 'server',
      'クラウド', 'cloud', 'インフラ', 'infrastructure', 'セキュリティ', 'security',
      'パフォーマンス', 'performance', 'バグ', 'bug', 'デバッグ', 'debug',
      'テスト', 'test', 'デプロイ', 'deploy', 'バージョン', 'version'
    ];

    let keywordCount = 0;
    techKeywords.forEach(keyword => {
      if (content.includes(keyword)) {
        keywordCount++;
      }
    });

    if (keywordCount >= 5) {
      score += 0.6;
      reasons.push(`技術キーワード${keywordCount}個を検出`);
    } else if (keywordCount >= 3) {
      score += 0.4;
      reasons.push(`技術キーワード${keywordCount}個を検出`);
    } else if (keywordCount >= 1) {
      score += 0.2;
      reasons.push(`技術キーワード${keywordCount}個を検出`);
    }

    // コード関連パターン
    if (content.includes('```') || content.includes('function') || content.includes('class')) {
      score += 0.3;
      reasons.push('コードブロックや技術的記述を含む');
    }

    return { score: Math.min(score, 1.0), reasons };
  }

  /**
   * ForAca（学術系イシュー）スコアを計算
   */
  calculateAcademicScore(content, fileName) {
    let score = 0;
    const reasons = [];

    // ファイル名での判定
    if (fileName.includes('academic') || fileName.includes('学術') || fileName.includes('研究') || fileName.includes('論文')) {
      score += 0.4;
      reasons.push('ファイル名に学術キーワードを含む');
    }

    // 学術関連キーワード
    const academicKeywords = [
      '学術', 'academic', '研究', 'research', '論文', 'paper', '文献', 'literature',
      '理論', 'theory', '仮説', 'hypothesis', '実験', 'experiment', '分析', 'analysis',
      '調査', 'survey', '手法', 'method', '手順', 'procedure', '結果', 'result',
      '考察', 'discussion', '結論', 'conclusion', '引用', 'citation', '参考', 'reference',
      '学会', 'conference', 'ジャーナル', 'journal', '査読', 'peer review',
      '統計', 'statistics', 'データ', 'data', '評価', 'evaluation', '検証', 'verification',
      '先行研究', '関連研究', 'related work', '新規性', 'novelty', '貢献', 'contribution'
    ];

    let keywordCount = 0;
    academicKeywords.forEach(keyword => {
      if (content.includes(keyword)) {
        keywordCount++;
      }
    });

    if (keywordCount >= 5) {
      score += 0.6;
      reasons.push(`学術キーワード${keywordCount}個を検出`);
    } else if (keywordCount >= 3) {
      score += 0.4;
      reasons.push(`学術キーワード${keywordCount}個を検出`);
    } else if (keywordCount >= 1) {
      score += 0.2;
      reasons.push(`学術キーワード${keywordCount}個を検出`);
    }

    // 学術的な文章構造
    if (content.includes('abstract') || content.includes('要約') || content.includes('introduction')) {
      score += 0.2;
      reasons.push('学術的な文章構造を含む');
    }

    // 引用や参考文献
    if (content.includes('[') && content.includes(']') && content.includes('http')) {
      score += 0.2;
      reasons.push('引用や参考文献を含む');
    }

    return { score: Math.min(score, 1.0), reasons };
  }

  /**
   * 整理されたドキュメントを作成
   */
  async createOrganizedDocuments(classificationResults, selectedCategories = null) {
    const organizedDocs = {};

    for (const [category, items] of Object.entries(classificationResults)) {
      // 選択されたカテゴリのみを処理
      if (selectedCategories && !selectedCategories[category]) {
        console.log(`Skipping category ${category} (not selected)`);
        continue;
      }
      
      if (items.length === 0) continue;

      let content = `# ${this.getCategoryTitle(category)}\n\n`;
      content += `生成日時: ${new Date().toLocaleString('ja-JP')}\n\n`;
      content += `## 概要\n\n${this.getCategoryDescription(category)}\n\n`;
      
      // デモ用の例文を追加
      content += `## ${category}の例文・サンプル\n\n`;
      content += `${this.getDemoContent(category)}\n\n`;
      
      content += `## 分類された内容\n\n`;

      items.forEach((item, index) => {
        content += `### ${index + 1}. ${item.document.fileName}\n\n`;
        content += `**信頼度**: ${(item.confidence * 100).toFixed(1)}%\n\n`;
        content += `**分類理由**: ${item.reasons.join(', ')}\n\n`;
        content += `**内容**:\n\n`;
        
        // 内容を適切な長さに制限
        const truncatedContent = item.document.content.length > 1000 
          ? item.document.content.substring(0, 1000) + '...\n\n[内容が長いため省略されました]'
          : item.document.content;
          
        content += `${truncatedContent}\n\n`;
        content += `---\n\n`;
      });

      // 統計情報を追加
      content += `## 統計情報\n\n`;
      content += `- 分類されたドキュメント数: ${items.length}件\n`;
      content += `- 平均信頼度: ${(items.reduce((sum, item) => sum + item.confidence, 0) / items.length * 100).toFixed(1)}%\n`;
      content += `- 最高信頼度: ${(Math.max(...items.map(item => item.confidence)) * 100).toFixed(1)}%\n\n`;

      organizedDocs[category] = {
        fileName: `${category}_${new Date().toISOString().split('T')[0]}.md`,
        content: content,
        itemCount: items.length
      };
    }

    return organizedDocs;
  }

  /**
   * カテゴリタイトルを取得
   */
  getCategoryTitle(category) {
    const titles = {
      Main: 'Main - 大きい方向性',
      Topic: 'Topic - 分岐したトピック一覧',
      ForTech: 'ForTech - 技術系のイシュー',
      ForAca: 'ForAca - 学術系のイシュー'
    };
    return titles[category] || category;
  }

  /**
   * カテゴリ説明を取得
   */
  getCategoryDescription(category) {
    const descriptions = {
      Main: 'プロジェクト全体の大きな方向性や基本方針に関する内容です。プロジェクトの目的、目標、全体構想などが含まれます。',
      Topic: '様々な分岐したトピックや課題項目に関する内容です。具体的な論点、選択肢、検討事項などが含まれます。',
      ForTech: '技術的な課題や実装に関する内容です。プログラミング、システム設計、技術選定などの技術系イシューが含まれます。',
      ForAca: '学術的な研究や論文に関する内容です。研究手法、理論、実験、分析などの学術系イシューが含まれます。'
    };
    return descriptions[category] || 'このカテゴリの内容です。';
  }

  /**
   * デモ用のコンテンツを取得
   */
  getDemoContent(category) {
    const demoContents = {
      Main: `**Main分類のサンプルテキスト**

このプロジェクトは、統合管理システムの構築を目的としています。全体的な方向性として、以下の戦略的目標を掲げています：

- **ビジョン**: 効率的で統合されたワークフロー管理の実現
- **ミッション**: 研究・開発・学術活動の生産性向上
- **コアバリュー**: 自動化、効率化、品質向上

プロジェクト全体の基本方針として、ユーザビリティと機能性のバランスを重視し、段階的な機能拡張を通じて持続可能なシステムを構築していきます。

**主要な成果物**:
1. 統合管理プラットフォーム
2. 自動処理エンジン  
3. ユーザーインターフェース
4. データ分析機能`,

      Topic: `**Topic分類のサンプルテキスト**

このカテゴリでは、プロジェクトに関連する様々なトピックや課題項目を整理しています：

### 🎯 主要トピック一覧

**1. ユーザーエクスペリエンス向上**
- インターフェース設計の改善
- レスポンシブデザインの実装
- アクセシビリティの確保

**2. データ管理戦略**  
- データベース設計の最適化
- バックアップ・復旧戦略
- セキュリティポリシーの策定

**3. 機能拡張計画**
- AI機能の統合
- 外部API連携
- モバイル対応

**4. 運用・保守体制**
- 監視システムの構築
- ログ管理の標準化  
- パフォーマンス最適化

各トピックは相互に関連しており、優先度と実装スケジュールを考慮して段階的に取り組んでいきます。`,

      ForTech: `**ForTech分類のサンプルテキスト**

技術的な実装詳細と開発イシューについて記載しています：

### 🔧 技術スタック

**フロントエンド**
- React.js + Vite
- Tailwind CSS
- JavaScript ES6+

**バックエンド**  
- Node.js + Express
- Google Drive API
- RESTful API設計

**データベース**
- Cloud Storage (Google Drive)
- JSON形式でのデータ管理
- リアルタイム同期機能

### 💻 実装課題

**1. API統合の最適化**
\`\`\`javascript
// Google Drive API呼び出しの最適化例
const optimizedApiCall = async (fileId) => {
  try {
    const response = await gapi.client.drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,modifiedTime'
    });
    return response.result;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};
\`\`\`

**2. パフォーマンス改善**
- 非同期処理の最適化
- メモリ使用量の削減
- レスポンス時間の短縮

**3. セキュリティ強化**
- 認証機能の実装
- データ暗号化
- アクセス制御の強化`,

      ForAca: `**ForAca分類のサンプルテキスト**

学術研究と論文作成に関連する内容を整理しています：

### 📚 研究アプローチ

**研究目的**
統合管理システムの開発における効率性と有効性の実証研究を行い、学術的な貢献を目指します。

**研究手法**
- **定量的分析**: システムの処理性能測定、ユーザー行動データの統計分析
- **定性的評価**: ユーザビリティテスト、インタビュー調査
- **比較研究**: 既存システムとの機能・性能比較

### 🔬 実験設計

**仮説**
「統合管理システムの導入により、研究・開発作業の効率性が有意に向上する」

**実験群と対照群**
- 実験群: 統合管理システム使用グループ
- 対照群: 従来手法使用グループ

**測定指標**
1. 作業完了時間の短縮率
2. エラー発生率の減少
3. ユーザー満足度スコア
4. システム利用継続率

### 📊 期待される成果

**学術的貢献**
- 統合管理システム分野への新たな知見提供
- 効率化手法の体系化
- ベストプラクティスの確立

**実践的価値**  
- 他の研究機関への応用可能性
- 産業界への技術転用
- 教育現場での活用事例`
    };
    
    return demoContents[category] || `${category}カテゴリのサンプルコンテンツです。`;
  }

  /**
   * 整理されたドキュメントをGoogle Driveに保存
   */
  async saveOrganizedDocuments(documentFolderId, organizedDocs) {
    try {
      for (const [category, docData] of Object.entries(organizedDocs)) {
        await this.saveTextFile(documentFolderId, docData.fileName, docData.content);
        console.log(`Saved organized document: ${docData.fileName}`);
      }
    } catch (error) {
      console.error('Failed to save organized documents:', error);
      throw error;
    }
  }

  /**
   * テキストファイルをGoogle Driveに保存
   */
  async saveTextFile(folderId, fileName, content) {
    try {
      const boundary = '-------314159265358979323846264338327950288419716939937510';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      const metadata = {
        'name': fileName,
        'parents': [folderId],
        'mimeType': 'text/plain'
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: text/plain\r\n\r\n' +
        content +
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

      return response.result;
    } catch (error) {
      console.error(`Failed to save text file ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * 整理結果レポートを作成・保存
   */
  async createOrganizationReport(documentFolderId, sourceDocuments, classificationResults, organizedDocs) {
    try {
      const reportContent = this.generateReportContent(sourceDocuments, classificationResults, organizedDocs);
      const reportFileName = `Organization_Report_${new Date().toISOString().split('T')[0]}.md`;
      
      const reportFile = await this.saveTextFile(documentFolderId, reportFileName, reportContent);
      console.log('Organization report created:', reportFile);
      
      return reportFile;
    } catch (error) {
      console.error('Failed to create organization report:', error);
      throw error;
    }
  }

  /**
   * レポート内容を生成
   */
  generateReportContent(sourceDocuments, classificationResults, organizedDocs) {
    const timestamp = new Date().toLocaleString('ja-JP');
    
    let content = `# Document自動整理レポート\n\n`;
    content += `**実行日時**: ${timestamp}\n\n`;
    
    // 処理サマリー
    content += `## 処理サマリー\n\n`;
    content += `- **分析対象ドキュメント数**: ${sourceDocuments.length}件\n`;
    content += `- **生成されたカテゴリ**: ${Object.keys(organizedDocs).length}件\n`;
    content += `- **総分類項目数**: ${Object.values(classificationResults).reduce((sum, items) => sum + items.length, 0)}件\n\n`;

    // カテゴリ別統計
    content += `## カテゴリ別統計\n\n`;
    Object.entries(classificationResults).forEach(([category, items]) => {
      if (items.length > 0) {
        const avgConfidence = items.reduce((sum, item) => sum + item.confidence, 0) / items.length;
        content += `### ${this.getCategoryTitle(category)}\n`;
        content += `- **分類されたドキュメント数**: ${items.length}件\n`;
        content += `- **平均信頼度**: ${(avgConfidence * 100).toFixed(1)}%\n`;
        content += `- **生成ファイル**: ${organizedDocs[category]?.fileName || 'なし'}\n\n`;
      }
    });

    // 分析対象ドキュメント一覧
    content += `## 分析対象ドキュメント一覧\n\n`;
    sourceDocuments.forEach((doc, index) => {
      content += `${index + 1}. **${doc.fileName}**\n`;
      content += `   - サイズ: ${doc.size ? `${Math.round(doc.size / 1024)}KB` : '不明'}\n`;
      content += `   - 最終更新: ${doc.modifiedTime ? new Date(doc.modifiedTime).toLocaleString('ja-JP') : '不明'}\n`;
      
      // このドキュメントがどのカテゴリに分類されたかを表示
      const classifications = [];
      Object.entries(classificationResults).forEach(([category, items]) => {
        const found = items.find(item => item.document.fileName === doc.fileName);
        if (found) {
          classifications.push(`${category}(${(found.confidence * 100).toFixed(1)}%)`);
        }
      });
      content += `   - 分類結果: ${classifications.join(', ') || 'なし'}\n\n`;
    });

    // 分類の詳細
    content += `## 分類の詳細\n\n`;
    Object.entries(classificationResults).forEach(([category, items]) => {
      if (items.length > 0) {
        content += `### ${this.getCategoryTitle(category)}\n\n`;
        items.forEach((item, index) => {
          content += `${index + 1}. **${item.document.fileName}**\n`;
          content += `   - 信頼度: ${(item.confidence * 100).toFixed(1)}%\n`;
          content += `   - 理由: ${item.reasons.join(', ')}\n\n`;
        });
      }
    });

    // 生成されたファイル
    content += `## 生成されたファイル\n\n`;
    Object.entries(organizedDocs).forEach(([category, docData]) => {
      content += `- **${docData.fileName}**: ${this.getCategoryTitle(category)} (${docData.itemCount}件の内容を含む)\n`;
    });

    content += `\n---\n\n`;
    content += `*このレポートは Document自動整理機能により自動生成されました。*\n`;
    content += `*整理されたドキュメントは同じDocumentフォルダ内に保存されています。*\n`;

    return content;
  }

  /**
   * 処理中かどうかを確認
   */
  isCurrentlyProcessing() {
    return this.isProcessing;
  }
}

// シングルトンインスタンスをエクスポート
const documentOrganizerService = new DocumentOrganizerService();
export default documentOrganizerService;
