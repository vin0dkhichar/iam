# ruff: noqa: E402

from .config import Settings

# Register iam_partner_ Settings before AuthInitializer / fastapi-common init_db,
# otherwise the engine binds to common_ defaults (localhost) and DB calls refuse.
_config = Settings.get_config()

from iam_core.user_auth.app import Initializer as AuthInitializer

from .controllers.agencies import PartnerAgenciesController


class Initializer(AuthInitializer):
    def initialize(self, **kwargs):
        super().initialize()
        PartnerAgenciesController().post_init()
