import diffDetectionService from './diffDetection.js';

/**
 * フォルダ内容要約サービス
 * 各フォルダの処理内容と最新の変更を簡潔に表示
 */
class FolderContentSummaryService {
  constructor() {
    this.summaryCache = new Map(); // プロジェクトID -> フォルダ要約
  }

  /**
   * プロジェクトの全フォルダの要約を取得
   * @param {string} projectId - プロジェクトID
   * @param {Object} processingResults - AI処理結果（オプション）
   * @returns {Object} フォルダ要約情報
   */
  async getProjectFolderSummaries(projectId, processingResults = null) {
    const cacheKey = `${projectId}_${processingResults ? 'processed' : 'basic'}`;
    
    // キャッシュチェック
    if (this.summaryCache.has(cacheKey)) {
      return this.summaryCache.get(cacheKey);
    }

    const summaries = {};

    // 基本的なフォルダ情報を取得
    const lastScan = diffDetectionService.getLastScanResult(projectId);
    
    if (lastScan && lastScan.folders) {
      for (const [folderName, folderData] of Object.entries(lastScan.folders)) {
        summaries[folderName] = await this.generateFolderSummary(
          folderName, 
          folderData, 
          processingResults?.generatedContent?.[folderName]
        );
      }
    }

    // キャッシュに保存（5分間）
    this.summaryCache.set(cacheKey, summaries);
    setTimeout(() => {
      this.summaryCache.delete(cacheKey);
    }, 5 * 60 * 1000);

    return summaries;
  }

  /**
   * 単一フォルダの要約を生成
   * @param {string} folderName - フォルダ名
   * @param {Object} folderData - フォルダデータ
   * @param {Object} processingResult - AI処理結果（オプション）
   * @returns {Object} フォルダ要約
   */
  async generateFolderSummary(folderName, folderData, processingResult = null) {
    const summary = {
      folderName,
      fileCount: folderData.files?.length || 0,
      lastModified: folderData.lastModified,
      contentPreview: null,
      processingStatus: null,
      keyInsights: [],
      recentChanges: []
    };

    // ファイル情報から内容プレビューを生成
    summary.contentPreview = this.generateContentPreview(folderName, folderData.files);

    // AI処理結果がある場合は追加情報を含める
    if (processingResult) {
      summary.processingStatus = 'completed';
      summary.keyInsights = this.extractKeyInsights(folderName, processingResult);
      summary.generatedFiles = processingResult.generatedFiles || [];
    } else {
      summary.processingStatus = 'pending';
    }

    // 最近の変更を要約
    summary.recentChanges = this.summarizeRecentChanges(folderData.files);

    return summary;
  }

  /**
   * フォルダタイプに基づいて内容プレビューを生成
   */
  generateContentPreview(folderName, files) {
    if (!files || files.length === 0) {
      return '📄 ファイルがありません';
    }

    const fileTypes = this.analyzeFileTypes(files);
    
    switch (folderName) {
      case 'Document':
        return this.generateDocumentPreview(files, fileTypes);
      case 'Implementation':
        return this.generateImplementationPreview(files, fileTypes);
      case 'Presentation':
        return this.generatePresentationPreview(files, fileTypes);
      case 'Academia':
        return this.generateAcademiaPreview(files, fileTypes);
      case 'Paper':
        return this.generatePaperPreview(files, fileTypes);
      case 'Business':
        return this.generateBusinessPreview(files, fileTypes);
      case 'Reaching':
        return this.generateReachingPreview(files, fileTypes);
      case 'Material':
        return this.generateMaterialPreview(files, fileTypes);
      default:
        return `📁 ${files.length}個のファイル`;
    }
  }

  /**
   * ファイルタイプを分析
   */
  analyzeFileTypes(files) {
    const types = {
      documents: 0,
      images: 0,
      code: 0,
      presentations: 0,
      spreadsheets: 0,
      other: 0
    };

    files.forEach(file => {
      const name = file.name.toLowerCase();
      const mimeType = file.mimeType || '';

      if (mimeType.includes('document') || name.includes('.md') || name.includes('.txt')) {
        types.documents++;
      } else if (mimeType.includes('image') || ['.png', '.jpg', '.jpeg', '.gif'].some(ext => name.endsWith(ext))) {
        types.images++;
      } else if (['.js', '.py', '.java', '.cpp', '.ts', '.html', '.css'].some(ext => name.endsWith(ext))) {
        types.code++;
      } else if (mimeType.includes('presentation') || name.includes('.ppt')) {
        types.presentations++;
      } else if (mimeType.includes('spreadsheet') || name.includes('.xls') || name.includes('.csv')) {
        types.spreadsheets++;
      } else {
        types.other++;
      }
    });

    return types;
  }

  /**
   * フォルダ別プレビュー生成関数群
   */
  generateDocumentPreview(files, types) {
    const parts = [];
    if (types.documents > 0) parts.push(`📝 文書${types.documents}件`);
    if (types.other > 0) parts.push(`📄 その他${types.other}件`);
    
    const latestFile = files.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime))[0];
    if (latestFile) {
      parts.push(`\n最新: ${latestFile.name}`);
    }
    
    return parts.join(' • ');
  }

  generateImplementationPreview(files, types) {
    const parts = [];
    if (types.code > 0) parts.push(`💻 コード${types.code}件`);
    if (types.documents > 0) parts.push(`📋 仕様書${types.documents}件`);
    if (types.images > 0) parts.push(`🖼️ 図表${types.images}件`);
    
    const hasReadme = files.some(f => f.name.toLowerCase().includes('readme'));
    if (hasReadme) parts.push('📖 README');
    
    return parts.join(' • ') || `📁 ${files.length}個のファイル`;
  }

  generatePresentationPreview(files, types) {
    const parts = [];
    if (types.presentations > 0) parts.push(`📊 スライド${types.presentations}件`);
    if (types.images > 0) parts.push(`🖼️ 図表${types.images}件`);
    if (types.documents > 0) parts.push(`📄 資料${types.documents}件`);
    
    return parts.join(' • ') || `📁 ${files.length}個のファイル`;
  }

  generateAcademiaPreview(files, types) {
    const parts = [];
    if (types.documents > 0) parts.push(`📚 論文${types.documents}件`);
    if (types.spreadsheets > 0) parts.push(`📊 データ${types.spreadsheets}件`);
    if (types.images > 0) parts.push(`📈 図表${types.images}件`);
    
    const pdfCount = files.filter(f => f.name.toLowerCase().endsWith('.pdf')).length;
    if (pdfCount > 0) parts.push(`📄 PDF${pdfCount}件`);
    
    return parts.join(' • ') || `📁 ${files.length}個のファイル`;
  }

  generatePaperPreview(files, types) {
    const parts = [];
    const drafts = files.filter(f => f.name.toLowerCase().includes('draft')).length;
    const latex = files.filter(f => f.name.toLowerCase().includes('.tex')).length;
    
    if (drafts > 0) parts.push(`✏️ 草案${drafts}件`);
    if (latex > 0) parts.push(`📝 LaTeX${latex}件`);
    if (types.images > 0) parts.push(`📊 図表${types.images}件`);
    
    return parts.join(' • ') || `📁 ${files.length}個のファイル`;
  }

  generateBusinessPreview(files, types) {
    const parts = [];
    if (types.spreadsheets > 0) parts.push(`📊 分析${types.spreadsheets}件`);
    if (types.presentations > 0) parts.push(`💼 提案${types.presentations}件`);
    if (types.documents > 0) parts.push(`📋 計画${types.documents}件`);
    
    return parts.join(' • ') || `📁 ${files.length}個のファイル`;
  }

  generateReachingPreview(files, types) {
    const parts = [];
    if (types.spreadsheets > 0) parts.push(`📅 イベント${types.spreadsheets}件`);
    if (types.documents > 0) parts.push(`📝 応募書類${types.documents}件`);
    
    return parts.join(' • ') || `📁 ${files.length}個のファイル`;
  }

  generateMaterialPreview(files, types) {
    const parts = [];
    if (types.images > 0) parts.push(`🖼️ 画像${types.images}件`);
    if (types.documents > 0) parts.push(`📄 素材${types.documents}件`);
    if (types.other > 0) parts.push(`📦 その他${types.other}件`);
    
    return parts.join(' • ') || `📁 ${files.length}個のファイル`;
  }

  /**
   * AI処理結果からキーインサイトを抽出
   */
  extractKeyInsights(folderName, processingResult) {
    const insights = [];

    switch (folderName) {
      case 'Document':
        if (processingResult.summary) insights.push('📝 要約生成完了');
        if (processingResult.outline) insights.push('📋 アウトライン更新');
        if (processingResult.duplicateAnalysis) insights.push('🔍 重複箇所特定');
        break;
        
      case 'Implementation':
        if (processingResult.changeLog) insights.push('📈 変更履歴更新');
        if (processingResult.specification) insights.push('📋 仕様書生成');
        if (processingResult.architecture) insights.push('🏗️ アーキテクチャ図作成');
        break;
        
      case 'Presentation':
        if (processingResult.slideDraft) insights.push('🎯 スライド草案作成');
        if (processingResult.charts) insights.push(`📊 図表${processingResult.charts.length}件生成`);
        if (processingResult.crossFolderAnalysis) insights.push('🔄 クロス分析実行');
        break;
        
      default:
        if (processingResult.generatedFiles?.length > 0) {
          insights.push(`✨ ${processingResult.generatedFiles.length}件のファイル生成`);
        }
    }

    return insights;
  }

  /**
   * 最近の変更を要約
   */
  summarizeRecentChanges(files) {
    if (!files || files.length === 0) return [];

    const now = new Date();
    const recentFiles = files.filter(file => {
      const modifiedTime = new Date(file.modifiedTime);
      const hoursDiff = (now - modifiedTime) / (1000 * 60 * 60);
      return hoursDiff <= 24; // 24時間以内
    });

    return recentFiles.slice(0, 3).map(file => ({
      name: file.name,
      modifiedTime: file.modifiedTime,
      changeType: 'modified'
    }));
  }

  /**
   * キャッシュをクリア
   */
  clearCache() {
    this.summaryCache.clear();
  }
}

// シングルトンインスタンスをエクスポート
const folderContentSummaryService = new FolderContentSummaryService();
export default folderContentSummaryService;

