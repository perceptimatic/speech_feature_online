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

RUN pip install celery[redis] pylint aiofiles black sqlalchemy psycopg2-binary boto3 pytest

RUN mkdir -p ${UPLOAD_DIR} && \
    chown -R 1000:1000 ${UPLOAD_DIR} && \
    mkdir -p /srv/results && \
    chown -R 1000:1000 /srv/results

COPY . .

USER 1000

RUN chown -R $USER:$USER /code 

