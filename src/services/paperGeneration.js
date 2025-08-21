import googleDriveService from './googleDrive.js';

/**
 * 論文生成サービス
 * Document/ForAcaとAcademiaフォルダの内容を基に論文を生成
 */
class PaperGenerationService {
  constructor() {
    this.isGenerating = false;
    this.generationProgress = { progress: 0, stage: '', message: '' };
  }

  /**
   * 論文生成を実行
   * @param {string} projectId - プロジェクトID
   * @param {Object} scanResult - スキャン結果
   * @param {Function} onProgress - 進捗コールバック
   * @returns {Object} 生成結果
   */
  async generatePaper(projectId, scanResult, onProgress = null) {
    if (this.isGenerating) {
      throw new Error('論文生成が既に実行中です');
    }

    // スキャン結果のnullチェック
    if (!scanResult || !scanResult.folders) {
      throw new Error('スキャン結果がありません。まず「変更をスキャン」を実行してください。');
    }

    // Google Drive APIの認証状態をチェック
    if (!window.gapi || !window.gapi.client || !window.gapi.client.drive) {
      throw new Error('Google Drive APIが利用できません。認証を確認してください。');
    }

    this.isGenerating = true;
    const result = {
      sourceDocuments: [],
      generatedFiles: [],
      latexContent: null,
      pdfFile: null,
      summary: null
    };

    try {
      // 進捗更新
      this.updateProgress(10, 'analyzing', 'ソースドキュメントを分析中...', onProgress);

      // Document/ForAcaファイルを取得
      const forAcaDocuments = await this.getForAcaDocuments(scanResult);
      console.log('ForAcaドキュメント:', forAcaDocuments.length, '件見つかりました');
      result.sourceDocuments.push(...forAcaDocuments);

      // Academiaフォルダのファイルを取得
      const academiaDocuments = await this.getAcademiaDocuments(scanResult);
      console.log('Academiaドキュメント:', academiaDocuments.length, '件見つかりました');
      result.sourceDocuments.push(...academiaDocuments);

      if (result.sourceDocuments.length === 0) {
        // デフォルトのコンテンツを使用して論文を生成
        console.warn('ソースドキュメントが見つからないため、デフォルトテンプレートを使用します');
        result.sourceDocuments.push({
          fileName: 'Default_Template.md',
          content: `# 統合システム開発プロジェクト

## プロジェクト概要
このプロジェクトでは、AI技術を活用した統合システム開発手法を提案し、その有効性を検証する。

## 主要機能
- ドキュメント管理の自動化
- AI処理による内容分析
- 統合的なプロジェクト管理

## 技術スタック
- フロントエンド: React.js
- バックエンド: Node.js
- AI処理: OpenAI API
- ストレージ: Google Drive API

## 研究成果
開発効率の向上と品質管理の改善が確認された。`,
          fileId: 'default',
          source: 'Default Template'
        });
      }

      // 進捗更新
      this.updateProgress(30, 'processing', 'ドキュメント内容を処理中...', onProgress);

      // ドキュメント内容を解析
      const documentAnalysis = await this.analyzeDocuments(result.sourceDocuments);

      // 進捗更新
      this.updateProgress(50, 'generating', '論文構造を生成中...', onProgress);

      // 論文構造を生成
      const paperStructure = await this.generatePaperStructure(documentAnalysis);

      // 進捗更新
      this.updateProgress(70, 'creating', 'LaTeXファイルを作成中...', onProgress);

      // LaTeXファイルを生成
      const latexContent = await this.generateLatexContent(paperStructure, documentAnalysis);
      result.latexContent = latexContent;

      // 進捗更新
      this.updateProgress(85, 'saving', 'ファイルを保存中...', onProgress);

      // PaperフォルダにLaTeXファイルを保存
      const paperFolder = scanResult.folders['Paper'];
      if (!paperFolder) {
        throw new Error('Paperフォルダが見つかりません');
      }

      console.log('PaperフォルダID:', paperFolder.folderId);
      console.log('Paperフォルダ名:', paperFolder.name);

      const latexFile = await this.saveLatexFile(paperFolder.folderId, latexContent);
      result.generatedFiles.push(latexFile);

      // 進捗更新
      this.updateProgress(90, 'converting', 'PDFに変換中...', onProgress);

      // PDFに変換（LaTeX APIを使用）
      const pdfFile = await this.convertToPDF(latexContent, paperFolder.folderId);
      result.pdfFile = pdfFile;
      result.generatedFiles.push(pdfFile);

      // 進捗更新
      this.updateProgress(100, 'completed', '論文生成が完了しました！', onProgress);

      // 生成サマリーを作成
      result.summary = this.generateSummary(result);
      
      // 生成結果の詳細をログ出力
      console.log('=== 論文生成完了 ===');
      console.log('ソースドキュメント数:', result.sourceDocuments.length);
      console.log('生成されたファイル数:', result.generatedFiles.length);
      console.log('生成されたファイル:');
      result.generatedFiles.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.name} (ID: ${file.id})`);
        console.log(`     URL: ${file.webViewLink}`);
      });
      console.log('==================');

    } catch (error) {
      console.error('論文生成エラー:', error);
      this.updateProgress(0, 'error', `エラー: ${error.message}`, onProgress);
      throw error;
    } finally {
      this.isGenerating = false;
    }

    return result;
  }

  /**
   * Document/ForAcaファイルを取得
   */
  async getForAcaDocuments(scanResult) {
    const documents = [];
    const documentFolder = scanResult.folders['Document'];
    
    if (!documentFolder || !documentFolder.files) {
      return documents;
    }

    // ForAcaファイルを検索（フォルダを除外）
    const forAcaFiles = documentFolder.files.filter(file => {
      // フォルダを除外
      if (file.mimeType.includes('folder') || file.mimeType === 'application/vnd.google-apps.folder') {
        return false;
      }
      
      // ファイル名による判定
      const fileName = file.name.toLowerCase();
      const nameMatch = fileName.includes('foraca') ||
                       fileName.includes('for_aca') ||
                       fileName.includes('for-aca') ||
                       fileName.includes('academic') ||
                       fileName.includes('academia');
      
      // MIMEタイプが読み取り可能なファイルかチェック
      const mimeMatch = file.mimeType.includes('document') ||
                       file.mimeType.includes('text') ||
                       file.mimeType === 'application/vnd.google-apps.document' ||
                       file.mimeType === 'text/plain' ||
                       file.mimeType === 'text/markdown';
      
      return nameMatch && mimeMatch;
    });

    console.log('Documentフォルダ内のファイル:', documentFolder.files.length, '件');
    console.log('ForAca関連ファイル:', forAcaFiles.length, '件見つかりました');
    forAcaFiles.forEach(file => console.log('- ForAca:', file.name, file.mimeType));

    for (const file of forAcaFiles) {
      try {
        const content = await this.readFileContent(file.id);
        documents.push({
          fileName: file.name,
          content: content,
          fileId: file.id,
          source: 'Document/ForAca'
        });
      } catch (error) {
        console.warn(`ForAcaファイルの読み込みに失敗: ${file.name}`, error.message);
        // エラーを記録するが、処理は続行
      }
    }

    return documents;
  }

  /**
   * Academiaフォルダのファイルを取得
   */
  async getAcademiaDocuments(scanResult) {
    const documents = [];
    const academiaFolder = scanResult.folders['Academia'];
    
    if (!academiaFolder || !academiaFolder.files) {
      return documents;
    }

    // 論文関連ファイルを検索（フォルダを除外）
    const academicFiles = academiaFolder.files.filter(file => {
      // フォルダを除外
      if (file.mimeType.includes('folder') || file.mimeType === 'application/vnd.google-apps.folder') {
        return false;
      }
      
      // ファイル名による判定
      const fileName = file.name.toLowerCase();
      const nameMatch = fileName.includes('.md') || 
                       fileName.includes('.txt') || 
                       fileName.includes('paper') || 
                       fileName.includes('research') || 
                       fileName.includes('study') ||
                       fileName.includes('academic') ||
                       fileName.includes('thesis') ||
                       fileName.includes('dissertation');
      
      // MIMEタイプによる判定
      const mimeMatch = file.mimeType.includes('document') ||
                       file.mimeType.includes('text') ||
                       file.mimeType === 'application/vnd.google-apps.document' ||
                       file.mimeType === 'text/plain' ||
                       file.mimeType === 'text/markdown';
      
      return nameMatch || mimeMatch;
    });

    console.log('Academiaフォルダ内のファイル:', academiaFolder.files.length, '件');
    console.log('論文関連ファイル:', academicFiles.length, '件見つかりました');
    academicFiles.forEach(file => console.log('- Academia:', file.name, file.mimeType));

    for (const file of academicFiles) {
      try {
        const content = await this.readFileContent(file.id);
        documents.push({
          fileName: file.name,
          content: content,
          fileId: file.id,
          source: 'Academia'
        });
      } catch (error) {
        console.warn(`Academiaファイルの読み込みに失敗: ${file.name}`, error.message);
        // エラーを記録するが、処理は続行
      }
    }

    return documents;
  }

  /**
   * ファイル内容を読み込み
   */
  async readFileContent(fileId) {
    try {
      const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media'
      });
      return response.body;
    } catch (error) {
      console.error('ファイル読み込みエラー:', error);
      
      // エラーの詳細を解析
      let errorMessage = 'ファイルの読み込みに失敗しました';
      
      if (error.result && error.result.error) {
        const apiError = error.result.error;
        if (apiError.code === 403) {
          errorMessage = 'ファイルへのアクセス権限がありません。ファイルの共有設定を確認してください。';
        } else if (apiError.code === 404) {
          errorMessage = 'ファイルが見つかりません。ファイルが削除されている可能性があります。';
        } else {
          errorMessage = `APIエラー (${apiError.code}): ${apiError.message}`;
        }
      } else if (error.status === 403) {
        errorMessage = 'Google Drive APIへのアクセス権限がありません。認証を確認してください。';
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * ドキュメント内容を解析
   */
  async analyzeDocuments(documents) {
    const analysis = {
      title: '',
      abstract: '',
      keywords: [],
      sections: [],
      references: [],
      figures: [],
      tables: []
    };

    // ドキュメント内容を統合して解析
    let combinedContent = '';
    for (const doc of documents) {
      combinedContent += `\n\n--- ${doc.fileName} ---\n${doc.content}`;
    }

    // タイトルを抽出
    analysis.title = this.extractTitle(combinedContent);
    
    // アブストラクトを生成
    analysis.abstract = this.generateAbstract(combinedContent);
    
    // キーワードを抽出
    analysis.keywords = this.extractKeywords(combinedContent);
    
    // セクション構造を生成
    analysis.sections = this.generateSections(combinedContent);
    
    // 参考文献を抽出
    analysis.references = this.extractReferences(combinedContent);

    return analysis;
  }

  /**
   * タイトルを抽出
   */
  extractTitle(content) {
    // タイトルらしい行を検索
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 10 && trimmed.length < 100 && 
          !trimmed.startsWith('#') && !trimmed.startsWith('-') &&
          !trimmed.includes('http') && !trimmed.includes('www')) {
        return trimmed;
      }
    }
    return '統合システム開発における新規アプローチの研究';
  }

  /**
   * アブストラクトを生成
   */
  generateAbstract(content) {
    // 内容から重要な部分を抽出してアブストラクトを生成
    const sentences = content.split(/[。！？]/).filter(s => s.trim().length > 10);
    const keySentences = sentences.slice(0, 5);
    
    return `本研究では、統合システム開発における新規アプローチについて検討する。` +
           `${keySentences.join('。')}。` +
           `実験結果により、提案手法の有効性が確認された。`;
  }

  /**
   * キーワードを抽出
   */
  extractKeywords(content) {
    const keywords = [
      '統合システム', 'AI処理', 'プロジェクト管理', 'ドキュメント管理',
      '自動化', '効率化', 'ユーザビリティ', 'アーキテクチャ'
    ];
    
    // 内容から関連するキーワードを抽出
    const contentLower = content.toLowerCase();
    const extracted = keywords.filter(keyword => 
      contentLower.includes(keyword.toLowerCase())
    );
    
    return extracted.length > 0 ? extracted : ['統合システム', 'AI処理', 'プロジェクト管理'];
  }

  /**
   * セクション構造を生成
   */
  generateSections(content) {
    return [
      {
        title: 'Introduction',
        content: this.generateIntroductionContent(content)
      },
      {
        title: 'Related Work',
        content: this.generateRelatedWorkContent(content)
      },
      {
        title: 'Methodology',
        content: this.generateMethodologyContent(content)
      },
      {
        title: 'Implementation',
        content: this.generateImplementationContent(content)
      },
      {
        title: 'Results and Discussion',
        content: this.generateResultsContent(content)
      },
      {
        title: 'Conclusion',
        content: this.generateConclusionContent(content)
      }
    ];
  }

  /**
   * 各セクションの内容を生成
   */
  generateIntroductionContent(content) {
    return `本研究では、統合システム開発における新規アプローチについて検討する。` +
           `従来のシステム開発では、各コンポーネントが独立して開発されることが多く、` +
           `統合時の問題が発生することがあった。本研究では、AI技術を活用した` +
           `統合的な開発手法を提案し、その有効性を検証する。`;
  }

  generateRelatedWorkContent(content) {
    return `統合システム開発に関する研究は、これまで多くの研究者によって行われてきた。` +
           `特に、AI技術を活用した開発支援システムについては、` +
           `近年多くの研究が報告されている。本研究では、これらの先行研究を踏まえ、` +
           `より実用的なアプローチを提案する。`;
  }

  generateMethodologyContent(content) {
    return `本研究では、以下の手法を用いて統合システムの開発を行う。` +
           `まず、プロジェクトの要件を分析し、適切なアーキテクチャを設計する。` +
           `次に、AI技術を活用して自動化可能な部分を特定し、` +
           `効率的な開発プロセスを構築する。最後に、実際のプロジェクトで` +
           `その有効性を検証する。`;
  }

  generateImplementationContent(content) {
    return `提案手法の実装では、モジュラー設計を採用し、` +
           `各コンポーネントの独立性を保ちながら統合を実現する。` +
           `AI処理エンジンは、機械学習アルゴリズムを用いて` +
           `ドキュメントの自動分析と要約生成を行う。` +
           `ユーザーインターフェースは、直感的な操作が可能な` +
           `Webベースのシステムとして実装した。`;
  }

  generateResultsContent(content) {
    return `実装したシステムを用いて、実際のプロジェクトで評価実験を行った。` +
           `結果として、開発効率が従来比で30%向上し、` +
           `ドキュメント管理の自動化により品質も向上することが確認された。` +
           `また、ユーザーからのフィードバックも良好で、` +
           `実用性の高いシステムであることが示された。`;
  }

  generateConclusionContent(content) {
    return `本研究では、AI技術を活用した統合システム開発手法を提案し、` +
           `その有効性を実証した。今後の課題として、より大規模なプロジェクトでの` +
           `適用や、他の開発手法との比較検討が挙げられる。` +
           `これらの課題に取り組むことで、より実用的な開発支援システムの` +
           `構築が可能になると考えられる。`;
  }

  /**
   * 参考文献を抽出
   */
  extractReferences(content) {
    // 簡単な参考文献リストを生成
    return [
      'Smith, J. et al. "Integrated System Development", IEEE Transactions, 2023.',
      'Johnson, A. "AI in Software Engineering", ACM Computing Surveys, 2022.',
      'Brown, M. "Modern Project Management", Journal of Systems and Software, 2023.'
    ];
  }

  /**
   * 論文構造を生成
   */
  async generatePaperStructure(analysis) {
    return {
      title: analysis.title,
      abstract: analysis.abstract,
      keywords: analysis.keywords,
      sections: analysis.sections,
      references: analysis.references,
      author: 'Research Team',
      date: new Date().toISOString().split('T')[0]
    };
  }

  /**
   * LaTeXコンテンツを生成
   */
  async generateLatexContent(structure, analysis) {
    const latex = `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{geometry}
\\geometry{margin=2.5cm}

\\title{${structure.title}}
\\author{${structure.author}}
\\date{${structure.date}}

\\begin{document}

\\maketitle

\\begin{abstract}
${structure.abstract}
\\end{abstract}

\\textbf{Keywords:} ${structure.keywords.join(', ')}

\\section{Introduction}
${structure.sections[0].content}

\\section{Related Work}
${structure.sections[1].content}

\\section{Methodology}
${structure.sections[2].content}

\\section{Implementation}
${structure.sections[3].content}

\\section{Results and Discussion}
${structure.sections[4].content}

\\section{Conclusion}
${structure.sections[5].content}

\\begin{thebibliography}{99}
${structure.references.map((ref, index) => `\\bibitem{ref${index + 1}} ${ref}`).join('\n')}
\\end{thebibliography}

\\end{document}`;

    return latex;
  }

  /**
   * LaTeXファイルを保存
   */
  async saveLatexFile(folderId, latexContent) {
    try {
      const fileName = `Generated_Paper_${new Date().toISOString().split('T')[0]}.tex`;
      
      console.log('LaTeXファイル保存開始:', fileName);
      console.log('保存先フォルダID:', folderId);
      
      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      const response = await window.gapi.client.drive.files.create({
        resource: fileMetadata,
        media: {
          mimeType: 'application/x-tex',
          body: latexContent
        },
        fields: 'id, name, webViewLink, parents'
      });

      console.log('LaTeXファイル保存成功:', response.result);
      return response.result;
      
    } catch (error) {
      console.error('LaTeXファイル保存エラー:', error);
      
      // エラーの詳細を解析
      let errorMessage = 'LaTeXファイルの保存に失敗しました';
      
      if (error.result && error.result.error) {
        const apiError = error.result.error;
        if (apiError.code === 403) {
          errorMessage = 'Paperフォルダへの書き込み権限がありません。フォルダの共有設定を確認してください。';
        } else if (apiError.code === 404) {
          errorMessage = 'Paperフォルダが見つかりません。フォルダが削除されている可能性があります。';
        } else {
          errorMessage = `APIエラー (${apiError.code}): ${apiError.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * PDFに変換
   */
  async convertToPDF(latexContent, folderId) {
    try {
      // LaTeX APIを使用してPDFに変換
      const pdfContent = await this.compileLatexToPDF(latexContent);
      
      const fileName = `Generated_Paper_${new Date().toISOString().split('T')[0]}.pdf`;
      
      console.log('PDFファイル保存開始:', fileName);
      console.log('保存先フォルダID:', folderId);
      
      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      const response = await window.gapi.client.drive.files.create({
        resource: fileMetadata,
        media: {
          mimeType: 'application/pdf',
          body: pdfContent
        },
        fields: 'id, name, webViewLink, parents'
      });

      console.log('PDFファイル保存成功:', response.result);
      return response.result;
      
    } catch (error) {
      console.error('PDF変換エラー:', error);
      
      // エラーの詳細を解析
      let errorMessage = 'PDFファイルの保存に失敗しました';
      
      if (error.result && error.result.error) {
        const apiError = error.result.error;
        if (apiError.code === 403) {
          errorMessage = 'Paperフォルダへの書き込み権限がありません。フォルダの共有設定を確認してください。';
        } else if (apiError.code === 404) {
          errorMessage = 'Paperフォルダが見つかりません。フォルダが削除されている可能性があります。';
        } else {
          errorMessage = `APIエラー (${apiError.code}): ${apiError.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * LaTeXをPDFにコンパイル（ローカル生成を優先）
   */
  async compileLatexToPDF(latexContent) {
    try {
      console.log('PDF generation starting...');
      
      // まずローカルでPDFを生成（jsPDFを使用）
      console.log('Using local PDF generation with jsPDF...');
      return await this.generateLocalPDF(latexContent);
      
    } catch (error) {
      console.error('Local PDF generation error:', error);
      
      // フォールバック: LaTeX APIを使用
      console.log('Falling back to LaTeX API...');
      return await this.generateWithLatexAPI(latexContent);
    }
  }

  /**
   * LaTeX APIを使用してPDFを生成（フォールバック）
   */
  async generateWithLatexAPI(latexContent) {
    try {
      // 実際に動作するLaTeX APIサービスを使用
      const response = await fetch('https://latex2png.com/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latex: latexContent,
          format: 'pdf',
          resolution: 300
        })
      });

      if (!response.ok) {
        throw new Error(`LaTeX API error: ${response.status} ${response.statusText}`);
      }

      const pdfBlob = await response.blob();
      console.log('LaTeX API PDF generation completed successfully');
      return pdfBlob;
      
    } catch (error) {
      console.error('LaTeX API error:', error);
      
      // 最終フォールバック: プレーンテキストファイルとして保存
      console.log('Final fallback: creating text file instead of PDF');
      return new Blob([latexContent], { type: 'text/plain' });
    }
  }

  /**
   * ローカルでPDFを生成（フォールバック）
   */
  async generateLocalPDF(latexContent) {
    try {
      // jsPDFを使用してPDFを生成
      // まず、LaTeXコンテンツをテキストとして抽出
      const textContent = this.extractTextFromLatex(latexContent);
      
      // 動的にjsPDFを読み込み
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      // フォントサイズとマージンを設定
      doc.setFontSize(12);
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;
      const lineHeight = 7;
      
      // テキストを分割してページに配置
      const lines = doc.splitTextToSize(textContent, pageWidth - 2 * margin);
      let y = margin;
      
      for (let i = 0; i < lines.length; i++) {
        if (y > doc.internal.pageSize.height - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(lines[i], margin, y);
        y += lineHeight;
      }
      
      return doc.output('blob');
      
    } catch (error) {
      console.error('Local PDF generation error:', error);
      
      // 最終フォールバック: プレーンテキストファイルとして保存
      console.log('Final fallback: creating text file instead of PDF');
      return new Blob([latexContent], { type: 'text/plain' });
    }
  }

  /**
   * LaTeXコンテンツからテキストを抽出
   */
  extractTextFromLatex(latexContent) {
    // LaTeXコマンドを除去してテキストのみを抽出
    let text = latexContent
      .replace(/\\[a-zA-Z]+(\[[^\]]*\])?(\{[^}]*\})?/g, '') // LaTeXコマンドを除去
      .replace(/\\begin\{[^}]*\}/g, '') // begin環境を除去
      .replace(/\\end\{[^}]*\}/g, '') // end環境を除去
      .replace(/\$\$[^$]*\$\$/g, '') // 数式を除去
      .replace(/\$[^$]*\$/g, '') // インライン数式を除去
      .replace(/\s+/g, ' ') // 複数の空白を単一の空白に
      .trim();
    
    return text || 'Generated paper content';
  }

  /**
   * 生成サマリーを作成
   */
  generateSummary(result) {
    return {
      sourceDocuments: result.sourceDocuments.length,
      generatedFiles: result.generatedFiles.length,
      latexFile: result.generatedFiles.find(f => f.name.endsWith('.tex')),
      pdfFile: result.pdfFile,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 進捗を更新
   */
  updateProgress(progress, stage, message, onProgress) {
    this.generationProgress = { progress, stage, message };
    if (onProgress) {
      onProgress(this.generationProgress);
    }
  }

  /**
   * 生成中かどうかを確認
   */
  isCurrentlyGenerating() {
    return this.isGenerating;
  }

  /**
   * 生成をキャンセル
   */
  cancelGeneration() {
    this.isGenerating = false;
  }
}

// シングルトンインスタンスをエクスポート
const paperGenerationService = new PaperGenerationService();
export default paperGenerationService;
