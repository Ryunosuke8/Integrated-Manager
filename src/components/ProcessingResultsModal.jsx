import React, { useState, useEffect } from 'react';
import { PROJECT_FOLDER_STRUCTURE } from '../config/googleDriveConfig';

const ProcessingResultsModal = ({ isOpen, onClose, results, projectName }) => {
  const [activeTab, setActiveTab] = useState(0);

  // モーダルが開かれるたびに状態をリセット
  useEffect(() => {
    if (isOpen) {
      setActiveTab(0); // 最初のタブにリセット
    }
  }, [isOpen, results]); // resultsが変更された時もリセット

  // モーダルが閉じられる際の状態クリーンアップ
  const handleClose = () => {
    setActiveTab(0); // タブ状態をリセット
    onClose(); // 親コンポーネントのonCloseを呼び出し
  };

  if (!isOpen || !results) return null;

  const processedFolders = results.processedFolders || [];
  const generatedContent = results.generatedContent || {};

  // アクティブタブが範囲外の場合は0にリセット
  const safeActiveTab = activeTab >= processedFolders.length ? 0 : activeTab;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-5/6 h-5/6 overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">🤖 AI処理結果</h2>
            <p className="text-gray-600 mt-1">{projectName}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              処理完了: {results.summary?.successCount || 0}フォルダ / エラー: {results.summary?.errorCount || 0}件
            </div>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {processedFolders.map((folderName, index) => {
            const folderConfig = PROJECT_FOLDER_STRUCTURE.find(f => f.name === folderName);
            return (
              <button
                key={folderName}
                onClick={() => setActiveTab(index)}
                className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
                  safeActiveTab === index
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <span className="text-lg">{folderConfig?.icon || '📁'}</span>
                {folderName}
              </button>
            );
          })}
        </div>

        {/* タブコンテンツ */}
        <div className="flex-1 overflow-hidden">
          {processedFolders.map((folderName, index) => (
            <div
              key={folderName}
              className={`h-full overflow-y-auto p-6 ${
                safeActiveTab === index ? 'block' : 'hidden'
              }`}
            >
              <ProcessingResultContent
                folderName={folderName}
                result={generatedContent[folderName]}
              />
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            処理時刻: {new Date().toLocaleString('ja-JP')}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.open('https://drive.google.com', '_blank')}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Google Driveで確認
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProcessingResultContent = ({ folderName, result }) => {
  const folderConfig = PROJECT_FOLDER_STRUCTURE.find(f => f.name === folderName);

  if (!result) {
    return (
      <div className="text-center py-8 text-gray-500">
        処理結果がありません
      </div>
    );
  }

  // エラーの場合
  if (result.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
          ❌ 処理エラー
        </div>
        <p className="text-red-700">{result.error}</p>
      </div>
    );
  }

  // 簡単なメッセージの場合
  if (result.message) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
          ✅ 処理完了
        </div>
        <p className="text-green-700">{result.message}</p>
        {folderConfig?.aiProcessing && (
          <div className="mt-4">
            <h4 className="font-medium text-gray-700 mb-2">実行されたAI処理:</h4>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              {folderConfig.aiProcessing.map((process, index) => (
                <li key={index}>{process}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // 詳細な結果がある場合
  return (
    <div className="space-y-6">
      {/* フォルダの説明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
          <span className="text-xl">{folderConfig?.icon || '📁'}</span>
          {folderName} フォルダ
        </h3>
        <p className="text-blue-700 text-sm">{folderConfig?.description}</p>
      </div>

      {/* 生成されたファイル */}
      {result.generatedFiles && result.generatedFiles.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
            📄 生成されたファイル
          </h4>
          <div className="space-y-2">
            {result.generatedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium">{file.name}</span>
                <button
                  onClick={() => window.open(file.webViewLink, '_blank')}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  開く →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* フォルダ固有の結果表示 */}
      {folderName === 'Document' && renderDocumentResults(result)}
      {folderName === 'Implementation' && renderImplementationResults(result)}
      {folderName === 'Presentation' && renderPresentationResults(result)}
      
      {/* AI処理の詳細 */}
      {folderConfig?.aiProcessing && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-800 mb-3">🤖 実行されたAI処理</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {folderConfig.aiProcessing.map((process, index) => (
              <div key={index} className="bg-white p-3 rounded border">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm font-medium">{process}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// フォルダ固有の結果表示関数
const renderDocumentResults = (result) => (
  <div className="space-y-4">
    {result.summary && (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">📝 ドキュメント要約</h4>
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{result.summary}</pre>
        </div>
      </div>
    )}
    {result.outline && (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">📋 アウトライン</h4>
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{result.outline}</pre>
        </div>
      </div>
    )}
    {result.duplicateAnalysis && (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">🔍 重複分析</h4>
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{result.duplicateAnalysis}</pre>
        </div>
      </div>
    )}
    {result.paperTopicSuggestion && (
      <div className="bg-white border border-green-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">🎓 論文トピック提案</h4>
        <div className="bg-green-50 border border-green-200 rounded p-3 mb-3">
          <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
            ✅ Paper Topic Suggestionフォルダに生成完了
          </div>
          <p className="text-green-700 text-sm">
            Mainドキュメントの内容を分析し、学術的な研究テーマとして発展可能な論文トピックを提案しました。
          </p>
        </div>
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{result.paperTopicSuggestion}</pre>
        </div>
      </div>
    )}
    {result.paperGeneration && (
      <div className="bg-white border border-red-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">📄 論文生成</h4>
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
          <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
            ✅ Paperフォルダに論文生成完了
          </div>
          <p className="text-red-700 text-sm">
            Document/ForAcaとAcademiaフォルダの内容を基に、LaTeX形式の論文とPDFを生成しました。
          </p>
        </div>
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{result.paperGeneration}</pre>
        </div>
      </div>
    )}
  </div>
);

const renderImplementationResults = (result) => (
  <div className="space-y-4">
    {result.changeLog && (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">📈 変更履歴</h4>
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{result.changeLog}</pre>
        </div>
      </div>
    )}
    {result.specification && (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">📋 仕様書</h4>
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{result.specification}</pre>
        </div>
      </div>
    )}
    {result.architecture && (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">🏗️ アーキテクチャ</h4>
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{result.architecture}</pre>
        </div>
      </div>
    )}
  </div>
);

const renderPresentationResults = (result) => (
  <div className="space-y-4">
    {result.slideDraft && (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">🎯 スライド草案</h4>
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{result.slideDraft}</pre>
        </div>
      </div>
    )}
    {result.charts && result.charts.length > 0 && (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">📊 生成された図表</h4>
        <div className="flex flex-wrap gap-2">
          {result.charts.map((chart, index) => (
            <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              {chart}
            </span>
          ))}
        </div>
      </div>
    )}
    {result.externalResearch && (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">🌐 外部調査結果</h4>
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{result.externalResearch}</pre>
        </div>
      </div>
    )}
  </div>
);

export default ProcessingResultsModal;

