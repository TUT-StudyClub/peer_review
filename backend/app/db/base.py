from sqlalchemy import Uuid as SAUuid
from sqlalchemy.orm import DeclarativeBase

UUIDType = SAUuid(as_uuid=True)


class Base(DeclarativeBase):
    pass
