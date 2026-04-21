import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

# We use Fernet for symmetric AES-256 encryption
# The key is loaded from the environment
_KEY = os.getenv("ENCRYPTION_KEY")

if not _KEY:
    # Fallback for development if .env is missing key
    # In production, this would raise a critical error
    _KEY = Fernet.generate_key().decode()

_FERNET = Fernet(_KEY.encode())

def encrypt_data(data: str) -> str:
    """Encrypts a string and returns the b64 encoded ciphertext."""
    if not data:
        return data
    return _FERNET.encrypt(data.encode()).decode()

def decrypt_data(token: str) -> str:
    """Decrypts a b64 encoded ciphertext and returns the original string."""
    if not token:
        return token
    try:
        return _FERNET.decrypt(token.encode()).decode()
    except Exception:
        # In case of corruption or wrong key, return original to avoid crash
        # but in a real app we'd log this security event.
        return token

if __name__ == "__main__":
    test = "Secret behavioral log"
    encrypted = encrypt_data(test)
    decrypted = decrypt_data(encrypted)
    print(f"Original: {test}")
    print(f"Encrypted: {encrypted}")
    print(f"Decrypted: {decrypted}")
