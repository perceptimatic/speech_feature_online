FROM conda/miniconda3
WORKDIR /code

ARG UPLOAD_DIR=/srv/uploads
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


RUN  conda install python=3.7  && \
    conda update -n base -c defaults conda && \
    conda install -c coml -c conda-forge shennong

# Install Poetry
RUN curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | POETRY_HOME=/opt/poetry python && \
    cd /usr/local/bin && \
    chown ${USER_UID}:${USER_GID} /opt/poetry/bin/poetry && \
    ln -s /opt/poetry/bin/poetry && \
    poetry config virtualenvs.create false

COPY . .

RUN poetry install --no-root

RUN mkdir -p ${UPLOAD_DIR} && \
    chown -R ${USER_UID}:${USER_GID} ${UPLOAD_DIR} && \
    mkdir -p /srv/results && \
    chown -R ${USER_UID}:${USER_GID} /srv/results

RUN chown -R ${USER_UID}:${USER_GID} /code 

USER ${USER_UID}


