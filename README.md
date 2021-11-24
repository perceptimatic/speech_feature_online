# Speech Feature Online

This repo contains a prototype for Speech Feature Online, a web interface that allows users to take advantage of Shennong and other speech analysis tools without having to learn Python or install anything on their own machine.

### How it's made

Speech Feature Online is built with [FastAPI](https://fastapi.tiangolo.com)'s many functionalities, and offers a decent portion of [Shennong](https://docs.cognitive-ml.fr/shennong/)'s features (with eventual plans to add wav2vec functionality alongside Shennong).  
In order to *host* SFO, a Python environment with FastAPI and Shennong installed is necessary. Once SFO is up and running, a web browser is all you need to be able to use it.  

![Screenshot of Speech Feature Online: plain HTML page with checkboxes and text fields](screenshot.png)  
  
Once you have a Python environment with the aforementioned dependencies installed:  
*(And once the program's rocky start bugs have been fixed up...)*
  
  1. Open a command shell
  2. Navigate to ~/speech_feature_online/  
  3. In your shell, type in:  
      `$ python -m uvicorn prototype:app`  
  4. In your browser of choice, navigate to the address the shell/Uvicorn gives you + `/home`
  5. Enjoy SFO!
  
### The pesky dependencies

FastAPI is actually not pesky at all, but do beware that Shennong is not compatible with Windows - only UNIX. If you're on Windows, like the author of this program, you can work around this through the Ubuntu Subsystem, which is easy enough if you just [mount the virtual Ubuntu as a "network drive"](https://gunnarpeipman.com/browse-wsl-with-explorer/) on your Windows machine. From there, UNIX installation should proceed as normal. 