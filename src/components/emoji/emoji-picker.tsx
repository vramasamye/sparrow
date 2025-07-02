'use client'

import React from 'react';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose?: () => void; // Optional: if the picker itself needs to trigger a close
}

// A very basic list of emojis for demonstration
const commonEmojis = [
  '👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '🔥', '💯',
  '👏', '😊', '🤔', '👀', '✨', '🚀', '💡', '✅',
];

export function EmojiPicker({ onEmojiSelect, onClose }: EmojiPickerProps) {
  const handleSelect = (emoji: string) => {
    onEmojiSelect(emoji);
    if (onClose) {
      onClose();
    }
  };

  return (
    <div
      className="absolute z-20 mt-1 w-auto max-w-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl p-2"
      // Positioning will be handled by the parent component relative to the trigger button
    >
      <div className="grid grid-cols-6 gap-1">
        {commonEmojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleSelect(emoji)}
            className="p-1.5 text-xl rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
            title={emoji} // Simple title, could be more descriptive
          >
            {emoji}
          </button>
        ))}
      </div>
      {/* Future: Categories, Search, Recently Used */}
    </div>
  );
}
