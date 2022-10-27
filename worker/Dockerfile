FROM python:3.9-slim
WORKDIR /code

ARG USERNAME=worker
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# create a sudo user, useful when developing from within a container
# https://code.visualstudio.com/remote/advancedcontainers/add-nonroot-user
RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && apt-get update \
    && apt-get install -y sudo \
    curl \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

RUN apt-get update && apt-get install -y \
    openssh-client \
    build-essential \
    libpq-dev

RUN mkdir /home/${USERNAME}/.ssh && \
    chown -R ${USER_UID}:${USER_GID} /home/${USERNAME}/.ssh && \
    chmod 700 /home/${USERNAME}/.ssh


# Install Poetry
ENV POETRY_HOME=/opt/poetry
ENV PATH="$POETRY_HOME/bin:$PATH"

RUN curl -sSL https://install.python-poetry.org | python3 - && \
    chown ${USER_UID}:${USER_GID} /opt/poetry/bin/poetry && \ 
    poetry config virtualenvs.create false

COPY . .

RUN poetry install --no-root

RUN chown -R ${USER_UID}:${USER_GID} /code 

USER ${USER_UID}


