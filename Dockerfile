FROM conda/miniconda3
WORKDIR /code
COPY ./prototype.py /code/
COPY ./templates /code/templates/
RUN conda update -n base -c defaults conda
RUN echo "python[version='>=3.6,<3.7.0a0|>=3.7,<3.8.0a0']" > /usr/local/conda-meta/pinned
RUN conda update python
RUN conda install -c conda-forge fastapi
RUN conda install -c coml -c conda-forge shennong
RUN conda install -c conda-forge uvicorn
RUN conda install aiofiles
RUN conda install jinja2
RUN conda install -c conda-forge python-multipart
CMD ["uvicorn", "prototype:app", "--host", "0.0.0.0", "--port", "80"]
