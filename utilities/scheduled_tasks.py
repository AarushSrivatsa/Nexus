from sqlalchemy import delete
from database.models import OTPVerificationModel
from database.initialization import AsyncSessionLocal

async def delete_unnecessary_otps_in_db():
    async with AsyncSessionLocal() as db:
        statement = delete(OTPVerificationModel).where(OTPVerificationModel.is_used == True)
        await db.execute(statement=statement)
        await db.commit()