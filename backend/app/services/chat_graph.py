from langgraph.graph import StateGraph, END
from app.services.graph_state import ChatbotState
from app.services.graph_nodes import (
    router_node,
    action_expert_node,
    knowledge_expert_node,
    sql_expert_node,
    sql_executor_node,
    response_composer_node,
    interactive_creation_node,
    interactive_edit_node,
    interactive_delete_node
)

def build_chat_graph():
    graph = StateGraph(ChatbotState)
    
    # Add nodes
    graph.add_node("router", router_node)
    graph.add_node("action_expert", action_expert_node)
    graph.add_node("knowledge_expert", knowledge_expert_node)
    graph.add_node("sql_expert", sql_expert_node)
    graph.add_node("sql_executor", sql_executor_node)
    graph.add_node("response_composer", response_composer_node)
    graph.add_node("interactive_creation", interactive_creation_node)
    graph.add_node("interactive_edit", interactive_edit_node)
    graph.add_node("interactive_delete", interactive_delete_node)
    
    # Set entry point
    graph.set_entry_point("router")
    
    # Define routing logic
    def route_from_router(state: ChatbotState):
        q_type = state["query_type"]
        if q_type in ["UNSUPPORTED", "ASK_CLARIFICATION", "ASK_CONTEXT", "INTERACTIVE_DOWNLOAD", "TABLE_DOWNLOAD"]:
            return "response_composer"
        elif q_type == "ACTION_QUERY":
            return "action_expert"
        elif q_type == "KNOWLEDGE_QUERY":
            return "knowledge_expert"
        elif q_type == "INTERACTIVE_CREATION":
            return "interactive_creation"
        elif q_type == "INTERACTIVE_EDIT":
            return "interactive_edit"
        elif q_type == "INTERACTIVE_DELETE":
            return "interactive_delete"
        else: # DATABASE_QUERY or HYBRID_QUERY
            return "sql_expert"
            
    def route_from_action_expert(state: ChatbotState):
        if state["query_type"] == "INTERACTIVE_CREATION":
            return "interactive_creation"
        if state["query_type"] == "INTERACTIVE_EDIT":
            return "interactive_edit"
        if state["query_type"] == "INTERACTIVE_DELETE":
            return "interactive_delete"
        if state["query_type"] == "DATABASE_QUERY": # Fallback happened
            return "sql_expert"
        return "response_composer"
            
    def route_from_sql_executor(state: ChatbotState):
        if state.get("latest_error") and state["error_count"] < 3:
            return "sql_expert"
        return "response_composer"
        
    # Add edges
    graph.add_conditional_edges(
        "router",
        route_from_router,
        {
            "response_composer": "response_composer",
            "action_expert": "action_expert",
            "knowledge_expert": "knowledge_expert",
            "sql_expert": "sql_expert",
            "interactive_creation": "interactive_creation",
            "interactive_edit": "interactive_edit",
            "interactive_delete": "interactive_delete"
        }
    )
    
    graph.add_conditional_edges(
        "action_expert",
        route_from_action_expert,
        {
            "response_composer": "response_composer",
            "sql_expert": "sql_expert",
            "interactive_creation": "interactive_creation",
            "interactive_edit": "interactive_edit",
            "interactive_delete": "interactive_delete"
        }
    )
    
    graph.add_edge("interactive_creation", END)
    graph.add_edge("interactive_edit", END)
    graph.add_edge("interactive_delete", END)
    graph.add_edge("knowledge_expert", "response_composer")
    graph.add_edge("sql_expert", "sql_executor")
    
    graph.add_conditional_edges(
        "sql_executor",
        route_from_sql_executor,
        {
            "sql_expert": "sql_expert",
            "response_composer": "response_composer"
        }
    )
    
    graph.add_edge("response_composer", END)
    
    return graph.compile()
