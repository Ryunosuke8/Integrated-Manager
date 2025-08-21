/**
 * 素材要件ファイル作成サービス
 * Academia/Presentationに要件Excelファイルを作成する専用サービス
 */
import * as XLSX from 'xlsx';

class RequirementsCreatorService {
  constructor() {
    this.isProcessing = false;
  }

  /**
   * メイン処理：要件ファイルを作成
   * @param {string} projectId - プロジェクトID
   * @param {Function} onProgress - 進捗コールバック
   * @param {Object} creationTargets - 作成対象設定
   * @returns {Object} 処理結果
   */
  async createRequirementsFiles(projectId, onProgress = null, creationTargets = null) {
    if (this.isProcessing) {
      throw new Error('既に要件ファイル作成処理中です');
    }

    this.isProcessing = true;
    const result = {
      success: false,
      createdFiles: [],
      skippedFiles: [],
      error: null
    };

    try {
      // 1. プロジェクト構造を取得
      if (onProgress) onProgress({ stage: 'scanning', progress: 20, message: 'プロジェクト構造を取得中...' });
      const projectStructure = await this.getProjectStructure(projectId);

      // 2. Academia要件ファイルを作成
      if (creationTargets?.academia !== false && projectStructure.academiaFolder) {
        if (onProgress) onProgress({ stage: 'academia', progress: 40, message: 'Academia要件ファイルを作成中...' });
        const academiaResult = await this.createRequirementFile(
          projectStructure.academiaFolder,
          'Material_Requirements.xlsx',
          this.createAcademiaRequirements(),
          'Academia'
        );
        
        if (academiaResult.created) {
          result.createdFiles.push(academiaResult);
        } else {
          result.skippedFiles.push(academiaResult);
        }
      }

      // 3. Presentation要件ファイルを作成
      if (creationTargets?.presentation !== false && projectStructure.presentationFolder) {
        if (onProgress) onProgress({ stage: 'presentation', progress: 70, message: 'Presentation要件ファイルを作成中...' });
        const presentationResult = await this.createRequirementFile(
          projectStructure.presentationFolder,
          'Material_Requirements.xlsx',
          this.createPresentationRequirements(),
          'Presentation'
        );
        
        if (presentationResult.created) {
          result.createdFiles.push(presentationResult);
        } else {
          result.skippedFiles.push(presentationResult);
        }
      }

      if (onProgress) onProgress({ stage: 'completed', progress: 100, message: '要件ファイル作成が完了しました！' });
      result.success = true;

    } catch (error) {
      console.error('Requirements creation failed:', error);
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
    console.log('🔍 Getting project structure for requirements creation:', projectId);
    
    try {
      const response = await window.gapi.client.drive.files.list({
        q: `'${projectId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)'
      });

      const folders = response.result.files.filter(file => 
        file.mimeType === 'application/vnd.google-apps.folder'
      );

      console.log('📂 Available folders for requirements:', folders.map(f => f.name));

      return {
        projectId,
        academiaFolder: folders.find(folder => folder.name === 'Academia'),
        presentationFolder: folders.find(folder => folder.name === 'Presentation'),
        allFolders: folders
      };
    } catch (error) {
      console.error('❌ Failed to get project structure:', error);
      throw error;
    }
  }

  /**
   * 単一の要件ファイルを作成
   */
  async createRequirementFile(folder, fileName, defaultData, folderType) {
    console.log(`🔍 Creating requirements file: ${fileName} in ${folderType} folder`);
    
    try {
      // 既存ファイルを確認
      const response = await window.gapi.client.drive.files.list({
        q: `'${folder.id}' in parents and name='${fileName}' and trashed=false`,
        fields: 'files(id, name)'
      });

      if (response.result.files && response.result.files.length > 0) {
        const existingFile = response.result.files[0];
        console.log(`⏭️ Requirements file already exists: ${fileName} (ID: ${existingFile.id})`);
        return {
          created: false,
          file: existingFile,
          folderType: folderType,
          reason: '既存のファイルが存在するためスキップ'
        };
      }

      // 新規ファイルを作成
      console.log(`📝 Creating new requirements file: ${fileName} with ${defaultData.length} items`);
      const file = await this.createExcelFile(folder.id, fileName, defaultData);
      console.log(`✅ Successfully created: ${file.name} (ID: ${file.id})`);
      
      return {
        created: true,
        file: file,
        folderType: folderType,
        itemCount: defaultData.length
      };

    } catch (error) {
      console.error(`❌ Failed to create requirements file ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Excelファイルを作成
   */
  async createExcelFile(folderId, fileName, data) {
    try {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Requirements');

      // ArrayBufferとして出力
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      
      // Base64に変換
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(excelBuffer)));

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

      return response.result;
    } catch (error) {
      console.error('Failed to create Excel file:', error);
      throw error;
    }
  }

  /**
   * Academia用のデフォルト要件データを作成
   */
  createAcademiaRequirements() {
    return [
      { カテゴリ: '研究手法', 素材タイプ: '画像', キーワード: 'research methodology, scientific method', 優先度: '高', 用途: '論文図1', ステータス: '未収集' },
      { カテゴリ: 'データ分析', 素材タイプ: 'グラフ', キーワード: 'data analysis, statistics', 優先度: '高', 用途: '論文図2', ステータス: '未収集' },
      { カテゴリ: '実験設計', 素材タイプ: 'アイコン', キーワード: 'experiment, laboratory', 優先度: '中', 用途: '論文図3', ステータス: '未収集' },
      { カテゴリ: '結果可視化', 素材タイプ: 'グラフ', キーワード: 'results visualization, charts', 優先度: '高', 用途: '論文図4', ステータス: '未収集' },
      { カテゴリ: '概念モデル', 素材タイプ: 'アイコン', キーワード: 'conceptual model, framework', 優先度: '中', 用途: '論文図5', ステータス: '未収集' },
      { カテゴリ: '文献調査', 素材タイプ: '画像', キーワード: 'literature review, books', 優先度: '中', 用途: '論文背景', ステータス: '未収集' },
      { カテゴリ: '比較分析', 素材タイプ: 'グラフ', キーワード: 'comparison analysis, benchmark', 優先度: '高', 用途: '論文比較', ステータス: '未収集' }
    ];
  }

  /**
   * Presentation用のデフォルト要件データを作成
   */
  createPresentationRequirements() {
    return [
      { スライド番号: '1', 素材タイプ: '画像', キーワード: 'presentation, title slide', 優先度: '高', 用途: 'タイトル背景', ステータス: '未収集' },
      { スライド番号: '3', 素材タイプ: '画像', キーワード: 'teamwork, collaboration', 優先度: '高', 用途: '背景画像', ステータス: '未収集' },
      { スライド番号: '5', 素材タイプ: 'グラフ', キーワード: 'growth chart, progress', 優先度: '高', 用途: 'データ可視化', ステータス: '未収集' },
      { スライド番号: '7', 素材タイプ: 'アイコン', キーワード: 'innovation, lightbulb', 優先度: '中', 用途: 'アクセント', ステータス: '未収集' },
      { スライド番号: '10', 素材タイプ: '画像', キーワード: 'success, achievement', 優先度: '高', 用途: '結論画像', ステータス: '未収集' },
      { スライド番号: '12', 素材タイプ: 'グラフ', キーワード: 'comparison chart, benchmark', 優先度: '中', 用途: '比較データ', ステータス: '未収集' },
      { スライド番号: '15', 素材タイプ: 'アイコン', キーワード: 'questions, Q&A', 優先度: '低', 用途: '質疑応答', ステータス: '未収集' },
      { スライド番号: '16', 素材タイプ: '画像', キーワード: 'thank you, appreciation', 優先度: '中', 用途: '謝辞スライド', ステータス: '未収集' }
    ];
  }

  /**
   * 処理中かどうかを確認
   */
  isCurrentlyProcessing() {
    return this.isProcessing;
  }
}

// シングルトンインスタンスをエクスポート
const requirementsCreatorService = new RequirementsCreatorService();
export default requirementsCreatorService;


