import { X, Download } from 'lucide-react';
import PageFlipBook from './PageFlipBook';

export default function LightboxModal({ magazine, onClose }) {
  if (!magazine) return null;

  const handleDownload = async () => {
    try {
      const response = await fetch(magazine.pdf_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${magazine.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(magazine.pdf_url, '_blank');
    }
  };

  // Popup style with transparent background
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-gray-50">
          <h2 className="font-medium text-gray-900 truncate pr-4">{magazine.title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
              title="Download PDF"
            >
              <Download className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Flipbook */}
        <div className="p-4 overflow-auto max-h-[calc(90vh-60px)]">
          <PageFlipBook 
            pdfUrl={magazine.pdf_url} 
            title={magazine.title}
          />
        </div>
      </div>
    </div>
  );
}
