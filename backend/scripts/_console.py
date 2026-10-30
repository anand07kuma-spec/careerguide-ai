"""Put the suites' output streams in an encoding that can carry what they print.

The README tells a Windows developer to run these files with Git Bash, where
Python inherits a cp1252 console. The labels name rupees, arrows and Devanagari,
so a failing check that quotes a Hindi answer would die inside ``print`` before
it could report the failure — the harness would crash instead of telling anyone
what broke. Switching the streams to UTF-8 keeps a failure readable.

Imported for its side effect, before anything prints:

    import _console  # noqa: F401
"""

import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
