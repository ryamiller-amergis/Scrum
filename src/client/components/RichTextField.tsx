import React, { useState } from 'react';
import styles from './RichTextField.module.css';

interface RichTextFieldProps {
  label: string;
  content?: string;
  defaultExpanded?: boolean;
}

export const RichTextField: React.FC<RichTextFieldProps> = ({
  label,
  content,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const isEmpty = !content || content.trim() === '' || content === '<div><br></div>';

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
    <div className={styles['rich-text-field']}>
      <div className={styles['rich-text-header']} onClick={() => setIsExpanded(!isExpanded)}>
        <span className={styles['rich-text-label']}>
          {isExpanded ? '▼' : '▶'} {label}
        </span>
      </div>
      {isExpanded ? (
        isEmpty ? (
          <div className={styles['rich-text-empty']}>No content provided</div>
        ) : (
          <div className={styles['rich-text-content']} dangerouslySetInnerHTML={{ __html: content }} />
        )
      ) : (
        <div className={`${styles['rich-text-preview']} ${isEmpty ? styles.empty : ''}`}>
          {preview}
        </div>
      )}
    </div>
  );
};
