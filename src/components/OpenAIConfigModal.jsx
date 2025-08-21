import React, { useState, useEffect } from 'react';

const OpenAIConfigModal = ({ isOpen, onClose, onSave }) => {
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [ieeeApiKey, setIeeeApiKey] = useState('');
  const [ieeeClientId, setIeeeClientId] = useState('');
  const [model, setModel] = useState('gpt-4');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [isValidating, setIsValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [activeTab, setActiveTab] = useState('openai'); // 'openai', 'ieee', 'google', 'bing', or 'info'
  
  // Google Custom Search API states
  const [googleSearchApiKey, setGoogleSearchApiKey] = useState('');
  const [googleSearchEngineId, setGoogleSearchEngineId] = useState('');
  
  // Bing Search API states
  const [bingSearchApiKey, setBingSearchApiKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      // OpenAI設定をローカルストレージから読み込み
      const savedOpenAIConfig = localStorage.getItem('openai_config');
      if (savedOpenAIConfig) {
        const config = JSON.parse(savedOpenAIConfig);
        setOpenaiApiKey(config.apiKey || '');
        setModel(config.model || 'gpt-4');
        setTemperature(config.temperature || 0.7);
        setMaxTokens(config.maxTokens || 2000);
      }

      // IEEE設定をローカルストレージから読み込み
      const savedIeeeConfig = localStorage.getItem('ieee_config');
      if (savedIeeeConfig) {
        const config = JSON.parse(savedIeeeConfig);
        setIeeeApiKey(config.apiKey || '');
        setIeeeClientId(config.clientId || '');
      }

      // Google Search設定をローカルストレージから読み込み
      const savedGoogleConfig = localStorage.getItem('google_search_config');
      if (savedGoogleConfig) {
        const config = JSON.parse(savedGoogleConfig);
        setGoogleSearchApiKey(config.apiKey || '');
        setGoogleSearchEngineId(config.engineId || '');
      }

      // Bing Search設定をローカルストレージから読み込み
      const savedBingConfig = localStorage.getItem('bing_search_config');
      if (savedBingConfig) {
        const config = JSON.parse(savedBingConfig);
        setBingSearchApiKey(config.apiKey || '');
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    // OpenAI設定を保存
    const openaiConfig = {
      apiKey: openaiApiKey,
      model,
      temperature: parseFloat(temperature),
      maxTokens: parseInt(maxTokens)
    };
    localStorage.setItem('openai_config', JSON.stringify(openaiConfig));

    // IEEE設定を保存
    const ieeeConfig = {
      apiKey: ieeeApiKey,
      clientId: ieeeClientId
    };
    localStorage.setItem('ieee_config', JSON.stringify(ieeeConfig));

    // Google Search設定を保存
    const googleConfig = {
      apiKey: googleSearchApiKey,
      engineId: googleSearchEngineId
    };
    localStorage.setItem('google_search_config', JSON.stringify(googleConfig));

    // Bing Search設定を保存
    const bingConfig = {
      apiKey: bingSearchApiKey
    };
    localStorage.setItem('bing_search_config', JSON.stringify(bingConfig));
    
    if (onSave) {
      onSave({ 
        openai: openaiConfig, 
        ieee: ieeeConfig, 
        google: googleConfig, 
        bing: bingConfig 
      });
    }
    
    onClose();
  };

  const validateOpenAIAPIKey = async () => {
    if (!openaiApiKey.trim()) {
      setValidationMessage('OpenAI APIキーを入力してください');
      return false;
    }

    setIsValidating(true);
    setValidationMessage('');

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setValidationMessage('✅ OpenAI APIキーが有効です');
        return true;
      } else {
        setValidationMessage('❌ OpenAI APIキーが無効です。正しいキーを入力してください');
        return false;
      }
    } catch {
      setValidationMessage('❌ OpenAI APIキーの検証中にエラーが発生しました');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const validateIEEEAPIKey = async () => {
    if (!ieeeApiKey.trim() && !ieeeClientId.trim()) {
      setValidationMessage('IEEE APIキーまたはクライアントIDを入力してください');
      return false;
    }

    setIsValidating(true);
    setValidationMessage('');

    try {
      // IEEE APIの簡単な検証（プロキシを使用）
      const testUrl = import.meta.env.DEV 
        ? '/ieee-api/rest/search'
        : 'https://ieeexplore.ieee.org/rest/search';
      
      const url = new URL(testUrl, import.meta.env.DEV ? window.location.origin : undefined);
      
      // APIキーがある場合はAPIキー認証、クライアントIDがある場合はOAuth認証
      if (ieeeApiKey.trim()) {
        url.searchParams.append('apikey', ieeeApiKey);
      }
      
      url.searchParams.append('queryText', 'test');
      url.searchParams.append('max_records', '1');
      
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      
      const response = await fetch(url.toString(), { headers });
      
      if (response.ok) {
        const data = await response.json();
        if (data && !data.error) {
          setValidationMessage('✅ IEEE API認証が有効です');
          return true;
        } else {
          setValidationMessage('❌ IEEE API認証が無効です。正しい認証情報を入力してください');
          return false;
        }
      } else {
        setValidationMessage('❌ IEEE API認証が無効です。正しい認証情報を入力してください');
        return false;
      }
    } catch (error) {
      console.error('IEEE API validation error:', error);
      setValidationMessage('❌ IEEE APIの検証中にエラーが発生しました（CORS制限の可能性があります）');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const validateGoogleSearchAPI = async () => {
    if (!googleSearchApiKey.trim() || !googleSearchEngineId.trim()) {
      setValidationMessage('Google Search APIキーとカスタム検索エンジンIDの両方を入力してください');
      return false;
    }

    setIsValidating(true);
    setValidationMessage('');

    try {
      const testUrl = `https://www.googleapis.com/customsearch/v1?key=${googleSearchApiKey}&cx=${googleSearchEngineId}&q=test&num=1`;
      
      const response = await fetch(testUrl);
      
      if (response.ok) {
        const data = await response.json();
        if (data && !data.error) {
          setValidationMessage('✅ Google Custom Search API認証が有効です');
          return true;
        } else {
          setValidationMessage('❌ Google Custom Search API認証が無効です。正しい認証情報を入力してください');
          return false;
        }
      } else {
        setValidationMessage('❌ Google Custom Search API認証が無効です。正しい認証情報を入力してください');
        return false;
      }
    } catch (error) {
      console.error('Google Search API validation error:', error);
      setValidationMessage('❌ Google Custom Search APIの検証中にエラーが発生しました');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const validateBingSearchAPI = async () => {
    if (!bingSearchApiKey.trim()) {
      setValidationMessage('Bing Search APIキーを入力してください');
      return false;
    }

    setIsValidating(true);
    setValidationMessage('');

    try {
      const testUrl = 'https://api.bing.microsoft.com/v7.0/search?q=test&count=1';
      
      const response = await fetch(testUrl, {
        headers: {
          'Ocp-Apim-Subscription-Key': bingSearchApiKey
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && !data.error) {
          setValidationMessage('✅ Bing Search API認証が有効です');
          return true;
        } else {
          setValidationMessage('❌ Bing Search API認証が無効です。正しいAPIキーを入力してください');
          return false;
        }
      } else {
        setValidationMessage('❌ Bing Search API認証が無効です。正しいAPIキーを入力してください');
        return false;
      }
    } catch (error) {
      console.error('Bing Search API validation error:', error);
      setValidationMessage('❌ Bing Search APIの検証中にエラーが発生しました（CORS制限の可能性があります）');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleTestConnection = async () => {
    if (activeTab === 'openai') {
      const isValid = await validateOpenAIAPIKey();
      if (isValid) {
        // 簡単なテストリクエストを送信
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: 'user',
                  content: 'Hello! This is a test message to verify the API connection.'
                }
              ],
              max_tokens: 50,
              temperature: 0.1
            })
          });

          if (response.ok) {
            setValidationMessage('✅ OpenAI API接続テストが成功しました');
          } else {
            setValidationMessage('❌ OpenAI API接続テストに失敗しました');
          }
        } catch {
          setValidationMessage('❌ OpenAI API接続テスト中にエラーが発生しました');
        }
      }
    } else if (activeTab === 'ieee') {
      await validateIEEEAPIKey();
    } else if (activeTab === 'google') {
      await validateGoogleSearchAPI();
    } else if (activeTab === 'bing') {
      await validateBingSearchAPI();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">API設定</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('openai')}
            className={`px-3 py-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'openai'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            OpenAI
          </button>
          <button
            onClick={() => setActiveTab('ieee')}
            className={`px-3 py-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'ieee'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            IEEE
          </button>
          <button
            onClick={() => setActiveTab('google')}
            className={`px-3 py-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'google'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Google Search
          </button>
          <button
            onClick={() => setActiveTab('bing')}
            className={`px-3 py-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'bing'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Bing Search
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`px-3 py-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'info'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            情報
          </button>
        </div>

        <div className="space-y-4">
          {/* OpenAI Settings */}
          {activeTab === 'openai' && (
            <>
              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  OpenAI API Key *
                </label>
                <input
                  type="password"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  OpenAIのダッシュボードから取得したAPIキーを入力してください
                </p>
              </div>

              {/* Model Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  モデル
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="gpt-4">GPT-4 (推奨)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>

              {/* Temperature */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  創造性 (Temperature): {temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>決定論的 (0.0)</span>
                  <span>創造的 (2.0)</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最大トークン数
                </label>
                <input
                  type="number"
                  min="100"
                  max="4000"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* IEEE Settings */}
          {activeTab === 'ieee' && (
            <>
              {/* IEEE API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IEEE API Key
                </label>
                <input
                  type="password"
                  value={ieeeApiKey}
                  onChange={(e) => setIeeeApiKey(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  IEEE API Portalから取得したAPIキーを入力してください（APIキー認証）
                </p>
              </div>

              {/* IEEE Client ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IEEE Client ID
                </label>
                <input
                  type="password"
                  value={ieeeClientId}
                  onChange={(e) => setIeeeClientId(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  IEEE API Portalから取得したクライアントIDを入力してください（OAuth認証）
                </p>
              </div>

              {/* IEEE API Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <h4 className="font-medium text-blue-800 mb-2">IEEE APIについて</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 参考論文検索機能で使用されます</li>
                  <li>• 設定しない場合はモックデータを使用します</li>
                  <li>• <a href="https://developer.ieee.org/" target="_blank" rel="noopener noreferrer" className="underline">IEEE API Portal</a>で申請できます</li>
                  <li>• APIキー認証またはOAuth認証のいずれかを使用できます</li>
                </ul>
              </div>

              {/* Callback URL Info */}
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <h4 className="font-medium text-green-800 mb-2">コールバックURL設定</h4>
                <p className="text-sm text-green-700 mb-2">
                  IEEE API Portalで以下のコールバックURLを設定してください：
                </p>
                <code className="text-xs bg-green-100 p-2 rounded block">
                  http://localhost:5173/callback
                </code>
              </div>

              {/* CORS Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <h4 className="font-medium text-yellow-800 mb-2">⚠️ 注意事項</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• IEEE APIはCORS制限があるため、ブラウザから直接アクセスできません</li>
                  <li>• 開発環境ではプロキシサーバーを使用しています</li>
                  <li>• 本番環境ではバックエンドサービスが必要です</li>
                  <li>• プロキシが動作しない場合はモックデータが使用されます</li>
                </ul>
              </div>
            </>
          )}

          {/* Google Search Settings */}
          {activeTab === 'google' && (
            <>
              {/* Google Search API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Google Custom Search API Key
                </label>
                <input
                  type="password"
                  value={googleSearchApiKey}
                  onChange={(e) => setGoogleSearchApiKey(e.target.value)}
                  placeholder="AIzaSyA..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Google Cloud Consoleから取得したCustom Search API Keyを入力してください
                </p>
              </div>

              {/* Google Search Engine ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  カスタム検索エンジンID
                </label>
                <input
                  type="text"
                  value={googleSearchEngineId}
                  onChange={(e) => setGoogleSearchEngineId(e.target.value)}
                  placeholder="例: 017576662512468239146:omuauf_lfve"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Google Programmable Search Engineで作成したSearch Engine IDを入力してください
                </p>
              </div>

              {/* Google Search API Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <h4 className="font-medium text-blue-800 mb-2">Google Custom Search APIについて</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Presentationフォルダでの外部情報検索に使用されます</li>
                  <li>• 設定しない場合は基本的なGoogle検索を使用します</li>
                  <li>• <a href="https://console.cloud.google.com/apis/api/customsearch.googleapis.com" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a>でAPIを有効化してください</li>
                  <li>• <a href="https://programmablesearchengine.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Programmable Search Engine</a>でカスタム検索エンジンを作成してください</li>
                </ul>
              </div>

              {/* Quota Info */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <h4 className="font-medium text-yellow-800 mb-2">⚠️ 注意事項</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Google Custom Search APIは無料で1日100回まで使用可能です</li>
                  <li>• それ以上の使用には課金が必要です</li>
                  <li>• Webクローリングには十分注意してください</li>
                </ul>
              </div>
            </>
          )}

          {/* Bing Search Settings */}
          {activeTab === 'bing' && (
            <>
              {/* Bing Search API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bing Search API Key
                </label>
                <input
                  type="password"
                  value={bingSearchApiKey}
                  onChange={(e) => setBingSearchApiKey(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Microsoft Azure Cognitive ServicesのBing Search API Keyを入力してください
                </p>
              </div>

              {/* Bing Search API Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <h4 className="font-medium text-blue-800 mb-2">Bing Search APIについて</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Presentationフォルダでの外部情報検索に使用されます</li>
                  <li>• 設定しない場合は基本的なWeb検索を使用します</li>
                  <li>• <a href="https://azure.microsoft.com/services/cognitive-services/bing-web-search-api/" target="_blank" rel="noopener noreferrer" className="underline">Microsoft Azure</a>で申請できます</li>
                  <li>• Googleより高精度な検索結果を提供することがあります</li>
                </ul>
              </div>

              {/* Pricing Info */}
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <h4 className="font-medium text-green-800 mb-2">料金について</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• 無料枠: 月1000回まで無料</li>
                  <li>• 有料プラン: 1000回あたり数ドル程度</li>
                  <li>• 詳細は<a href="https://azure.microsoft.com/pricing/details/cognitive-services/search-api/" target="_blank" rel="noopener noreferrer" className="underline">Azure価格表</a>を参照</li>
                </ul>
              </div>

              {/* CORS Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <h4 className="font-medium text-yellow-800 mb-2">⚠️ 注意事項</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Bing Search APIはCORS制限があります</li>
                  <li>• ブラウザから直接アクセスできない場合があります</li>
                  <li>• 本番環境ではプロキシサーバーの設定が推奨されます</li>
                </ul>
              </div>
            </>
          )}

          {/* Information Tab */}
          {activeTab === 'info' && (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                <h4 className="font-medium text-gray-800 mb-3">🔧 API設定について</h4>
                <div className="space-y-4 text-sm text-gray-700">
                  
                  <div>
                    <h5 className="font-medium text-gray-800 mb-2">必須API</h5>
                    <ul className="space-y-1 ml-4">
                      <li>• <strong>OpenAI API</strong>: AI処理の中核（必須）</li>
                      <li>• <strong>Google Drive API</strong>: プロジェクト管理（必須）</li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-medium text-gray-800 mb-2">オプショナルAPI</h5>
                    <ul className="space-y-1 ml-4">
                      <li>• <strong>IEEE Xplore API</strong>: 技術論文検索</li>
                      <li>• <strong>Semantic Scholar API</strong>: AI/ML論文検索（APIキー不要）</li>
                      <li>• <strong>Google Custom Search</strong>: 外部情報検索</li>
                      <li>• <strong>Bing Search API</strong>: 代替検索エンジン</li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-medium text-gray-800 mb-2">フォールバック機能</h5>
                    <p className="mb-2">各APIが利用できない場合の代替機能：</p>
                    <ul className="space-y-1 ml-4">
                      <li>• IEEE → Semantic Scholar → モックデータ</li>
                      <li>• Google Search → Bing Search → 基本検索</li>
                      <li>• すべてのAPIでデモ/モックデータが利用可能</li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-medium text-gray-800 mb-2">設定保存場所</h5>
                    <p className="mb-2">すべての設定はブラウザのローカルストレージに安全に保存されます。</p>
                    <p className="text-xs text-gray-500">設定はブラウザごとに個別に保存され、サーバーには送信されません。</p>
                  </div>

                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 className="font-medium text-blue-800 mb-3">🚀 推奨設定手順</h4>
                <ol className="text-sm text-blue-700 space-y-2">
                  <li><strong>1.</strong> OpenAI APIキーを設定（必須）</li>
                  <li><strong>2.</strong> IEEE Xplore APIキーを設定（論文検索用）</li>
                  <li><strong>3.</strong> Google Custom Search APIを設定（外部情報検索用）</li>
                  <li><strong>4.</strong> 必要に応じてBing Search APIを設定</li>
                  <li><strong>5.</strong> 各APIの接続テストを実行</li>
                </ol>
              </div>
            </>
          )}

          {/* Validation Message */}
          {validationMessage && (
            <div className={`p-3 rounded-md text-sm ${
              validationMessage.includes('✅') 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {validationMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            {activeTab !== 'info' && (
              <button
                onClick={handleTestConnection}
                disabled={
                  isValidating || 
                  (activeTab === 'openai' && !openaiApiKey.trim()) || 
                  (activeTab === 'ieee' && !ieeeApiKey.trim() && !ieeeClientId.trim()) ||
                  (activeTab === 'google' && (!googleSearchApiKey.trim() || !googleSearchEngineId.trim())) ||
                  (activeTab === 'bing' && !bingSearchApiKey.trim())
                }
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isValidating ? '検証中...' : '接続テスト'}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!openaiApiKey.trim()}
              className={`${activeTab === 'info' ? 'w-full' : 'flex-1'} px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              保存
            </button>
          </div>

          {/* Help Text */}
          {activeTab !== 'info' && (
            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-md">
              {activeTab === 'openai' && (
                <>
                  <p className="font-medium mb-1">OpenAI設定について:</p>
                  <ul className="space-y-1">
                    <li>• <strong>API Key</strong>: OpenAIのダッシュボードで取得</li>
                    <li>• <strong>モデル</strong>: GPT-4が最も高品質な結果を提供</li>
                    <li>• <strong>創造性</strong>: 低いほど一貫性、高いほど独創性</li>
                    <li>• <strong>最大トークン</strong>: 応答の最大長（料金に影響）</li>
                  </ul>
                </>
              )}
              
              {activeTab === 'ieee' && (
                <>
                  <p className="font-medium mb-1">IEEE設定について:</p>
                  <ul className="space-y-1">
                    <li>• <strong>API Key</strong>: IEEE API Portalで申請・取得（APIキー認証）</li>
                    <li>• <strong>Client ID</strong>: IEEE API Portalで申請・取得（OAuth認証）</li>
                    <li>• <strong>用途</strong>: 参考論文検索機能で使用</li>
                    <li>• <strong>オプション</strong>: 設定しない場合はモックデータを使用</li>
                    <li>• <strong>申請</strong>: <a href="https://developer.ieee.org/" target="_blank" rel="noopener noreferrer" className="underline">IEEE API Portal</a>で申請</li>
                  </ul>
                </>
              )}
              
              {activeTab === 'google' && (
                <>
                  <p className="font-medium mb-1">Google Custom Search設定について:</p>
                  <ul className="space-y-1">
                    <li>• <strong>API Key</strong>: Google Cloud Consoleで取得</li>
                    <li>• <strong>Engine ID</strong>: Programmable Search Engineで取得</li>
                    <li>• <strong>用途</strong>: Presentationフォルダでの外部検索</li>
                    <li>• <strong>制限</strong>: 無料で1日100回まで</li>
                    <li>• <strong>設定</strong>: <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a>で設定</li>
                  </ul>
                </>
              )}
              
              {activeTab === 'bing' && (
                <>
                  <p className="font-medium mb-1">Bing Search設定について:</p>
                  <ul className="space-y-1">
                    <li>• <strong>API Key</strong>: Microsoft Azureで取得</li>
                    <li>• <strong>用途</strong>: Presentationフォルダでの外部検索</li>
                    <li>• <strong>制限</strong>: 無料で月1000回まで</li>
                    <li>• <strong>品質</strong>: 高精度な検索結果を提供</li>
                    <li>• <strong>申請</strong>: <a href="https://azure.microsoft.com/" target="_blank" rel="noopener noreferrer" className="underline">Microsoft Azure</a>で申請</li>
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OpenAIConfigModal;
