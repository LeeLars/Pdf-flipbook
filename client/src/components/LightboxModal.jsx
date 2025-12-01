import { useState } from 'react';
import { X, BookOpen, Download, Calendar } from 'lucide-react';
import FlipbookViewer from './FlipbookViewer';

export default function LightboxModal({ magazine, onClose }) {
  const [showFlipbook, setShowFlipbook] = useState(false);

  if (!magazine) return null;

  const formattedDate = new Date(magazine.created_at).toLocaleDateString('nl-NL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Show full flipbook viewer
  if (showFlipbook) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
          <h2 className="text-white font-medium truncate pr-4">{magazine.title}</h2>
          <button
            onClick={() => {
              setShowFlipbook(false);
              onClose();
            }}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Flipbook */}
        <div className="h-full pt-16 pb-4 px-4">
          <FlipbookViewer 
            pdfUrl={magazine.pdf_url} 
            title={magazine.title}
          />
        </div>
      </div>
    );
  }

  // Show preview modal
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/80"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover Image */}
        <div className="aspect-[3/4] bg-gray-100 relative">
          {magazine.cover_url ? (
            <img
              src={magazine.cover_url}
              alt={magazine.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <svg className="w-20 h-20 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Info & Actions */}
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {magazine.title}
          </h2>
          
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-6">
            <Calendar className="w-4 h-4" />
            <span>{formattedDate}</span>
            {magazine.page_count > 0 && (
              <>
                <span className="text-gray-300">•</span>
                <span>{magazine.page_count} pagina's</span>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowFlipbook(true)}
              className="flex-1 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              Openen als flipbook
            </button>
            
            <a
              href={magazine.pdf_url}
              download={magazine.title}
              className="py-3 px-4 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors flex items-center justify-center"
              title="Download PDF"
            >
              <Download className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
