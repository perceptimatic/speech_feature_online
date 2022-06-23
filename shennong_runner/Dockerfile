FROM conda/miniconda3
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


COPY ./environment.yml .

RUN conda env update --name base --file environment.yml 

COPY . .

RUN chown -R ${USER_UID}:${USER_GID} /code 

USER ${USER_UID}

ENTRYPOINT [ "python3", "-m", "app.analyse" ]