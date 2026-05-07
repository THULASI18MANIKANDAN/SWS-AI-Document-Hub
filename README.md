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

## Upload Architecture & Notifications
*(Updated: 2026-05-07T13:37:38+05:30)*

- **Single/Small Uploads (<=3 files):** Processed synchronously. The frontend displays per-file simulated progress bars, and the backend handles each file immediately.
- **Bulk Uploads (>3 files):** Triggers asynchronous background processing in FastAPI.
- **SSE Notifications:** Upon completion of a bulk upload background task, a notification is saved to the SQLite database and pushed to an `asyncio.Queue`. The frontend receives this via the `EventSource` API and displays a real-time toast notification.

## GitHub Information
This repository is configured to push to GitHub. You can commit and push changes directly from the command line using:
```cmd
git add .
git commit -m "Update"
git push
```
