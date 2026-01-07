from sqlalchemy import Uuid as SAUuid
from sqlalchemy.orm import DeclarativeBase

UUIDType = SAUuid(as_uuid=True)  # type: ignore[no-matching-overload]


class Base(DeclarativeBase):
    pass
