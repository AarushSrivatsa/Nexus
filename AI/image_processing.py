import httpx
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy import select
from langchain.tools import tool

from settings import CF_ACCOUNT_ID, CF_API_TOKEN
from database.initialization import AsyncSessionLocal
from database.models import MessageModel

IMAGE_TO_TEXT_PROMPT = "You are acting as an intermediatory between an LLM that understands only text and image. Describe whatever you can from that image how ever elaborately possible. Leave no minute detail unturned. Try to infer the image too."

async def _run_llava(image_bytes: bytes, prompt: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            print("Calling Cloudflare LLaVA...")

            r = await client.post(
                f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/@cf/llava-hf/llava-1.5-7b-hf",
                headers={"Authorization": f"Bearer {CF_API_TOKEN}"},
                json={
                    "image": list(image_bytes),
                    "prompt": prompt,
                },
            )

            print("Status:", r.status_code)
            print("Response:", r.text)

            r.raise_for_status()

        data = r.json()
        result = data.get("result")

        if not isinstance(result, dict):
            raise HTTPException(
                status_code=502,
                detail=f"Unexpected Cloudflare response: {data}",
            )

        return (
            result.get("description")
            or result.get("response")
            or str(result)
        )

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Cloudflare AI request timed out.",
        )

    except httpx.HTTPStatusError as e:
        print("HTTPStatusError:", e.response.text)
        raise HTTPException(
            status_code=502,
            detail=f"Cloudflare returned {e.response.status_code}: {e.response.text}",
        )

    except httpx.RequestError as e:
        print("RequestError:", repr(e))
        raise HTTPException(
            status_code=502,
            detail=f"Failed to connect to Cloudflare AI: {e}",
        )

    except Exception:
        import traceback
        traceback.print_exc()
        raise

async def image_to_text(file_bytes: bytes, filename: str) -> str:
    """Initial description generated right after upload (used by routers/messages.py)."""
    return await _run_llava(file_bytes, IMAGE_TO_TEXT_PROMPT)


async def describe_image_from_url(image_url: str, question: str) -> str:
    """Re-fetch a previously uploaded image from R2 and ask a specific question about it."""
    try:
        async with httpx.AsyncClient() as client:
            img_r = await client.get(image_url, timeout=20.0)
        if img_r.status_code != 200:
            return f"Could not retrieve the image (HTTP {img_r.status_code}). It may have been deleted."
        return await _run_llava(img_r.content, question)
    except HTTPException as e:
        return f"Image analysis failed: {e.detail}"
    except Exception as e:
        return f"Image analysis failed: {e}"


def make_view_image_tool(conversation_id: UUID):
    """
    Builds a conversation-scoped tool, same pattern as make_query_rag_tool in AI/RAG.py.
    The model only ever has to know a filename (plain text, already in its chat
    history) — the actual R2 link is looked up here server-side, so there's no
    risk of the model mistyping or hallucinating a long URL.
    """

    @tool
    async def view_image(image_filename: str, question: str) -> str:
        """
Re-examine an image already uploaded in this conversation to answer a specific
follow-up question about it (colors, text in the image, counting objects, etc).
Use the exact filename as it appears in the conversation history.

Don't use this just to re-describe an image in general — only when the user asks
something the original description likely doesn't cover.

image_filename: the filename of the previously uploaded image, exactly as shown
                in the conversation (e.g. "sunset.jpg")
question: the specific thing you want to know about the image
"""
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(MessageModel.image_link)
                .where(
                    MessageModel.conversation_id == conversation_id,
                    MessageModel.attachment_type == "image",
                    MessageModel.attachment_name == image_filename,
                )
                .order_by(MessageModel.created_at.desc())
                .limit(1)
            )
            row = result.first()

        if not row or not row[0]:
            return f"No image named '{image_filename}' was found in this conversation."

        return await describe_image_from_url(row[0], question)

    return view_image
