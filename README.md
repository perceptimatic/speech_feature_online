# Speech Feature Online

This repo contains a prototype for Speech Feature Online, a web interface that allows users to take advantage of Shennong and other speech analysis tools without having to learn Python or install anything on their own machine.

### How it's made  

Speech Feature Online is built with [FastAPI](https://fastapi.tiangolo.com)'s many functionalities, and offers a decent portion of [Shennong](https://docs.cognitive-ml.fr/shennong/)'s features. There are plans to add wav2vec functionality alongside Shennong in the future.    
In order to host SFO, a Python environment with FastAPI and Shennong installed is necessary. Once SFO is up and running, a web browser is all you need to be able to use it.  

![Screenshot of Speech Feature Online: plain HTML page with checkboxes and text fields](screenshot.png)  

### Table of contents  
  
`prototype.py` : the all-in-one script with Shennong implementation and front page FastAPI app  
  
  * `analyser (file: str, subdir: str, fts: list, settings: dict)`: takes audio file and user-specified settings and performs Shennong analysis on the file, saving results to disk  
      * results are collected **per audio file**: example.wav → example_features={example_spectrogram, example_mfcc, example_pitch_kaldi, ...}  
	  and **not** per feature, so **not** example1.wav, example2.wav → mfcc={example1_mfcc, example2_mfcc}  
	  * per-feature analysers are an option for the future, but for now things work as they are - we'll always have time to break it and rebuild it later
  * FastAPI `/home` page: takes audio file(s) & user specified settings, passes them to `analyser`, returns .zip file with results  
      * audio files submitted are erased by the time the results file is returned
  
`/templates` : HTML templates used by FastAPI   
`/tmp` : folder used for file storage. New random-name subfolder is created + erased over the course of each user request. Subfolder `/results` (collecting results) at present needs to be manually cleared every so often.
 
### Installation

In order to run SFO, you will need to install [FastAPI](https://fastapi.tiangolo.com) and [Shennong](https://docs.cognitive-ml.fr/shennong/) to your environment.  
  
FastAPI is system-agnostic, but Shennong is only compatible with UNIX systems. If you're on Windows, like the author of this program, you can work around this by using the [Ubuntu Subsystem for Windows](https://ubuntu.com/wsl). The easiest way to manage your files in this case is to [mount the virtual Ubuntu as a "network drive"](https://gunnarpeipman.com/browse-wsl-with-explorer/) on your Windows machine. From there, UNIX installation should proceed as normal through the Ubuntu shell, for both FastAPI and Shennong, and you can then use the shell to run SFO.  
  
**Shennong** requires [conda](https://conda.io/miniconda.html) to be installed on your machine.  
On Linux or the Ubuntu subsystem for Windows, you can install Shennong from its conda package, which will install all of Shennong's required dependencies:  
  
`conda install -c coml -c conda-forge shennong`  

On MacOS, you need to follow Shennong's instructions for [installation from sources](https://docs.cognitive-ml.fr/shennong/installation.html#installation-on-macos). You can also [install from sources](https://docs.cognitive-ml.fr/shennong/installation.html#installation-from-sources) on Linux/Ubuntu subsystem, if you'd like.  
  
**FastAPI**'s [installation instructions](https://fastapi.tiangolo.com/#installation) have 2 shell steps that are the same for any system:  
  
  * `pip install fastapi` - install FastAPI  
  * `pip install "uvicorn[standard]"` - install Uvicorn, an ASGI server  

Once you have a Python environment with Shennong & FastAPI installed:  
  
  1. Open a command shell
  2. Navigate to ~/speech_feature_online/  
  3. In your shell, type in:  
      `python -m uvicorn prototype:app`  
  4. In your browser of choice, navigate to the address the shell/Uvicorn gives you + `/home`
  5. Enjoy SFO!
  