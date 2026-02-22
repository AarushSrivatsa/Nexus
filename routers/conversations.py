# FastAPI
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from uuid import UUID
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from database.initialization import get_db
from database.models import ConvoModel, MessageModel, UserModel
from security.tokens import get_user_from_access_token
from AI.RAG import clear_rag
from datetime import datetime

router = APIRouter(
    prefix='/api/v1/conversations',
    tags=['conversations']
    )

class convo_creation_request_schema(BaseModel):
    title: str = "New Chat"

class convo_response_schema(BaseModel):
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime | None
    model_config = ConfigDict(from_attributes=True)

@router.post("/", response_model=convo_response_schema)
async def create_convo(
    convo_creation_request: convo_creation_request_schema, 
    current_user: UserModel = Depends(get_user_from_access_token),
    db: AsyncSession = Depends(get_db)
):  
    new_convo = ConvoModel(user_id=current_user.id, title=convo_creation_request.title)
    db.add(new_convo)
    await db.commit()
    await db.refresh(new_convo)
    return new_convo

@router.get("/", response_model=list[convo_response_schema])
async def list_conversations(
    current_user: UserModel = Depends(get_user_from_access_token),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ConvoModel)
        .where(ConvoModel.user_id == current_user.id)
        .order_by(ConvoModel.created_at.desc())
    )
    conversations = result.scalars().all()
    return conversations

class delete_convo_response_schema(BaseModel):
    result : str
    
@router.delete("/{conversation_id}",response_model=delete_convo_response_schema)
async def delete_conversation(
    conversation_id: UUID,
    current_user: UserModel = Depends(get_user_from_access_token),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ConvoModel).where(
            ConvoModel.id == conversation_id,
            ConvoModel.user_id == current_user.id
        )
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.execute(
        delete(MessageModel).where(MessageModel.conversation_id == conversation_id)
    )
    
    await db.delete(conversation)
    await db.commit()
    try:
        clear_rag(conversation_id)
    except Exception as e:
        print(f"Warning: Failed to clear RAG for conversation {conversation_id}: {e}")
    
    return {"result":"Conversation deleted"}

