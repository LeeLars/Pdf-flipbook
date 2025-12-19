import { useState, useEffect, useRef, useCallback, forwardRef, useMemo, memo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  Volume2, 
  VolumeX,
  ZoomIn,
  ZoomOut,
  Grid,
  X
} from 'lucide-react';
import HTMLFlipBook from 'react-pageflip';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js configuration for proper font rendering
const PDF_OPTIONS = {
  cMapUrl: 'https://unpkg.com/pdfjs-dist@4.0.379/cmaps/',
  cMapPacked: true,
  disableRange: true,
  disableStream: false,
  disableAutoFetch: false,
};

const PAGE_RATIO = 1.414;

// Debounce helper
const debounce = (fn, ms) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

// --- Components ---

// Thumbnail Component - memoized to prevent re-renders
const Thumbnail = memo(({ pageNum, pdf, onClick, isSelected }) => {
  const canvasRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!pdf || !canvasRef.current || loaded) return;

    let cancelled = false;
    const renderThumb = async () => {
      try {
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: 0.2 });
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport
        }).promise;

        if (!cancelled) setLoaded(true);
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Thumbnail error:', err);
        }
      }
    };

    renderThumb();
    return () => { cancelled = true; };
  }, [pdf, pageNum, loaded]);

  return (
    <div 
      onClick={() => onClick(pageNum - 1)}
      className={`cursor-pointer group flex flex-col items-center gap-2 p-2 rounded-lg ${isSelected ? 'bg-blue-50 ring-2 ring-blue-500' : 'hover:bg-gray-50'}`}
    >
      <div className="relative shadow-md group-hover:shadow-lg bg-white">
        <canvas ref={canvasRef} className="block max-w-full h-auto" />
      </div>
      <span className={`text-sm font-medium ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
        Pagina {pageNum}
      </span>
    </div>
  );
});

// Page Component - memoized, only re-renders when pdf or pageNum changes
const Page = memo(forwardRef(({ pageNum, pdf, width, height, isCover = false }, ref) => {
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const renderedRef = useRef(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    // Skip if already rendered this page
    if (renderedRef.current) return;

    let cancelled = false;

    const renderPage = async () => {
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch (e) {}
      }

      try {
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: 1 });
        
        // 1.5x quality - balance between sharpness and performance
        const scale = Math.min(width / viewport.width, height / viewport.height) * 1.5;
        const scaledViewport = page.getViewport({ scale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);

        const renderTask = page.render({
          canvasContext: context,
          viewport: scaledViewport
        });
        
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        
        if (!cancelled) {
          renderedRef.current = true;
          setRendered(true);
        }
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Page render error:', err);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch (e) {}
      }
    };
  }, [pdf, pageNum]); // Remove width/height dependency to prevent re-renders

  return (
    <div
      ref={ref}
      className={`page relative ${isCover ? 'page-cover' : ''}`}
      data-density={isCover ? 'hard' : 'soft'}
      style={{ backgroundColor: 'white', width, height, overflow: 'hidden' }}
    >
      <canvas ref={canvasRef} style={{ opacity: rendered ? 1 : 0, transition: 'opacity 0.15s' }} />
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}));

Page.displayName = 'Page';

// --- Main Component ---

export default function PageFlipBook({ pdfUrl, title, variant = 'default' }) {
  const [pdf, setPdf] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 400, height: 566 });
  const [isMobile, setIsMobile] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const isModal = variant === 'modal';

  const flipBookRef = useRef(null);
  const containerRef = useRef(null);
  const audioRef = useRef({ audioContext: null, buffers: [] });

  // Check if we're on cover pages (single page display)
  const isLastPage = currentPage >= totalPages - 1;
  const isCoverPage = currentPage === 0 || (isLastPage && totalPages > 1);

  // Stage dimensions - always full spread width for the flipbook
  const stageDimensions = useMemo(() => {
    const width = isMobile ? dimensions.width : dimensions.width * 2;
    return {
      width,
      height: dimensions.height
    };
  }, [dimensions.width, dimensions.height, isMobile]);

  // Wrapper style - centers the flipbook properly
  const wrapperStyle = useMemo(() => {
    return {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%'
    };
  }, []);

  const stageStyle = useMemo(() => ({
    width: `${stageDimensions.width}px`,
    height: `${stageDimensions.height}px`,
    transform: `scale(${zoom})`,
    transformOrigin: 'center center',
    transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)'
  }), [stageDimensions, zoom]);

  // Observe container size with debounce to prevent excessive updates
  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;
    
    const debouncedUpdate = debounce((width, height) => {
      setContainerSize({ width, height });
    }, 150);
    
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        debouncedUpdate(entry.contentRect.width, entry.contentRect.height);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // --- Audio Setup (Page flip sound) ---
  useEffect(() => {
    const audio = new Audio('/turnPage.mp3');
    audio.volume = 0.5;
    audio.preload = 'auto';
    audioRef.current.audio = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  const playFlipSound = useCallback(() => {
    if (!soundEnabled) return;
    const { audio } = audioRef.current;
    if (!audio) return;

    try {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch (e) {}
  }, [soundEnabled]);

  // --- Dimensions & Responsive ---
  const updateDimensions = useCallback(() => {
    if (typeof window === 'undefined') return;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const mobile = screenWidth < 768;
    setIsMobile(mobile);

    const baseWidth = containerSize.width || screenWidth;
    const baseHeight = containerSize.height || (isModal ? screenHeight * 0.9 : screenHeight * 0.8);

    const horizontalPadding = mobile ? 16 : (isFullscreen ? 40 : (isModal ? 48 : 80));
    const verticalPadding = mobile ? 100 : (isFullscreen ? 80 : (isModal ? 110 : 130));

    const availableW = Math.max((isFullscreen ? screenWidth : baseWidth) - horizontalPadding, 260);
    const availableH = Math.max((isFullscreen ? screenHeight : baseHeight) - verticalPadding, 340);

    if (mobile) {
      const width = Math.min(availableW, availableH / PAGE_RATIO);
      setDimensions({ width, height: width * PAGE_RATIO });
    } else {
      const spreadWidth = availableW;
      const basePageWidth = Math.min(spreadWidth / 2, availableH / PAGE_RATIO);
      const scaledPageWidth = Math.min(basePageWidth * 1.2, spreadWidth / 2);
      const pageHeight = scaledPageWidth * PAGE_RATIO;
      setDimensions({ width: scaledPageWidth, height: pageHeight });
    }
  }, [containerSize, isFullscreen, isModal]);

  useEffect(() => {
    updateDimensions();
    const debouncedResize = debounce(updateDimensions, 100);
    window.addEventListener('resize', debouncedResize);
    return () => window.removeEventListener('resize', debouncedResize);
  }, [updateDimensions]);

  // --- PDF Loading ---
  useEffect(() => {
    if (!pdfUrl) return;
    const loadPdf = async () => {
      try {
        setLoading(true);
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          ...PDF_OPTIONS
        });
        const pdfDoc = await loadingTask.promise;
        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
      } catch (err) {
        console.error(err);
        setError('Kon PDF niet laden');
      } finally {
        setLoading(false);
      }
    };
    loadPdf();
  }, [pdfUrl]);

  // --- Navigation ---
  const goToPage = (p) => {
    if (flipBookRef.current) {
      flipBookRef.current.pageFlip().flip(p);
    }
  };

  const handleZoom = (delta) => {
    setZoom(prev => {
      const newZoom = Math.max(1, Math.min(prev + delta, 3));
      return newZoom;
    });
  };

  // --- Fullscreen ---
  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      setIsFullscreen(!isFullscreen);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // --- Render ---
  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center bg-white rounded-xl shadow-sm">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center p-8">{error}</div>;
  }

  return (
    <div 
      ref={containerRef}
      className={`relative flex flex-col items-center bg-gray-100 transition-all duration-300 w-full ${
        isFullscreen
          ? 'fixed inset-0 z-50 h-screen w-screen justify-center'
          : isModal
            ? 'rounded-2xl min-h-[500px] justify-center py-6'
            : 'rounded-xl min-h-[620px] justify-center py-10'
      }`}
    >
      {/* Top Controls (Title & Close Grid) */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20 pointer-events-none">
         <div className="pointer-events-auto">
            {/* Reserved for logo or branding */}
         </div>
         {/* Close Grid Button */}
         {showThumbnails && (
           <button 
             onClick={() => setShowThumbnails(false)}
             className="pointer-events-auto bg-white/90 backdrop-blur shadow-lg p-2 rounded-full hover:bg-white transition-transform hover:scale-110"
           >
             <X className="w-6 h-6 text-gray-700" />
           </button>
         )}
      </div>

      {/* Main Content Area */}
      <div className={`relative flex items-center justify-center w-full ${showThumbnails ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        {/* Left Arrow */}
        {!isMobile && (
          <button
            onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()}
            className="absolute left-4 lg:left-8 p-3 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 transition-all hover:scale-110 z-10 disabled:opacity-0 disabled:pointer-events-none"
            style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))' }}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}

        {/* The Book Wrapper - handles centering offset for covers */}
        <div style={wrapperStyle}>
          <div
            className="flipbook-stage"
            style={stageStyle}
          >
          <HTMLFlipBook
            ref={flipBookRef}
            width={dimensions.width}
            height={dimensions.height}
            size="fixed"
            minWidth={200}
            maxWidth={1000}
            minHeight={280}
            maxHeight={1400}
            showCover={true}
            mobileScrollSupport={true}
            onFlip={(e) => {
              setCurrentPage(e.data);
              playFlipSound();
            }}
            className="flipbook"
            style={{ width: stageDimensions.width, height: stageDimensions.height, margin: 0, padding: 0 }}
            startPage={0}
            drawShadow={true}
            flippingTime={700}
            usePortrait={isMobile}
            startZIndex={0}
            autoSize={false}
            maxShadowOpacity={1}
            showPageCorners={true}
            disableFlipByClick={false}
            clickEventForward={true}
            swipeDistance={30}
          >
            {Array.from({ length: totalPages }, (_, i) => (
              <Page
                key={i}
                pageNum={i + 1}
                pdf={pdf}
                width={dimensions.width}
                height={dimensions.height}
                isCover={i === 0 || i === totalPages - 1}
              />
            ))}
          </HTMLFlipBook>
          </div>
        </div>

        {/* Right Arrow */}
        {!isMobile && (
          <button
            onClick={() => flipBookRef.current?.pageFlip()?.flipNext()}
            className="absolute right-4 lg:right-8 p-3 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 transition-all hover:scale-110 z-10 disabled:opacity-0 disabled:pointer-events-none"
            style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))' }}
            disabled={currentPage >= totalPages - 1}
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}
      </div>

      {/* Thumbnails Overlay */}
      <div 
        className={`absolute inset-0 bg-white/95 backdrop-blur-sm z-10 transition-opacity duration-300 overflow-y-auto ${
          showThumbnails ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      >
        <div className="max-w-6xl mx-auto p-8 pt-20">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {showThumbnails && Array.from({ length: totalPages }, (_, i) => (
              <Thumbnail
                key={i}
                pageNum={i + 1}
                pdf={pdf}
                isSelected={i === currentPage || (i + 1 === currentPage && !isMobile)}
                onClick={(p) => {
                  goToPage(p);
                  setShowThumbnails(false);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Floating Toolbar */}
      <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 bg-white/90 backdrop-blur-md shadow-xl rounded-full border border-white/50 z-50 transition-transform duration-300 ${showThumbnails ? 'translate-y-24' : ''}`}>
        
        {/* Page Navigation */}
        <div className="flex items-center gap-1 border-r border-gray-200 pr-3">
           <button onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-700">
             <ChevronLeft className="w-5 h-5" />
           </button>
           <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center tabular-nums">
             {currentPage + 1} / {totalPages}
           </span>
           <button onClick={() => flipBookRef.current?.pageFlip()?.flipNext()} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-700">
             <ChevronRight className="w-5 h-5" />
           </button>
        </div>

        {/* Zoom Controls */}
        <div className="hidden md:flex items-center gap-1 border-r border-gray-200 pr-3">
          <button onClick={() => handleZoom(-0.2)} disabled={zoom <= 1} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-700 disabled:opacity-30">
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[40px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => handleZoom(0.2)} disabled={zoom >= 3} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-700 disabled:opacity-30">
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-2 pl-1">
          <button 
            onClick={() => setShowThumbnails(!showThumbnails)} 
            className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${showThumbnails ? 'bg-blue-100 text-blue-600' : 'text-gray-700'}`}
            title="Overzicht"
          >
            <Grid className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setSoundEnabled(!soundEnabled)} 
            className="p-2 rounded-full hover:bg-gray-100 text-gray-700"
            title={soundEnabled ? "Geluid uit" : "Geluid aan"}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <div className="w-px h-4 bg-gray-300 mx-1" />

          <button 
            onClick={toggleFullscreen}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-700"
            title="Volledig scherm"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>

      </div>
    </div>
  );
}
