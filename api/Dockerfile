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
# todo: https://fastapi.tiangolo.com/deployment/docker/#docker-image-with-poetry
ENV POETRY_HOME=/opt/poetry
ENV PATH="$POETRY_HOME/bin:$PATH"

RUN curl -sSL https://install.python-poetry.org | python3 - && \
    chown ${USER_UID}:${USER_GID} /opt/poetry/bin/poetry && \ 
    poetry config virtualenvs.create false

COPY . .

RUN poetry install --no-root 

RUN chown -R $USER_UID:$USER_GID .

USER $USERNAME

ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80", "--reload"]