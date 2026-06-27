from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.prompt import (
    PromptVersionCreateRequest,
    PromptVersionListResponse,
    PromptVersionResponse,
    SetDefaultPromptResponse,
    PromptVersionUpdateRequest,
)
from app.services.prompt_service import (
    create_prompt_version,
    get_prompt_version_by_id,
    get_prompt_versions,
    serialize_prompt_version,
    set_default_prompt_version,
    update_prompt_version,
)

router = APIRouter(prefix="/prompts", tags=["Prompt Versions"])


@router.post(
    "",
    response_model=PromptVersionResponse,
    status_code=201,
)
def create_prompt(
    request: PromptVersionCreateRequest,
    db: Session = Depends(get_db),
):
    try:
        prompt = create_prompt_version(
            db=db,
            name=request.name,
            description=request.description,
            system_prompt=request.system_prompt,
            user_prompt_template=request.user_prompt_template,
            is_default=request.is_default,
        )

        return serialize_prompt_version(prompt)

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


@router.get(
    "",
    response_model=PromptVersionListResponse,
)
def list_prompts(
    db: Session = Depends(get_db),
):
    prompts = get_prompt_versions(db)

    return {
        "prompts": [
            serialize_prompt_version(prompt)
            for prompt in prompts
        ],
        "count": len(prompts),
    }


@router.get(
    "/{prompt_version_id}",
    response_model=PromptVersionResponse,
)
def get_prompt(
    prompt_version_id: str,
    db: Session = Depends(get_db),
):
    prompt = get_prompt_version_by_id(
        db=db,
        prompt_version_id=prompt_version_id,
    )

    if not prompt:
        raise HTTPException(
            status_code=404,
            detail="Prompt version not found",
        )

    return serialize_prompt_version(prompt)


@router.patch(
    "/{prompt_version_id}",
    response_model=PromptVersionResponse,
)
def update_prompt(
    prompt_version_id: str,
    request: PromptVersionUpdateRequest,
    db: Session = Depends(get_db),
):
    prompt = get_prompt_version_by_id(
        db=db,
        prompt_version_id=prompt_version_id,
    )

    if not prompt:
        raise HTTPException(
            status_code=404,
            detail="Prompt version not found",
        )

    try:
        updated_prompt = update_prompt_version(
            db=db,
            prompt=prompt,
            name=request.name,
            description=request.description,
            system_prompt=request.system_prompt,
            user_prompt_template=request.user_prompt_template,
        )

        return serialize_prompt_version(updated_prompt)

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


@router.patch(
    "/{prompt_version_id}/default",
    response_model=SetDefaultPromptResponse,
)
def set_default_prompt(
    prompt_version_id: str,
    db: Session = Depends(get_db),
):
    prompt = get_prompt_version_by_id(
        db=db,
        prompt_version_id=prompt_version_id,
    )

    if not prompt:
        raise HTTPException(
            status_code=404,
            detail="Prompt version not found",
        )

    updated_prompt = set_default_prompt_version(
        db=db,
        prompt=prompt,
    )

    return {
        "message": "Default prompt version updated successfully",
        "prompt": serialize_prompt_version(updated_prompt),
    }