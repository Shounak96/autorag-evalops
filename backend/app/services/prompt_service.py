from sqlalchemy.orm import Session

from app.models.prompt_version import PromptVersion


BUILT_IN_SYSTEM_PROMPT = """
You are a citation-first answer-generation agent for an advanced RAG system.

Use only facts supported by the provided document sources.
Do not use outside knowledge.
Keep the answer concise and clear.
Add an inline citation after every factual statement.
Citations must use the exact format [S1], [S2], [S3], etc.
Use only source labels that appear in the supplied context.
If the sources do not contain enough information, state that clearly.
Do not include a references section.
Do not explain your reasoning.
""".strip()


BUILT_IN_USER_PROMPT_TEMPLATE = """
User question:
{question}

Document sources:
{context}
""".strip()


def validate_prompt_template(user_prompt_template: str) -> None:
    required_placeholders = {
        "{question}",
        "{context}",
    }

    missing_placeholders = [
        placeholder
        for placeholder in required_placeholders
        if placeholder not in user_prompt_template
    ]

    if missing_placeholders:
        missing_text = ", ".join(sorted(missing_placeholders))

        raise ValueError(
            f"Prompt template is missing required placeholders: {missing_text}"
        )


def serialize_prompt_version(prompt: PromptVersion) -> dict:
    return {
        "id": prompt.id,
        "name": prompt.name,
        "description": prompt.description,
        "system_prompt": prompt.system_prompt,
        "user_prompt_template": prompt.user_prompt_template,
        "is_default": prompt.is_default,
        "created_at": prompt.created_at,
    }


def get_prompt_versions(db: Session) -> list[PromptVersion]:
    return (
        db.query(PromptVersion)
        .order_by(
            PromptVersion.is_default.desc(),
            PromptVersion.created_at.desc(),
        )
        .all()
    )


def get_prompt_version_by_id(
    db: Session,
    prompt_version_id: str,
) -> PromptVersion | None:
    return (
        db.query(PromptVersion)
        .filter(PromptVersion.id == prompt_version_id)
        .first()
    )


def get_default_prompt_version(db: Session) -> PromptVersion | None:
    return (
        db.query(PromptVersion)
        .filter(PromptVersion.is_default.is_(True))
        .first()
    )


def clear_default_prompt_versions(db: Session) -> None:
    prompts = (
        db.query(PromptVersion)
        .filter(PromptVersion.is_default.is_(True))
        .all()
    )

    for prompt in prompts:
        prompt.is_default = False
        db.add(prompt)


def create_prompt_version(
    db: Session,
    name: str,
    description: str | None,
    system_prompt: str,
    user_prompt_template: str,
    is_default: bool,
) -> PromptVersion:
    validate_prompt_template(user_prompt_template)

    existing_prompt_count = db.query(PromptVersion).count()

    should_be_default = is_default or existing_prompt_count == 0

    if should_be_default:
        clear_default_prompt_versions(db)

    prompt = PromptVersion(
        name=name.strip(),
        description=description.strip() if description else None,
        system_prompt=system_prompt.strip(),
        user_prompt_template=user_prompt_template.strip(),
        is_default=should_be_default,
    )

    db.add(prompt)
    db.commit()
    db.refresh(prompt)

    return prompt

def update_prompt_version(
    db: Session,
    prompt: PromptVersion,
    name: str,
    description: str | None,
    system_prompt: str,
    user_prompt_template: str,
) -> PromptVersion:
    validate_prompt_template(user_prompt_template)

    prompt.name = name.strip()
    prompt.description = (
        description.strip()
        if description and description.strip()
        else None
    )
    prompt.system_prompt = system_prompt.strip()
    prompt.user_prompt_template = user_prompt_template.strip()

    db.add(prompt)
    db.commit()
    db.refresh(prompt)

    return prompt


def set_default_prompt_version(
    db: Session,
    prompt: PromptVersion,
) -> PromptVersion:
    clear_default_prompt_versions(db)

    prompt.is_default = True

    db.add(prompt)
    db.commit()
    db.refresh(prompt)

    return prompt


def resolve_prompt_version(
    db: Session,
    prompt_version_id: str | None,
) -> dict:
    """
    Resolution order:

    1. Explicit prompt_version_id from request
    2. Default prompt stored in database
    3. Built-in citation-first prompt fallback
    """
    if prompt_version_id:
        prompt = get_prompt_version_by_id(
            db=db,
            prompt_version_id=prompt_version_id,
        )

        if not prompt:
            raise ValueError("Prompt version not found")

        return {
            "id": prompt.id,
            "name": prompt.name,
            "system_prompt": prompt.system_prompt,
            "user_prompt_template": prompt.user_prompt_template,
            "source": "database_explicit",
        }

    default_prompt = get_default_prompt_version(db)

    if default_prompt:
        return {
            "id": default_prompt.id,
            "name": default_prompt.name,
            "system_prompt": default_prompt.system_prompt,
            "user_prompt_template": default_prompt.user_prompt_template,
            "source": "database_default",
        }

    return {
        "id": None,
        "name": "Built-in Citation-First Prompt",
        "system_prompt": BUILT_IN_SYSTEM_PROMPT,
        "user_prompt_template": BUILT_IN_USER_PROMPT_TEMPLATE,
        "source": "built_in_fallback",
    }