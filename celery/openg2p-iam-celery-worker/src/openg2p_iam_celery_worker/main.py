from .app import Initializer, celery_app

initializer = Initializer()
initializer.initialize()

app = initializer.return_app()

__all__ = ["app", "celery_app", "initializer"]

if __name__ == "__main__":
    initializer.main()
