import googleDriveService from './googleDrive.js';

/**
 * 差分検出システム
 * Google Drive上のプロジェクトフォルダの変更を効率的に検出
 */
class DiffDetectionService {
  constructor() {
    this.scanHistory = new Map(); // プロジェクトID -> 前回スキャン結果
  }

  /**
   * プロジェクトの全フォルダをスキャンして現在の状態を取得
   * @param {string} projectId - プロジェクトのフォルダID
   * @returns {Object} スキャン結果
   */
  async scanProject(projectId) {
    try {
      const scanResult = {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        folders: {}
      };

      // プロジェクト内の各フォルダをスキャン
      const projectDetails = await googleDriveService.getProjectDetails(projectId);
      
      for (const folder of projectDetails) {
        const folderFiles = await this.scanFolder(folder.id, folder.name);
        scanResult.folders[folder.name] = {
          folderId: folder.id,
          files: folderFiles,
          lastModified: this.getLatestModifiedTime(folderFiles)
        };
      }

      return scanResult;
    } catch (error) {
      console.error('Project scan failed:', error);
      throw error;
    }
  }

  /**
   * 単一フォルダ内のファイル一覧を取得
   * @param {string} folderId - フォルダID
   * @param {string} folderName - フォルダ名
   * @returns {Array} ファイル一覧
   */
  async scanFolder(folderId, folderName) {
    try {
      const response = await window.gapi.client.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink)',
        orderBy: 'modifiedTime desc'
      });

      return response.result.files || [];
    } catch (error) {
      console.error(`Folder scan failed for ${folderName}:`, error);
      return [];
    }
  }

  /**
   * ファイル一覧から最新の更新時刻を取得
   * @param {Array} files - ファイル一覧
   * @returns {string} 最新の更新時刻（ISO string）
   */
  getLatestModifiedTime(files) {
    if (!files || files.length === 0) return null;
    
    return files.reduce((latest, file) => {
      return !latest || file.modifiedTime > latest ? file.modifiedTime : latest;
    }, null);
  }

  /**
   * 差分を検出（設計書の擬似コードを実装）
   * @param {Object} currentScan - 現在のスキャン結果
   * @param {Object} lastScan - 前回のスキャン結果
   * @returns {Object} 変更されたファイルとフォルダの情報
   */
  detectChanges(currentScan, lastScan) {
    const changes = {
      changedFolders: [],
      changedFiles: [],
      newFiles: [],
      deletedFiles: [],
      summary: {
        totalChanges: 0,
        foldersAffected: 0
      }
    };

    if (!lastScan) {
      // 初回スキャンの場合、すべてを新規として扱う
      Object.keys(currentScan.folders).forEach(folderName => {
        const folder = currentScan.folders[folderName];
        changes.changedFolders.push(folderName);
        changes.newFiles.push(...folder.files.map(file => ({
          ...file,
          folderName,
          changeType: 'new'
        })));
      });
      changes.summary.foldersAffected = changes.changedFolders.length;
      changes.summary.totalChanges = changes.newFiles.length;
      return changes;
    }

    // フォルダごとに差分をチェック
    Object.keys(currentScan.folders).forEach(folderName => {
      const currentFolder = currentScan.folders[folderName];
      const lastFolder = lastScan.folders[folderName];

      if (!lastFolder) {
        // 新規フォルダ
        changes.changedFolders.push(folderName);
        changes.newFiles.push(...currentFolder.files.map(file => ({
          ...file,
          folderName,
          changeType: 'new'
        })));
        return;
      }

      // フォルダ内のファイル変更をチェック
      const folderChanges = this.detectFileChanges(
        currentFolder.files, 
        lastFolder.files, 
        folderName
      );

      if (folderChanges.hasChanges) {
        changes.changedFolders.push(folderName);
        changes.changedFiles.push(...folderChanges.changed);
        changes.newFiles.push(...folderChanges.new);
        changes.deletedFiles.push(...folderChanges.deleted);
      }
    });

    changes.summary.foldersAffected = changes.changedFolders.length;
    changes.summary.totalChanges = 
      changes.changedFiles.length + 
      changes.newFiles.length + 
      changes.deletedFiles.length;

    return changes;
  }

  /**
   * フォルダ内のファイル変更を検出
   * @param {Array} currentFiles - 現在のファイル一覧
   * @param {Array} lastFiles - 前回のファイル一覧
   * @param {string} folderName - フォルダ名
   * @returns {Object} ファイル変更情報
   */
  detectFileChanges(currentFiles, lastFiles, folderName) {
    const lastFileMap = new Map(lastFiles.map(f => [f.id, f]));
    const currentFileMap = new Map(currentFiles.map(f => [f.id, f]));
    
    const changes = {
      hasChanges: false,
      changed: [],
      new: [],
      deleted: []
    };

    // 変更・新規ファイルをチェック
    currentFiles.forEach(file => {
      const lastFile = lastFileMap.get(file.id);
      
      if (!lastFile) {
        // 新規ファイル
        changes.new.push({
          ...file,
          folderName,
          changeType: 'new'
        });
        changes.hasChanges = true;
      } else if (file.modifiedTime > lastFile.modifiedTime) {
        // 変更されたファイル
        changes.changed.push({
          ...file,
          folderName,
          changeType: 'modified',
          lastModified: lastFile.modifiedTime
        });
        changes.hasChanges = true;
      }
    });

    // 削除されたファイルをチェック
    lastFiles.forEach(file => {
      if (!currentFileMap.has(file.id)) {
        changes.deleted.push({
          ...file,
          folderName,
          changeType: 'deleted'
        });
        changes.hasChanges = true;
      }
    });

    return changes;
  }

  /**
   * スキャン結果を保存（次回の差分検出用）
   * @param {Object} scanResult - スキャン結果
   */
  saveScanResult(scanResult) {
    this.scanHistory.set(scanResult.projectId, scanResult);
    
    // ローカルストレージにも保存（ブラウザ再起動後も保持）
    try {
      const storageKey = `scan_history_${scanResult.projectId}`;
      localStorage.setItem(storageKey, JSON.stringify(scanResult));
    } catch (error) {
      console.warn('Failed to save scan result to localStorage:', error);
    }
  }

  /**
   * 前回のスキャン結果を取得
   * @param {string} projectId - プロジェクトID
   * @returns {Object|null} 前回のスキャン結果
   */
  getLastScanResult(projectId) {
    // メモリから取得を試行
    let lastScan = this.scanHistory.get(projectId);
    
    if (!lastScan) {
      // ローカルストレージから取得を試行
      try {
        const storageKey = `scan_history_${projectId}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          lastScan = JSON.parse(stored);
          this.scanHistory.set(projectId, lastScan); // メモリにも保存
        }
      } catch (error) {
        console.warn('Failed to load scan result from localStorage:', error);
      }
    }
    
    return lastScan || null;
  }

  /**
   * プロジェクトの更新が必要かチェック
   * @param {string} projectId - プロジェクトID
   * @returns {boolean} 更新が必要かどうか
   */
  async needsUpdate(projectId) {
    try {
      const lastScan = this.getLastScanResult(projectId);
      if (!lastScan) return true; // 初回は更新が必要
      
      // 簡易チェック: プロジェクトフォルダの最終更新時刻を確認
      const projectInfo = await window.gapi.client.drive.files.get({
        fileId: projectId,
        fields: 'modifiedTime'
      });
      
      return projectInfo.result.modifiedTime > lastScan.timestamp;
    } catch (error) {
      console.error('Update check failed:', error);
      return true; // エラーの場合は更新を推奨
    }
  }

  /**
   * 全スキャン履歴をクリア
   */
  clearScanHistory() {
    this.scanHistory.clear();
    
    // ローカルストレージからも削除
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('scan_history_')) {
        localStorage.removeItem(key);
      }
    });
  }
}

// シングルトンインスタンスをエクスポート
const diffDetectionService = new DiffDetectionService();
export default diffDetectionService;

