import { X, Download } from 'lucide-react';
import PageFlipBook from './PageFlipBook';

export default function LightboxModal({ magazine, onClose }) {
  if (!magazine) return null;

  // Direct flipbook view - no preview step
  return (
    <div className="fixed inset-0 z-50 bg-gray-900">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
        <h2 className="text-white font-medium truncate pr-4">{magazine.title}</h2>
        <div className="flex items-center gap-2">
          <a
            href={magazine.pdf_url}
            download={magazine.title}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="Download PDF"
          >
            <Download className="w-5 h-5 text-white" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Flipbook - direct view */}
      <div className="h-full pt-16 pb-4 px-4 overflow-auto">
        <PageFlipBook 
          pdfUrl={magazine.pdf_url} 
          title={magazine.title}
        />
      </div>
    </div>
  );
}
