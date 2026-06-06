import json

from sqlalchemy.orm import Session

from app.models.eval_dataset import EvalDataset
from app.models.eval_test_case import EvalTestCase


def serialize_tags(tags: list[str]) -> str:
    """
    Stores tags as JSON text in the existing database column.

    Example:
    ["core", "deployment", "metrics"]
    """
    cleaned_tags: list[str] = []

    for tag in tags:
        normalized_tag = tag.strip()

        if normalized_tag and normalized_tag not in cleaned_tags:
            cleaned_tags.append(normalized_tag)

    return json.dumps(cleaned_tags)


def deserialize_tags(tags_text: str | None) -> list[str]:
    """
    Converts stored JSON text back into a Python list.
    """
    if not tags_text:
        return []

    try:
        parsed_tags = json.loads(tags_text)

        if isinstance(parsed_tags, list):
            return [
                str(tag).strip()
                for tag in parsed_tags
                if str(tag).strip()
            ]

    except json.JSONDecodeError:
        pass

    # Backward-compatible fallback for manually entered comma-separated values.
    return [
        tag.strip()
        for tag in tags_text.split(",")
        if tag.strip()
    ]


def serialize_test_case(test_case: EvalTestCase) -> dict:
    return {
        "id": test_case.id,
        "dataset_id": test_case.dataset_id,
        "question": test_case.question,
        "expected_answer": test_case.expected_answer,
        "required_document_name": test_case.required_document_name,
        "tags": deserialize_tags(test_case.tags),
        "created_at": test_case.created_at,
    }


def serialize_dataset(
    dataset: EvalDataset,
    include_test_cases: bool = False,
) -> dict:
    test_cases = list(dataset.test_cases)

    response = {
        "id": dataset.id,
        "name": dataset.name,
        "description": dataset.description,
        "test_case_count": len(test_cases),
        "created_at": dataset.created_at,
    }

    if include_test_cases:
        response["test_cases"] = [
            serialize_test_case(test_case)
            for test_case in test_cases
        ]

    return response


def create_eval_dataset(
    db: Session,
    name: str,
    description: str | None,
) -> EvalDataset:
    dataset = EvalDataset(
        name=name.strip(),
        description=description.strip() if description else None,
    )

    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    return dataset


def get_eval_datasets(db: Session) -> list[EvalDataset]:
    return (
        db.query(EvalDataset)
        .order_by(EvalDataset.created_at.desc())
        .all()
    )


def get_eval_dataset_by_id(
    db: Session,
    dataset_id: str,
) -> EvalDataset | None:
    return (
        db.query(EvalDataset)
        .filter(EvalDataset.id == dataset_id)
        .first()
    )


def create_eval_test_case(
    db: Session,
    dataset_id: str,
    question: str,
    expected_answer: str | None,
    required_document_name: str | None,
    tags: list[str],
) -> EvalTestCase:
    test_case = EvalTestCase(
        dataset_id=dataset_id,
        question=question.strip(),
        expected_answer=expected_answer.strip() if expected_answer else None,
        required_document_name=(
            required_document_name.strip()
            if required_document_name
            else None
        ),
        tags=serialize_tags(tags),
    )

    db.add(test_case)
    db.commit()
    db.refresh(test_case)

    return test_case


def get_eval_test_cases(
    db: Session,
    dataset_id: str,
) -> list[EvalTestCase]:
    return (
        db.query(EvalTestCase)
        .filter(EvalTestCase.dataset_id == dataset_id)
        .order_by(EvalTestCase.created_at.asc())
        .all()
    )


def get_eval_test_case_by_id(
    db: Session,
    test_case_id: str,
) -> EvalTestCase | None:
    return (
        db.query(EvalTestCase)
        .filter(EvalTestCase.id == test_case_id)
        .first()
    )


def delete_eval_test_case(
    db: Session,
    test_case: EvalTestCase,
) -> None:
    db.delete(test_case)
    db.commit()