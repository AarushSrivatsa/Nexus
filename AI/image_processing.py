import base64
import httpx
from fastapi.concurrency import run_in_threadpool
from config import CF_ACCOUNT_ID, CF_API_TOKEN

IMAGE_TO_TEXT_PROMPT = "Describe this image or diagram in detail. If it contains a diagram, explain its structure and relationships."

async def image_to_text(file_bytes: bytes, filename: str) -> str:
    ext = filename.split(".")[-1].lower()
    
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/@cf/llava-hf/llava-1.5-7b-hf",
            headers={"Authorization": f"Bearer {CF_API_TOKEN}"},
            json={"image": list(file_bytes), "prompt": IMAGE_TO_TEXT_PROMPT},
            timeout=30.0
        )
    data = r.json()
    print("STATUS:", r.status_code)
    print("FULL RESPONSE:", data)

    result = data.get("result", {})
    return result.get("description") or result.get("response") or str(result)