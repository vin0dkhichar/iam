FROM python:3.12.11-alpine3.22

ARG FASTAPI_COMMON_REF=1.3

RUN apk add --no-cache --virtual .build-deps gcc libc-dev linux-headers make \
 && apk add --no-cache bash git gettext libpq-dev libmagic

WORKDIR /app

RUN pip install --no-cache-dir \
    "git+https://github.com/openg2p/openg2p-fastapi-common@${FASTAPI_COMMON_REF}#subdirectory=openg2p-fastapi-common"

COPY iam-core /src/iam-core
COPY iam-partner-api /src/iam-partner-api
RUN pip install --no-cache-dir /src/iam-core /src/iam-partner-api

RUN apk del --no-network .build-deps

ENV PYTHONUNBUFFERED=1
ENV IAM_API_NO_OF_WORKERS=2
ENV IAM_API_HOST=0.0.0.0
ENV IAM_API_PORT=8000
ENV IAM_API_WORKER_TYPE=gunicorn

CMD python3 -m iam_partner_api.main migrate; \
    gunicorn "iam_partner_api.main:app" --workers ${IAM_API_NO_OF_WORKERS} --worker-class uvicorn.workers.UvicornWorker --bind ${IAM_API_HOST}:${IAM_API_PORT}
