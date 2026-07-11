import uuid
import cloudflare

from settings import (
    CF_API_TOKEN,
    CF_ACCOUNT_ID,
    R2_BUCKET_NAME,
    R2_PUBLIC_URL,
)

cf = cloudflare.AsyncCloudflare(api_token=CF_API_TOKEN)

async def upload_file(user_id:str, filename:str,file_bytes: bytes, content_type: str) -> str:
    key = f"media/{user_id}/{uuid.uuid4()}_{filename}"
    await cf.r2.buckets.objects.upload(
        key,
        bucket_name=R2_BUCKET_NAME,
        account_id=CF_ACCOUNT_ID,
        body=file_bytes,
        extra_headers={"Content-Type": content_type},
    )
    return f"{R2_PUBLIC_URL}/{key}",key