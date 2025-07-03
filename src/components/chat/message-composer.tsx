'use client'

import { useState, useRef, useEffect } from 'react'
import { EmojiPicker } from '../emoji/emoji-picker'; // Corrected: Import EmojiPicker at the top
import { useSession } from 'next-auth/react'
import { useSocket } from '@/hooks/useSocket'

interface WorkspaceMember {
  user: {
    id: string
    username: string
    name?: string
  }
  // other member props like role if needed
}

interface MessageComposerProps {
  onSendMessage: (content: string, attachmentIds: string[]) => void // Updated signature
  placeholder?: string
  channelId?: string // For channel-based typing indicators
  workspaceId?: string // For file uploads scoped to workspace
  workspaceMembers?: WorkspaceMember[]
  // Generic typing handlers for DM or other contexts
  onStartTyping?: () => void
  onStopTyping?: () => void
}

export function MessageComposer({
  onSendMessage,
  placeholder = "Type a message...",
  channelId,
  workspaceId, // Added workspaceId
  workspaceMembers = [],
  onStartTyping,
  onStopTyping
}: MessageComposerProps) {
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false) // Local state to manage timeout
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  const { data: session } = useSession()
  // Socket methods for channel typing are still here, but will only be called if channelId is present
  const { startTyping: startChannelTyping, stopTyping: stopChannelTyping } = useSocket()

  // For @mention suggestions
  const [mentionQuery, setMentionQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0 })
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerButtonRef = useRef<HTMLButtonElement>(null);

  // State for file attachments
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadedAttachmentIds, setUploadedAttachmentIds] = useState<string[]>([]);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({}); // filename -> error message
  const fileInputRef = useRef<HTMLInputElement>(null);


  const filteredMembers = mentionQuery
    ? workspaceMembers.filter(member =>
        member.user.username.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        (member.user.name && member.user.name.toLowerCase().includes(mentionQuery.toLowerCase()))
      ).slice(0, 5) // Limit suggestions
    : []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Message must have content OR attachments
    if (message.trim() || uploadedAttachmentIds.length > 0) {
      // Pass message content and attachmentIds to parent
      // The onSendMessage prop needs to be updated to accept an object
      // onSendMessage({ content: message.trim(), attachmentIds: uploadedAttachmentIds });

      // For now, assuming onSendMessage is only for text content.
      // The actual linking of attachmentIds to message happens on backend when message is created.
      // So, the main onSendMessage in parent (MessageArea/DirectMessageArea) needs to be updated
      // to include these attachmentIds when it calls the API or socket.
      // This is a significant change to onSendMessage signature.
      // Let's assume for now the parent will grab uploadedAttachmentIds from this component
      // or this component passes it as a second argument or part of an object.
      // For simplicity, I'll adjust onSendMessage to accept an object.
      onSendMessage(message.trim(), uploadedAttachmentIds); // Correctly passing both


      setMessage('')
      setPendingFiles([]);
      setUploadedAttachmentIds([]);
      setUploadProgress({});
      setShowSuggestions(false)
      handleStopTyping()
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      // TODO: Filter for size/type on client-side too for better UX, before attempting upload
      setPendingFiles(prev => [...prev, ...files]); // Add to pending list
      files.forEach(file => handleFileUpload(file));
      if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!workspaceId || !session) {
      console.error("Workspace ID or session not available for file upload.");
      // TODO: Show error to user
      setPendingFiles(prev => prev.filter(f => f !== file)); // Remove if cannot upload
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

    try {
      const token = localStorage.getItem('token') || session.accessToken;
      // Using XMLHttpRequest for progress, but fetch can also be used with ReadableStream for progress
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/workspaces/${workspaceId}/files/upload`, true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(prev => ({ ...prev, [file.name]: percentComplete }));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 201) {
          const response = JSON.parse(xhr.responseText);
          setUploadedAttachmentIds(prev => [...prev, response.attachment.id]);
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        } else {
          const errorMsg = JSON.parse(xhr.responseText)?.error || `Upload failed (${xhr.status})`;
          console.error(`Upload failed for ${file.name}: ${xhr.statusText}`, xhr.responseText);
          setUploadErrors(prev => ({ ...prev, [file.name]: errorMsg }));
          setUploadProgress(prev => { // Keep progress to show it alongside error, or clear it
            const newProgress = { ...prev };
             // delete newProgress[file.name]; // Option: clear progress on error
            return newProgress;
          });
          // Do not remove from pendingFiles here, let user see the error and remove manually
        }
      };

      xhr.onerror = () => {
        const errorMsg = "Network error during upload.";
        console.error(`Upload error for ${file.name}`);
        setUploadErrors(prev => ({ ...prev, [file.name]: errorMsg }));
        setUploadProgress(prev => {
            const newProgress = { ...prev };
            // delete newProgress[file.name];
            return newProgress;
          });
      };

      xhr.send(formData);

    } catch (error) {
      const errorMsg = "Exception during upload setup.";
      console.error(`Exception during upload for ${file.name}:`, error);
      setUploadErrors(prev => ({ ...prev, [file.name]: errorMsg }));
       setUploadProgress(prev => {
            const newProgress = { ...prev };
            // delete newProgress[file.name];
            return newProgress;
        });
    }
  };

  const handleRemovePendingFile = (fileNameToRemove: string) => {
    // Find the actual file object to potentially cancel its XHR if needed (complex, skip for now)
    const fileToRemove = pendingFiles.find(f => f.name === fileNameToRemove);

    setPendingFiles(prev => prev.filter(f => f.name !== fileNameToRemove));
    // If file was successfully uploaded, its ID should be removed from uploadedAttachmentIds
    // This requires mapping filename to attachment ID post-upload, or storing more info in pendingFiles state.
    // For now, this simple removal from pendingFiles means successfully uploaded files before message send
    // cannot be "removed" from the composer by this button after upload success, only from the pending visual list.
    // This is a UX point to improve: allow removal of successfully (pre-send) uploaded files.

    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileNameToRemove];
      return newProgress;
    });
    setUploadErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[fileNameToRemove];
        return newErrors;
    });
     // TODO: If upload is in progress, find its XHR and call xhr.abort()
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setMessage(text)
    handleTyping()

    const cursorPos = e.target.selectionStart
    const textBeforeCursor = text.substring(0, cursorPos)
    const atMatch = textBeforeCursor.match(/@([\w.-]*)$/)

    if (atMatch) {
      const query = atMatch[1]
      setMentionQuery(query)
      setShowSuggestions(true)
      setActiveSuggestionIndex(0)

      // Calculate position for suggestions dropdown
      // This is a simplified positioning, might need a library for robustness
      const rect = e.target.getBoundingClientRect()
      // Attempt to get cursor position, needs more advanced handling for precise x,y
      // For now, position below the textarea input.
      setSuggestionPosition({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX })

    } else {
      setShowSuggestions(false)
      setMentionQuery('')
    }
  }

  const handleSelectMention = (username: string) => {
    const cursorPos = textareaRef.current?.selectionStart ?? message.length
    const textBeforeCursor = message.substring(0, cursorPos)
    const atMatch = textBeforeCursor.match(/@([\w.-]*)$/)

    if (atMatch) {
      const queryLength = atMatch[1].length
      const startOfMention = cursorPos - queryLength -1 // -1 for '@'
      const newMessage =
        message.substring(0, startOfMention) +
        `@${username} ` +
        message.substring(cursorPos)
      setMessage(newMessage)
      setShowSuggestions(false)
      setMentionQuery('')
      textareaRef.current?.focus()
    }
  }


  const handleTyping = () => {
    if (!isTyping && session?.user) {
      setIsTyping(true)
      if (onStartTyping) {
        onStartTyping()
      } else if (channelId) { // Fallback to channel typing if no specific handler
        startChannelTyping(channelId) // Note: startChannelTyping might need more params if you updated its signature
      }
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping()
    }, 1000)
  }

  const handleStopTyping = () => {
    if (isTyping && session?.user) {
      setIsTyping(false)
      if (onStopTyping) {
        onStopTyping()
      } else if (channelId) { // Fallback to channel typing
        stopChannelTyping(channelId) // Note: stopChannelTyping might need more params if you updated its signature
      }
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveSuggestionIndex(prev => (prev + 1) % filteredMembers.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveSuggestionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (!e.shiftKey) { // Allow Shift+Enter for newline
          e.preventDefault()
          handleSelectMention(filteredMembers[activeSuggestionIndex].user.username)
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false)
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [message])

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      setMessage(text.substring(0, start) + emoji + text.substring(end));
      // Focus and set cursor position after emoji
      textarea.focus();
      setTimeout(() => textarea.setSelectionRange(start + emoji.length, start + emoji.length), 0);
    }
    setShowEmojiPicker(false);
  };

  // Click outside for emoji picker (similar to mention suggestions)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerButtonRef.current && emojiPickerButtonRef.current.contains(event.target as Node)) {
        return; // Click was on the button, toggle handles it
      }
      // Assuming emoji picker is rendered adjacent or within a ref-able container if complex
      // For this setup, if it's absolutely positioned, this might need a ref on the picker itself.
      // For simplicity, if it's not the button, and picker is open, close it.
      // This might be too aggressive if picker itself is clicked.
      // A more robust solution would involve a ref on the picker popover.
      // For now, the picker's onClose prop will handle clicks on its own items.
      // This effect is mainly for clicking truly "outside".
      // Let's assume the EmojiPicker component itself calls onClose when an emoji is selected.
      // This effect is for clicking completely outside the composer interaction area.
      // This simple version might cause issues, a proper popover library is better.
      // Let's rely on the picker's internal close for now, or a wrapper div with a ref.
      // For now, let's simplify: picker closes on selection or by clicking its button again.
    }
    // No specific outside click for emoji picker here, relying on button toggle and selection close.
  }, [showEmojiPicker]);

  const applyMarkdownFormatting = (prefix: string, suffix: string, placeholder: string = "text") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = message;
    let newText;
    let newCursorPos;

    if (start !== end) { // Text is selected
      const selectedText = currentText.substring(start, end);
      newText = `${currentText.substring(0, start)}${prefix}${selectedText}${suffix}${currentText.substring(end)}`;
      newCursorPos = start + prefix.length + selectedText.length + suffix.length;
    } else { // No text selected, insert placeholder
      newText = `${currentText.substring(0, start)}${prefix}${placeholder}${suffix}${currentText.substring(start)}`;
      newCursorPos = start + prefix.length + placeholder.length;
    }

    setMessage(newText);

    // Focus and set cursor/selection position
    textarea.focus();
    if (start !== end) { // Text was selected, maintain selection on the original text part
      setTimeout(() => textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length), 0);
    } else { // No text selected, select the placeholder
      setTimeout(() => textarea.setSelectionRange(start + prefix.length, start + prefix.length + placeholder.length), 0);
    }
  };


  return (
    // Reduced padding, added dark mode bg for composer area
    <div className="bg-white dark:bg-slate-800 p-3 border-t border-slate-200 dark:border-slate-700">
      {/* Use items-end for vertical alignment with a potentially multi-line textarea */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex-1 relative">
          {/* Main input and formatting toolbar container */}
          {/* Dark mode borders and focus ring */}
          <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 dark:focus-within:ring-indigo-500 focus-within:border-transparent transition-all flex flex-col">
            {/* Pending Files Display */}
            {pendingFiles.length > 0 && (
              <div className="p-2 border-b border-slate-200 dark:border-slate-600 max-h-28 overflow-y-auto">
                {pendingFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between text-xs p-1 bg-slate-50 dark:bg-slate-700 rounded mb-1">
                    <span className="truncate text-slate-700 dark:text-slate-300">{file.name} ({Math.round(file.size / 1024)}KB)</span>
                    <div className="flex items-center">
                      {uploadErrors[file.name] ? (
                        <span className="text-red-500 dark:text-red-400 mr-2 text-xs truncate" title={uploadErrors[file.name]}>Error</span>
                      ) : uploadProgress[file.name] !== undefined && uploadProgress[file.name] < 100 ? (
                        <span className="text-indigo-600 dark:text-indigo-400 mr-2">{uploadProgress[file.name]}%</span>
                      ) : uploadProgress[file.name] === 100 ? (
                         <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                      ) : null} {/* End of progress/success/error display */}
                       <button
                        type="button"
                        onClick={() => handleRemovePendingFile(file.name)}
                        className="p-0.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-full hover:bg-red-100 dark:hover:bg-red-600/50"
                        title="Remove file"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                handleStopTyping()
                // Delay hiding suggestions to allow click
                setTimeout(() => setShowSuggestions(false), 100)
              }}
              placeholder={placeholder}
              // Adjusted padding, min-height, dark mode styles
              className="w-full resize-none px-3 py-2.5 focus:outline-none max-h-36 min-h-[44px] placeholder-slate-400 dark:placeholder-slate-500 bg-transparent dark:text-slate-100"
              rows={1}
            />

            {showSuggestions && filteredMembers.length > 0 && (
              <div
                className="absolute z-10 w-full max-w-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl overflow-hidden" // Dark mode for suggestions
                style={{
                  bottom: '100%', // Position above the input area
                  left: 0, // Align with left of input area, adjust as needed
                  marginBottom: '8px' // Small gap
                }}
              >
                <ul className="max-h-48 overflow-y-auto">
                  {filteredMembers.map((member, index) => (
                    <li key={member.user.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectMention(member.user.username)}
                        className={`w-full text-left px-4 py-2 text-sm ${
                          index === activeSuggestionIndex ? 'bg-indigo-500 text-white' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="font-medium">{member.user.name || member.user.username}</span>
                        <span className={`ml-2 ${index === activeSuggestionIndex ? 'text-indigo-200' : 'text-slate-500'}`}>
                          @{member.user.username}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Formatting Toolbar - dark mode styles, reduced padding */}
            {/* ... (rest of imports and component code) ... */}

// Inside the return statement, within the formatting toolbar div:
            {/* Formatting Toolbar - dark mode styles, reduced padding */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-slate-50 dark:bg-slate-700 border-t border-slate-200 dark:border-slate-600">
              <div className="flex items-center gap-0.5"> {/* Added items-center here for picker positioning */}
                {/* ... (Bold, Italic, Attach file buttons) ... */}
                 <button
                  type="button"
                  onClick={() => applyMarkdownFormatting('**', '**', 'bold text')}
                  className="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                  title="Bold"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 4a1 1 0 011-1h3a3 3 0 110 6H6v2h3a3 3 0 110 6H6a1 1 0 01-1-1V4zm3 2H7v2h1a1 1 0 000-2zM7 12v2h1a1 1 0 000-2H7z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => applyMarkdownFormatting('*', '*', 'italic text')}
                  className="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                  title="Italic"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.5 3a1 1 0 00-1 1v12a1 1 0 001 1h1a1 1 0 001-1V4a1 1 0 00-1-1h-1z" clipRule="evenodd" />
                  </svg>
                </button>
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" // Example accept list
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                  title="Attach file"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>

                <div className="relative"> {/* Container for Emoji Picker */}
                  <button
                    ref={emojiPickerButtonRef}
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowEmojiPicker(prev => !prev);
                    }}
                    className="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                    title="Emoji"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-full left-0 mb-1" ref={emojiPickerRef}> {/* Position above button */}
                       <EmojiPicker onEmojiSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
                    </div>
                  )}
                </div>
                {/* New Formatting Buttons with improved placeholder SVGs */}
                <button type="button" onClick={() => applyMarkdownFormatting('~~', '~~', 'strikethrough')} title="Strikethrough" className="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16M9 4L15 20"></path></svg>
                </button>
                <button type="button" onClick={() => applyMarkdownFormatting('`', '`', 'code')} title="Inline Code" className="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m-8 12h16"></path></svg>
                </button>
                <button type="button" onClick={() => applyMarkdownFormatting('```\n', '\n```', 'code block')} title="Code Block" className="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                </button>
                <button type="button" onClick={() => applyMarkdownFormatting('> ', '', 'quote')} title="Blockquote" className="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                </button>
                 <button type="button" onClick={() => applyMarkdownFormatting('- ', '', 'item')} title="Unordered List" className="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"></path></svg>
                </button>
                 <button type="button" onClick={() => applyMarkdownFormatting('1. ', '', 'item')} title="Ordered List" className="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M5.05 3.05a1 1 0 010 1.414L3.464 6H6a1 1 0 110 2H3.464l1.586 1.586A1 1 0 113.636 10.95L.323 7.636a1 1 0 010-1.272L3.636 3.05a1 1 0 011.414 0zM10 4a1 1 0 011-1h6a1 1 0 110 2h-6a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2h-6zm-1 4a1 1 0 011-1h6a1 1 0 110 2h-6a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2h-6z" clipRule="evenodd"></path></svg>
                </button>
              </div>
              
              {/* Keyboard shortcut hint - can be removed for very compact UI */}
              {/* <div className="text-xs text-slate-500 dark:text-slate-400">
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-600 rounded text-xs">Enter</kbd> to send
              </div> */}
            </div>
          </div>
        </div>
        
        {/* Send Button - changed to icon button, adjusted size and alignment */}
        <button
          type="submit"
          disabled={!message.trim()}
          className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:bg-indigo-400 dark:disabled:bg-indigo-700 dark:disabled:opacity-60 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
          style={{ height: '44px', width: '44px' }} // Match min-h of textarea
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          <span className="sr-only">Send</span>
        </button>
      </form>
    </div>
  )
}