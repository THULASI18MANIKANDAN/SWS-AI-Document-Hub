# SWS AI Document Hub

A full-stack Document Management Dashboard built for the SWS AI assessment.

## Features
1. **Single & Bulk Uploads**: Drag and drop PDFs with per-file progress bars.
2. **Background Processing**: Uploads of > 3 files trigger background processing and real-time Server-Sent Events (SSE) upon completion.
3. **Notification Center**: Persistent notifications stored in SQLite.

## Tech Stack
- **Frontend**: React, TailwindCSS, Babel (via CDN for a fast, no-build setup).
- **Backend**: Python 3.7+, FastAPI, SQLite.

## How to Run

1. Open a terminal and navigate to the `backend` folder:
   ```cmd
   cd backend
   ```
2. Install the requirements (ensure Python is installed):
   ```cmd
   pip install fastapi uvicorn python-multipart sqlalchemy sse-starlette aiofiles
   ```
3. Run the FastAPI server:
   ```cmd
   python -m uvicorn main:app --port 8000
   ```
4. Open your browser and go to:
   [http://127.0.0.1:8000/](http://127.0.0.1:8000/)

*(The frontend is statically served from the `frontend` folder directly by FastAPI).*

## Connecting to GitHub (Manual Instructions)
Since `git` is not installed on this specific machine, you can upload this code to your GitHub repository by doing the following:

1. Open your GitHub Repository: `https://github.com/THULASI18MANIKANDAN/SWS-AI-Document-Hub`
2. Click **Add file** > **Upload files**.
3. Drag and drop the `backend` and `frontend` folders from `c:\Users\Student.LIS-22\Downloads\SWS document hub` into the upload area on GitHub.
4. Click **Commit changes**.
