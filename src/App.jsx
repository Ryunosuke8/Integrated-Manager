import React, { useState } from "react";
import Panel from "./components/Panel";
import ResearchConfirmModal from "./components/ResearchConfirmModal";
import NotepadModal from "./components/NotepadModal";
import ProjectManager from "./components/ProjectManager";
import OpenAIConfigModal from "./components/OpenAIConfigModal";
import ieeeService from './services/ieeeService';

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dragData, setDragData] = useState(null);
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [currentPanel, setCurrentPanel] = useState("");
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
  const [isOpenAIConfigOpen, setIsOpenAIConfigOpen] = useState(false);

  
  // プロジェクトパネルのメモを管理
  const [panelNotes, setPanelNotes] = useState({
    "Project": []
  });

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      setDragData(data);
      setIsModalOpen(true);
    } catch (error) {
      console.error('ドロップデータの解析に失敗しました:', error);
    }
  };

  const handleConfirmResearch = () => {
    console.log('リサーチ開始:', dragData);
    // ここで実際のリサーチ処理を実行
    alert(`${dragData.panelTitle}の${dragData.projectName}についてリサーチを開始しました！`);
    setIsModalOpen(false);
    setDragData(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setDragData(null);
  };

  const handleOpenNotepad = (panelTitle) => {
    setCurrentPanel(panelTitle);
    setIsNotepadOpen(true);
  };

  const handleCloseNotepad = () => {
    setIsNotepadOpen(false);
    setCurrentPanel("");
  };

  const handleOpenProjectManager = (panelTitle) => {
    setCurrentPanel(panelTitle);
    setIsProjectManagerOpen(true);
  };

  const handleCloseProjectManager = () => {
    setIsProjectManagerOpen(false);
    setCurrentPanel("");
  };



  const handleAddNote = (text) => {
    const newNote = {
      id: Date.now(),
      text: text,
      timestamp: new Date().toISOString()
    };
    
    setPanelNotes(prev => ({
      ...prev,
      [currentPanel]: [newNote, ...prev[currentPanel]]
    }));
  };

  const handleDeleteNote = (noteId) => {
    setPanelNotes(prev => ({
      ...prev,
      [currentPanel]: prev[currentPanel].filter(note => note.id !== noteId)
    }));
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-gray-50 p-8 relative">
      {/* 中央に大きな単一のProjectパネル */}
      <div className="flex items-center justify-center">
        <Panel
          title="Project"
          bgColor="bg-blue-400"
          widthClass="w-[1200px]"
          heightClass="h-[600px]"
          notes={panelNotes["Project"]}
          onOpenNotepad={handleOpenNotepad}
          onOpenProjectManager={handleOpenProjectManager}

        />
      </div>

      {/* ChatGPTアイコン - 左下（ドロップ可能） */}
      <div 
        className="fixed bottom-80 left-140 z-50"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-110">
          <svg 
            className="w-14 h-14 text-white" 
            viewBox="0 0 24 24" 
            fill="currentColor"
          >
            <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142-.0852 4.783-2.7582a.7712.7712 0 0 0 .7806 0l5.8428 3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
          </svg>
        </div>
      </div>

      {/* API設定アイコン - 右下 */}
      <div 
        className="fixed bottom-8 right-8 z-50"
        onClick={() => setIsOpenAIConfigOpen(true)}
        title="API設定 (OpenAI & IEEE)"
      >
        <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-110">
          <svg 
            className="w-8 h-8 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      </div>

      {/* リサーチ確認モーダル */}
      <ResearchConfirmModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirmResearch}
        panelTitle={dragData?.panelTitle || ''}
        projectName={dragData?.projectName || ''}
      />

      {/* メモ帳モーダル */}
      <NotepadModal
        isOpen={isNotepadOpen}
        onClose={handleCloseNotepad}
        panelTitle={currentPanel}
        notes={panelNotes[currentPanel] || []}
        onAddNote={handleAddNote}
        onDeleteNote={handleDeleteNote}
      />

      {/* プロジェクト管理モーダル */}
      <ProjectManager
        isOpen={isProjectManagerOpen}
        onClose={handleCloseProjectManager}
        panelTitle={currentPanel}
      />

      {/* API設定モーダル */}
      <OpenAIConfigModal
        isOpen={isOpenAIConfigOpen}
        onClose={() => setIsOpenAIConfigOpen(false)}
        onSave={(config) => {
          console.log('API設定が保存されました:', config);
          
          // IEEE APIキーを更新
          if (config.ieee && config.ieee.apiKey) {
            // IEEEサービスに新しいAPIキーを設定
            ieeeService.updateApiKey(config.ieee.apiKey);
          }
          
          setIsOpenAIConfigOpen(false);
        }}
      />


    </div>
  );
}
