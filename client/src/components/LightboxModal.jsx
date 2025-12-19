import { X } from 'lucide-react';
import PageFlipBook from './PageFlipBook';

export default function LightboxModal({ magazine, onClose }) {
  if (!magazine) return null;

  // Full-screen overlay with flipbook - same experience as main book
  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col bg-gray-100"
      onClick={onClose}
    >
      {/* Header - floating on top */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4 flex items-center justify-between pointer-events-none">
        <h2 className="pointer-events-auto px-4 py-2 bg-white/90 backdrop-blur-md rounded-full font-medium text-gray-900 shadow-lg truncate max-w-[60%]">
          {magazine.title}
        </h2>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="pointer-events-auto p-3 rounded-full bg-white/90 backdrop-blur-md shadow-lg hover:bg-white transition-all hover:scale-110"
        >
          <X className="w-6 h-6 text-gray-700" />
        </button>
      </div>

      {/* Flipbook - full screen, same as main */}
      <div 
        className="flex-1 flex items-center justify-center w-full h-full"
        onClick={(e) => e.stopPropagation()}
      >
        <PageFlipBook 
          pdfUrl={magazine.pdf_url} 
          title={magazine.title}
          variant="modal"
        />
      </div>
    </div>
  );
}
