# to run: 
# $ cd .../speech_feature_online
# $ python -m uvicorn prototype:app --reload
# (--reload ensures relaunch at every saved change in this file)

################################################################################
##
#  Speech Feature Online 
## 
## Provides web-based speech analysis functionality in a one-and-done script. 
## Includes most of Shennong's functions. A bit clunky.
##
## Written November 2021. Last revision 2021-12-03.
##
################################################################################

import aiofiles, io, os, csv, random, shutil, datetime
from typing import List
from zipfile import ZipFile
from fastapi import FastAPI, File, UploadFile, Request, Form
from fastapi.templating import Jinja2Templates
from fastapi.responses import FileResponse, HTMLResponse
from shennong.audio import Audio
from shennong.processor.spectrogram import SpectrogramProcessor
from shennong.processor.filterbank import FilterbankProcessor
from shennong.processor.mfcc import MfccProcessor
from shennong.processor.plp import PlpProcessor
from shennong.processor import (KaldiPitchProcessor, KaldiPitchPostProcessor)
from shennong.processor import (CrepePitchProcessor, CrepePitchPostProcessor)
from shennong.processor.energy import EnergyProcessor
from shennong.postprocessor.cmvn import CmvnPostProcessor
from shennong.postprocessor.delta import DeltaPostProcessor
from shennong.postprocessor.vad import VadPostProcessor
from shennong import Features, FeaturesCollection

# pointing to templates for later:
templates =  Jinja2Templates(directory="templates")

# defining our shennong "analyser" function here:
## executive decision made: 
## collecting together all Features for one audio file (voice.mfcc, voice.plp, etc)
## not all Features of the same type for multiple audio files (X.mfcc, Y.mfcc, etc)
## > adding the latter sort of separation could be done at a later date

async def analyser(file: str, subdir: str, fts: list, settings: dict):
    """
    uses shennong to extract features from <file>. features are listed in <fts>,
    while <settings> contains specifications with which to calculate <fts>. 
    saves user-specified file format to disk and returns filename of saved file. 
    at the end cleans up audio file from disk.
    
    file (str): filename of audio file saved to disk
    subdir (str): subdirectory of tmp where file is located
    fts (list[str]): list of feature names to be analysed (of those available)
    settings (dict): dictionary of available user-adjusted settings, set either 
        to user value or to default value
        {"channel":int, "fr_len":int, "fr_sh":int, "window":str, 
           "snip":bool, "min_k":int, "max_k":int, "res":str}
    """
    # clunky filename extraction (only mp3/ogg/wav/flac accepted for now, so it works)
    if file.endswith(".flac"):
        name=file[:-5]
    else:
        name=file[:-4]
    
    # we will collect calculated Features in here:
    colln = FeaturesCollection()
    
    # read audio file into Shennong:
    sound = Audio.load("tmp/{}/{}".format(subdir,file))
    if sound.nchannels > 1: # converting to mono; user-set or default channel chosen:
        sound = sound.channel(int(settings["channel"])-1)
    samrate = sound.sample_rate
    print("file read in")
    
    # get to analysing the features!
    ## note: 
    ## I the author have a poor understanding of exactly the statistics
    ## the various features are providing, so e.g. CMVN analysis is only available
    ## as a post-processing option for MFCC & PLP, because I don't know if it 
    ## makes sense to apply it elsewhere
    ## (the analogous commented-out blocks in other features below can be added back
    ## to add a CMVN post-processing option to spectrograms, filterbank, and energy)
    
    # spectrogram
    if "spectro" in fts:
        processor = SpectrogramProcessor(sample_rate=samrate,frame_shift=settings["fr_sh"],frame_length=settings["fr_len"],window_type=settings["window"],snip_edges=settings["snip"])
        spectro = processor.process(sound)
        colln["spectrogram"] = spectro
        print("spectrogram complete")
        if "spectro_delta" in fts:
            postproc = DeltaPostProcessor()
            colln["spectrogram_delta"] = postproc.process(spectro)
            print("spectro delta complete")
        #if "spectro_cmvn" in fts:
            #postproc = CmvnPostProcessor(spectro.ndims)
            #postproc.accumulate(spectro)
            #colln["spectrogram_cmvn"] = postproc.process(spectro)
            
    # filterbank
    if "filt" in fts:
        processor = FilterbankProcessor(sample_rate=samrate,frame_shift=settings["fr_sh"],frame_length=settings["fr_len"],window_type=settings["window"],snip_edges=settings["snip"])
        filterbank = processor.process(sound)
        colln["filterbank"] = filterbank
        print("filterbank complete")
        if "filt_delta" in fts:
            postproc = DeltaPostProcessor()
            colln["filterbank_delta"] = postproc.process(filterbank) 
            print("filterbank delta complete")
        #if "filt_cmvn" in fts:
            #postproc = CmvnPostProcessor(filterbank.ndims)
            #postproc.accumulate(filterbank)
            #colln["filterbank_cmvn"] = postproc.process(filterbank)

    # MFCC
    if "mfcc" in fts:
        processor = MfccProcessor(sample_rate=samrate,frame_shift=settings["fr_sh"],frame_length=settings["fr_len"],window_type=settings["window"],snip_edges=settings["snip"])
        mfcc = processor.process(sound)
        colln["mfcc"] = mfcc
        print("mfcc complete")
        if "mfcc_delta" in fts:
            postproc = DeltaPostProcessor()
            colln["mfcc_delta"] = postproc.process(mfcc)
            print("mfcc delta complete")
        if "mfcc_cmvn" in fts:
            postproc = CmvnPostProcessor(mfcc.ndims)
            postproc.accumulate(mfcc)
            colln["mfcc_cmvn"] = postproc.process(mfcc)
            print("mfcc cmvn complete")
        if "mfcc_vad" in fts:
            postproc = VadPostProcessor()
            colln["mfcc_vad"] = postproc.process(mfcc)
            print("mfcc vad complete")
            
    # PLP
    if "plp" in fts:
        processor = PlpProcessor(sample_rate=samrate,frame_shift=settings["fr_sh"],frame_length=settings["fr_len"],window_type=settings["window"],snip_edges=settings["snip"])
        plp = processor.process(sound)
        colln["plp"] = plp
        print("plp complete")
        if "plp_delta" in fts:
            postproc = DeltaPostProcessor()
            colln["plp_delta"] = postproc.process(plp) 
            print("plp delta complete")
        if "plp_cmvn" in fts:
            postproc = CmvnPostProcessor(plp.ndims)
            postproc.accumulate(plp)
            colln["plp_cmvn"] = postproc.process(plp)
            print("plp cmvn complete")
        if "plp_vad" in fts:
            postproc = VadPostProcessor()
            colln["plp_vad"] = postproc.process(plp) 
            print("plp vad complete")
            
    # pitch using Kaldi
    if "p_kaldi" in fts:
        processor = KaldiPitchProcessor(sample_rate=samrate, frame_shift=settings["fr_sh"],frame_length=settings["fr_len"], min_f0=settings["min_k"], max_f0=settings["max_k"])
        intermed = processor.process(sound)
        postprocessor = KaldiPitchPostProcessor()
        p_kaldi = postprocessor.process(intermed) 
        colln["pitch_kaldi"] = p_kaldi
        print("p_kaldi complete")
        if "p_kaldi_delta" in fts:
            postproc = DeltaPostProcessor()
            colln["pitch_kaldi_delta"] = postproc.process(p_kaldi)
            print("p_kaldi delta complete")
            
    # pitch using  Crêpe
    if "p_crepe" in fts:
        # model severely nerfed as "full" model was bringing things to a "full" stall
        # (even "small" model makes my sad old computer sound like a dying dog for ~30s)
        processor = CrepePitchProcessor(model_capacity="small", frame_shift=settings["fr_sh"], frame_length=settings["fr_len"])
        intermed = processor.process(sound)
        postprocessor = CrepePitchPostProcessor()
        p_crepe = postprocessor.process(intermed)
        colln["pitch_crepe"] = p_crepe
        print("p_crepe complete")
        if "p_crepe_delta" in fts:
            postproc = DeltaPostProcessor()
            colln["pitch_crepe_delta"] = postproc.process(p_crepe)
            print("p_crepe delta complete")
            
    # energy
    if "energy" in fts:
        processor = EnergyProcessor(sample_rate=samrate,frame_shift=settings["fr_sh"],frame_length=settings["fr_len"],window_type=settings["window"],snip_edges=settings["snip"])
        energy = processor.process(sound)
        colln["energy"] = energy
        print("energy complete")
        if "energy_delta" in fts:
            postproc = DeltaPostProcessor()
            colln["energy_delta"] = postproc.process(energy)
            print("energy delta complete")
        #if "energy_cmvn" in fts:
            #postproc = CmvnPostProcessor(energy.ndims)
            #postproc.accumulate(energy)
            #colln["energy_cmvn"] = postproc.process(energy) 
    
    # we save the resulting FeaturesCollection in the format the user chose
    if len(colln) > 0:
        colln.save("tmp/{}/results/{}_features{}".format(subdir,name,settings["res"]))
    
    # clean up stored audio file:
    os.remove("tmp/{}/{}".format(subdir,file))
    
    # return location of saved results file (not necessary - not used by receiving function)
    return #("tmp/{}/results/{}_features{}".format(subdir,name,settings["res"]))



# initialise our app
app = FastAPI()

# we're alive!
@app.get("/", response_class=HTMLResponse)
async def root():
    html_content = """
    <html>
    <head>
        <title>Hello, World!</title>
    </head>
    <body>
        <h1>Hello, World!</h1>
    </body> 
    </html>"""    
    return HTMLResponse(content=html_content)

# load up our front page
@app.get("/home", response_class=HTMLResponse)
def form_post(request: Request):
    return templates.TemplateResponse("frontpage.html", context={"request": request})

# accept some form responses from users (files + settings)
@app.post("/home")
async def form_post(request: Request, files: List[UploadFile]=File(...),
                    channel:int=Form(...), fr_len:float=Form(...), fr_sh:float=Form(...),
                    window:str=Form(...), snip:bool=Form(...),
                    spectro:bool=Form(...), spectro_delta:bool=Form(...),
                    filt:bool=Form(...), filt_delta:bool=Form(...), 
                    mfcc:bool=Form(...), mfcc_delta:bool=Form(...), mfcc_cmvn:bool=Form(...), mfcc_vad:bool=Form(...),
                    plp:bool=Form(...), plp_delta:bool=Form(...), plp_cmvn:bool=Form(...),plp_vad:bool=Form(...),
                    p_kaldi:bool=Form(...), p_kaldi_delta:bool=Form(...), min_k:int=Form(...), max_k:int=Form(...),
                    p_crepe:bool=Form(...), p_crepe_delta:bool=Form(...),
                    energy:bool=Form(...), energy_delta:bool=Form(...),
                    res:str=Form(...)):
    ## for excluded CMVN analysis, add parameters:
    ## spectro_cmvn:bool=Form(...), filt_cmvn:bool=Form(...), energy_cmvn:bool=Form(...)
    ## (make sure they are uncommented in the HTML form, too!)
    """
    files: our audio
    the rest of the features: unbearable list of shennong-specific settings
    > Y/N for Spectrogram, Filterbank, MFCC, PLP, pitch (kaldi, crêpe), energy
    > for each of the above, Y/N for available post-processing (out of CMVN, Delta, VAD)
    > for some of the above, additional settings
    > for all of the above, general settings
         > fr[ame]_sh[ift], fr[ame]_len[gth]
         > channel [to choose if stereo]
         > window type
         > snip[_edges]: discard (1) or keep (0) incomplete frames
         > res[ult] file format
    """
    # basic-as idiot-proofing: checks correct audio format before anything else
    for file in files:
        if not (file.filename.endswith(".mp3") or file.filename.endswith(".wav") 
                or file.filename.endswith(".ogg") or file.filename.endswith(".flac")):
            html_content = """
            <html>
            <body>
            The file you submitted was not an audio file we can work with.<br>Please try again with one of: wav, mp3, ogg, flac.
            </body>
            </html>
            """
            return HTMLResponse(content=html_content)
    
    # our magnificent array of settings:
    if res == ".csv":
        res = ""
    settings = {"channel":int(channel), "fr_len":fr_len, "fr_sh":fr_sh, 
                "window":str(window), "snip":snip, "min_k":int(min_k), 
                "max_k":int(max_k), "res":res}    
    
    # our glorious assortiment of features:
    yn_fts = {"spectro":spectro, "spectro_delta":spectro_delta, 
              "filt":filt, "filt_delta":filt_delta,
              "mfcc":mfcc, "mfcc_delta":mfcc_delta, "mfcc_cmvn":mfcc_cmvn, "mfcc_vad":mfcc_vad, 
              "plp":plp, "plp_delta":plp_delta, "plp_cmvn":plp_cmvn, "plp_vad":plp_vad,
              "p_kaldi":p_kaldi, "p_kaldi_delta":p_kaldi_delta, 
              "p_crepe":p_crepe, "p_crepe_delta":p_crepe_delta, 
              "energy":energy, "energy_delta":energy_delta}
    ## for excluded CMVN analyses, add:
    ## "spectro_cmvn":spectro_cmvn, "filt_cmvn":filt_cmvn, "energy_cmvn":energy_cmvn 
    # collecting the "yes" ones into a list, to later pass to analyser function:
    y_fts = []
    for ft in list(yn_fts.keys()):
        if yn_fts[ft]:
            y_fts.append(ft)
        
    # make a "custom" subdirectory of temp 
    # (safeguard against 2 people having a "john.mp3" at the same time)
    subdir = str(random.randrange(100000))
    os.mkdir("tmp/{}".format(subdir))
    
    # read files and save to disk:
    try: 
        for file in files:
            async with aiofiles.open("tmp/{}/{}".format(subdir, file.filename), 'wb') as out_file:
                content = await file.read()  # async read
                await out_file.write(content)
    except: 
        shutil.rmtree("tmp/{}/".format(subdir))
        return templates.TemplateResponse("error.html", context={"request": request})

    # shennong the devil outta them:
    for file in files:
        try: 
            await analyser (file.filename, subdir, y_fts, settings)
        except:
            shutil.rmtree("tmp/{}/".format(subdir))
            return templates.TemplateResponse("error.html", context={"request": request})
        
    # collect results files in tmp/{}/results into a zip file:
    suffix = datetime.datetime.now().strftime("%Y-%m-%d_%H%M%S")
    results = []
    for root, dirs, files in os.walk("tmp/{}/results/".format(subdir)):
        for file in files:
            results.append(os.path.join(root,file))
    
    try: 
        with ZipFile("tmp/results/results_{}_{}.zip".format(subdir,suffix), "x") as z:
            for r in results:
                r_t = r.split("/")
                r_name = r_t[-2]+"/"+r_t[-1]
                z.write(r, r_name)
    except:
        shutil.rmtree("tmp/{}/".format(subdir))
        return templates.TemplateResponse("error.html", context={"request": request})
    
    # clean out submitter's files (except results, which are saved in "results" directory):
    shutil.rmtree("tmp/{}/".format(subdir))
    
    # return results for download:
    return FileResponse("tmp/results/results_{}_{}.zip".format(subdir,suffix), media_type="application/octet-stream", filename="SpeechFeatureOnline_results_{}.zip".format(suffix))
    ## media_type value here specifies that browser needs open a file download dialog 
 
 