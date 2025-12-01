import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  X, Upload, Trash2, Eye, EyeOff, Loader2, 
  CheckCircle, AlertCircle, LogOut, FileText 
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';

export default function AdminPanel({ 
  isOpen, 
  onClose, 
  clientSlug, 
  onUploadSuccess,
  magazines,
  onRefresh 
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  
  const { logout, user } = useAuthStore();

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      setUploadError(null);
      setUploadSuccess(false);
      
      // Auto-generate title from filename
      const nameWithoutExt = file.name.replace(/\.pdf$/i, '');
      setTitle(nameWithoutExt);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024 // 100MB
  });

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) {
      setUploadError('Selecteer een PDF en vul een titel in');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', title.trim());
      formData.append('client_slug', clientSlug);

      setUploadProgress(30);

      const response = await api.post('/magazines', formData);

      setUploadProgress(100);
      setUploadSuccess(true);
      setSelectedFile(null);
      setTitle('');
      
      // Refresh magazine list
      onUploadSuccess();
      
      // Reset success message after delay
      setTimeout(() => {
        setUploadSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.response?.data?.error || 'Upload mislukt');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle delete
  const handleDelete = async (magazineId) => {
    if (!confirm('Weet je zeker dat je dit magazine wilt verwijderen?')) {
      return;
    }

    try {
      await api.delete(`/magazines/${magazineId}`);
      onRefresh();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Verwijderen mislukt');
    }
  };

  // Handle toggle publish
  const handleTogglePublish = async (magazine) => {
    try {
      await api.patch(`/magazines/${magazine.id}`, {
        is_published: !magazine.is_published
      });
      onRefresh();
    } catch (error) {
      console.error('Toggle publish error:', error);
      alert('Wijzigen mislukt');
    }
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-backdrop bg-black/50">
      <div 
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Beheerpaneel</h2>
            <p className="text-sm text-gray-500">Ingelogd als {user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors text-gray-600"
              title="Uitloggen"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Upload Section */}
          <div className="p-6 border-b">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Nieuwe editie uploaden
            </h3>

            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`dropzone ${isDragActive ? 'active' : ''} ${selectedFile ? 'border-green-400 bg-green-50' : ''}`}
            >
              <input {...getInputProps()} />
              
              {selectedFile ? (
                <div className="flex items-center gap-3">
                  <FileText className="w-10 h-10 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">
                    {isDragActive ? 'Laat los om te uploaden' : 'Sleep je PDF hierheen'}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    of klik om een bestand te selecteren
                  </p>
                </>
              )}
            </div>

            {/* Title input */}
            {selectedFile && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titel
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  placeholder="bijv. Vrije Tijd - Augustus 2025"
                />
              </div>
            )}

            {/* Upload progress */}
            {uploading && (
              <div className="mt-4">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary-600 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2 text-center">
                  Uploaden... {uploadProgress}%
                </p>
              </div>
            )}

            {/* Error message */}
            {uploadError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{uploadError}</span>
              </div>
            )}

            {/* Success message */}
            {uploadSuccess && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">Magazine succesvol geüpload!</span>
              </div>
            )}

            {/* Upload button */}
            {selectedFile && !uploading && (
              <button
                onClick={handleUpload}
                disabled={!title.trim()}
                className="mt-4 w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Uploaden
              </button>
            )}
          </div>

          {/* Magazine List */}
          <div className="p-6">
            <h3 className="font-medium text-gray-900 mb-4">
              Bestaande edities ({magazines?.length || 0})
            </h3>

            {magazines && magazines.length > 0 ? (
              <div className="space-y-3">
                {magazines.map((magazine) => (
                  <div 
                    key={magazine.id}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-16 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                      {magazine.cover_url ? (
                        <img 
                          src={magazine.cover_url} 
                          alt={magazine.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {magazine.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(magazine.created_at).toLocaleDateString('nl-NL')}
                        {magazine.page_count > 0 && ` • ${magazine.page_count} pagina's`}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTogglePublish(magazine)}
                        className={`p-2 rounded-lg transition-colors ${
                          magazine.is_published 
                            ? 'hover:bg-gray-200 text-green-600' 
                            : 'hover:bg-gray-200 text-gray-400'
                        }`}
                        title={magazine.is_published ? 'Verbergen' : 'Publiceren'}
                      >
                        {magazine.is_published ? (
                          <Eye className="w-5 h-5" />
                        ) : (
                          <EyeOff className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(magazine.id)}
                        className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-colors"
                        title="Verwijderen"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Nog geen magazines geüpload
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
