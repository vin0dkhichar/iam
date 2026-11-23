# ruff: noqa: E402

import asyncio

from iam_core.models import Application, DataPolicy, LoginProvider, User
from iam_core.user_auth.app import Initializer as AuthInitializer

from .controllers.agencies import PartnerAgenciesController


class Initializer(AuthInitializer):
    def initialize(self, **kwargs):
        super().initialize()
        PartnerAgenciesController().post_init()

    def migrate_database(self, args):
        super().migrate_database(args)

        async def migrate():
            await LoginProvider.create_migrate()
            await DataPolicy.create_migrate()
            await Application.create_migrate()
            await User.create_migrate()

        asyncio.run(migrate())
