from openg2p_fastapi_common.ping import PingInitializer

from .app import Initializer

initializer = Initializer()
PingInitializer()

app = initializer.return_app()

if __name__ == "__main__":
    initializer.main()
