import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import FlipbookViewer from './FlipbookViewer';
import MagazineGallery from './MagazineGallery';
import AdminPanel from './AdminPanel';
import LoginModal from './LoginModal';
import LightboxModal from './LightboxModal';
import useAuthStore from '../store/authStore';
import api from '../utils/api';

export default function MagazineViewer({ clientSlug }) {
  const [magazines, setMagazines] = useState([]);
  const [latestMagazine, setLatestMagazine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI State
  const [showLogin, setShowLogin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [lightboxMagazine, setLightboxMagazine] = useState(null);
  
  // Auth
  const { isAuthenticated, checkAuth } = useAuthStore();

  // Fetch magazines
  const fetchMagazines = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/magazines?client=${clientSlug}`);
      const allMagazines = response.data.magazines || [];
      
      if (allMagazines.length > 0) {
        setLatestMagazine(allMagazines[0]);
        setMagazines(allMagazines);
      } else {
        setLatestMagazine(null);
        setMagazines([]);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching magazines:', err);
      setError('Kon magazines niet laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientSlug) {
      fetchMagazines();
      checkAuth();
    }
  }, [clientSlug]);

  // Handle admin button click
  const handleAdminClick = () => {
    if (isAuthenticated) {
      setShowAdmin(true);
    } else {
      setShowLogin(true);
    }
  };

  // Handle successful login
  const handleLoginSuccess = () => {
    setShowLogin(false);
    setShowAdmin(true);
  };

  // Handle magazine click from gallery
  const handleMagazineClick = (magazine) => {
    setLightboxMagazine(magazine);
  };

  // Handle upload success
  const handleUploadSuccess = () => {
    fetchMagazines();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-500">Magazines laden...</p>
        </div>
      </div>
    );
  }

  if (error && !magazines.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Oeps!</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Latest Magazine Flipbook */}
        {latestMagazine ? (
          <section className="mb-12">
            <div className="text-center mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                {latestMagazine.title}
              </h1>
              <p className="text-gray-500 text-sm">
                {new Date(latestMagazine.created_at).toLocaleDateString('nl-NL', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            
            <FlipbookViewer 
              pdfUrl={latestMagazine.pdf_url} 
              title={latestMagazine.title}
            />
          </section>
        ) : (
          <section className="mb-12 text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Nog geen magazines
            </h2>
            <p className="text-gray-500">
              Upload je eerste magazine via het beheerpaneel.
            </p>
          </section>
        )}

        {/* Magazine Gallery */}
        {magazines.length > 1 && (
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
              Eerdere edities
            </h2>
            <MagazineGallery 
              magazines={magazines.slice(1)} 
              onMagazineClick={handleMagazineClick}
            />
          </section>
        )}
      </div>

      {/* Subtle Admin Button */}
      <button
        onClick={handleAdminClick}
        className="admin-trigger p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
        title="Beheer"
      >
        <Settings className="w-5 h-5 text-gray-600" />
      </button>

      {/* Login Modal */}
      <LoginModal 
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* Admin Panel */}
      <AdminPanel
        isOpen={showAdmin}
        onClose={() => setShowAdmin(false)}
        clientSlug={clientSlug}
        onUploadSuccess={handleUploadSuccess}
        magazines={magazines}
        onRefresh={fetchMagazines}
      />

      {/* Lightbox for viewing older magazines */}
      <LightboxModal
        magazine={lightboxMagazine}
        onClose={() => setLightboxMagazine(null)}
      />
    </div>
  );
}
