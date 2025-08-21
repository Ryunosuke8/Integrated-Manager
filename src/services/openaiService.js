/**
 * OpenAI API サービス
 * OpenAI APIを使用したAI処理機能を提供
 */
class OpenAIService {
  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * 設定を読み込み
   */
  loadConfig() {
    try {
      const savedConfig = localStorage.getItem('openai_config');
      return savedConfig ? JSON.parse(savedConfig) : null;
    } catch (error) {
      console.error('Failed to load OpenAI config:', error);
      return null;
    }
  }

  /**
   * 設定が有効かチェック
   */
  isConfigured() {
    return this.config && this.config.apiKey && this.config.apiKey.trim() !== '';
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig) {
    this.config = newConfig;
    localStorage.setItem('openai_config', JSON.stringify(newConfig));
  }

  /**
   * OpenAI APIにリクエストを送信
   */
  async makeRequest(messages, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API設定が完了していません。設定画面でAPIキーを入力してください。');
    }

    const requestBody = {
      model: options.model || this.config.model || 'gpt-4',
      messages: messages,
      temperature: options.temperature || this.config.temperature || 0.7,
      max_tokens: options.maxTokens || this.config.maxTokens || 2000
    };

    // 追加のオプションを安全にマージ（maxTokensは除外）
    const { maxTokens, ...otherOptions } = options;
    Object.assign(requestBody, otherOptions);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('OpenAI API request failed:', error);
      throw error;
    }
  }

  /**
   * 論文トピック提案のためのAI処理
   */
  async generatePaperTopicSuggestion(mainDocumentContent, fileName) {
    const systemPrompt = `あなたは学術研究の専門家です。与えられたドキュメントの内容を分析し、学術的な研究テーマとして発展可能な論文トピックを提案してください。

以下の要件に従って論文トピックを生成してください：

1. **分析対象**: 提供されたドキュメントの内容を詳細に分析
2. **研究テーマ**: 5つの異なるカテゴリの研究テーマを提案
3. **実用性**: 実際に研究可能で価値のあるテーマを提案
4. **学術的価値**: 既存研究との関連性と新規性を考慮
5. **実現可能性**: 技術的・リソース的に実現可能なテーマを提案

カテゴリ：
- 技術革新・システム開発に関する研究
- プロジェクト管理・開発プロセスに関する研究
- ユーザーエクスペリエンス・インターフェース設計に関する研究
- システムアーキテクチャ・設計手法に関する研究
- 学際的・応用領域に関する研究

各テーマについて以下を含めてください：
- 具体的な研究タイトル
- 研究の背景と目的
- 研究の意義と貢献
- 想定される研究手法
- 期待される成果
- 今後の展開可能性

出力形式は日本語のMarkdown形式で、構造化された詳細な提案を作成してください。`;

    const userPrompt = `以下のドキュメントの内容を分析して、学術的な論文トピックを提案してください：

**ドキュメント名**: ${fileName}

**ドキュメント内容**:
${mainDocumentContent}

上記の内容に基づいて、5つの異なるカテゴリの研究テーマを詳細に提案してください。`;

    try {
      const response = await this.makeRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.8, // 創造性を高める
        maxTokens: 3000   // 詳細な提案のため長めに設定
      });

      return response;
    } catch (error) {
      console.error('Paper topic suggestion generation failed:', error);
      throw error;
    }
  }

  /**
   * ドキュメント要約のためのAI処理
   */
  async generateDocumentSummary(documentContent) {
    const systemPrompt = `あなたは文書分析の専門家です。与えられたドキュメントの内容を分析し、簡潔で分かりやすい要約を作成してください。

以下の点に注意して要約を作成してください：
1. **主要なポイント**: 最も重要な情報を抽出
2. **構造化**: 見出しや箇条書きを使用して読みやすく整理
3. **客観性**: 事実に基づいた客観的な要約
4. **簡潔性**: 冗長な表現を避け、要点を明確に
5. **完全性**: 重要な情報の漏れがないよう注意

出力形式は日本語のMarkdown形式で作成してください。`;

    const userPrompt = `以下のドキュメントの内容を要約してください：

${documentContent}`;

    try {
      const response = await this.makeRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.3, // 一貫性を重視
        maxTokens: 1500
      });

      return response;
    } catch (error) {
      console.error('Document summary generation failed:', error);
      throw error;
    }
  }

  /**
   * アウトライン生成のためのAI処理
   */
  async generateOutline(documentContent) {
    const systemPrompt = `あなたはプロジェクト管理の専門家です。与えられたドキュメントの内容を分析し、プロジェクトの構造化されたアウトラインを作成してください。

以下の要素を含むアウトラインを作成してください：
1. **プロジェクト概要**: 目的、背景、スコープ
2. **主要コンポーネント**: プロジェクトの主要な構成要素
3. **実装計画**: 段階的な実装ステップ
4. **リソース要件**: 必要な技術、人材、ツール
5. **リスクと対策**: 想定される課題と対応策
6. **成功指標**: プロジェクトの成功を測る指標
7. **今後の展望**: 発展可能性と次のステップ

出力形式は日本語のMarkdown形式で、階層構造を明確にしてください。`;

    const userPrompt = `以下のドキュメントの内容を分析して、プロジェクトのアウトラインを作成してください：

${documentContent}`;

    try {
      const response = await this.makeRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.4,
        maxTokens: 2000
      });

      return response;
    } catch (error) {
      console.error('Outline generation failed:', error);
      throw error;
    }
  }

  /**
   * 重複分析のためのAI処理
   */
  async analyzeDuplicates(documentContent) {
    const systemPrompt = `あなたは文書分析の専門家です。与えられたドキュメントの内容を分析し、重複や冗長な部分を特定してください。

以下の観点から分析してください：
1. **内容の重複**: 同じ内容が複数箇所で説明されている部分
2. **冗長な表現**: 不必要に長い説明や繰り返し
3. **構造の改善**: より効率的な構成への提案
4. **統合の提案**: 重複部分の統合方法
5. **削除推奨**: 不要な部分の特定

出力形式は日本語のMarkdown形式で、具体的な改善提案を含めてください。`;

    const userPrompt = `以下のドキュメントの内容を分析して、重複や冗長な部分を特定し、改善提案を行ってください：

${documentContent}`;

    try {
      const response = await this.makeRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.3,
        maxTokens: 1500
      });

      return response;
    } catch (error) {
      console.error('Duplicate analysis failed:', error);
      throw error;
    }
  }

  /**
   * API設定のテスト
   */
  async testConnection() {
    try {
      const response = await this.makeRequest([
        {
          role: 'user',
          content: 'Hello! This is a test message to verify the API connection.'
        }
      ], {
        maxTokens: 50,
        temperature: 0.1
      });

      return response.length > 0;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }
}

// シングルトンインスタンスをエクスポート
const openaiService = new OpenAIService();
export default openaiService;
