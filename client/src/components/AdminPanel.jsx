import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  X, Upload, Trash2, Eye, EyeOff, Loader2, 
  CheckCircle, AlertCircle, LogOut, FileText, GripVertical 
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
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [orderedMagazines, setOrderedMagazines] = useState([]);
  
  const { logout, user } = useAuthStore();

  // Keep ordered magazines in sync
  useEffect(() => {
    if (magazines) {
      setOrderedMagazines([...magazines]);
    }
  }, [magazines]);

  // Parse filename to generate formatted title
  const parseFilenameToTitle = (filename) => {
    const name = filename.replace(/\.pdf$/i, '');
    
    const monthMap = {
      'JAN': 'Januari', 'FEB': 'Februari', 'FEBR': 'Februari',
      'MRT': 'Maart', 'MAART': 'Maart', 'APR': 'April',
      'MEI': 'Mei', 'JUN': 'Juni', 'JUL': 'Juli',
      'AUG': 'Augustus', 'SEP': 'September', 'SEPT': 'September',
      'OKT': 'Oktober', 'NOV': 'November', 'DEC': 'December'
    };
    
    const parts = name.toUpperCase().split(/[_\-\s]+/);
    let month = null;
    let year = null;
    
    for (const part of parts) {
      if (monthMap[part]) month = monthMap[part];
      if (/^20\d{2}$/.test(part)) year = part;
    }
    
    if (month && year) {
      return `Vrije Tijd - ${month} ${year}`;
    }
    return name.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
  };

  // Dropzone configuration - multiple files
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const filesWithTitles = acceptedFiles.map(file => ({
        file,
        title: parseFilenameToTitle(file.name)
      }));
      setSelectedFiles(filesWithTitles);
      setUploadError(null);
      setUploadSuccess(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true,
    maxSize: 100 * 1024 * 1024 // 100MB per file
  });

  // Remove a file from selection
  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle upload of all files
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadError('Selecteer minstens één PDF');
      return;
    }

    setUploading(true);
    setUploadError(null);
    
    let successCount = 0;
    const totalFiles = selectedFiles.length;

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const { file, title } = selectedFiles[i];
        setUploadProgress(Math.round(((i) / totalFiles) * 100));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title.trim());
        formData.append('client_slug', clientSlug);

        await api.post('/magazines', formData);
        successCount++;
      }

      setUploadProgress(100);
      setUploadSuccess(true);
      setSelectedFiles([]);
      
      // Refresh magazine list
      onUploadSuccess();
      
      // Reset success message after delay
      setTimeout(() => {
        setUploadSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(`${successCount}/${totalFiles} geüpload. Fout: ${error.response?.data?.error || 'Upload mislukt'}`);
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

  // Drag and drop handlers for reordering
  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;
    
    const items = [...(magazines || [])];
    const draggedItemContent = items[draggedItem];
    items.splice(draggedItem, 1);
    items.splice(index, 0, draggedItemContent);
    
    setOrderedMagazines(items);
    setDraggedItem(index);
  };

  const handleDragEnd = async () => {
    if (draggedItem === null) return;
    
    // Save new order to backend
    try {
      const orderData = orderedMagazines.map((mag, index) => ({
        id: mag.id,
        sort_order: index
      }));
      await api.patch('/magazines/reorder', { order: orderData });
      onRefresh();
    } catch (error) {
      console.error('Reorder error:', error);
    }
    
    setDraggedItem(null);
  };

  if (!isOpen) return null;
  
  const displayMagazines = orderedMagazines.length > 0 ? orderedMagazines : magazines;

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
              className={`dropzone ${isDragActive ? 'active' : ''} ${selectedFiles.length > 0 ? 'border-green-400 bg-green-50' : ''}`}
            >
              <input {...getInputProps()} />
              
              {selectedFiles.length > 0 ? (
                <div className="text-center">
                  <FileText className="w-10 h-10 text-green-600 mx-auto mb-2" />
                  <p className="font-medium text-gray-900">{selectedFiles.length} bestand(en) geselecteerd</p>
                  <p className="text-sm text-gray-500">Klik om meer toe te voegen</p>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">
                    {isDragActive ? 'Laat los om te uploaden' : 'Sleep je PDF\'s hierheen'}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    of klik om bestanden te selecteren (meerdere mogelijk)
                  </p>
                </>
              )}
            </div>

            {/* Selected files list */}
            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {selectedFiles.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-500">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                ))}
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
                <span className="text-sm">Magazines succesvol geüpload!</span>
              </div>
            )}

            {/* Upload button */}
            {selectedFiles.length > 0 && !uploading && (
              <button
                onClick={handleUpload}
                className="mt-4 w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" />
                {selectedFiles.length === 1 ? 'Uploaden' : `${selectedFiles.length} bestanden uploaden`}
              </button>
            )}
          </div>

          {/* Magazine List */}
          <div className="p-6">
            <h3 className="font-medium text-gray-900 mb-4">
              Bestaande edities ({magazines?.length || 0})
            </h3>

            {displayMagazines && displayMagazines.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 mb-2">Sleep om de volgorde te wijzigen</p>
                {displayMagazines.map((magazine, index) => (
                  <div 
                    key={magazine.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-move transition-all ${
                      draggedItem === index ? 'opacity-50 scale-95' : ''
                    }`}
                  >
                    {/* Drag handle */}
                    <div className="text-gray-400 hover:text-gray-600">
                      <GripVertical className="w-5 h-5" />
                    </div>

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
