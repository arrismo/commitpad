import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSettings } from '../../context/SettingsContext';

interface MarkdownPreviewProps {
  content: string;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content }) => {
  const { settings } = useSettings();
  
  return (
    <div 
      className="markdown-preview prose dark:prose-invert prose-slate max-w-none"
      style={{ fontSize: `${settings.fontSize}px` }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownPreview;