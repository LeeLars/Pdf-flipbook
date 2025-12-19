import { useState, useMemo, useEffect, useRef } from 'react';
import { Filter } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Reduce PDF.js memory usage in production
if (typeof window !== 'undefined') {
  // Limit cache size to prevent memory issues
  pdfjsLib.GlobalWorkerOptions.maxCanvasPixels = 1024 * 1024 * 10; // 10MB limit
}

// Simple in-memory cache per session so we don't re-render the same PDF covers repeatedly
const coverCache = new Map();
const MAX_CACHE_SIZE = 20; // Limit cache size

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
  const [coverUrl, setCoverUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadCover = async () => {
      console.log('🔍 Loading cover for:', magazine.title, 'cover_url:', magazine.cover_url, 'pdf_url:', magazine.pdf_url);

      // TEMP: Always generate from PDF first to debug
      if (magazine.pdf_url) {
        console.log('📄 Generating cover from PDF (forced)');
        generateFromPdf();
        return;
      }

      // Fallback: try cover_url if no PDF
      if (magazine.cover_url) {
        console.log('📸 Testing cover_url (fallback):', magazine.cover_url);
        // Test if the image loads
        const img = new Image();
        img.onload = () => {
          console.log('✅ Cover URL loaded successfully:', magazine.cover_url);
          if (!cancelled) {
            setCoverUrl(magazine.cover_url);
            setLoading(false);
          }
        };
        img.onerror = () => {
          console.log('❌ Cover URL failed:', magazine.cover_url);
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
        };
        img.src = magazine.cover_url;
        return;
      }

      console.log('❌ No cover_url or pdf_url available');
      setError(true);
      setLoading(false);
    };

    const generateFromPdf = async () => {
      if (!magazine.pdf_url) {
        setError(true);
        setLoading(false);
        return;
      }

      // Check cache
      const cacheKey = magazine.id || magazine.pdf_url;
      if (coverCache.has(cacheKey)) {
        if (!cancelled) {
          setCoverUrl(coverCache.get(cacheKey));
          setLoading(false);
        }
        return;
      }

      try {
        const loadingTask = pdfjsLib.getDocument({
          url: magazine.pdf_url,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@4.0.379/cmaps/',
          cMapPacked: true,
        });
        
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        
        const page = await pdf.getPage(1);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1 });
        const targetWidth = 350;
        const scale = targetWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        const context = canvas.getContext('2d');

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        if (cancelled) return;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        coverCache.set(cacheKey, dataUrl);
        setCoverUrl(dataUrl);
        setLoading(false);

        // Clean up canvas to free memory
        canvas.width = 1;
        canvas.height = 1;
        context.clearRect(0, 0, 1, 1);
      } catch (err) {
        console.error('Cover generation failed:', magazine.title);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    loadCover();

    return () => { cancelled = true; };
  }, [magazine.id, magazine.pdf_url, magazine.cover_url, magazine.title]);

  return (
    <button
      onClick={onClick}
      className="magazine-card bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl text-left w-full group transition-all duration-300 hover:-translate-y-1"
    >
      {/* Cover */}
      <div className="bg-gray-50 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
        
        {coverUrl && (
          <img
            src={coverUrl}
            alt={magazine.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}

        {error && !coverUrl && (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        )}
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="bg-white/90 backdrop-blur px-4 py-2 rounded-full text-sm font-medium text-gray-800 shadow-sm">
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
