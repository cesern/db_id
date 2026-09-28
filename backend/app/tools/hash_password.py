"""Genera el valor de ADMIN_PASSWORD_HASH.

Uso (desde backend/):  python -m app.tools.hash_password
"""
import sys
from getpass import getpass

from app.services.auth import hash_password


def main() -> int:
    pw = getpass("Contraseña del admin: ")
    if not pw:
        print("La contraseña no puede estar vacía.", file=sys.stderr)
        return 1
    if getpass("Repetir contraseña: ") != pw:
        print("Las contraseñas no coinciden.", file=sys.stderr)
        return 1
    print(hash_password(pw))
    return 0


if __name__ == "__main__":
    sys.exit(main())
