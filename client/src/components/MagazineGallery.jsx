import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  const [imageError, setImageError] = useState(false);
  const [coverGenerated, setCoverGenerated] = useState(false);
  const [coverDataUrl, setCoverDataUrl] = useState(null);
  const [isInView, setIsInView] = useState(false);
  const [loadingCover, setLoadingCover] = useState(false);

  // Observe when the card enters the viewport so we only render PDFs when needed
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '250px' }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const generateCover = useCallback(async () => {
    if (!magazine.pdf_url || loadingCover || coverGenerated) return;

    const cacheKey = magazine.id || magazine.pdf_url;
    if (coverCache.has(cacheKey)) {
      setCoverDataUrl(coverCache.get(cacheKey));
      setCoverGenerated(true);
      return;
    }

    try {
      setLoadingCover(true);
      const loadingTask = pdfjsLib.getDocument({ url: magazine.pdf_url, withCredentials: false });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);

      const viewport = page.getViewport({ scale: 1 });
      const targetWidth = 450; // px for better clarity on retina displays
      const scale = targetWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      const context = canvas.getContext('2d');

      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
        renderInteractiveForms: false
      }).promise;

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      coverCache.set(cacheKey, dataUrl);
      setCoverDataUrl(dataUrl);
      setCoverGenerated(true);
    } catch (err) {
      console.error('Error generating cover:', err);
    } finally {
      setLoadingCover(false);
    }
  }, [magazine.pdf_url, loadingCover, coverGenerated, magazine.id]);

  // Trigger cover generation when needed
  useEffect(() => {
    if (!isInView) return;
    if (magazine.cover_url && !imageError) return;
    generateCover();
  }, [isInView, magazine.cover_url, imageError, generateCover]);

  const showGeneratedCover = (!magazine.cover_url || imageError) && coverGenerated && coverDataUrl;

  return (
    <button
      ref={cardRef}
      onClick={onClick}
      className="magazine-card bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl text-left w-full group transition-all duration-300 hover:-translate-y-1"
    >
      {/* Cover Image */}
      <div className="aspect-[3/4] bg-gray-100 relative overflow-hidden">
        {magazine.cover_url && !imageError ? (
          <img
            src={magazine.cover_url}
            alt={magazine.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : showGeneratedCover ? (
          <img
            src={coverDataUrl}
            alt={magazine.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-300">
            <div className="w-10 h-10 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin" />
            <span className="text-xs text-gray-400">Cover laden...</span>
          </div>
        )}
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="bg-white/90 backdrop-blur px-4 py-2 rounded-full text-sm font-medium text-gray-800 shadow-sm transform translate-y-2 group-hover:translate-y-0 transition-transform">
            Lezen
          </span>
        </div>
      </div>

      {/* Title only - no date */}
      <div className="p-3 border-t border-gray-50">
        <h3 className="font-medium text-gray-900 text-sm line-clamp-2 text-center group-hover:text-blue-600 transition-colors">
          {magazine.title}
        </h3>
      </div>
    </button>
  );
}
