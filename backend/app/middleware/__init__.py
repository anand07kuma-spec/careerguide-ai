"""HTTP middleware: the throttles and the browser-origin rules.

Both live here rather than in `main.py` so that a person auditing what this
service enforces can read one directory and find both.
"""
