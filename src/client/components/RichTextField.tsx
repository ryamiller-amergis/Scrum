import React, { useState } from 'react';
import './RichTextField.css';

interface RichTextFieldProps {
  label: string;
  content?: string;
  defaultExpanded?: boolean;
}

export const RichTextField: React.FC<RichTextFieldProps> = ({ 
  label, 
  content, 
  defaultExpanded = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Check if content is empty
  const isEmpty = !content || content.trim() === '' || content === '<div><br></div>';

  // Strip HTML tags for preview
  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const plainText = isEmpty ? '' : stripHtml(content);
  const preview = isEmpty 
    ? 'No content provided' 
    : plainText.length > 100 
      ? plainText.substring(0, 100) + '...' 
      : plainText;

  return (
    <div className="rich-text-field">
      <div 
        className="rich-text-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="rich-text-label">
          {isExpanded ? '▼' : '▶'} {label}
        </span>
      </div>
      {isExpanded ? (
        isEmpty ? (
          <div className="rich-text-empty">
            No content provided
          </div>
        ) : (
          <div 
            className="rich-text-content"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )
      ) : (
        <div className={`rich-text-preview ${isEmpty ? 'empty' : ''}`}>
          {preview}
        </div>
      )}
    </div>
  );
};
