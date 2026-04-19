import os

from backend.web_api import create_app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("BACKEND_PORT", os.getenv("PORT", "5000")))
    debug = os.getenv("FLASK_DEBUG", "false").strip().lower() in {"1", "true", "yes", "on"}
    app.run(host="0.0.0.0", port=port, debug=debug)
