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

// Premium flip sound sample (Pixabay - "Newspaper Foley 4")
const FLIP_SAMPLE_URL = 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_9ff19fec20.mp3?filename=newspaper-foley-4-153637.mp3';

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

// Page Component (High Res)
const Page = forwardRef(({ pageNum, pdf, width, height, zoomLevel = 1 }, ref) => {
  const canvasRef = useRef(null);
  const [rendered, setRendered] = useState(false);
  
  // Re-render if zoom changes significantly or dimensions change
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    // Reset rendered state when critical props change
    setRendered(false);
  }, [pdf, pageNum, width, height]);

  useEffect(() => {
    if (!pdf || !canvasRef.current || rendered) return;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(pageNum);
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height);

        const viewport = page.getViewport({ scale: 1 });
        
        // Calculate scale to fit - multiply by pixel ratio and zoom for sharpness
        const scaleX = width / viewport.width;
        const scaleY = height / viewport.height;
        // 3x base quality + zoom consideration (though we clamp max canvas size to avoid memory issues)
        const qualityScale = Math.min(scaleX, scaleY) * 3; 
        
        const scaledViewport = page.getViewport({ scale: qualityScale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        
        // Force style to match container
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'contain';

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
    <div ref={ref} className="page shadow-sm" style={{ backgroundColor: 'white', width, height, overflow: 'hidden' }}>
      <canvas ref={canvasRef} />
    </div>
  );
});

Page.displayName = 'Page';

// --- Main Component ---

export default function PageFlipBook({ pdfUrl, title }) {
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
  
  const flipBookRef = useRef(null);
  const containerRef = useRef(null);
  const audioRef = useRef({ audioContext: null, sampleBuffer: null, fallbackBuffer: null });

  // --- Audio Setup (Newspaper Foley sample with synthesized fallback) ---
  useEffect(() => {
    let audioContext;

    const createFallbackBuffer = (ctx) => {
      // Synthetic "fwip" in case sample fails
      const duration = 0.28;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

      for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < bufferSize; i++) {
          const t = i / bufferSize;
          const envelope = t < 0.08 ? t / 0.08 : Math.pow(1 - (t - 0.08) / 0.92, 3);
          const whiteNoise = (Math.random() * 2 - 1) * 0.6;
          const whooshFreq = 250 - t * 200;
          const whoosh = Math.sin((i / ctx.sampleRate) * whooshFreq * Math.PI * 2) * 0.25;
          data[i] = (whiteNoise + whoosh) * envelope * 0.5;
        }
      }
      return buffer;
    };

    const initAudio = async () => {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const fallbackBuffer = createFallbackBuffer(audioContext);
        audioRef.current.audioContext = audioContext;
        audioRef.current.fallbackBuffer = fallbackBuffer;

        // Attempt to fetch "Newspaper Foley 4" sample
        const response = await fetch(FLIP_SAMPLE_URL, { mode: 'cors' });
        const arrayBuffer = await response.arrayBuffer();
        const sampleBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioRef.current.sampleBuffer = sampleBuffer;
      } catch (error) {
        console.warn('Kon realistische flipsound niet laden, gebruik fallback.', error);
      }
    };

    initAudio();

    return () => {
      try {
        audioContext?.close();
      } catch (e) {
        /* noop */
      }
    };
  }, []);

  const playFlipSound = useCallback(() => {
    if (!soundEnabled) return;
    const { audioContext, sampleBuffer, fallbackBuffer } = audioRef.current;
    if (!audioContext) return;

    try {
      if (audioContext.state === 'suspended') audioContext.resume();
      const source = audioContext.createBufferSource();
      source.buffer = sampleBuffer || fallbackBuffer;
      if (!source.buffer) return;

      const gainNode = audioContext.createGain();
      gainNode.gain.value = sampleBuffer ? 0.8 : 0.6;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      source.start(0);
    } catch (error) {
      console.warn('Kon flipsound niet afspelen.', error);
    }
  }, [soundEnabled]);

  // --- Dimensions & Responsive ---
  const updateDimensions = useCallback(() => {
    if (!containerRef.current) return;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const mobile = screenWidth < 768;
    setIsMobile(mobile);
    
    // Adjust dimensions based on available space
    // If fullscreen, we take almost everything. If not, we take container width/height
    const containerW = containerRef.current.clientWidth;
    // We subtract some space for the toolbar (bottom) and padding
    const availableH = isFullscreen ? screenHeight - 100 : Math.min(screenHeight * 0.8, 800);
    const availableW = isFullscreen ? screenWidth - 40 : containerW;

    if (mobile) {
      // Mobile: Single page
      const pageWidth = Math.min(availableW * 0.95, 500);
      const pageHeight = Math.min(pageWidth * 1.414, availableH);
      // Recalculate width from height to maintain aspect ratio if height is the limiting factor
      const finalWidth = Math.min(pageWidth, pageHeight / 1.414);
      setDimensions({ width: finalWidth, height: finalWidth * 1.414 });
    } else {
      // Desktop: Double page
      // Max width for one page
      const maxPageW = (availableW - 80) / 2;
      const maxPageH = availableH;
      
      let w = Math.min(maxPageW, maxPageH / 1.414);
      let h = w * 1.414;
      
      setDimensions({ width: w, height: h });
    }
  }, [isFullscreen]);

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
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
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
      className={`relative flex flex-col items-center bg-gray-100 transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen justify-center' : 'rounded-xl min-h-[600px] justify-center py-8'
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
           style={{ transform: `scale(${zoom})` }}
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
            showCover={true}
            mobileScrollSupport={true}
            onFlip={(e) => {
              setCurrentPage(e.data);
              playFlipSound();
            }}
            className="flipbook"
            style={{ margin: 0, padding: 0 }}
            startPage={0}
            drawShadow={true}
            flippingTime={600}
            usePortrait={isMobile}
            startZIndex={0}
            autoSize={false}
            maxShadowOpacity={0.4}
            showPageCorners={!isMobile}
            disableFlipByClick={false}
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
