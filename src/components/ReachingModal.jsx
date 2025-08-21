import React, { useState, useEffect } from 'react';
import reachingService from '../services/reachingService';

const ReachingModal = ({ isOpen, onClose, panelTitle }) => {
  const [activeTab, setActiveTab] = useState('events');
  const [searchParams, setSearchParams] = useState({
    keywords: [],
    eventType: 'all',
    orgType: 'all',
    year: new Date().getFullYear(),
    location: '',
    category: ''
  });
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savedResults, setSavedResults] = useState([]);
  const [keywordInput, setKeywordInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSavedResults();
    }
  }, [isOpen]);

  const loadSavedResults = () => {
    const history = reachingService.getSearchHistory();
    setSavedResults(history);
  };

  const handleSearch = async () => {
    if (!searchParams.keywords.length) {
      alert('キーワードを入力してください');
      return;
    }

    setIsLoading(true);
    try {
      let results;
      if (activeTab === 'events') {
        results = await reachingService.searchEvents(searchParams);
      } else {
        results = await reachingService.searchOrganizations(searchParams);
      }
      setSearchResults(results);
    } catch (error) {
      console.error('検索エラー:', error);
      alert('検索中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveResults = () => {
    if (searchResults.length === 0) {
      alert('保存する結果がありません');
      return;
    }

    const category = prompt('カテゴリ名を入力してください（例：AI研究関連）:');
    if (category) {
      reachingService.addToSavedResults(searchResults, category);
      loadSavedResults();
      alert('検索結果を保存しました');
    }
  };

  const handleExportResults = () => {
    if (searchResults.length === 0) {
      alert('エクスポートする結果がありません');
      return;
    }

    const filename = prompt('ファイル名を入力してください（拡張子不要）:', 'reaching_results');
    if (filename) {
      reachingService.exportToExcel(searchResults, filename);
    }
  };

  const handleRemoveSavedResult = (id) => {
    if (confirm('この保存結果を削除しますか？')) {
      reachingService.removeSavedResult(id);
      loadSavedResults();
    }
  };

  const addKeyword = () => {
    if (keywordInput.trim()) {
      setSearchParams(prev => ({
        ...prev,
        keywords: [...prev.keywords, keywordInput.trim()]
      }));
      setKeywordInput('');
    }
  };

  const removeKeyword = (index) => {
    setSearchParams(prev => ({
      ...prev,
      keywords: prev.keywords.filter((_, i) => i !== index)
    }));
  };

  const getTypeLabel = (type) => {
    const typeLabels = {
      'conference': '会議',
      'exhibition': '展示会',
      'workshop': 'ワークショップ',
      'research': '研究機関',
      'company': '企業',
      'government': '政府機関',
      'university': '大学'
    };
    return typeLabels[type] || type;
  };

  const getRelevanceColor = (relevance) => {
    const colors = {
      'high': 'bg-green-100 text-green-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'low': 'bg-gray-100 text-gray-800'
    };
    return colors[relevance] || colors.low;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[1200px] h-[800px] flex flex-col">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            Reaching - {panelTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>

        {/* タブ */}
        <div className="flex border-b mb-4">
          <button
            className={`px-4 py-2 ${activeTab === 'events' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('events')}
          >
            イベント検索
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'organizations' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('organizations')}
          >
            機関検索
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'history' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('history')}
          >
            検索履歴
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {/* 検索フォーム */}
          {activeTab !== 'history' && (
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-2 gap-4">
                {/* キーワード入力 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    キーワード
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                      placeholder="キーワードを入力"
                      className="flex-1 border border-gray-300 rounded-l px-3 py-2"
                    />
                    <button
                      onClick={addKeyword}
                      className="bg-blue-500 text-white px-4 py-2 rounded-r hover:bg-blue-600"
                    >
                      追加
                    </button>
                  </div>
                  {searchParams.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {searchParams.keywords.map((keyword, index) => (
                        <span
                          key={index}
                          className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm flex items-center"
                        >
                          {keyword}
                          <button
                            onClick={() => removeKeyword(index)}
                            className="ml-1 text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* タイプ選択 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    タイプ
                  </label>
                  <select
                    value={activeTab === 'events' ? searchParams.eventType : searchParams.orgType}
                    onChange={(e) => setSearchParams(prev => ({
                      ...prev,
                      [activeTab === 'events' ? 'eventType' : 'orgType']: e.target.value
                    }))}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="all">すべて</option>
                    {activeTab === 'events' ? (
                      <>
                        <option value="conference">会議</option>
                        <option value="exhibition">展示会</option>
                        <option value="workshop">ワークショップ</option>
                      </>
                    ) : (
                      <>
                        <option value="research">研究機関</option>
                        <option value="company">企業</option>
                        <option value="government">政府機関</option>
                        <option value="university">大学</option>
                      </>
                    )}
                  </select>
                </div>

                {/* 年 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    年
                  </label>
                  <input
                    type="number"
                    value={searchParams.year}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, year: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>

                {/* 場所 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    場所
                  </label>
                  <input
                    type="text"
                    value={searchParams.location}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="例：Tokyo, Japan"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleSearch}
                  disabled={isLoading}
                  className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                  {isLoading ? '検索中...' : '検索'}
                </button>
                <button
                  onClick={handleSaveResults}
                  className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
                >
                  結果を保存
                </button>
                <button
                  onClick={handleExportResults}
                  className="bg-purple-500 text-white px-6 py-2 rounded hover:bg-purple-600"
                >
                  Excel出力
                </button>
              </div>
            </div>
          )}

          {/* 検索結果 */}
          {activeTab !== 'history' && searchResults.length > 0 && (
            <div className="flex-1 overflow-y-auto">
              <h3 className="text-lg font-semibold mb-3">検索結果 ({searchResults.length}件)</h3>
              <div className="space-y-4">
                {searchResults.map((result) => (
                  <div key={result.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-lg font-medium text-blue-600">
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {result.name}
                        </a>
                      </h4>
                      <div className="flex gap-2">
                        <span className={`px-2 py-1 rounded text-xs ${getRelevanceColor(result.relevance)}`}>
                          {result.relevance === 'high' ? '高関連' : result.relevance === 'medium' ? '中関連' : '低関連'}
                        </span>
                        <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">
                          {getTypeLabel(result.type)}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-600 mb-2">{result.description}</p>
                    <div className="flex gap-4 text-sm text-gray-500">
                      <span>カテゴリ: {result.category}</span>
                      <span>場所: {result.location}</span>
                      {result.date && <span>日付: {result.date}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 検索履歴 */}
          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">検索履歴</h3>
                <button
                  onClick={() => {
                    if (confirm('すべての検索履歴を削除しますか？')) {
                      reachingService.clearSearchHistory();
                      loadSavedResults();
                    }
                  }}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  履歴をクリア
                </button>
              </div>
              {savedResults.length === 0 ? (
                <p className="text-gray-500 text-center py-8">検索履歴がありません</p>
              ) : (
                <div className="space-y-4">
                  {savedResults.map((saved) => (
                    <div key={saved.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium">{saved.category}</h4>
                          <p className="text-sm text-gray-500">
                            {new Date(saved.timestamp).toLocaleString('ja-JP')}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveSavedResult(saved.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          削除
                        </button>
                      </div>
                      <div className="space-y-2">
                        {saved.results.slice(0, 3).map((result) => (
                          <div key={result.id} className="text-sm">
                            <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {result.name}
                            </a>
                          </div>
                        ))}
                        {saved.results.length > 3 && (
                          <p className="text-sm text-gray-500">
                            他 {saved.results.length - 3} 件...
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReachingModal;

