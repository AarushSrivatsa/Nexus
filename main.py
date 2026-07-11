import os
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
    title="Nexus",
    lifespan=lifespan,
    docs_url="/docs" if DEBUG else None,
    redoc_url="/redoc" if DEBUG else None,
    openapi_url="/openapi.json" if DEBUG else None,
    )

for router in router_list:
    app.include_router(router)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def serve_root():
    return FileResponse("static/index.html")

@app.get("/login")
async def serve_login():
    return FileResponse("static/login.html")

@app.get("/signup")
async def serve_signup():
    return FileResponse("static/signup.html")

@app.get("/reset-password")
async def serve_reset_password():
    return FileResponse("static/reset.html")

@app.get("/app")
async def serve_app():
    return FileResponse("static/app.html")
