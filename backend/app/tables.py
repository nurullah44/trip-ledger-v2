"""SQLAlchemy tables.

Kept deliberately plain (strings, integers, dates, no dialect-specific types) so
the same schema runs on SQLite today and Postgres tomorrow.
"""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class GroupRow(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    currency: Mapped[str] = mapped_column(String(3))
    status: Mapped[str] = mapped_column(String(16), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    public_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    admin_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    participants: Mapped[list["ParticipantRow"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="ParticipantRow.position",
    )
    expenses: Mapped[list["ExpenseRow"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
    )
    repayments: Mapped[list["RepaymentRow"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
    )


class ParticipantRow(Base):
    __tablename__ = "participants"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime)

    group: Mapped[GroupRow] = relationship(back_populates="participants")


class ExpenseRow(Base):
    __tablename__ = "expenses"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    description: Mapped[str] = mapped_column(String(200))
    amount: Mapped[int] = mapped_column(Integer)
    paid_by_participant_id: Mapped[str] = mapped_column(String(32))
    expense_date: Mapped[date] = mapped_column(Date)
    split_method: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)

    group: Mapped[GroupRow] = relationship(back_populates="expenses")
    splits: Mapped[list["SplitRow"]] = relationship(
        back_populates="expense",
        cascade="all, delete-orphan",
    )


class SplitRow(Base):
    __tablename__ = "expense_splits"

    expense_id: Mapped[str] = mapped_column(
        ForeignKey("expenses.id", ondelete="CASCADE"), primary_key=True
    )
    participant_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    amount: Mapped[int] = mapped_column(Integer)

    expense: Mapped[ExpenseRow] = relationship(back_populates="splits")


class RepaymentRow(Base):
    __tablename__ = "repayments"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    payer_participant_id: Mapped[str] = mapped_column(String(32))
    recipient_participant_id: Mapped[str] = mapped_column(String(32))
    amount: Mapped[int] = mapped_column(Integer)
    payment_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime)

    group: Mapped[GroupRow] = relationship(back_populates="repayments")


class UserRow(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))


class SessionRow(Base):
    __tablename__ = "sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
