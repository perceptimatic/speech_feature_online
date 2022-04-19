# Speech Feature Online

This repo contains a prototype for Speech Feature Online, a web interface that allows users to take advantage of Shennong and other speech analysis tools without having to learn Python or install anything on their own machine.

### How it's made  

Speech Feature Online is built with [FastAPI](https://fastapi.tiangolo.com)'s many functionalities, and offers a decent portion of [Shennong](https://docs.cognitive-ml.fr/shennong/)'s features. There are plans to add wav2vec functionality alongside Shennong in the future.  

It includes a simple web interface built with [React.js](https://reactjs.org/) for uploading files and creating analysis jobs. Job requests are sento to a Python webserver built using the [FastAPI](https://fastapi.tiangolo.com) framework. The API creates an analysis job using a [Celery](https://docs.celeryq.dev/en/stable/getting-started/introduction.html) processing queue backed by [PostreSQL](https://www.postgresql.org/) and [Redis](https://redis.io/). A python worker running [Shennong](https://docs.cognitive-ml.fr/shennong/) will execute the analysis and send the results to the user's email.  
 
### Installation

In order to run SFO, you should have [Docker](https://www.docker.com/) and [docker-compose](https://docs.docker.com/compose/) installed on your local machine. You will also need to copy the included `sample.env` file to a new file called `.env` and update the values as appropriate to your local environment. 

The worker and api images should install all required dependencies the first time you bring up the stack. However, you will need to install the React dependencies manually (mainly to avoid headaches with bind mounts). To do this, run `docker-compose run --rm --entrypoint='' react yarn install` from the project root. Then you should be able to run `docker-compose up` from the project root to bring everything up. You should be able to view the application in the browser at the address `localhost:${REACT_PORT}`, where `REACT_PORT` is the corresponding value specified in the `.env` file. Note that you will need to restart the stack by running `docker-compose up` following any changes to the `.env` file or any other updates to the environment. If you'd rather the programs run in the background, add the `-d` switch: `docker-compose up -d`. 