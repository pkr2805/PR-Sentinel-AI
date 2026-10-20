from langchain_core.language_models.chat_models import BaseChatModel

from core.config import settings


def get_chat_model() -> BaseChatModel:
    """Returns the configured chat model. Add new providers here."""
    if settings.llm_provider == "groq":
        from langchain_groq import ChatGroq

        return ChatGroq(
            model=settings.llm_model,
            api_key=settings.groq_api_key,
            temperature=settings.llm_temperature,
        )
    raise ValueError(f"Unsupported LLM provider: {settings.llm_provider}")
