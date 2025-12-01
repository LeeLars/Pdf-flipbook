import { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Download, Volume2, VolumeX } from 'lucide-react';
import HTMLFlipBook from 'react-pageflip';
import * as pdfjsLib from 'pdfjs-dist';

// Page component for the flipbook
const Page = forwardRef(({ pageNum, pdf, width, height }, ref) => {
  const canvasRef = useRef(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!pdf || !canvasRef.current || rendered) return;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(pageNum);
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(width / viewport.width, height / viewport.height);
        const scaledViewport = page.getViewport({ scale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        await page.render({
          canvasContext: context,
          viewport: scaledViewport
        }).promise;

        setRendered(true);
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };

    renderPage();
  }, [pdf, pageNum, width, height, rendered]);

  return (
    <div ref={ref} className="page bg-white shadow-lg">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
});

Page.displayName = 'Page';

export default function PageFlipBook({ pdfUrl, title }) {
  const [pdf, setPdf] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 400, height: 566 });
  
  const flipBookRef = useRef(null);
  const containerRef = useRef(null);
  const audioRef = useRef(null);

  // Page flip sound
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2LkZeWj4N3bGVjZ3F+ipOXl5KKgHZsZWRpcH2Ij5OTkIqCeXFrampvd4CIjpCPjIiCe3VwbW1wd3+Fio2OjYqGgXx3c3FydXl+g4iKi4qIhYJ+enZ0c3R3e3+DhoiIh4WCf3x5d3Z2d3l8f4KEhYWEgoB9e3l4d3d4eXt9f4GCg4OCgH58e3l4eHh5ent9f4CBgoGAf358e3p5eXl6e3x9f4CAgYCAf359fHt6enp6e3x9fn9/gIB/f359fHx7e3t7fH1+fn9/f39/fn59fXx8fHx8fX1+fn5/f39/fn5+fX19fX19fX5+fn5+f39/f35+fn5+fn5+fn5+fn5+fn9/f39/f35+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+');
    audioRef.current.volume = 0.3;
  }, []);

  // Calculate dimensions based on container
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const maxWidth = Math.min(containerWidth * 0.45, 450); // Each page max 450px
        const height = maxWidth * 1.414; // A4 ratio
        setDimensions({ width: maxWidth, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Load PDF
  useEffect(() => {
    if (!pdfUrl) return;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdfDoc = await loadingTask.promise;
        
        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Kon PDF niet laden');
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [pdfUrl]);

  // Play flip sound
  const playFlipSound = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [soundEnabled]);

  // Handle page flip
  const onFlip = useCallback((e) => {
    setCurrentPage(e.data);
    playFlipSound();
  }, [playFlipSound]);

  // Navigation
  const goToPrevPage = () => {
    flipBookRef.current?.pageFlip()?.flipPrev();
  };

  const goToNextPage = () => {
    flipBookRef.current?.pageFlip()?.flipNext();
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') goToPrevPage();
      if (e.key === 'ArrowRight') goToNextPage();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-500">Magazine laden...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`bg-gradient-to-b from-gray-100 to-gray-200 rounded-xl shadow-lg overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/80 backdrop-blur border-b">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title={soundEnabled ? 'Geluid uit' : 'Geluid aan'}
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-gray-600" />
            ) : (
              <VolumeX className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevPage}
            disabled={currentPage <= 0}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm text-gray-600 min-w-[80px] text-center">
            {currentPage + 1} - {Math.min(currentPage + 2, totalPages)} / {totalPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={currentPage >= totalPages - 2}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={pdfUrl}
            download={title}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Download PDF"
          >
            <Download className="w-5 h-5 text-gray-600" />
          </a>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Volledig scherm"
          >
            <Maximize2 className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Flipbook */}
      <div className={`flex items-center justify-center py-8 ${isFullscreen ? 'h-[calc(100vh-60px)]' : 'min-h-[500px]'}`}>
        {pdf && totalPages > 0 && (
          <HTMLFlipBook
            ref={flipBookRef}
            width={dimensions.width}
            height={dimensions.height}
            size="stretch"
            minWidth={280}
            maxWidth={500}
            minHeight={400}
            maxHeight={700}
            showCover={true}
            mobileScrollSupport={true}
            onFlip={onFlip}
            className="shadow-2xl"
            style={{}}
            startPage={0}
            drawShadow={true}
            flippingTime={600}
            usePortrait={false}
            startZIndex={0}
            autoSize={true}
            maxShadowOpacity={0.5}
            showPageCorners={true}
            disableFlipByClick={false}
          >
            {Array.from({ length: totalPages }, (_, i) => (
              <Page
                key={i}
                pageNum={i + 1}
                pdf={pdf}
                width={dimensions.width}
                height={dimensions.height}
              />
            ))}
          </HTMLFlipBook>
        )}
      </div>

      {/* Navigation hint */}
      <div className="text-center py-2 bg-white/80 backdrop-blur border-t">
        <p className="text-xs text-gray-400">
          Klik op de hoek of gebruik ← → om te bladeren
        </p>
      </div>
    </div>
  );
}
