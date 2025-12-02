import { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  Download, 
  Volume2, 
  VolumeX,
  ZoomIn,
  ZoomOut,
  Grid,
  X
} from 'lucide-react';
import HTMLFlipBook from 'react-pageflip';
import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Reduce PDF.js memory usage in production
if (typeof window !== 'undefined') {
  // Limit cache size to prevent memory issues
  pdfjsLib.GlobalWorkerOptions.maxCanvasPixels = 1024 * 1024 * 15; // 15MB limit
}

// Scoped warning suppression for PDF.js only
const suppressPdfWarnings = (message = '') => (
  message.includes('TT: invalid function id') ||
  message.includes('GlobalImageCache.setData - cache limit reached') ||
  message.includes('No cmap table available') ||
  message.includes('Knockout groups not supported') ||
  message.includes('loadFont - translateFont failed')
);

// PDF.js configuration for proper font rendering
const PDF_OPTIONS = {
  cMapUrl: 'https://unpkg.com/pdfjs-dist@4.0.379/cmaps/',
  cMapPacked: true,
  disableRange: true, // Disable range requests for better CORS
  disableStream: false,
  disableAutoFetch: false,
};

const PAGE_RATIO = 1.414; // A4 height/width ratio

// --- Components ---

// Thumbnail Component
const Thumbnail = ({ pageNum, pdf, onClick, isSelected }) => {
  const canvasRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!pdf || !canvasRef.current || loaded) return;

    const renderThumb = async () => {
      try {
        const page = await pdf.getPage(pageNum);
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        // Small scale for thumbnails
        const viewport = page.getViewport({ scale: 0.3 });
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport
        }).promise;

        setLoaded(true);
      } catch (err) {
        console.error('Error rendering thumbnail:', err);
      }
    };

    renderThumb();
  }, [pdf, pageNum, loaded]);

  return (
    <div 
      onClick={() => onClick(pageNum - 1)}
      className={`cursor-pointer group flex flex-col items-center gap-2 p-2 rounded-lg transition-all ${isSelected ? 'bg-blue-50 ring-2 ring-blue-500' : 'hover:bg-gray-50'}`}
    >
      <div className="relative shadow-md group-hover:shadow-lg transition-shadow bg-white">
        <canvas ref={canvasRef} className="block max-w-full h-auto" />
      </div>
      <span className={`text-sm font-medium ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
        Pagina {pageNum}
      </span>
    </div>
  );
};

// Page Component (High Res) - with render task cancellation to prevent canvas conflicts
const Page = forwardRef(({ pageNum, pdf, width, height }, ref) => {
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    let cancelled = false;

    const renderPage = async () => {
      // Cancel any ongoing render
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
      }

      try {
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');

        const viewport = page.getViewport({ scale: 1 });
        
        // 2x quality for sharpness on retina
        const scaleX = width / viewport.width;
        const scaleY = height / viewport.height;
        const qualityScale = Math.min(scaleX, scaleY) * 2;
        
        const scaledViewport = page.getViewport({ scale: qualityScale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        // White background
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);

        const renderTask = page.render({
          canvasContext: context,
          viewport: scaledViewport
        });
        
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        
        if (!cancelled) {
          setRendered(true);
        }
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', err);
        }
      }
    };

    setRendered(false);
    renderPage();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
      }
    };
  }, [pdf, pageNum, width, height]);

  return (
    <div
      ref={ref}
      className="page relative"
      data-density="soft"
      style={{ backgroundColor: 'white', width, height, overflow: 'hidden' }}
    >
      <canvas ref={canvasRef} style={{ opacity: rendered ? 1 : 0, transition: 'opacity 0.2s' }} />
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
});

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

  // Observe container size for smoother responsive scaling
  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // --- Audio Setup (Realistic paper turn) ---
  useEffect(() => {
    let audioContext;

    const createPaperFlipVariants = (ctx, count = 4) => {
      const variants = [];
      for (let c = 0; c < count; c++) {
        const duration = 0.7 + Math.random() * 0.2;
        const sampleRate = ctx.sampleRate;
        const bufferSize = Math.floor(sampleRate * duration);
        const buffer = ctx.createBuffer(2, bufferSize, sampleRate);

        const liftStart = 0.04 + Math.random() * 0.03;
        const flickCenter = 0.12 + Math.random() * 0.05;
        const swooshCenter = 0.3 + Math.random() * 0.12;
        const landingCenter = 0.55 + Math.random() * 0.08;

        for (let channel = 0; channel < 2; channel++) {
          const data = buffer.getChannelData(channel);
          let low = 0;
          let mid = 0;
          let high = 0;

          for (let i = 0; i < bufferSize; i++) {
            const t = i / bufferSize;
            const raw = Math.random() * 2 - 1;

            low += (raw - low) * 0.02;
            mid += (raw - mid) * 0.08;
            high += (raw - high) * 0.25;

            const lift = Math.min(Math.max((t - liftStart) / 0.25, 0), 1);
            const release = 1 - Math.min(Math.max((t - 0.55) / 0.35, 0), 1);
            const envelope = Math.pow(Math.max(lift * release, 0), 0.95);

            const flick = Math.exp(-Math.pow((t - flickCenter) / 0.025, 2)) * (0.6 + Math.random() * 0.2);
            const fibers = (high - mid) * 0.45;
            const swoosh = (mid - low) * Math.exp(-Math.pow((t - swooshCenter) / 0.18, 2)) * 0.9;
            const landing = Math.exp(-Math.pow((t - landingCenter) / 0.07, 2)) * Math.sin(t * Math.PI * (80 + Math.random() * 20)) * 0.35;
            const rustle = low * 0.25;
            const tinyTear = Math.random() > 0.998 ? (Math.random() * 0.5 - 0.25) : 0;

            const pan = channel === 0 ? 0.92 : 1.02;
            const sample = (rustle + fibers + swoosh + flick + landing + tinyTear) * envelope;
            data[i] = Math.tanh(sample * 1.15) * pan;
          }
        }

        variants.push(buffer);
      }

      return variants;
    };

    const initAudio = () => {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioRef.current.audioContext = audioContext;
        audioRef.current.buffers = createPaperFlipVariants(audioContext);
      } catch (e) {}
    };

    initAudio();

    return () => {
      try { audioContext?.close(); } catch (e) {}
    };
  }, []);

  const playFlipSound = useCallback(() => {
    if (!soundEnabled) return;
    const { audioContext, buffers } = audioRef.current;
    if (!audioContext || !buffers?.length) return;

    try {
      if (audioContext.state === 'suspended') audioContext.resume();
      const source = audioContext.createBufferSource();
      source.buffer = buffers[Math.floor(Math.random() * buffers.length)];
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.27;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      source.start(0);
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
    const baseHeight = containerSize.height || (isModal ? screenHeight * 0.85 : screenHeight * 0.75);

    const horizontalPadding = mobile ? 24 : (isFullscreen ? 80 : (isModal ? 60 : 140));
    const verticalPadding = mobile ? 140 : (isFullscreen ? 140 : (isModal ? 150 : 200));

    const availableW = Math.max((isFullscreen ? screenWidth : baseWidth) - horizontalPadding, 260);
    const availableH = Math.max((isFullscreen ? screenHeight : baseHeight) - verticalPadding, 340);

    if (mobile) {
      const width = Math.min(availableW, availableH / PAGE_RATIO);
      setDimensions({ width, height: width * PAGE_RATIO });
    } else {
      const spreadWidth = availableW;
      const pageWidth = Math.min(spreadWidth / 2, availableH / PAGE_RATIO);
      const pageHeight = pageWidth * PAGE_RATIO;
      setDimensions({ width: pageWidth, height: pageHeight });
    }
  }, [containerSize, isFullscreen, isModal]);

  useEffect(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
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
      <div className={`relative transition-transform duration-300 ease-out flex items-center justify-center ${showThumbnails ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'}`}
           style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
      >
        {/* Left Arrow */}
        {!isMobile && (
          <button
            onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()}
            className="absolute -left-16 lg:-left-24 p-3 rounded-full bg-white/80 shadow-lg hover:bg-white transition-all hover:scale-110 z-10 disabled:opacity-0"
            disabled={currentPage === 0}
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
        )}

        {/* The Book */}
        <div className="shadow-2xl">
          <HTMLFlipBook
            ref={flipBookRef}
            width={dimensions.width}
            height={dimensions.height}
            size="fixed"
            minWidth={200}
            maxWidth={1000}
            minHeight={280}
            maxHeight={1400}
            showCover={false}
            mobileScrollSupport={true}
            onFlip={(e) => {
              setCurrentPage(e.data);
              playFlipSound();
            }}
            className="flipbook"
            style={{ margin: 0, padding: 0 }}
            startPage={0}
            drawShadow={true}
            flippingTime={800}
            usePortrait={isMobile}
            startZIndex={0}
            autoSize={false}
            maxShadowOpacity={0.5}
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
                zoomLevel={zoom}
              />
            ))}
          </HTMLFlipBook>
        </div>

        {/* Right Arrow */}
        {!isMobile && (
          <button
            onClick={() => flipBookRef.current?.pageFlip()?.flipNext()}
            className="absolute -right-16 lg:-right-24 p-3 rounded-full bg-white/80 shadow-lg hover:bg-white transition-all hover:scale-110 z-10 disabled:opacity-0"
            disabled={currentPage >= totalPages - 1}
          >
            <ChevronRight className="w-6 h-6 text-gray-700" />
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
