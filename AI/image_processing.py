import httpx
from fastapi import HTTPException
from config import CF_ACCOUNT_ID, CF_API_TOKEN

IMAGE_TO_TEXT_PROMPT = "Describe this image or diagram in detail. If it contains a diagram, explain its structure and relationships."

async def image_to_text(file_bytes: bytes, filename: str) -> str:
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

    result = data.get("result")
    if not result or not isinstance(result, dict):
        raise HTTPException(status_code=502, detail="Image processing failed")

    return result.get("description") or result.get("response") or str(result)