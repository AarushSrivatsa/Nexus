import uuid
import boto3
from botocore.config import Config
from settings import (
    CF_ACCOUNT_ID,
    R2_BUCKET_NAME,
    R2_PUBLIC_URL,
)

# R2 S3 client
s3_client = boto3.client(
    "s3",
    endpoint_url=f"https://{CF_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id="b3fb2b2f367252b6f9aad1106c80cb5d",
    aws_secret_access_key="9d0ad7ce58d71d4ce9f3ddbf3a3e1d0d7cbf734e5c817e7cc3ef12a477a77f91",
    config=Config(signature_version="s3v4", region_name="auto"),
)


async def upload_file(user_id: str, filename: str, file_bytes: bytes, content_type: str) -> tuple[str, str]:
    """Upload file and return (public_url, key)"""
    key = f"media/{user_id}/{uuid.uuid4()}_{filename}"
    
    try:
        s3_client.put_object(
            Bucket=R2_BUCKET_NAME,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
        )
        print(f"✅ Uploaded: {key}")
    except Exception as e:
        print(f"❌ Upload failed: {e}")
        raise

    public_url = f"{R2_PUBLIC_URL.rstrip('/')}/{key}"
    print(f"Public URL: {public_url}")
    return public_url, key


async def delete_files(keys: list[str]) -> None:
    """Delete one or more files from R2. Accepts single key or list."""
    
    for key in keys:
        if key:
            try:
                s3_client.delete_object(Bucket=R2_BUCKET_NAME, Key=key)
                print(f"🗑️ Deleted: {key}")
            except Exception as e:
                print(f"R2 delete warning for {key}: {e}")