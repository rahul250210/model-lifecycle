from typing import TypedDict, List, Dict, Any, Optional

class ChatbotState(TypedDict):
    """
    Represents the state of our LangGraph chatbot execution.
    """
    messages: List[Dict[str, str]]
    current_question: str
    query_type: str
    sql_query: Optional[str]
    sql_results: Optional[List[Dict[str, Any]]]
    action_payload: Optional[Dict[str, Any]]
    final_response: str
    error_count: int
    latest_error: Optional[str]
    active_creation_entity: Optional[str]
    active_edit_entity: Optional[str]
    active_delete_entity: Optional[str]

