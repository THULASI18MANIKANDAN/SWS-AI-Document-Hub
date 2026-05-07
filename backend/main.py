import asyncio
import os
import uuid
import datetime
from fastapi import FastAPI, File, UploadFile, Depends, BackgroundTasks, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from database import init_db, get_db, Document, Notification

app = FastAPI()

class ChatQuery(BaseModel):
    query: str


# Add CORS middleware to allow the frontend to interact with the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# A set to hold queues for connected clients
clients = set()

async def broadcast_notification(message: str):
    for q in list(clients):
        await q.put(message)

@app.on_event("startup")
def startup_event():
    init_db()

@app.get("/api/notifications/stream")
async def notification_stream(request: Request):
    """SSE Endpoint for real-time notifications"""
    client_queue = asyncio.Queue()
    clients.add(client_queue)
    
    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Wait for a new notification event with a small timeout to check for disconnects
                    message = await asyncio.wait_for(client_queue.get(), timeout=1.0)
                    yield {
                        "event": "message",
                        "data": message
                    }
                except asyncio.TimeoutError:
                    pass
        finally:
            clients.remove(client_queue)
            
    return EventSourceResponse(event_generator())

async def process_bulk_uploads(files: List[UploadFile], db: Session):
    """Background task to simulate processing multiple files and notify on completion."""
    # Simulate processing time
    await asyncio.sleep(2)
    
    saved_docs = []
    for file in files:
        file_ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # In a real background task we might read chunk by chunk, 
        # but here we read the buffered file
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
            
        # Create db entry
        doc = Document(
            filename=unique_filename,
            original_name=file.filename,
            size=len(content),
            type=file.content_type or "application/pdf",
            upload_status="complete"
        )
        db.add(doc)
        saved_docs.append(doc)
    
    db.commit()

    # Create notification
    notif = Notification(
        message=f"{len(files)} files uploaded successfully in the background.",
        type="success"
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    
    # Send SSE to clients
    await broadcast_notification(notif.message)


@app.post("/api/upload")
async def upload_files(background_tasks: BackgroundTasks, files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    """Handles both single/small uploads and bulk background uploads."""
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    # If > 3 files, handle in background
    if len(files) > 3:
        # Note: We must read contents into memory or a temp file before passing to background task in FastAPI, 
        # because the request stream will close. For simplicity in this prototype, we'll process synchronously 
        # but pretend it's in background, or just read the files and pass the data.
        # Let's read all files into memory. Warning: not scalable for huge files, but fine for prototype PDFs.
        
        saved_docs = []
        for file in files:
            content = await file.read()
            file_ext = os.path.splitext(file.filename)[1]
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)
            with open(file_path, "wb") as f:
                f.write(content)
            
            doc = Document(
                filename=unique_filename,
                original_name=file.filename,
                size=len(content),
                type=file.content_type or "application/pdf",
                upload_status="complete"
            )
            db.add(doc)
            saved_docs.append(doc)
            
        db.commit()
        
        # We simulate the delay in background to show the real-time notification
        async def delayed_notification(count: int):
            try:
                await asyncio.sleep(2)
                # Add notification
                db_session = next(get_db())
                notif = Notification(
                    message=f"{count} files uploaded successfully.",
                    type="success"
                )
                db_session.add(notif)
                db_session.commit()
                db_session.refresh(notif)
                # Trigger SSE
                await broadcast_notification(notif.message)
                db_session.close()
            except Exception as e:
                db_session = next(get_db())
                err_notif = Notification(
                    message=f"Bulk upload failed: system error.",
                    type="error"
                )
                db_session.add(err_notif)
                db_session.commit()
                db_session.refresh(err_notif)
                await broadcast_notification(err_notif.message)
                db_session.close()

        background_tasks.add_task(delayed_notification, len(files))
        return {"status": "processing", "message": f"Upload in progress — processing {len(files)} files in background."}

    else:
        # Synchronous processing for <= 3 files
        results = []
        success_count = 0
        for file in files:
            try:
                content = await file.read()
                file_ext = os.path.splitext(file.filename)[1]
                unique_filename = f"{uuid.uuid4()}{file_ext}"
                file_path = os.path.join(UPLOAD_DIR, unique_filename)
                
                with open(file_path, "wb") as f:
                    f.write(content)
                    
                doc = Document(
                    filename=unique_filename,
                    original_name=file.filename,
                    size=len(content),
                    type=file.content_type or "application/pdf",
                    upload_status="complete"
                )
                db.add(doc)
                db.commit()
                db.refresh(doc)
                results.append({
                    "id": doc.id,
                    "filename": doc.original_name,
                    "status": "complete"
                })
                success_count += 1
            except Exception as e:
                # Create an error notification
                err_notif = Notification(
                    message=f"Failed to upload {file.filename}.",
                    type="error"
                )
                db.add(err_notif)
                db.commit()
                db.refresh(err_notif)
                await broadcast_notification(err_notif.message)
            
        if success_count > 0:
            # Create notification for successful single/small uploads
            notif = Notification(
                message=f"{success_count} file(s) uploaded successfully.",
                type="success"
            )
            db.add(notif)
            db.commit()
            db.refresh(notif)
            
            # Trigger SSE for connected clients
            await broadcast_notification(notif.message)
            
        return {"status": "success", "files": results}

@app.get("/api/documents")
def get_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).order_by(Document.upload_date.desc()).all()
    return docs

@app.get("/api/documents/{doc_id}/download")
def download_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = os.path.join(UPLOAD_DIR, doc.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File on disk not found")
        
    return FileResponse(path=file_path, filename=doc.original_name, media_type=doc.type)

@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = os.path.join(UPLOAD_DIR, doc.filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        
    db.delete(doc)
    db.commit()
    return {"status": "deleted"}

@app.get("/api/notifications")
def get_notifications(db: Session = Depends(get_db)):
    return db.query(Notification).order_by(Notification.created_at.desc()).all()

@app.post("/api/notifications/{notif_id}/read")
def mark_notification_read(notif_id: int, db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notif_id).first()
    if notif:
        notif.is_read = True
        db.commit()
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Notification not found")

@app.post("/api/notifications/read_all")
def mark_all_read(db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"status": "success"}

@app.post("/api/chat")
async def chat_with_ai(query: ChatQuery):
    # This is a simulated backend response.
    # In a real scenario, you'd pass `query.query` to LangChain or LlamaIndex with a retriever here.
    await asyncio.sleep(1) # Simulate thinking time
    
    bot_response = f"This is a simulated AI response to your question: \"{query.query}\".\n\nTo make this feature fully operational, connect this endpoint to Anthropic's Claude API or OpenAI, and use a tool like LangChain to perform RAG over the uploaded documents."
    
    return {"response": bot_response}

# Serve the frontend directory using StaticFiles
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

app.mount("/static", StaticFiles(directory="../frontend"), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_index():
    with open("../frontend/index.html") as f:
        return f.read()
