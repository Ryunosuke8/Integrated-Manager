import React, { useState, useEffect } from 'react';
import googleDriveService from '../services/googleDrive';
import diffDetectionService from '../services/diffDetection';
import aiProcessingService from '../services/aiProcessing';
import folderContentSummaryService from '../services/folderContentSummary';
import paperTopicSuggestionService from '../services/paperTopicSuggestion';
import slideGenerationService from '../services/slideGeneration';
import documentGenerationService from '../services/documentGeneration';
import referencePaperSearchService from '../services/referencePaperSearch';
import documentOrganizerService from '../services/documentOrganizer';
import materialCollectorService from '../services/materialCollector';
import requirementsCreatorService from '../services/requirementsCreator';
import paperGenerationService from '../services/paperGeneration';
import openaiService from '../services/openaiService';
import reachingService from '../services/reachingService';
import { PROJECT_FOLDER_STRUCTURE } from '../config/googleDriveConfig';
import ProcessingResultsModal from './ProcessingResultsModal';



const ProjectManager = ({ isOpen, onClose, panelTitle }) => {
  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  // AI処理とスキャン関連の状態
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanProgress, setScanProgress] = useState({ progress: 0, stage: '', currentFolder: '' });
  const [lastScanResult, setLastScanResult] = useState(null);
  const [changesDetected, setChangesDetected] = useState(null);
  
  // 処理結果表示関連の状態
  const [processingResults, setProcessingResults] = useState(null);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [lastProcessingTime, setLastProcessingTime] = useState(null);
  
  // フォルダ内容要約関連の状態
  const [folderSummaries, setFolderSummaries] = useState({});
  const [isLoadingSummaries, setIsLoadingSummaries] = useState(false);
  
  // 論文トピック提案関連の状態
  const [isGeneratingPaperTopic, setIsGeneratingPaperTopic] = useState(false);
  const [paperTopicProgress, setPaperTopicProgress] = useState({ progress: 0, stage: '', message: '' });
  const [lastPaperTopicResult, setLastPaperTopicResult] = useState(null);
  
  // スライド生成関連の状態
  const [isGeneratingSlides, setIsGeneratingSlides] = useState(false);
  const [slideProgress, setSlideProgress] = useState({ progress: 0, stage: '', message: '' });
  const [lastSlideResult, setLastSlideResult] = useState(null);
  
  // 参考論文検索関連の状態
  const [isSearchingReferences, setIsSearchingReferences] = useState(false);
  const [referenceProgress, setReferenceProgress] = useState({ progress: 0, stage: '', message: '' });
  const [lastReferenceResult, setLastReferenceResult] = useState(null);
  const [searchSource, setSearchSource] = useState('ieee'); // 'ieee' または 'semantic-scholar'
  const [showSearchSourceSelector, setShowSearchSourceSelector] = useState(false);
  
  // Document自動整理関連の状態
  const [isOrganizingDocuments, setIsOrganizingDocuments] = useState(false);
  const [organizationProgress, setOrganizationProgress] = useState({ progress: 0, stage: '', message: '' });
  const [lastOrganizationResult, setLastOrganizationResult] = useState(null);
  
  // カテゴリ選択の状態
  const [selectedCategories, setSelectedCategories] = useState({
    Main: true,
    Topic: true,
    ForTech: true,
    ForAca: true
  });
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  
  // 素材収集関連の状態
  const [isCollectingMaterials, setIsCollectingMaterials] = useState(false);
  const [materialProgress, setMaterialProgress] = useState({ progress: 0, stage: '', message: '' });
  const [lastMaterialResult, setLastMaterialResult] = useState(null);
  const [collectionTargets, setCollectionTargets] = useState({
    academia: true,
    presentation: true,
    images: true,
    charts: true,
    icons: true
  });
  const [showMaterialSelector, setShowMaterialSelector] = useState(false);

  // メニュー表示状態
  const [showPaperMenu, setShowPaperMenu] = useState(false);
  const [showDocumentMenu, setShowDocumentMenu] = useState(false);
  
  // 要件ファイル作成関連の状態
  const [isCreatingRequirements, setIsCreatingRequirements] = useState(false);
  const [requirementsProgress, setRequirementsProgress] = useState({ progress: 0, stage: '', message: '' });
  const [lastRequirementsResult, setLastRequirementsResult] = useState(null);
  const [requirementTargets, setRequirementTargets] = useState({
    academia: true,
    presentation: true
  });
  const [showRequirementsSelector, setShowRequirementsSelector] = useState(false);
  
  // 論文生成関連の状態
  const [isGeneratingPaper, setIsGeneratingPaper] = useState(false);
  const [paperProgress, setPaperProgress] = useState({ progress: 0, stage: '', message: '' });
  const [lastPaperResult, setLastPaperResult] = useState(null);
  
  // ドキュメント生成関連の状態
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);
  const [documentProgress, setDocumentProgress] = useState({ progress: 0, stage: '', message: '' });
  const [lastDocumentResult, setLastDocumentResult] = useState(null);

  // Reaching関連の状態
  const [isReachingSearching, setIsReachingSearching] = useState(false);
  const [reachingProgress, setReachingProgress] = useState({ progress: 0, stage: '', message: '' });
  const [lastReachingResult, setLastReachingResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      checkAuthStatus();
    }
  }, [isOpen]);

  // 外部クリックでドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCategorySelector && !event.target.closest('.category-selector-container')) {
        setShowCategorySelector(false);
      }
      if (showMaterialSelector && !event.target.closest('.material-selector-container')) {
        setShowMaterialSelector(false);
      }
      if (showRequirementsSelector && !event.target.closest('.requirements-selector-container')) {
        setShowRequirementsSelector(false);
      }
      if (showSearchSourceSelector && !event.target.closest('.search-source-selector-container')) {
        setShowSearchSourceSelector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCategorySelector, showMaterialSelector, showRequirementsSelector, showSearchSourceSelector]);

  const checkAuthStatus = async () => {
    setIsLoading(true);
    try {
      // 環境変数が設定されているかチェック
      const hasValidConfig = import.meta.env.VITE_GOOGLE_API_KEY && 
                           import.meta.env.VITE_GOOGLE_CLIENT_ID &&
                           import.meta.env.VITE_GOOGLE_API_KEY !== 'your_google_api_key_here' &&
                           import.meta.env.VITE_GOOGLE_CLIENT_ID !== 'your_google_client_id_here';

      if (!hasValidConfig) {
        setIsDemoMode(true);
        setIsLoading(false);
        return;
      }

      const signedIn = await googleDriveService.isSignedIn();
      setIsSignedIn(signedIn);
      if (signedIn) {
        await loadProjects();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsDemoMode(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await googleDriveService.signIn();
      setIsSignedIn(true);
      await loadProjects();
    } catch (error) {
      console.error('Sign in failed:', error);
      setIsDemoMode(true);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const projectList = await googleDriveService.getProjects(panelTitle);
      setProjects(projectList);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    if (isDemoMode) {
      // デモモードではローカルでプロジェクトを作成
      const newProject = {
        id: Date.now(),
        name: newProjectName,
        createdTime: new Date().toISOString(),
        webViewLink: '#'
      };
      setProjects(prev => [newProject, ...prev]);
      setNewProjectName('');
      return;
    }

    setIsCreating(true);
    try {
      const newProject = await googleDriveService.createProject(newProjectName, panelTitle);
      setProjects(prev => [newProject, ...prev]);
      setNewProjectName('');
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleProjectClick = async (project) => {
    // プロジェクト切り替え時に前のプロジェクトの状態をクリア
    setProcessingResults(null);
    setLastProcessingTime(null);
    setChangesDetected(null);
    setLastScanResult(null);
    setLastPaperTopicResult(null);
    setLastSlideResult(null);
    setLastReferenceResult(null);
    setLastOrganizationResult(null);
    setLastMaterialResult(null);
    setLastRequirementsResult(null);
    setIsResultsModalOpen(false);
    
    if (isDemoMode) {
      // デモモードではダミーの詳細を表示
      const demoDetails = PROJECT_FOLDER_STRUCTURE.map((folder, index) => ({
        id: index + 1,
        name: folder.name,
        webViewLink: '#',
        description: folder.description,
        icon: folder.icon,
        aiProcessing: folder.aiProcessing
      }));
      setSelectedProject({ ...project, details: demoDetails });
      
      // デモモード用のモック要約を生成
      await loadFolderSummaries(project.id, true);
      return;
    }

    try {
      const details = await googleDriveService.getProjectDetails(project.id);
      setSelectedProject({ ...project, details });
      
      // フォルダ要約を読み込み
      await loadFolderSummaries(project.id);
    } catch (error) {
      console.error('Failed to get project details:', error);
    }
  };

  const handleBackToList = () => {
    setSelectedProject(null);
    setFolderSummaries({});
    
    // 処理結果の状態をクリア
    setProcessingResults(null);
    setLastProcessingTime(null);
    setChangesDetected(null);
    setLastScanResult(null);
    
    // 各機能の結果状態をクリア
    setLastPaperTopicResult(null);
    setLastSlideResult(null);
    setLastReferenceResult(null);
    setLastOrganizationResult(null);
    setLastMaterialResult(null);
    setLastRequirementsResult(null);
    
    // 進捗状態をリセット
    setScanProgress({ progress: 0, stage: '', currentFolder: '' });
    setPaperTopicProgress({ progress: 0, stage: '', message: '' });
    setSlideProgress({ progress: 0, stage: '', message: '' });
    setReferenceProgress({ progress: 0, stage: '', message: '' });
    setOrganizationProgress({ progress: 0, stage: '', message: '' });
    setMaterialProgress({ progress: 0, stage: '', message: '' });
    setRequirementsProgress({ progress: 0, stage: '', message: '' });
    
    // 処理中フラグをリセット
    setIsScanning(false);
    setIsProcessing(false);
    setIsGeneratingPaperTopic(false);
    setIsGeneratingSlides(false);
    setIsSearchingReferences(false);
    setIsOrganizingDocuments(false);
    setIsCollectingMaterials(false);
    setIsCreatingRequirements(false);
    
    // 結果モーダルを閉じる
    setIsResultsModalOpen(false);
  };

  /**
   * フォルダ要約を読み込み
   */
  const loadFolderSummaries = async (projectId, isDemoMode = false) => {
    setIsLoadingSummaries(true);
    
    try {
      if (isDemoMode) {
        // デモモード用のモック要約
        const mockSummaries = {};
        PROJECT_FOLDER_STRUCTURE.forEach(folder => {
          mockSummaries[folder.name] = {
            folderName: folder.name,
            fileCount: Math.floor(Math.random() * 10) + 1,
            lastModified: new Date().toISOString(),
            contentPreview: generateMockContentPreview(folder.name),
            processingStatus: processingResults?.processedFolders?.includes(folder.name) ? 'completed' : 'pending',
            keyInsights: processingResults?.generatedContent?.[folder.name] ? 
              ['✨ AI処理完了', '📄 新しいコンテンツ生成'] : [],
            recentChanges: []
          };
        });
        setFolderSummaries(mockSummaries);
      } else {
        const summaries = await folderContentSummaryService.getProjectFolderSummaries(
          projectId, 
          processingResults
        );
        setFolderSummaries(summaries);
      }
    } catch (error) {
      console.error('Failed to load folder summaries:', error);
    } finally {
      setIsLoadingSummaries(false);
    }
  };

  /**
   * デモ用のモックコンテンツプレビューを生成
   */
  const generateMockContentPreview = (folderName) => {
    const mockPreviews = {
      'Document': '📝 プロジェクト概要 • 📋 要件定義書 • 📄 議事録3件',
      'Implementation': '💻 React コード12件 • 📋 API仕様書 • 🖼️ 設計図2件',
      'Presentation': '📊 スライド資料 • 🖼️ 図表5件 • 📄 発表原稿',
      'Academia': '📚 関連論文8件 • 📄 文献レビュー • 📈 データ分析',
      'Paper': '✏️ 論文草案2件 • 📝 LaTeX テンプレート • 📊 実験結果',
      'Business': '📊 市場分析 • 💼 ビジネスモデル • 📋 収益計画',
      'Reaching': '📅 学会情報5件 • 📝 応募書類 • 🎯 発表計画',
      'Material': '🖼️ 画像素材15件 • 📊 チャート3件 • 🎨 アイコン集'
    };
    return mockPreviews[folderName] || `📁 ${Math.floor(Math.random() * 8) + 1}個のファイル`;
  };

  const openInGoogleDrive = async (webViewLink, folderName = null) => {
    if (isDemoMode) {
      alert('デモモードです。実際のGoogle Drive連携には設定が必要です。');
      return;
    }

    try {
      let linkToOpen = webViewLink;
      
      // フォルダ名が指定されている場合（プロジェクト詳細画面から）、パネルフォルダを開く
      if (folderName) {
        const panelFolderLink = await googleDriveService.getPanelFolderLink(panelTitle);
        linkToOpen = panelFolderLink;
      }
      
      window.open(linkToOpen, '_blank');
    } catch (error) {
      console.error('Failed to open Google Drive folder:', error);
      alert('フォルダを開けませんでした。');
    }
  };

  /**
   * プロジェクトをスキャンして変更を検出
   */
  const handleScanProject = async (project) => {
    if (isDemoMode) {
      // デモモード用のモックスキャン
      setIsScanning(true);
      setScanProgress({ progress: 50, stage: 'scanning', currentFolder: 'Document' });
      
      setTimeout(() => {
        const mockChanges = {
          changedFolders: ['Document', 'Implementation'],
          summary: { totalChanges: 3, foldersAffected: 2 }
        };
        setChangesDetected(mockChanges);
        setScanProgress({ progress: 100, stage: 'completed' });
        setIsScanning(false);
      }, 2000);
      return;
    }

    setIsScanning(true);
    setScanProgress({ progress: 0, stage: 'initializing' });

    try {
      // 現在の状態をスキャン
      setScanProgress({ progress: 20, stage: 'scanning' });
      const currentScan = await diffDetectionService.scanProject(project.id);
      
      // 前回のスキャン結果と比較
      setScanProgress({ progress: 60, stage: 'analyzing' });
      const lastScan = diffDetectionService.getLastScanResult(project.id);
      const changes = diffDetectionService.detectChanges(currentScan, lastScan);
      
      // 結果を保存
      diffDetectionService.saveScanResult(currentScan);
      setLastScanResult(currentScan);
      setChangesDetected(changes);
      
      setScanProgress({ progress: 100, stage: 'completed' });
      
    } catch (error) {
      console.error('Scan failed:', error);
      setScanProgress({ progress: 0, stage: 'error' });
      alert('スキャンに失敗しました: ' + error.message);
    } finally {
      setIsScanning(false);
    }
  };

  /**
   * 論文トピック提案を生成
   */
  const handlePaperTopicSuggestion = async (project) => {
    // OpenAI API設定のチェック
    if (!openaiService.isConfigured()) {
      alert('❌ OpenAI API設定が完了していません。\n\n右下の設定アイコン（⚙️）をクリックして、OpenAI APIキーを設定してください。\n\n設定後、再度実行してください。');
      return;
    }

    if (isDemoMode) {
      // デモモード用のモック処理
      setIsGeneratingPaperTopic(true);
      setPaperTopicProgress({ progress: 30, stage: 'reading', message: 'Mainドキュメントを検索中...' });
      
      setTimeout(() => {
        setPaperTopicProgress({ progress: 60, stage: 'generating', message: '論文トピック提案を生成中...' });
        
        setTimeout(() => {
          setPaperTopicProgress({ progress: 100, stage: 'completed', message: '論文トピック提案が完了しました！' });
          
          const mockResult = {
            success: true,
            mainDocument: {
              fileName: 'Main_Project_Overview.md',
              content: 'プロジェクトの概要とシステム設計について...'
            },
            suggestionFile: {
              id: 'mock-suggestion-id',
              name: 'Suggestion.md',
              webViewLink: '#'
            }
          };
          
          setLastPaperTopicResult(mockResult);
          setIsGeneratingPaperTopic(false);
          
          alert('📝 論文トピック提案を生成しました！\n\nAcademia > Paper Topic Suggestion フォルダに「Suggestion.md」が作成されました。');
        }, 2000);
      }, 2000);
      return;
    }

    if (paperTopicSuggestionService.isCurrentlyProcessing()) {
      alert('既に論文トピック提案を生成中です');
      return;
    }

    setIsGeneratingPaperTopic(true);
    setPaperTopicProgress({ progress: 0, stage: 'initializing', message: '初期化中...' });

    try {
      const result = await paperTopicSuggestionService.generatePaperTopicSuggestion(
        project.id,
        (progress) => setPaperTopicProgress(progress)
      );

      setLastPaperTopicResult(result);

      if (result.success) {
        alert(`✅ 論文トピック提案を生成しました！\n\n📄 ベースドキュメント: ${result.mainDocument.fileName}\n📁 生成ファイル: ${result.suggestionFile.name}\n\nAcademia > Paper Topic Suggestion フォルダをご確認ください。`);
      } else {
        // より詳細なエラーダイアログを表示
        const errorMessage = result.error || '不明なエラーが発生しました';
        showDetailedErrorDialog(errorMessage);
      }
    } catch (error) {
      console.error('Paper topic suggestion failed:', error);
      showDetailedErrorDialog(error.message);
      setPaperTopicProgress({ progress: 0, stage: 'error', message: `エラー: ${error.message}` });
    } finally {
      setIsGeneratingPaperTopic(false);
    }
  };

  /**
   * 詳細なエラーダイアログを表示
   */
  const showDetailedErrorDialog = (errorMessage) => {
    // より読みやすい形式でエラーメッセージを表示
    const formattedMessage = `❌ 論文トピック提案の生成に失敗しました\n\n${errorMessage}`;
    
    // コンソールにも詳細を出力
    console.error('Detailed error message:', errorMessage);
    
    alert(formattedMessage);
  };

  /**
   * スライド生成を実行
   */
  const handleSlideGeneration = async (project) => {
    if (isDemoMode) {
      // デモモード用のモック処理
      setIsGeneratingSlides(true);
      setSlideProgress({ progress: 30, stage: 'reading', message: 'Documentフォルダを読み込み中...' });
      
      setTimeout(() => {
        setSlideProgress({ progress: 70, stage: 'generating', message: 'スライド内容を生成中...' });
        
        setTimeout(() => {
          setSlideProgress({ progress: 100, stage: 'completed', message: 'スライド生成が完了しました！' });
          
          const mockResult = {
            success: true,
            sourceDocuments: [
              { fileName: 'Main_Project_Overview.md', isMain: true }
            ],
            slideFile: {
              id: 'mock-slide-id',
              name: 'Presentation_2024-01-15.pptx',
              webViewLink: '#'
            }
          };
          
          setLastSlideResult(mockResult);
          setIsGeneratingSlides(false);
          
          alert('📊 スライドを生成しました！\n\nPresentationフォルダに「Presentation_2024-01-15.pptx」が作成されました。');
        }, 2000);
      }, 2000);
      return;
    }

    if (slideGenerationService.isCurrentlyProcessing()) {
      alert('既にスライド生成を実行中です');
      return;
    }

    setIsGeneratingSlides(true);
    setSlideProgress({ progress: 0, stage: 'initializing', message: '初期化中...' });

    try {
      const result = await slideGenerationService.generateSlidePresentation(
        project.id,
        (progress) => setSlideProgress(progress)
      );

      setLastSlideResult(result);

      if (result.success) {
        alert(`✅ スライド生成が完了しました！\n\n📄 読み込みドキュメント: ${result.sourceDocuments.length}件\n📊 生成ファイル: ${result.slideFile.name}\n\nPresentationフォルダをご確認ください。`);
      } else {
        showSlideErrorDialog(result.error);
      }
    } catch (error) {
      console.error('Slide generation failed:', error);
      showSlideErrorDialog(error.message);
      setSlideProgress({ progress: 0, stage: 'error', message: `エラー: ${error.message}` });
    } finally {
      setIsGeneratingSlides(false);
    }
  };

  /**
   * スライド生成エラーダイアログを表示
   */
  const showSlideErrorDialog = (errorMessage) => {
    const formattedMessage = `❌ スライド生成に失敗しました\n\n${errorMessage}`;
    console.error('Slide generation error:', errorMessage);
    alert(formattedMessage);
  };

  /**
   * ドキュメント生成を実行
   */
  const handleDocumentGeneration = async (project) => {
    if (isDemoMode) {
      // デモモード用のモック処理
      setIsGeneratingDocument(true);
      setDocumentProgress({ progress: 30, stage: 'reading', message: 'Presentationフォルダを読み込み中...' });
      
      setTimeout(() => {
        setDocumentProgress({ progress: 70, stage: 'generating', message: 'Mainドキュメントを生成中...' });
        
        setTimeout(() => {
          setDocumentProgress({ progress: 100, stage: 'completed', message: 'ドキュメント生成が完了しました！' });
          
          const mockResult = {
            success: true,
            sourceFiles: [
              { name: 'Presentation_2024-01-15.pptx' }
            ],
            generatedDocument: {
              id: 'mock-document-id',
              name: 'Main_2024-01-15.md',
              webViewLink: '#'
            }
          };
          
          setLastDocumentResult(mockResult);
          setIsGeneratingDocument(false);
          
          alert('📄 Mainドキュメントを生成しました！\n\nDocumentフォルダに「Main_2024-01-15.md」が作成されました。');
        }, 2000);
      }, 2000);
      return;
    }

    if (documentGenerationService.isCurrentlyProcessing()) {
      alert('既にドキュメント生成を実行中です');
      return;
    }

    setIsGeneratingDocument(true);
    setDocumentProgress({ progress: 0, stage: 'initializing', message: '初期化中...' });

    try {
      const result = await documentGenerationService.generateDocument(
        project.id,
        (progress) => setDocumentProgress(progress)
      );

      setLastDocumentResult(result);

      if (result.success) {
        alert(`✅ ドキュメント生成が完了しました！\n\n📄 読み込みファイル: ${result.sourceFiles.length}件\n📝 生成ファイル: ${result.generatedDocument.name}\n\nDocumentフォルダをご確認ください。`);
      } else {
        showDocumentErrorDialog(result.error);
      }
    } catch (error) {
      console.error('Document generation failed:', error);
      showDocumentErrorDialog(error.message);
      setDocumentProgress({ progress: 0, stage: 'error', message: `エラー: ${error.message}` });
    } finally {
      setIsGeneratingDocument(false);
    }
  };

  /**
   * ドキュメント生成エラーダイアログを表示
   */
  const showDocumentErrorDialog = (errorMessage) => {
    const formattedMessage = `❌ ドキュメント生成に失敗しました\n\n${errorMessage}`;
    console.error('Document generation error:', errorMessage);
    alert(formattedMessage);
  };

  /**
   * 参考論文検索を実行
   */
  const handleReferenceSearch = async (project) => {
    if (isDemoMode) {
      // デモモード用のモック処理
      setIsSearchingReferences(true);
      setReferenceProgress({ progress: 25, stage: 'reading', message: '分析対象ドキュメントを読み込み中...' });
      
      setTimeout(() => {
        setReferenceProgress({ progress: 55, stage: 'analyzing', message: 'ドキュメント内容を分析中...' });
        
        setTimeout(() => {
          setReferenceProgress({ progress: 85, stage: 'searching', message: '関連論文を検索中...' });
          
          setTimeout(() => {
            setReferenceProgress({ progress: 100, stage: 'completed', message: '参考論文検索が完了しました！' });
            
            const mockResult = {
              success: true,
              sourceDocuments: [
                { type: 'main', fileName: 'Main_Project_Overview.md', source: 'Document/Main' },
                { type: 'suggestion', fileName: 'Suggestion', source: 'Academia/Paper Topic Suggestion/Suggestion' }
              ],
              searchResults: [
                { title: 'Deep Learning Approaches for Intelligent System Design', authors: 'Smith, J., Johnson, A.', year: 2023 },
                { title: 'User Interface Optimization Using Machine Learning Techniques', authors: 'Brown, C., Davis, M.', year: 2023 }
              ],
              excelFile: {
                id: 'mock-excel-id',
                name: 'Reference_Papers_2024-01-15.xlsx',
                webViewLink: '#'
              }
            };
            
            setLastReferenceResult(mockResult);
            setIsSearchingReferences(false);
            
            const searchSourceName = searchSource === 'ieee' ? 'IEEE Xplore' : 'Semantic Scholar';
            alert(`📚 参考論文検索が完了しました！\n\n🔍 選択した検索元: ${searchSourceName}\n🔍 実際の検索元: モックデータ（API接続不可）\n📄 分析ドキュメント: ${mockResult.sourceDocuments.length}件\n📊 検索結果: ${mockResult.searchResults.length}件の関連論文\n📋 生成ファイル: ${mockResult.excelFile.name}\n\nAcademia > Reference Paper フォルダをご確認ください。`);
          }, 2000);
        }, 2000);
      }, 2000);
      return;
    }

    if (referencePaperSearchService.isCurrentlyProcessing()) {
      alert('既に参考論文検索を実行中です');
      return;
    }

    setIsSearchingReferences(true);
    setReferenceProgress({ progress: 0, stage: 'initializing', message: '初期化中...' });

    try {
      const result = await referencePaperSearchService.searchReferencePapers(
        project.id,
        (progress) => setReferenceProgress(progress),
        searchSource
      );

      setLastReferenceResult(result);

      if (result.success) {
        const searchSourceName = searchSource === 'ieee' ? 'IEEE Xplore' : 'Semantic Scholar';
        const actualSource = result.searchResults.length > 0 && result.searchResults[0].publisher ? 
          (result.searchResults[0].publisher === 'Semantic Scholar' ? 'Semantic Scholar' : 'IEEE Xplore') : searchSourceName;
        
        alert(`✅ 参考論文検索が完了しました！\n\n🔍 選択した検索元: ${searchSourceName}\n🔍 実際の検索元: ${actualSource}\n📄 分析ドキュメント: ${result.sourceDocuments.length}件\n📊 検索結果: ${result.searchResults.length}件の関連論文\n📋 生成ファイル: ${result.excelFile.name}\n\nAcademia > Reference Paper フォルダをご確認ください。`);
      } else {
        showReferenceErrorDialog(result.error);
      }
    } catch (error) {
      console.error('Reference paper search failed:', error);
      showReferenceErrorDialog(error.message);
      setReferenceProgress({ progress: 0, stage: 'error', message: `エラー: ${error.message}` });
    } finally {
      setIsSearchingReferences(false);
    }
  };

  /**
   * 参考論文検索エラーダイアログを表示
   */
  const showReferenceErrorDialog = (errorMessage) => {
    const formattedMessage = `❌ 参考論文検索に失敗しました\n\n${errorMessage}`;
    console.error('Reference paper search error:', errorMessage);
    alert(formattedMessage);
  };

  /**
   * 論文生成を実行
   */
  const handlePaperGeneration = async (project) => {
    if (isDemoMode) {
      // デモモード用のモック処理
      setIsGeneratingPaper(true);
      setPaperProgress({ progress: 10, stage: 'analyzing', message: 'ソースドキュメントを分析中...' });
      
      setTimeout(() => {
        setPaperProgress({ progress: 30, stage: 'processing', message: 'ドキュメント内容を処理中...' });
        
        setTimeout(() => {
          setPaperProgress({ progress: 50, stage: 'generating', message: '論文構造を生成中...' });
          
          setTimeout(() => {
            setPaperProgress({ progress: 70, stage: 'creating', message: 'LaTeXファイルを作成中...' });
            
            setTimeout(() => {
              setPaperProgress({ progress: 90, stage: 'converting', message: 'PDFに変換中...' });
              
              setTimeout(() => {
                setPaperProgress({ progress: 100, stage: 'completed', message: '論文生成が完了しました！' });
                
                const mockResult = {
                  success: true,
                  sourceDocuments: [
                    { fileName: 'ForAca_Research_Overview.md', source: 'Document/ForAca' },
                    { fileName: 'Academic_Background.md', source: 'Academia' }
                  ],
                  generatedFiles: [
                    { name: 'Generated_Paper_2024-01-15.tex', type: 'latex' },
                    { name: 'Generated_Paper_2024-01-15.pdf', type: 'pdf' }
                  ],
                  summary: {
                    sourceDocuments: 2,
                    generatedFiles: 2,
                    timestamp: new Date().toISOString()
                  }
                };
                
                setLastPaperResult(mockResult);
                setIsGeneratingPaper(false);
                
                alert(`📄 論文生成が完了しました！\n\n📚 ソースドキュメント: ${mockResult.sourceDocuments.length}件\n📝 生成ファイル: ${mockResult.generatedFiles.length}件\n\nPaperフォルダにLaTeXファイルとPDFが保存されました。`);
              }, 2000);
            }, 2000);
          }, 2000);
        }, 2000);
      }, 2000);
      return;
    }

    // スキャン結果がない場合は、まずスキャンを実行
    if (!lastScanResult) {
      alert('論文生成の前に、まず「変更をスキャン」を実行してください。');
      return;
    }

    if (paperGenerationService.isCurrentlyGenerating()) {
      alert('既に論文生成を実行中です');
      return;
    }

    setIsGeneratingPaper(true);
    setPaperProgress({ progress: 0, stage: 'initializing', message: '初期化中...' });

    try {
      const result = await paperGenerationService.generatePaper(
        project.id,
        lastScanResult,
        (progress) => setPaperProgress(progress)
      );

      setLastPaperResult(result);

      if (result) {
        alert(`✅ 論文生成が完了しました！\n\n📚 ソースドキュメント: ${result.sourceDocuments.length}件\n📝 生成ファイル: ${result.generatedFiles.length}件\n\nPaperフォルダにLaTeXファイルとPDFが保存されました。`);
      } else {
        showPaperErrorDialog('論文生成に失敗しました');
      }
    } catch (error) {
      console.error('Paper generation failed:', error);
      showPaperErrorDialog(error.message);
      setPaperProgress({ progress: 0, stage: 'error', message: `エラー: ${error.message}` });
    } finally {
      setIsGeneratingPaper(false);
    }
  };

  /**
   * 論文生成エラーダイアログを表示
   */
  const showPaperErrorDialog = (errorMessage) => {
    let formattedMessage = `❌ 論文生成に失敗しました\n\n${errorMessage}`;
    
    // 権限エラーの場合は追加のヘルプを表示
    if (errorMessage.includes('アクセス権限') || errorMessage.includes('書き込み権限')) {
      formattedMessage += '\n\n💡 解決方法:\n1. Google Driveでファイル/フォルダの共有設定を確認\n2. アプリケーションに適切な権限を付与\n3. 必要に応じてファイルを「リンクを知っている全員」に共有';
    }
    
    console.error('Paper generation error:', errorMessage);
    alert(formattedMessage);
  };

  /**
   * Reaching検索を実行
   */
  const handleReachingSearch = async (project) => {
    if (isDemoMode) {
      // デモモード用のモック処理
      setIsReachingSearching(true);
      setReachingProgress({ progress: 25, stage: 'reading', message: 'Mainドキュメントを読み込み中...' });
      
      setTimeout(() => {
        setReachingProgress({ progress: 55, stage: 'analyzing', message: 'プロジェクト内容を分析中...' });
        
        setTimeout(() => {
          setReachingProgress({ progress: 85, stage: 'searching', message: '関連する学会・展示会・機関を検索中...' });
          
          setTimeout(() => {
            setReachingProgress({ progress: 100, stage: 'completed', message: 'Reaching検索が完了しました！' });
            
            const mockResult = {
              success: true,
              sourceDocuments: [
                { fileName: 'Main_Project_Overview.md', source: 'Document/Main' }
              ],
              searchResults: [
                { name: 'IEEE International Conference on Computer Vision (ICCV)', type: 'conference', relevance: 'high' },
                { name: 'Consumer Electronics Show (CES)', type: 'exhibition', relevance: 'medium' },
                { name: 'Google Research', type: 'research', relevance: 'high' }
              ],
              excelFile: {
                id: 'mock-excel-id',
                name: 'Reaching_Results_2024-01-15.xlsx',
                webViewLink: '#'
              }
            };
            
            setLastReachingResult(mockResult);
            setIsReachingSearching(false);
            
            alert(`🌐 Reaching検索が完了しました！\n\n📄 分析ドキュメント: ${mockResult.sourceDocuments.length}件\n🔍 検索結果: ${mockResult.searchResults.length}件の関連情報\n📊 生成ファイル: ${mockResult.excelFile.name}\n\nReachingフォルダにExcelファイルが保存されました。`);
          }, 2000);
        }, 2000);
      }, 2000);
      return;
    }

    setIsReachingSearching(true);
    setReachingProgress({ progress: 0, stage: 'initializing', message: '初期化中...' });

    try {
      // Mainドキュメントを読み込んで分析
      setReachingProgress({ progress: 25, stage: 'reading', message: 'Mainドキュメントを読み込み中...' });
      
      // プロジェクト構造を取得
      const projectStructure = await reachingService.getProjectStructure(project.id);
      
      if (!projectStructure.documentFolder) {
        throw new Error('Documentフォルダが見つかりません。プロジェクトにDocumentフォルダを配置してください。');
      }
      
      const mainDocument = await reachingService.readMainDocument(projectStructure.documentFolder.id);
      
      if (!mainDocument) {
        throw new Error('Mainドキュメントが見つかりません。DocumentフォルダにMainドキュメントを配置してください。');
      }

      setReachingProgress({ progress: 55, stage: 'analyzing', message: 'プロジェクト内容を分析中...' });
      
      // プロジェクト内容を分析してキーワード抽出
      const keywords = await reachingService.analyzeProjectContent(mainDocument.content);
      
      setReachingProgress({ progress: 85, stage: 'searching', message: '関連する学会・展示会・機関を検索中...' });
      
      // 総合Web検索を実行
      const allResults = await reachingService.searchWeb({ 
        keywords,
        searchType: 'all',
        maxResults: 30
      });
      
      setReachingProgress({ progress: 95, stage: 'saving', message: 'Excelファイルを作成中...' });
      
      // Reachingフォルダを作成または取得
      const reachingFolderId = await reachingService.createOrGetReachingFolder(project.id);
      
      // Excelファイルを作成して保存
      const excelFile = await reachingService.createAndSaveExcelFile(
        reachingFolderId,
        allResults
      );

      const result = {
        success: true,
        sourceDocuments: [mainDocument],
        searchResults: allResults,
        excelFile: excelFile
      };

      setLastReachingResult(result);
      setReachingProgress({ progress: 100, stage: 'completed', message: 'Reaching検索が完了しました！' });

      alert(`✅ Reaching検索が完了しました！\n\n📄 分析ドキュメント: ${result.sourceDocuments.length}件\n🔍 検索結果: ${result.searchResults.length}件の関連情報\n📊 生成ファイル: ${result.excelFile.name}\n\nReachingフォルダにGoogle Spreadsheetが保存されました。`);

    } catch (error) {
      console.error('Reaching search failed:', error);
      showReachingErrorDialog(error.message);
      setReachingProgress({ progress: 0, stage: 'error', message: `エラー: ${error.message}` });
    } finally {
      setIsReachingSearching(false);
    }
  };

  /**
   * Reaching検索エラーダイアログを表示
   */
  const showReachingErrorDialog = (errorMessage) => {
    const formattedMessage = `❌ Reaching検索に失敗しました\n\n${errorMessage}`;
    console.error('Reaching search error:', errorMessage);
    alert(formattedMessage);
  };

  /**
   * Document自動整理を実行
   */
  const handleDocumentOrganization = async (project) => {
    if (isDemoMode) {
      // デモモード用のモック処理
      setIsOrganizingDocuments(true);
      setOrganizationProgress({ progress: 25, stage: 'reading', message: 'Documentフォルダを読み込み中...' });
      
      setTimeout(() => {
        setOrganizationProgress({ progress: 45, stage: 'analyzing', message: 'ドキュメント内容を分析中...' });
        
        setTimeout(() => {
          setOrganizationProgress({ progress: 65, stage: 'creating', message: '整理されたドキュメントを作成中...' });
          
          setTimeout(() => {
            setOrganizationProgress({ progress: 95, stage: 'reporting', message: '整理結果レポートを作成中...' });
            
            setTimeout(() => {
              setOrganizationProgress({ progress: 100, stage: 'completed', message: 'Document自動整理が完了しました！' });
              
              const mockResult = {
                success: true,
                sourceDocuments: [
                  { fileName: 'Project_Overview.md', size: 2048 },
                  { fileName: 'Technical_Requirements.md', size: 1536 },
                  { fileName: 'Research_Notes.md', size: 3072 }
                ],
                classificationResults: {
                  Main: [{ confidence: 0.85 }],
                  Topic: [{ confidence: 0.72 }],
                  ForTech: [{ confidence: 0.91 }],
                  ForAca: [{ confidence: 0.68 }]
                },
                organizedDocuments: {
                  Main: { fileName: 'Main_2024-01-15.md', itemCount: 1 },
                  Topic: { fileName: 'Topic_2024-01-15.md', itemCount: 1 },
                  ForTech: { fileName: 'ForTech_2024-01-15.md', itemCount: 1 },
                  ForAca: { fileName: 'ForAca_2024-01-15.md', itemCount: 1 }
                },
                reportFile: {
                  id: 'mock-report-id',
                  name: 'Organization_Report_2024-01-15.md',
                  webViewLink: '#'
                }
              };
              
              setLastOrganizationResult(mockResult);
              setIsOrganizingDocuments(false);
              
              alert(`📁 Document自動整理が完了しました！\n\n📄 分析ドキュメント: ${mockResult.sourceDocuments.length}件\n📂 生成カテゴリ: ${Object.keys(mockResult.organizedDocuments).length}件\n📋 整理レポート: ${mockResult.reportFile.name}\n\nDocumentフォルダをご確認ください。`);
            }, 1000);
          }, 2000);
        }, 2000);
      }, 2000);
      return;
    }

    if (documentOrganizerService.isCurrentlyProcessing()) {
      alert('既にDocument自動整理を実行中です');
      return;
    }

    setIsOrganizingDocuments(true);
    setOrganizationProgress({ progress: 0, stage: 'initializing', message: '初期化中...' });

    try {
      const result = await documentOrganizerService.organizeDocuments(
        project.id,
        (progress) => setOrganizationProgress(progress),
        selectedCategories
      );

      setLastOrganizationResult(result);

      if (result.success) {
        alert(`✅ Document自動整理が完了しました！\n\n📄 分析ドキュメント: ${result.sourceDocuments.length}件\n📂 生成カテゴリ: ${Object.keys(result.organizedDocuments).length}件\n📋 整理レポート: ${result.reportFile.name}\n\nDocumentフォルダをご確認ください。`);
      } else {
        showOrganizationErrorDialog(result.error);
      }
    } catch (error) {
      console.error('Document organization failed:', error);
      showOrganizationErrorDialog(error.message);
      setOrganizationProgress({ progress: 0, stage: 'error', message: `エラー: ${error.message}` });
    } finally {
      setIsOrganizingDocuments(false);
    }
  };

  /**
   * Document自動整理エラーダイアログを表示
   */
  const showOrganizationErrorDialog = (errorMessage) => {
    const formattedMessage = `❌ Document自動整理に失敗しました\n\n${errorMessage}`;
    console.error('Document organization error:', errorMessage);
    alert(formattedMessage);
  };

  /**
   * カテゴリ選択の切り替え
   */
  const toggleCategory = (category) => {
    setSelectedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  /**
   * 全カテゴリの選択/解除
   */
  const toggleAllCategories = (selectAll) => {
    setSelectedCategories({
      Main: selectAll,
      Topic: selectAll,
      ForTech: selectAll,
      ForAca: selectAll
    });
  };

  /**
   * 素材収集対象の切り替え
   */
  const toggleCollectionTarget = (target) => {
    setCollectionTargets(prev => ({
      ...prev,
      [target]: !prev[target]
    }));
  };

  /**
   * 全素材収集対象の選択/解除
   */
  const toggleAllCollectionTargets = (selectAll) => {
    setCollectionTargets({
      academia: selectAll,
      presentation: selectAll,
      images: selectAll,
      charts: selectAll,
      icons: selectAll
    });
  };

  /**
   * 素材収集を実行
   */
  const handleMaterialCollection = async (project) => {
    console.log('🎯 Starting material collection for project:', project.name);
    console.log('🎭 Demo mode:', isDemoMode);
    console.log('🎯 Collection targets:', collectionTargets);
    
    if (isDemoMode) {
      // デモモード用のモック処理
      setIsCollectingMaterials(true);
      setMaterialProgress({ progress: 10, stage: 'scanning', message: 'プロジェクト構造を確認中...' });
      
      setTimeout(() => {
        setMaterialProgress({ progress: 25, stage: 'requirements', message: '素材要件を読み込み中...' });
        
        setTimeout(() => {
          setMaterialProgress({ progress: 40, stage: 'analyzing', message: '未収集素材を分析中...' });
          
          setTimeout(() => {
            setMaterialProgress({ progress: 60, stage: 'collecting', message: '素材を収集中...' });
            
            setTimeout(() => {
              setMaterialProgress({ progress: 80, stage: 'saving', message: 'Materialフォルダに保存中...' });
              
              setTimeout(() => {
                setMaterialProgress({ progress: 100, stage: 'completed', message: '素材収集が完了しました！' });
                
                const mockResult = {
                  success: true,
                  requirementFiles: [
                    { name: 'Academia/Material_Requirements.xlsx' },
                    { name: 'Presentation/Material_Requirements.xlsx' }
                  ],
                  collectedMaterials: {
                    images: [
                      { filename: 'research_methodology_1.jpg', keywords: 'research methodology' },
                      { filename: 'teamwork_collaboration_1.jpg', keywords: 'teamwork collaboration' }
                    ],
                    charts: [
                      { filename: 'data_analysis_bar_chart.json', keywords: 'data analysis' },
                      { filename: 'growth_chart_progress.json', keywords: 'growth chart' }
                    ],
                    icons: [
                      { filename: 'academic_cap_experiment.svg', keywords: 'experiment' },
                      { filename: 'chart_bar_innovation.svg', keywords: 'innovation' }
                    ]
                  },
                  savedFiles: Array(6).fill().map((_, i) => ({ name: `material_${i + 1}`, id: `mock_${i}` }))
                };
                
                setLastMaterialResult(mockResult);
                setIsCollectingMaterials(false);
                
                const totalMaterials = mockResult.collectedMaterials.images.length + 
                                     mockResult.collectedMaterials.charts.length + 
                                     mockResult.collectedMaterials.icons.length;
                
                alert(`📊 素材収集が完了しました！\n\n📄 要件ファイル: ${mockResult.requirementFiles.length}件\n🎨 収集素材: ${totalMaterials}件\n💾 保存ファイル: ${mockResult.savedFiles.length}件\n\nMaterialフォルダをご確認ください。`);
              }, 1000);
            }, 1500);
          }, 1500);
        }, 1500);
      }, 1500);
      return;
    }

    if (materialCollectorService.isCurrentlyProcessing()) {
      alert('既に素材収集を実行中です');
      return;
    }

    setIsCollectingMaterials(true);
    setMaterialProgress({ progress: 0, stage: 'initializing', message: '初期化中...' });

    try {
      const result = await materialCollectorService.collectMaterials(
        project.id,
        (progress) => setMaterialProgress(progress),
        collectionTargets
      );

      setLastMaterialResult(result);

      if (result.success) {
        const totalMaterials = (result.collectedMaterials.images?.length || 0) + 
                             (result.collectedMaterials.charts?.length || 0) + 
                             (result.collectedMaterials.icons?.length || 0);
        
        alert(`✅ 素材収集が完了しました！\n\n📄 要件ファイル: ${result.requirementFiles?.length || 0}件\n🎨 収集素材: ${totalMaterials}件\n💾 保存ファイル: ${result.savedFiles?.length || 0}件\n\nMaterialフォルダをご確認ください。`);
      } else {
        showMaterialErrorDialog(result.error);
      }
    } catch (error) {
      console.error('Material collection failed:', error);
      showMaterialErrorDialog(error.message);
      setMaterialProgress({ progress: 0, stage: 'error', message: `エラー: ${error.message}` });
    } finally {
      setIsCollectingMaterials(false);
    }
  };

  /**
   * 素材収集エラーダイアログを表示
   */
  const showMaterialErrorDialog = (errorMessage) => {
    const formattedMessage = `❌ 素材収集に失敗しました\n\n${errorMessage}`;
    console.error('Material collection error:', errorMessage);
    alert(formattedMessage);
  };

  /**
   * 要件対象の切り替え
   */
  const toggleRequirementTarget = (target) => {
    setRequirementTargets(prev => ({
      ...prev,
      [target]: !prev[target]
    }));
  };

  /**
   * 全要件対象の選択/解除
   */
  const toggleAllRequirementTargets = (selectAll) => {
    setRequirementTargets({
      academia: selectAll,
      presentation: selectAll
    });
  };

  /**
   * 要件ファイル作成を実行
   */
  const handleRequirementsCreation = async (project) => {
    console.log('📋 Starting requirements creation for project:', project.name);
    console.log('🎭 Demo mode:', isDemoMode);
    console.log('🎯 Requirement targets:', requirementTargets);
    
    if (isDemoMode) {
      // デモモード用のモック処理
      setIsCreatingRequirements(true);
      setRequirementsProgress({ progress: 20, stage: 'scanning', message: 'プロジェクト構造を取得中...' });
      
      setTimeout(() => {
        setRequirementsProgress({ progress: 40, stage: 'academia', message: 'Academia要件ファイルを作成中...' });
        
        setTimeout(() => {
          setRequirementsProgress({ progress: 70, stage: 'presentation', message: 'Presentation要件ファイルを作成中...' });
          
          setTimeout(() => {
            setRequirementsProgress({ progress: 100, stage: 'completed', message: '要件ファイル作成が完了しました！' });
            
            const mockResult = {
              success: true,
              createdFiles: [
                { folderType: 'Academia', file: { name: 'Material_Requirements.xlsx' }, itemCount: 7 },
                { folderType: 'Presentation', file: { name: 'Material_Requirements.xlsx' }, itemCount: 8 }
              ],
              skippedFiles: []
            };
            
            setLastRequirementsResult(mockResult);
            setIsCreatingRequirements(false);
            
            alert(`📋 要件ファイル作成が完了しました！\n\n✅ 作成ファイル: ${mockResult.createdFiles.length}件\n⏭️ スキップ: ${mockResult.skippedFiles.length}件\n\nAcademia・Presentationフォルダをご確認ください。`);
          }, 1500);
        }, 1500);
      }, 1500);
      return;
    }

    if (requirementsCreatorService.isCurrentlyProcessing()) {
      alert('既に要件ファイル作成を実行中です');
      return;
    }

    setIsCreatingRequirements(true);
    setRequirementsProgress({ progress: 0, stage: 'initializing', message: '初期化中...' });

    try {
      const result = await requirementsCreatorService.createRequirementsFiles(
        project.id,
        (progress) => setRequirementsProgress(progress),
        requirementTargets
      );

      setLastRequirementsResult(result);

      if (result.success) {
        alert(`✅ 要件ファイル作成が完了しました！\n\n✅ 作成ファイル: ${result.createdFiles?.length || 0}件\n⏭️ スキップ: ${result.skippedFiles?.length || 0}件\n\nAcademia・Presentationフォルダをご確認ください。`);
      } else {
        showRequirementsErrorDialog(result.error);
      }
    } catch (error) {
      console.error('Requirements creation failed:', error);
      showRequirementsErrorDialog(error.message);
      setRequirementsProgress({ progress: 0, stage: 'error', message: `エラー: ${error.message}` });
    } finally {
      setIsCreatingRequirements(false);
    }
  };

  /**
   * 要件ファイル作成エラーダイアログを表示
   */
  const showRequirementsErrorDialog = (errorMessage) => {
    const formattedMessage = `❌ 要件ファイル作成に失敗しました\n\n${errorMessage}`;
    console.error('Requirements creation error:', errorMessage);
    alert(formattedMessage);
  };

  /**
   * AI処理を実行
   */
  const handleAIProcessing = async () => {
    if (!changesDetected || changesDetected.changedFolders.length === 0) {
      alert('処理する変更がありません。まずスキャンを実行してください。');
      return;
    }

    if (isDemoMode) {
      // デモモード用のモックAI処理
      setIsProcessing(true);
      setScanProgress({ progress: 30, stage: 'processing', currentFolder: 'Document' });
      
      setTimeout(async () => {
        // デモ用の詳細な処理結果を生成
        const mockResults = {
          processedFolders: ['Document', 'Implementation'],
          generatedContent: {
            'Document': {
              summary: '# プロジェクト概要\n\nこのプロジェクトは革新的なアプローチで問題解決を図る取り組みです。\n\n## 主要ポイント\n- 効率的な処理フロー\n- ユーザビリティの向上\n- 拡張可能な設計',
              outline: '# プロジェクトアウトライン\n\n## 1. 背景と課題\n## 2. 提案する解決策\n## 3. 実装アプローチ\n## 4. 期待される効果\n## 5. 今後の展開',
              duplicateAnalysis: '# 重複分析結果\n\n重複の可能性があるセクション: 2件\n- 「目標設定」の記述が2箇所で類似\n- 「技術仕様」の詳細が重複',
              paperTopicSuggestion: 'Paper Topic Suggestionフォルダに論文トピック提案を生成しました\n\n## 生成されたトピック\n- 革新的技術統合システムの設計と実装に関する研究\n- 統合管理システムにおける効率的アーキテクチャ設計手法の提案\n- プロジェクト管理ツールのユーザビリティ向上に関する実証的研究\n- アジャイル開発プロセスにおけるAI支援ツール活用の効果分析',
              generatedFiles: [
                { name: 'AI_Document_Summary.md', webViewLink: '#' },
                { name: 'Paper_Topics_2024-01-15.md', webViewLink: '#' }
              ]
            },
            'Implementation': {
              changeLog: '# 最新の変更履歴\n\n## v2.1.0\n- 新機能: AI連携システム追加\n- 改善: UI/UXの大幅な向上\n- 修正: パフォーマンス関連のバグ修正',
              specification: '# 実装仕様書\n\n## システム構成\n- フロントエンド: React + Vite\n- バックエンド: Node.js\n- データベース: Google Drive API\n\n## API設計\n- RESTful API\n- 認証: OAuth 2.0',
              architecture: '# システムアーキテクチャ\n\n```mermaid\ngraph TD\n    A[React Frontend] --> B[Google Drive API]\n    A --> C[AI Processing Service]\n    B --> D[Project Files]\n    C --> E[Generated Content]\n```',
              generatedFiles: [
                { name: 'AI_Architecture_Diagram.md', webViewLink: '#' }
              ]
            }
          },
          summary: {
            totalFolders: 2,
            successCount: 2,
            errorCount: 0
          }
        };

        setProcessingResults(mockResults);
        setLastProcessingTime(new Date());
        setScanProgress({ progress: 100, stage: 'completed' });
        setIsProcessing(false);
        setIsResultsModalOpen(true);
        
        // フォルダ要約を更新
        await loadFolderSummaries(selectedProject.id, true);
        
        // 処理完了後、変更検出をリセット
        setChangesDetected(null);
      }, 3000);
      return;
    }

    setIsProcessing(true);

    try {
      const results = await aiProcessingService.processChanges(
        changesDetected.changedFolders,
        lastScanResult,
        (progress) => setScanProgress(progress)
      );

      // 処理結果を保存して結果モーダルを表示
      setProcessingResults(results);
      setLastProcessingTime(new Date());
      setIsResultsModalOpen(true);
      
      // フォルダ要約を更新
      await loadFolderSummaries(selectedProject.id);
      
      // 処理完了後、変更検出をリセット
      setChangesDetected(null);
      
    } catch (error) {
      console.error('AI processing failed:', error);
      alert('AI処理に失敗しました: ' + error.message);
    } finally {
      setIsProcessing(false);
      setScanProgress({ progress: 0, stage: '' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-4/5 h-4/5 overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">
            {selectedProject ? selectedProject.name : `${panelTitle} - プロジェクト管理`}
          </h2>
          <div className="flex items-center gap-2">
            {isDemoMode && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                デモモード
              </span>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
          </div>
        </div>

        {!selectedProject ? (
          /* プロジェクト一覧 */
          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">読み込み中...</p>
                </div>
              </div>
            ) : isDemoMode ? (
              <>
                {/* デモモード用の設定案内 */}
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h3 className="text-lg font-medium text-yellow-800 mb-2">Google Drive API設定が必要です</h3>
                  <p className="text-sm text-yellow-700 mb-3">
                    実際のGoogle Drive連携を使用するには、Google Cloud Consoleで設定を行い、環境変数を設定してください。
                  </p>
                  <div className="text-xs text-yellow-600 space-y-1">
                    <p>1. Google Cloud Consoleでプロジェクトを作成</p>
                    <p>2. Google Drive APIを有効化</p>
                    <p>3. OAuth 2.0クライアントIDとAPIキーを作成</p>
                    <p>4. .envファイルに認証情報を設定</p>
                  </div>
                </div>

                {/* 新規プロジェクト作成（デモ） */}
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="新しいプロジェクト名を入力（デモ）"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
                    />
                    <button
                      onClick={handleCreateProject}
                      disabled={!newProjectName.trim()}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
                    >
                      作成（デモ）
                    </button>
                  </div>
                </div>

                {/* プロジェクトリスト（デモ） */}
                <div className="overflow-y-auto h-full">
                  {projects.length === 0 ? (
                    <div className="text-center text-gray-500 mt-8">
                      プロジェクトがありません（デモモード）
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {projects.map((project, index) => (
                        <div
                          key={project.id || `project-${index}`}
                          onClick={() => handleProjectClick(project)}
                          className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md cursor-pointer transition-all"
                        >
                          <h3 className="font-semibold text-lg mb-2">{project.name}</h3>
                          <p className="text-sm text-gray-500">
                            作成日: {new Date(project.createdTime).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-blue-500 mt-1">デモプロジェクト</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : !isSignedIn ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-700 mb-4">Google Driveにサインインしてください</h3>
                  <button
                    onClick={handleSignIn}
                    className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Googleでサインイン
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 新規プロジェクト作成 */}
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="新しいプロジェクト名を入力"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
                    />
                    <button
                      onClick={handleCreateProject}
                      disabled={isCreating || !newProjectName.trim()}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
                    >
                      {isCreating ? '作成中...' : '作成'}
                    </button>
                  </div>
                </div>

                {/* プロジェクトリスト */}
                <div className="overflow-y-auto h-full">
                  {projects.length === 0 ? (
                    <div className="text-center text-gray-500 mt-8">
                      プロジェクトがありません
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {projects.map((project, index) => (
                        <div
                          key={project.id || `project-${index}`}
                          onClick={() => handleProjectClick(project)}
                          className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md cursor-pointer transition-all"
                        >
                          <h3 className="font-semibold text-lg mb-2">{project.name}</h3>
                          <p className="text-sm text-gray-500">
                            作成日: {new Date(project.createdTime).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          /* プロジェクト詳細 */
          <div className="flex-1 overflow-hidden">
            {/* ヘッダー部分 */}
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex justify-between items-center">
                <button
                  onClick={handleBackToList}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  ← 一覧に戻る
                </button>
                
                {/* AI処理ボタン群 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleScanProject(selectedProject)}
                    disabled={isScanning || isProcessing || isGeneratingPaperTopic || isGeneratingSlides || isSearchingReferences || isOrganizingDocuments || isCollectingMaterials || isCreatingRequirements || isGeneratingPaper}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 flex items-center gap-2"
                  >
                    {isScanning ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        スキャン中...
                      </>
                    ) : (
                      <>
                        🔍 変更をスキャン
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => handleAIProcessing(selectedProject)}
                    disabled={!changesDetected || changesDetected.changedFolders.length === 0 || isProcessing || isScanning || isGeneratingPaperTopic || isGeneratingSlides || isGeneratingDocument || isSearchingReferences || isOrganizingDocuments || isCollectingMaterials || isCreatingRequirements || isGeneratingPaper}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        AI処理中...
                      </>
                    ) : (
                      <>
                        🤖 AI処理実行
                      </>
                    )}
                  </button>

                  {/* 論文処理系 */}
                  <div className="relative">
                    <div 
                      className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors duration-200"
                      onClick={() => setShowPaperMenu(!showPaperMenu)}
                    >
                      <h3 className="text-sm font-medium text-blue-800">📄 論文処理</h3>
                      <svg 
                        className={`w-4 h-4 text-blue-600 transition-transform duration-200 ${showPaperMenu ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    
                    {showPaperMenu && (
                      <div className="mt-2 p-3 bg-white rounded-lg border border-blue-200 shadow-sm">
                        <div className="flex flex-wrap gap-2">
                          {/* 論文トピック提案ボタン */}
                          <button
                            onClick={() => handlePaperTopicSuggestion(selectedProject)}
                            disabled={isGeneratingPaperTopic || isGeneratingSlides || isSearchingReferences || isOrganizingDocuments || isCollectingMaterials || isCreatingRequirements || isScanning || isProcessing || isGeneratingPaper}
                            className="px-3 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-300 flex items-center gap-2 relative group text-sm"
                            title={!openaiService.isConfigured() ? "OpenAI API設定が必要です" : "Mainドキュメントを基に論文トピック提案を生成"}
                          >
                            {isGeneratingPaperTopic ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                生成中...
                              </>
                            ) : (
                              <>
                                💡 論文トピック提案
                                {!openaiService.isConfigured() && (
                                  <span className="text-xs bg-yellow-400 text-yellow-800 px-1 rounded">API未設定</span>
                                )}
                              </>
                            )}
                            {!openaiService.isConfigured() && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full border border-white"></div>
                            )}
                          </button>

                          {/* 参考論文検索ボタン */}
                          <button
                            onClick={() => setShowSearchSourceSelector(!showSearchSourceSelector)}
                            disabled={isSearchingReferences || isOrganizingDocuments || isCollectingMaterials || isCreatingRequirements || isGeneratingSlides || isGeneratingPaperTopic || isGeneratingDocument || isGeneratingPaper || isScanning || isProcessing}
                            className="px-3 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:bg-gray-300 flex items-center gap-2 text-sm"
                          >
                            {isSearchingReferences ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                検索中...
                              </>
                            ) : (
                              <>
                                🔍 参考論文検索
                                <span className="text-xs">▼</span>
                              </>
                            )}
                          </button>

                          {/* 論文生成ボタン */}
                          <button
                            onClick={() => handlePaperGeneration(selectedProject)}
                            disabled={isGeneratingPaper || isSearchingReferences || isOrganizingDocuments || isCollectingMaterials || isCreatingRequirements || isGeneratingSlides || isGeneratingPaperTopic || isGeneratingDocument || isScanning || isProcessing || !lastScanResult}
                            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 flex items-center gap-2 relative group text-sm"
                            title={!lastScanResult ? "まず「変更をスキャン」を実行してください" : "Document/ForAcaとAcademiaフォルダの内容を基に論文を生成"}
                          >
                            {isGeneratingPaper ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                生成中...
                              </>
                            ) : (
                              <>
                                ✍️ 論文生成
                              </>
                            )}
                            {!lastScanResult && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full border border-white"></div>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ドキュメント処理系 */}
                  <div className="relative">
                    <div 
                      className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200 cursor-pointer hover:bg-green-100 transition-colors duration-200"
                      onClick={() => setShowDocumentMenu(!showDocumentMenu)}
                    >
                      <h3 className="text-sm font-medium text-green-800">📋 ドキュメント処理</h3>
                      <svg 
                        className={`w-4 h-4 text-green-600 transition-transform duration-200 ${showDocumentMenu ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    
                    {showDocumentMenu && (
                      <div className="mt-2 p-3 bg-white rounded-lg border border-green-200 shadow-sm">
                        <div className="flex flex-wrap gap-2">
                          {/* ドキュメント生成ボタン */}
                          <button
                            onClick={() => handleDocumentGeneration(selectedProject)}
                            disabled={isGeneratingDocument || isGeneratingSlides || isGeneratingPaperTopic || isSearchingReferences || isOrganizingDocuments || isCollectingMaterials || isCreatingRequirements || isScanning || isProcessing || isGeneratingPaper}
                            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 flex items-center gap-2 relative group text-sm"
                            title={!openaiService.isConfigured() ? "OpenAI API設定が必要です" : "Presentationフォルダのプレゼン資料を基にMainドキュメントを生成"}
                          >
                            {isGeneratingDocument ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                生成中...
                              </>
                            ) : (
                              <>
                                📝 ドキュメント生成
                                {!openaiService.isConfigured() && (
                                  <span className="text-xs bg-yellow-400 text-yellow-800 px-1 rounded">API未設定</span>
                                )}
                              </>
                            )}
                            {!openaiService.isConfigured() && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full border border-white"></div>
                            )}
                          </button>

                          {/* ドキュメント整理ボタン */}
                          <button
                            onClick={() => setShowCategorySelector(!showCategorySelector)}
                            disabled={isOrganizingDocuments || isSearchingReferences || isCollectingMaterials || isCreatingRequirements || isGeneratingSlides || isGeneratingPaperTopic || isGeneratingDocument || isGeneratingPaper || isScanning || isProcessing}
                            className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 flex items-center gap-2 text-sm"
                          >
                            {isOrganizingDocuments ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                整理中...
                              </>
                            ) : (
                              <>
                                📁 ドキュメント整理
                                <span className="text-xs">▼</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* スライド生成ボタン */}
                  <button
                    onClick={() => handleSlideGeneration(selectedProject)}
                    disabled={isGeneratingSlides || isGeneratingPaperTopic || isSearchingReferences || isOrganizingDocuments || isCollectingMaterials || isCreatingRequirements || isScanning || isProcessing || isGeneratingPaper || isGeneratingDocument}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 flex items-center gap-2"
                  >
                    {isGeneratingSlides ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        スライド生成中...
                      </>
                    ) : (
                      <>
                        📊 スライド生成
                      </>
                    )}
                  </button>

                  {/* Reaching検索ボタン */}
                  <button
                    onClick={() => handleReachingSearch(selectedProject)}
                    disabled={isReachingSearching || isGeneratingPaper || isSearchingReferences || isOrganizingDocuments || isCollectingMaterials || isCreatingRequirements || isGeneratingSlides || isGeneratingPaperTopic || isGeneratingDocument || isScanning || isProcessing}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 flex items-center gap-2"
                    title="Mainドキュメントを基に関連する学会・展示会・機関を検索"
                  >
                    {isReachingSearching ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Reaching検索中...
                      </>
                    ) : (
                      <>
                        🌐 Reaching検索
                      </>
                    )}
                  </button>

                  {/* 参考論文検索の検索元選択ドロップダウン（機能メニューから呼び出される） */}
                  {showSearchSourceSelector && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 min-w-48">
                      <div className="text-sm font-medium text-gray-700 mb-2">検索元を選択</div>
                      
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                          <input
                            type="radio"
                            name="searchSource"
                            value="ieee"
                            checked={searchSource === 'ieee'}
                            onChange={(e) => setSearchSource(e.target.value)}
                            className="text-teal-600"
                          />
                          <span className="text-sm">🔬 IEEE Xplore</span>
                        </label>
                        
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                          <input
                            type="radio"
                            name="searchSource"
                            value="semantic-scholar"
                            checked={searchSource === 'semantic-scholar'}
                            onChange={(e) => setSearchSource(e.target.value)}
                            className="text-teal-600"
                          />
                          <span className="text-sm">🎓 Semantic Scholar</span>
                        </label>
                      </div>
                      
                      <div className="mt-2 text-xs text-gray-500">
                        {searchSource === 'ieee' ? 
                          'IEEE Xplore: 技術・工学系論文に特化（APIキー必要）' : 
                          'Semantic Scholar: AI・機械学習系論文に特化（無料、CORS制限あり）'
                        }
                      </div>
                      
                      <div className="mt-3 pt-2 border-t border-gray-200">
                        <button
                          onClick={() => {
                            handleReferenceSearch(selectedProject);
                            setShowSearchSourceSelector(false);
                          }}
                          className="w-full px-3 py-1 bg-teal-500 text-white text-sm rounded hover:bg-teal-600"
                        >
                          検索実行
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ドキュメント整理のカテゴリ選択ドロップダウン（機能メニューから呼び出される） */}
                  {showCategorySelector && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 min-w-48">
                      <div className="text-sm font-medium text-gray-700 mb-2">整理対象カテゴリ</div>
                      
                      {/* 全選択/全解除ボタン */}
                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => toggleAllCategories(true)}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          全選択
                        </button>
                        <button
                          onClick={() => toggleAllCategories(false)}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          全解除
                        </button>
                      </div>

                      {/* カテゴリチェックボックス */}
                      <div className="space-y-2">
                        {Object.entries({
                          Main: { label: 'Main - 大きい方向性', color: 'text-blue-600' },
                          Topic: { label: 'Topic - トピック一覧', color: 'text-green-600' },
                          ForTech: { label: 'ForTech - 技術系', color: 'text-orange-600' },
                          ForAca: { label: 'ForAca - 学術系', color: 'text-purple-600' }
                        }).map(([category, config]) => (
                          <label key={category} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={selectedCategories[category]}
                              onChange={() => toggleCategory(category)}
                              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                            />
                            <span className={`text-sm ${config.color}`}>
                              {config.label}
                            </span>
                          </label>
                        ))}
                      </div>

                      {/* 実行ボタン */}
                      <div className="mt-3 pt-2 border-t border-gray-200">
                        <button
                          onClick={() => {
                            setShowCategorySelector(false);
                            handleDocumentOrganization(selectedProject);
                          }}
                          disabled={Object.values(selectedCategories).every(v => !v)}
                          className="w-full px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300 text-sm"
                        >
                          選択したカテゴリで整理実行
                        </button>
                        {Object.values(selectedCategories).every(v => !v) && (
                          <p className="text-xs text-red-500 mt-1">少なくとも1つのカテゴリを選択してください</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 要件ファイル作成ボタン（対象選択付き） */}
                  <div className="relative requirements-selector-container">
                    <button
                      onClick={() => setShowRequirementsSelector(!showRequirementsSelector)}
                      disabled={isCreatingRequirements || isCollectingMaterials || isOrganizingDocuments || isSearchingReferences || isGeneratingSlides || isGeneratingPaperTopic || isGeneratingDocument || isScanning || isProcessing}
                      className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:bg-gray-300 flex items-center gap-2"
                    >
                      {isCreatingRequirements ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          要件作成中...
                        </>
                      ) : (
                        <>
                          📋 要件ファイル作成
                          <span className="text-xs">▼</span>
                        </>
                      )}
                    </button>

                    {/* 要件作成対象選択ドロップダウン */}
                    {showRequirementsSelector && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 min-w-52">
                        <div className="text-sm font-medium text-gray-700 mb-2">作成対象選択</div>
                        
                        {/* 全選択/全解除ボタン */}
                        <div className="flex gap-2 mb-3">
                          <button
                            onClick={() => toggleAllRequirementTargets(true)}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            全選択
                          </button>
                          <button
                            onClick={() => toggleAllRequirementTargets(false)}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            全解除
                          </button>
                        </div>

                        {/* 作成対象選択 */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={requirementTargets.academia}
                              onChange={() => toggleRequirementTarget('academia')}
                              className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                            />
                            <span className="text-sm text-blue-600">📚 Academia要件ファイル</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={requirementTargets.presentation}
                              onChange={() => toggleRequirementTarget('presentation')}
                              className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                            />
                            <span className="text-sm text-orange-600">📊 Presentation要件ファイル</span>
                          </label>
                        </div>

                        {/* 実行ボタン */}
                        <div className="mt-3 pt-2 border-t border-gray-200">
                          <button
                            onClick={() => {
                              setShowRequirementsSelector(false);
                              handleRequirementsCreation(selectedProject);
                            }}
                            disabled={!Object.values(requirementTargets).some(v => v)}
                            className="w-full px-3 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 disabled:bg-gray-300 text-sm"
                          >
                            選択した要件ファイルを作成
                          </button>
                          {!Object.values(requirementTargets).some(v => v) && (
                            <p className="text-xs text-red-500 mt-1">少なくとも1つの対象を選択してください</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 素材収集ボタン（収集対象選択付き） */}
                  <div className="relative material-selector-container">
                    <button
                      onClick={() => setShowMaterialSelector(!showMaterialSelector)}
                      disabled={isCollectingMaterials || isOrganizingDocuments || isSearchingReferences || isCreatingRequirements || isGeneratingSlides || isGeneratingPaperTopic || isGeneratingDocument || isScanning || isProcessing}
                      className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:bg-gray-300 flex items-center gap-2"
                    >
                      {isCollectingMaterials ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          素材収集中...
                        </>
                      ) : (
                        <>
                          📊 素材収集
                          <span className="text-xs">▼</span>
                        </>
                      )}
                    </button>

                    {/* 素材収集対象選択ドロップダウン */}
                    {showMaterialSelector && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 min-w-56">
                        <div className="text-sm font-medium text-gray-700 mb-2">収集対象選択</div>
                        
                        {/* 全選択/全解除ボタン */}
                        <div className="flex gap-2 mb-3">
                          <button
                            onClick={() => toggleAllCollectionTargets(true)}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            全選択
                          </button>
                          <button
                            onClick={() => toggleAllCollectionTargets(false)}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            全解除
                          </button>
                        </div>

                        {/* 収集元選択 */}
                        <div className="mb-3">
                          <div className="text-xs font-medium text-gray-600 mb-1">収集元</div>
                          <div className="space-y-1">
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={collectionTargets.academia}
                                onChange={() => toggleCollectionTarget('academia')}
                                className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                              />
                              <span className="text-sm text-blue-600">📚 Academia要件</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={collectionTargets.presentation}
                                onChange={() => toggleCollectionTarget('presentation')}
                                className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                              />
                              <span className="text-sm text-orange-600">📊 Presentation要件</span>
                            </label>
                          </div>
                        </div>

                        {/* 素材タイプ選択 */}
                        <div className="mb-3">
                          <div className="text-xs font-medium text-gray-600 mb-1">素材タイプ</div>
                          <div className="space-y-1">
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={collectionTargets.images}
                                onChange={() => toggleCollectionTarget('images')}
                                className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                              />
                              <span className="text-sm text-green-600">🖼️ 画像</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={collectionTargets.charts}
                                onChange={() => toggleCollectionTarget('charts')}
                                className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                              />
                              <span className="text-sm text-purple-600">📈 グラフ</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={collectionTargets.icons}
                                onChange={() => toggleCollectionTarget('icons')}
                                className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                              />
                              <span className="text-sm text-indigo-600">🎯 アイコン</span>
                            </label>
                          </div>
                        </div>

                        {/* 実行ボタン */}
                        <div className="mt-3 pt-2 border-t border-gray-200">
                          <button
                            onClick={() => {
                              setShowMaterialSelector(false);
                              handleMaterialCollection(selectedProject);
                            }}
                            disabled={!Object.values(collectionTargets).some(v => v)}
                            className="w-full px-3 py-2 bg-pink-500 text-white rounded hover:bg-pink-600 disabled:bg-gray-300 text-sm"
                          >
                            選択した対象で素材収集実行
                          </button>
                          {!Object.values(collectionTargets).some(v => v) && (
                            <p className="text-xs text-red-500 mt-1">少なくとも1つの対象を選択してください</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 処理結果表示ボタン */}
                  {processingResults && (
                    <button
                      onClick={() => setIsResultsModalOpen(true)}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
                    >
                      📊 処理結果を表示
                    </button>
                  )}
                </div>
              </div>

              {/* 進捗表示 */}
              {(isScanning || isProcessing) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-800">
                      {scanProgress.stage === 'scanning' && '📊 プロジェクトをスキャンしています...'}
                      {scanProgress.stage === 'analyzing' && '🔍 変更を分析しています...'}
                      {scanProgress.stage === 'processing' && `🤖 AI処理中: ${scanProgress.currentFolder}`}
                      {scanProgress.stage === 'completed' && '✅ 完了'}
                      {scanProgress.stage === 'initializing' && '⚙️ 初期化中...'}
                    </span>
                    <span className="text-sm text-blue-600">{Math.round(scanProgress.progress)}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${scanProgress.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* 論文トピック提案の進捗表示 */}
              {isGeneratingPaperTopic && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-indigo-800">
                      {paperTopicProgress.stage === 'scanning' && '📊 プロジェクト構造を取得中...'}
                      {paperTopicProgress.stage === 'reading' && '📄 Mainドキュメントを読み込み中...'}
                      {paperTopicProgress.stage === 'preparing' && '📁 Academiaフォルダを準備中...'}
                      {paperTopicProgress.stage === 'creating' && '📂 Paper Topic Suggestionフォルダを作成中...'}
                      {paperTopicProgress.stage === 'generating' && '🎓 論文トピック提案を生成中...'}
                      {paperTopicProgress.stage === 'saving' && '💾 Suggestionドキュメントを保存中...'}
                      {paperTopicProgress.stage === 'verifying' && '🔍 ファイル作成を確認中...'}
                      {paperTopicProgress.stage === 'completed' && '✅ 論文トピック提案完了'}
                      {paperTopicProgress.stage === 'error' && '❌ エラーが発生しました'}
                      {paperTopicProgress.stage === 'initializing' && '⚙️ 初期化中...'}
                    </span>
                    <span className="text-sm text-indigo-600">{Math.round(paperTopicProgress.progress)}%</span>
                  </div>
                  <div className="w-full bg-indigo-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${paperTopicProgress.progress}%` }}
                    ></div>
                  </div>
                  {paperTopicProgress.message && (
                    <p className="text-xs text-indigo-600 mt-2">{paperTopicProgress.message}</p>
                  )}
                </div>
              )}

              {/* スライド生成の進捗表示 */}
              {isGeneratingSlides && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-orange-800">
                      {slideProgress.stage === 'scanning' && '📊 プロジェクト構造を取得中...'}
                      {slideProgress.stage === 'reading' && '📄 Documentフォルダを読み込み中...'}
                      {slideProgress.stage === 'preparing' && '📁 Presentationフォルダを準備中...'}
                      {slideProgress.stage === 'generating' && '📊 スライド内容を生成中...'}
                      {slideProgress.stage === 'creating' && '🎨 PPTXファイルを作成中...'}
                      {slideProgress.stage === 'saving' && '💾 Google Driveに保存中...'}
                      {slideProgress.stage === 'completed' && '✅ スライド生成完了'}
                      {slideProgress.stage === 'error' && '❌ エラーが発生しました'}
                      {slideProgress.stage === 'initializing' && '⚙️ 初期化中...'}
                    </span>
                    <span className="text-sm text-orange-600">{Math.round(slideProgress.progress)}%</span>
                  </div>
                  <div className="w-full bg-orange-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${slideProgress.progress}%` }}
                    ></div>
                  </div>
                  {slideProgress.message && (
                    <p className="text-xs text-orange-600 mt-2">{slideProgress.message}</p>
                  )}
                </div>
              )}

              {/* ドキュメント生成の進捗表示 */}
              {isGeneratingDocument && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-800">
                      {documentProgress.stage === 'initializing' && '⚙️ 初期化中...'}
                      {documentProgress.stage === 'reading' && '📄 Presentationフォルダを読み込み中...'}
                      {documentProgress.stage === 'analyzing' && '🔍 プレゼン資料を解析中...'}
                      {documentProgress.stage === 'preparing' && '📁 Documentフォルダを準備中...'}
                      {documentProgress.stage === 'generating' && '📝 Mainドキュメントを生成中...'}
                      {documentProgress.stage === 'saving' && '💾 Google Driveに保存中...'}
                      {documentProgress.stage === 'completed' && '✅ ドキュメント生成完了'}
                      {documentProgress.stage === 'error' && '❌ エラーが発生しました'}
                    </span>
                    <span className="text-sm text-blue-600">{Math.round(documentProgress.progress)}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${documentProgress.progress}%` }}
                    ></div>
                  </div>
                  {documentProgress.message && (
                    <p className="text-xs text-blue-600 mt-2">{documentProgress.message}</p>
                  )}
                </div>
              )}

              {/* 参考論文検索の進捗表示 */}
              {isSearchingReferences && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-teal-800">
                      {referenceProgress.stage === 'scanning' && '📊 プロジェクト構造を取得中...'}
                      {referenceProgress.stage === 'reading' && '📄 分析対象ドキュメントを読み込み中...'}
                      {referenceProgress.stage === 'preparing' && '📁 Reference Paperフォルダを準備中...'}
                      {referenceProgress.stage === 'analyzing' && '🔍 ドキュメント内容を分析中...'}
                      {referenceProgress.stage === 'searching' && '📚 関連論文を検索中...'}
                      {referenceProgress.stage === 'creating' && '📊 Excelファイルを作成中...'}
                      {referenceProgress.stage === 'saving' && '💾 Google Driveに保存中...'}
                      {referenceProgress.stage === 'completed' && '✅ 参考論文検索完了'}
                      {referenceProgress.stage === 'error' && '❌ エラーが発生しました'}
                      {referenceProgress.stage === 'initializing' && '⚙️ 初期化中...'}
                    </span>
                    <span className="text-sm text-teal-600">{Math.round(referenceProgress.progress)}%</span>
                  </div>
                  <div className="w-full bg-teal-200 rounded-full h-2">
                    <div 
                      className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${referenceProgress.progress}%` }}
                    ></div>
                  </div>
                  {referenceProgress.message && (
                    <p className="text-xs text-teal-600 mt-2">{referenceProgress.message}</p>
                  )}
                </div>
              )}

              {/* 論文生成の進捗表示 */}
              {isGeneratingPaper && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-red-800">
                      {paperProgress.stage === 'analyzing' && '📄 ソースドキュメントを分析中...'}
                      {paperProgress.stage === 'processing' && '🔍 ドキュメント内容を処理中...'}
                      {paperProgress.stage === 'generating' && '📝 論文構造を生成中...'}
                      {paperProgress.stage === 'creating' && '📄 LaTeXファイルを作成中...'}
                      {paperProgress.stage === 'saving' && '💾 ファイルを保存中...'}
                      {paperProgress.stage === 'converting' && '📄 PDFに変換中...'}
                      {paperProgress.stage === 'completed' && '✅ 論文生成完了'}
                      {paperProgress.stage === 'error' && '❌ エラーが発生しました'}
                      {paperProgress.stage === 'initializing' && '⚙️ 初期化中...'}
                    </span>
                    <span className="text-sm text-red-600">{Math.round(paperProgress.progress)}%</span>
                  </div>
                  <div className="w-full bg-red-200 rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${paperProgress.progress}%` }}
                    ></div>
                  </div>
                  {paperProgress.message && (
                    <p className="text-xs text-red-600 mt-2">{paperProgress.message}</p>
                  )}
                </div>
              )}

              {/* ドキュメント整理の進捗表示 */}
              {isOrganizingDocuments && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-800">
                      {organizationProgress.stage === 'scanning' && '📁 プロジェクト構造を取得中...'}
                      {organizationProgress.stage === 'reading' && '📄 Documentフォルダを読み込み中...'}
                      {organizationProgress.stage === 'analyzing' && '🔍 ドキュメント内容を分析中...'}
                      {organizationProgress.stage === 'creating' && '📂 整理されたドキュメントを作成中...'}
                      {organizationProgress.stage === 'saving' && '💾 Google Driveに保存中...'}
                      {organizationProgress.stage === 'reporting' && '📋 整理結果レポートを作成中...'}
                      {organizationProgress.stage === 'completed' && '✅ ドキュメント整理完了'}
                      {organizationProgress.stage === 'error' && '❌ エラーが発生しました'}
                      {organizationProgress.stage === 'initializing' && '⚙️ 初期化中...'}
                    </span>
                    <span className="text-sm text-purple-600">{Math.round(organizationProgress.progress)}%</span>
                  </div>
                  <div className="w-full bg-purple-200 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${organizationProgress.progress}%` }}
                    ></div>
                  </div>
                  {organizationProgress.message && (
                    <p className="text-xs text-purple-600 mt-2">{organizationProgress.message}</p>
                  )}
                </div>
              )}

              {/* 素材収集の進捗表示 */}
              {isCollectingMaterials && (
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-pink-800">
                      {materialProgress.stage === 'scanning' && '📁 プロジェクト構造を確認中...'}
                      {materialProgress.stage === 'requirements' && '📋 素材要件を読み込み中...'}
                      {materialProgress.stage === 'analyzing' && '🔍 未収集素材を分析中...'}
                      {materialProgress.stage === 'collecting' && '🎨 素材を収集中...'}
                      {materialProgress.stage === 'saving' && '💾 Materialフォルダに保存中...'}
                      {materialProgress.stage === 'updating' && '📝 要件ファイルを更新中...'}
                      {materialProgress.stage === 'completed' && '✅ 素材収集完了'}
                      {materialProgress.stage === 'error' && '❌ エラーが発生しました'}
                      {materialProgress.stage === 'initializing' && '⚙️ 初期化中...'}
                    </span>
                    <span className="text-sm text-pink-600">{Math.round(materialProgress.progress)}%</span>
                  </div>
                  <div className="w-full bg-pink-200 rounded-full h-2">
                    <div 
                      className="bg-pink-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${materialProgress.progress}%` }}
                    ></div>
                  </div>
                  {materialProgress.message && (
                    <p className="text-xs text-pink-600 mt-2">{materialProgress.message}</p>
                  )}
                </div>
              )}

              {/* 要件ファイル作成の進捗表示 */}
              {isCreatingRequirements && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-cyan-800">
                      {requirementsProgress.stage === 'scanning' && '📁 プロジェクト構造を取得中...'}
                      {requirementsProgress.stage === 'academia' && '📚 Academia要件ファイルを作成中...'}
                      {requirementsProgress.stage === 'presentation' && '📊 Presentation要件ファイルを作成中...'}
                      {requirementsProgress.stage === 'completed' && '✅ 要件ファイル作成完了'}
                      {requirementsProgress.stage === 'error' && '❌ エラーが発生しました'}
                      {requirementsProgress.stage === 'initializing' && '⚙️ 初期化中...'}
                    </span>
                    <span className="text-sm text-cyan-600">{Math.round(requirementsProgress.progress)}%</span>
                  </div>
                  <div className="w-full bg-cyan-200 rounded-full h-2">
                    <div 
                      className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${requirementsProgress.progress}%` }}
                    ></div>
                  </div>
                  {requirementsProgress.message && (
                    <p className="text-xs text-cyan-600 mt-2">{requirementsProgress.message}</p>
                  )}
                </div>
              )}

              {/* 変更検出結果の表示 */}
              {changesDetected && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-medium text-yellow-800 mb-2">🔄 検出された変更</h4>
                  <div className="text-sm text-yellow-700">
                    <p>変更されたフォルダ: <strong>{changesDetected.summary.foldersAffected}個</strong></p>
                    <p>総変更数: <strong>{changesDetected.summary.totalChanges}件</strong></p>
                    {changesDetected.changedFolders.length > 0 && (
                      <p className="mt-1">
                        対象フォルダ: {changesDetected.changedFolders.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 最後のAI処理結果サマリー */}
              {lastProcessingTime && processingResults && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 mb-2">✅ 最新のAI処理結果</h4>
                  <div className="text-sm text-green-700">
                    <p>処理時刻: <strong>{lastProcessingTime.toLocaleString('ja-JP')}</strong></p>
                    <p>処理完了: <strong>{processingResults.summary?.successCount || 0}フォルダ</strong></p>
                    <p>生成ファイル: <strong>
                      {Object.values(processingResults.generatedContent || {}).reduce((total, content) => 
                        total + (content.generatedFiles?.length || 0), 0
                      )}件</strong>
                    </p>
                    {processingResults.processedFolders?.length > 0 && (
                      <p className="mt-1">
                        処理済み: {processingResults.processedFolders.join(', ')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setIsResultsModalOpen(true)}
                    className="mt-2 text-sm text-green-600 hover:text-green-800 underline"
                  >
                    詳細を表示 →
                  </button>
                </div>
              )}

              {/* 論文トピック提案結果サマリー */}
              {lastPaperTopicResult && lastPaperTopicResult.success && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h4 className="font-medium text-indigo-800 mb-2">🎓 論文トピック提案結果</h4>
                  <div className="text-sm text-indigo-700">
                    <p>ベースドキュメント: <strong>{lastPaperTopicResult.mainDocument?.fileName}</strong></p>
                    <p>生成ファイル: <strong>{lastPaperTopicResult.suggestionFile?.name}</strong></p>
                    <p>保存場所: <strong>Academia {'>'} Paper Topic Suggestion</strong></p>
                  </div>
                  {lastPaperTopicResult.suggestionFile?.webViewLink !== '#' && (
                    <button
                      onClick={() => window.open(lastPaperTopicResult.suggestionFile.webViewLink, '_blank')}
                      className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 underline"
                    >
                      Suggestionファイルを開く →
                    </button>
                  )}
                </div>
              )}

              {/* ドキュメント生成結果サマリー */}
              {lastDocumentResult && lastDocumentResult.success && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-2">📄 ドキュメント生成結果</h4>
                  <div className="text-sm text-blue-700">
                    <p>読み込みファイル: <strong>{lastDocumentResult.sourceFiles?.length || 0}件</strong></p>
                    <p>生成ファイル: <strong>{lastDocumentResult.generatedDocument?.name}</strong></p>
                    <p>保存場所: <strong>Document</strong></p>
                  </div>
                  {lastDocumentResult.generatedDocument?.webViewLink !== '#' && (
                    <button
                      onClick={() => window.open(lastDocumentResult.generatedDocument.webViewLink, '_blank')}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Mainドキュメントを開く →
                    </button>
                  )}
                </div>
              )}

              {/* スライド生成結果サマリー */}
              {lastSlideResult && lastSlideResult.success && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="font-medium text-orange-800 mb-2">📊 スライド生成結果</h4>
                  <div className="text-sm text-orange-700">
                    <p>読み込みドキュメント: <strong>{lastSlideResult.sourceDocuments?.length}件</strong></p>
                    <p>生成ファイル: <strong>{lastSlideResult.slideFile?.name}</strong></p>
                    <p>保存場所: <strong>Presentation フォルダ</strong></p>
                    {lastSlideResult.sourceDocuments?.find(doc => doc.isMain) && (
                      <p>メインドキュメント: <strong>{lastSlideResult.sourceDocuments.find(doc => doc.isMain).fileName}</strong></p>
                    )}
                  </div>
                  {lastSlideResult.slideFile?.webViewLink !== '#' && (
                    <button
                      onClick={() => window.open(lastSlideResult.slideFile.webViewLink, '_blank')}
                      className="mt-2 text-sm text-orange-600 hover:text-orange-800 underline"
                    >
                      スライドファイルを開く →
                    </button>
                  )}
                </div>
              )}

              {/* 参考論文検索結果サマリー */}
              {lastReferenceResult && lastReferenceResult.success && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                  <h4 className="font-medium text-teal-800 mb-2">📚 参考論文検索結果</h4>
                  <div className="text-sm text-teal-700">
                    <p>分析ドキュメント: <strong>{lastReferenceResult.sourceDocuments?.length}件</strong></p>
                    <p>検索結果: <strong>{lastReferenceResult.searchResults?.length}件の関連論文</strong></p>
                    <p>生成ファイル: <strong>{lastReferenceResult.excelFile?.name}</strong></p>
                    <p>保存場所: <strong>Academia {'>'} Reference Paper</strong></p>
                    {lastReferenceResult.sourceDocuments?.length > 0 && (
                      <p>分析対象: <strong>
                        {lastReferenceResult.sourceDocuments.map(doc => doc.source).join(', ')}
                      </strong></p>
                    )}
                  </div>
                  {lastReferenceResult.excelFile?.webViewLink !== '#' && (
                    <button
                      onClick={() => window.open(lastReferenceResult.excelFile.webViewLink, '_blank')}
                      className="mt-2 text-sm text-teal-600 hover:text-teal-800 underline"
                    >
                      Excelファイルを開く →
                    </button>
                  )}
                </div>
              )}

              {/* 論文生成結果サマリー */}
              {lastPaperResult && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 mb-2">📄 論文生成結果</h4>
                  <div className="text-sm text-red-700">
                    <p>ソースドキュメント: <strong>{lastPaperResult.sourceDocuments?.length}件</strong></p>
                    <p>生成ファイル: <strong>{lastPaperResult.generatedFiles?.length}件</strong></p>
                    <p>保存場所: <strong>Paper</strong></p>
                    {lastPaperResult.sourceDocuments?.length > 0 && (
                      <p>分析対象: <strong>
                        {lastPaperResult.sourceDocuments.map(doc => doc.source).join(', ')}
                      </strong></p>
                    )}
                    {lastPaperResult.generatedFiles?.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium">生成されたファイル:</p>
                        {lastPaperResult.generatedFiles.map((file, i) => (
                          <p key={i} className="text-xs ml-2">
                            {file.name.endsWith('.tex') ? '📝' : '📄'} {file.name}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  {lastPaperResult.pdfFile?.webViewLink && lastPaperResult.pdfFile.webViewLink !== '#' && (
                    <button
                      onClick={() => window.open(lastPaperResult.pdfFile.webViewLink, '_blank')}
                      className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                    >
                      PDFファイルを開く →
                    </button>
                  )}
                </div>
              )}

              {/* Reaching検索の進捗表示 */}
              {isReachingSearching && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-800">
                      {reachingProgress.stage === 'initializing' && '⚙️ 初期化中...'}
                      {reachingProgress.stage === 'reading' && '📄 Mainドキュメントを読み込み中...'}
                      {reachingProgress.stage === 'analyzing' && '🔍 プロジェクト内容を分析中...'}
                      {reachingProgress.stage === 'searching' && '🌐 関連する学会・展示会・機関を検索中...'}
                      {reachingProgress.stage === 'saving' && '📊 Excelファイルを作成中...'}
                      {reachingProgress.stage === 'completed' && '✅ Reaching検索完了'}
                      {reachingProgress.stage === 'error' && '❌ エラーが発生しました'}
                    </span>
                    <span className="text-sm text-purple-600">{Math.round(reachingProgress.progress)}%</span>
                  </div>
                  <div className="w-full bg-purple-200 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${reachingProgress.progress}%` }}
                    ></div>
                  </div>
                  {reachingProgress.message && (
                    <p className="text-xs text-purple-600 mt-2">{reachingProgress.message}</p>
                  )}
                </div>
              )}

              {/* Reaching検索結果サマリー */}
              {lastReachingResult && lastReachingResult.success && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-medium text-purple-800 mb-2">🌐 Reaching検索結果</h4>
                  <div className="text-sm text-purple-700">
                    <p>分析ドキュメント: <strong>{lastReachingResult.sourceDocuments?.length}件</strong></p>
                    <p>検索結果: <strong>{lastReachingResult.searchResults?.length}件の関連情報</strong></p>
                    <p>生成ファイル: <strong>{lastReachingResult.excelFile?.name}</strong></p>
                    <p>保存場所: <strong>Reaching フォルダ</strong></p>
                  </div>
                  {lastReachingResult.excelFile?.webViewLink !== '#' && (
                    <button
                      onClick={() => window.open(lastReachingResult.excelFile.webViewLink, '_blank')}
                      className="mt-2 text-sm text-purple-600 hover:text-purple-800 underline"
                    >
                      Excelファイルを開く →
                    </button>
                  )}
                </div>
              )}

              {/* ドキュメント整理の結果サマリー */}
              {lastOrganizationResult && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-medium text-purple-800 mb-2">📁 ドキュメント整理結果</h4>
                  <div className="text-sm text-purple-700">
                    <p>分析ドキュメント: <strong>{lastOrganizationResult.sourceDocuments?.length}件</strong></p>
                    <p>生成カテゴリ: <strong>{Object.keys(lastOrganizationResult.organizedDocuments || {}).length}件</strong></p>
                    <p>整理レポート: <strong>{lastOrganizationResult.reportFile?.name}</strong></p>
                    <p>保存場所: <strong>Document</strong></p>
                    {lastOrganizationResult.organizedDocuments && Object.keys(lastOrganizationResult.organizedDocuments).length > 0 && (
                      <p>生成ファイル: <strong>
                        {Object.values(lastOrganizationResult.organizedDocuments).map(doc => doc.fileName).join(', ')}
                      </strong></p>
                    )}
                  </div>
                  {lastOrganizationResult.reportFile?.webViewLink && lastOrganizationResult.reportFile.webViewLink !== '#' && (
                    <button
                      onClick={() => window.open(lastOrganizationResult.reportFile.webViewLink, '_blank')}
                      className="mt-2 text-sm text-purple-600 hover:text-purple-800 underline"
                    >
                      整理レポートを開く →
                    </button>
                  )}
                </div>
              )}

              {/* 素材収集の結果サマリー */}
              {lastMaterialResult && (
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                  <h4 className="font-medium text-pink-800 mb-2">📊 素材収集結果</h4>
                  <div className="text-sm text-pink-700">
                    <p>要件ファイル: <strong>{lastMaterialResult.requirementFiles?.length || 0}件</strong></p>
                    <p>収集画像: <strong>{lastMaterialResult.collectedMaterials?.images?.length || 0}件</strong></p>
                    <p>生成グラフ: <strong>{lastMaterialResult.collectedMaterials?.charts?.length || 0}件</strong></p>
                    <p>収集アイコン: <strong>{lastMaterialResult.collectedMaterials?.icons?.length || 0}件</strong></p>
                    <p>保存ファイル: <strong>{lastMaterialResult.savedFiles?.length || 0}件</strong></p>
                    <p>保存場所: <strong>Material</strong></p>
                    {lastMaterialResult.collectedMaterials && (
                      <div className="mt-2">
                        <p className="font-medium">収集素材例:</p>
                        {lastMaterialResult.collectedMaterials.images?.slice(0, 2).map((img, i) => (
                          <p key={i} className="text-xs ml-2">🖼️ {img.filename} ({img.keywords})</p>
                        ))}
                        {lastMaterialResult.collectedMaterials.charts?.slice(0, 2).map((chart, i) => (
                          <p key={i} className="text-xs ml-2">📈 {chart.filename} ({chart.keywords})</p>
                        ))}
                        {lastMaterialResult.collectedMaterials.icons?.slice(0, 2).map((icon, i) => (
                          <p key={i} className="text-xs ml-2">🎯 {icon.filename} ({icon.keywords})</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 要件ファイル作成の結果サマリー */}
              {lastRequirementsResult && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                  <h4 className="font-medium text-cyan-800 mb-2">📋 要件ファイル作成結果</h4>
                  <div className="text-sm text-cyan-700">
                    <p>作成ファイル: <strong>{lastRequirementsResult.createdFiles?.length || 0}件</strong></p>
                    <p>スキップファイル: <strong>{lastRequirementsResult.skippedFiles?.length || 0}件</strong></p>
                    {lastRequirementsResult.createdFiles?.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium">作成されたファイル:</p>
                        {lastRequirementsResult.createdFiles.map((file, i) => (
                          <p key={i} className="text-xs ml-2">📁 {file.folderType}: {file.file.name} ({file.itemCount}項目)</p>
                        ))}
                      </div>
                    )}
                    {lastRequirementsResult.skippedFiles?.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium">スキップされたファイル:</p>
                        {lastRequirementsResult.skippedFiles.map((file, i) => (
                          <p key={i} className="text-xs ml-2">⏭️ {file.folderType}: {file.reason}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* フォルダグリッド */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto h-full">
              {selectedProject.details?.map((folder, index) => {
                const folderConfig = PROJECT_FOLDER_STRUCTURE.find(f => f.name === folder.name);
                const isChanged = changesDetected?.changedFolders?.includes(folder.name);
                const folderSummary = folderSummaries[folder.name];
                const isProcessed = processingResults?.processedFolders?.includes(folder.name);
                
                return (
                  <div
                    key={folder.id || `folder-${index}`}
                    onClick={() => openInGoogleDrive(folder.webViewLink, folder.name)}
                    className={`p-4 border rounded-lg hover:shadow-md cursor-pointer transition-all relative overflow-hidden ${
                      isChanged 
                        ? 'border-yellow-400 bg-yellow-50' 
                        : isProcessed
                        ? 'border-green-400 bg-green-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                    title={folderConfig?.description || folder.description}
                  >
                    {/* ステータスインジケーター */}
                    {isChanged && (
                      <div className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                        <span className="text-xs text-white">!</span>
                      </div>
                    )}
                    {isProcessed && !isChanged && (
                      <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-xs text-white">✓</span>
                      </div>
                    )}
                    
                    {/* フォルダアイコンとタイトル */}
                    <div className="text-center mb-3">
                      <div className="text-2xl mb-1">
                        {folderConfig?.icon || folder.icon || '📁'}
                      </div>
                      <h4 className="font-medium text-sm">{folder.name}</h4>
                    </div>
                    
                    {/* コンテンツプレビュー */}
                    {isLoadingSummaries ? (
                      <div className="text-xs text-gray-400 text-center">
                        読み込み中...
                      </div>
                    ) : folderSummary ? (
                      <div className="space-y-2">
                        {/* ファイル概要 */}
                        <div className="text-xs text-gray-600 text-left">
                          {folderSummary.contentPreview}
                        </div>
                        
                        {/* AI処理インサイト */}
                        {folderSummary.keyInsights && folderSummary.keyInsights.length > 0 && (
                          <div className="space-y-1">
                            {folderSummary.keyInsights.slice(0, 2).map((insight, idx) => (
                              <div key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {insight}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* ファイル数表示 */}
                        <div className="text-xs text-gray-400 text-center mt-2">
                          {folderSummary.fileCount}個のファイル
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 text-center">
                        データなし
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 処理結果モーダル */}
        <ProcessingResultsModal
          isOpen={isResultsModalOpen}
          onClose={() => setIsResultsModalOpen(false)}
          results={processingResults}
          projectName={selectedProject?.name}
        />
      </div>
    </div>
  );
};

export default ProjectManager; 