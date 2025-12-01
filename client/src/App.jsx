import { Routes, Route, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import MagazineViewer from './components/MagazineViewer';

function App() {
  // Detect if embedded in iframe and add class to html
  useEffect(() => {
    if (window.self !== window.top) {
      document.documentElement.classList.add('embedded');
    }
  }, []);

  return (
    <Routes>
      {/* Main embed route - clientSlug determines which magazines to show */}
      <Route path="/:clientSlug" element={<MagazineViewerWrapper />} />
      
      {/* Fallback for root - show demo or instructions */}
      <Route path="/" element={<DefaultView />} />
    </Routes>
  );
}

function MagazineViewerWrapper() {
  const { clientSlug } = useParams();
  return <MagazineViewer clientSlug={clientSlug} />;
}

function DefaultView() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <div className="text-center max-w-lg">
        <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">PDF Flipbook Viewer</h1>
        <p className="text-gray-600 mb-6">
          Gebruik deze URL in je iframe met een client slug:
        </p>
        <code className="block bg-gray-100 p-4 rounded-lg text-sm text-gray-800 mb-6">
          {window.location.origin}/<span className="text-primary-600">jouw-client-slug</span>
        </code>
        <p className="text-sm text-gray-500">
          Voorbeeld: <code className="bg-gray-100 px-2 py-1 rounded">/vrije-tijd</code>
        </p>
      </div>
    </div>
  );
}

export default App;
