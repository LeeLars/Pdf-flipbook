import { useState, useMemo } from 'react';
import { Filter } from 'lucide-react';

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
  return (
    <button
      onClick={onClick}
      className="magazine-card bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl text-left w-full group"
    >
      {/* Cover Image */}
      <div className="aspect-[3/4] bg-gray-100 relative overflow-hidden">
        {magazine.cover_url ? (
          <img
            src={magazine.cover_url}
            alt={magazine.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        )}
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-4 py-2 rounded-full text-sm font-medium text-gray-800">
            Bekijken
          </span>
        </div>
      </div>

      {/* Title only - no date */}
      <div className="p-3">
        <h3 className="font-medium text-gray-900 text-sm line-clamp-2 text-center">
          {magazine.title}
        </h3>
      </div>
    </button>
  );
}
