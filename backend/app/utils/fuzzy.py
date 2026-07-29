import re
import difflib
from sqlalchemy.orm import Session
from app.models.algorithm import Algorithm
from app.models.model import Model
from app.models.factory import Factory

def auto_correct_query(query: str, db: Session) -> str:
    """
    Scans the user query for misspelled algorithm, model, or factory names 
    and silently corrects them using fuzzy matching.
    """
    # Fetch all valid entity names
    algorithms = [row[0] for row in db.query(Algorithm.name).all()]
    models = [row[0] for row in db.query(Model.name).all()]
    factories = [row[0] for row in db.query(Factory.name).all()]
    
    all_entities = algorithms + models + factories
    
    if not all_entities:
        return query
        
    corrected_query = query
    words = query.split()
    
    # We will try to match individual words and bigrams (2 words) against our entity list.
    # To keep it simple and safe, we only replace if there's a very high confidence match.
    
    # Check bigrams first
    for i in range(len(words) - 1):
        bigram = f"{words[i]} {words[i+1]}"
        # If the bigram exactly matches an entity, ignore
        if any(e.lower() == bigram.lower() for e in all_entities):
            continue
            
        matches = difflib.get_close_matches(bigram, all_entities, n=1, cutoff=0.85)
        if matches:
            corrected_query = re.sub(rf'\b{re.escape(bigram)}\b', matches[0], corrected_query, flags=re.IGNORECASE)
            # Skip the next word since it was part of a matched bigram
            words[i] = "" 
            words[i+1] = ""
            
    # Check individual words
    for word in words:
        if not word or len(word) <= 3:
            continue # Skip short words like "the", "a", "of"
            
        if any(e.lower() == word.lower() for e in all_entities):
            continue
            
        matches = difflib.get_close_matches(word, all_entities, n=1, cutoff=0.80)
        if matches:
            # Prevent aggressively changing common words if they aren't actually entities
            # We rely on a high cutoff (0.80) to ensure safety.
            corrected_query = re.sub(rf'\b{re.escape(word)}\b', matches[0], corrected_query, flags=re.IGNORECASE)
            
    return corrected_query
