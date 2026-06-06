from datetime import datetime

from pydantic import BaseModel, Field


class PromptVersionCreateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    system_prompt: str = Field(..., min_length=20)
    user_prompt_template: str = Field(..., min_length=20)
    is_default: bool = False


class PromptVersionResponse(BaseModel):
    id: str
    name: str
    description: str | None
    system_prompt: str
    user_prompt_template: str
    is_default: bool
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class PromptVersionListResponse(BaseModel):
    prompts: list[PromptVersionResponse]
    count: int


class SetDefaultPromptResponse(BaseModel):
    message: str
    prompt: PromptVersionResponse