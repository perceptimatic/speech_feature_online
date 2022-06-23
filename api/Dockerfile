FROM python:3.9

WORKDIR /code

ARG USERNAME=fastapi
ARG USER_UID=1000
ARG USER_GID=$USER_UID


# create a sudo user, useful when developing from within a contaienr
RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && apt-get update \
    && apt-get install -y sudo \
    curl \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Install Poetry
# https://github.com/tiangolo/full-stack-fastapi-postgresql/blob/master/%7B%7Bcookiecutter.project_slug%7D%7D/backend/backend.dockerfile
RUN curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | POETRY_HOME=/opt/poetry python && \
    cd /usr/local/bin && \
    chown ${USER_UID}:${USER_GID} /opt/poetry/bin/poetry && \ 
    ln -s /opt/poetry/bin/poetry && \
    poetry config virtualenvs.create false

COPY . .

RUN poetry install --no-root 

USER $USERNAME

ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80", "--reload"]