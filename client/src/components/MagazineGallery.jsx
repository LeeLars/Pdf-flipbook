import { useState, useMemo, useEffect, useRef } from 'react';
import { Filter } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Simple in-memory cache per session so we don't re-render the same PDF covers repeatedly
const coverCache = new Map();

export default function MagazineGallery({ magazines, onMagazineClick }) {
  const [selectedYear, setSelectedYear] = useState('all');

  // Get unique years from magazines
  const years = useMemo(() => {
    if (!magazines) return [];
    const uniqueYears = [...new Set(
      magazines.map(m => new Date(m.created_at).getFullYear())
    )].sort((a, b) => b - a);
    return uniqueYears;
  }, [magazines]);

  // Filter magazines by year
  const filteredMagazines = useMemo(() => {
    if (!magazines) return [];
    if (selectedYear === 'all') return magazines;
    return magazines.filter(m => 
      new Date(m.created_at).getFullYear() === parseInt(selectedYear)
    );
  }, [magazines, selectedYear]);

  if (!magazines || magazines.length === 0) {
    return null;
  }

  return (
    <div>
      {/* Year filter - only show if there are multiple years */}
      {years.length > 1 && (
        <div className="flex items-center gap-2 mb-6">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedYear('all')}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedYear === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Alle jaren
            </button>
            {years.map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year.toString())}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedYear === year.toString()
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredMagazines.map((magazine) => (
          <MagazineCard 
            key={magazine.id} 
            magazine={magazine} 
            onClick={() => onMagazineClick(magazine)}
          />
        ))}
      </div>

      {filteredMagazines.length === 0 && selectedYear !== 'all' && (
        <p className="text-center text-gray-500 py-8">
          Geen magazines gevonden voor {selectedYear}
        </p>
      )}
    </div>
  );
}

function MagazineCard({ magazine, onClick }) {
  const cardRef = useRef(null);
  const canvasRef = useRef(null);
  const [imageError, setImageError] = useState(false);
  const [coverReady, setCoverReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Always try to generate cover from PDF when image fails or doesn't exist
  useEffect(() => {
    // If we have a working cover_url, don't generate
    if (magazine.cover_url && !imageError) return;
    
    // If no PDF url, can't generate
    if (!magazine.pdf_url) {
      setLoadError(true);
      return;
    }

    // Check cache first
    const cacheKey = magazine.id || magazine.pdf_url;
    if (coverCache.has(cacheKey)) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          setCoverReady(true);
        };
        img.src = coverCache.get(cacheKey);
      }
      return;
    }

    // Generate cover from PDF
    const generateCover = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: magazine.pdf_url,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@4.0.379/cmaps/',
          cMapPacked: true,
        });
        
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const canvas = canvasRef.current;
        if (!canvas) return;

        const viewport = page.getViewport({ scale: 1 });
        const targetWidth = 400;
        const scale = targetWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        const context = canvas.getContext('2d');

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        // Cache the result
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        coverCache.set(cacheKey, dataUrl);
        setCoverReady(true);
      } catch (err) {
        console.error('Error generating cover for', magazine.title, err);
        setLoadError(true);
      }
    };

    generateCover();
  }, [magazine.pdf_url, magazine.cover_url, magazine.id, magazine.title, imageError]);

  // Determine what to show
  const showCoverImage = magazine.cover_url && !imageError;
  const showCanvas = !showCoverImage && !loadError;
  const showFallback = loadError && !showCoverImage;

  return (
    <button
      ref={cardRef}
      onClick={onClick}
      className="magazine-card bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl text-left w-full group transition-all duration-300 hover:-translate-y-1"
    >
      {/* Cover */}
      <div className="aspect-[3/4] bg-gray-100 relative overflow-hidden">
        {/* Try cover_url first */}
        {showCoverImage && (
          <img
            src={magazine.cover_url}
            alt={magazine.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        )}

        {/* Canvas for PDF-generated cover */}
        {showCanvas && (
          <>
            <canvas 
              ref={canvasRef}
              className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-300 ${coverReady ? 'opacity-100' : 'opacity-0'}`}
            />
            {!coverReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-xs text-gray-400">Laden...</span>
              </div>
            )}
          </>
        )}

        {/* Fallback icon when everything fails */}
        {showFallback && (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <div className="text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="text-xs text-gray-400">Magazine</span>
            </div>
          </div>
        )}
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="bg-white/90 backdrop-blur px-4 py-2 rounded-full text-sm font-medium text-gray-800 shadow-sm transform translate-y-2 group-hover:translate-y-0 transition-transform">
            Lezen
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="p-3 border-t border-gray-50">
        <h3 className="font-medium text-gray-900 text-sm line-clamp-2 text-center group-hover:text-blue-600 transition-colors">
          {magazine.title}
        </h3>
      </div>
    </button>
  );
}
