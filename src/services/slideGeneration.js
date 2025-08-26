import pptxgen from 'pptxgenjs';

/**
 * スライド生成サービス
 * Documentフォルダの内容を読み込んでPresentationフォルダにPPTXファイルを生成
 */
class SlideGenerationService {
  constructor() {
    this.isProcessing = false;
  }

  /**
   * メイン処理：Documentフォルダを読み込んでスライドを生成
   * @param {string} projectId - プロジェクトID
   * @param {Function} onProgress - 進捗コールバック
   * @returns {Object} 処理結果
   */
  async generateSlidePresentation(projectId, onProgress = null) {
    if (this.isProcessing) {
      throw new Error('既にスライド生成処理中です');
    }

    this.isProcessing = true;
    const result = {
      success: false,
      sourceDocuments: [],
      slideFile: null,
      error: null
    };

    try {
      // 1. プロジェクトの構造を取得
      if (onProgress) onProgress({ stage: 'scanning', progress: 10, message: 'プロジェクト構造を取得中...' });
      const projectStructure = await this.getProjectStructure(projectId);

      // 2. DocumentフォルダからMainドキュメントを読み込み
      if (onProgress) onProgress({ stage: 'reading', progress: 30, message: 'Documentフォルダを読み込み中...' });
      const documents = await this.readDocumentFolder(projectStructure.documentFolder);
      
      if (!documents || documents.length === 0) {
        const errorDetails = await this.generateDetailedErrorMessage(projectStructure.documentFolder);
        throw new Error(errorDetails);
      }
      result.sourceDocuments = documents;

      // 3. Presentationフォルダを取得
      if (onProgress) onProgress({ stage: 'preparing', progress: 50, message: 'Presentationフォルダを準備中...' });
      const presentationFolder = projectStructure.presentationFolder;
      if (!presentationFolder) {
        throw new Error('Presentationフォルダが見つかりません');
      }

      // 4. スライド内容を生成
      if (onProgress) onProgress({ stage: 'generating', progress: 70, message: 'スライド内容を生成中...' });
      const slideContent = await this.generateSlideContent(documents);

      // 5. PPTXファイルを作成
      if (onProgress) onProgress({ stage: 'creating', progress: 85, message: 'PPTXファイルを作成中...' });
      const pptxBlob = await this.createPPTXFile(slideContent);

      // 6. Google Driveに保存
      if (onProgress) onProgress({ stage: 'saving', progress: 95, message: 'Google Driveに保存中...' });
      const slideFile = await this.savePPTXToGoogleDrive(presentationFolder.id, pptxBlob);
      result.slideFile = slideFile;

      if (onProgress) onProgress({ stage: 'completed', progress: 100, message: 'スライド生成が完了しました！' });
      result.success = true;

    } catch (error) {
      console.error('Slide generation failed:', error);
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
      const presentationFolder = folders.find(folder => folder.name === 'Presentation');

      return {
        documentFolder,
        presentationFolder,
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
      return null;
    }

    try {
      console.log('Reading Document folder contents:', documentFolder.id);
      
      // Documentフォルダ内のファイルを取得
      const response = await window.gapi.client.drive.files.list({
        q: `'${documentFolder.id}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size, modifiedTime)',
        orderBy: 'modifiedTime desc'
      });

      console.log('Files found in Document folder:', response.result.files);

      if (!response.result.files || response.result.files.length === 0) {
        console.warn('No files found in Document folder');
        return null;
      }

      // ドキュメントファイルのみを対象とする
      const documentFiles = response.result.files.filter(file => 
        this.isDocumentFile(file)
      );

      if (documentFiles.length === 0) {
        console.warn('No document files found');
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
            isMain: file.name.toLowerCase().includes('main')
          });
        } catch (error) {
          console.warn(`Failed to read file ${file.name}:`, error);
          // ファイル読み込みに失敗しても処理を続行
        }
      }

      return documents.length > 0 ? documents : null;
    } catch (error) {
      console.error('Failed to read Document folder:', error);
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
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
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
      console.log(`Reading content from file: ${file.name} (${file.mimeType})`);

      // Google Docsの場合は特別な処理
      if (file.mimeType === 'application/vnd.google-apps.document') {
        console.log('Reading Google Docs file');
        const response = await window.gapi.client.drive.files.export({
          fileId: file.id,
          mimeType: 'text/plain'
        });
        return response.body;
      }

      // 通常のファイルの場合
      const response = await window.gapi.client.drive.files.get({
        fileId: file.id,
        alt: 'media'
      });

      return response.body || '';
    } catch (error) {
      console.error(`Failed to read file content for ${file.name}:`, error);
      
      // フォールバック：ファイル名とメタデータから推測される内容を返す
      return `# ${file.name}\n\n[このファイルの内容を読み取ることができませんでしたが、ファイル名から推測される内容に基づいてスライドを生成します]\n\nファイル名: ${file.name}\nファイルタイプ: ${file.mimeType}\n最終更新: ${file.modifiedTime || '不明'}`;
    }
  }

  /**
   * スライド内容を生成
   */
  async generateSlideContent(documents) {
    console.log('Generating slide content from documents:', documents.length);

    // Mainドキュメントを優先的に使用
    const mainDoc = documents.find(doc => doc.isMain) || documents[0];
    const content = mainDoc.content;

    // コンテンツを分析してスライド構造を生成
    const slideStructure = this.analyzeContentForSlides(content, mainDoc.fileName);

    console.log('Generated slide structure:', slideStructure);
    return slideStructure;
  }

  /**
   * コンテンツを分析してスライド構造を生成
   */
  analyzeContentForSlides(content, fileName) {
    const slides = [];

    // タイトルスライド
    slides.push({
      type: 'title',
      title: this.extractProjectTitle(content, fileName),
      subtitle: `生成日時: ${new Date().toLocaleString('ja-JP')}`,
      content: ''
    });

    // コンテンツを見出しで分割
    const sections = this.extractSections(content);
    
    if (sections.length > 0) {
      sections.forEach((section, index) => {
        slides.push({
          type: 'content',
          title: section.title || `セクション ${index + 1}`,
          content: section.content,
          bulletPoints: section.bulletPoints
        });
      });
    } else {
      // 見出しがない場合は内容を段落で分割
      const paragraphs = this.splitIntoParagraphs(content);
      paragraphs.forEach((paragraph, index) => {
        if (paragraph.trim().length > 0) {
          slides.push({
            type: 'content',
            title: `内容 ${index + 1}`,
            content: paragraph,
            bulletPoints: this.extractBulletPoints(paragraph)
          });
        }
      });
    }

    // まとめスライド
    slides.push({
      type: 'summary',
      title: 'まとめ',
      content: this.generateSummary(content),
      bulletPoints: this.generateKeyPoints(content)
    });

    return slides;
  }

  /**
   * プロジェクトタイトルを抽出
   */
  extractProjectTitle(content, fileName) {
    // 最初の見出しを探す
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return trimmed.substring(2).trim();
      }
      if (trimmed.length > 0 && trimmed.length < 100) {
        return trimmed;
      }
    }
    
    // ファイル名からタイトルを生成
    return fileName.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
  }

  /**
   * セクションを抽出
   */
  extractSections(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // 見出しを検出
      if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: trimmed.replace(/^#+\s*/, ''),
          content: '',
          bulletPoints: []
        };
      } else if (currentSection) {
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          currentSection.bulletPoints.push(trimmed.substring(2));
        } else if (trimmed.length > 0) {
          currentSection.content += (currentSection.content ? '\n' : '') + trimmed;
        }
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * 段落に分割
   */
  splitIntoParagraphs(content) {
    return content.split('\n\n').filter(p => p.trim().length > 0);
  }

  /**
   * 箇条書きポイントを抽出
   */
  extractBulletPoints(text) {
    const lines = text.split('\n');
    const bulletPoints = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        bulletPoints.push(trimmed.substring(2));
      }
    }
    
    return bulletPoints;
  }

  /**
   * まとめを生成
   */
  generateSummary(content) {
    const sentences = content.split(/[.。]/);
    const importantSentences = sentences
      .filter(s => s.trim().length > 20)
      .slice(0, 3)
      .map(s => s.trim() + '。');
    
    return importantSentences.join('\n');
  }

  /**
   * キーポイントを生成
   */
  generateKeyPoints(content) {
    const keyWords = ['目的', '目標', '特徴', '機能', '効果', '結果', '課題', '解決'];
    const lines = content.split('\n');
    const keyPoints = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (keyWords.some(word => trimmed.includes(word)) && trimmed.length < 100) {
        keyPoints.push(trimmed);
      }
    }

    return keyPoints.slice(0, 5);
  }

  /**
   * PPTXファイルを作成
   */
  async createPPTXFile(slideStructure) {
    console.log('Creating PPTX file with structure:', slideStructure);

    const pptx = new pptxgen();
    
    // プレゼンテーションの設定
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'Integrated Manager';
    pptx.company = 'Auto Generated';
    pptx.title = slideStructure[0]?.title || 'プレゼンテーション';

    // 各スライドを作成
    slideStructure.forEach((slideData, index) => {
      const slide = pptx.addSlide();
      
      if (slideData.type === 'title') {
        this.createTitleSlide(slide, slideData);
      } else if (slideData.type === 'summary') {
        this.createSummarySlide(slide, slideData);
      } else {
        this.createContentSlide(slide, slideData);
      }
    });

    // PPTXファイルをBlobとして生成
    try {
      const pptxBlob = await pptx.write('blob');
      console.log('PPTX file created successfully, size:', pptxBlob.size);
      return pptxBlob;
    } catch (error) {
      console.error('Failed to create PPTX file:', error);
      throw error;
    }
  }

  /**
   * タイトルスライドを作成
   */
  createTitleSlide(slide, slideData) {
    slide.addText(slideData.title, {
      x: 1,
      y: 2,
      w: 8,
      h: 2,
      fontSize: 32,
      bold: true,
      align: 'center',
      color: '363636'
    });

    slide.addText(slideData.subtitle, {
      x: 1,
      y: 4,
      w: 8,
      h: 1,
      fontSize: 16,
      align: 'center',
      color: '666666'
    });

    // 背景色を設定
    slide.background = { color: 'F8F9FA' };
  }

  /**
   * コンテンツスライドを作成
   */
  createContentSlide(slide, slideData) {
    // タイトル
    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 1,
      fontSize: 24,
      bold: true,
      color: '2C3E50'
    });

    let yPosition = 1.5;

    // 本文がある場合
    if (slideData.content && slideData.content.trim().length > 0) {
      slide.addText(slideData.content, {
        x: 0.5,
        y: yPosition,
        w: 9,
        h: 2,
        fontSize: 14,
        color: '34495E',
        valign: 'top'
      });
      yPosition += 2.5;
    }

    // 箇条書きがある場合
    if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
      const bulletText = slideData.bulletPoints
        .slice(0, 5)  // 最大5個まで
        .map(point => `• ${point}`)
        .join('\n');

      slide.addText(bulletText, {
        x: 0.5,
        y: yPosition,
        w: 9,
        h: 3,
        fontSize: 16,
        color: '2C3E50',
        valign: 'top'
      });
    }
  }

  /**
   * まとめスライドを作成
   */
  createSummarySlide(slide, slideData) {
    // タイトル
    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 1,
      fontSize: 24,
      bold: true,
      color: '2C3E50'
    });

    // まとめ内容
    if (slideData.content) {
      slide.addText(slideData.content, {
        x: 0.5,
        y: 1.5,
        w: 9,
        h: 2,
        fontSize: 14,
        color: '34495E'
      });
    }

    // キーポイント
    if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
      const keyPointsText = slideData.bulletPoints
        .map(point => `✓ ${point}`)
        .join('\n');

      slide.addText(keyPointsText, {
        x: 0.5,
        y: 4,
        w: 9,
        h: 2.5,
        fontSize: 16,
        color: '27AE60',
        bold: true
      });
    }

    // 背景色を設定
    slide.background = { color: 'F0F8F0' };
  }

  /**
   * PPTXファイルをGoogle Driveに保存
   */
  async savePPTXToGoogleDrive(folderId, pptxBlob) {
    try {
      const fileName = `Presentation_${new Date().toISOString().split('T')[0]}.pptx`;
      console.log(`Saving PPTX file "${fileName}" to folder:`, folderId);

      // Blobを Base64 に変換
      const base64Data = await this.blobToBase64(pptxBlob);
      
      // Google Drive API でファイルをアップロード
      const boundary = '-------314159265358979323846264338327950288419716939937510';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      const metadata = {
        'name': fileName,
        'parents': [folderId],
        'mimeType': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation\r\n' +
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

      console.log('PPTX file uploaded successfully:', response.result);
      return response.result;
      
    } catch (error) {
      console.error('Failed to save PPTX file to Google Drive:', error);
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
   * 詳細なエラーメッセージを生成
   */
  async generateDetailedErrorMessage(documentFolder) {
    let message = 'Documentフォルダの読み込みに失敗しました。\n\n';

    if (!documentFolder) {
      return message + '原因: Documentフォルダが存在しません。\n\n対処法:\n1. プロジェクトにDocumentフォルダを作成してください\n2. フォルダ内にドキュメントファイルを追加してください';
    }

    try {
      const response = await window.gapi.client.drive.files.list({
        q: `'${documentFolder.id}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)',
        orderBy: 'name'
      });

      const files = response.result.files || [];
      
      if (files.length === 0) {
        message += '原因: Documentフォルダが空です。\n\n';
        message += '対処法:\n';
        message += '1. Documentフォルダにドキュメントファイルを作成してください\n';
        message += '2. Google Docs、テキストファイル(.txt)、Markdownファイル(.md)が対応しています';
      } else {
        const docFiles = files.filter(file => this.isDocumentFile(file));
        if (docFiles.length === 0) {
          message += `原因: Documentフォルダに${files.length}個のファイルがありますが、対応するドキュメントファイルが見つかりません。\n\n`;
          message += '対処法:\n';
          message += '1. Google Docs、テキストファイル、Markdownファイルを追加してください\n';
          message += '2. 既存ファイルの形式を確認してください';
        } else {
          message += `読み込み可能なドキュメント${docFiles.length}件が見つかりましたが、内容の読み取りに失敗しました。\n\n`;
          message += '対処法:\n';
          message += '1. ファイルの権限を確認してください\n';
          message += '2. ファイルが破損していないか確認してください';
        }
      }
    } catch (error) {
      message += `原因: Documentフォルダへのアクセスに失敗しました (${error.message})\n\n`;
      message += '対処法:\n';
      message += '1. Google Driveへの権限を確認してください\n';
      message += '2. ブラウザを再読み込みして再度サインインしてください';
    }

    return message;
  }

  /**
   * 処理中かどうかを確認
   */
  isCurrentlyProcessing() {
    return this.isProcessing;
  }
}

// シングルトンインスタンスをエクスポート
const slideGenerationService = new SlideGenerationService();
export default slideGenerationService;



