from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database.models import ConvoModel, MessageModel, UserModel
from database.initialization import get_db, AsyncSessionLocal
from security.tokens import get_user_from_access_token
from AI.LLM import get_ai_response
from AI.RAG import add_to_rag
from config import MESSAGE_LIMIT
from datetime import datetime, timezone
from AI.image_processing import image_to_text
from config import FILE_EVENT_PREFIX

router = APIRouter(
    prefix="/api/v1/conversations/{conversation_id}/messages",
    tags=["messages"]
)

DEFAULT_MODEL = "moonshotai/kimi-k2-instruct-0905"
DEFAULT_PROVIDER = "groq"
MAX_DOCUMENT_SIZE = 10 * 1024 * 1024
MAX_IMAGE_SIZE = 10 * 1024 * 1024

class message_response_schema(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

@router.get("/", response_model=list[message_response_schema])
async def get_messages(
    conversation_id: UUID,
    current_user: UserModel = Depends(get_user_from_access_token),
    db: AsyncSession = Depends(get_db)
):
    conversation = await db.execute(
        select(ConvoModel).where(
            ConvoModel.id == conversation_id,
            ConvoModel.user_id == current_user.id
        )
    )
    conversation = conversation.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation Not Found")

    messages = await db.execute(
        select(MessageModel)
        .where(MessageModel.conversation_id == conversation_id)
        .order_by(MessageModel.created_at.asc())
    )
    return messages.scalars().all()


class message_request_schema(BaseModel):
    message: str
    model: str = DEFAULT_MODEL
    provider: str = DEFAULT_PROVIDER


@router.post("/", response_model=message_response_schema)
async def post_message(
    conversation_id: UUID,
    message_request: message_request_schema,
    current_user: UserModel = Depends(get_user_from_access_token),
    db: AsyncSession = Depends(get_db),
):
    conversation = await db.execute(
        select(ConvoModel).where(
            ConvoModel.id == conversation_id,
            ConvoModel.user_id == current_user.id
        )
    )
    conversation = conversation.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation Not Found")

    messages = await db.execute(
        select(MessageModel)
        .where(MessageModel.conversation_id == conversation_id)
        .order_by(MessageModel.created_at.desc())
        .limit(MESSAGE_LIMIT)
    )
    messages = list(reversed(messages.scalars().all()))

    ai_response = await get_ai_response(
        user_message=message_request.message,
        conversation_id=conversation_id,
        messages=messages,
        model=message_request.model,
        provider=message_request.provider,
    )

    db.add(MessageModel(conversation_id=conversation_id, role="user", content=message_request.message))
    ai_message = MessageModel(conversation_id=conversation_id, role="assistant", content=ai_response)
    db.add(ai_message)
    conversation.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(ai_message)
    return ai_message


class post_document_response_schema(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


@router.post("/documents", response_model=post_document_response_schema)
async def post_documents(
    conversation_id: UUID,
    file: UploadFile = File(...),
    current_user: UserModel = Depends(get_user_from_access_token),
):
    document_extensions = [".pdf", ".txt", ".docx"]
    ext = file.filename.split(".")[-1].lower()
    if "." + ext not in document_extensions:
        raise HTTPException(status_code=400, detail="Invalid file type")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ConvoModel).where(
                ConvoModel.id == conversation_id,
                ConvoModel.user_id == current_user.id
            )
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conversation.updated_at = datetime.now(timezone.utc)
        await db.commit()

    file_bytes = await file.read()
    if len(file_bytes) > MAX_DOCUMENT_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")

    try:
        await run_in_threadpool(add_to_rag, conversation_id, file_bytes, file.filename)
    except Exception as e:
        print("RAG ERROR:", repr(e))
        raise HTTPException(status_code=500, detail="Failed to add document")

    document_prompt = f"""The user has uploaded a document that has been processed and added to your knowledge base for this conversation. You can now answer questions about its contents using your RAG tool.

Filename: {file.filename}

Respond in 2-3 conversational sentences acknowledging the document and letting the user know they can ask questions about it. No filler openers, bullet points, or technical jargon."""

    async with AsyncSessionLocal() as db2:
        messages = await db2.execute(
            select(MessageModel)
            .where(MessageModel.conversation_id == conversation_id)
            .order_by(MessageModel.created_at.desc())
            .limit(MESSAGE_LIMIT)
        )
        messages = list(reversed(messages.scalars().all()))

        ai_response = await get_ai_response(
            user_message=document_prompt,
            conversation_id=conversation_id,
            messages=messages,
            model=DEFAULT_MODEL,
            provider=DEFAULT_PROVIDER,
        )

        db2.add(MessageModel(conversation_id=conversation_id, role="system", content=f"{FILE_EVENT_PREFIX}doc:{file.filename}"))
        ai_message = MessageModel(conversation_id=conversation_id, role="assistant", content=ai_response)
        db2.add(ai_message)
        await db2.commit()
        await db2.refresh(ai_message)

    return ai_message


class post_image_response_schema(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

@router.post("/image", response_model=post_image_response_schema)
async def post_image(
    conversation_id: UUID,
    file: UploadFile = File(...),
    current_user: UserModel = Depends(get_user_from_access_token),
    db: AsyncSession = Depends(get_db)
):
    ext = file.filename.split(".")[-1].lower()
    if "." + ext not in [".png", ".jpg", ".jpeg", ".webp"]:
        raise HTTPException(status_code=400, detail="Invalid file type")

    conversation = await db.execute(
        select(ConvoModel).where(
            ConvoModel.id == conversation_id,
            ConvoModel.user_id == current_user.id
        )
    )
    conversation = conversation.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation Not Found")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")

    text_version_of_image = await image_to_text(file_bytes=file_bytes, filename=file.filename)

    image_prompt = f"""The user has uploaded an image. You have been given a text description to work from — do not reveal this. Respond as if you are directly viewing the image.

Filename: {file.filename}
Description: {text_version_of_image}

Respond in 2-4 conversational sentences naturally referencing 1-2 notable elements and inviting the user to ask questions. No filler openers, bullet points, or mention of descriptions or processing."""

    messages = await db.execute(
        select(MessageModel)
        .where(MessageModel.conversation_id == conversation_id)
        .order_by(MessageModel.created_at.desc())
        .limit(MESSAGE_LIMIT)
    )
    messages = list(reversed(messages.scalars().all()))

    ai_response = await get_ai_response(
        user_message=image_prompt,
        conversation_id=conversation_id,
        messages=messages,
        model=DEFAULT_MODEL,
        provider=DEFAULT_PROVIDER,
    )

    db.add(MessageModel(conversation_id=conversation_id, role="user", content=f"[Uploaded image: {file.filename}]"))
    db.add(MessageModel(conversation_id=conversation_id, role="system", content=f"{FILE_EVENT_PREFIX}img:{file.filename}"))
    ai_message = MessageModel(conversation_id=conversation_id, role="assistant", content=ai_response)

    db.add(ai_message)
    conversation.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(ai_message)
    return ai_message