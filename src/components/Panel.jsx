import React, { useState, useEffect } from "react";
import googleDriveService from "../services/googleDrive";

export default function Panel({ title, bgColor, widthClass, heightClass, notes, onOpenNotepad, onOpenProjectManager }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isNotepadButtonHovered, setIsNotepadButtonHovered] = useState(false);
  const [isProjectManagerButtonHovered, setIsProjectManagerButtonHovered] = useState(false);

  const [projects, setProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // プロジェクト一覧を取得
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setIsLoadingProjects(true);
        const projectList = await googleDriveService.getProjects(title);
        setProjects(projectList);
      } catch (error) {
        console.error('Failed to load projects:', error);
        // エラーの場合は空の配列を設定
        setProjects([]);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    // ホバー時にプロジェクト一覧を取得
    if (isHovered) {
      loadProjects();
    }
  }, [isHovered, title]);

  const handleDragStart = (e, item) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      panelTitle: title,
      projectName: item.name || item
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-start ${widthClass} ${heightClass} rounded-2xl shadow-md transition-all duration-300 hover:scale-110 ${bgColor} p-6`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-between w-full mb-2">
        <span className="text-4xl font-semibold text-gray-700">{title}</span>
        
        {/* ボタン群 */}
        <div className="flex gap-2">
          {/* プロジェクト管理ボタン */}
          <div className="relative">
            <button
              onClick={() => onOpenProjectManager(title)}
              onMouseEnter={() => setIsProjectManagerButtonHovered(true)}
              onMouseLeave={() => setIsProjectManagerButtonHovered(false)}
              className="w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 text-gray-600 hover:text-gray-800"
              title="プロジェクト管理"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
            </button>

            {/* ホバー時のプロジェクト管理プレビューパネル */}
            {isProjectManagerButtonHovered && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                <div className="p-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 border-b border-gray-200 pb-1">
                    📁 プロジェクト管理
                  </h4>
                  <p className="text-xs text-gray-600">
                    Google Driveでプロジェクトを作成・管理できます
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* メモ帳ボタン */}
          <div className="relative">
            <button
              onClick={() => onOpenNotepad(title)}
              onMouseEnter={() => setIsNotepadButtonHovered(true)}
              onMouseLeave={() => setIsNotepadButtonHovered(false)}
              className="w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 text-gray-600 hover:text-gray-800"
              title="メモ帳を開く"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* ホバー時のメモ帳プレビューパネル */}
            {isNotepadButtonHovered && notes && notes.length > 0 && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                <div className="p-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 border-b border-gray-200 pb-1">
                    📝 メモ一覧
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {notes.slice(0, 5).map((note) => (
                      <div
                        key={note.id}
                        className="bg-gray-50 rounded p-2 border-l-3 border-blue-400"
                      >
                        <p className="text-xs text-gray-800 line-clamp-2">{note.text}</p>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDate(note.timestamp)}
                        </div>
                      </div>
                    ))}
                    {notes.length > 5 && (
                      <div className="text-xs text-gray-500 text-center py-1">
                        他 {notes.length - 5} 件のメモがあります
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* ホバー時に表示される文字リスト（パネル内） */}
      {isHovered && (
        <div className="w-full mt-4 bg-white/90 backdrop-blur-sm rounded-lg border border-white/50">
          <div className="p-3">
            <h3 className="text-sm font-medium text-gray-700 mb-2 border-b border-gray-200 pb-1">
              プロジェクト一覧
            </h3>
            {isLoadingProjects ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-xs text-gray-500 mt-2">読み込み中...</p>
              </div>
            ) : projects.length > 0 ? (
              <ul className="space-y-1">
                {projects.map((project, index) => (
                  <li 
                    key={project.id || index}
                    draggable
                    onDragStart={(e) => handleDragStart(e, project)}
                    className="text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 px-2 py-1 rounded cursor-grab active:cursor-grabbing transition-colors duration-150"
                  >
                    {project.name}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-gray-500">プロジェクトがありません</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 中身を入れたいときはここに置く */}
    </div>
  );
}
