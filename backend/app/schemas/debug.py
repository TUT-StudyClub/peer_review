from datetime import date

from pydantic import BaseModel, Field


class DebugValidateTitleDeadline(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    deadline: date

