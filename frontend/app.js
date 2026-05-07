const { useState, useEffect, useRef } = React;

const API_BASE = "http://localhost:8000/api";

// Icons (Inline SVGs for no-build setup)
const Icons = {
  Upload: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  File: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Bell: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Download: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Trash: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  X: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
};

function App() {
  const [documents, setDocuments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  // Initial load
  useEffect(() => {
    fetchDocuments();
    fetchNotifications();

    // Setup SSE for real-time notifications
    const evtSource = new EventSource(`${API_BASE}/notifications/stream`);
    evtSource.onmessage = (event) => {
      // When a server-side bulk upload finishes
      fetchDocuments();
      fetchNotifications();
      showToast(event.data);
    };

    return () => evtSource.close();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`);
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications`);
      const data = await res.json();
      setNotifications(data);
    } catch (err) {
      console.error(err);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleFiles = async (filesArray) => {
    if (filesArray.length === 0) return;

    // Filter PDFs only based on requirement (or allow all, but we filter loosely)
    
    if (filesArray.length > 3) {
      // Bulk upload
      showToast(`Upload in progress — processing ${filesArray.length} files in background.`);
      const formData = new FormData();
      filesArray.forEach(f => formData.append("files", f));
      
      try {
        await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          body: formData
        });
        // The SSE will notify us when this completes!
      } catch (err) {
        console.error("Bulk upload failed", err);
      }
    } else {
      // Individual upload
      const newUploads = filesArray.map(f => ({
        id: Math.random().toString(),
        file: f,
        name: f.name,
        size: (f.size / 1024).toFixed(1) + ' KB',
        progress: 0,
        status: 'uploading'
      }));

      setUploadingFiles(prev => [...newUploads, ...prev]);

      // Process each file with simulated progress
      newUploads.forEach(async (uploadObj) => {
        // Simulate progress bar before actual upload
        let prog = 0;
        const interval = setInterval(() => {
          prog += 20;
          if (prog > 90) clearInterval(interval);
          setUploadingFiles(prev => prev.map(p => p.id === uploadObj.id ? { ...p, progress: prog } : p));
        }, 200);

        const formData = new FormData();
        formData.append("files", uploadObj.file);

        try {
          await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
          });
          
          clearInterval(interval);
          setUploadingFiles(prev => prev.map(p => p.id === uploadObj.id ? { ...p, progress: 100, status: 'complete' } : p));
          fetchDocuments();
        } catch (err) {
          clearInterval(interval);
          setUploadingFiles(prev => prev.map(p => p.id === uploadObj.id ? { ...p, status: 'failed' } : p));
        }
      });
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    if (e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
  };

  const onDragLeave = (e) => {
    e.currentTarget.classList.remove('dragover');
  };

  const markRead = async (id) => {
    await fetch(`${API_BASE}/notifications/${id}/read`, { method: 'POST' });
    fetchNotifications();
  };

  const markAllRead = async () => {
    await fetch(`${API_BASE}/notifications/read_all`, { method: 'POST' });
    fetchNotifications();
  };

  const deleteDoc = async (id) => {
    await fetch(`${API_BASE}/documents/${id}`, { method: 'DELETE' });
    fetchDocuments();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-brand-blue text-white px-6 py-3 rounded-lg shadow-xl toast-enter flex items-center z-50">
          <Icons.Check />
          <span className="ml-3 font-medium">{toast}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-3">
          <div className="bg-brand-blue text-white p-2 rounded-lg">
            <Icons.File />
          </div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">SWS AI Document Hub</h1>
        </div>
        
        <div className="relative">
          <button 
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition relative"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Icons.Bell />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification Center */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-semibold text-gray-700">Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-sm text-brand-blue hover:underline">Mark all read</button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">No notifications yet.</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer ${!n.is_read ? 'bg-blue-50/50' : ''}`} onClick={() => markRead(n.id)}>
                      <p className={`text-sm ${!n.is_read ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{n.message}</p>
                      <span className="text-xs text-gray-400 mt-1 block">{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-8 space-y-10">
        
        {/* Upload Section */}
        <section>
          <div 
            className="upload-zone bg-white rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer shadow-sm"
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current.click()}
          >
            <input 
              type="file" 
              multiple 
              className="hidden" 
              ref={fileInputRef}
              onChange={(e) => handleFiles(Array.from(e.target.files))}
              accept="application/pdf"
            />
            <div className="bg-blue-50 text-brand-blue p-4 rounded-full mb-4">
              <Icons.Upload />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Drop files here or click to browse</h2>
            <p className="text-gray-500 text-sm mb-6">PDF files only • Up to 20 MB per file</p>
            <div className="flex gap-3">
              <span className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">Single file</span>
              <span className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">Bulk upload</span>
              <span className="px-4 py-1.5 bg-blue-100 text-brand-blue rounded-full text-sm font-medium">Try 4+ files to trigger notifications</span>
            </div>
          </div>
        </section>

        {/* Upload Progress Queue */}
        {uploadingFiles.length > 0 && (
          <section>
            <div className="flex justify-between items-end mb-4">
              <h3 className="text-lg font-bold text-gray-800">Upload Queue</h3>
              <button 
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={() => setUploadingFiles([])}
              >
                Clear all
              </button>
            </div>
            <div className="space-y-3">
              {uploadingFiles.map(file => (
                <div key={file.id} className={`p-4 rounded-xl border flex items-center justify-between ${file.status === 'complete' ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`p-2 rounded-lg ${file.status === 'complete' ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-brand-blue'}`}>
                      {file.status === 'complete' ? <Icons.Check /> : <Icons.File />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-gray-800 text-sm">{file.name}</span>
                        <span className="text-xs text-gray-500">{file.size}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1 overflow-hidden">
                        <div 
                          className={`h-1.5 rounded-full transition-all duration-300 ${file.status === 'complete' ? 'bg-green-500' : 'bg-brand-blue'}`} 
                          style={{ width: `${file.progress}%` }}
                        ></div>
                      </div>
                      <span className={`text-xs ${file.status === 'complete' ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                        {file.status === 'complete' ? 'Upload complete' : `${Math.round(file.progress)}%`}
                      </span>
                    </div>
                  </div>
                  <button className="ml-4 text-gray-400 hover:text-gray-600">
                    <Icons.X />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Document Library */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-bold text-gray-800">Document Library</h3>
            <span className="text-sm text-gray-500">{documents.length} documents</span>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            {documents.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <div className="text-gray-300 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <p className="text-gray-500 font-medium">No documents yet</p>
                <p className="text-gray-400 text-sm mt-1">Upload files above — they'll appear here once complete</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 text-xs text-gray-500 font-semibold tracking-wider uppercase border-b border-gray-100">
                    <th className="p-4 pl-6">Name</th>
                    <th className="p-4">Size</th>
                    <th className="p-4">Uploaded At</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50/50 transition">
                      <td className="p-4 pl-6 flex items-center gap-3">
                        <span className="text-brand-blue opacity-70"><Icons.File /></span>
                        <span className="text-gray-800 font-medium text-sm">{doc.original_name}</span>
                      </td>
                      <td className="p-4 text-sm text-gray-500">{(doc.size / 1024).toFixed(1)} KB</td>
                      <td className="p-4 text-sm text-gray-500">{new Date(doc.upload_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      <td className="p-4 pr-6 flex justify-end gap-3 text-brand-blue">
                        <a href={`${API_BASE}/documents/${doc.id}/download`} download className="p-1.5 hover:bg-blue-50 rounded-lg transition" title="Download">
                          <Icons.Download />
                        </a>
                        <button onClick={() => deleteDoc(doc.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition" title="Delete">
                          <Icons.Trash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
