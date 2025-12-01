import { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Download, Volume2, VolumeX } from 'lucide-react';
import HTMLFlipBook from 'react-pageflip';
import * as pdfjsLib from 'pdfjs-dist';

// Page component for the flipbook - HIGH RESOLUTION
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

        // Clear canvas first
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Get viewport at scale 1 to get original dimensions
        const viewport = page.getViewport({ scale: 1 });
        
        // Calculate scale to fit the page in the given dimensions - 3x for crisp quality
        const scaleX = width / viewport.width;
        const scaleY = height / viewport.height;
        const scale = Math.min(scaleX, scaleY) * 3;
        
        const scaledViewport = page.getViewport({ scale });

        // Set canvas size
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        
        // CSS size for display
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        // White background
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);

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
    <div ref={ref} className="page" style={{ backgroundColor: 'white', width, height }}>
      <canvas ref={canvasRef} />
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
  const [isMobile, setIsMobile] = useState(false);
  
  const flipBookRef = useRef(null);
  const containerRef = useRef(null);
  const audioRef = useRef(null);

  // Natural paper page flip sound
  useEffect(() => {
    const createFlipSound = () => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Soft, natural paper flip sound
        const duration = 0.4; // 400ms
        const bufferSize = audioContext.sampleRate * duration;
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
          const t = i / bufferSize;
          
          // Soft envelope - gentle rise and fall like real paper
          const envelope = Math.sin(t * Math.PI) * Math.exp(-t * 2);
          
          // Soft filtered noise (like paper sliding)
          const noise = (Math.random() * 2 - 1);
          
          // Low-pass filter simulation for softer sound
          const prevSample = i > 0 ? data[i-1] : 0;
          const filtered = prevSample * 0.7 + noise * 0.3;
          
          // Soft swoosh
          const swoosh = Math.sin(t * 8) * (1 - t) * 0.3;
          
          // Gentle landing sound at the end
          const landTime = 0.75;
          const land = t > landTime ? 
            Math.exp(-(t - landTime) * 20) * Math.sin((t - landTime) * 300) * 0.2 : 0;
          
          data[i] = (filtered * 0.4 + swoosh + land) * envelope;
        }
        
        return { audioContext, buffer };
      } catch (e) {
        console.log('Web Audio not supported');
        return null;
      }
    };
    
    const sound = createFlipSound();
    if (sound) {
      audioRef.current = sound;
    }
  }, []);

  // Calculate dimensions based on container, screen size, and detect mobile
  useEffect(() => {
    const updateDimensions = () => {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const mobile = screenWidth < 768;
      setIsMobile(mobile);
      
      if (isFullscreen) {
        // Fullscreen: maximize page size based on screen
        const availableHeight = screenHeight - 100;
        const availableWidth = screenWidth - (mobile ? 20 : 160);
        
        if (mobile) {
          // Single page in fullscreen - fill screen
          const pageHeight = availableHeight * 0.9;
          const pageWidth = pageHeight / 1.414;
          setDimensions({ width: Math.min(pageWidth, availableWidth * 0.95), height: pageHeight });
        } else {
          // Two pages side by side - maximize
          const pageHeight = availableHeight * 0.95;
          const pageWidth = Math.min(pageHeight / 1.414, availableWidth / 2 - 20);
          setDimensions({ width: pageWidth, height: pageWidth * 1.414 });
        }
      } else {
        // Normal view: scale based on available space - BIGGER
        const containerWidth = containerRef.current?.clientWidth || screenWidth;
        const maxHeight = Math.min(screenHeight * 0.75, 800);
        
        if (mobile) {
          // Single page on mobile - fill width nicely
          const pageWidth = containerWidth * 0.85;
          const pageHeight = Math.min(pageWidth * 1.414, screenHeight * 0.7);
          setDimensions({ width: pageHeight / 1.414, height: pageHeight });
        } else {
          // Two pages on desktop - bigger, based on screen size
          // Use more of the available space
          const idealHeight = screenHeight * 0.65;
          const idealWidth = idealHeight / 1.414;
          // Make sure two pages fit side by side with some margin
          const maxPageWidth = (containerWidth - 200) / 2;
          const pageWidth = Math.min(idealWidth, maxPageWidth, 500);
          setDimensions({ width: pageWidth, height: pageWidth * 1.414 });
        }
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isFullscreen]);

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
      try {
        const { audioContext, buffer } = audioRef.current;
        
        // Resume audio context if suspended (browser autoplay policy)
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }
        
        // Create new source for each play
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        
        source.buffer = buffer;
        gainNode.gain.value = 0.8; // Louder volume
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        source.start(0);
      } catch (e) {
        console.log('Could not play sound');
      }
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

  // Fullscreen toggle with proper state management
  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        await containerRef.current?.requestFullscreen();
        setIsFullscreen(true);
      } else {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (e) {
      // Fallback: just toggle the state for CSS-based fullscreen
      setIsFullscreen(!isFullscreen);
    }
  };

  // Listen for fullscreen changes (e.g., user presses Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
      className={`rounded-xl overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50 rounded-none bg-gray-900' : ''}`}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-transparent">
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
          <button
            onClick={async () => {
              try {
                const response = await fetch(pdfUrl);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${title}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
              } catch (error) {
                window.open(pdfUrl, '_blank');
              }
            }}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Download PDF"
          >
            <Download className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title={isFullscreen ? 'Verkleinen' : 'Volledig scherm'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5 text-gray-600" />
            ) : (
              <Maximize2 className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Flipbook with side navigation */}
      <div className={`flex items-center justify-center py-4 gap-4 md:gap-8 ${isFullscreen ? 'h-[calc(100vh-60px)]' : ''}`}>
        {/* Left navigation arrow */}
        <button
          onClick={goToPrevPage}
          disabled={currentPage <= 0}
          className="hidden md:flex p-3 rounded-full bg-white/80 shadow-md hover:bg-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>

        {pdf && totalPages > 0 && (
          <div className="relative">
            {/* Soft shadow underneath the book */}
            <div 
              className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[90%] h-8 bg-black/20 blur-xl rounded-full"
              style={{ zIndex: -1 }}
            />
            <HTMLFlipBook
              ref={flipBookRef}
              width={dimensions.width}
              height={dimensions.height}
              size="fixed"
              minWidth={200}
              maxWidth={800}
              minHeight={280}
              maxHeight={1200}
              showCover={true}
              mobileScrollSupport={true}
              onFlip={onFlip}
              className=""
              style={{ margin: 0, padding: 0 }}
              startPage={0}
              drawShadow={true}
              flippingTime={600}
              usePortrait={isMobile}
              startZIndex={0}
              autoSize={false}
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
          </div>
        )}

        {/* Right navigation arrow */}
        <button
          onClick={goToNextPage}
          disabled={currentPage >= totalPages - (isMobile ? 1 : 2)}
          className="hidden md:flex p-3 rounded-full bg-white/80 shadow-md hover:bg-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-6 h-6 text-gray-700" />
        </button>
      </div>

      {/* Mobile navigation buttons */}
      {isMobile && (
        <div className="flex justify-center gap-4 py-2">
          <button
            onClick={goToPrevPage}
            disabled={currentPage <= 0}
            className="p-3 rounded-full bg-white shadow-lg hover:bg-gray-50 transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <button
            onClick={goToNextPage}
            disabled={currentPage >= totalPages - 1}
            className="p-3 rounded-full bg-white shadow-lg hover:bg-gray-50 transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-6 h-6 text-gray-700" />
          </button>
        </div>
      )}

      {/* Navigation hint */}
      <div className="text-center py-1">
        <p className="text-xs text-gray-400">
          {isMobile ? 'Swipe of gebruik de pijlen' : 'Klik op de hoek of gebruik ← → om te bladeren'}
        </p>
      </div>
    </div>
  );
}
