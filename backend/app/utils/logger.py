import logging
import os
from logging.handlers import RotatingFileHandler
from datetime import datetime

# Ensure the logs directory exists
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs")
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

# Generate filename based on current date
current_date = datetime.now().strftime("%d-%m-%Y")
LOG_FILE = os.path.join(LOG_DIR, f"log-{current_date}.log")

def setup_logger(name: str) -> logging.Logger:
    """Gets or creates a logger with standard formatting."""
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    # To avoid attaching multiple handlers if setup is called multiple times
    if not logger.handlers:
        # File handler uses a rotating file, generating a new one each day effectively if restarted
        file_handler = RotatingFileHandler(
            LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=30
        )
        file_handler.setLevel(logging.INFO)

        # Standard console output
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)

        # Format: date time - level - message (no milliseconds, no logger name)
        formatter = logging.Formatter(
            fmt='%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)

        logger.addHandler(file_handler)
        logger.addHandler(console_handler)

    return logger

# Global instance convenience
logger = setup_logger("app.logger")
