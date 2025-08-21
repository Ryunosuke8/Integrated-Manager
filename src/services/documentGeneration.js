import googleDriveService from './googleDrive.js';
import openaiService from './openaiService.js';

/**
 * ドキュメント生成サービス
 * Presentationフォルダのプレゼン資料を読み取って、DocumentフォルダにMainドキュメントを生成
 */
class DocumentGenerationService {
  constructor() {
    this.isProcessing = false;
  }

  /**
   * 現在処理中かどうかを確認
   */
  isCurrentlyProcessing() {
    return this.isProcessing;
  }

  /**
   * ドキュメント生成を実行
   * @param {string} projectId - プロジェクトID
   * @param {function} onProgress - 進捗コールバック関数
   * @returns {Object} 生成結果
   */
  async generateDocument(projectId, onProgress = null) {
    if (this.isProcessing) {
      throw new Error('既にドキュメント生成を実行中です');
    }

    this.isProcessing = true;
    const result = {
      success: false,
      sourceFiles: [],
      generatedDocument: null,
      error: null
    };

    try {
      // 1. プロジェクト構造を取得
      if (onProgress) onProgress({ stage: 'initializing', progress: 10, message: 'プロジェクト構造を取得中...' });
      const projectStructure = await this.getProjectStructure(projectId);
      
      // 2. Presentationフォルダを取得
      if (onProgress) onProgress({ stage: 'reading', progress: 20, message: 'Presentationフォルダを検索中...' });
      const presentationFolder = await this.findPresentationFolder(projectStructure);
      
      if (!presentationFolder) {
        throw new Error('Presentationフォルダが見つかりません。プロジェクトにPresentationフォルダが存在することを確認してください。');
      }

      // 3. Presentationフォルダ内のファイルを読み込み
      if (onProgress) onProgress({ stage: 'reading', progress: 30, message: 'プレゼン資料を読み込み中...' });
      const presentationFiles = await this.readPresentationFiles(presentationFolder.id);
      
      if (presentationFiles.length === 0) {
        throw new Error('Presentationフォルダにファイルが見つかりません。プレゼン資料をアップロードしてから再度実行してください。');
      }

      result.sourceFiles = presentationFiles;

      // 4. プレゼン資料の内容を解析
      if (onProgress) onProgress({ stage: 'analyzing', progress: 50, message: 'プレゼン資料を解析中...' });
      const presentationContent = await this.analyzePresentationContent(presentationFiles);

      // 5. Documentフォルダを取得または作成
      if (onProgress) onProgress({ stage: 'preparing', progress: 70, message: 'Documentフォルダを準備中...' });
      const documentFolder = await this.findOrCreateDocumentFolder(projectStructure);

      // 6. Mainドキュメントを生成
      if (onProgress) onProgress({ stage: 'generating', progress: 80, message: 'Mainドキュメントを生成中...' });
      
      // OpenAI API設定のチェック
      if (!openaiService.isConfigured()) {
        throw new Error('OpenAI API設定が完了していません。設定画面でAPIキーを入力してください。');
      }
      
      const mainDocumentContent = await this.generateMainDocumentContent(presentationContent, presentationFiles);

      // 7. Mainドキュメントを保存
      if (onProgress) onProgress({ stage: 'saving', progress: 90, message: 'Mainドキュメントを保存中...' });
      const mainDocument = await this.saveMainDocument(documentFolder.id, mainDocumentContent);
      result.generatedDocument = mainDocument;

      // 8. ファイル作成の確認
      if (onProgress) onProgress({ stage: 'verifying', progress: 95, message: 'ファイル作成を確認中...' });
      const verification = await this.verifyFileCreation(documentFolder.id, mainDocument.id);
      if (!verification.success) {
        console.warn('File verification failed:', verification.message);
      } else {
        console.log('File creation verified successfully:', verification.details);
      }

      if (onProgress) onProgress({ stage: 'completed', progress: 100, message: 'ドキュメント生成が完了しました！' });
      result.success = true;

    } catch (error) {
      console.error('Document generation failed:', error);
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

      return {
        id: projectId,
        folders: folders
      };
    } catch (error) {
      console.error('Failed to get project structure:', error);
      throw error;
    }
  }

  /**
   * Presentationフォルダを検索
   */
  async findPresentationFolder(projectStructure) {
    try {
      return projectStructure.folders.find(folder => folder.name === 'Presentation');
    } catch (error) {
      console.error('Failed to find Presentation folder:', error);
      throw error;
    }
  }

  /**
   * Presentationフォルダ内のファイルを読み込み
   */
  async readPresentationFiles(presentationFolderId) {
    try {
      const response = await window.gapi.client.drive.files.list({
        q: `'${presentationFolderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)'
      });

      const files = response.result.files || [];
      
      // プレゼン資料として適切なファイルをフィルタリング
      const presentationFiles = files.filter(file => {
        const fileName = file.name.toLowerCase();
        const mimeType = file.mimeType;
        
        console.log(`Checking file: ${file.name}, MIME type: ${mimeType}`);
        
        // Google Slidesファイル
        if (mimeType === 'application/vnd.google-apps.presentation') {
          console.log(`  -> Google Slides file detected: ${file.name}`);
          return true;
        }
        
        // PowerPointファイル（MIMEタイプとファイル名の両方をチェック）
        if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
            mimeType === 'application/vnd.ms-powerpoint' ||
            fileName.endsWith('.pptx') || 
            fileName.endsWith('.ppt')) {
          console.log(`  -> PowerPoint file detected: ${file.name} (MIME: ${mimeType})`);
          return true;
        }
        
        // その他のプレゼン資料ファイル
        if (fileName.includes('.pdf') ||
            fileName.includes('.md') ||
            fileName.includes('.txt') ||
            fileName.includes('presentation') ||
            fileName.includes('slide')) {
          console.log(`  -> Other presentation file detected: ${file.name}`);
          return true;
        }
        
        console.log(`  -> File ignored: ${file.name}`);
        return false;
      });

      return presentationFiles;
    } catch (error) {
      console.error('Failed to read presentation files:', error);
      throw error;
    }
  }

  /**
   * プレゼン資料の内容を解析
   */
  async analyzePresentationContent(presentationFiles) {
    try {
      let allContent = '';
      
      console.log('Analyzing presentation files:', presentationFiles.map(f => ({ name: f.name, mimeType: f.mimeType })));
      
      for (const file of presentationFiles) {
        try {
          console.log(`Reading file: ${file.name} (${file.mimeType})`);
          
          // ファイルの内容を読み込み
          const fileContent = await this.readFileContent(file);
          if (fileContent) {
            console.log(`Successfully read ${file.name}, content length: ${fileContent.length}`);
            allContent += `\n\n=== ${file.name} ===\n${fileContent}`;
          } else {
            console.warn(`No content extracted from ${file.name}`);
            allContent += `\n\n=== ${file.name} ===\n(内容を読み込めませんでした)`;
          }
        } catch (error) {
          console.warn(`Failed to read file ${file.name}:`, error);
          // ファイル読み込みに失敗しても続行
          allContent += `\n\n=== ${file.name} ===\n(読み込みエラー: ${error.message})`;
        }
      }

      console.log('Total content length:', allContent.length);
      return allContent;
    } catch (error) {
      console.error('Failed to analyze presentation content:', error);
      throw error;
    }
  }

  /**
   * ファイルの内容を読み込み
   */
  async readFileContent(file) {
    try {
      if (file.mimeType === 'application/vnd.google-apps.document') {
        // Google Docsの場合
        const response = await window.gapi.client.drive.files.export({
          fileId: file.id,
          mimeType: 'text/plain'
        });
        return response.body;
      } else if (file.mimeType === 'application/vnd.google-apps.presentation') {
        // Google Slidesの場合
        return await this.readGoogleSlidesContent(file.id);
      } else if (file.name.toLowerCase().endsWith('.pptx') || file.name.toLowerCase().endsWith('.ppt')) {
        // PowerPointファイルの場合
        return await this.readPowerPointContent(file);
      } else if (file.mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // PDFファイルの場合
        return await this.readPDFContent(file);
      } else if (file.mimeType === 'text/plain' || file.mimeType === 'text/markdown') {
        // テキストファイルの場合
        const response = await window.gapi.client.drive.files.get({
          fileId: file.id,
          alt: 'media'
        });
        return response.body;
      } else {
        // その他のファイル形式の場合、ファイル名のみを使用
        return `ファイル: ${file.name} (内容は読み込めませんでした)`;
      }
    } catch (error) {
      console.warn(`Failed to read file content for ${file.name}:`, error);
      return `ファイル: ${file.name} (読み込みエラー)`;
    }
  }

  /**
   * Google Slidesの内容を読み込み
   */
  async readGoogleSlidesContent(presentationId) {
    try {
      console.log('Reading Google Slides content for:', presentationId);
      
      // Google Slides APIを使用してプレゼンテーションの詳細を取得
      const presentationResponse = await window.gapi.client.slides.presentations.get({
        presentationId: presentationId
      });
      
      const presentation = presentationResponse.result;
      let slidesContent = '';
      
      // プレゼンテーションのタイトル
      if (presentation.title) {
        slidesContent += `# ${presentation.title}\n\n`;
      }
      
      // 各スライドの内容を読み込み
      if (presentation.slides) {
        for (let i = 0; i < presentation.slides.length; i++) {
          const slide = presentation.slides[i];
          slidesContent += `## スライド ${i + 1}\n\n`;
          
          // スライド内のテキスト要素を抽出
          if (slide.pageElements) {
            for (const element of slide.pageElements) {
              if (element.shape && element.shape.text) {
                const textElement = element.shape.text;
                if (textElement.textElements) {
                  for (const textElem of textElement.textElements) {
                    if (textElem.textRun && textElem.textRun.content) {
                      slidesContent += textElem.textRun.content;
                    }
                  }
                }
              }
            }
          }
          slidesContent += '\n\n';
        }
      }
      
      console.log('Google Slides content extracted:', slidesContent.substring(0, 200) + '...');
      return slidesContent;
      
    } catch (error) {
      console.warn('Failed to read Google Slides content:', error);
      
      // フォールバック: プレゼンテーションをテキストとしてエクスポート
      try {
        const exportResponse = await window.gapi.client.drive.files.export({
          fileId: presentationId,
          mimeType: 'text/plain'
        });
        return exportResponse.body;
      } catch (exportError) {
        console.warn('Export fallback also failed:', exportError);
        
        // さらにフォールバック: HTMLとしてエクスポート
        try {
          const htmlResponse = await window.gapi.client.drive.files.export({
            fileId: presentationId,
            mimeType: 'text/html'
          });
          
          // HTMLからテキストを抽出
          const htmlContent = htmlResponse.body;
          const textContent = this.extractTextFromHTML(htmlContent);
          return textContent;
          
        } catch (htmlError) {
          console.warn('HTML export also failed:', htmlError);
          return `Google Slidesファイル (内容の読み込みに失敗しました)`;
        }
      }
    }
  }

  /**
   * PowerPointファイルの内容を読み込み
   */
  async readPowerPointContent(file) {
    try {
      console.log('Reading PowerPoint content for:', file.name);
      
      // PowerPointファイルをPDFに変換してから読み取り
      try {
        console.log('Converting PowerPoint to PDF...');
        const pdfResponse = await window.gapi.client.drive.files.export({
          fileId: file.id,
          mimeType: 'application/pdf'
        });
        
        console.log('PDF conversion successful, trying to extract text...');
        
        // PDFからテキストを抽出するために、PDFを一時的にアップロードして処理
        const pdfBlob = new Blob([pdfResponse.body], { type: 'application/pdf' });
        const textContent = await this.extractTextFromPDF(pdfBlob);
        
        if (textContent && textContent.trim().length > 0) {
          console.log('PDF text extraction successful, content length:', textContent.length);
          console.log('PDF content preview:', textContent.substring(0, 500));
          return textContent;
        } else {
          console.log('PDF text extraction returned empty content');
        }
      } catch (pdfError) {
        console.log('PDF conversion failed:', pdfError);
      }
      
      // フォールバック: ファイル名とMIMEタイプの情報のみを使用
      console.log('Using fallback method with file metadata only');
      return `PowerPointファイル: ${file.name}\n\nこのファイルはPDFに変換してテキスト抽出を試みましたが、内容を読み取ることができませんでした。\n\nファイル情報:\n- ファイル名: ${file.name}\n- MIMEタイプ: ${file.mimeType}\n- ファイルID: ${file.id}\n\n推奨事項:\n1. PowerPointファイルをPDFに変換してからアップロードしてください\n2. または、プレゼン内容をテキストファイル（.txt）またはMarkdownファイル（.md）として保存してアップロードしてください\n3. Google Slidesを使用している場合は、そのままアップロードしてください\n\nこれにより、より確実に内容を読み取ることができます。`;
      
    } catch (error) {
      console.error('All PowerPoint reading methods failed:', error);
      return `PowerPointファイル: ${file.name} (内容の読み込みに失敗しました - ${error.message})`;
    }
  }

  /**
   * PDFファイルの内容を読み込み
   */
  async readPDFContent(file) {
    try {
      console.log('Reading PDF content for:', file.name);
      
      // PDFファイルをダウンロード
      const response = await window.gapi.client.drive.files.get({
        fileId: file.id,
        alt: 'media'
      });
      
      const pdfBlob = new Blob([response.body], { type: 'application/pdf' });
      
      // まずPDF.jsでテキスト抽出を試行
      try {
        const textContent = await this.extractTextFromPDF(pdfBlob);
        
        if (textContent && textContent.trim().length > 0 && !textContent.includes('PDFからテキストを抽出できませんでした')) {
          console.log('PDF content extracted successfully, length:', textContent.length);
          console.log('PDF content preview:', textContent.substring(0, 500));
          return textContent;
        } else {
          console.log('PDF.js extraction failed or returned empty content, trying alternative method...');
        }
      } catch (pdfError) {
        console.log('PDF.js extraction failed:', pdfError);
      }
      
      // フォールバック: Google Driveのテキストエクスポートを試行
      try {
        console.log('Trying Google Drive text export as fallback...');
        const exportResponse = await window.gapi.client.drive.files.export({
          fileId: file.id,
          mimeType: 'text/plain'
        });
        
        const exportedText = exportResponse.body;
        if (exportedText && exportedText.trim().length > 0) {
          console.log('Google Drive export successful, length:', exportedText.length);
          return exportedText;
        }
      } catch (exportError) {
        console.log('Google Drive export also failed:', exportError);
      }
      
      // 最終フォールバック
      console.log('All PDF reading methods failed, using fallback message');
      return `PDFファイル: ${file.name}\n\nこのPDFファイルの内容を読み取ることができませんでした。\n\n考えられる原因:\n1. 画像のみのPDF（スキャンされたPDF）\n2. 特殊なフォントやレイアウトが使用されている\n3. ファイルが破損している\n\n推奨事項:\n1. PDFをテキストファイル（.txt）に変換してアップロード\n2. または、内容をMarkdownファイル（.md）として保存してアップロード\n3. Google Docsに変換してからアップロード`;
      
    } catch (error) {
      console.error('Failed to read PDF content:', error);
      return `PDFファイル: ${file.name} (内容の読み込みに失敗しました - ${error.message})`;
    }
  }

  /**
   * PDFからテキストを抽出
   */
  async extractTextFromPDF(pdfBlob) {
    try {
      // PDF.jsライブラリの存在を確認
      if (typeof window.pdfjsLib === 'undefined' && typeof pdfjsLib === 'undefined') {
        console.log('PDF.js library not available');
        return 'PDF.jsライブラリが利用できません。PDFの内容を手動で確認してください。';
      }
      
      // グローバル変数からPDF.jsを取得
      const pdfjs = window.pdfjsLib || pdfjsLib;
      console.log('Using PDF.js to extract text...');
      
      // FileReaderを使用してより安全に読み込み
      return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        
        fileReader.onload = async function() {
          try {
            console.log('FileReader loaded, processing PDF...');
            const typedArray = new Uint8Array(this.result);
            
            // PDF.jsの設定を調整
            const loadingTask = pdfjs.getDocument({
              data: typedArray,
              verbosity: 0, // エラーメッセージを減らす
              disableFontFace: true, // フォント読み込みを無効化
              disableRange: true, // 範囲読み込みを無効化
              disableStream: true // ストリーム読み込みを無効化
            });
            
            const pdf = await loadingTask.promise;
            console.log(`PDF loaded successfully, pages: ${pdf.numPages}`);
            
            let textContent = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              try {
                const page = await pdf.getPage(i);
                const textContentResult = await page.getTextContent();
                const pageText = textContentResult.items.map(item => item.str).join(' ');
                textContent += `\n\n=== ページ ${i} ===\n${pageText}`;
                console.log(`Page ${i} processed, text length: ${pageText.length}`);
              } catch (pageError) {
                console.warn(`Failed to process page ${i}:`, pageError);
                textContent += `\n\n=== ページ ${i} ===\n(ページの処理に失敗しました)`;
              }
            }
            
            if (textContent.trim().length > 0) {
              console.log('PDF text extraction successful');
              resolve(textContent);
            } else {
              console.log('PDF text extraction returned empty content');
              resolve('PDFからテキストを抽出できませんでした。画像のみのPDFの可能性があります。');
            }
            
          } catch (pdfError) {
            console.warn('PDF processing failed:', pdfError);
            reject(pdfError);
          }
        };
        
        fileReader.onerror = function(error) {
          console.warn('FileReader error:', error);
          reject(error);
        };
        
        fileReader.readAsArrayBuffer(pdfBlob);
      });
      
    } catch (error) {
      console.warn('PDF text extraction failed:', error);
      return 'PDFからのテキスト抽出に失敗しました。';
    }
  }

  /**
   * PowerPointのHTMLからテキストを抽出
   */
  extractTextFromPowerPointHTML(htmlContent) {
    try {
      // PowerPointのHTMLは特殊な構造になっているため、より詳細な処理が必要
      let text = htmlContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // scriptタグを除去
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // styleタグを除去
        .replace(/<meta[^>]*>/gi, '') // metaタグを除去
        .replace(/<link[^>]*>/gi, '') // linkタグを除去
        .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '') // titleタグを除去
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '') // headタグを除去
        .replace(/<body[^>]*>/gi, '') // body開始タグを除去
        .replace(/<\/body>/gi, '') // body終了タグを除去
        .replace(/<html[^>]*>/gi, '') // html開始タグを除去
        .replace(/<\/html>/gi, '') // html終了タグを除去
        .replace(/<div[^>]*>/gi, '\n') // divタグを改行に置換
        .replace(/<\/div>/gi, '') // div終了タグを除去
        .replace(/<p[^>]*>/gi, '\n') // pタグを改行に置換
        .replace(/<\/p>/gi, '') // p終了タグを除去
        .replace(/<br[^>]*>/gi, '\n') // brタグを改行に置換
        .replace(/<span[^>]*>/gi, '') // span開始タグを除去
        .replace(/<\/span>/gi, '') // span終了タグを除去
        .replace(/<strong[^>]*>/gi, '**') // strongタグをMarkdownの太字に
        .replace(/<\/strong>/gi, '**') // strong終了タグをMarkdownの太字に
        .replace(/<b[^>]*>/gi, '**') // bタグをMarkdownの太字に
        .replace(/<\/b>/gi, '**') // b終了タグをMarkdownの太字に
        .replace(/<em[^>]*>/gi, '*') // emタグをMarkdownの斜体に
        .replace(/<\/em>/gi, '*') // em終了タグをMarkdownの斜体に
        .replace(/<i[^>]*>/gi, '*') // iタグをMarkdownの斜体に
        .replace(/<\/i>/gi, '*') // i終了タグをMarkdownの斜体に
        .replace(/<h1[^>]*>/gi, '\n# ') // h1タグをMarkdownの見出しに
        .replace(/<\/h1>/gi, '\n') // h1終了タグを改行に
        .replace(/<h2[^>]*>/gi, '\n## ') // h2タグをMarkdownの見出しに
        .replace(/<\/h2>/gi, '\n') // h2終了タグを改行に
        .replace(/<h3[^>]*>/gi, '\n### ') // h3タグをMarkdownの見出しに
        .replace(/<\/h3>/gi, '\n') // h3終了タグを改行に
        .replace(/<h4[^>]*>/gi, '\n#### ') // h4タグをMarkdownの見出しに
        .replace(/<\/h4>/gi, '\n') // h4終了タグを改行に
        .replace(/<h5[^>]*>/gi, '\n##### ') // h5タグをMarkdownの見出しに
        .replace(/<\/h5>/gi, '\n') // h5終了タグを改行に
        .replace(/<h6[^>]*>/gi, '\n###### ') // h6タグをMarkdownの見出しに
        .replace(/<\/h6>/gi, '\n') // h6終了タグを改行に
        .replace(/<ul[^>]*>/gi, '\n') // ulタグを改行に
        .replace(/<\/ul>/gi, '\n') // ul終了タグを改行に
        .replace(/<ol[^>]*>/gi, '\n') // olタグを改行に
        .replace(/<\/ol>/gi, '\n') // ol終了タグを改行に
        .replace(/<li[^>]*>/gi, '\n- ') // liタグをMarkdownのリストに
        .replace(/<\/li>/gi, '') // li終了タグを除去
        .replace(/<[^>]+>/g, '') // 残りのHTMLタグを除去
        .replace(/&nbsp;/g, ' ') // 非改行スペースを通常のスペースに
        .replace(/&amp;/g, '&') // HTMLエンティティを復元
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&copy;/g, '©')
        .replace(/&reg;/g, '®')
        .replace(/&trade;/g, '™')
        .replace(/\n\s*\n/g, '\n') // 連続する改行を整理
        .replace(/\n{3,}/g, '\n\n') // 3つ以上の連続改行を2つに
        .trim();
      
      return text;
    } catch (error) {
      console.warn('Failed to extract text from PowerPoint HTML:', error);
      return htmlContent;
    }
  }

  /**
   * HTMLからテキストを抽出
   */
  extractTextFromHTML(htmlContent) {
    try {
      // 簡単なHTMLタグ除去
      let text = htmlContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // scriptタグを除去
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // styleタグを除去
        .replace(/<[^>]+>/g, '\n') // その他のHTMLタグを改行に置換
        .replace(/&nbsp;/g, ' ') // 非改行スペースを通常のスペースに
        .replace(/&amp;/g, '&') // HTMLエンティティを復元
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n\s*\n/g, '\n') // 連続する改行を整理
        .trim();
      
      return text;
    } catch (error) {
      console.warn('Failed to extract text from HTML:', error);
      return htmlContent;
    }
  }

  /**
   * Documentフォルダを検索または作成
   */
  async findOrCreateDocumentFolder(projectStructure) {
    try {
      let documentFolder = projectStructure.folders.find(folder => folder.name === 'Document');
      
      if (!documentFolder) {
        // Documentフォルダが存在しない場合は作成
        documentFolder = await googleDriveService.createFolder('Document', projectStructure.id);
      }
      
      return documentFolder;
    } catch (error) {
      console.error('Failed to find or create Document folder:', error);
      throw error;
    }
  }

  /**
   * Mainドキュメントの内容を生成
   */
  async generateMainDocumentContent(presentationContent, presentationFiles) {
    try {
      console.log('=== OPENAI REQUEST DEBUG ===');
      console.log('Presentation files:', presentationFiles.map(f => f.name));
      console.log('Presentation content length:', presentationContent.length);
      console.log('Presentation content preview (first 1000 chars):', presentationContent.substring(0, 1000));
      console.log('Presentation content preview (last 1000 chars):', presentationContent.substring(Math.max(0, presentationContent.length - 1000)));
      console.log('=== END DEBUG ===');

      const systemPrompt = `あなたはプロジェクトドキュメント作成の専門家です。プレゼン資料の内容を分析し、包括的なプロジェクトドキュメントを作成してください。

以下の要件に従ってMainドキュメントを生成してください：

1. **構造化**: 論理的な章立てで整理されたドキュメント
2. **包括性**: プレゼン資料の内容を網羅的に含める
3. **詳細性**: プレゼン資料よりも詳細な説明を追加
4. **一貫性**: 統一された文体とフォーマット
5. **実用性**: プロジェクト管理や開発に活用できる内容

ドキュメント構造：
- プロジェクト概要
- 背景・目的
- システム概要
- 技術仕様
- 実装詳細
- 成果・評価
- 今後の展開

出力形式は日本語のMarkdown形式で、構造化された詳細なドキュメントを作成してください。`;

      const userPrompt = `以下のプレゼン資料の内容を分析して、包括的なプロジェクトドキュメントを作成してください：

**プレゼン資料ファイル**:
${presentationFiles.map(file => `- ${file.name}`).join('\n')}

**プレゼン資料内容**:
${presentationContent}

上記の内容に基づいて、詳細で構造化されたMainドキュメントを生成してください。`;

      console.log('Sending request to OpenAI...');
      const response = await openaiService.makeRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      console.log('OpenAI response received, length:', response.length);
      console.log('OpenAI response preview:', response.substring(0, 500));

      return response;
    } catch (error) {
      console.error('Failed to generate main document content:', error);
      throw error;
    }
  }

  /**
   * Mainドキュメントを保存
   */
  async saveMainDocument(documentFolderId, content) {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `Main_${timestamp}.md`;
      
      const file = await this.createTextFile(documentFolderId, fileName, content);
      return file;
    } catch (error) {
      console.error('Failed to save main document:', error);
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
      const response = await window.gapi.client.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, webViewLink)'
      });

      const files = response.result.files || [];
      const createdFile = files.find(file => file.id === fileId);
      
      if (createdFile) {
        return {
          success: true,
          details: {
            fileName: createdFile.name,
            fileId: createdFile.id,
            webViewLink: createdFile.webViewLink
          }
        };
      } else {
        return {
          success: false,
          message: 'Created file not found in folder listing'
        };
      }
    } catch (error) {
      console.error('File verification failed:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

// シングルトンインスタンスをエクスポート
const documentGenerationService = new DocumentGenerationService();
export default documentGenerationService;
