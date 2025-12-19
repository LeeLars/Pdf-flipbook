import { useEffect } from 'react';
import { X } from 'lucide-react';
import PageFlipBook from './PageFlipBook';

export default function LightboxModal({ magazine, onClose }) {
  // Disable body scroll when modal is open
  useEffect(() => {
    if (magazine) {
      // Store original body overflow
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      
      // Prevent scrolling
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      
      // Also prevent scroll on html element
      document.documentElement.style.overflow = 'hidden';
      
      return () => {
        // Restore original styles
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.width = '';
        document.documentElement.style.overflow = '';
      };
    }
  }, [magazine]);

  if (!magazine) return null;

  // Popup style with transparent background
  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-hidden"
      onClick={onClose}
      style={{ margin: 0, padding: 0 }}
    >
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[95vh] mx-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ overflow: 'hidden' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-gray-50 flex-shrink-0">
          <h2 className="font-medium text-gray-900 truncate pr-4">{magazine.title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Flipbook */}
        <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
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
