import React, { useState } from "react";

export default function NotepadModal({ isOpen, onClose, panelTitle, notes, onAddNote, onDeleteNote }) {
  const [newNote, setNewNote] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newNote.trim()) {
      onAddNote(newNote.trim());
      setNewNote("");
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900">
            📝 {panelTitle} - メモ帳
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* 新規メモ入力 */}
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="新しいメモを入力..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
            >
              追加
            </button>
          </div>
        </form>

        {/* メモ一覧 */}
        <div className="flex-1 overflow-y-auto">
          {notes.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              まだメモがありません
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-gray-50 rounded-lg p-3 border-l-4 border-blue-500"
                >
                  <div className="flex items-start justify-between">
                    <p className="text-gray-800 flex-1">{note.text}</p>
                    <button
                      onClick={() => onDeleteNote(note.id)}
                      className="text-red-500 hover:text-red-700 ml-2 text-sm"
                    >
                      削除
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDate(note.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 