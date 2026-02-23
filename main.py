from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from routers.authentication import router as authentication_router
from routers.conversations import router as conversation_router
from routers.messages import router as message_router
from routers.models import router as model_router

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from contextlib import asynccontextmanager
from utilities.scheduled_tasks import delete_unnecessary_otps_in_db
import os

scheduler = AsyncIOScheduler()
router_list = [authentication_router,conversation_router,message_router,model_router]
task_list = [delete_unnecessary_otps_in_db]

@asynccontextmanager
async def lifespan(app: FastAPI):
    for task in task_list:
        scheduler.add_job(task,CronTrigger(hour=0,minute=0,timezone="Asia/Kolkata"))
    scheduler.start()
    yield
    scheduler.shutdown()

DEBUG = os.getenv("DEBUG", "false").lower() == "true"

app = FastAPI(
    title="Chatbot Wrapper Backend",
    description="""
Built by **Aarush Srivatsa**
GitHub Docs Link: https://github.com/AarushSrivatsa/Chatbot-Wrapper-Project-Backend-OpenDocs
Linkedin Profile: https://www.linkedin.com/in/aarushsrivatsa/
""", lifespan=lifespan,     
    docs_url="/docs" if DEBUG else None,
    redoc_url="/redoc" if DEBUG else None,
    openapi_url="/openapi.json" if DEBUG else None,)

for router in router_list:
    app.include_router(router)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def serve_frontend():
    return FileResponse("static/app.html")