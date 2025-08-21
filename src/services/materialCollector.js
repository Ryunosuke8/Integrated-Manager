/**
 * ハイブリッド素材収集サービス
 * Academia/Presentationの要件ファイルに基づいて画像・アイコン・グラフを収集
 */
import * as XLSX from 'xlsx';

class MaterialCollectorService {
  constructor() {
    this.isProcessing = false;
  }

  /**
   * メイン処理：素材要件に基づいて素材を収集
   * @param {string} projectId - プロジェクトID
   * @param {Function} onProgress - 進捗コールバック
   * @param {Object} collectionTargets - 収集対象設定
   * @returns {Object} 処理結果
   */
  async collectMaterials(projectId, onProgress = null, collectionTargets = null) {
    if (this.isProcessing) {
      throw new Error('既に素材収集処理中です');
    }

    this.isProcessing = true;
    const result = {
      success: false,
      requirementFiles: [],
      collectedMaterials: {
        images: [],
        charts: [],
        icons: []
      },
      savedFiles: [],
      error: null
    };

    try {
      // 1. プロジェクト構造とMaterialフォルダを準備
      if (onProgress) onProgress({ stage: 'scanning', progress: 10, message: 'プロジェクト構造を確認中...' });
      const projectStructure = await this.getProjectStructure(projectId);
      const materialFolder = await this.ensureMaterialFolder(projectStructure);

      // 2. 要件ファイルを読み込み・作成
      if (onProgress) onProgress({ stage: 'requirements', progress: 25, message: '素材要件を読み込み中...' });
      const requirements = await this.loadOrCreateRequirements(projectStructure, collectionTargets);
      result.requirementFiles = requirements.files;

      // 3. 未収集素材を特定
      if (onProgress) onProgress({ stage: 'analyzing', progress: 40, message: '未収集素材を分析中...' });
      const pendingRequirements = this.filterPendingRequirements(requirements.data);

      if (pendingRequirements.length === 0) {
        result.success = true;
        result.message = '収集が必要な素材はありません。すべて収集済みです。';
        if (onProgress) onProgress({ stage: 'completed', progress: 100, message: '収集済み - 新しい素材はありません' });
        return result;
      }

      // 4. ハイブリッド素材収集
      if (onProgress) onProgress({ stage: 'collecting', progress: 60, message: '素材を収集中...' });
      const collectedMaterials = await this.performHybridCollection(pendingRequirements);
      result.collectedMaterials = collectedMaterials;

      // 5. Materialフォルダに保存
      if (onProgress) onProgress({ stage: 'saving', progress: 80, message: 'Materialフォルダに保存中...' });
      const savedFiles = await this.saveMaterialsToFolder(materialFolder.id, collectedMaterials);
      result.savedFiles = savedFiles;

      // 6. 要件ファイルのステータス更新
      if (onProgress) onProgress({ stage: 'updating', progress: 95, message: '要件ファイルを更新中...' });
      await this.updateRequirementStatus(projectStructure, pendingRequirements, savedFiles);

      if (onProgress) onProgress({ stage: 'completed', progress: 100, message: '素材収集が完了しました！' });
      result.success = true;

    } catch (error) {
      console.error('Material collection failed:', error);
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
    console.log('🔍 Getting project structure for project ID:', projectId);
    
    try {
      const response = await window.gapi.client.drive.files.list({
        q: `'${projectId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)'
      });

      console.log('📁 Found files in project:', response.result.files?.length || 0);

      const folders = response.result.files.filter(file => 
        file.mimeType === 'application/vnd.google-apps.folder'
      );

      console.log('📂 Found folders:', folders.map(f => f.name));

      const structure = {
        projectId,
        academiaFolder: folders.find(folder => folder.name === 'Academia'),
        presentationFolder: folders.find(folder => folder.name === 'Presentation'),
        materialFolder: folders.find(folder => folder.name === 'Material'),
        allFolders: folders
      };

      console.log('🏗️ Project structure:', {
        academiaFolder: structure.academiaFolder?.name || 'NOT FOUND',
        presentationFolder: structure.presentationFolder?.name || 'NOT FOUND',
        materialFolder: structure.materialFolder?.name || 'NOT FOUND',
        totalFolders: folders.length
      });

      return structure;
    } catch (error) {
      console.error('❌ Failed to get project structure:', error);
      throw error;
    }
  }

  /**
   * Materialフォルダを確保（なければ作成）
   */
  async ensureMaterialFolder(projectStructure) {
    console.log('🔍 Ensuring Material folder exists...');
    console.log('📁 Current Material folder:', projectStructure.materialFolder?.name || 'NOT FOUND');
    console.log('🏗️ Project ID for parent:', projectStructure.projectId);
    
    if (projectStructure.materialFolder) {
      console.log('✅ Material folder already exists:', projectStructure.materialFolder.id);
      return projectStructure.materialFolder;
    }

    try {
      console.log('📝 Creating Material folder under project:', projectStructure.projectId);
      const response = await window.gapi.client.drive.files.create({
        resource: {
          name: 'Material',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [projectStructure.projectId]
        }
      });

      const materialFolder = response.result;
      console.log('✅ Material folder created successfully!');
      console.log('📂 New folder ID:', materialFolder.id);
      console.log('📂 New folder name:', materialFolder.name);

      // サブフォルダも作成
      console.log('📁 Creating Material subfolders...');
      await this.createMaterialSubfolders(materialFolder.id);

      return materialFolder;
    } catch (error) {
      console.error('❌ Failed to create Material folder:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        status: error.status,
        projectId: projectStructure.projectId
      });
      throw error;
    }
  }

  /**
   * Materialサブフォルダを作成
   */
  async createMaterialSubfolders(materialFolderId) {
    const subfolders = ['Images', 'Charts', 'Icons'];
    
    for (const folderName of subfolders) {
      try {
        await window.gapi.client.drive.files.create({
          resource: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [materialFolderId]
          }
        });
        console.log(`Created subfolder: ${folderName}`);
      } catch (error) {
        console.warn(`Failed to create subfolder ${folderName}:`, error);
      }
    }
  }

  /**
   * 要件ファイルを読み込み・作成
   */
  async loadOrCreateRequirements(projectStructure, collectionTargets) {
    console.log('🔍 Loading requirements with targets:', collectionTargets);
    console.log('📁 Project structure:', {
      academiaFolder: projectStructure.academiaFolder?.name,
      presentationFolder: projectStructure.presentationFolder?.name
    });

    const result = {
      files: [],
      data: []
    };

    // Academia要件ファイル
    if (collectionTargets?.academia !== false && projectStructure.academiaFolder) {
      console.log('📚 Processing Academia requirements...');
      try {
        const academiaReq = await this.loadOrCreateRequirementFile(
          projectStructure.academiaFolder,
          'Material_Requirements.xlsx',
          this.createAcademiaRequirements()
        );
        result.files.push(academiaReq.file);
        result.data.push(...academiaReq.data.map(item => ({ ...item, source: 'Academia' })));
        console.log('✅ Academia requirements loaded:', academiaReq.file.name);
      } catch (error) {
        console.error('❌ Failed to load Academia requirements:', error);
        throw error;
      }
    } else {
      console.log('⏭️ Skipping Academia requirements:', {
        targetEnabled: collectionTargets?.academia !== false,
        folderExists: !!projectStructure.academiaFolder
      });
    }

    // Presentation要件ファイル
    if (collectionTargets?.presentation !== false && projectStructure.presentationFolder) {
      console.log('📊 Processing Presentation requirements...');
      try {
        const presentationReq = await this.loadOrCreateRequirementFile(
          projectStructure.presentationFolder,
          'Material_Requirements.xlsx',
          this.createPresentationRequirements()
        );
        result.files.push(presentationReq.file);
        result.data.push(...presentationReq.data.map(item => ({ ...item, source: 'Presentation' })));
        console.log('✅ Presentation requirements loaded:', presentationReq.file.name);
      } catch (error) {
        console.error('❌ Failed to load Presentation requirements:', error);
        throw error;
      }
    } else {
      console.log('⏭️ Skipping Presentation requirements:', {
        targetEnabled: collectionTargets?.presentation !== false,
        folderExists: !!projectStructure.presentationFolder
      });
    }

    console.log('📋 Total requirements loaded:', result.data.length);
    return result;
  }

  /**
   * 要件ファイルを読み込み・作成（単一）
   */
  async loadOrCreateRequirementFile(folder, fileName, defaultData) {
    console.log(`🔍 Looking for requirements file: ${fileName} in folder: ${folder.name}`);
    
    try {
      // 既存ファイルを検索
      const response = await window.gapi.client.drive.files.list({
        q: `'${folder.id}' in parents and name='${fileName}' and trashed=false`,
        fields: 'files(id, name)'
      });

      console.log(`📋 Search results for ${fileName}:`, response.result.files?.length || 0, 'files found');

      if (response.result.files && response.result.files.length > 0) {
        // 既存ファイルを読み込み
        const file = response.result.files[0];
        console.log(`📖 Loading existing requirements file: ${fileName} (ID: ${file.id})`);
        const data = await this.readExcelFile(file.id);
        console.log(`✅ Successfully loaded ${data.length} requirements from existing file`);
        return { file, data };
      } else {
        // 新規ファイルを作成
        console.log(`📝 Creating new requirements file: ${fileName} with ${defaultData.length} default items`);
        const file = await this.createExcelFile(folder.id, fileName, defaultData);
        console.log(`✅ Successfully created requirements file: ${file.name} (ID: ${file.id})`);
        return { file, data: defaultData };
      }
    } catch (error) {
      console.error(`❌ Failed to load/create requirements file ${fileName}:`, error);
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
      { カテゴリ: '概念モデル', 素材タイプ: 'アイコン', キーワード: 'conceptual model, framework', 優先度: '中', 用途: '論文図5', ステータス: '未収集' }
    ];
  }

  /**
   * Presentation用のデフォルト要件データを作成
   */
  createPresentationRequirements() {
    return [
      { スライド番号: '3', 素材タイプ: '画像', キーワード: 'teamwork, collaboration', 優先度: '高', 用途: '背景画像', ステータス: '未収集' },
      { スライド番号: '5', 素材タイプ: 'グラフ', キーワード: 'growth chart, progress', 優先度: '高', 用途: 'データ可視化', ステータス: '未収集' },
      { スライド番号: '7', 素材タイプ: 'アイコン', キーワード: 'innovation, lightbulb', 優先度: '中', 用途: 'アクセント', ステータス: '未収集' },
      { スライド番号: '10', 素材タイプ: '画像', キーワード: 'success, achievement', 優先度: '高', 用途: '結論画像', ステータス: '未収集' },
      { スライド番号: '12', 素材タイプ: 'グラフ', キーワード: 'comparison chart, benchmark', 優先度: '中', 用途: '比較データ', ステータス: '未収集' }
    ];
  }

  /**
   * Excelファイルを読み込み
   */
  async readExcelFile(fileId) {
    console.log('📖 Reading Excel file with ID:', fileId);
    
    try {
      // Google DriveからExcelファイルを取得する際の改良されたアプローチ
      console.log('🔍 Attempting to fetch Excel file from Google Drive...');
      
      const response = await window.gapi.client.request({
        path: `https://www.googleapis.com/drive/v3/files/${fileId}`,
        method: 'GET',
        params: {
          alt: 'media'
        }
      });

      console.log('📄 Excel file response received, processing...');
      console.log('📊 Response status:', response.status);
      console.log('📊 Response headers:', response.headers);
      console.log('📊 Response body type:', typeof response.body);
      console.log('📊 Response body length:', response.body?.length || 'undefined');

      let arrayBuffer;

      // Google Drive APIからのバイナリレスポンスを適切に処理
      if (response.body) {
        if (typeof response.body === 'string') {
          console.log('🔄 Processing string response...');
          
          // レスポンスがBase64エンコードされているかチェック
          const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(response.body.replace(/\s/g, ''));
          
          if (isBase64 && response.body.length > 100) {
            console.log('🔄 Detected Base64 encoded content, decoding...');
            try {
              const binaryString = atob(response.body);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              arrayBuffer = bytes.buffer;
              console.log('✅ Base64 decoding successful');
            } catch (base64Error) {
              console.error('❌ Base64 decoding failed:', base64Error);
              throw new Error('Failed to decode Base64 Excel data');
            }
          } else {
            console.log('🔄 Treating as binary string...');
            const bytes = new Uint8Array(response.body.length);
            for (let i = 0; i < response.body.length; i++) {
              bytes[i] = response.body.charCodeAt(i);
            }
            arrayBuffer = bytes.buffer;
          }
        } else if (response.body instanceof ArrayBuffer) {
          console.log('✅ Response is already ArrayBuffer');
          arrayBuffer = response.body;
        } else if (response.body instanceof Uint8Array) {
          console.log('✅ Response is Uint8Array, converting to ArrayBuffer');
          arrayBuffer = response.body.buffer;
        } else {
          console.error('❌ Unsupported response body type:', typeof response.body);
          throw new Error(`Unsupported response body type: ${typeof response.body}`);
        }
      } else {
        console.error('❌ No response body received');
        throw new Error('No response body received from Google Drive');
      }

      console.log('📊 Final ArrayBuffer size:', arrayBuffer.byteLength);

      // XLSXで読み込み
      console.log('📊 Attempting to parse Excel with XLSX...');
      const workbook = XLSX.read(arrayBuffer, { 
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false
      });
      
      console.log('📋 Workbook loaded successfully!');
      console.log('📋 Available sheets:', workbook.SheetNames);
      
      if (workbook.SheetNames.length === 0) {
        console.warn('⚠️ No sheets found in workbook, returning empty data');
        return [];
      }

      const sheetName = workbook.SheetNames[0];
      console.log('📄 Reading sheet:', sheetName);
      
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        console.warn('⚠️ Selected sheet is empty or invalid');
        return [];
      }

      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,  // 最初に配列として読み込み
        defval: '',
        blankrows: false
      });
      
      console.log('📊 Raw sheet data:', data.length, 'rows');
      
      if (data.length === 0) {
        console.warn('⚠️ No data found in Excel sheet');
        return [];
      }

      // ヘッダー行がある場合の処理
      const headers = data[0];
      const rows = data.slice(1);
      
      console.log('📋 Headers found:', headers);
      console.log('📊 Data rows:', rows.length);

      // オブジェクト形式に変換
      const jsonData = rows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          if (header && header.trim()) {
            obj[header.trim()] = row[index] || '';
          }
        });
        return obj;
      }).filter(obj => Object.keys(obj).length > 0); // 空のオブジェクトを除外

      console.log('✅ Successfully parsed Excel data:', jsonData.length, 'valid rows');
      return jsonData;
      
    } catch (error) {
      console.error('❌ Failed to read Excel file:', error);
      console.error('🔍 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      
      // フォールバック: 空の配列を返す代わりに、デフォルトデータを返す
      console.log('🔄 Falling back to default data structure...');
      return this.getDefaultRequirementsStructure();
    }
  }

  /**
   * デフォルトの要件データ構造を取得（フォールバック用）
   */
  getDefaultRequirementsStructure() {
    console.log('📋 Returning default requirements structure');
    return [
      { カテゴリ: 'フォールバック', 素材タイプ: '画像', キーワード: 'fallback, default', 優先度: '中', 用途: 'フォールバック用', ステータス: '未収集' }
    ];
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
   * 未収集素材をフィルタ
   */
  filterPendingRequirements(allRequirements) {
    return allRequirements.filter(req => 
      req.ステータス === '未収集' || !req.ステータス
    );
  }

  /**
   * ハイブリッド素材収集を実行
   */
  async performHybridCollection(requirements) {
    const result = {
      images: [],
      charts: [],
      icons: []
    };

    for (const req of requirements) {
      try {
        const keywords = req.キーワード || '';
        
        switch (req.素材タイプ) {
          case '画像':
            const images = await this.collectImages(keywords, req);
            result.images.push(...images);
            break;
          case 'グラフ':
            const charts = await this.generateCharts(keywords, req);
            result.charts.push(...charts);
            break;
          case 'アイコン':
            const icons = await this.collectIcons(keywords, req);
            result.icons.push(...icons);
            break;
        }
      } catch (error) {
        console.warn(`Failed to collect material for requirement:`, req, error);
      }
    }

    return result;
  }

  /**
   * 画像を収集（モック実装）
   */
  async collectImages(keywords, requirement) {
    // 実際の実装では Unsplash API を使用
    console.log(`Collecting images for: ${keywords}`);
    
    // モックデータ
    return [
      {
        id: `img_${Date.now()}_1`,
        type: 'image',
        keywords: keywords,
        source: 'Unsplash (Mock)',
        url: 'https://via.placeholder.com/800x600/4F46E5/FFFFFF?text=Research+Image',
        filename: `research_${keywords.replace(/[^a-zA-Z0-9]/g, '_')}_1.jpg`,
        license: 'Unsplash License',
        requirement: requirement
      },
      {
        id: `img_${Date.now()}_2`,
        type: 'image',
        keywords: keywords,
        source: 'Unsplash (Mock)',
        url: 'https://via.placeholder.com/800x600/10B981/FFFFFF?text=Academic+Visual',
        filename: `academic_${keywords.replace(/[^a-zA-Z0-9]/g, '_')}_2.jpg`,
        license: 'Unsplash License',
        requirement: requirement
      }
    ];
  }

  /**
   * グラフを生成
   */
  async generateCharts(keywords, requirement) {
    console.log(`Generating charts for: ${keywords}`);
    
    // Chart.js を使用してグラフを生成（モック実装）
    return [
      {
        id: `chart_${Date.now()}_1`,
        type: 'chart',
        keywords: keywords,
        source: 'Chart.js Generated',
        chartType: 'bar',
        data: this.generateMockChartData('bar'),
        filename: `bar_chart_${keywords.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
        requirement: requirement
      },
      {
        id: `chart_${Date.now()}_2`,
        type: 'chart',
        keywords: keywords,
        source: 'Chart.js Generated',
        chartType: 'line',
        data: this.generateMockChartData('line'),
        filename: `line_chart_${keywords.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
        requirement: requirement
      }
    ];
  }

  /**
   * アイコンを収集
   */
  async collectIcons(keywords, requirement) {
    console.log(`Collecting icons for: ${keywords}`);
    
    // Heroicons からアイコンを選択（モック実装）
    return [
      {
        id: `icon_${Date.now()}_1`,
        type: 'icon',
        keywords: keywords,
        source: 'Heroicons',
        iconName: 'academic-cap',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 14l9-5-9-5-9 5 9 5z"/></svg>',
        filename: `academic_cap_${keywords.replace(/[^a-zA-Z0-9]/g, '_')}.svg`,
        requirement: requirement
      },
      {
        id: `icon_${Date.now()}_2`,
        type: 'icon',
        keywords: keywords,
        source: 'Heroicons',
        iconName: 'chart-bar',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z"/></svg>',
        filename: `chart_bar_${keywords.replace(/[^a-zA-Z0-9]/g, '_')}.svg`,
        requirement: requirement
      }
    ];
  }

  /**
   * モックチャートデータを生成
   */
  generateMockChartData(chartType) {
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const data = Array.from({ length: 6 }, () => Math.floor(Math.random() * 100) + 10);
    
    return {
      type: chartType,
      data: {
        labels: labels,
        datasets: [{
          label: 'Research Data',
          data: data,
          backgroundColor: chartType === 'bar' 
            ? 'rgba(79, 70, 229, 0.8)'
            : 'rgba(79, 70, 229, 0.2)',
          borderColor: 'rgba(79, 70, 229, 1)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Research Analysis Chart'
          }
        }
      }
    };
  }

  /**
   * シンプルなグラフを描画
   */
  drawSimpleChart(ctx, chartData, width, height) {
    // 背景をクリア
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // グラフタイプに応じて描画
    if (chartData.type === 'bar') {
      this.drawBarChart(ctx, chartData, width, height);
    } else if (chartData.type === 'line') {
      this.drawLineChart(ctx, chartData, width, height);
    } else {
      this.drawBarChart(ctx, chartData, width, height); // デフォルト
    }
  }

  /**
   * 棒グラフを描画
   */
  drawBarChart(ctx, chartData, width, height) {
    const data = chartData.data.datasets[0].data;
    const labels = chartData.data.labels;
    const maxValue = Math.max(...data);
    
    const margin = 80;
    const chartWidth = width - 2 * margin;
    const chartHeight = height - 2 * margin;
    const barWidth = chartWidth / data.length * 0.8;
    const barSpacing = chartWidth / data.length * 0.2;
    
    // タイトル
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(chartData.options?.plugins?.title?.text || 'Chart', width / 2, 30);
    
    // Y軸
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.stroke();
    
    // X軸
    ctx.beginPath();
    ctx.moveTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
    
    // 棒グラフを描画
    ctx.fillStyle = '#4f46e5';
    data.forEach((value, index) => {
      const barHeight = (value / maxValue) * chartHeight;
      const x = margin + index * (barWidth + barSpacing) + barSpacing / 2;
      const y = height - margin - barHeight;
      
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // ラベル
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(labels[index], x + barWidth / 2, height - margin + 20);
      
      // 値
      ctx.fillStyle = '#1f2937';
      ctx.fillText(value.toString(), x + barWidth / 2, y - 5);
      
      ctx.fillStyle = '#4f46e5';
    });
  }

  /**
   * 折れ線グラフを描画
   */
  drawLineChart(ctx, chartData, width, height) {
    const data = chartData.data.datasets[0].data;
    const labels = chartData.data.labels;
    const maxValue = Math.max(...data);
    
    const margin = 80;
    const chartWidth = width - 2 * margin;
    const chartHeight = height - 2 * margin;
    
    // タイトル
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(chartData.options?.plugins?.title?.text || 'Chart', width / 2, 30);
    
    // Y軸
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.stroke();
    
    // X軸
    ctx.beginPath();
    ctx.moveTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
    
    // 折れ線グラフを描画
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    data.forEach((value, index) => {
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = height - margin - (value / maxValue) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      // ポイント
      ctx.fillStyle = '#4f46e5';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
      
      // ラベル
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(labels[index], x, height - margin + 20);
      
      // 値
      ctx.fillStyle = '#1f2937';
      ctx.fillText(value.toString(), x, y - 10);
    });
    
    ctx.stroke();
  }

  /**
   * 収集した素材をMaterialフォルダに保存
   */
  async saveMaterialsToFolder(materialFolderId, collectedMaterials) {
    const savedFiles = [];

    try {
      // サブフォルダのIDを取得
      const subfolders = await this.getMaterialSubfolders(materialFolderId);

      // 画像を保存
      for (const image of collectedMaterials.images) {
        const file = await this.saveImageFile(subfolders.Images, image);
        savedFiles.push(file);
      }

      // グラフを保存
      for (const chart of collectedMaterials.charts) {
        const file = await this.saveChartFile(subfolders.Charts, chart);
        savedFiles.push(file);
      }

      // アイコンを保存
      for (const icon of collectedMaterials.icons) {
        const file = await this.saveIconFile(subfolders.Icons, icon);
        savedFiles.push(file);
      }

      return savedFiles;
    } catch (error) {
      console.error('Failed to save materials to folder:', error);
      throw error;
    }
  }

  /**
   * MaterialサブフォルダのIDを取得
   */
  async getMaterialSubfolders(materialFolderId) {
    try {
      const response = await window.gapi.client.drive.files.list({
        q: `'${materialFolderId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id, name)'
      });

      const folders = {};
      response.result.files.forEach(folder => {
        folders[folder.name] = folder.id;
      });

      return folders;
    } catch (error) {
      console.error('Failed to get material subfolders:', error);
      throw error;
    }
  }

  /**
   * 画像ファイルを保存
   */
  async saveImageFile(folderId, imageData) {
    console.log(`Saving image: ${imageData.filename}`);
    
    try {
      // 画像URLから画像データを取得
      const response = await fetch(imageData.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const imageBlob = await response.blob();
      
      // PNG形式で保存
      const fileName = imageData.filename.replace(/\.[^/.]+$/, '') + '.png';
      
      // ファイルメタデータ
      const metadata = {
        'name': fileName,
        'parents': [folderId],
        'mimeType': 'image/png'
      };

      // multipart/form-dataでアップロード
      const boundary = '-------314159265358979323846264338327950288419716939937510';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      // 画像データをBase64に変換
      const arrayBuffer = await imageBlob.arrayBuffer();
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: image/png\r\n' +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        base64Data +
        close_delim;

      const uploadResponse = await window.gapi.client.request({
        'path': 'https://www.googleapis.com/upload/drive/v3/files',
        'method': 'POST',
        'params': {'uploadType': 'multipart'},
        'headers': {
          'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        'body': multipartRequestBody
      });

      console.log(`✅ Image saved successfully: ${fileName}`);
      return uploadResponse.result;
      
    } catch (error) {
      console.error(`❌ Failed to save image ${imageData.filename}:`, error);
      
      // フォールバック: テキストファイルとして保存
      console.log(`🔄 Falling back to text file for: ${imageData.filename}`);
      const mockContent = `Image placeholder for: ${imageData.keywords}\nURL: ${imageData.url}\nError: ${error.message}`;
      return await this.saveTextFile(folderId, `${imageData.filename}.txt`, mockContent);
    }
  }

  /**
   * グラフファイルを保存
   */
  async saveChartFile(folderId, chartData) {
    console.log(`Saving chart: ${chartData.filename}`);
    
    try {
      // Chart.jsを使用してグラフをPNGとして生成
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      
      // グラフデータに基づいてシンプルなグラフを描画
      this.drawSimpleChart(ctx, chartData.data, canvas.width, canvas.height);
      
      // CanvasをPNGとしてエクスポート
      const pngBlob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png');
      });
      
      // PNG形式で保存
      const fileName = chartData.filename.replace(/\.[^/.]+$/, '') + '.png';
      
      // ファイルメタデータ
      const metadata = {
        'name': fileName,
        'parents': [folderId],
        'mimeType': 'image/png'
      };

      // multipart/form-dataでアップロード
      const boundary = '-------314159265358979323846264338327950288419716939937510';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      // 画像データをBase64に変換
      const arrayBuffer = await pngBlob.arrayBuffer();
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: image/png\r\n' +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        base64Data +
        close_delim;

      const uploadResponse = await window.gapi.client.request({
        'path': 'https://www.googleapis.com/upload/drive/v3/files',
        'method': 'POST',
        'params': {'uploadType': 'multipart'},
        'headers': {
          'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        'body': multipartRequestBody
      });

      console.log(`✅ Chart saved successfully: ${fileName}`);
      return uploadResponse.result;
      
    } catch (error) {
      console.error(`❌ Failed to save chart ${chartData.filename}:`, error);
      
      // フォールバック: JSONファイルとして保存
      console.log(`🔄 Falling back to JSON file for: ${chartData.filename}`);
      const chartJson = JSON.stringify(chartData.data, null, 2);
      return await this.saveTextFile(folderId, `${chartData.filename}.json`, chartJson);
    }
  }

  /**
   * アイコンファイルを保存
   */
  async saveIconFile(folderId, iconData) {
    console.log(`Saving icon: ${iconData.filename}`);
    
    try {
      // SVG形式で保存
      const fileName = iconData.filename.replace(/\.[^/.]+$/, '') + '.svg';
      
      // ファイルメタデータ
      const metadata = {
        'name': fileName,
        'parents': [folderId],
        'mimeType': 'image/svg+xml'
      };

      // multipart/form-dataでアップロード
      const boundary = '-------314159265358979323846264338327950288419716939937510';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: image/svg+xml\r\n\r\n' +
        iconData.svg +
        close_delim;

      const uploadResponse = await window.gapi.client.request({
        'path': 'https://www.googleapis.com/upload/drive/v3/files',
        'method': 'POST',
        'params': {'uploadType': 'multipart'},
        'headers': {
          'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        'body': multipartRequestBody
      });

      console.log(`✅ Icon saved successfully: ${fileName}`);
      return uploadResponse.result;
      
    } catch (error) {
      console.error(`❌ Failed to save icon ${iconData.filename}:`, error);
      
      // フォールバック: テキストファイルとして保存
      console.log(`🔄 Falling back to text file for: ${iconData.filename}`);
      return await this.saveTextFile(folderId, `${iconData.filename}.txt`, iconData.svg);
    }
  }

  /**
   * テキストファイルを保存
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
      console.error(`Failed to save file ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * 要件ファイルのステータスを更新
   */
  async updateRequirementStatus(projectStructure, completedRequirements, savedFiles) {
    // 実装簡略化のため、コンソールログのみ
    console.log('Updating requirement status for:', completedRequirements.length, 'items');
    console.log('Saved files:', savedFiles.length);
    
    // 実際の実装では、Excelファイルを読み込み、ステータスを「収集済み」に更新して再保存
  }

  /**
   * 処理中かどうかを確認
   */
  isCurrentlyProcessing() {
    return this.isProcessing;
  }
}

// シングルトンインスタンスをエクスポート
const materialCollectorService = new MaterialCollectorService();
export default materialCollectorService;
