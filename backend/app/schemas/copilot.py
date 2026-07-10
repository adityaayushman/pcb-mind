from datetime import datetime

from pydantic import BaseModel


class CopilotChatRequest(BaseModel):
    message: str


class CopilotMessageOut(BaseModel):
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True
