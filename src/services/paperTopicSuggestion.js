/**
 * 論文トピック提案サービス
 * Mainドキュメントを読み込んでAcademia/Paper Topic Suggestionに提案を生成
 */
import openaiService from './openaiService.js';

class PaperTopicSuggestionService {
  constructor() {
    this.isProcessing = false;
  }

  /**
   * メイン処理：Mainドキュメントを読み込んで論文トピック提案を生成
   * @param {string} projectId - プロジェクトID
   * @param {Function} onProgress - 進捗コールバック
   * @returns {Object} 処理結果
   */
  async generatePaperTopicSuggestion(projectId, onProgress = null) {
    if (this.isProcessing) {
      throw new Error('既に処理中です');
    }

    this.isProcessing = true;
    const result = {
      success: false,
      mainDocument: null,
      suggestionFile: null,
      error: null
    };

    try {
      // 1. プロジェクトの構造を取得
      if (onProgress) onProgress({ stage: 'scanning', progress: 10, message: 'プロジェクト構造を取得中...' });
      const projectStructure = await this.getProjectStructure(projectId);

      // 2. DocumentフォルダからMainドキュメントを検索・読み込み
      if (onProgress) onProgress({ stage: 'reading', progress: 30, message: 'Mainドキュメントを検索中...' });
      const mainDocument = await this.findAndReadMainDocument(projectStructure.documentFolder);
      
      if (!mainDocument) {
        // より詳細なエラーメッセージを生成
        const errorDetails = await this.generateDetailedErrorMessage(projectStructure.documentFolder);
        throw new Error(errorDetails);
      }
      result.mainDocument = mainDocument;

      // 3. Academiaフォルダを取得
      if (onProgress) onProgress({ stage: 'preparing', progress: 50, message: 'Academiaフォルダを準備中...' });
      const academiaFolder = projectStructure.academiaFolder;
      if (!academiaFolder) {
        throw new Error('Academiaフォルダが見つかりません');
      }

      // 4. Paper Topic Suggestionフォルダを作成または取得
      if (onProgress) onProgress({ stage: 'creating', progress: 60, message: 'Paper Topic Suggestionフォルダを準備中...' });
      const suggestionFolderId = await this.createOrGetPaperTopicFolder(academiaFolder.id);

      // 5. 論文トピック提案を生成
      if (onProgress) onProgress({ stage: 'generating', progress: 80, message: '論文トピック提案を生成中...' });
      
      // OpenAI API設定のチェック
      if (!openaiService.isConfigured()) {
        throw new Error('OpenAI API設定が完了していません。設定画面でAPIキーを入力してください。');
      }
      
      const suggestionContent = await this.generateSuggestionContent(mainDocument);

      // 6. Suggestionドキュメントを作成・保存
      if (onProgress) onProgress({ stage: 'saving', progress: 90, message: 'Suggestionドキュメントを保存中...' });
      const suggestionFile = await this.saveSuggestionDocument(suggestionFolderId, suggestionContent);
      result.suggestionFile = suggestionFile;

      // 7. ファイル作成の確認
      if (onProgress) onProgress({ stage: 'verifying', progress: 95, message: 'ファイル作成を確認中...' });
      const verification = await this.verifyFileCreation(suggestionFolderId, suggestionFile.id);
      if (!verification.success) {
        console.warn('File verification failed:', verification.message);
      } else {
        console.log('File creation verified successfully:', verification.details);
      }

      if (onProgress) onProgress({ stage: 'completed', progress: 100, message: '論文トピック提案が完了しました！' });
      result.success = true;

    } catch (error) {
      console.error('Paper topic suggestion failed:', error);
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
   * DocumentフォルダからMainドキュメントを検索・読み込み
   */
  async findAndReadMainDocument(documentFolder) {
    if (!documentFolder) {
      console.warn('Document folder not provided');
      return null;
    }

    try {
      console.log('Searching for files in Document folder:', documentFolder.id);
      
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

      // より柔軟なMainファイル検索
      const mainFile = this.findMainFile(response.result.files);

      if (!mainFile) {
        console.warn('Main document not found. Available files:', 
          response.result.files.map(f => f.name));
        return null;
      }

      console.log('Main document found:', mainFile.name);

      // ファイル内容を読み込み（権限エラー対策）
      const content = await this.readFileContent(mainFile);
      
      return {
        fileName: mainFile.name,
        content: content,
        fileId: mainFile.id,
        mimeType: mainFile.mimeType
      };
    } catch (error) {
      console.error('Failed to read Main document:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        code: error.code
      });
      return null;
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
      
      // プロジェクト関連の名前
      (file) => file.name.toLowerCase().includes('project') && file.name.toLowerCase().includes('main'),
      (file) => file.name.toLowerCase().includes('overview') || file.name.toLowerCase().includes('概要'),
      (file) => file.name.toLowerCase().includes('readme'),
      
      // 最初のドキュメントファイル（フォールバック）
      (file) => this.isDocumentFile(file)
    ];

    for (const pattern of searchPatterns) {
      const found = files.find(file => 
        this.isDocumentFile(file) && pattern(file)
      );
      if (found) {
        console.log(`Main file found using pattern:`, found.name);
        return found;
      }
    }

    return null;
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
   * ファイル内容を読み込み（エラー処理強化版）
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
      
      // 403エラーの場合は権限不足の可能性
      if (error.status === 403) {
        console.warn('Permission denied. Trying alternative approach...');
        
        // Google Docsファイルの場合、exportを試す
        if (file.mimeType === 'application/vnd.google-apps.document') {
          try {
            const exportResponse = await window.gapi.client.drive.files.export({
              fileId: file.id,
              mimeType: 'text/plain'
            });
            return exportResponse.body;
          } catch (exportError) {
            console.error('Export also failed:', exportError);
          }
        }
      }

      // フォールバック：ファイル名とメタデータから推測される内容を返す
      return `# ${file.name}\n\n[このファイルの内容を読み取ることができませんでしたが、ファイル名から推測される内容に基づいて論文トピックを提案します]\n\nファイル名: ${file.name}\nファイルタイプ: ${file.mimeType}\n最終更新: ${file.modifiedTime || '不明'}`;
    }
  }

  /**
   * Paper Topic Suggestionフォルダを作成または取得
   */
  async createOrGetPaperTopicFolder(academiaFolderId) {
    try {
      const folderName = 'Paper Topic Suggestion';
      
      // 既存のフォルダを検索
      const searchResponse = await window.gapi.client.drive.files.list({
        q: `name='${folderName}' and '${academiaFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)'
      });

      if (searchResponse.result.files.length > 0) {
        return searchResponse.result.files[0].id;
      }

      // フォルダが存在しない場合は新規作成
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [academiaFolderId]
      };

      const createResponse = await window.gapi.client.drive.files.create({
        resource: folderMetadata,
        fields: 'id'
      });

      return createResponse.result.id;
    } catch (error) {
      console.error('Failed to create Paper Topic Suggestion folder:', error);
      throw error;
    }
  }

  /**
   * 論文トピック提案の内容を生成
   */
  async generateSuggestionContent(mainDocument) {
    const timestamp = new Date().toLocaleString('ja-JP');
    const content = mainDocument.content || '';
    
    try {
      // OpenAI APIを使用して論文トピック提案を生成
      const aiGeneratedContent = await openaiService.generatePaperTopicSuggestion(content, mainDocument.fileName);
      
      // 生成された内容をベースに、メタデータを追加
      return `# 論文トピック提案

**生成日時**: ${timestamp}  
**ベースドキュメント**: ${mainDocument.fileName}  
**文字数**: ${content.length}文字  
**生成方法**: OpenAI API (GPT-4)

---

${aiGeneratedContent}

---

*この論文トピック提案は、「${mainDocument.fileName}」の内容分析に基づいてOpenAI APIにより自動生成されました。*  
*実際の研究テーマ決定には、指導教員や専門家との詳細な議論が必要です。*  
*各トピックについて、さらに具体的な研究計画の策定をお勧めします。*

---
**生成システム**: Paper Topic Suggestion Generator with OpenAI API  
**バージョン**: 2.0  
**最終更新**: ${timestamp}
`;
    } catch (error) {
      console.error('AI generation failed, falling back to template:', error);
      
      // フォールバック: 従来のテンプレートベース生成
      const wordCount = content.length;
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      const keyPoints = this.extractKeyPoints(content);
      const themes = this.identifyThemes(content);

      return `# 論文トピック提案

**生成日時**: ${timestamp}  
**ベースドキュメント**: ${mainDocument.fileName}  
**文字数**: ${wordCount}文字  
**生成方法**: テンプレートベース (AI API利用不可)

---

## 📋 ドキュメント分析結果

### 主要なポイント
${keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}

### 特定されたテーマ
${themes.map(theme => `- **${theme.category}**: ${theme.description}`).join('\n')}

---

## 🎓 提案論文トピック

### 1. 技術革新・システム開発に関する研究
**推奨タイトル**: 「${this.generateTitle('tech', content)}」

**研究概要**:  
本プロジェクトで採用されている技術的アプローチや開発手法の新規性と有効性を学術的に検証する研究。

---

### 2. プロジェクト管理・開発プロセスに関する研究
**推奨タイトル**: 「${this.generateTitle('process', content)}」

**研究概要**:  
本プロジェクトの実行過程で得られた管理手法、開発プロセスの効果を分析する研究。

---

### 3. ユーザーエクスペリエンス・インターフェース設計に関する研究
**推奨タイトル**: 「${this.generateTitle('ux', content)}」

**研究概要**:  
プロジェクトにおけるUI/UX設計の効果測定と、ユーザビリティ向上要因の分析研究。

---

### 4. システムアーキテクチャ・設計手法に関する研究
**推奨タイトル**: 「${this.generateTitle('architecture', content)}」

**研究概要**:  
プロジェクトで採用されたシステムアーキテクチャ設計手法の有効性を評価する研究。

---

### 5. 学際的・応用領域に関する研究
**推奨タイトル**: 「${this.generateTitle('interdisciplinary', content)}」

**研究概要**:  
本プロジェクトが対象とする応用領域における課題解決アプローチの学術的分析。

---

*この論文トピック提案は、「${mainDocument.fileName}」の内容分析に基づいてテンプレートにより生成されました。*  
*より詳細な提案のためには、OpenAI API設定を完了してください。*

---
**生成システム**: Paper Topic Suggestion Generator (Template Mode)  
**バージョン**: 1.0  
**最終更新**: ${timestamp}
`;
    }
  }

  /**
   * コンテンツからキーポイントを抽出
   */
  extractKeyPoints(content) {
    const lines = content.split('\n').filter(line => line.trim().length > 10);
    const keyPoints = [];
    
    // 見出しっぽい行を優先的に抽出
    const headings = lines.filter(line => 
      line.startsWith('#') || 
      line.includes('目的') || 
      line.includes('概要') || 
      line.includes('特徴') ||
      line.includes('機能')
    );
    
    if (headings.length > 0) {
      keyPoints.push(...headings.slice(0, 3).map(h => h.replace(/^#+\s*/, '')));
    }
    
    // その他の重要そうな行を抽出
    const importantLines = lines.filter(line => 
      !line.startsWith('#') && 
      (line.includes('システム') || 
       line.includes('開発') || 
       line.includes('実装') ||
       line.includes('設計') ||
       line.includes('技術'))
    );
    
    keyPoints.push(...importantLines.slice(0, 2));
    
    return keyPoints.slice(0, 5).map(point => 
      point.length > 80 ? point.substring(0, 80) + '...' : point
    );
  }

  /**
   * コンテンツからテーマを特定
   */
  identifyThemes(content) {
    const themes = [];
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('システム') || lowerContent.includes('アーキテクチャ')) {
      themes.push({ category: 'システム設計', description: 'システム構成やアーキテクチャに関する内容' });
    }
    
    if (lowerContent.includes('ui') || lowerContent.includes('ux') || lowerContent.includes('インターフェース')) {
      themes.push({ category: 'ユーザビリティ', description: 'ユーザーインターフェースや体験に関する内容' });
    }
    
    if (lowerContent.includes('開発') || lowerContent.includes('実装') || lowerContent.includes('プログラム')) {
      themes.push({ category: '開発手法', description: 'ソフトウェア開発やプログラミングに関する内容' });
    }
    
    if (lowerContent.includes('管理') || lowerContent.includes('プロジェクト') || lowerContent.includes('運用')) {
      themes.push({ category: 'プロジェクト管理', description: 'プロジェクト運営や管理に関する内容' });
    }
    
    if (lowerContent.includes('ai') || lowerContent.includes('機械学習') || lowerContent.includes('人工知能')) {
      themes.push({ category: 'AI・機械学習', description: '人工知能や機械学習技術に関する内容' });
    }
    
    if (themes.length === 0) {
      themes.push({ category: '一般的な研究', description: 'プロジェクト全般に関する研究テーマ' });
    }
    
    return themes;
  }

  /**
   * カテゴリに応じた論文タイトルを生成
   */
  generateTitle(category, content) {
    const baseTitles = {
      tech: '革新的技術統合システムの設計と実装効果に関する実証研究',
      process: 'アジャイル開発プロセスにおける効率化手法の提案と評価',
      ux: 'ユーザーエクスペリエンス向上を目指したインターフェース設計手法の研究',
      architecture: '拡張可能なシステムアーキテクチャ設計原則の提案と検証',
      interdisciplinary: '情報技術を活用した領域横断的問題解決手法の研究'
    };
    
    return baseTitles[category] || '統合システム開発における新規アプローチの実証的研究';
  }

  /**
   * Suggestionドキュメントを保存
   */
  async saveSuggestionDocument(folderId, content) {
    try {
      const fileName = 'Suggestion';
      console.log(`Creating file "${fileName}" in folder:`, folderId);
      console.log('Content length:', content.length);
      
      // 既存のSuggestionファイルがあるかチェック
      console.log('Checking for existing Suggestion files...');
      const existingResponse = await window.gapi.client.drive.files.list({
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, webViewLink)'
      });

      console.log('Existing files found:', existingResponse.result.files);

      if (existingResponse.result.files.length > 0) {
        // 既存ファイルを更新
        const existingFile = existingResponse.result.files[0];
        console.log('Updating existing file:', existingFile.name, existingFile.id);
        
        try {
          // Google Docsファイルとして更新
          const updateResponse = await window.gapi.client.request({
            path: `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}`,
            method: 'PATCH',
            params: {
              uploadType: 'media'
            },
            headers: {
              'Content-Type': 'text/plain'
            },
            body: content
          });
          
          console.log('File updated successfully:', updateResponse);
          
          // 更新されたファイル情報を取得
          const fileInfo = await window.gapi.client.drive.files.get({
            fileId: existingFile.id,
            fields: 'id, name, webViewLink, mimeType'
          });
          
          console.log('Updated file info:', fileInfo.result);
          return fileInfo.result;
        } catch (updateError) {
          console.error('Failed to update existing file:', updateError);
          // 更新に失敗した場合は新しいファイルを作成
        }
      }

      // 新規ファイルを作成（直接テキストファイルとして）
      console.log('Creating new text file...');
      return await this.createTextFile(folderId, fileName, content);
      
    } catch (error) {
      console.error('Failed to save Suggestion document:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        code: error.code
      });
      throw error;
    }
  }

  /**
   * テキストファイルとして作成（確実な方法）
   */
  async createTextFile(folderId, fileName, content) {
    try {
      console.log('Creating text file with simple method...');
      
      // まずファイルのメタデータのみで作成
      const fileMetadata = {
        name: fileName,
        parents: [folderId],
        mimeType: 'text/plain'
      };

      console.log('Creating file metadata:', fileMetadata);
      
      const createResponse = await window.gapi.client.drive.files.create({
        resource: fileMetadata,
        fields: 'id, name, webViewLink, mimeType'
      });

      console.log('Empty file created:', createResponse.result);

      const fileId = createResponse.result.id;

      // 作成したファイルにコンテンツを書き込み
      console.log('Writing content to file...');
      
      try {
        const updateResponse = await window.gapi.client.request({
          path: `https://www.googleapis.com/upload/drive/v3/files/${fileId}`,
          method: 'PATCH',
          params: {
            uploadType: 'media'
          },
          headers: {
            'Content-Type': 'text/plain'
          },
          body: content
        });
        
        console.log('Content written successfully:', updateResponse);
        
        // 最終的なファイル情報を取得
        const finalFileInfo = await window.gapi.client.drive.files.get({
          fileId: fileId,
          fields: 'id, name, webViewLink, mimeType, size'
        });
        
        console.log('Final file info:', finalFileInfo.result);
        return finalFileInfo.result;
        
      } catch (contentError) {
        console.error('Failed to write content, trying alternative method:', contentError);
        
        // 代替方法: ファイルを削除して multipart で再作成
        try {
          await window.gapi.client.drive.files.delete({ fileId: fileId });
          console.log('Deleted empty file, trying multipart upload...');
        } catch (deleteError) {
          console.warn('Failed to delete empty file:', deleteError);
        }
        
        return await this.createFileWithMultipart(folderId, fileName, content);
      }
      
    } catch (error) {
      console.error('Failed to create text file:', error);
      // 最後の手段として multipart upload を試す
      return await this.createFileWithMultipart(folderId, fileName, content);
    }
  }

  /**
   * Multipart uploadでファイル作成
   */
  async createFileWithMultipart(folderId, fileName, content) {
    try {
      console.log('Trying multipart upload...');
      
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

      console.log('Multipart upload successful:', response.result);
      return response.result;
      
    } catch (error) {
      console.error('Multipart upload also failed:', error);
      
      // 最後の手段: Google Docsファイルとして作成を試す
      try {
        console.log('Last resort: creating as Google Docs...');
        
        const docMetadata = {
          name: fileName,
          parents: [folderId],
          mimeType: 'application/vnd.google-apps.document'
        };

        const docResponse = await window.gapi.client.drive.files.create({
          resource: docMetadata,
          fields: 'id, name, webViewLink, mimeType'
        });

        console.log('Google Docs file created as fallback:', docResponse.result);
        
        // 注意: コンテンツは空になるが、ファイルは作成される
        return docResponse.result;
        
      } catch (docError) {
        console.error('All file creation methods failed:', docError);
        throw new Error('ファイルの作成に失敗しました。Google Driveの権限を確認してください。');
      }
    }
  }

  /**
   * ファイル作成の確認
   */
  async verifyFileCreation(folderId, fileId) {
    try {
      console.log('Verifying file creation...', { folderId, fileId });
      
      // フォルダ内のファイル一覧を取得
      const folderContents = await window.gapi.client.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size, webViewLink, createdTime)'
      });

      console.log('Files in Paper Topic Suggestion folder:', folderContents.result.files);

      // 作成したファイルが存在するかチェック
      const createdFile = folderContents.result.files.find(file => file.id === fileId);
      
      if (!createdFile) {
        return {
          success: false,
          message: 'ファイルが見つかりません',
          details: { searchedId: fileId, availableFiles: folderContents.result.files }
        };
      }

      // ファイルの詳細情報を取得
      const fileDetails = await window.gapi.client.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size, webViewLink, createdTime, modifiedTime, parents'
      });

      console.log('File details:', fileDetails.result);

      return {
        success: true,
        message: 'ファイルが正常に作成されました',
        details: {
          file: fileDetails.result,
          folderContents: folderContents.result.files.length
        }
      };

    } catch (error) {
      console.error('File verification failed:', error);
      return {
        success: false,
        message: `確認中にエラーが発生しました: ${error.message}`,
        details: { error }
      };
    }
  }

  /**
   * 詳細なエラーメッセージを生成
   */
  async generateDetailedErrorMessage(documentFolder) {
    let message = 'Mainドキュメントが見つかりませんでした。\n\n';

    if (!documentFolder) {
      return message + '原因: Documentフォルダが存在しません。\n\n対処法:\n1. プロジェクトにDocumentフォルダを作成してください\n2. フォルダ内にMainという名前のドキュメントを追加してください';
    }

    try {
      // Documentフォルダの内容を確認
      const response = await window.gapi.client.drive.files.list({
        q: `'${documentFolder.id}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)',
        orderBy: 'name'
      });

      const files = response.result.files || [];
      
      if (files.length === 0) {
        message += '原因: Documentフォルダが空です。\n\n';
        message += '対処法:\n';
        message += '1. Documentフォルダに「Main」という名前のドキュメントを作成してください\n';
        message += '2. Google Docs、テキストファイル(.txt)、Markdownファイル(.md)が対応しています';
      } else {
        message += `原因: Documentフォルダに${files.length}個のファイルがありますが、「Main」という名前のドキュメントが見つかりません。\n\n`;
        message += '見つかったファイル:\n';
        files.forEach((file, index) => {
          message += `${index + 1}. ${file.name} (${this.getMimeTypeDescription(file.mimeType)})\n`;
        });
        message += '\n対処法:\n';
        message += '1. 既存のファイルを「Main」にリネームする\n';
        message += '2. 新しく「Main」という名前のドキュメントを作成する\n';
        message += '3. ファイル名に「main」を含める（例：「Main_Project」「project_main」）';
      }
    } catch (error) {
      message += `原因: Documentフォルダへのアクセスに失敗しました (${error.message})\n\n`;
      message += '対処法:\n';
      message += '1. Google Driveへの権限を確認してください\n';
      message += '2. ブラウザを再読み込みして再度サインインしてください\n';
      message += '3. プロジェクトフォルダの共有設定を確認してください';
    }

    return message;
  }

  /**
   * MIMEタイプの説明を取得
   */
  getMimeTypeDescription(mimeType) {
    const descriptions = {
      'application/vnd.google-apps.document': 'Google Docs',
      'application/vnd.google-apps.folder': 'フォルダ',
      'text/plain': 'テキストファイル',
      'text/markdown': 'Markdownファイル',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word文書',
      'application/msword': 'Word文書',
      'application/pdf': 'PDFファイル'
    };
    
    return descriptions[mimeType] || mimeType;
  }

  /**
   * 処理中かどうかを確認
   */
  isCurrentlyProcessing() {
    return this.isProcessing;
  }
}

// シングルトンインスタンスをエクスポート
const paperTopicSuggestionService = new PaperTopicSuggestionService();
export default paperTopicSuggestionService;
