import { PROJECT_FOLDER_STRUCTURE, PANEL_FOLDER_MAPPING } from '../config/googleDriveConfig';

class GoogleDriveService {
  constructor() {
    this.isInitialized = false;
    this.accessToken = null;
    this.tokenClient = null;
  }

  // Google API Client LibraryとGoogle Identity Servicesを動的に読み込み
  loadGoogleAPI() {
    return new Promise((resolve, reject) => {
      // 既に読み込まれている場合
      if (window.gapi && window.gapi.client && window.google?.accounts) {
        resolve();
        return;
      }

      let loadedCount = 0;
      const totalToLoad = 2;

      const checkAllLoaded = () => {
        loadedCount++;
        if (loadedCount === totalToLoad) {
          resolve();
        }
      };

      // Google API Client Libraryを読み込み
      const gapiScript = document.createElement('script');
      gapiScript.src = 'https://apis.google.com/js/api.js';
      gapiScript.onload = () => {
        window.gapi.load('client', checkAllLoaded);
      };
      gapiScript.onerror = () => {
        reject(new Error('Failed to load Google API Client Library'));
      };
      document.head.appendChild(gapiScript);

      // Google Identity Servicesを読み込み
      const gisScript = document.createElement('script');
      gisScript.src = 'https://accounts.google.com/gsi/client';
      gisScript.onload = checkAllLoaded;
      gisScript.onerror = () => {
        reject(new Error('Failed to load Google Identity Services'));
      };
      document.head.appendChild(gisScript);
    });
  }

  // Google Drive APIの初期化
  async initialize() {
    if (this.isInitialized) return;

    // 環境変数のチェック
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    
    if (!apiKey || !clientId || 
        apiKey === 'your_google_api_key_here' || 
        clientId === 'your_google_client_id_here') {
      throw new Error('Google Drive API credentials not configured. Please set up your .env file with valid credentials.');
    }

    try {
      // Google API Client LibraryとGoogle Identity Servicesを読み込み
      await this.loadGoogleAPI();
      
      // Google API Clientを初期化
      await window.gapi.client.init({
        apiKey: apiKey,
        discoveryDocs: [
          'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
          'https://www.googleapis.com/discovery/v1/apis/slides/v1/rest'
        ]
      });

      // Google Identity Services (GIS) Token Clientを初期化
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/presentations.readonly',
        callback: (response) => {
          if (response.error) {
            console.error('Token request failed:', response.error);
            return;
          }
          this.accessToken = response.access_token;
          // アクセストークンをgapi.clientに設定
          window.gapi.client.setToken({ access_token: this.accessToken });
        }
      });

      this.isInitialized = true;
      console.log('Google Drive API initialized with GIS');
      
      // Google APIの警告メッセージを抑制（オプション）
      if (window.gapi && window.gapi.client) {
        window.gapi.client.setToken = window.gapi.client.setToken || function() {};
      }
    } catch (error) {
      console.error('Google Drive API initialization failed:', error);
      throw error;
    }
  }

  // 認証状態を確認
  async isSignedIn() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.accessToken !== null;
  }

  // サインイン
  async signIn() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!(await this.isSignedIn())) {
      return new Promise((resolve, reject) => {
        // コールバックを一時的に更新
        const originalCallback = this.tokenClient.callback;
        this.tokenClient.callback = (response) => {
          if (response.error) {
            // ポップアップブロッカーエラーの場合
            if (response.error === 'popup_closed_by_user' || response.error.includes('popup')) {
              alert('ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。');
            }
            reject(new Error(response.error));
            return;
          }
          this.accessToken = response.access_token;
          window.gapi.client.setToken({ access_token: this.accessToken });
          // 元のコールバックを復元
          this.tokenClient.callback = originalCallback;
          resolve();
        };
        
        // ポップアップブロッカーをチェック
        const popup = window.open('', '_blank', 'width=1,height=1');
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          alert('ポップアップがブロックされています。ブラウザの設定でポップアップを許可してください。');
          reject(new Error('popup_blocked'));
          return;
        }
        popup.close();
        
        // トークンをリクエスト
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
      });
    }
  }

  // サインアウト
  async signOut() {
    if (this.accessToken) {
      // トークンを取り消し
      window.google.accounts.oauth2.revoke(this.accessToken);
      this.accessToken = null;
      window.gapi.client.setToken(null);
    }
  }

  // アクセストークンの有効性をチェック
  async checkTokenValidity() {
    if (!this.accessToken) return false;
    
    try {
      // 簡単なAPI呼び出しでトークンの有効性を確認
      await window.gapi.client.drive.about.get({ fields: 'user' });
      return true;
    } catch (error) {
      console.warn('Token validation failed:', error);
      this.accessToken = null;
      window.gapi.client.setToken(null);
      return false;
    }
  }

  // APIリクエスト前のトークンチェック
  async ensureValidToken() {
    if (!this.accessToken || !(await this.checkTokenValidity())) {
      await this.signIn();
    }
  }

  // 新しいプロジェクトを作成
  async createProject(projectName, panelTitle = null) {
    try {
      await this.ensureValidToken();
      
      let parentFolderId = null;
      
      // パネルタイトルが指定されている場合の処理
      if (panelTitle && PANEL_FOLDER_MAPPING.hasOwnProperty(panelTitle)) {
        const panelFolderName = PANEL_FOLDER_MAPPING[panelTitle];
        
        // まずIntegrated-Managerフォルダを検索
        const integratedManagerFolder = await this.findFolder('Integrated-Manager');
        
        if (panelFolderName === null) {
          // nullの場合はIntegrated-Manager直下にプロジェクトを作成
          if (integratedManagerFolder) {
            parentFolderId = integratedManagerFolder.id;
          } else {
            // Integrated-Managerフォルダが存在しない場合は作成
            const newIntegratedManagerFolder = await this.createFolder('Integrated-Manager');
            parentFolderId = newIntegratedManagerFolder.id;
          }
        } else {
          // 従来通りパネルフォルダ内に作成
          if (integratedManagerFolder) {
            // Integrated-Manager内のパネルフォルダを検索
            const panelFolder = await this.findFolder(panelFolderName, integratedManagerFolder.id);
            if (panelFolder) {
              parentFolderId = panelFolder.id;
            } else {
              // パネルフォルダが存在しない場合は作成
              const newPanelFolder = await this.createFolder(panelFolderName, integratedManagerFolder.id);
              parentFolderId = newPanelFolder.id;
            }
          } else {
            // Integrated-Managerフォルダが存在しない場合は作成
            const newIntegratedManagerFolder = await this.createFolder('Integrated-Manager');
            const newPanelFolder = await this.createFolder(panelFolderName, newIntegratedManagerFolder.id);
            parentFolderId = newPanelFolder.id;
          }
        }
      }
      
      // メインプロジェクトフォルダを作成
      const projectFolder = await this.createFolder(projectName, parentFolderId);
      
      // 共通フォルダ構造を作成
      const subFolders = {};
      for (const folderInfo of PROJECT_FOLDER_STRUCTURE) {
        subFolders[folderInfo.name] = await this.createFolder(folderInfo.name, projectFolder.id);
      }

      return {
        projectId: projectFolder.id,
        projectName: projectName,
        folders: subFolders
      };
    } catch (error) {
      console.error('Project creation failed:', error);
      throw error;
    }
  }

  // フォルダを検索
  async findFolder(folderName, parentId = null) {
    await this.ensureValidToken();
    
    let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    try {
      const response = await window.gapi.client.drive.files.list({
        q: query,
        fields: 'files(id, name, webViewLink)'
      });

      return response.result.files?.[0] || null;
    } catch (error) {
      console.error('Folder search failed:', error);
      throw error;
    }
  }

  // フォルダを作成
  async createFolder(folderName, parentId = null) {
    await this.ensureValidToken();
    
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId && { parents: [parentId] })
    };

    try {
      const response = await window.gapi.client.drive.files.create({
        resource: folderMetadata,
        fields: 'id, name, webViewLink'
      });

      return response.result;
    } catch (error) {
      console.error('Folder creation failed:', error);
      throw error;
    }
  }

  // プロジェクト一覧を取得
  async getProjects(panelTitle = null) {
    try {
      await this.ensureValidToken();
      
      let query = "mimeType='application/vnd.google-apps.folder' and trashed=false";
      
      // パネルタイトルが指定されている場合、対応するフォルダ内のプロジェクトのみを取得
      if (panelTitle && PANEL_FOLDER_MAPPING.hasOwnProperty(panelTitle)) {
        const panelFolderName = PANEL_FOLDER_MAPPING[panelTitle];
        
        // Integrated-Managerフォルダを検索
        const integratedManagerFolder = await this.findFolder('Integrated-Manager');
        if (integratedManagerFolder) {
          if (panelFolderName === null) {
            // nullの場合はIntegrated-Manager直下のプロジェクトを取得
            query += ` and '${integratedManagerFolder.id}' in parents`;
            
            // プロジェクト固有のフォルダ構造を持つフォルダのみを除外するため、
            // 既知のサブフォルダ名と一致しないフォルダのみを取得
            const excludeNames = PROJECT_FOLDER_STRUCTURE.map(f => f.name);
            const excludeQuery = excludeNames.map(name => `name!='${name}'`).join(' and ');
            query += ` and ${excludeQuery}`;
          } else {
            // 従来通りパネルフォルダ内を検索
            const panelFolder = await this.findFolder(panelFolderName, integratedManagerFolder.id);
            if (panelFolder) {
              // パネルフォルダ内のプロジェクトのみを取得
              query += ` and '${panelFolder.id}' in parents`;
            } else {
              // パネルフォルダが存在しない場合は空の配列を返す
              return [];
            }
          }
        } else {
          // Integrated-Managerフォルダが存在しない場合は空の配列を返す
          return [];
        }
      }
      
      const response = await window.gapi.client.drive.files.list({
        q: query,
        fields: 'files(id, name, createdTime, webViewLink)',
        orderBy: 'createdTime desc'
      });

      return response.result.files || [];
    } catch (error) {
      console.error('Failed to get projects:', error);
      throw error;
    }
  }

  // プロジェクトの詳細情報を取得
  async getProjectDetails(projectId) {
    try {
      await this.ensureValidToken();
      
      const response = await window.gapi.client.drive.files.list({
        q: `'${projectId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, webViewLink)'
      });

      return response.result.files || [];
    } catch (error) {
      console.error('Failed to get project details:', error);
      throw error;
    }
  }

  // パネルフォルダのwebViewLinkを取得
  async getPanelFolderLink(panelTitle) {
    try {
      await this.ensureValidToken();
      
      if (!panelTitle || !PANEL_FOLDER_MAPPING[panelTitle]) {
        throw new Error('Invalid panel title');
      }

      const panelFolderName = PANEL_FOLDER_MAPPING[panelTitle];
      
      // Integrated-Managerフォルダを検索
      const integratedManagerFolder = await this.findFolder('Integrated-Manager');
      if (!integratedManagerFolder) {
        throw new Error('Integrated-Manager folder not found');
      }

      // パネルフォルダを検索
      const panelFolder = await this.findFolder(panelFolderName, integratedManagerFolder.id);
      if (!panelFolder) {
        throw new Error(`${panelFolderName} folder not found`);
      }

      return panelFolder.webViewLink;
    } catch (error) {
      console.error('Failed to get panel folder link:', error);
      throw error;
    }
  }

  // ファイルをアップロード
  async uploadFile(fileName, fileContent, mimeType, parentId) {
    try {
      await this.ensureValidToken();
      
      const fileMetadata = {
        name: fileName,
        parents: [parentId]
      };

      const media = {
        mimeType: mimeType,
        body: fileContent
      };

      const response = await window.gapi.client.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink'
      });

      return response.result;
    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  }
}

export default new GoogleDriveService();