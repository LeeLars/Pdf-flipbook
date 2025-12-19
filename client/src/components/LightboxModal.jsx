import { X } from 'lucide-react';
import PageFlipBook from './PageFlipBook';

export default function LightboxModal({ magazine, onClose }) {
  if (!magazine) return null;

  // Popup style with transparent background
  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[1500px] max-h-[92vh] mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-gray-50">
          <h2 className="font-medium text-gray-900 truncate pr-4">{magazine.title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Flipbook */}
        <div className="p-6 overflow-hidden">
          <PageFlipBook 
            pdfUrl={magazine.pdf_url} 
            title={magazine.title}
            variant="modal"
          />
        </div>
      </div>
    </div>
  );
}
